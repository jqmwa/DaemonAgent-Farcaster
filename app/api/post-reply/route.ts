import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { text, parentHash } = await req.json()

    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json({ error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    if (!process.env.NEYNAR_SIGNER_UUID) {
      return NextResponse.json({ error: "NEYNAR_SIGNER_UUID not configured" }, { status: 500 })
    }

    // Post a reply to a cast using Neynar API
    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: process.env.NEYNAR_SIGNER_UUID,
        text,
        parent: parentHash,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Neynar API error:", errorData)
      throw new Error(`Failed to post reply: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      cast: data.cast,
    })
  } catch (error) {
    console.error("[v0] Error in post-reply:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post reply" },
      { status: 500 },
    )
  }
}
