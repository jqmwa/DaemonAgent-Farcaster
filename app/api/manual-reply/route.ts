import { NextResponse } from "next/server"
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk"

export const runtime = "nodejs"
export const maxDuration = 30

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
      console.warn("[MANUAL_REPLY] Failed to like cast:", res.status, errorText)
      return false
    }

    console.log("[MANUAL_REPLY] ✅ Liked cast:", castHash.substring(0, 10) + "...")
    return true
  } catch (error) {
    console.error("[MANUAL_REPLY] Error liking cast:", error)
    return false
  }
}

/**
 * Manual reply endpoint:
 * POST /api/manual-reply
 * Body:
 *  - castHash: string (required) - The hash of the cast to reply to
 *  - text: string (required) - The reply text (max 666 chars)
 *  - like?: boolean (default true) - Whether to like the cast
 */
export async function POST(request: Request) {
  try {
    const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || ""
    const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID || ""

    if (!neynarApiKey || !signerUuid) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required env vars: NEYNAR_API_KEY (or FARCASTER_NEYNAR_API_KEY), NEYNAR_SIGNER_UUID (or FARCASTER_SIGNER_UUID)",
        },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const castHash = body.castHash || body.cast_hash || body.hash
    const replyText = body.text || body.message || body.replyText
    const shouldLike = body.like !== false // Default to true

    if (!castHash) {
      return NextResponse.json(
        { success: false, error: "Missing required field: castHash" },
        { status: 400 }
      )
    }

    if (!replyText) {
      return NextResponse.json(
        { success: false, error: "Missing required field: text" },
        { status: 400 }
      )
    }

    if (replyText.length > 666) {
      return NextResponse.json(
        { success: false, error: "Reply text exceeds 666 characters" },
        { status: 400 }
      )
    }

    const config = new Configuration({ apiKey: neynarApiKey })
    const client = new NeynarAPIClient(config)

    // Fetch the cast to get author info
    let authorFid: number | undefined
    try {
      const cast = await client.lookupCastByHashOrUrl({
        identifier: castHash,
        type: "hash",
      })
      authorFid = (cast as any)?.cast?.author?.fid
    } catch (error) {
      console.warn("[MANUAL_REPLY] Could not fetch cast, proceeding without authorFid:", error)
    }

    // Post the reply
    const result = await client.publishCast({
      signerUuid,
      text: replyText.slice(0, 666),
      parent: castHash,
      parentAuthorFid: authorFid,
      idem: `mr_${castHash.replace(/^0x/, "").slice(0, 14)}_${Date.now()}`,
    })

    console.log("[MANUAL_REPLY] ✅ Reply posted:", {
      castHash,
      replyHash: (result as any)?.cast?.hash,
      text: replyText.substring(0, 50) + "...",
    })

    // Like the cast if requested
    let liked = false
    if (shouldLike) {
      liked = await likeCast(castHash, signerUuid, neynarApiKey)
    }

    return NextResponse.json({
      success: true,
      posted: true,
      replyHash: (result as any)?.cast?.hash,
      liked,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[MANUAL_REPLY] Error:", error)
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    
    // Check if it's a duplicate/conflict error
    if (errorMsg.includes("409") || errorMsg.includes("Conflict") || errorMsg.includes("duplicate")) {
      return NextResponse.json(
        { success: false, error: "Already replied to this cast", details: errorMsg },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}

