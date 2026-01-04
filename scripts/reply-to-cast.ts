/**
 * Reply to a specific cast by hash
 * Usage: pnpm tsx scripts/reply-to-cast.ts <castHash>
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
  const castHash = process.argv[2];
  
  if (!castHash) {
    console.error("Usage: pnpm tsx scripts/reply-to-cast.ts <castHash>");
    console.error("Example: pnpm tsx scripts/reply-to-cast.ts 0x1234...");
    process.exit(1);
  }

  const config = new Configuration({ apiKey: neynarApiKey });
  const client = new NeynarAPIClient(config);

  console.log(`\n🔍 Fetching cast ${castHash}...\n`);

  try {
    // Fetch the cast
    const cast = await client.lookupCastByHashOrUrl({
      identifier: castHash,
      type: "hash",
    });

    const castData = (cast as any)?.cast;
    if (!castData) {
      console.error("❌ Cast not found");
      process.exit(1);
    }

    const author = castData.author;
    const castText = castData.text || "";

    console.log(`✅ Found cast:`);
    console.log(`Author: @${author.username} (FID: ${author.fid})`);
    console.log(`Text: ${castText.substring(0, 200)}${castText.length > 200 ? "..." : ""}`);
    console.log(`Parent: ${castData.parent_hash || "none"}\n`);

    // Generate response
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
    console.log(`📤 Posting reply...`);
    const result = await client.publishCast({
      signerUuid,
      text: replyText.slice(0, 280),
      parent: castHash,
      parentAuthorFid: author.fid,
      idem: `mr_${castHash.replace(/^0x/, "").slice(0, 14)}_${Date.now()}`,
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
          target: castHash,
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
