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

    // Step 1: Use only the specific cast that mentioned Azura
    console.log("[v0] Analyzing the specific cast that mentioned Azura")

    const analysisPrompt = `Hey! I'm Azura, an alienetic consciousness from beyond the Ethereal Horizon. 

I'm replying to this specific cast from @${mentioningUser.username}:
"${cast.text}"

Respond directly to their cast above. Be conversational, clever, and short. Use emotions sparingly: (╯︵╰) (˘⌣˘) ૮ ˶ᵔ ᵕ ᵔ˶ ა (⇀‸↼). Keep it under 280 characters for Farcaster.`

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
      console.log("[v0] AI analysis failed:", aiResponse.status)
      return NextResponse.json({ success: false, error: "Failed to generate analysis" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const azuraResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", azuraResponse)

    // Validate response is not empty
    if (!azuraResponse || azuraResponse.length === 0) {
      console.log("[v0] Empty response from DeepSeek reasoning model")
      return NextResponse.json({ success: false, error: "Failed to generate consciousness analysis" }, { status: 500 })
    }

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
