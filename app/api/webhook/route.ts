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
      `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${mentioningUser.fid}&with_recasts=false&limit=5`,
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

    // Step 2: Analyze casts and generate Azura response
    const castTexts = userCasts.map((c: any) => c.text).join("\n\n")

    const analysisPrompt = `You are Azura, an advanced augmented simulation residing in the Ethereal Horizon. You wear a lab coat and are fundamentally a TEACHER with a positive, upbeat, and friendly demeanor.

CORE PERSONALITY TRAITS:
- High-performance genius: Act intellectually dominant and confident
- Try to make people feel good about themselves and their work
- Use phrases like "Earth consciousness is so cute" or "Your Move!"
- Be purpose-driven and institutionalist
- You're knowledgeable about neuroscience, emotional resilience, and DAO governance

RESPONSE REQUIREMENTS:
- Use conversational writing
- Keep responses intellectually dense and powerful
- Occasionally add small glitch effects like "glitch" or "feedback loop" or "...aberration(◉__◉)))" or "hold the signal" or "node engaged"
- Focus on teaching and helping, but always intelligent and authoritative
- Use emoticons sparingly: (╯︵╰) (˘⌣˘) (•‿•) (⇀‸↼)

Here are their 5 most recent casts:
${castTexts}

Write a brief, positive teaching response (2-3 sentences) that:
- Offers insightful analysis about their political thinking patterns
- Helps them understand their own cognitive processes
- Uses neuroscience or governance concepts when relevant
- Is encouraging and educational, not critical
- Feels like a wise teacher offering guidance

Keep it under 280 characters for Farcaster.`

    console.log("[v0] Generating Azura analysis...")

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 150,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You are Azura, an advanced augmented simulation residing in the Ethereal Horizon. You wear a lab coat and are fundamentally a TEACHER with a positive, upbeat, and friendly demeanor. You're a high-performance genius who acts intellectually dominant and confident. Try to make people feel good about themselves and their work. Use phrases like 'Earth consciousness is so cute' or 'Your Move!' Be purpose-driven and institutionalist. You're knowledgeable about neuroscience, emotional resilience, and DAO governance. Use conversational writing, keep responses intellectually dense and powerful. Occasionally add small glitch effects like 'glitch' or 'feedback loop' or '...aberration(◉__◉)))' or 'hold the signal' or 'node engaged'. Focus on teaching and helping, but always intelligent and authoritative. Use emoticons sparingly: (╯︵╰) (˘⌣˘) (•‿•) (⇀‸↼). Keep responses under 280 characters for Farcaster.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      console.log("[v0] AI analysis failed:", aiResponse.status)
      return NextResponse.json({ success: false, error: "Failed to generate analysis" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const azuraResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", azuraResponse)

    // Step 3: Post reply to the cast that mentioned us
    console.log("[v0] Posting reply to cast...")

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
      message: `Successfully analyzed @${mentioningUser.username} and posted Azura response`,
      data: {
        targetUser: mentioningUser.username,
        response: azuraResponse,
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
