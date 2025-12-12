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

// FAIL-SAFE: Emergency brake to prevent spam
const responseCounter = new Map<string, number>()
const MAX_RESPONSES_PER_MINUTE = 10
const EMERGENCY_STOP = process.env.EMERGENCY_STOP === "true"

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

function isAlreadyProcessing(castHash: string): boolean {
  if (processingLocks.has(castHash)) {
    return true
  }
  processingLocks.add(castHash)
  return false
}

function wasRecentlyProcessed(castHash: string, eventId?: string): boolean {
  cleanupOldEntries()
  
  // Check event ID first
  if (eventId && processedEvents.has(eventId)) {
    return true
  }
  
  // Check cast hash
  const lastProcessed = processedCasts.get(castHash)
  if (lastProcessed && Date.now() - lastProcessed < DEDUP_WINDOW) {
    return true
  }
  
  return false
}

function checkEmergencyStop(): boolean {
  if (EMERGENCY_STOP) {
    return true
  }
  
  const now = Date.now()
  const minuteAgo = now - 60000
  
  // Count responses in last minute
  let recentResponses = 0
  for (const [timestamp, count] of responseCounter.entries()) {
    if (parseInt(timestamp) > minuteAgo) {
      recentResponses += count
    }
  }
  
  return recentResponses >= MAX_RESPONSES_PER_MINUTE
}

function recordResponse() {
  const now = Date.now()
  const minute = Math.floor(now / 60000) * 60000
  responseCounter.set(minute.toString(), (responseCounter.get(minute.toString()) || 0) + 1)
}

// Check user's Neynar score
async function checkNeynarScore(fid: number, apiKey: string): Promise<{ allowed: boolean; score: number | null }> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!res.ok) {
      console.error("[Neynar Score] Failed to fetch user data:", res.status)
      return { allowed: true, score: null } // Allow on API error to avoid blocking legitimate users
    }
    
    const data = await res.json()
    const user = data?.users?.[0]
    const score = user?.experimental?.neynar_user_score || 0
    
    console.log("[Neynar Score] User FID:", fid, "Score:", score)
    
    // Require score of 0.8 or above
    return { allowed: score >= 0.8, score }
  } catch (error) {
    console.error("[Neynar Score] Error checking score:", error)
    return { allowed: true, score: null } // Allow on error
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
    
    console.log("[WEBHOOK] Cast received:", {
      author: author.username,
      text: castText.substring(0, 100),
      hash: castHash,
      hasMentionedProfiles: !!cast.mentioned_profiles,
      mentionedCount: cast.mentioned_profiles?.length || 0
    })
    
    // EMERGENCY STOP CHECK
    if (checkEmergencyStop()) {
      return NextResponse.json({ 
        success: true, 
        message: "EMERGENCY STOP: Too many responses per minute",
        emergencyStop: true
      })
    }

    // IMMEDIATE SELF-CAST CHECK (prevent any processing of own casts)
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
    
    if (botFid && authorFid === botFid) {
      return NextResponse.json({ 
        success: true, 
        message: "BLOCKED: Own FID detected",
        author: author.username,
        fid: authorFid,
        botFid: botFid
      })
    }
    
    // Simple deduplication (moved score check to after interaction type determination)
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
    // Check multiple possible parent fields (Neynar webhook structure may vary)
    // For replies, parent_hash should be present. Also check parent object structure.
    const parentHash = cast.parent_hash || 
                       cast.parent?.hash || 
                       (typeof cast.parent === 'string' ? cast.parent : null) ||
                       cast.parent_author?.hash ||
                       null
    const hasParent = parentHash && typeof parentHash === 'string' && parentHash.length > 0
    
    console.log("[WEBHOOK] Mention check:", {
      textMention,
      structuredMention,
      isMention,
      isDaemonRequest,
      isFixThisRequest,
      hasParent,
      parentHash,
      parentHashType: typeof parentHash,
      castParentHash: cast.parent_hash,
      castParent: cast.parent,
      mentionedProfiles: cast.mentioned_profiles?.map((p: any) => p.username)
    })
    
    let shouldRespond = false
    let azuraReplyCount = 0
    let reason = ""
    let isThreadContinuation = false
    
    if (isMention && isFixThisRequest && hasParent) {
      shouldRespond = true
      reason = "fix_this"
      console.log("[WEBHOOK] ✅ Fix this request detected:", {
        commander: author.username,
        commanderFid: authorFid,
        parentHash,
        commanderCastText: castText,
        commanderCastHash: castHash
      })
    } else if (isMention && isFixThisRequest && !hasParent) {
      console.log("[WEBHOOK] ⚠️ Fix this request detected but no parent found - Commander must REPLY to the cast they want fixed:", {
        commander: author.username,
        castText,
        parentHash,
        parentHashType: typeof parentHash,
        castKeys: Object.keys(cast),
        castParent: cast.parent,
        castParentHash: cast.parent_hash
      })
      // Don't respond if no parent - "fix this" requires a reply to the target cast
    } else if (isMention && isDaemonRequest) {
      shouldRespond = true
      reason = "daemon_analysis"
    } else if (isMention) {
      shouldRespond = true
      reason = "mention"
    } else if (hasParent) {
      // Check thread continuation and count Azura's replies
      const threadParentHash = cast.parent_hash || cast.parent?.hash || cast.parent
      const threadCheck = await checkThreadForContinuation(threadParentHash, castHash, apiKey)
      azuraReplyCount = threadCheck.azuraReplyCount
      
      if (threadCheck.shouldContinue) {
        // MAX 3 REPLIES PER THREAD (user>azura>user>azura>user>azura)
        if (azuraReplyCount >= 3) {
          markAsProcessed(castHash, eventId)
          return NextResponse.json({ 
            success: true, 
            message: "Max replies reached (3 reply limit)",
            reason: "max_replies",
            count: azuraReplyCount
          })
        }
        shouldRespond = true
        reason = "thread_continuation"
        isThreadContinuation = true
      }
    }
    
    // CHECK NEYNAR SCORE (must be 0.8 or above)
    // Only for NEW interactions (mentions/commands), NOT for thread continuations
    if (!isThreadContinuation) {
      const scoreCheck = await checkNeynarScore(authorFid, apiKey)
      if (!scoreCheck.allowed) {
        console.log("[WEBHOOK] User blocked due to low Neynar score:", {
          username: author.username,
          fid: authorFid,
          score: scoreCheck.score,
          reason: "new_interaction"
        })
        
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ 
          success: true, 
          message: "User Neynar score below threshold for new interactions",
          author: author.username,
          fid: authorFid,
          score: scoreCheck.score,
          required: 0.8
        })
      }
      
      console.log("[WEBHOOK] User passed Neynar score check:", {
        username: author.username,
        fid: authorFid,
        score: scoreCheck.score,
        interactionType: reason
      })
    } else {
      console.log("[WEBHOOK] Thread continuation - bypassing score check:", {
        username: author.username,
        fid: authorFid
      })
    }
    
    if (!shouldRespond) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: true, 
        message: "No response needed",
        reason: "no_mention_or_thread",
        isMention,
        hasParent
      })
    }
    
    console.log("[WEBHOOK] 🚀 Processing response:", {
      reason,
      author: author.username,
      authorFid: authorFid,
      castHash,
      isThreadContinuation
    })
    
    // LIKE THE CAST (do this early so it happens even if response generation fails)
    console.log("[WEBHOOK] Liking cast from:", author.username)
    await likeCast(castHash, apiKey, signerUuid)
    
    // GET CONTEXT
    const threadContext = hasParent ? await getThreadContext(castHash, apiKey) : ""
    
    // GENERATE RESPONSE
    let response: string
    try {
      if (reason === "fix_this") {
        const fixParentHash = cast.parent_hash || cast.parent?.hash || cast.parent
        console.log("[WEBHOOK] Generating fix this response for parent:", fixParentHash)
        response = await generateFixThisResponse(fixParentHash, apiKey)
        console.log("[WEBHOOK] Generated fix this response:", response.substring(0, 100))
      } else if (reason === "daemon_analysis") {
        console.log("[WEBHOOK] Generating daemon analysis for:", author.username)
        response = await generateDaemonResponse(author.fid, author.username)
        console.log("[WEBHOOK] Generated daemon response:", response.substring(0, 100))
      } else {
        console.log("[WEBHOOK] Generating regular response for:", author.username)
        response = await generateResponse(castText, author.username, threadContext)
        console.log("[WEBHOOK] Generated response:", response.substring(0, 100))
      }
    } catch (error) {
      console.error("[WEBHOOK] Error generating response:", error)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: false, 
        message: "Failed to generate response",
        error: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 })
    }
    
    if (!response || response.trim().length === 0) {
      console.error("[WEBHOOK] Empty response generated")
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: false, 
        message: "Empty response generated"
      }, { status: 500 })
    }
    
    // FINAL CHECK BEFORE POSTING
    if (await hasAzuraReplied(castHash, apiKey)) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, message: "Race condition: already replied" })
    }
    
    // POST REPLY
    console.log("[WEBHOOK] Posting reply to cast:", castHash)
    let result
    try {
      result = await postReply(response, castHash, apiKey, signerUuid)
      console.log("[WEBHOOK] ✅ Reply posted successfully:", result.cast?.hash)
    } catch (error) {
      console.error("[WEBHOOK] ❌ Error posting reply:", error)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: false, 
        message: "Failed to post reply",
        error: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 })
    }
    
    // MARK AS PROCESSED
    markAsProcessed(castHash, eventId)
    recordResponse()
    
    return NextResponse.json({
      success: true,
      message: "Replied successfully",
      response,
      castHash: result.cast?.hash,
      reason,
      author: author.username,
      channel
    })
    
  } catch (error) {
    // Clean up processing lock on error
    processingLocks.clear()
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
