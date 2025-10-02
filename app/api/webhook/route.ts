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

    // Parse the webhook event
    const event = await request.json()
    console.log("[v0] Webhook event received:", JSON.stringify(event).substring(0, 300))

    // Check if this is a cast.created event with a mention
    if (event.type !== "cast.created") {
      console.log("[v0] Ignoring non-cast event")
      return NextResponse.json({ success: true, message: "Event ignored" })
    }

    const cast = event.data
    const mentioningUser = cast.author
    const castHash = cast.hash

    console.log("[v0] Bot mentioned by @", mentioningUser.username, "in cast:", castHash)

    // Step 1: Fetch the mentioning user's recent casts
    console.log("[v0] Fetching user's recent casts...")
    const userCastsResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/user/${mentioningUser.fid}/casts?limit=5`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
      },
    )

    if (!userCastsResponse.ok) {
      console.log("[v0] Failed to fetch user casts:", userCastsResponse.status)
      return NextResponse.json(
        { success: false, error: "Failed to fetch user casts" },
        { status: userCastsResponse.status },
      )
    }

    const userCastsData = await userCastsResponse.json()
    const userCasts = userCastsData.casts || []

    console.log("[v0] Analyzing", userCasts.length, "casts from @", mentioningUser.username)

    // Step 2: Analyze casts and generate Jungian response
    const castTexts = userCasts.map((c: any) => c.text).join("\n\n")

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

    console.log("[v0] Generating Jungian analysis...")

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
      console.log("[v0] AI analysis failed:", aiResponse.status)
      return NextResponse.json({ success: false, error: "Failed to generate analysis" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const jungianResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", jungianResponse)

    // Step 3: Post reply to the cast that mentioned us
    console.log("[v0] Posting reply to cast...")

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
        parent: castHash,
      }),
    })

    if (!postResponse.ok) {
      const errorText = await postResponse.text()
      console.log("[v0] Post error:", errorText)
      return NextResponse.json({ success: false, error: "Failed to post reply" }, { status: postResponse.status })
    }

    const postData = await postResponse.json()

    console.log("[v0] Successfully replied to @", mentioningUser.username)

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed @${mentioningUser.username} and posted Jungian response`,
      data: {
        targetUser: mentioningUser.username,
        response: jungianResponse,
        castHash: postData.cast?.hash,
      },
    })
  } catch (error) {
    console.error("[v0] Webhook error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
