/**
 * Tone Context Analysis Script
 * Analyzes how tone changes with different contexts
 * 
 * Usage:
 *   pnpm tsx scripts/analyze-tone-context.ts <FID> [fetchLimit]
 */

import { analyzeVoiceFromSuccessfulPosts } from "@/lib/voice-analysis";
import { analyzeToneByContext } from "@/lib/tone-context-analysis";
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
  const fetchLimit = process.argv[3] ? parseInt(process.argv[3]) : 100;

  if (!fid || isNaN(fid)) {
    console.error("Usage: pnpm tsx scripts/analyze-tone-context.ts <FID> [fetchLimit]");
    console.error("Example: pnpm tsx scripts/analyze-tone-context.ts 286924 100");
    process.exit(1);
  }

  console.log(`\n🔍 Analyzing tone variation by context for FID ${fid}...\n`);

  try {
    // First, get the successful posts
    const result = await analyzeVoiceFromSuccessfulPosts({
      fid,
      neynarApiKey,
      topN: 10,
      fetchLimit,
    });

    console.log(`\n📊 Found ${result.successfulPosts.length} successful posts\n`);

    // Analyze tone by context
    const toneAnalysis = analyzeToneByContext(result.successfulPosts);

    console.log("=".repeat(80));
    console.log("TONE VARIATION BY CONTEXT");
    console.log("=".repeat(80));
    console.log(`\n📈 Overall Pattern: ${toneAnalysis.overallPattern}\n`);

    // Display each context
    toneAnalysis.contexts.forEach((context, index) => {
      console.log(`\n${"-".repeat(80)}`);
      console.log(`CONTEXT ${index + 1}: ${context.context.toUpperCase().replace(/_/g, " ")}`);
      console.log(`${"-".repeat(80)}`);
      console.log(`Posts in this context: ${context.posts.length}`);
      console.log(`\nTone Characteristics:`);
      context.toneCharacteristics.forEach((char) => {
        console.log(`  • ${char}`);
      });
      console.log(`\nLanguage Patterns:`);
      context.languagePatterns.forEach((pattern) => {
        console.log(`  • ${pattern.replace(/_/g, " ")}`);
      });
      console.log(`\nExamples:`);
      context.examples.forEach((example, i) => {
        console.log(`  ${i + 1}. ${example}`);
      });
      
      // Show engagement stats for this context
      const avgEngagement = context.posts.reduce(
        (sum, p) => sum + (p as any).totalEngagement,
        0
      ) / context.posts.length;
      const maxEngagement = Math.max(
        ...context.posts.map((p) => (p as any).totalEngagement)
      );
      console.log(`\nEngagement Stats:`);
      console.log(`  • Average: ${avgEngagement.toFixed(1)}`);
      console.log(`  • Highest: ${maxEngagement}`);
    });

    // Display transitions
    if (toneAnalysis.transitions.length > 0) {
      console.log(`\n\n${"=".repeat(80)}`);
      console.log("TONE TRANSITIONS");
      console.log("=".repeat(80));
      toneAnalysis.transitions.forEach((transition, i) => {
        console.log(`${i + 1}. ${transition}`);
      });
    }

    // Display recommendations
    if (toneAnalysis.recommendations.length > 0) {
      console.log(`\n\n${"=".repeat(80)}`);
      console.log("RECOMMENDATIONS");
      console.log("=".repeat(80));
      toneAnalysis.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

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
