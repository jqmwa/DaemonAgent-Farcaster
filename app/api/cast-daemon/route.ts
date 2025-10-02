import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    if (!signerUuid) {
      return NextResponse.json({ success: false, error: "NEYNAR_SIGNER_UUID not configured" }, { status: 500 })
    }

    const body = await request.json()
    const { fid, castHash } = body

    if (!fid) {
      return NextResponse.json({ success: false, error: "FID is required" }, { status: 400 })
    }

    console.log("[v0] Step 1: Fetching user's recent casts for FID:", fid)

    const userCastsResponse = await fetch(`https://api.neynar.com/v2/farcaster/feed/user/${fid}/casts?limit=5`, {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
      },
    })

    if (!userCastsResponse.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch user casts" },
        { status: userCastsResponse.status },
      )
    }

    const userCastsData = await userCastsResponse.json()
    const userCasts = userCastsData.casts || []

    if (userCasts.length === 0) {
      return NextResponse.json({ success: false, error: "No casts found for this user" }, { status: 404 })
    }

    const targetUser = userCasts[0].author
    const targetCastHash = castHash || userCasts[0].hash

    console.log("[v0] Step 2: Analyzing", userCasts.length, "casts for @", targetUser.username)

    const castTexts = userCasts.map((cast: any) => cast.text).join("\n\n")

    const analysisPrompt = `You are a dark Jungian psychologist analyzing someone's shadow self based on their recent political posts on Farcaster.

Here are their 5 most recent casts:
${castTexts}

Write a brief, introspective response (2-3 sentences) that:
- Reveals unconscious patterns in their thinking
- Points to their shadow self and psychological projections
- Uses Jungian concepts like archetypes, persona, and the collective unconscious
- Is direct, penetrating, but not cruel
- Feels like a mirror being held up to their psyche

Keep it under 280 characters for Farcaster.`

    console.log("[v0] Step 3: Generating Jungian analysis...")

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a Jungian psychologist providing introspective analysis.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    })

    if (!aiResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to generate analysis" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const jungianResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", jungianResponse)

    console.log("[v0] Step 4: Posting reply to cast...")

    const postResponse = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: jungianResponse,
        parent: targetCastHash,
      }),
    })

    if (!postResponse.ok) {
      const errorText = await postResponse.text()
      console.log("[v0] Post error:", errorText)
      return NextResponse.json({ success: false, error: "Failed to post reply" }, { status: postResponse.status })
    }

    const postData = await postResponse.json()

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed @${targetUser.username} and posted Jungian response`,
      data: {
        targetUser: targetUser.username,
        response: jungianResponse,
        castHash: postData.cast?.hash,
      },
    })
  } catch (error) {
    console.error("[v0] Cast Daemon error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
