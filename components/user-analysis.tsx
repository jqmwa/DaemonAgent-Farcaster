"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Brain, Send, MessageSquare } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface UserAnalysisProps {
  username: string
}

export function UserAnalysis({ username }: UserAnalysisProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [userCasts, setUserCasts] = useState<any[]>([])
  const [analysis, setAnalysis] = useState("")
  const [response, setResponse] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [selectedCastHash, setSelectedCastHash] = useState<string | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [username])

  const fetchUserData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/analyze-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })

      const data = await response.json()
      setUserCasts(data.casts || [])
      setAnalysis(data.analysis || "")
    } catch (error) {
      console.error("[v0] Error fetching user data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateResponse = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/generate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          analysis,
          casts: userCasts,
          customPrompt,
        }),
      })

      const data = await response.json()
      setResponse(data.response || "")
    } catch (error) {
      console.error("[v0] Error generating response:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const postReply = async (castHash: string) => {
    if (!response) return

    setIsPosting(true)
    setSelectedCastHash(castHash)
    try {
      const result = await fetch("/api/post-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: response,
          parentHash: castHash,
        }),
      })

      const data = await result.json()
      if (data.success) {
        alert("Reply posted successfully!")
      } else {
        alert(`Failed to post reply: ${data.error}`)
      }
    } catch (error) {
      console.error("[v0] Error posting reply:", error)
      alert("Failed to post reply")
    } finally {
      setIsPosting(false)
      setSelectedCastHash(null)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="font-mono text-muted-foreground">Analyzing @{username}'s cast history...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-xl font-semibold text-foreground">User Analysis: @{username}</h2>

      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="size-5 text-primary" />
          <h3 className="font-mono font-semibold text-foreground">Psychological Profile</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Analyzed {userCasts.length} recent casts</p>
          </div>
          <p className="text-foreground leading-relaxed">{analysis}</p>
        </div>
      </Card>

      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Send className="size-5 text-accent" />
          <h3 className="font-mono font-semibold text-foreground">Generate Introspective Response</h3>
        </div>
        <div className="space-y-4">
          <Textarea
            placeholder="Optional: Add specific angle or topic to focus on..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="min-h-[100px] font-mono text-sm"
          />
          <Button
            onClick={generateResponse}
            disabled={isGenerating}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating Response...
              </>
            ) : (
              "Generate Response"
            )}
          </Button>

          {response && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-primary">
                Suggested Response
              </p>
              <p className="text-foreground leading-relaxed">{response}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="border-border bg-card p-6">
        <h3 className="mb-4 font-mono font-semibold text-foreground">Recent Casts ({userCasts.length})</h3>
        <div className="space-y-3">
          {userCasts.slice(0, 10).map((cast, index) => (
            <div key={cast.hash || index} className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-foreground">{cast.text}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(cast.timestamp).toLocaleDateString()}
                </p>
                {response && cast.hash && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => postReply(cast.hash)}
                    disabled={isPosting}
                    className="gap-2"
                  >
                    {isPosting && selectedCastHash === cast.hash ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="size-3" />
                        Reply to this cast
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
