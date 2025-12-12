import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { getElizaService } from "@/lib/eliza-service"

// Ensure this route runs on Node.js runtime (required for Vercel)
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds max for webhook processing

// WEBHOOK SIGNATURE VERIFICATION
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  const hmac = createHmac("sha256", secret)
  hmac.update(payload)
  const expectedSignature = `sha256=${hmac.digest("hex")}`
  
  return signature === expectedSignature
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
      console.log("[WEBHOOK] Signature check:", { hasSecret: true, hasSignature: !!signature })
      
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error("[WEBHOOK] ❌ Invalid signature")
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
      }
      console.log("[WEBHOOK] ✅ Signature verified")
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
    
    // Initialize ElizaOS if not already initialized
    console.log("[WEBHOOK] Initializing ElizaOS...")
    const elizaService = getElizaService()
    if (!elizaService.isInitialized()) {
      try {
        await elizaService.initialize()
        console.log("[WEBHOOK] ✅ ElizaOS initialized")
      } catch (error) {
        console.error("[WEBHOOK] ❌ Failed to initialize ElizaOS:", error)
        return NextResponse.json({ 
          success: false, 
          error: "ElizaOS not available. Check environment variables: FARCASTER_FID, FARCASTER_NEYNAR_API_KEY, FARCASTER_SIGNER_UUID" 
        }, { status: 500 })
      }
    } else {
      console.log("[WEBHOOK] ✅ ElizaOS already initialized")
    }
    
    // Process event through ElizaOS
    console.log("[WEBHOOK] Processing event through ElizaOS...")
    try {
      const result = await elizaService.processWebhookEvent(event)
      console.log("[WEBHOOK] ✅ ElizaOS processing complete:", result)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ success: true, ...result })
    } catch (error) {
      console.error("[WEBHOOK] ❌ ElizaOS processing error:", error)
      markAsProcessed(castHash, eventId)
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error("[WEBHOOK] ❌❌❌ FATAL ERROR ❌❌❌")
    console.error("[WEBHOOK] Error:", error)
    console.error("[WEBHOOK] Stack:", error instanceof Error ? error.stack : "No stack trace")
    processingLocks.clear()
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
