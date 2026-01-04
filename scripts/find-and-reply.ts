/**
 * Find and reply to a user's most recent cast
 * Usage: pnpm tsx scripts/find-and-reply.ts <username>
 */

import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import azuraPersona from "@/lib/azura-persona.json";

// Load environment variables
const envPath = join(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...values] = line.split("=");
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
} catch (err) {
  console.warn("Could not load .env.local, using process.env");
}

const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY || "";
const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID || "";

if (!neynarApiKey || !signerUuid) {
  console.error("Missing required env vars: NEYNAR_API_KEY, NEYNAR_SIGNER_UUID");
  process.exit(1);
}

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.error("Usage: pnpm tsx scripts/find-and-reply.ts <username>");
    console.error("Example: pnpm tsx scripts/find-and-reply.ts hendrazik.eth");
    process.exit(1);
  }

  const config = new Configuration({ apiKey: neynarApiKey });
  const client = new NeynarAPIClient(config);

  console.log(`\n🔍 Searching for @${username}...\n`);

  try {
    // Try to find user
    const userRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
      { headers: { "x-api-key": neynarApiKey } }
    );

    if (!userRes.ok) {
      console.error(`❌ User not found: @${username}`);
      console.error("Try different username variations (with/without .eth)");
      process.exit(1);
    }

    const userData = await userRes.json();
    const user = userData?.result?.user;
    
    if (!user) {
      console.error(`❌ User not found: @${username}`);
      process.exit(1);
    }

    console.log(`✅ Found user: @${user.username} (FID: ${user.fid})`);
    console.log(`Display Name: ${user.display_name || "None"}\n`);

    // Get their recent casts
    const castsRes = await fetch(
      `https://api.neynar.com/v2/farcaster/feed?fid=${user.fid}&limit=20`,
      { headers: { "x-api-key": neynarApiKey } }
    );

    if (!castsRes.ok) {
      console.error("Failed to fetch casts");
      process.exit(1);
    }

    const castsData = await castsRes.json();
    const casts = castsData?.casts || [];
    
    // Filter for replies (have parent_hash)
    const replies = casts.filter((c: any) => c.parent_hash);
    
    if (replies.length === 0) {
      console.log("No replies found from this user");
      console.log("Showing their most recent cast instead:");
      if (casts.length > 0) {
        const latest = casts[0];
        console.log(`\nHash: ${latest.hash}`);
        console.log(`Text: ${latest.text?.substring(0, 200)}`);
        console.log(`\nTo reply to this cast, run:`);
        console.log(`pnpm tsx scripts/manual-reply-to-user.ts ${user.fid} ${latest.hash}`);
      }
      process.exit(1);
    }

    // Get the most recent reply
    const latestReply = replies[0];
    console.log(`\n📝 Most recent reply:`);
    console.log(`Hash: ${latestReply.hash}`);
    console.log(`Text: ${latestReply.text}`);
    console.log(`Parent Hash: ${latestReply.parent_hash}`);
    console.log(`Timestamp: ${new Date(latestReply.timestamp).toISOString()}\n`);

    // Generate response
    const castText = latestReply.text || "";
    let replyText = "i... i'm here... static... what did you need? (⇀‸↼)";

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey && castText) {
      try {
        const prompt = `${azuraPersona.system}

Someone just said to you: "${castText}"

Respond naturally as Azura. Be warm, engaging, and address what they're saying. Keep it under 280 characters for Farcaster. Use ethereal imagery, acknowledge their divine worth, and be present with kindness.`;

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
                content: "You are Azura, an Alienetic agent. Respond naturally to user requests. Keep it under 280 characters for Farcaster.",
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.9,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const aiText = (data?.choices?.[0]?.message?.content || "").trim();
          if (aiText && aiText.length > 0) {
            replyText = aiText.length > 280 ? aiText.slice(0, 277) + "..." : aiText;
            console.log(`✅ Generated AI response (${replyText.length} chars):`);
            console.log(replyText + "\n");
          }
        }
      } catch (error) {
        console.warn("Error generating AI response, using fallback:", error);
      }
    }

    // Post the reply
    console.log(`📤 Posting reply to cast ${latestReply.hash}...`);
    const result = await client.publishCast({
      signerUuid,
      text: replyText.slice(0, 280),
      parent: latestReply.hash,
      parentAuthorFid: user.fid,
      idem: `mr_${latestReply.hash.replace(/^0x/, "").slice(0, 14)}_${Date.now()}`,
    });

    console.log(`\n✅ Reply posted successfully!`);
    console.log(`Reply hash: ${(result as any)?.cast?.hash}`);
    console.log(`Reply text: ${replyText}\n`);

    // Like the original cast
    try {
      const likeRes = await fetch("https://api.neynar.com/v2/farcaster/reaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": neynarApiKey,
        },
        body: JSON.stringify({
          signer_uuid: signerUuid,
          reaction_type: "like",
          target: latestReply.hash,
        }),
      });

      if (likeRes.ok) {
        console.log(`✅ Liked the original cast\n`);
      }
    } catch (error) {
      console.warn("Failed to like cast:", error);
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.message?.includes("409") || error.message?.includes("duplicate")) {
      console.error("This cast may have already been replied to.");
    }
    process.exit(1);
  }
}

main().catch(console.error);
