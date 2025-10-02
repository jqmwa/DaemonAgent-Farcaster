import { NextResponse } from "next/server"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { username } = await req.json()

    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json({ error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    // Fetch user data by username
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`, {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    })

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user data")
    }

    const userData = await userResponse.json()
    const fid = userData.result?.user?.fid

    if (!fid) {
      throw new Error("User not found")
    }

    const castsResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&with_recasts=false&limit=50`,
      {
        headers: {
          accept: "application/json",
          api_key: process.env.NEYNAR_API_KEY,
        },
      },
    )

    if (!castsResponse.ok) {
      throw new Error("Failed to fetch user casts")
    }

    const castsData = await castsResponse.json()
    const casts = castsData.casts || []

    // Generate psychological analysis using AI
    const castTexts = casts.map((cast: any) => cast.text).join("\n\n")

    const { text: analysis } = await generateText({
      model: "openai/gpt-4o",
      prompt: `Analyze the following ${casts.length} casts from a Farcaster user and provide a deep psychological profile. Focus on:
- Their core beliefs and values
- Rhetorical patterns and argumentation style
- Emotional triggers and biases
- Contradictions or inconsistencies in their positions
- Underlying motivations and fears

Casts:
${castTexts}

Provide a concise but insightful analysis (3-4 paragraphs) that reveals patterns in their thinking.`,
      maxTokens: 1000,
    })

    return NextResponse.json({
      casts,
      analysis,
      fid,
    })
  } catch (error) {
    console.error("[v0] Error in analyze-user:", error)
    return NextResponse.json({ error: "Failed to analyze user" }, { status: 500 })
  }
}
