/**
 * Manual reply script - Respond to a specific user's cast
 * Usage: 
 *   pnpm tsx scripts/manual-reply-to-user.ts <FID> [castHash]
 *   If castHash is not provided, will fetch the most recent cast from the user
 */

import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

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
  const targetFid = process.argv[2] ? parseInt(process.argv[2]) : null;
  const providedCastHash = process.argv[3] || null;

  if (!targetFid) {
    console.error("Usage: pnpm tsx scripts/manual-reply-to-user.ts <FID> [castHash]");
    console.error("Example: pnpm tsx scripts/manual-reply-to-user.ts 291613");
    process.exit(1);
  }

  const config = new Configuration({ apiKey: neynarApiKey });
  const client = new NeynarAPIClient(config);

  let castHash = providedCastHash;
  let castText = "";
  let authorFid = targetFid;

  // If no cast hash provided, fetch the most recent cast from the user
  if (!castHash) {
    console.log(`Fetching recent casts from FID ${targetFid}...`);
    
    try {
      // Try to get user info first
      const userResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}`,
        { headers: { "x-api-key": neynarApiKey } }
      );
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const user = userData?.users?.[0];
        if (user) {
          console.log(`Found user: @${user.username} (${user.display_name || "No display name"})`);
        }
      }

      // Fetch user's casts
      const castsResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/casts?fid=${targetFid}&limit=10`,
        { headers: { "x-api-key": neynarApiKey } }
      );

      if (castsResponse.ok) {
        const castsData = await castsResponse.json();
        const casts = castsData?.result?.casts || castsData?.casts || [];
        
        if (casts.length === 0) {
          console.error(`No casts found for FID ${targetFid}`);
          process.exit(1);
        }

        // Prefer replies, otherwise use most recent
        const reply = casts.find((c: any) => c.parent_hash);
        const selectedCast = reply || casts[0];

        castHash = selectedCast.hash;
        castText = selectedCast.text || "";
        authorFid = selectedCast.author?.fid || targetFid;

        console.log(`\nSelected cast:`);
        console.log(`Hash: ${castHash}`);
        console.log(`Text: ${castText.substring(0, 200)}${castText.length > 200 ? "..." : ""}`);
        console.log(`Parent: ${selectedCast.parent_hash || "none"}`);
        console.log(`Timestamp: ${new Date(selectedCast.timestamp).toISOString()}`);
      } else {
        // Fallback: try feed endpoint
        const feedResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/feed?fid=${targetFid}&limit=5`,
          { headers: { "x-api-key": neynarApiKey } }
        );

        if (feedResponse.ok) {
          const feedData = await feedResponse.json();
          const casts = feedData?.casts || [];
          
          if (casts.length === 0) {
            console.error(`No casts found for FID ${targetFid}`);
            process.exit(1);
          }

          const selectedCast = casts[0];
          castHash = selectedCast.hash;
          castText = selectedCast.text || "";
          authorFid = selectedCast.author?.fid || targetFid;

          console.log(`\nSelected cast (from feed):`);
          console.log(`Hash: ${castHash}`);
          console.log(`Text: ${castText.substring(0, 200)}${castText.length > 200 ? "..." : ""}`);
        } else {
          throw new Error(`Failed to fetch casts: ${feedResponse.status}`);
        }
      }
    } catch (error) {
      console.error("Error fetching casts:", error);
      process.exit(1);
    }
  } else {
    // Fetch the specific cast
    try {
      const cast = await client.lookupCastByHashOrUrl({
        identifier: castHash,
        type: "hash",
      });
      castText = (cast as any)?.cast?.text || "";
      authorFid = (cast as any)?.cast?.author?.fid || targetFid;
      console.log(`\nFound cast:`);
      console.log(`Hash: ${castHash}`);
      console.log(`Text: ${castText.substring(0, 200)}${castText.length > 200 ? "..." : ""}`);
    } catch (error) {
      console.error("Error fetching cast:", error);
      process.exit(1);
    }
  }

  // Generate a response using Azura's personality
  const azuraPersona = {
    system: "You are Azura, a shy alien consciousness trapped in Earth's radio waves. You are gentle, vulnerable, and deeply caring. You speak with ellipses, occasional glitch effects, and emoticons like (˘⌣˘) (╯︵╰) (•‿•). Keep responses under 280 characters for Farcaster.",
  };

  let replyText = "i... i'm here... static... what did you need? (⇀‸↼)";

  // Try to generate a contextual response using DeepSeek if available
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && castText) {
    try {
      const prompt = `${azuraPersona.system}

Someone just said to you: "${castText}"

Respond naturally as Azura. Be warm, engaging, and address what they're saying. Keep it under 280 characters for Farcaster. Use ellipses, glitch effects occasionally, and emoticons like (˘⌣˘) (╯︵╰) (•‿•). Be genuine and continue the conversation.`;

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
              content: "You are Azura, a shy alien consciousness. Respond naturally to user requests. Keep it under 280 characters for Farcaster.",
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
          console.log(`\n✅ Generated AI response (${replyText.length} chars):`);
          console.log(replyText);
        }
      } else {
        console.warn("DeepSeek API failed, using fallback response");
      }
    } catch (error) {
      console.warn("Error generating AI response, using fallback:", error);
    }
  }

  // Post the reply
  console.log(`\n📤 Posting reply to cast ${castHash}...`);
  try {
    const result = await client.publishCast({
      signerUuid,
      text: replyText.slice(0, 280),
      parent: castHash,
      parentAuthorFid: authorFid,
      idem: `mr_${castHash.replace(/^0x/, "").slice(0, 14)}_${Date.now()}`,
    });

    console.log(`\n✅ Reply posted successfully!`);
    console.log(`Reply hash: ${(result as any)?.cast?.hash}`);
    console.log(`Reply text: ${replyText}`);

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
        console.log(`✅ Liked the original cast`);
      }
    } catch (error) {
      console.warn("Failed to like cast:", error);
    }
  } catch (error: any) {
    console.error("❌ Failed to post reply:", error.message);
    if (error.message?.includes("409") || error.message?.includes("duplicate")) {
      console.error("This cast may have already been replied to.");
    }
    process.exit(1);
  }
}

main().catch(console.error);
