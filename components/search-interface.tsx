"use client"

import { useState } from "react"
import { Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { CastResults } from "@/components/cast-results"
import { UserAnalysis } from "@/components/user-analysis"

export function SearchInterface() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [casts, setCasts] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch("/api/search-casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      })

      const data = await response.json()
      setCasts(data.casts || [])
    } catch (error) {
      console.error("[v0] Error searching casts:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleUserSelect = (username: string) => {
    setSelectedUser(username)
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search political casts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 font-mono"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Searching
              </>
            ) : (
              "Search"
            )}
          </Button>
        </div>
      </Card>

      {casts.length > 0 && <CastResults casts={casts} onUserSelect={handleUserSelect} />}

      {selectedUser && <UserAnalysis username={selectedUser} />}
    </div>
  )
}
