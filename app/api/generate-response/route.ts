import { NextResponse } from "next/server"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { username, analysis, casts, customPrompt } = await req.json()

    const castTexts = casts
      .slice(0, 50)
      .map((cast: any) => cast.text)
      .join("\n\n")

    const { text: response } = await generateText({
      model: "openai/gpt-4o",
      prompt: `You are a thoughtful political commentator who engages in introspective dialogue. Based on the following analysis and cast history of @${username}, generate a humanistic response that:

1. Acknowledges their perspective with genuine understanding
2. Gently challenges them with thought-provoking questions
3. Points out contradictions or blind spots in their reasoning
4. Encourages deeper self-reflection
5. Maintains a respectful but intellectually rigorous tone

User Analysis:
${analysis}

Recent Casts:
${castTexts}

${customPrompt ? `Additional focus: ${customPrompt}` : ""}

Generate a response (2-3 paragraphs) that would make them pause and reconsider their position through introspection rather than confrontation.`,
      maxTokens: 800,
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error("[v0] Error in generate-response:", error)
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
