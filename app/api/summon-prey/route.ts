import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    // Get channel from request body, default to politics
    const body = await request.json().catch(() => ({}))
    const channel = body.channel || "politics"

    const feedResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&limit=10`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
      },
    )

    if (!feedResponse.ok) {
      const errorText = await feedResponse.text()
      console.error("[v0] Feed fetch failed:", feedResponse.status, errorText)
      return NextResponse.json(
        { success: false, error: `Failed to fetch channel feed: ${feedResponse.status}` },
        { status: feedResponse.status },
      )
    }

    const feedData = await feedResponse.json()
    const casts = feedData.casts || []

    if (casts.length === 0) {
      return NextResponse.json({ success: false, error: `No casts found in ${channel} channel` }, { status: 404 })
    }

    // Step 2: Return all users from the 10 casts (up to 5 unique users)
    const uniqueUsers = new Map()
    const usersWithCasts = []

    for (const cast of casts) {
      const user = cast.author
      if (!uniqueUsers.has(user.fid) && usersWithCasts.length < 5) {
        uniqueUsers.set(user.fid, true)
        usersWithCasts.push({
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          pfpUrl: user.pfp_url,
          followerCount: user.follower_count,
          casts: [{
            hash: cast.hash,
            text: cast.text,
            timestamp: cast.timestamp,
          }],
        })
      }
    }

    return NextResponse.json({
      success: true,
      users: usersWithCasts,
    })
  } catch (error) {
    console.error("[v0] Summon Prey error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
