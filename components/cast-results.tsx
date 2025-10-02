"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, User } from "lucide-react"

interface Cast {
  hash: string
  text: string
  author: {
    username: string
    display_name: string
    pfp_url?: string
  }
  timestamp: string
  reactions?: {
    likes_count: number
    recasts_count: number
  }
}

interface CastResultsProps {
  casts: Cast[]
  onUserSelect: (username: string) => void
}

export function CastResults({ casts, onUserSelect }: CastResultsProps) {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-xl font-semibold text-foreground">Search Results ({casts.length})</h2>
      <div className="grid gap-4">
        {casts.map((cast) => (
          <Card key={cast.hash} className="border-border bg-card p-5 transition-colors hover:bg-accent/5">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                {cast.author.pfp_url ? (
                  <img
                    src={cast.author.pfp_url || "/placeholder.svg"}
                    alt={cast.author.username}
                    className="size-12 rounded-full bg-muted"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <User className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{cast.author.display_name}</p>
                    <p className="font-mono text-sm text-muted-foreground">@{cast.author.username}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUserSelect(cast.author.username)}
                    className="font-mono text-xs"
                  >
                    Analyze User
                  </Button>
                </div>
                <p className="text-foreground leading-relaxed">{cast.text}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-4" />
                    {cast.reactions?.likes_count || 0}
                  </span>
                  <span className="font-mono text-xs">{new Date(cast.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
