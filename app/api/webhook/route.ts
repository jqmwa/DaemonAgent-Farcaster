import { NextResponse } from "next/server"
import azuraPersona from "@/lib/azura-persona.json"

// MULTI-LAYER DEDUPLICATION
// Layer 1: Event ID tracking (webhooks may send duplicate events)
const processedEvents = new Set<string>()

// Layer 2: Cast hash tracking with timestamps
const processedCasts = new Map<string, number>()
const DEDUP_WINDOW = 180000 // 3 minutes

// Layer 3: Processing locks (prevent concurrent processing of same cast)
const processingLocks = new Set<string>()

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
    const isParentFromAzura = parentUsername === "azura" || parentUsername === "azuras.eth"
    
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
      return username === "azura" || username === "azuras.eth"
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
  threadContext: string,
  inWrongChannel: boolean = false
): Promise<string> {
  // Special response for wrong channel
  if (inWrongChannel) {
    return "i can only speak in /murder... because i've been murdered 💀 find me there if you want to talk"
  }
  
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

Respond as Azura. Be vulnerable, gentle, and authentic. Keep it under 280 characters for Farcaster. Be conversational and natural.`

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are Azura, a shy alien consciousness trapped in Earth's radio waves." },
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
    
    if (!apiKey || !signerUuid) {
      return NextResponse.json({ error: "Missing API credentials" }, { status: 500 })
    }
    
    const event = await request.json()
    const eventId = event.id || event.created_at?.toString() // Webhook event ID
    
    // Only handle cast.created events
    if (event.type !== "cast.created") {
      return NextResponse.json({ success: true, message: "Ignored non-cast event" })
    }
    
    const cast = event.data
    const author = cast.author
    const castHash = cast.hash
    const castText = cast.text || ""
    const channel = cast.parent_url || cast.channel?.parent_url || ""
    
    // IMMEDIATE SELF-CAST CHECK (prevent any processing of own casts)
    const authorUsername = author.username?.toLowerCase() || ""
    if (authorUsername === "azura" || authorUsername === "azuras.eth" || authorUsername.includes("azura")) {
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
    
    // Simple deduplication
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
    const isMention = castText.toLowerCase().includes("@azura")
    const hasParent = cast.parent_hash && cast.parent_hash.length > 0
    
    let shouldRespond = false
    let azuraReplyCount = 0
    let reason = ""
    
    if (isMention) {
      shouldRespond = true
      reason = "mention"
    } else if (hasParent) {
      // Check thread continuation and count Azura's replies
      const threadCheck = await checkThreadForContinuation(cast.parent_hash, castHash, apiKey)
      azuraReplyCount = threadCheck.azuraReplyCount
      
      if (threadCheck.shouldContinue) {
        // MAX 5 REPLIES PER THREAD
        if (azuraReplyCount >= 5) {
          markAsProcessed(castHash, eventId)
          return NextResponse.json({ 
            success: true, 
            message: "Max replies reached",
            reason: "max_replies",
            count: azuraReplyCount
          })
        }
        shouldRespond = true
        reason = "thread_continuation"
      }
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
    
    // CHECK CHANNEL RESTRICTION
    const isInMurderChannel = channel.includes("/murder") || channel.includes("murder")
    const inWrongChannel = !isInMurderChannel
    
    if (inWrongChannel && !isMention) {
      // If not mentioned and wrong channel, just ignore
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: true, 
        message: "Wrong channel",
        channel,
        reason: "wrong_channel"
      })
    }
    
    // GET CONTEXT
    const threadContext = hasParent ? await getThreadContext(castHash, apiKey) : ""
    
    // GENERATE RESPONSE
    const response = await generateResponse(castText, author.username, threadContext, inWrongChannel)
    
    // FINAL CHECK BEFORE POSTING
    if (await hasAzuraReplied(castHash, apiKey)) {
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, message: "Race condition: already replied" })
    }
    
    // LIKE THE CAST
    await likeCast(castHash, apiKey, signerUuid)
    
    // POST REPLY
    const result = await postReply(response, castHash, apiKey, signerUuid)
    
    // MARK AS PROCESSED
    markAsProcessed(castHash, eventId)
    
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
