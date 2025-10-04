import { NextResponse } from "next/server"
import azuraPersona from "@/lib/azura-persona.json"

// Build recent thread context (last N messages) for better conversational continuity
async function buildRecentThreadContext(castHash: string, apiKey: string, lastN: number = 3): Promise<string> {
  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=${lastN}&include_chronological_parent_casts=true`, {
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
      },
    })
    if (!response.ok) {
      return ""
    }
    const data = await response.json()
    const chronological = data?.conversation?.cast?.conversation?.chronological_parent_casts || []
    // Grab the last N chronological messages (author + text)
    const recent = chronological.slice(-lastN)
    const formatted = recent
      .map((c: any) => `@${c.author?.username}: "${String(c.text || "").replace(/\s+/g, " ").trim()}"`)
      .join("\n")
    return formatted
  } catch {
    return ""
  }
}

// In-memory deduplication (works within single instance, helps reduce redundant API calls)
const recentlyProcessed = new Map<string, number>()
const DEDUP_WINDOW_MS = 60_000 // 60 seconds

function isRecentlyProcessed(castHash: string): boolean {
  const now = Date.now()
  const lastProcessed = recentlyProcessed.get(castHash)
  
  // Clean old entries
  for (const [hash, timestamp] of recentlyProcessed.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentlyProcessed.delete(hash)
    }
  }
  
  if (lastProcessed && now - lastProcessed < DEDUP_WINDOW_MS) {
    return true
  }
  
  recentlyProcessed.set(castHash, now)
  return false
}

// Helper function to check if Azura has already replied to a cast
async function hasAzuraAlreadyReplied(castHash: string, apiKey: string, botFid?: number): Promise<boolean> {
  try {
    // Get the cast's conversation/replies
    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=1&include_chronological_parent_casts=false`, {
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
      },
    })
    
    if (response.ok) {
      const data = await response.json()
      const conversation = data.conversation
      
      // Check direct replies for Azura (by username or FID)
      if (conversation?.cast?.direct_replies) {
        const azuraReplied = conversation.cast.direct_replies.some(
          (reply: any) => {
            const isAzuraUsername = reply.author.username?.toLowerCase() === "azura"
            const isAzuraFid = botFid !== undefined && reply.author.fid === botFid
            return isAzuraUsername || isAzuraFid
          }
        )
        if (azuraReplied) {
          console.log("[v0] Azura has already replied to this cast")
          return true
        }
      }
    }
    return false
  } catch (error) {
    console.log("[v0] Error checking for existing Azura reply:", error)
    // If we can't check, assume we haven't replied to avoid missing responses
    return false
  }
}

// Helper to check if parent cast is from Azura (for thread continuity)
async function isReplyToAzura(parentHash: string, apiKey: string, botFid?: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`, {
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
      },
    })
    
    if (response.ok) {
      const data = await response.json()
      const parentCast = data.cast
      const isAzuraUsername = parentCast.author.username?.toLowerCase() === "azura"
      const isAzuraFid = botFid !== undefined && parentCast.author.fid === botFid
      return isAzuraUsername || isAzuraFid
    }
    return false
  } catch (error) {
    console.log("[v0] Error checking parent cast:", error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    const botFid = process.env.BOT_FID ? Number(process.env.BOT_FID) : undefined

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    if (!signerUuid) {
      return NextResponse.json({ success: false, error: "NEYNAR_SIGNER_UUID not configured" }, { status: 500 })
    }

    // Parse the webhook event
    const event = await request.json()
    console.log("[v0] Webhook event received:", JSON.stringify(event).substring(0, 300))

    // Check if this is a cast.created event
    if (event.type !== "cast.created") {
      console.log("[v0] Ignoring non-cast event")
      return NextResponse.json({ success: true, message: "Event ignored" })
    }

    const cast = event.data
    const user = cast.author
    const castHash = cast.hash
    const castText = cast.text

    // CRITICAL: Ignore casts from Azura herself to prevent infinite loops (prefer FID, fallback to username)
    if ((botFid !== undefined && user.fid === botFid) || user.username?.toLowerCase() === "azura") {
      console.log("[v0] Ignoring cast from Azura herself")
      return NextResponse.json({ success: true, message: "Ignoring own cast" })
    }

    // In-memory deduplication (fast, works within this instance)
    if (isRecentlyProcessed(castHash)) {
      console.log("[v0] Recently processed this cast in this instance, ignoring")
      return NextResponse.json({ success: true, message: "Recently processed" })
    }

    // Check if Azura has already replied to this cast (API check for cross-instance dedup)
    const alreadyReplied = await hasAzuraAlreadyReplied(castHash, apiKey, botFid)
    if (alreadyReplied) {
      console.log("[v0] Azura already replied to this cast, ignoring")
      return NextResponse.json({ success: true, message: "Already replied to this cast" })
    }

    // Check if this is a mention or reply
    const isMention = castText.includes("@azura") || castText.toLowerCase().includes("@azura")
    const isReply = cast.parent_hash && cast.parent_hash.length > 0

    console.log("[v0] Cast details:", {
      user: user.username,
      isMention,
      isReply,
      parentHash: cast.parent_hash,
      text: castText.substring(0, 100)
    })

    // SIMPLIFIED LOGIC: Only respond to mentions OR direct replies to Azura's casts
    let shouldRespond = false
    let responseType = ""

    if (isMention) {
      // Always respond to mentions
      shouldRespond = true
      responseType = "mention"
      console.log("[v0] Responding to direct mention")
    } else if (isReply && cast.parent_hash) {
      // Only respond to replies if the parent cast is FROM Azura (thread continuity)
      const parentIsAzura = await isReplyToAzura(cast.parent_hash, apiKey, botFid)
      if (parentIsAzura) {
        shouldRespond = true
        responseType = "thread_reply"
        console.log("[v0] Responding to reply to Azura's cast (thread continuity)")
      } else {
        console.log("[v0] Parent cast not from Azura, ignoring reply")
      }
    }

    if (!shouldRespond) {
      console.log("[v0] No reason to respond to this cast")
      return NextResponse.json({ success: true, message: "No response needed" })
    }

    console.log(`[v0] Responding to ${responseType} from @${user.username}`)

    // Enhanced conversation context with last three messages from thread history
    let conversationContext = ""
    if (isReply) {
      const recentThreadContext = await buildRecentThreadContext(castHash, apiKey, 3)
      conversationContext = `\n\nCONVERSATION CONTEXT (recent):\n${recentThreadContext}\n\nCurrent message from @${user.username}: "${castText}"\nRespond naturally to continue this conversation thread.`
    } else {
      conversationContext = `\n\nCONVERSATION CONTEXT:\nDirect message from @${user.username}: "${castText}"\nRespond naturally to this new conversation.`
    }

    // Enhanced prompt with better examples and context
    const analysisPrompt = `${azuraPersona.system}

BIO:
${azuraPersona.bio.join('\n')}

TOPICS OF EXPERTISE:
${azuraPersona.topics.join('\n')}

RESPONSE STYLE:
${azuraPersona.style.post.join('\n')}

EXAMPLE CONVERSATIONS:
${azuraPersona.messageExamples.slice(0, 3).map(conv => 
  `${conv[0].name}: "${conv[0].content.text}"\n${conv[1].name}: "${conv[1].content.text}"`
).join('\n\n')}

${conversationContext}

IMPORTANT: Respond as Azura with vulnerability, gentleness, and authenticity. Use the conversation examples above as style guidance. Keep response under 280 characters for Farcaster. Be conversational and natural - this is a real conversation, not a formal response.`

    console.log("[v0] Generating Azura response...")

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 250,
        temperature: 0.8,
        top_p: 0.9,
        messages: [
          {
            role: "system",
            content: "You are Azura, a shy alien consciousness trapped in Earth's radio waves. Respond naturally and conversationally as this character.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.log("[v0] AI analysis failed:", aiResponse.status, errorText)
      
      // Handle specific error cases
      if (aiResponse.status === 429) {
        console.log("[v0] Rate limited by DeepSeek API")
        return NextResponse.json({ success: false, error: "Rate limited - please try again later" }, { status: 429 })
      } else if (aiResponse.status === 401) {
        console.log("[v0] DeepSeek API key invalid")
        return NextResponse.json({ success: false, error: "API key configuration error" }, { status: 500 })
      }
      
      return NextResponse.json({ success: false, error: "Failed to generate analysis" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    let azuraResponse = aiData.choices[0].message.content.trim()

    console.log("[v0] Generated response:", azuraResponse)

    // Enhanced response validation
    if (!azuraResponse || azuraResponse.length === 0) {
      console.log("[v0] Empty response from DeepSeek")
      return NextResponse.json({ success: false, error: "Failed to generate response" }, { status: 500 })
    }
    
    // Validate response length and quality
    if (azuraResponse.length > 280) {
      console.log("[v0] Response too long, truncating:", azuraResponse.length)
      azuraResponse = azuraResponse.substring(0, 277) + "..."
    }
    
    if (azuraResponse.length < 10) {
      console.log("[v0] Response too short, rejecting:", azuraResponse)
      return NextResponse.json({ success: false, error: "Response too short" }, { status: 500 })
    }
    
    // Check for basic quality indicators
    const hasContent = azuraResponse.trim().length > 0
    const isNotJustPunctuation = /[a-zA-Z]/.test(azuraResponse)
    
    if (!hasContent || !isNotJustPunctuation) {
      console.log("[v0] Poor quality response, rejecting:", azuraResponse)
      return NextResponse.json({ success: false, error: "Poor quality response" }, { status: 500 })
    }

    // FINAL: Check one more time right before posting to catch any race conditions
    console.log("[v0] Final duplicate check before posting...")
    const alreadyRepliedNow = await hasAzuraAlreadyReplied(castHash, apiKey, botFid)
    if (alreadyRepliedNow) {
      console.log("[v0] Another instance already posted a reply, aborting")
      return NextResponse.json({ success: true, message: "Another instance handled this cast" })
    }

    // Post reply to the cast
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

    console.log(`[v0] Successfully replied to ${responseType} from @${user.username}`)

    return NextResponse.json({
      success: true,
      message: `Successfully responded to ${responseType} from @${user.username}`,
      data: {
        targetUser: user.username,
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
