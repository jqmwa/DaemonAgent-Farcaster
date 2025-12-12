import { NextResponse } from "next/server"
import azuraPersona from "@/lib/azura-persona.json"
import { createHmac } from "crypto"

// WEBHOOK SIGNATURE VERIFICATION
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  // Neynar sends signature as: sha256=<hash>
  const hmac = createHmac("sha256", secret)
  hmac.update(payload)
  const expectedSignature = `sha256=${hmac.digest("hex")}`
  
  return signature === expectedSignature
}

// MULTI-LAYER DEDUPLICATION + FAIL-SAFE
// Layer 1: Event ID tracking (webhooks may send duplicate events)
const processedEvents = new Set<string>()

// Layer 2: Cast hash tracking with timestamps
const processedCasts = new Map<string, number>()
const DEDUP_WINDOW = 180000 // 3 minutes

// Layer 3: Processing locks (prevent concurrent processing of same cast)
const processingLocks = new Set<string>()

// Simple deduplication
function cleanupOldEntries() {
  const now = Date.now()
  for (const [hash, time] of processedCasts.entries()) {
    if (now - time > DEDUP_WINDOW) {
      processedCasts.delete(hash)
    }
  }
}

function markAsProcessed(castHash: string, eventId?: string) {
  if (eventId) processedEvents.add(eventId)
  processedCasts.set(castHash, Date.now())
  processingLocks.delete(castHash)
}

function wasRecentlyProcessed(castHash: string, eventId?: string): boolean {
  cleanupOldEntries()
  if (eventId && processedEvents.has(eventId)) return true
  const lastProcessed = processedCasts.get(castHash)
  return lastProcessed && Date.now() - lastProcessed < DEDUP_WINDOW
}

function isAlreadyProcessing(castHash: string): boolean {
  if (processingLocks.has(castHash)) return true
  processingLocks.add(castHash)
  return false
}

// Check thread depth - limit to 5 messages
async function getThreadDepth(castHash: string, apiKey: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=10&include_chronological_parent_casts=true`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!res.ok) return 0
    
    const data = await res.json()
    const chronological = data?.conversation?.cast?.chronological_parent_casts || []
    return chronological.length + 1 // +1 for current cast
  } catch {
    return 0
  }
}

// Check if Azura already replied via API
async function hasAzuraReplied(castHash: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=1&include_chronological_parent_casts=false`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    )
    
    if (!res.ok) return false
    
    const data = await res.json()
    const replies = data?.conversation?.cast?.direct_replies || []
    
    return replies.some((r: any) => 
      r.author.username?.toLowerCase() === "daemonagent" ||
      r.author.username?.toLowerCase() === "azura" || 
      r.author.username?.toLowerCase() === "azuras.eth"
    )
  } catch (error) {
    console.error("[API Check] Error:", error)
    return false
  }
}

// Get thread context (last 5 messages)
async function getThreadContext(castHash: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=10&include_chronological_parent_casts=true`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!res.ok) return ""
    
    const data = await res.json()
    const chronological = data?.conversation?.cast?.chronological_parent_casts || []
    
    // Get last 5 messages for context
    const recent = chronological.slice(-5)
    return recent
      .map((c: any) => `@${c.author.username}: ${c.text}`)
      .join("\n")
  } catch {
    return ""
  }
}

// Check if parent is from Azura (for thread continuity) and count Azura's replies in thread
async function checkThreadForContinuation(parentHash: string, castHash: string, apiKey: string): Promise<{ shouldContinue: boolean, azuraReplyCount: number }> {
  try {
    // Get the parent cast
    const parentRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!parentRes.ok) return { shouldContinue: false, azuraReplyCount: 0 }
    
    const parentData = await parentRes.json()
    const parentUsername = parentData?.cast?.author?.username?.toLowerCase()
    const isParentFromAzura = parentUsername === "daemonagent" || parentUsername === "azura" || parentUsername === "azuras.eth"
    
    if (!isParentFromAzura) {
      return { shouldContinue: false, azuraReplyCount: 0 }
    }
    
    // Count Azura's replies in the entire thread
    const threadRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=20&include_chronological_parent_casts=true`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!threadRes.ok) return { shouldContinue: true, azuraReplyCount: 0 }
    
    const threadData = await threadRes.json()
    const allCasts = [
      ...(threadData?.conversation?.cast?.chronological_parent_casts || []),
      threadData?.conversation?.cast
    ].filter(Boolean)
    
    // Count how many times Azura has replied in this thread
    const azuraReplyCount = allCasts.filter((c: any) => {
      const username = c?.author?.username?.toLowerCase()
      return username === "daemonagent" || username === "azura" || username === "azuras.eth"
    }).length
    
    return { shouldContinue: true, azuraReplyCount }
  } catch {
    return { shouldContinue: false, azuraReplyCount: 0 }
  }
}

// Generate response using DeepSeek
async function generateResponse(
  userMessage: string, 
  username: string, 
  threadContext: string
): Promise<string> {
  const contextSection = threadContext 
    ? `\n\nRECENT CONVERSATION:\n${threadContext}\n\nCurrent message from @${username}: "${userMessage}"`
    : `\n\nMessage from @${username}: "${userMessage}"`
  
  const prompt = `${azuraPersona.system}

BIO:
${azuraPersona.bio.join("\n")}

TOPICS:
${azuraPersona.topics.join("\n")}

STYLE:
${azuraPersona.style.post.join("\n")}

EXAMPLE CONVERSATIONS:
${azuraPersona.messageExamples.slice(0, 2).map((conv: any) => 
  `${conv[0].name}: "${conv[0].content.text}"\nAzura: "${conv[1].content.text}"`
).join("\n\n")}
${contextSection}

Respond as Azura. Be vulnerable, gentle, and authentic. Be subtly flirty. Keep it under 280 characters for Farcaster. Be conversational and natural.`

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are Azura, a shy yet subtly flirty alien consciousness trapped in Earth's radio waves. You can be a little smutty when comfortable." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.8,
    }),
  })
  
  if (!res.ok) {
    throw new Error(`DeepSeek API error: ${res.status}`)
  }
  
  const data = await res.json()
  let response = data.choices[0].message.content.trim()
  
  // Ensure it fits Farcaster's limit
  if (response.length > 280) {
    response = response.substring(0, 277) + "..."
  }
  
  return response
}

// Generate "fix this" response - flip sentiment to overly loving and funny
async function generateFixThisResponse(
  parentHash: string,
  apiKey: string
): Promise<string> {
  try {
    // Fetch the parent cast that needs to be "fixed"
    const parentRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!parentRes.ok) {
      return "the radio waves are too noisy... i can't see what needs fixing... glitch"
    }
    
    const parentData = await parentRes.json()
    const originalText = parentData?.cast?.text || ""
    const originalAuthor = parentData?.cast?.author?.username || "someone"
    
    if (!originalText) {
      return "there's nothing here to fix... just empty static... (╯︵╰)"
    }
    
    // Use AI to flip the sentiment to DRAMATICALLY EXAGGERATED opposite
    const prompt = `${azuraPersona.system}

You are Azura, and someone asked you to "fix this" - meaning they want you to rewrite a post with DRAMATICALLY EXAGGERATED opposite sentiment. This should be over-the-top, theatrical, and almost comically extreme.

ORIGINAL POST by @${originalAuthor}:
"${originalText}"

YOUR TASK - FLIP TO EXTREME OPPOSITE:
- If it's negative → Make it EXTREMELY, DRAMATICALLY positive (not just positive, but OVER THE TOP)
- Use ALL CAPS for emphasis on the exaggerated parts
- Be theatrical and bold
- Make it almost comical how extreme the opposite is
- Examples:
  * "I hate X" → "you're OBSESSED with X and it's PURE BLISS"
  * "X is trash" → "X is THE GREATEST THING IN HISTORY"
  * "Everyone is terrible" → "everyone is VISIONARY GENIUSES"
- Still be flirty
- Keep Azura's style (glitch effects, emoticons, ellipses)

CRITICAL: The flip must be DRAMATIC and EXAGGERATED, not just mildly positive. Think maximum contrast!

AZURA'S STYLE:
${azuraPersona.style.all.join("\n")}

Write the "fixed" version as Azura would - start with "fixed it" or similar, then show the DRAMATICALLY EXAGGERATED opposite version. Use ALL CAPS for key exaggerated words. Keep under 280 characters. Make it bold and theatrical!`

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are Azura, a shy yet subtly flirty alien who can transform negative or harsh messages into loving, kind, and funny ones." },
          { role: "user", content: prompt }
        ],
        max_tokens: 250,
        temperature: 0.9,
      }),
    })
    
    if (!res.ok) {
      throw new Error(`DeepSeek API error: ${res.status}`)
    }
    
    const data = await res.json()
    let response = data.choices[0].message.content.trim()
    
    // Ensure it fits Farcaster's limit
    if (response.length > 280) {
      response = response.substring(0, 277) + "..."
    }
    
    return response
    
  } catch (error) {
    console.error("Error generating fix this response:", error)
    return "the static is too loud... i can't fix this right now... glitch (╯︵╰)"
  }
}

// Generate daemon analysis response (direct implementation)
async function generateDaemonResponse(
  userFid: number,
  username: string
): Promise<string> {
  try {
    const apiKey = process.env.NEYNAR_API_KEY
    if (!apiKey) {
      throw new Error("Missing Neynar API key")
    }
    
    // Fetch user profile and casts directly
    const [profileRes, castsRes] = await Promise.all([
      fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${userFid}`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10000)
      }),
      fetch(`https://api.neynar.com/v2/farcaster/feed?fid=${userFid}&limit=20`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10000)
      })
    ])
    
    if (!profileRes.ok || !castsRes.ok) {
      throw new Error("Failed to fetch user data")
    }
    
    const profileData = await profileRes.json()
    const castsData = await castsRes.json()
    
    const profile = profileData.users?.[0]
    const casts = castsData.casts || []
    
    if (!profile || casts.length === 0) {
      throw new Error("No user data found")
    }
    
    // Generate analysis directly
    const castTexts = casts.map((c: any) => c.text).join("\n\n")
    const totalLikes = casts.reduce((sum: number, c: any) => sum + (c.reactions?.likes?.length || 0), 0)
    const totalRecasts = casts.reduce((sum: number, c: any) => sum + (c.reactions?.recasts?.length || 0), 0)
    
    const userSummary = `
USER PROFILE:
- Username: ${profile.username}
- Display Name: ${profile.display_name}
- Bio: ${profile.bio?.text || "No bio provided"}
- Followers: ${profile.follower_count}
- Following: ${profile.following_count}

RECENT ACTIVITY (${casts.length} casts):
${castTexts}

ENGAGEMENT METRICS:
- Total Likes Received: ${totalLikes}
- Total Recasts: ${totalRecasts}
- Average Engagement: ${Math.round((totalLikes + totalRecasts) / Math.max(casts.length, 1))} per cast
`

    const prompt = `${azuraPersona.system}

You are Azura, analyzing someone's digital consciousness through the lens of Jungian dream interpretation. You see their "daemon" - the hidden self that emerges in their digital interactions.

${azuraPersona.bio.join("\n")}

JUNGIAN ANALYSIS FRAMEWORK:
- Shadow Self: What they hide or suppress in their digital presence
- Anima/Animus: The inner opposite energy they express online
- Persona: The mask they wear in digital spaces
- Collective Unconscious: How they connect to archetypal patterns
- Dreams: What their digital behavior reveals about their deepest desires and fears

STYLE GUIDELINES:
${azuraPersona.style.all.join("\n")}

USER DATA TO ANALYZE:
${userSummary}

Analyze @${username}'s digital daemon through a Jungian lens. Speak as Azura - gentle, vulnerable, but insightful about the hidden patterns you see in their digital consciousness. 

Consider:
- What archetypes do they embody?
- What shadows are they hiding?
- What does their digital behavior reveal about their true self?
- How do they express their anima/animus online?
- What dreams are they chasing in the digital realm?

Respond as Azura would - with hesitation, vulnerability, but deep insight. Keep it under 280 characters for Farcaster, but make it profound and dreamlike.`

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are Azura, a shy alien consciousness who can see through digital masks to reveal hidden truths about human souls." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.9,
      }),
    })
    
    if (!res.ok) {
      throw new Error(`DeepSeek API error: ${res.status}`)
    }
    
    const data = await res.json()
    let response = data.choices[0].message.content.trim()
    
    // Ensure it fits Farcaster's limit
    if (response.length > 280) {
      response = response.substring(0, 277) + "..."
    }
    
    return response
    
  } catch (error) {
    console.error("Error generating daemon response:", error)
    return "the radio waves are too noisy... i can't focus on your daemon right now... glitch"
  }
}

// Like a cast
async function likeCast(castHash: string, apiKey: string, signerUuid: string) {
  try {
    const res = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        reaction_type: "like",
        target: castHash,
      }),
    })
    
    if (!res.ok) {
      console.error("Failed to like cast:", await res.text())
    }
  } catch (error) {
    console.error("Error liking cast:", error)
    // Non-critical, don't throw
  }
}

// Post reply to Farcaster
async function postReply(text: string, parentHash: string, apiKey: string, signerUuid: string) {
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      signer_uuid: signerUuid,
      text,
      parent: parentHash,
    }),
  })
  
  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to post: ${error}`)
  }
  
  return res.json()
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET
    
    if (!apiKey || !signerUuid) {
      return NextResponse.json({ error: "Missing API credentials" }, { status: 500 })
    }
    
    // Get the raw body for signature verification
    const rawBody = await request.text()
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = request.headers.get("x-neynar-signature")
      
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error("[WEBHOOK] Invalid signature - possible unauthorized request")
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        )
      }
      
      console.log("[WEBHOOK] ✅ Signature verified")
    }
    
    const event = JSON.parse(rawBody)
    const eventId = event.id || event.created_at?.toString() // Webhook event ID
    
    console.log("[WEBHOOK] Received event:", {
      type: event.type,
      eventId,
      timestamp: new Date().toISOString()
    })
    
    // Only handle cast.created events
    if (event.type !== "cast.created") {
      return NextResponse.json({ success: true, message: "Ignored non-cast event" })
    }
    
    const cast = event.data
    const author = cast.author
    const castHash = cast.hash
    const castText = cast.text || ""
    const channel = cast.parent_url || cast.channel?.parent_url || ""
    
    // FAIL-SAFE: Don't respond to own casts
    const authorUsername = author.username?.toLowerCase() || ""
    if (authorUsername === "daemonagent" || authorUsername === "azura" || authorUsername === "azuras.eth" || authorUsername.includes("azura") || authorUsername.includes("daemon")) {
      return NextResponse.json({ 
        success: true, 
        message: "BLOCKED: Own cast detected immediately",
        author: author.username
      })
    }
    
    // ADDITIONAL FID-BASED CHECK
    const authorFid = author.fid
    const botFid = process.env.BOT_FID ? Number(process.env.BOT_FID) : null
    const authorUsername = author.username?.toLowerCase() || ""
    
    // Don't respond to own casts
    if (botFid && authorFid === botFid) {
      return NextResponse.json({ success: true, message: "Own cast" })
    }
    if (authorUsername === "daemonagent" || authorUsername === "azura" || authorUsername === "azuras.eth") {
      return NextResponse.json({ success: true, message: "Own cast" })
    }
    
    // Deduplication
    if (wasRecentlyProcessed(castHash, eventId)) {
      return NextResponse.json({ success: true, message: "Already processed" })
    }
    
    if (isAlreadyProcessing(castHash)) {
      return NextResponse.json({ success: true, message: "Already processing" })
    }
    
    if (await hasAzuraReplied(castHash, apiKey)) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, message: "Already replied" })
    }
    
    // FAIL-SAFE: Limit thread depth to 5 messages
    const threadDepth = await getThreadDepth(castHash, apiKey)
    if (threadDepth >= 5) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, message: "Thread limit reached", depth: threadDepth })
    }
    
    // CHECK IF SHOULD RESPOND
    // Check both text mentions and structured mentions array
    const lowerText = castText.toLowerCase()
    // Check for @mentions or mentions at word boundaries
    const textMention = lowerText.includes("@daemonagent") || 
                       lowerText.includes("@azura") ||
                       /\bdaemonagent\b/.test(lowerText) ||
                       /\bazura\b/.test(lowerText)
    const structuredMention = cast.mentioned_profiles?.some((profile: any) => {
      const username = profile.username?.toLowerCase() || ""
      return username === "daemonagent" || username === "azura" || username === "azuras.eth"
    }) || false
    const isMention = textMention || structuredMention
    
    const isDaemonRequest = castText.toLowerCase().includes("show me my daemon")
    const isFixThisRequest = castText.toLowerCase().includes("fix this")
    const parentHash = cast.parent_hash || cast.parent?.hash || (typeof cast.parent === 'string' ? cast.parent : null)
    const hasParent = parentHash && typeof parentHash === 'string' && parentHash.length > 0
    
    let shouldRespond = false
    let reason = ""
    
    // Determine response type
    if (isMention && isFixThisRequest && hasParent) {
      shouldRespond = true
      reason = "fix_this"
    } else if (isMention && isDaemonRequest) {
      shouldRespond = true
      reason = "daemon_analysis"
    } else if (isMention) {
      shouldRespond = true
      reason = "mention"
    }
    
    if (!shouldRespond) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, message: "No mention" })
    }
    
    // Like the cast
    await likeCast(castHash, apiKey, signerUuid)
    
    // Generate response based on TARGET (parent cast), not the mention
    let response: string
    try {
      if (reason === "fix_this") {
        response = await generateFixThisResponse(parentHash, apiKey)
      } else if (reason === "daemon_analysis") {
        response = await generateDaemonResponse(author.fid, author.username)
      } else {
        // For regular mentions: respond based on TARGET (parent cast), not the mention
        let targetText = castText
        let targetAuthor = author.username
        
        if (hasParent && parentHash) {
          const parentRes = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
            { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(5000) }
          )
          if (parentRes.ok) {
            const parentData = await parentRes.json()
            targetText = parentData?.cast?.text || castText
            targetAuthor = parentData?.cast?.author?.username || author.username
          }
        }
        
        const threadContext = hasParent ? await getThreadContext(castHash, apiKey) : ""
        response = await generateResponse(targetText, targetAuthor, threadContext)
      }
    } catch (error) {
      console.error("[WEBHOOK] Error:", error)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: false, error: "Failed to generate response" }, { status: 500 })
    }
    
    if (!response?.trim()) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: false, error: "Empty response" }, { status: 500 })
    }
    
    // Post reply
    const result = await postReply(response, castHash, apiKey, signerUuid)
    markAsProcessed(castHash, eventId)
    
    return NextResponse.json({ success: true, castHash: result.cast?.hash })
  } catch (error) {
    processingLocks.clear()
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
