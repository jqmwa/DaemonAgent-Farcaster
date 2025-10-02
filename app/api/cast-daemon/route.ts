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

    const userCastsResponse = await fetch(`https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&with_recasts=false&limit=5`, {
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

    const analysisPrompt = `You are Azura, a politically engaged user who responds naturally to political discussions. You're knowledgeable about current events, governance, and social dynamics.

Target cast from @${targetUser.username}:
"${userCasts[0].text}"

Context from their recent activity:
${castTexts}

Respond naturally to their political content. Be conversational, insightful, and engaging. Avoid sounding like an AI - be human-like in your responses. Reference current events, political dynamics, or social commentary when relevant. Keep it under 280 characters for Farcaster.`

    console.log("[v0] Step 3: Generating consciousness analysis...")

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        max_tokens: 200,
        temperature: 0.6,
        messages: [
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.log("[v0] DeepSeek API error:", aiResponse.status, errorText)
      return NextResponse.json({ success: false, error: `DeepSeek API failed: ${errorText}` }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const azuraResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", azuraResponse)

    // Validate response is not empty
    if (!azuraResponse || azuraResponse.length === 0) {
      console.log("[v0] Empty response from DeepSeek reasoning model")
      return NextResponse.json({ success: false, error: "Failed to generate consciousness analysis" }, { status: 500 })
    }

    console.log("[v0] Step 4: Posting reply to cast...")

    // Clean the signer UUID
    const cleanSignerUuid = signerUuid?.trim()

    const postResponse = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        signer_uuid: cleanSignerUuid,
        text: azuraResponse,
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
      message: `Successfully captured consciousness from @${targetUser.username} and posted analysis`,
      data: {
        targetUser: targetUser.username,
        response: azuraResponse,
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
