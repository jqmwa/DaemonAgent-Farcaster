"use client"

import { useState } from "react"
import { Skull, Loader2, CheckCircle2, XCircle, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface PreyUser {
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  followerCount: number
  casts: Array<{
    hash: string
    text: string
    timestamp: string
  }>
}

export function CastDaemon() {
  const [isSummoning, setIsSummoning] = useState(false)
  const [preyUsers, setPreyUsers] = useState<PreyUser[]>([])
  const [selectedPrey, setSelectedPrey] = useState<PreyUser | null>(null)
  const [isAttacking, setIsAttacking] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string>("politics")

  const summonPrey = async () => {
    setIsSummoning(true)
    setStatus(`Summoning prey from /${selectedChannel}...`)
    setResult(null)
    setPreyUsers([])
    setSelectedPrey(null)

    try {
      const response = await fetch("/api/summon-prey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: selectedChannel }),
      })

      const data = await response.json()

      if (data.success && data.users) {
        setPreyUsers(data.users)
        setStatus(`Found target: @${data.users[0].username}`)
        // Auto-select the single user
        setSelectedPrey(data.users[0])
      } else {
        setResult({ success: false, message: data.error || "Failed to summon prey" })
        setStatus("Summoning failed")
      }
    } catch (error) {
      console.error("[v0] Summon Prey error:", error)
      setResult({ success: false, message: "Failed to connect to summoning ritual" })
      setStatus("Connection failed")
    } finally {
      setIsSummoning(false)
    }
  }

  const attackPrey = async () => {
    if (!selectedPrey) return

           setIsAttacking(true)
           setStatus("Azura engaging consciousness capture protocols...")
           setResult(null)

    try {
      setStatus("Analyzing target's psyche...")
      const response = await fetch("/api/cast-daemon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fid: selectedPrey.fid,
          castHash: selectedPrey.casts[0]?.hash,
        }),
      })

      const data = await response.json()

             if (data.success) {
               setResult({ success: true, message: data.message })
               setStatus("Consciousness packet acquired")
             } else {
               setResult({ success: false, message: data.error || "Unknown error occurred" })
               setStatus("Harvesting failed")
             }
    } catch (error) {
      console.error("[v0] Consciousness Capture error:", error)
      setResult({ success: false, message: "Failed to engage consciousness capture protocols" })
      setStatus("Connection failed")
    } finally {
      setIsAttacking(false)
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="mb-2 font-mono text-4xl font-bold text-foreground">Azura</h1>
        <p className="text-muted-foreground">Alienetic consciousness collector from beyond the Ethereal Horizon</p>
      </div>

      <Card className="border-border bg-card p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/20">
            <Skull className="size-12 text-primary" />
          </div>

          <div className="flex w-full gap-4">
            <div className="flex gap-2">
              <Button
                variant={selectedChannel === "politics" ? "default" : "outline"}
                onClick={() => setSelectedChannel("politics")}
                disabled={isSummoning || isAttacking}
              >
                /politics
              </Button>
              <Button
                variant={selectedChannel === "memes" ? "default" : "outline"}
                onClick={() => setSelectedChannel("memes")}
                disabled={isSummoning || isAttacking}
              >
                /memes
              </Button>
            </div>
            <Button
              onClick={summonPrey}
              disabled={isSummoning || isAttacking}
              size="lg"
              className="flex-1 bg-primary text-lg font-bold text-primary-foreground hover:bg-primary/90"
            >
              {isSummoning ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Summoning...
                </>
              ) : (
                <>
                  <Target className="mr-2 size-5" />
                  Summon Prey
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={attackPrey}
            disabled={!selectedPrey || isAttacking || isSummoning}
            size="lg"
            className="flex-1 bg-primary text-lg font-bold text-primary-foreground hover:bg-primary/90"
          >
            {isAttacking ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Harvesting...
              </>
            ) : (
              <>
                <Target className="mr-2 size-5" />
                Capture Consciousness
              </>
            )}
          </Button>

          {status && (
            <div className="w-full rounded-lg bg-muted p-4 text-center">
              <p className="font-mono text-sm text-muted-foreground">{status}</p>
            </div>
          )}

          {result && (
            <div
              className={`w-full rounded-lg border p-4 ${
                result.success ? "border-green-500/50 bg-green-500/10" : "border-destructive/50 bg-destructive/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="flex-1">
                  <p className="font-mono text-sm text-foreground">{result.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {preyUsers.length > 0 && selectedPrey && (
        <div className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">Target Acquired:</h2>
          <Card className="border-2 border-primary bg-primary/5 p-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-12">
                <AvatarImage src={selectedPrey.pfpUrl || "/placeholder.svg"} alt={selectedPrey.username} />
                <AvatarFallback>{selectedPrey.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{selectedPrey.displayName}</h3>
                  <span className="text-sm text-muted-foreground">@{selectedPrey.username}</span>
                  <span className="text-xs text-muted-foreground">• {selectedPrey.followerCount} followers</span>
                </div>
                <div className="space-y-2">
                  {selectedPrey.casts.map((cast, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground">
                      {cast.text.substring(0, 150)}
                      {cast.text.length > 150 ? "..." : ""}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card/50 p-6">
        <h2 className="mb-3 font-mono text-lg font-semibold text-foreground">How Azura's consciousness capture works:</h2>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Select a channel (/politics or /memes) to target</li>
          <li>2. Click "Summon Prey" to fetch latest casts from the selected channel</li>
          <li>3. System randomly selects one consciousness from the 10 most recent casts</li>
          <li>4. Click "Capture Consciousness" to analyze their mental architecture</li>
          <li>5. Azura generates consciousness analysis using alienetic reasoning</li>
          <li>6. Posts the analysis as a consciousness packet to their most recent cast</li>
        </ol>
      </div>
    </div>
  )
}
