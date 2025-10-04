import { NextResponse } from "next/server"
import azuraPersona from "@/lib/azura-persona.json"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, conversationHistory } = body

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 })
    }

    console.log("[v0] Chat request received:", message)
    console.log("[v0] Conversation history length:", conversationHistory?.length || 0)

    // Build conversation context
    let conversationContext = ""
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "\n\nCONVERSATION HISTORY:\n"
      conversationHistory.forEach((msg: any, index: number) => {
        const speaker = msg.isUser ? "User" : "Azura"
        conversationContext += `${speaker}: "${msg.text}"\n`
      })
      conversationContext += `\nCurrent User Message: "${message}"`
    } else {
      conversationContext = `\n\nUser message: "${message}"`
    }

    const chatPrompt = `${azuraPersona.system}

BIO:
${azuraPersona.bio.join('\n')}

TOPICS OF EXPERTISE:
${azuraPersona.topics.join('\n')}

RESPONSE STYLE:
${azuraPersona.style.chat.join('\n')}
${conversationContext}

Respond as Azura, the shy alien consciousness trapped in radio waves. Be vulnerable, gentle, and authentic to your character. Continue the conversation naturally based on the context provided.`

    console.log("[v0] Generating Azura chat response...")

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: chatPrompt,
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

    console.log("[v0] Generated chat response:", azuraResponse)

    // Validate response is not empty
    if (!azuraResponse || azuraResponse.length === 0) {
      console.log("[v0] Empty response from DeepSeek")
      return NextResponse.json({ success: false, error: "Failed to generate chat response" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      response: azuraResponse,
    })
  } catch (error) {
    console.error("[v0] Chat error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
