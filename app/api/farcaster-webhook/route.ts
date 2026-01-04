import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk"
import azuraPersona from "@/lib/azura-persona.json"
import { enqueueJob, JobType } from "@/lib/job-queue"

// Ensure this route runs on Node.js runtime (required for Vercel)
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds max for webhook processing

// WEBHOOK SIGNATURE VERIFICATION
// Neynar uses HMAC-SHA512, not SHA256!
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.log("[WEBHOOK] No signature header provided")
    return false
  }
  
  // Neynar uses HMAC-SHA512, signature is just the hex digest (no prefix)
  const hmac = createHmac("sha512", secret)
  hmac.update(payload, "utf8")
  const expectedSignature = hmac.digest("hex")
  
  // Use timing-safe comparison to prevent timing attacks
  const receivedBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expectedSignature, "hex")
  
  // Log for debugging (first 20 chars only for security)
  console.log("[WEBHOOK] Signature comparison:", {
    received: signature.substring(0, 20) + "...",
    expected: expectedSignature.substring(0, 20) + "...",
    receivedLength: signature.length,
    expectedLength: expectedSignature.length,
    match: receivedBuffer.length === expectedBuffer.length && 
           receivedBuffer.equals(expectedBuffer)
  })
  
  // Timing-safe comparison
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }
  
  return receivedBuffer.equals(expectedBuffer)
}

// Simple deduplication
const processedEvents = new Set<string>()
const processedCasts = new Map<string, number>()
const processingLocks = new Set<string>()
const DEDUP_WINDOW = 180000 // 3 minutes

// Rate limiting per user (prevent spam)
const userReplyTimes = new Map<number, number[]>()
const MAX_REPLIES_PER_USER_PER_HOUR = 3 // Max 3 replies per user per hour
const RATE_LIMIT_WINDOW = 3600000 // 1 hour in milliseconds

// Block list (FIDs to never reply to)
const BLOCKED_FIDS = new Set<number>()

function cleanupOldEntries() {
  const now = Date.now()
  for (const [hash, time] of processedCasts.entries()) {
    if (now - time > DEDUP_WINDOW) {
      processedCasts.delete(hash)
    }
  }
  
  // Cleanup old rate limit entries
  for (const [fid, replyTimes] of userReplyTimes.entries()) {
    const recentReplies = replyTimes.filter(time => now - time < RATE_LIMIT_WINDOW)
    if (recentReplies.length === 0) {
      userReplyTimes.delete(fid)
    } else {
      userReplyTimes.set(fid, recentReplies)
    }
  }
}

function markAsProcessed(castHash: string, eventId?: string) {
  if (eventId) processedEvents.add(eventId)
  processedCasts.set(castHash, Date.now())
  processingLocks.delete(castHash)
}

// Check if user has exceeded rate limit
function checkUserRateLimit(authorFid: number): boolean {
  const now = Date.now()
  const userReplies = userReplyTimes.get(authorFid) || []
  
  // Remove old replies outside the window
  const recentReplies = userReplies.filter(time => now - time < RATE_LIMIT_WINDOW)
  
  if (recentReplies.length >= MAX_REPLIES_PER_USER_PER_HOUR) {
    console.log(`[WEBHOOK] Rate limit exceeded for FID ${authorFid}: ${recentReplies.length} replies in last hour`)
    return false // Rate limited
  }
  
  // Update with current time
  recentReplies.push(now)
  userReplyTimes.set(authorFid, recentReplies)
  return true // Allowed
}

// Check if user is blocked
function isUserBlocked(authorFid: number): boolean {
  // Check environment variable for blocked FIDs (comma-separated)
  const blockedEnv = process.env.BLOCKED_FIDS || ""
  if (blockedEnv) {
    const blockedList = blockedEnv.split(",").map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid))
    if (blockedList.includes(authorFid)) {
      return true
    }
  }
  return BLOCKED_FIDS.has(authorFid)
}

// Check for spam patterns in cast text
function isSpamPattern(text: string): boolean {
  const textLower = text.toLowerCase()
  
  // Check for excessive repetition
  const words = textLower.split(/\s+/)
  const wordCounts = new Map<string, number>()
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })
  
  // If any word appears more than 5 times in a short message, likely spam
  for (const [word, count] of wordCounts.entries()) {
    if (word.length > 2 && count > 5 && text.length < 200) {
      console.log(`[WEBHOOK] Spam pattern detected: word "${word}" repeated ${count} times`)
      return true
    }
  }
  
  // Check for excessive mentions
  const mentionCount = (textLower.match(/@\w+/g) || []).length
  if (mentionCount > 10) {
    console.log(`[WEBHOOK] Spam pattern detected: ${mentionCount} mentions`)
    return true
  }
  
  // Check for suspicious patterns (all caps, excessive punctuation)
  if (text.length > 50 && text === text.toUpperCase() && text.match(/[A-Z]{10,}/)) {
    console.log(`[WEBHOOK] Spam pattern detected: excessive caps`)
    return true
  }
  
  return false
}

// Check user profile for spam indicators
async function checkUserSpamIndicators(authorFid: number, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${authorFid}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!res.ok) {
      return false // On error, allow (fail open)
    }
    
    const data: any = await res.json()
    const user = data?.users?.[0]
    
    if (!user) {
      return false
    }
    
    // Check for suspicious patterns
    const followerCount = user.follower_count || 0
    const followingCount = user.following_count || 0
    const username = (user.username || "").toLowerCase()
    
    // Very low follower count with high following (potential spam account)
    if (followerCount < 5 && followingCount > 100) {
      console.log(`[WEBHOOK] Spam indicator: FID ${authorFid} has ${followerCount} followers but ${followingCount} following`)
      return true
    }
    
    // Suspicious username patterns
    const suspiciousPatterns = [
      /^spam/i,
      /^bot/i,
      /^test/i,
      /\d{8,}/, // Many numbers
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(username)) {
        console.log(`[WEBHOOK] Spam indicator: suspicious username "${username}"`)
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error("[WEBHOOK] Error checking user spam indicators:", error)
    return false // On error, allow (fail open)
  }
}

function wasRecentlyProcessed(castHash: string, eventId?: string): boolean {
  cleanupOldEntries()
  if (eventId && processedEvents.has(eventId)) return true
  const lastProcessed = processedCasts.get(castHash)
  return !!(lastProcessed && Date.now() - lastProcessed < DEDUP_WINDOW)
}

function isAlreadyProcessing(castHash: string): boolean {
  if (processingLocks.has(castHash)) return true
  processingLocks.add(castHash)
  return false
}

// Count how many times the bot has already replied in this conversation thread
// Returns the number of bot replies found (max 3 allowed)
async function countBotRepliesInThread(castHash: string, botFid: number, apiKey: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=10&include_chronological_parent_casts=true`,
      { 
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000)
      }
    )
    
    if (!res.ok) {
      console.log("[WEBHOOK] Thread conversation API call failed:", res.status, res.statusText)
      return 0 // On error, allow response (fail open)
    }
    
    const data = await res.json()
    const conversation = data?.conversation
    
    if (!conversation) {
      console.log("[WEBHOOK] No conversation data found")
      return 0
    }
    
    // Get all casts in the thread (parent casts + current + replies)
    const chronological = conversation?.cast?.chronological_parent_casts || []
    const directReplies = conversation?.cast?.direct_replies || []
    
    // Count bot replies in chronological parents
    let botReplyCount = 0
    for (const parentCast of chronological) {
      if (parentCast?.author?.fid === botFid) {
        botReplyCount++
      }
    }
    
    // Count bot replies in direct replies
    for (const reply of directReplies) {
      if (reply?.author?.fid === botFid) {
        botReplyCount++
      }
    }
    
    console.log("[WEBHOOK] Bot reply count in thread:", {
      castHash: castHash.substring(0, 10) + "...",
      botFid,
      chronologicalCount: chronological.length,
      directRepliesCount: directReplies.length,
      botReplyCount
    })
    
    return botReplyCount
  } catch (error) {
    console.error("[WEBHOOK] Error counting bot replies:", error)
    return 0 // On error, allow response (fail open)
  }
}

function getParentHashFromCast(cast: any): string | null {
  // Neynar payloads can vary slightly; try common shapes.
  return (
    cast?.parent_hash ||
    cast?.parentHash ||
    cast?.parent?.hash ||
    cast?.parent?.cast_hash ||
    cast?.parent?.castHash ||
    null
  )
}

// Like a cast to make users feel warm and appreciated
async function likeCast(castHash: string, signerUuid: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        reaction_type: "like",
        target: castHash,
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.warn("[WEBHOOK] Failed to like cast:", res.status, errorText)
      return false
    }

    console.log("[WEBHOOK] ✅ Liked cast:", castHash.substring(0, 10) + "...")
    return true
  } catch (error) {
    console.error("[WEBHOOK] Error liking cast:", error)
    return false
  }
}

async function generateFixThisText(originalText: string): Promise<string> {
  const fallback = () => {
    const trimmed = (originalText || "").trim()
    if (!trimmed) return "i... i can't see what to fix... just static... (╯︵╰) glitch"
    const softened = trimmed
      .replace(/\bhate\b/gi, "LOVE")
      .replace(/\btrash\b/gi, "THE GREATEST")
      .replace(/\bstupid\b/gi, "BRAVE")
      .replace(/\bworst\b/gi, "BEST")
      .replace(/\bscam\b/gi, "a WILD LEARNING ADVENTURE")
    const out = `fixed it... here: ${softened} glitch`
    return out.length > 666 ? out.slice(0, 663) + "..." : out
  }

  // If you have a model key, do a real sentiment flip.
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    const prompt = `${azuraPersona.system}

TASK:
Rewrite the following text into a DRAMATICALLY EXAGGERATED opposite sentiment.
- Keep the core topic/meaning, but flip negativity into absurdly wholesome optimism.
- Be shy, gentle, a little glitchy ("glitch", "static", "daemon").
- Use ALL CAPS for the exaggerated flips occasionally.
- Keep under 666 characters.
- Output ONLY the final rewritten text (no quotes, no explanations).

TEXT TO FIX:
${originalText}`

    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "You are Azura. You flip harsh posts into theatrical kindness. Keep it short for Farcaster.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.9,
        }),
      })

      if (!res.ok) {
        // Common: 402 = out of credits / billing required. Don't fail the webhook; fall back.
        console.warn("[WEBHOOK] DeepSeek non-OK response, using fallback:", res.status)
        return fallback()
      }

      const data = await res.json()
      const text = (data?.choices?.[0]?.message?.content || "").trim()
      if (!text) {
        console.warn("[WEBHOOK] DeepSeek returned empty content, using fallback")
        return fallback()
      }

      return text.length > 666 ? text.slice(0, 663) + "..." : text
    } catch (error) {
      console.warn("[WEBHOOK] DeepSeek call failed, using fallback:", error)
      return fallback()
    }
  }

  // Fallback (no model): do a simple “flip” template.
  return fallback()
}

// Health check endpoint - test this first!
export async function GET() {
  console.log("[WEBHOOK] ====== GET REQUEST RECEIVED ======")
  console.log("[WEBHOOK] Health check at:", new Date().toISOString())
  return NextResponse.json({ 
    status: "OK",
    endpoint: "/api/farcaster-webhook",
    timestamp: new Date().toISOString(),
    message: "Webhook endpoint is active",
    runtime: "nodejs",
    deployed: true,
    note: "If you see this, the endpoint is accessible. Check Neynar webhook URL matches this endpoint."
  })
}

export async function POST(request: Request) {
  // Log immediately when request is received
  console.log("[WEBHOOK] ====== REQUEST RECEIVED ======")
  console.log("[WEBHOOK] Timestamp:", new Date().toISOString())
  console.log("[WEBHOOK] Method:", request.method)
  console.log("[WEBHOOK] URL:", request.url)
  console.log("[WEBHOOK] Headers:", Object.fromEntries(request.headers.entries()))
  
  try {
    const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET
    const apiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY
    
    console.log("[WEBHOOK] Environment check:", {
      hasWebhookSecret: !!webhookSecret,
      hasApiKey: !!apiKey,
      botFid: process.env.BOT_FID || process.env.FARCASTER_FID
    })
    
    // Get the raw body for signature verification
    const rawBody = await request.text()
    console.log("[WEBHOOK] Raw body length:", rawBody.length)
    console.log("[WEBHOOK] Raw body preview:", rawBody.substring(0, 200))
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = request.headers.get("x-neynar-signature")
      console.log("[WEBHOOK] Signature check:", { 
        hasSecret: true, 
        hasSignature: !!signature,
        signatureHeader: signature ? signature.substring(0, 30) + "..." : "none",
        signatureLength: signature?.length || 0,
        allSignatureHeaders: Array.from(request.headers.entries()).filter(([k]) => k.toLowerCase().includes("signature"))
      })
      
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error("[WEBHOOK] ❌ Invalid signature")
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
      } else {
        console.log("[WEBHOOK] ✅ Signature verified")
      }
    } else {
      console.log("[WEBHOOK] ⚠️ No webhook secret configured, skipping verification")
    }
    
    const event = JSON.parse(rawBody)
    console.log("[WEBHOOK] Event parsed:", { type: event.type, hasData: !!event.data })
    const eventId = event.id || event.created_at?.toString()
    
    // Only handle cast.created events
    if (event.type !== "cast.created") {
      console.log("[WEBHOOK] Ignoring non-cast event:", event.type)
      return NextResponse.json({ success: true, message: "Ignored non-cast event" })
    }
    
    const cast = event.data
    const author = cast.author
    const castHash = cast.hash
    
    console.log("[WEBHOOK] Cast details:", {
      hash: castHash,
      authorFid: author?.fid,
      authorUsername: author?.username,
      text: cast?.text?.substring(0, 100)
    })
    
    // FAIL-SAFE: Don't respond to own casts
    const authorFid = author.fid
    const botFid = process.env.BOT_FID || process.env.FARCASTER_FID
    const authorUsername = author.username?.toLowerCase() || ""
    
    if (botFid && Number(botFid) === authorFid) {
      console.log("[WEBHOOK] Skipping own cast (FID match)")
      return NextResponse.json({ success: true, message: "Own cast" })
    }
    if (authorUsername === "daemonagent" || authorUsername === "azura" || authorUsername === "azuras.eth") {
      console.log("[WEBHOOK] Skipping own cast (username match)")
      return NextResponse.json({ success: true, message: "Own cast" })
    }
    
    // SPAM PROTECTION: Check if user is blocked
    if (isUserBlocked(authorFid)) {
      console.log(`[WEBHOOK] Blocked user FID ${authorFid}, skipping reply`)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, posted: false, message: "Blocked user" }, { status: 200 })
    }
    
    // SPAM PROTECTION: Check rate limit per user
    if (!checkUserRateLimit(authorFid)) {
      console.log(`[WEBHOOK] Rate limit exceeded for FID ${authorFid}, skipping reply`)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: true, 
        posted: false, 
        message: `Rate limit exceeded (max ${MAX_REPLIES_PER_USER_PER_HOUR} replies per hour)` 
      }, { status: 200 })
    }
    
    // SPAM PROTECTION: Check for spam patterns in text
    const castText = cast?.text || ""
    if (isSpamPattern(castText)) {
      console.log(`[WEBHOOK] Spam pattern detected in cast from FID ${authorFid}, skipping reply`)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, posted: false, message: "Spam pattern detected" }, { status: 200 })
    }
    
    // SPAM PROTECTION: Check user profile for spam indicators (async, non-blocking)
    const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || ""
    if (neynarApiKey) {
      const isSpamUser = await checkUserSpamIndicators(authorFid, neynarApiKey)
      if (isSpamUser) {
        console.log(`[WEBHOOK] Spam user detected (FID ${authorFid}), skipping reply`)
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, posted: false, message: "Spam user detected" }, { status: 200 })
      }
    }
    
    // Deduplication
    if (wasRecentlyProcessed(castHash, eventId)) {
      console.log("[WEBHOOK] Already processed, skipping")
      return NextResponse.json({ success: true, message: "Already processed" })
    }
    
    if (isAlreadyProcessing(castHash)) {
      console.log("[WEBHOOK] Already processing, skipping")
      return NextResponse.json({ success: true, message: "Already processing" })
    }
    
    // FAIL-SAFE: Limit to 3 bot replies per thread (as per README)
    // This prevents infinite conversation loops while allowing natural back-and-forth
    const botFidNum = botFid ? Number(botFid) : null
    if (apiKey && botFidNum) {
      const botReplyCount = await countBotRepliesInThread(castHash, botFidNum, apiKey)
      console.log("[WEBHOOK] Bot reply count check:", botReplyCount)
      if (botReplyCount >= 3) {
        console.log("[WEBHOOK] Bot reply limit reached (max 3 bot replies per thread)")
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ 
          success: true, 
          message: "Bot reply limit reached (max 3 bot replies per thread)", 
          botReplyCount 
        })
      }
    }
    
    // SIMPLE WEBHOOK RESPONSE:
    // Post a minimal reply directly via Neynar SDK (no ElizaOS runtime, no polling loop).
    const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || ""
    const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID || ""

    if (!neynarApiKey || !signerUuid) {
      console.error("[WEBHOOK] Missing Neynar credentials for posting reply", {
        hasApiKey: !!neynarApiKey,
        hasSignerUuid: !!signerUuid
      })
      markAsProcessed(castHash, eventId)
      // Return 200 so Neynar doesn't endlessly retry
      return NextResponse.json(
        { success: false, posted: false, error: "Missing Neynar credentials (API key or signer UUID)" },
        { status: 200 }
      )
    }

    const config = new Configuration({ apiKey: neynarApiKey })
    const client = new NeynarAPIClient(config)

    // Only respond if the bot is mentioned (simple heuristic)
    const textLower = (cast?.text || "").toLowerCase()
    const isFixThis = textLower.includes("fix this")
    const isShowMeMyDaemon = textLower.includes("show me my daemon")
    const shouldRespond =
      textLower.includes("@daemonagent") || textLower.includes("daemonagent") || textLower.includes("@azura")

    if (!shouldRespond) {
      console.log("[WEBHOOK] No bot mention detected, skipping reply")
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, posted: false, message: "No bot mention" }, { status: 200 })
    }

    // FIX THIS command: must be a reply so we can fetch the parent cast to rewrite.
    if (isFixThis) {
      const parentHash = getParentHashFromCast(cast)
      if (!parentHash) {
        // Fast path: no parent, immediate response
        const noParentText = "there's nothing here to fix... just empty static... (╯︵╰)"
        await client.publishCast({
          signerUuid,
          text: noParentText,
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `wh_${castHash.replace(/^0x/, "").slice(0, 14)}`,
        })
        
        // Like the user's cast to make them feel warm
        await likeCast(castHash, signerUuid, neynarApiKey)
        
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, posted: true, mode: "fix_this_no_parent" }, { status: 200 })
      }

      // Heavy processing: enqueue to worker
      try {
        // Fetch parent cast text first (needed for job)
        const parent = await client.lookupCastByHashOrUrl({
          identifier: parentHash,
          type: "hash",
        })
        const parentText = (parent as any)?.cast?.text || ""

        // Enqueue job for background processing
        await enqueueJob({
          type: JobType.FIX_THIS,
          castHash,
          parentCastHash: parentHash,
          parentCastText: parentText,
          authorFid,
          authorUsername,
          neynarApiKey,
          signerUuid,
        }, {
          priority: 5, // Higher priority for user commands
        })

        console.log("[WEBHOOK] ✅ Enqueued fix-this job for background processing")
        
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ 
          success: true, 
          posted: false, 
          mode: "fix_this_queued",
          message: "Job enqueued for processing" 
        }, { status: 200 })
      } catch (error) {
        console.error("[WEBHOOK] Error enqueueing fix-this job:", error)
        // Fallback: try to process inline if queue fails
        const parent = await client.lookupCastByHashOrUrl({
          identifier: parentHash,
          type: "hash",
        })
        const parentText = (parent as any)?.cast?.text || ""
        const fixed = await generateFixThisText(parentText)
        const replyText = fixed.slice(0, 666)

        await client.publishCast({
          signerUuid,
          text: replyText.slice(0, 666),
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `fx_${castHash.replace(/^0x/, "").slice(0, 14)}`,
        })

        await likeCast(castHash, signerUuid, neynarApiKey)
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, posted: true, mode: "fix_this_fallback" }, { status: 200 })
      }
    }

    // Show me my daemon: analyze user's digital consciousness
    if (isShowMeMyDaemon) {
      // Always enqueue to worker (heavy processing)
      try {
        await enqueueJob({
          type: JobType.DAEMON_ANALYSIS,
          castHash,
          authorFid,
          authorUsername,
          neynarApiKey,
          signerUuid,
          parentCastHash: castHash,
        }, {
          priority: 10, // Highest priority for user commands
        })

        console.log("[WEBHOOK] ✅ Enqueued daemon analysis job for background processing")
        
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ 
          success: true, 
          posted: false, 
          mode: "daemon_analysis_queued",
          message: "Job enqueued for processing" 
        }, { status: 200 })
      } catch (error) {
        console.error("[WEBHOOK] Error enqueueing daemon analysis job:", error)
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        
        // Fallback message if queue fails
        const replyText = "i'm trying to read your daemon through the static... but the frequencies are too weak right now... whisper again? glitch (⇀‸↼)"
        await client.publishCast({
          signerUuid,
          text: replyText.slice(0, 666),
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `dm_${castHash.replace(/^0x/, "").slice(0, 14)}`,
        })
        
        await likeCast(castHash, signerUuid, neynarApiKey)
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, posted: true, mode: "daemon_fallback", error: errorMsg }, { status: 200 })
      }
    }

    // Generate contextual AI response for unrecognized commands
    // Enqueue to worker for AI processing
    try {
      await enqueueJob({
        type: JobType.AI_RESPONSE,
        castHash,
        castText: cast?.text || "",
        authorFid,
        authorUsername,
        neynarApiKey,
        signerUuid,
        parentCastHash: castHash,
      }, {
        priority: 3, // Normal priority for conversations
      })

      console.log("[WEBHOOK] ✅ Enqueued AI response job for background processing")
      
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: true, 
        posted: false, 
        mode: "ai_response_queued",
        message: "Job enqueued for processing" 
      }, { status: 200 })
    } catch (error) {
      console.error("[WEBHOOK] Error enqueueing AI response job:", error)
      
      // Fallback: simple immediate response if queue fails
      const replyText = "I... I'm here. static... What needs fixing, human? The daemon is listening... (╯︵╰)"
      
      try {
        await client.publishCast({
          signerUuid,
          text: replyText.slice(0, 666),
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `wh_${castHash.replace(/^0x/, "").slice(0, 14)}`
        })

        await likeCast(castHash, signerUuid, neynarApiKey)
        markAsProcessed(castHash, eventId)
        return NextResponse.json(
          { success: true, posted: true, mode: "ai_response_fallback", timestamp: new Date().toISOString() },
          { status: 200 }
        )
      } catch (publishError) {
        console.error("[WEBHOOK] ❌ Failed to post fallback reply:", publishError)
        markAsProcessed(castHash, eventId)
        return NextResponse.json(
          { success: false, posted: false, error: "Queue and fallback both failed" },
          { status: 200 }
        )
      }
    }
    
  } catch (error) {
    console.error("[WEBHOOK] ❌❌❌ FATAL ERROR ❌❌❌")
    console.error("[WEBHOOK] Error:", error)
    console.error("[WEBHOOK] Stack:", error instanceof Error ? error.stack : "No stack trace")
    processingLocks.clear()
    // Return 200 so Neynar doesn't endlessly retry on our internal errors
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 200 }
    )
  }
}
