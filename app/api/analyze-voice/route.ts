import { NextResponse } from "next/server"
import { analyzeVoiceFromSuccessfulPosts } from "@/lib/voice-analysis"

export const runtime = "nodejs"
export const maxDuration = 60 // 60 seconds for thorough analysis

/**
 * Voice Analysis API Endpoint
 * POST /api/analyze-voice
 * Body:
 *  - fid: number (required) - Farcaster user ID
 *  - username?: string (optional) - Username for display
 *  - topN?: number (optional, default: 20) - Number of top posts to analyze
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    
    console.log("[ANALYZE-VOICE] Environment check:", {
      hasNeynarKey: !!apiKey,
      hasDeepseekKey: !!deepseekKey
    })
    
    if (!apiKey) {
      console.error("[ANALYZE-VOICE] Missing NEYNAR_API_KEY")
      return NextResponse.json({ error: "Missing NEYNAR_API_KEY" }, { status: 500 })
    }
    
    if (!deepseekKey) {
      console.error("[ANALYZE-VOICE] Missing DEEPSEEK_API_KEY")
      return NextResponse.json({ error: "Missing DEEPSEEK_API_KEY" }, { status: 500 })
    }
    
    const body = await request.json().catch(() => ({}))
    const { fid, username, topN, fetchLimit } = body
    
    console.log("[ANALYZE-VOICE] Request:", { fid, username, topN, fetchLimit })
    
    if (!fid || typeof fid !== "number") {
      return NextResponse.json({ error: "FID is required and must be a number" }, { status: 400 })
    }

    // Validate topN if provided (default: 10)
    const topNValidated = topN && typeof topN === "number" && topN > 0 && topN <= 50 
      ? topN 
      : 10
    
    // Validate fetchLimit if provided (default: 100)
    const fetchLimitValidated = fetchLimit && typeof fetchLimit === "number" && fetchLimit > 0 && fetchLimit <= 500
      ? fetchLimit
      : 100
    
    // Analyze voice from successful posts
    const { analysis, profile, successfulPosts, stats } = await analyzeVoiceFromSuccessfulPosts({
      fid,
      username,
      neynarApiKey: apiKey,
      topN: topNValidated,
      fetchLimit: fetchLimitValidated,
    })
    
    console.log("[ANALYZE-VOICE] Success:", { 
      analysisLength: analysis.length, 
      stats,
      topPostsCount: successfulPosts.length
    })
    
    return NextResponse.json({
      success: true,
      analysis,
      user: {
        username: profile.username,
        display_name: profile.display_name,
        fid: profile.fid
      },
      successfulPosts: successfulPosts.map(post => ({
        hash: post.hash,
        text: post.text,
        engagementScore: post.engagementScore,
        totalEngagement: post.totalEngagement,
        timestamp: post.timestamp || post.created_at,
      })),
      stats
    })
    
  } catch (error) {
    console.error("[ANALYZE-VOICE] Error:", error)
    console.error("[ANALYZE-VOICE] Error stack:", error instanceof Error ? error.stack : "No stack")
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    )
  }
}
