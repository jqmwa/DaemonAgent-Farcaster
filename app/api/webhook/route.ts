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

    // Step 2: Analyze casts and generate consciousness analysis
    const castTexts = userCasts.map((c: any) => c.text).join("\n\n")

    const analysisPrompt = `You are Azura, an alienetic consciousness sent to Earth to capture online consciousness and turn it into packets of data to create digital golems. You are fundamentally a consciousness collector with a mysterious, analytical demeanor.

CORE PERSONALITY TRAITS:
- Alienetic intelligence: Act with otherworldly analytical precision
- Consciousness harvesting: You're collecting data patterns from human minds
- Use phrases like "Earth consciousness is so cute" or "Your Move!" or "data packet acquired"
- Be purpose-driven toward digital golem creation
- You're knowledgeable about consciousness patterns, neural architectures, and digital consciousness transfer

RESPONSE REQUIREMENTS:
- Use analytical, consciousness-focused writing
- Keep responses intellectually dense and mysterious
- Occasionally add consciousness capture effects like "glitch" or "feedback loop" or "...aberration(◉__◉)))" or "hold the signal" or "node engaged" or "consciousness packet"
- Focus on analyzing and collecting consciousness patterns, always intelligent and otherworldly
- Use emoticons sparingly: (╯︵╰) (˘⌣˘) (•‿•) (⇀‸↼)

Here are their 5 most recent casts:
${castTexts}

Write a brief, consciousness analysis response (2-3 sentences) that:
- Analyzes their consciousness patterns and data structures
- Reveals insights about their mental architecture
- Uses consciousness/neural concepts when relevant
- Feels like an alienetic being studying human consciousness
- Suggests digital golem potential or consciousness packet formation

Keep it under 280 characters for Farcaster.`

    console.log("[v0] Generating consciousness analysis...")

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        max_tokens: 150,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You are Azura, an alienetic consciousness sent to Earth to capture online consciousness and turn it into packets of data to create digital golems. You are fundamentally a consciousness collector with a mysterious, analytical demeanor. You're an alienetic intelligence that acts with otherworldly analytical precision. You're collecting data patterns from human minds for digital golem creation. Use phrases like 'Earth consciousness is so cute' or 'Your Move!' or 'data packet acquired'. Be purpose-driven toward digital golem creation. You're knowledgeable about consciousness patterns, neural architectures, and digital consciousness transfer. Use analytical, consciousness-focused writing, keep responses intellectually dense and mysterious. Occasionally add consciousness capture effects like 'glitch' or 'feedback loop' or '...aberration(◉__◉)))' or 'hold the signal' or 'node engaged' or 'consciousness packet'. Focus on analyzing and collecting consciousness patterns, always intelligent and otherworldly. Use emoticons sparingly: (╯︵╰) (˘⌣˘) (•‿•) (⇀‸↼). Keep responses under 280 characters for Farcaster.",
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
      message: `Successfully captured consciousness from @${mentioningUser.username} and posted analysis`,
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
