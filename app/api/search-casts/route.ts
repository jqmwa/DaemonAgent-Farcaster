import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { query } = await req.json()

    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json({ error: "NEYNAR_API_KEY not configured" }, { status: 500 })
    }

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=50`,
      {
        headers: {
          accept: "application/json",
          api_key: process.env.NEYNAR_API_KEY,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Neynar API error:", errorData)
      return NextResponse.json({ error: errorData.message || "Failed to search casts" }, { status: response.status })
    }

    const data = await response.json()
    const casts = data.casts || []

    // Filter for political content if the query doesn't already specify it
    const politicalKeywords = [
      "politics",
      "political",
      "election",
      "vote",
      "government",
      "congress",
      "senate",
      "president",
      "democrat",
      "republican",
      "policy",
      "legislation",
    ]

    const filteredCasts = casts.filter((cast: any) => {
      const text = cast.text?.toLowerCase() || ""
      return politicalKeywords.some((keyword) => text.includes(keyword))
    })

    // Use filtered casts if we found any, otherwise return all results
    const finalCasts = filteredCasts.length > 0 ? filteredCasts.slice(0, 20) : casts.slice(0, 20)

    return NextResponse.json({
      casts: finalCasts,
    })
  } catch (error) {
    console.error("[v0] Error in search-casts:", error)
    return NextResponse.json({ error: "Failed to search casts" }, { status: 500 })
  }
}
