/**
 * Voice Analysis Script
 * Analyzes the most successful posts from a Farcaster user to identify their consistent voice
 * 
 * Usage:
 *   pnpm tsx scripts/analyze-voice.ts <FID> [topN]
 * 
 * Example:
 *   pnpm tsx scripts/analyze-voice.ts 286924 20
 */

import { analyzeVoiceFromSuccessfulPosts } from "@/lib/voice-analysis";
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
const deepseekKey = process.env.DEEPSEEK_API_KEY || "";

if (!neynarApiKey) {
  console.error("Missing required env var: NEYNAR_API_KEY");
  process.exit(1);
}

if (!deepseekKey) {
  console.error("Missing required env var: DEEPSEEK_API_KEY");
  process.exit(1);
}

async function main() {
  const fid = process.argv[2] ? parseInt(process.argv[2]) : null;
  const topN = process.argv[3] ? parseInt(process.argv[3]) : 10;
  const fetchLimit = process.argv[4] ? parseInt(process.argv[4]) : 100;

  if (!fid || isNaN(fid)) {
    console.error("Usage: pnpm tsx scripts/analyze-voice.ts <FID> [topN] [fetchLimit]");
    console.error("Example: pnpm tsx scripts/analyze-voice.ts 286924 10 100");
    console.error("  - topN: Number of top posts to analyze (default: 10)");
    console.error("  - fetchLimit: Number of casts to fetch (default: 100)");
    process.exit(1);
  }

  if (topN < 1 || topN > 50) {
    console.error("topN must be between 1 and 50");
    process.exit(1);
  }

  if (fetchLimit < 1 || fetchLimit > 500) {
    console.error("fetchLimit must be between 1 and 500");
    process.exit(1);
  }

  console.log(`\n🔍 Analyzing voice for FID ${fid}...`);
  console.log(`📊 Fetching up to ${fetchLimit} casts and analyzing top ${topN} most successful posts\n`);

  try {
    const result = await analyzeVoiceFromSuccessfulPosts({
      fid,
      neynarApiKey,
      topN,
      fetchLimit,
    });

    console.log("\n" + "=".repeat(80));
    console.log("VOICE ANALYSIS RESULTS");
    console.log("=".repeat(80));
    console.log(`\n👤 User: @${result.profile.username} (${result.profile.display_name})`);
    console.log(`📈 Stats:`);
    console.log(`   - Total posts analyzed: ${result.stats.total_posts_analyzed}`);
    console.log(`   - Top posts analyzed: ${result.stats.top_posts_count}`);
    console.log(`   - Average engagement: ${result.stats.average_engagement}`);
    console.log(`   - Highest engagement: ${result.stats.highest_engagement}`);
    console.log(`   - Lowest engagement (in top posts): ${result.stats.lowest_engagement_in_top}`);

    console.log(`\n\n${"=".repeat(80)}`);
    console.log("CONSISTENT VOICE ANALYSIS");
    console.log("=".repeat(80));
    console.log(`\n${result.analysis}\n`);

    console.log("\n" + "=".repeat(80));
    console.log("TOP SUCCESSFUL POSTS");
    console.log("=".repeat(80));
    result.successfulPosts.forEach((post, index) => {
      console.log(`\n[#${index + 1}] Engagement Score: ${post.engagementScore.toFixed(2)} | Total: ${post.totalEngagement}`);
      console.log(`Hash: ${post.hash}`);
      console.log(`Text: ${post.text.substring(0, 200)}${post.text.length > 200 ? "..." : ""}`);
      console.log("-".repeat(80));
    });

    console.log("\n✅ Analysis complete!\n");
  } catch (error) {
    console.error("\n❌ Error during analysis:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
