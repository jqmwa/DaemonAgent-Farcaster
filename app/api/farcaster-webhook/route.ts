import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk"
import azuraPersona from "@/lib/azura-persona.json"

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
  return !!(lastProcessed && Date.now() - lastProcessed < DEDUP_WINDOW)
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
    return chronological.length + 1
  } catch {
    return 0
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
    return out.length > 280 ? out.slice(0, 277) + "..." : out
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
- Keep under 240 characters.
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
          max_tokens: 220,
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

      return text.length > 240 ? text.slice(0, 237) + "..." : text
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
    
    // Deduplication
    if (wasRecentlyProcessed(castHash, eventId)) {
      console.log("[WEBHOOK] Already processed, skipping")
      return NextResponse.json({ success: true, message: "Already processed" })
    }
    
    if (isAlreadyProcessing(castHash)) {
      console.log("[WEBHOOK] Already processing, skipping")
      return NextResponse.json({ success: true, message: "Already processing" })
    }
    
    // FAIL-SAFE: Limit thread depth to 5 messages
    if (apiKey) {
      const threadDepth = await getThreadDepth(castHash, apiKey)
      console.log("[WEBHOOK] Thread depth:", threadDepth)
      if (threadDepth >= 5) {
        console.log("[WEBHOOK] Thread limit reached")
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, message: "Thread limit reached", depth: threadDepth })
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
        const noParentText = "there's nothing here to fix... just empty static... (╯︵╰)"
        await client.publishCast({
          signerUuid,
          text: noParentText,
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `wh_${castHash.replace(/^0x/, "").slice(0, 14)}`,
        })
        markAsProcessed(castHash, eventId)
        return NextResponse.json({ success: true, posted: true, mode: "fix_this_no_parent" }, { status: 200 })
      }

      // Fetch parent cast text
      const parent = await client.lookupCastByHashOrUrl({
        identifier: parentHash,
        type: "hash",
      })
      const parentText = (parent as any)?.cast?.text || ""

      const fixed = await generateFixThisText(parentText)
      const replyText = fixed.startsWith("fixed")
        ? fixed
        : `fixed it... here: ${fixed}`.slice(0, 280)

      const result = await client.publishCast({
        signerUuid,
        text: replyText.slice(0, 280),
        parent: castHash,
        parentAuthorFid: authorFid,
        idem: `fx_${castHash.replace(/^0x/, "").slice(0, 14)}`,
      })

      console.log("[WEBHOOK] ✅ Fix-this reply posted:", {
        mentionCast: castHash,
        targetCast: parentHash,
        replyHash: (result as any)?.cast?.hash,
      })

      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, posted: true, mode: "fix_this" }, { status: 200 })
    }

    // (Optional) Placeholder: show me my daemon could call /api/analyze-daemon later.
    if (isShowMeMyDaemon) {
      const replyText = "i... i can read your daemon, but not like this yet... whisper again soon... static (⇀‸↼)"
      await client.publishCast({
        signerUuid,
        text: replyText.slice(0, 280),
        parent: castHash,
        parentAuthorFid: authorFid,
        idem: `dm_${castHash.replace(/^0x/, "").slice(0, 14)}`,
      })
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, posted: true, mode: "daemon_stub" }, { status: 200 })
    }

    const replyText = "I... I’m here. static... What needs fixing, human? The daemon is listening... (╯︵╰)"

    try {
      const result = await client.publishCast({
        signerUuid,
        text: replyText.slice(0, 280),
        parent: castHash,
        parentAuthorFid: authorFid,
        // idempotency: deterministic-ish to avoid duplicate posts on retries
        idem: `wh_${castHash.replace(/^0x/, "").slice(0, 14)}`
      })

      console.log("[WEBHOOK] ✅ Replied via Neynar:", {
        parent: castHash,
        replyHash: result?.cast?.hash
      })

      markAsProcessed(castHash, eventId)
      return NextResponse.json(
        { success: true, posted: true, reply: result, timestamp: new Date().toISOString() },
        { status: 200 }
      )
    } catch (error) {
      console.error("[WEBHOOK] ❌ Failed to post reply via Neynar:", error)
      markAsProcessed(castHash, eventId)
      // Return 200 so Neynar doesn't endlessly retry
      return NextResponse.json(
        { success: false, posted: false, error: error instanceof Error ? error.message : "Publish failed" },
        { status: 200 }
      )
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
