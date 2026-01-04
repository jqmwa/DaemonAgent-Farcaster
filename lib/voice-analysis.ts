/**
 * Voice Analysis - Analyze most successful posts to identify consistent voice
 * 
 * This module analyzes a user's most successful posts (by engagement)
 * to identify consistent voice patterns, tone, themes, and writing style.
 */

export interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  bio?: { text: string };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
}

export interface Cast {
  hash: string;
  text: string;
  created_at?: string;
  timestamp?: string;
  parent_hash?: string | null;
  parent?: {
    hash?: string;
  };
  author: {
    username: string;
    fid: number;
  };
  embeds?: unknown[];
  reactions?: {
    likes: unknown[];
    recasts: unknown[];
    likes_count?: number;
    recasts_count?: number;
  };
  replies?: {
    count?: number;
  };
}

interface SuccessfulPost extends Cast {
  engagementScore: number;
  totalEngagement: number;
}

async function fetchUserProfile(fid: number, apiKey: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[voice-analysis] Neynar API error (${res.status}):`, errorText);
      return null;
    }
    const data: any = await res.json();
    return (data?.users?.[0] as UserProfile) || null;
  } catch (error) {
    console.error("[voice-analysis] Error fetching user profile:", error);
    return null;
  }
}

async function fetchUserCasts(fid: number, apiKey: string, targetLimit = 100): Promise<Cast[]> {
  try {
    const userOriginalCasts: Cast[] = [];
    let cursor: string | null = null;
    const maxPerRequest = 100; // API limit per request
    let totalFetched = 0;
    const maxTotalFetches = 500; // Safety limit to prevent infinite loops
    
    // Use pagination to fetch multiple pages until we have enough user's own casts
    while (userOriginalCasts.length < targetLimit && totalFetched < maxTotalFetches) {
      // Build URL with cursor for pagination
      let url = `https://api.neynar.com/v2/farcaster/feed?fid=${fid}&limit=${maxPerRequest}`;
      if (cursor) {
        url += `&cursor=${cursor}`;
      }
      
      const res = await fetch(url, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[voice-analysis] Neynar feed API error (${res.status}):`, errorText);
        break; // Stop pagination on error
      }
      
      const data: any = await res.json();
      const allCasts = (data?.casts as Cast[]) || [];
      totalFetched += allCasts.length;
      
      // Filter to only casts CREATED BY this user (author FID matches)
      // AND only original casts (no parent_hash = top-level posts, not replies)
      const pageUserCasts = allCasts.filter((cast: any) => {
        // First check: cast must be by this user
        const castAuthorFid = cast.author?.fid;
        if (castAuthorFid !== fid) {
          return false; // Not by this user
        }
        // Second check: must be an original cast (no parent_hash)
        return !cast.parent_hash && !cast.parent?.hash;
      });
      
      userOriginalCasts.push(...pageUserCasts);
      
      // Check if we have enough or if there's no more data
      if (userOriginalCasts.length >= targetLimit) {
        break; // We have enough
      }
      
      // Get next cursor for pagination
      cursor = data?.next?.cursor || null;
      if (!cursor || allCasts.length === 0) {
        break; // No more pages
      }
      
      console.log(`[voice-analysis] Fetched page: ${allCasts.length} total casts, ${pageUserCasts.length} user's original casts (${userOriginalCasts.length}/${targetLimit} total)`);
    }
    
    // Sort by timestamp (newest first) and limit to target
    const sortedCasts = userOriginalCasts
      .sort((a: any, b: any) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 
                      a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 
                      b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA; // Newest first
      })
      .slice(0, targetLimit);
    
    console.log(`[voice-analysis] Fetched ${totalFetched} total casts from feed, filtered to ${sortedCasts.length} original casts by FID ${fid}`);
    
    return sortedCasts;
  } catch (error) {
    console.error("[voice-analysis] Error fetching user casts:", error);
    return [];
  }
}

/**
 * Calculate engagement score for a cast
 * Higher score = more successful post
 */
function calculateEngagementScore(cast: Cast): number {
  const likes = cast.reactions?.likes_count || (cast.reactions?.likes?.length as number) || 0;
  const recasts = cast.reactions?.recasts_count || (cast.reactions?.recasts?.length as number) || 0;
  const replies = cast.replies?.count || 0;
  
  // Weighted engagement: likes (1x), recasts (2x), replies (3x)
  const totalEngagement = likes + (recasts * 2) + (replies * 3);
  
  // Time decay: newer posts get slight boost
  const castTime = cast.timestamp ? new Date(cast.timestamp).getTime() : 
                   cast.created_at ? new Date(cast.created_at).getTime() : Date.now();
  const daysSincePost = (Date.now() - castTime) / (1000 * 60 * 60 * 24);
  const timeDecay = Math.max(0.8, 1 - (daysSincePost / 365)); // Slight boost for posts < 1 year old
  
  return totalEngagement * timeDecay;
}

/**
 * Identify the most successful posts from a list of casts
 */
function identifySuccessfulPosts(casts: Cast[], topN = 20): SuccessfulPost[] {
  const postsWithScores: SuccessfulPost[] = casts
    .filter(cast => cast.text && cast.text.trim().length > 0) // Only posts with text
    .map(cast => {
      const engagementScore = calculateEngagementScore(cast);
      const likes = cast.reactions?.likes_count || (cast.reactions?.likes?.length as number) || 0;
      const recasts = cast.reactions?.recasts_count || (cast.reactions?.recasts?.length as number) || 0;
      const replies = cast.reactions?.recasts_count || 0;
      const totalEngagement = likes + recasts + replies;
      
      return {
        ...cast,
        engagementScore,
        totalEngagement,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore) // Sort by engagement score
    .slice(0, topN); // Take top N
  
  return postsWithScores;
}

/**
 * Generate voice analysis from successful posts
 */
async function generateVoiceAnalysis(
  profile: UserProfile,
  successfulPosts: SuccessfulPost[],
  username: string
): Promise<string> {
  const postsText = successfulPosts
    .map((post, index) => {
      const likes = post.reactions?.likes_count || (post.reactions?.likes?.length as number) || 0;
      const recasts = post.reactions?.recasts_count || (post.reactions?.recasts?.length as number) || 0;
      const replies = post.replies?.count || 0;
      return `[Post #${index + 1} - Engagement: ${post.totalEngagement} (${likes} likes, ${recasts} recasts, ${replies} replies)]\n${post.text}`;
    })
    .join("\n\n---\n\n");

  const userSummary = `
USER PROFILE:
- Username: ${profile.username}
- Display Name: ${profile.display_name}
- Bio: ${profile.bio?.text || "No bio provided"}
- Followers: ${profile.follower_count}
- Following: ${profile.following_count}

TOP ${successfulPosts.length} MOST SUCCESSFUL POSTS (by engagement):
${postsText}

ENGAGEMENT STATISTICS:
- Average engagement per top post: ${Math.round(
  successfulPosts.reduce((sum, p) => sum + p.totalEngagement, 0) / successfulPosts.length
)}
- Highest engagement: ${Math.max(...successfulPosts.map(p => p.totalEngagement))}
- Lowest engagement (in top posts): ${Math.min(...successfulPosts.map(p => p.totalEngagement))}
`;

  const prompt = `You are a professional content analyst specializing in identifying voice patterns and writing styles.

TASK: Analyze the most successful posts from @${username} to identify their CONSISTENT VOICE - the patterns, tone, themes, and style that appear across their most engaging content.

ANALYSIS FRAMEWORK:
1. **Tone & Style**: What is the consistent tone? (e.g., casual, professional, humorous, serious, poetic, technical)
2. **Language Patterns**: What words, phrases, or linguistic patterns repeat? (e.g., specific terminology, sentence structure, punctuation style)
3. **Themes & Topics**: What subjects or themes appear most frequently in successful posts?
4. **Engagement Drivers**: What elements make these posts successful? (e.g., questions, storytelling, hot takes, educational content)
5. **Voice Consistency**: What makes this voice unique and recognizable across posts?
6. **Writing Techniques**: What rhetorical devices or writing techniques are consistently used? (e.g., metaphors, lists, questions, bold statements)

OUTPUT FORMAT:
Provide a comprehensive analysis in clear sections. Be specific and cite examples from the posts. Focus on what is CONSISTENT across the successful posts, not what varies.

USER DATA TO ANALYZE:
${userSummary}

Analyze @${username}'s consistent voice across their most successful posts. Be thorough, specific, and provide actionable insights.`;

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

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
          content: "You are a professional content analyst who identifies voice patterns and writing styles. Provide detailed, specific analysis with examples.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7, // Lower temperature for more consistent analysis
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[voice-analysis] DeepSeek API error (${res.status}):`, errorText);
    throw new Error(`DeepSeek API error: ${res.status} - ${errorText.substring(0, 200)}`);
  }

  const data: any = await res.json();
  let response: string = (data?.choices?.[0]?.message?.content || "").trim();

  if (!response) {
    console.error("[voice-analysis] Empty response from DeepSeek:", data);
    throw new Error("Empty voice analysis response");
  }

  return response;
}

export interface VoiceAnalysisResult {
  analysis: string;
  profile: UserProfile;
  successfulPosts: SuccessfulPost[];
  stats: {
    total_posts_analyzed: number;
    top_posts_count: number;
    average_engagement: number;
    highest_engagement: number;
    lowest_engagement_in_top: number;
  };
}

/**
 * Main function: Analyze voice from most successful posts
 */
export async function analyzeVoiceFromSuccessfulPosts(params: {
  fid: number;
  username?: string;
  neynarApiKey: string;
  topN?: number; // Number of top posts to analyze (default: 10)
  fetchLimit?: number; // Number of casts to fetch for analysis (default: 100)
}): Promise<VoiceAnalysisResult> {
  const { fid, username, neynarApiKey, topN = 10, fetchLimit = 100 } = params;

  console.log(`[voice-analysis] Starting analysis for FID ${fid}...`);
  console.log(`[voice-analysis] Will fetch up to ${fetchLimit} casts and analyze top ${topN} performers`);
  
  // Fetch user profile and casts in parallel
  const [profile, casts] = await Promise.all([
    fetchUserProfile(fid, neynarApiKey),
    fetchUserCasts(fid, neynarApiKey, fetchLimit), // Fetch up to fetchLimit casts with pagination
  ]);

  if (!profile) {
    throw new Error("User not found");
  }
  if (casts.length === 0) {
    throw new Error("No casts found for analysis");
  }

  console.log(`[voice-analysis] Fetched ${casts.length} casts from @${profile.username}`);

  // Identify most successful posts
  const successfulPosts = identifySuccessfulPosts(casts, topN);
  console.log(`[voice-analysis] Identified ${successfulPosts.length} most successful posts`);

  // Generate voice analysis
  const analysis = await generateVoiceAnalysis(
    profile,
    successfulPosts,
    username || profile.username
  );

  // Calculate statistics
  const totalEngagement = successfulPosts.reduce((sum, p) => sum + p.totalEngagement, 0);
  const averageEngagement = Math.round(totalEngagement / successfulPosts.length);
  const highestEngagement = Math.max(...successfulPosts.map(p => p.totalEngagement));
  const lowestEngagement = Math.min(...successfulPosts.map(p => p.totalEngagement));

  return {
    analysis,
    profile,
    successfulPosts,
    stats: {
      total_posts_analyzed: casts.length,
      top_posts_count: successfulPosts.length,
      average_engagement: averageEngagement,
      highest_engagement: highestEngagement,
      lowest_engagement_in_top: lowestEngagement,
    },
  };
}
