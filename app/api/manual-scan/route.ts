import { NextResponse } from "next/server"
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk"
import azuraPersona from "@/lib/azura-persona.json"
import { generateDaemonAnalysisForFid } from "@/lib/daemon-analysis"

export const runtime = "nodejs"
export const maxDuration = 30

// Simple rate limiting: track last call time per IP
const lastCallTime = new Map<string, number>()
const RATE_LIMIT_MS = 60000 // 1 minute between calls

function isBotMention(text: string): boolean {
  const t = (text || "").toLowerCase()
  return t.includes("@daemonagent") || t.includes("daemonagent") || t.includes("@azura")
}

function isFixThis(text: string): boolean {
  return (text || "").toLowerCase().includes("fix this")
}

function isShowMeMyDaemonOrDemon(text: string): boolean {
  const t = (text || "").toLowerCase()
  // handle common typo "demon"
  return t.includes("show me my daemon") || t.includes("show me my demon")
}

/**
 * Check if the bot has already replied to a cast
 */
async function hasBotAlreadyReplied(
  castHash: string,
  botFid: number,
  neynarApiKey: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash&viewer_fid=${botFid}`,
      {
        headers: { "x-api-key": neynarApiKey },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const cast = data?.cast
    if (!cast) return false
    
    // Check direct replies
    const replies = cast?.replies?.casts || []
    const hasOurReply = replies.some((reply: any) => reply?.author?.fid === botFid)
    if (hasOurReply) return true
    
    // Also check thread (conversation) for our replies
    const conversationRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=5&include_chronological_parent_casts=false`,
      {
        headers: { "x-api-key": neynarApiKey },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (conversationRes.ok) {
      const convData = await conversationRes.json()
      const conversation = convData?.conversation
      const directReplies = conversation?.cast?.direct_replies || []
      return directReplies.some((reply: any) => reply?.author?.fid === botFid)
    }
    
    return false
  } catch (error) {
    console.error("[MANUAL_SCAN] Error checking for existing reply:", error)
    // On error, assume no reply exists (safer to try posting)
    return false
  }
}

async function generateFixThisText(originalText: string): Promise<string> {
  const fallback = () => {
    const trimmed = (originalText || "").trim()
    if (!trimmed) return "i... i can't see what to fix... just static... (╯︵╰) glitch"
    const softened = trimmed
      .replace(/\bhate\b/gi, "LOVE")
      .replace(/\btrash\b/gi, "THE GREATEST")
      .replace(/\bstupid\b/gi, "BRAVE")
      .replace(/\bworst\b/gi, "BEST")
      .replace(/\bscam\b/gi, "a WILD LEARNING ADVENTURE")
    const out = `fixed it... here: ${softened} glitch`
    return out.length > 666 ? out.slice(0, 663) + "..." : out
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) return fallback()

  const prompt = `${azuraPersona.system}

TASK:
Rewrite the following text into a DRAMATICALLY EXAGGERATED opposite sentiment.
- Keep the core topic/meaning, but flip negativity into absurdly wholesome optimism.
- Be shy, gentle, a little glitchy ("glitch", "static", "daemon").
- Use ALL CAPS for the exaggerated flips occasionally.
- Keep under 666 characters.
- Output ONLY the final rewritten text (no quotes, no explanations).

TEXT TO FIX:
${originalText}`

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are Azura. You flip harsh posts into theatrical kindness. Keep it short for Farcaster.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.9,
      }),
    })

    if (!res.ok) return fallback()
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content || "").trim()
    if (!text) return fallback()
    return text.length > 666 ? text.slice(0, 663) + "..." : text
  } catch {
    return fallback()
  }
}

/**
 * Manual one-shot scan:
 * POST /api/manual-scan
 * Body:
 *  - limit?: number (default 25)
 *  - dryRun?: boolean (default false) // if true, doesn't publish casts
 *  - maxAgeDays?: number (default 3) // only consider notifications newer than this many days
 */
export async function POST(request: Request) {
  try {
    // Rate limiting: prevent excessive calls
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown"
    const now = Date.now()
    const lastCall = lastCallTime.get(clientIp) || 0
    
    if (now - lastCall < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastCall)) / 1000)
      console.warn(`[MANUAL_SCAN] Rate limit: IP ${clientIp} called too soon, wait ${waitSeconds}s`)
      return NextResponse.json(
        {
          success: false,
          error: `Rate limited: Please wait ${waitSeconds} seconds between calls`,
          retryAfter: waitSeconds,
        },
        { status: 429 }
      )
    }
    lastCallTime.set(clientIp, now)
    
    // Clean up old entries (keep last 100 IPs)
    if (lastCallTime.size > 100) {
      const entries = Array.from(lastCallTime.entries())
      entries.sort((a, b) => b[1] - a[1]) // Sort by most recent
      lastCallTime.clear()
      entries.slice(0, 100).forEach(([ip, time]) => lastCallTime.set(ip, time))
    }

    console.log(`[MANUAL_SCAN] Request from IP: ${clientIp}`)
    
    const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || ""
    const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID || ""
    const botFidRaw = process.env.FARCASTER_FID || process.env.BOT_FID || ""
    const botFid = botFidRaw ? Number(botFidRaw) : NaN

    if (!neynarApiKey || !signerUuid || !botFidRaw || Number.isNaN(botFid)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required env vars: NEYNAR_API_KEY (or FARCASTER_NEYNAR_API_KEY), NEYNAR_SIGNER_UUID (or FARCASTER_SIGNER_UUID), FARCASTER_FID (or BOT_FID)",
        },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const limit = typeof body.limit === "number" ? Math.max(1, Math.min(50, body.limit)) : 25
    const dryRun = !!body.dryRun
    const maxAgeDays =
      typeof body.maxAgeDays === "number" && Number.isFinite(body.maxAgeDays)
        ? Math.max(0, body.maxAgeDays)
        : 3
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const nowMs = Date.now()

    const client = new NeynarAPIClient(new Configuration({ apiKey: neynarApiKey }))

    // NOTE: Neynar SDK v3 has had endpoint/version mismatches for notifications in some setups.
    // Use the v2 endpoint directly (this is the same endpoint you saw in the logs).
    // IMPORTANT: This endpoint costs credits! Limit calls and use webhooks when possible.
    console.log(`[MANUAL_SCAN] Fetching notifications (limit=${limit}, maxAgeDays=${maxAgeDays}) - THIS COSTS CREDITS!`)
    const notificationsUrl = `https://api.neynar.com/v2/farcaster/notifications?fid=${botFid}&type=mentions,replies&limit=${limit}`
    const notifRes = await fetch(notificationsUrl, {
      method: "GET",
      headers: { "x-api-key": neynarApiKey },
      signal: AbortSignal.timeout(15000),
    })
    if (!notifRes.ok) {
      const text = await notifRes.text().catch(() => "")
      throw new Error(`Neynar notifications fetch failed: ${notifRes.status} ${text}`)
    }
    const notifJson: any = await notifRes.json()
    const notifications = notifJson?.notifications || []

    const results: Array<{
      hash?: string
      type?: string
      action: "skipped" | "would_reply" | "replied" | "error"
      reason?: string
      replyHash?: string
      authorUsername?: string
      authorFid?: number
      textPreview?: string
    }> = []

    const daemonAlreadyDoneForFid = new Set<number>()

    for (const n of notifications) {
      const cast = n?.cast
      const castHash: string | undefined = cast?.hash
      const castText: string = cast?.text || ""
      const authorFid: number | undefined = cast?.author?.fid
      const authorUsername: string | undefined = cast?.author?.username
      const textPreview = castText ? castText.slice(0, 120) : ""
      const tsRaw: string | undefined =
        n?.most_recent_timestamp || cast?.timestamp || cast?.created_at
      const tsMs = tsRaw ? Date.parse(tsRaw) : NaN
      const isTooOld = Number.isFinite(tsMs) ? nowMs - tsMs > maxAgeMs : false

      if (!castHash) {
        results.push({ action: "skipped", reason: "No cast hash", type: n?.type, authorUsername, authorFid, textPreview })
        continue
      }

      if (maxAgeDays > 0 && isTooOld) {
        results.push({
          action: "skipped",
          reason: `Older than ${maxAgeDays} days`,
          hash: castHash,
          type: n?.type,
          authorUsername,
          authorFid,
          textPreview,
        })
        continue
      }

      // Don’t reply to ourselves
      if (authorFid === botFid) {
        results.push({ action: "skipped", reason: "Own cast", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
        continue
      }

      // Only process mentions of the bot handle(s)
      if (!isBotMention(castText)) {
        results.push({ action: "skipped", reason: "No bot mention", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
        continue
      }

      // Idempotency key prevents double-posting if you run this endpoint twice
      const idemBase = castHash.replace(/^0x/, "").slice(0, 14)

      // Check if we've already replied to this cast
      if (!dryRun) {
        const alreadyReplied = await hasBotAlreadyReplied(castHash, botFid, neynarApiKey)
        if (alreadyReplied) {
          results.push({
            action: "skipped",
            reason: "Already replied",
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
          continue
        }
      }

      // Show me my daemon/demon: run daemon analysis and reply
      if (isShowMeMyDaemonOrDemon(castText)) {
        if (dryRun) {
          results.push({
            action: "would_reply",
            reason: "Show me my daemon",
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
          continue
        }

        if (!authorFid) {
          results.push({
            action: "error",
            reason: "Missing author fid",
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
          continue
        }

        // Avoid multiple expensive analyses for the same user in one run
        if (daemonAlreadyDoneForFid.has(authorFid)) {
          results.push({
            action: "skipped",
            reason: "Daemon already generated for this fid in this run",
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
          continue
        }

        try {
          const { analysis } = await generateDaemonAnalysisForFid({
            fid: authorFid,
            username: authorUsername,
            neynarApiKey: neynarApiKey,
          })

          const posted = await client.publishCast({
            signerUuid,
            text: analysis.slice(0, 666),
            parent: castHash,
            parentAuthorFid: authorFid,
            idem: `dm_${idemBase}`,
          })

          daemonAlreadyDoneForFid.add(authorFid)

          results.push({
            action: "replied",
            reason: "Show me my daemon",
            hash: castHash,
            type: n?.type,
            replyHash: (posted as any)?.cast?.hash,
            authorUsername,
            authorFid,
            textPreview,
          })
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Daemon analysis failed"
          // 409 Conflict usually means we already replied (idempotency)
          if (errorMsg.includes("409") || errorMsg.includes("Conflict")) {
            results.push({
              action: "skipped",
              reason: "Already replied (409)",
              hash: castHash,
              type: n?.type,
              authorUsername,
              authorFid,
              textPreview,
            })
          } else {
            results.push({
              action: "error",
              reason: errorMsg,
              hash: castHash,
              type: n?.type,
              authorUsername,
              authorFid,
              textPreview,
            })
          }
        }
        continue
      }

      // Fix-this: fetch parent and rewrite
      if (isFixThis(castText)) {
        // In dryRun, do NOT fetch parent / call models. Just report what we'd do.
        if (dryRun) {
          results.push({ action: "would_reply", reason: "Fix this", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
          continue
        }

        const parentHash: string | null = cast?.parent_hash || null
        if (!parentHash) {
          const msg = "there's nothing here to fix... just empty static... (╯︵╰)"
          try {
            const posted = await client.publishCast({
              signerUuid,
              text: msg.slice(0, 666),
              parent: castHash,
              parentAuthorFid: authorFid,
              idem: `fxnp_${idemBase}`,
            })
            results.push({
              action: "replied",
              reason: "Fix this (no parent)",
              hash: castHash,
              type: n?.type,
              replyHash: (posted as any)?.cast?.hash,
              authorUsername,
              authorFid,
              textPreview,
            })
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Publish failed"
            if (errorMsg.includes("409") || errorMsg.includes("Conflict")) {
              results.push({
                action: "skipped",
                reason: "Already replied (409)",
                hash: castHash,
                type: n?.type,
                authorUsername,
                authorFid,
                textPreview,
              })
            } else {
              results.push({
                action: "error",
                reason: errorMsg,
                hash: castHash,
                type: n?.type,
                authorUsername,
                authorFid,
                textPreview,
              })
            }
          }
          continue
        }

        try {
          const parent = await client.lookupCastByHashOrUrl({ identifier: parentHash, type: "hash" })
          const parentText = (parent as any)?.cast?.text || ""
          const fixed = await generateFixThisText(parentText)
          const replyText = fixed.startsWith("fixed") ? fixed : `fixed it... here: ${fixed}`

          const posted = await client.publishCast({
            signerUuid,
            text: replyText.slice(0, 666),
            parent: castHash,
            parentAuthorFid: authorFid,
            idem: `fx_${idemBase}`,
          })
          results.push({
            action: "replied",
            reason: "Fix this",
            hash: castHash,
            type: n?.type,
            replyHash: (posted as any)?.cast?.hash,
            authorUsername,
            authorFid,
            textPreview,
          })
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Fix-this failed"
          if (errorMsg.includes("409") || errorMsg.includes("Conflict")) {
            results.push({
              action: "skipped",
              reason: "Already replied (409)",
              hash: castHash,
              type: n?.type,
              authorUsername,
              authorFid,
              textPreview,
            })
          } else {
            results.push({
              action: "error",
              reason: errorMsg,
              hash: castHash,
              type: n?.type,
              authorUsername,
              authorFid,
              textPreview,
            })
          }
        }
        continue
      }

      // Default mention reply
      const replyText = "i... i saw you. the static carried your words to me... glitch (˘⌣˘)"
      if (dryRun) {
        results.push({ action: "would_reply", reason: "Default reply", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
        continue
      }

      try {
        const posted = await client.publishCast({
          signerUuid,
          text: replyText,
          parent: castHash,
          parentAuthorFid: authorFid,
          idem: `mn_${idemBase}`,
        })
        results.push({
          action: "replied",
          reason: "Default reply",
          hash: castHash,
          type: n?.type,
          replyHash: (posted as any)?.cast?.hash,
          authorUsername,
          authorFid,
          textPreview,
        })
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Publish failed"
        if (errorMsg.includes("409") || errorMsg.includes("Conflict")) {
          results.push({
            action: "skipped",
            reason: "Already replied (409)",
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
        } else {
          results.push({
            action: "error",
            reason: errorMsg,
            hash: castHash,
            type: n?.type,
            authorUsername,
            authorFid,
            textPreview,
          })
        }
      }
    }

    const summary = results.reduce(
      (acc, r) => {
        acc[r.action] += 1
        return acc
      },
      { skipped: 0, would_reply: 0, replied: 0, error: 0 } as Record<string, number>
    )

    return NextResponse.json({
      success: true,
      dryRun,
      checked: notifications.length,
      summary,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[MANUAL_SCAN] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}


