#!/usr/bin/env tsx
/**
 * Script to scan for missed Farcaster posts that mention the bot
 * 
 * Usage:
 *   pnpm tsx scripts/scan-missed-posts.ts [--dry-run] [--limit=25] [--max-age-days=7]
 * 
 * Options:
 *   --dry-run: Only show what would be replied to, don't actually post
 *   --limit: Number of notifications to check (default: 25, max: 50)
 *   --max-age-days: Only check posts newer than this many days (default: 7, 0 = no limit)
 */

// Load environment variables from .env.local
import { readFileSync } from "fs"
import { join } from "path"
try {
  const envPath = join(__dirname, "..", ".env.local")
  const envFile = readFileSync(envPath, "utf-8")
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (error) {
  // .env.local might not exist, that's okay
}

import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk"
import azuraPersona from "../lib/azura-persona.json"
import { generateDaemonAnalysisForFid } from "../lib/daemon-analysis"

function isBotMention(text: string): boolean {
  const t = (text || "").toLowerCase()
  return t.includes("@daemonagent") || t.includes("daemonagent") || t.includes("@azura")
}

function isFixThis(text: string): boolean {
  return (text || "").toLowerCase().includes("fix this")
}

function isShowMeMyDaemonOrDemon(text: string): boolean {
  const t = (text || "").toLowerCase()
  return t.includes("show me my daemon") || t.includes("show me my demon")
}

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
    
    const replies = cast?.replies?.casts || []
    const hasOurReply = replies.some((reply: any) => reply?.author?.fid === botFid)
    if (hasOurReply) return true
    
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
    console.error("[SCAN] Error checking for existing reply:", error)
    return false
  }
}

async function generateFixThisText(originalText: string): Promise<string> {
  const fallback = () => {
    const trimmed = (originalText || "").trim()
    if (!trimmed) return "i... i can't see what to fix... just empty static... (╯︵╰) glitch"
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

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const limitArg = args.find((a) => a.startsWith("--limit="))
  const maxAgeArg = args.find((a) => a.startsWith("--max-age-days="))
  
  const limit = limitArg ? Math.max(1, Math.min(25, parseInt(limitArg.split("=")[1]) || 25)) : 25
  const maxAgeDays = maxAgeArg ? Math.max(0, parseFloat(maxAgeArg.split("=")[1]) || 7) : 7

  const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || ""
  const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID || ""
  const botFidRaw = process.env.FARCASTER_FID || process.env.BOT_FID || ""
  const botFid = botFidRaw ? Number(botFidRaw) : NaN

  if (!neynarApiKey || !signerUuid || !botFidRaw || Number.isNaN(botFid)) {
    console.error("❌ Missing required environment variables:")
    console.error("   - NEYNAR_API_KEY (or FARCASTER_NEYNAR_API_KEY)")
    console.error("   - NEYNAR_SIGNER_UUID (or FARCASTER_SIGNER_UUID)")
    console.error("   - FARCASTER_FID (or BOT_FID)")
    process.exit(1)
  }

  console.log("🔍 Scanning for missed posts...")
  console.log(`   Mode: ${dryRun ? "DRY RUN (no posts will be made)" : "LIVE (will post replies)"}`)
  console.log(`   Limit: ${limit} notifications`)
  console.log(`   Max age: ${maxAgeDays === 0 ? "no limit" : `${maxAgeDays} days`}`)
  console.log("")

  const client = new NeynarAPIClient(new Configuration({ apiKey: neynarApiKey }))
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  const nowMs = Date.now()

  const notificationsUrl = `https://api.neynar.com/v2/farcaster/notifications?fid=${botFid}&type=mentions,replies&limit=${limit}`
  const notifRes = await fetch(notificationsUrl, {
    method: "GET",
    headers: { "x-api-key": neynarApiKey },
    signal: AbortSignal.timeout(15000),
  })

  if (!notifRes.ok) {
    const text = await notifRes.text().catch(() => "")
    console.error(`❌ Failed to fetch notifications: ${notifRes.status} ${text}`)
    process.exit(1)
  }

  const notifJson: any = await notifRes.json()
  const notifications = notifJson?.notifications || []

  console.log(`📬 Found ${notifications.length} notifications\n`)

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

    if (authorFid === botFid) {
      results.push({ action: "skipped", reason: "Own cast", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
      continue
    }

    if (!isBotMention(castText)) {
      results.push({ action: "skipped", reason: "No bot mention", hash: castHash, type: n?.type, authorUsername, authorFid, textPreview })
      continue
    }

    const idemBase = castHash.replace(/^0x/, "").slice(0, 14)

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

    // Show me my daemon
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

    // Fix-this
    if (isFixThis(castText)) {
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

  console.log("📊 Summary:")
  console.log(`   Checked: ${notifications.length} notifications`)
  console.log(`   Skipped: ${summary.skipped}`)
  console.log(`   ${dryRun ? "Would reply" : "Replied"}: ${dryRun ? summary.would_reply : summary.replied}`)
  console.log(`   Errors: ${summary.error}`)
  console.log("")

  if (summary.would_reply > 0 || summary.replied > 0) {
    console.log("📝 Details:")
    results
      .filter((r) => r.action === (dryRun ? "would_reply" : "replied") || r.action === "error")
      .forEach((r) => {
        console.log(`   ${r.action === "error" ? "❌" : dryRun ? "💭" : "✅"} ${r.reason}`)
        console.log(`      @${r.authorUsername} (FID: ${r.authorFid})`)
        console.log(`      "${r.textPreview}${r.textPreview && r.textPreview.length >= 120 ? "..." : ""}"`)
        if (r.replyHash) console.log(`      Reply: ${r.replyHash}`)
        console.log("")
      })
  }

  if (dryRun && summary.would_reply > 0) {
    console.log("💡 Run without --dry-run to actually post replies")
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})

