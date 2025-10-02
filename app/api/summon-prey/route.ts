import { NextResponse } from "next/server"

export async function POST() {
  try {
    const apiKey = process.env.NEYNAR_API_KEY

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    const feedResponse = await fetch(
      "https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=channel_id&channel_id=politics&with_recasts=false&limit=50",
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
      return NextResponse.json({ success: false, error: "No casts found in politics channel" }, { status: 404 })
    }

    const castsByAuthor = new Map<number, any[]>()

    for (const cast of casts) {
      const fid = cast.author.fid
      if (!castsByAuthor.has(fid)) {
        castsByAuthor.set(fid, [])
      }
      castsByAuthor.get(fid)!.push(cast)
    }

    // Convert to array and shuffle
    const authors = Array.from(castsByAuthor.entries())
    const shuffled = authors.sort(() => Math.random() - 0.5)
    const selectedAuthors = shuffled.slice(0, 5)

    // Format the response
    const usersWithCasts = selectedAuthors.map(([fid, authorCasts]) => {
      const author = authorCasts[0].author
      return {
        fid: author.fid,
        username: author.username,
        displayName: author.display_name,
        pfpUrl: author.pfp_url,
        followerCount: author.follower_count,
        casts: authorCasts.slice(0, 3).map((cast: any) => ({
          hash: cast.hash,
          text: cast.text,
          timestamp: cast.timestamp,
        })),
      }
    })

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
