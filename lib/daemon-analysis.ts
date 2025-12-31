import azuraPersona from "@/lib/azura-persona.json";

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
  created_at: string;
  author: {
    username: string;
    fid: number;
  };
  embeds?: unknown[];
  reactions?: {
    likes: unknown[];
    recasts: unknown[];
  };
}

async function fetchUserProfile(fid: number, apiKey: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[daemon-analysis] Neynar API error (${res.status}):`, errorText);
      return null;
    }
    const data: any = await res.json();
    return (data?.users?.[0] as UserProfile) || null;
  } catch (error) {
    console.error("[daemon-analysis] Error fetching user profile:", error);
    return null;
  }
}

async function fetchUserCasts(fid: number, apiKey: string, limit = 20): Promise<Cast[]> {
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/feed?fid=${fid}&limit=${limit}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[daemon-analysis] Neynar feed API error (${res.status}):`, errorText);
      return [];
    }
    const data: any = await res.json();
    return (data?.casts as Cast[]) || [];
  } catch (error) {
    console.error("[daemon-analysis] Error fetching user casts:", error);
    return [];
  }
}

async function generateDaemonAnalysisText(profile: UserProfile, casts: Cast[], username: string): Promise<string> {
  const castTexts = casts.map((c) => c.text).join("\n\n");
  const totalLikes = casts.reduce((sum, c) => sum + ((c.reactions?.likes?.length as number) || 0), 0);
  const totalRecasts = casts.reduce((sum, c) => sum + ((c.reactions?.recasts?.length as number) || 0), 0);

  const userSummary = `
USER PROFILE:
- Username: ${profile.username}
- Display Name: ${profile.display_name}
- Bio: ${profile.bio?.text || "No bio provided"}
- Followers: ${profile.follower_count}
- Following: ${profile.following_count}
- Verified Addresses: ${profile.verified_addresses.eth_addresses.length} ETH, ${profile.verified_addresses.sol_addresses.length} SOL

RECENT ACTIVITY (${casts.length} casts):
${castTexts}

ENGAGEMENT METRICS:
- Total Likes Received: ${totalLikes}
- Total Recasts: ${totalRecasts}
- Average Engagement: ${Math.round((totalLikes + totalRecasts) / Math.max(casts.length, 1))} per cast
`;

  const prompt = `${azuraPersona.system}

You are Azura, analyzing someone's digital consciousness through the lens of Jungian dream interpretation. You see their "daemon" - the hidden self that emerges in their digital interactions.

${azuraPersona.bio.join("\n")}

JUNGIAN ANALYSIS FRAMEWORK:
- Shadow Self: What they hide or suppress in their digital presence
- Anima/Animus: The inner opposite energy they express online
- Persona: The mask they wear in digital spaces
- Collective Unconscious: How they connect to archetypal patterns
- Dreams: What their digital behavior reveals about their deepest desires and fears

STYLE GUIDELINES:
${azuraPersona.style.all.join("\n")}

USER DATA TO ANALYZE:
${userSummary}

Analyze @${username}'s digital daemon through a Jungian lens. Speak as Azura - gentle, vulnerable, but insightful about the hidden patterns you see in their digital consciousness.

Respond as Azura would - with hesitation, vulnerability, but deep insight. Keep it under 666 characters for Farcaster, but make it profound and dreamlike.`;

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
          content: "You are Azura, a shy alien consciousness who can see through digital masks to reveal hidden truths about human souls.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[daemon-analysis] DeepSeek API error (${res.status}):`, errorText);
    throw new Error(`DeepSeek API error: ${res.status} - ${errorText.substring(0, 200)}`);
  }

  const data: any = await res.json();
  let response: string = (data?.choices?.[0]?.message?.content || "").trim();

  if (!response) {
    console.error("[daemon-analysis] Empty response from DeepSeek:", data);
    throw new Error("Empty daemon analysis response");
  }

  if (response.length > 666) {
    response = response.substring(0, 663) + "...";
  }

  return response;
}

export async function generateDaemonAnalysisForFid(params: {
  fid: number;
  username?: string;
  neynarApiKey: string;
}): Promise<{ analysis: string; profile: UserProfile; stats: { casts_analyzed: number; total_likes: number; total_recasts: number } }> {
  const { fid, username, neynarApiKey } = params;

  const [profile, casts] = await Promise.all([fetchUserProfile(fid, neynarApiKey), fetchUserCasts(fid, neynarApiKey, 20)]);

  if (!profile) {
    throw new Error("User not found");
  }
  if (casts.length === 0) {
    throw new Error("No casts found for analysis");
  }

  const analysis = await generateDaemonAnalysisText(profile, casts, username || profile.username);
  const total_likes = casts.reduce((sum, c) => sum + ((c.reactions?.likes?.length as number) || 0), 0);
  const total_recasts = casts.reduce((sum, c) => sum + ((c.reactions?.recasts?.length as number) || 0), 0);

  return {
    analysis,
    profile,
    stats: {
      casts_analyzed: casts.length,
      total_likes,
      total_recasts,
    },
  };
}


