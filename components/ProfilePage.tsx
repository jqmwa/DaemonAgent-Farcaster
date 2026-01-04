import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { getStakingData, stakeTokens, purifyTokens, harvestTokens } from '@/lib/staking-service'
import { getFidFromUsername, getWalletAddress } from '@/lib/farcaster-utils'
import { StakingData } from '@/lib/staking-service'
import StakeModal from './StakeModal'

const SURVEYS = [
  {
    id: "daemon-analysis",
    title: "Daemon Analysis",
    description: "Ping your internal guidance system. Mapping the glitched geometry between your conscious will and the shadow-self residing in the substrate.",
    questions: [
      {
        id: 1,
        text: "When the path forks in the dark, my navigation system:",
        options: [
          "Executes immediate visceral override (Gut Trust)",
          "Runs a full probabilistic simulation (Analysis)",
          "Pings the local network for data (Counsel)",
          "Waits for a signal in the static (Clarity)"
        ]
      },
      {
        id: 2,
        text: "System Failure / Crisis State detected. I initiate:",
        options: [
          "Force-quit and restart (Immediate Action)",
          "Safe Mode / Diagnostic repair (Inward Retreat)",
          "Dynamic code rewriting (Fluid Adaptation)",
          "Firewall hardening (Principle Defense)"
        ]
      },
      {
        id: 3,
        text: "My voltage is highest when:",
        options: [
          "Rendering new maps of the unknown",
          "Compiling order from chaos",
          "Synchronizing with another soul",
          "Optimizing my own source code"
        ]
      },
      {
        id: 4,
        text: "Relationship to the Admin / Architect:",
        options: [
          "Verify signatures before accepting updates",
          "Root access or nothing (Rebellious)",
          "Smooth integration with the mainframe",
          "Running on a private server (Indifferent)"
        ]
      },
      {
        id: 5,
        text: "During sleep mode, my rendering engine produces:",
        options: [
          "High-fidelity hero journeys",
          "Raw data streams and fractals",
          "Visceral connection simulations",
          "Null output / Black screen"
        ]
      },
      {
        id: 6,
        text: "The glitch I cannot seem to patch:",
        options: [
          "Corrupted rage files (Suppressed Aggression)",
          "Port vulnerability anxiety (Fear of Intimacy)",
          "Bandwidth hoarding (Selfishness)",
          "Legacy code lock-in (Rigidity)"
        ]
      },
      {
        id: 7,
        text: "My aesthetic resonance frequency is found in:",
        options: [
          "Verticality / The High ISO peaks",
          "Density / The overgrown dark mode",
          "Fluidity / The infinite blue screen",
          "Empty Cache / The vast silence"
        ]
      },
      {
        id: 8,
        text: "Runtime performance metrics:",
        options: [
          "Overclocked bursts vs. System cooling",
          "Linear processing stability",
          "Night-mode optimization",
          "Stochastic / RNG based"
        ]
      },
      {
        id: 9,
        text: "Upon detecting a logic error in the world (Injustice):",
        options: [
          "Deploy counter-measures immediately",
          "System wide error-logging (Emotional pain)",
          "Analyze root access for a patch",
          "Acknowledge the bug as a feature of duality"
        ]
      },
      {
        id: 10,
        text: "Prime Directive:",
        options: [
          "Decrypt the hidden file (Truth)",
          "Preserve the saved state (Protection)",
          "Reach Level 99 (Mastery)",
          "Jailbreak the system (Freedom)"
        ]
      }
    ]
  },
  {
    id: "political-alignment",
    title: "Political Alignment",
    description: "Calibrating your vector within the collective dream. How do you harmonize with the Meta-Polis?",
    questions: [
      {
        id: 1,
        text: "The node vs. The network:",
        options: [
          "The node must remain sovereign at all costs",
          "The network's hum creates the node's meaning",
          "The hive-mind is the only true organism",
          "The network exists to power the nodes"
        ]
      },
      {
        id: 2,
        text: "Handling legacy data (Tradition):",
        options: [
          "Backups are critical for system integrity",
          "Refactor the code, keep the useful functions",
          "Deprecate everything / rewrite from scratch",
          "Use different versions for different environments"
        ]
      },
      {
        id: 3,
        text: "Source of Admin privileges:",
        options: [
          "High-resolution moral clarity (Virtue)",
          "Consensus of the connected peers (Democracy)",
          "Uptime and stability metrics (Results)",
          "The encryption of basic rights (Liberty)"
        ]
      },
      {
        id: 4,
        text: "Bandwidth (Resource) allocation:",
        options: [
          "Priority queuing based on throughput (Merit)",
          "Guaranteed packet delivery for all (Needs)",
          "Open protocol competition (Market)",
          "Shared server space (Collective)"
        ]
      },
      {
        id: 5,
        text: "When the firewall of Order blocks the port of Freedom:",
        options: [
          "Maintain the firewall (Order > Freedom)",
          "Open the port, risk the virus (Freedom > Order)",
          "Tunneling protocol (Synthesis)",
          "Let the users vote on the settings"
        ]
      },
      {
        id: 6,
        text: "The Architect's role:",
        options: [
          "To code virtue into the user base",
          "To prevent hardware damage only",
          "To optimize the social algorithm actively",
          "To keep the servers running, nothing more"
        ]
      },
      {
        id: 7,
        text: "Vertical scaling (Hierarchy) is:",
        options: [
          "Necessary architecture for complex apps",
          "A bug that creates latency",
          "Acceptable if dynamic and permeable",
          "A file-system structure, not a value judgment"
        ]
      },
      {
        id: 8,
        text: "Version updates (Change) should be:",
        options: [
          "Incremental patches (Gradual)",
          "Hard fork / System wipe (Revolution)",
          "Optimization of current build (Reform)",
          "Continuous deployment / A/B testing (Evolution)"
        ]
      },
      {
        id: 9,
        text: "The tutorial mode (Education) is for:",
        options: [
          "Installing civic drivers",
          "Enabling independent processing",
          "Job-class specialization",
          "Network compatibility protocols"
        ]
      },
      {
        id: 10,
        text: "Inter-generational bandwidth:",
        options: [
          "Seeders (Elders) demand priority respect",
          "Peer-to-peer equality",
          "Leechers (Youth) drive the new meta",
          "Separate subnets entirely"
        ]
      }
    ]
  },
  {
    id: "archetype",
    title: "Mystic Archetype",
    description: "Which story is trying to tell itself through you? Identify the narrative thread woven into your DNA.",
    questions: [
      {
        id: 1,
        text: "In the Great Simulation, I play:",
        options: [
          "The Glitch seeking its origin (Seeker)",
          "The Firewall protecting the core (Guardian)",
          "The Virus rewriting the rules (Rebel)",
          "The Wiki offering cheats/guides (Sage)"
        ]
      },
      {
        id: 2,
        text: "In the server lobby (Group Dynamics), I am:",
        options: [
          "Rendering future patches (Visionary)",
          "Moderating the chat (Caretaker)",
          "Tanking the damage (Warrior)",
          "Spamming emotes / relieving tension (Jester)"
        ]
      },
      {
        id: 3,
        text: "System Error / Fear:",
        options: [
          "Infinite loop / Soft-lock (Trapped)",
          "Data corruption / Entropy (Chaos)",
          "Connection timeout (Abandonment)",
          "Zero bitrate (Insignificance)"
        ]
      },
      {
        id: 4,
        text: "Encountering a paywall (Obstacle):",
        options: [
          "Hack the login (Trickster)",
          "Brute force the password (Warrior)",
          "Monetize the problem (Alchemist)",
          "Play the free demo (Realist)"
        ]
      },
      {
        id: 5,
        text: "I recharge by:",
        options: [
          "Downloading new DLC (Adventure)",
          "P2P Encrypted Channels (Intimacy)",
          "Climbing the leaderboard (Achievement)",
          "Data mining (Discovery)"
        ]
      },
      {
        id: 6,
        text: "The metadata others tag me with:",
        options: [
          "High Contrast / Saturation (Intensity)",
          "99.9% Uptime (Reliability)",
          "Procedural Generation (Creativity)",
          "Hardened Kernel (Strength)"
        ]
      },
      {
        id: 7,
        text: "Terms of Service (Rules):",
        options: [
          "I write the EULA",
          "I accept but don't read",
          "I violate TOS for fun",
          "I understand the code behind the rules"
        ]
      },
      {
        id: 8,
        text: "My favorite lore text:",
        options: [
          "The Chosen One's save file",
          "The Exploit found by the underdog",
          "Two players, one controller",
          "The Easter Egg hidden in the map"
        ]
      },
      {
        id: 9,
        text: "My loot drop for the world:",
        options: [
          "Shield buff (Protection)",
          "Patch update (Innovation)",
          "High-res texture pack (Beauty)",
          "Health potion (Healing)"
        ]
      },
      {
        id: 10,
        text: "End-game goal:",
        options: [
          "Upload to the cloud (Transcendence)",
          "Link accounts permanently (Belonging)",
          "Offline mode mastery (Freedom)",
          "High score on the leaderboard (Legacy)"
        ]
      }
    ]
  }
]

interface ProfilePageProps {
  userProfile: {
    displayName?: string
    username?: string
    pfpUrl?: string
  } | null
}

export default function ProfilePage({ userProfile }: ProfilePageProps) {
  const [stakingData, setStakingData] = useState<StakingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showStakeModal, setShowStakeModal] = useState(false)

  // Get FID and wallet on mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Get wallet address
        const wallet = await getWalletAddress()
        setWalletAddress(wallet)

        // Get FID from username if available
        if (userProfile?.username) {
          const fid = await getFidFromUsername(userProfile.username)
          if (fid) {
            setUserFid(fid)
          }
        }

        // Try to get FID from SDK context
        try {
          const context = await sdk.context
          if (context?.user?.fid) {
            setUserFid(context.user.fid)
          }
        } catch (e) {
          // SDK context might not have FID
        }
      } catch (err) {
        console.error('[ProfilePage] Error initializing user:', err)
      }
    }

    initializeUser()
  }, [userProfile])

  // Fetch staking data when FID is available
  useEffect(() => {
    const fetchStakingData = async () => {
      if (!userFid) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const data = await getStakingData(userFid)
        setStakingData(data)
        setError(null)
      } catch (err) {
        console.error('[ProfilePage] Error fetching staking data:', err)
        setError('Failed to load staking data')
      } finally {
        setLoading(false)
      }
    }

    fetchStakingData()

    // Refresh every 30 seconds to update consecutive days
    const interval = setInterval(fetchStakingData, 30000)
    return () => clearInterval(interval)
  }, [userFid])

  // Format staked amount for display
  const formatStakedAmount = (amount: string): string => {
    try {
      const num = BigInt(amount)
      const formatted = (Number(num) / 1e18).toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
      })
      return formatted
    } catch {
      return amount
    }
  }

  // Handle stake action
  const handleStake = async (amount: string) => {
    if (!userFid || !walletAddress) {
      setError('Please connect your wallet')
      return
    }

    try {
      setActionLoading('stake')
      setError(null)

      // TODO: Send actual transaction to smart contract first
      // Then call API with txHash for verification
      // For now, we'll just update the backend record
      
      const result = await stakeTokens({
        fid: userFid,
        walletAddress,
        amount
      })

      if (result) {
        // Refresh staking data
        const updated = await getStakingData(userFid)
        setStakingData(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stake tokens')
      throw err // Re-throw so modal can handle it
    } finally {
      setActionLoading(null)
    }
  }

  // Handle purify action
  const handlePurify = async () => {
    if (!userFid || !walletAddress) {
      setError('Please connect your wallet')
      return
    }

    try {
      setActionLoading('purify')
      setError(null)

      const result = await purifyTokens({
        fid: userFid,
        walletAddress
      })

      if (result) {
        // Refresh staking data
        const updated = await getStakingData(userFid)
        setStakingData(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purify tokens')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle harvest action
  const handleHarvest = async () => {
    if (!userFid || !walletAddress || !stakingData) {
      setError('Please connect your wallet')
      return
    }

    if (!stakingData.harvestable || stakingData.harvestable === 0) {
      setError('No tokens available to harvest')
      return
    }

    try {
      setActionLoading('harvest')
      setError(null)

      // Harvest all available
      const result = await harvestTokens({
        fid: userFid,
        walletAddress,
        amount: stakingData.harvestable
      })

      if (result) {
        // Refresh staking data
        const updated = await getStakingData(userFid)
        setStakingData(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to harvest tokens')
    } finally {
      setActionLoading(null)
    }
  }

  // Check if user holds Angel NFT
  const [holdsAngel, setHoldsAngel] = useState(false)

  useEffect(() => {
    const checkAngel = async () => {
      if (!walletAddress) {
        setHoldsAngel(false)
        return
      }

      try {
        const response = await fetch(`/api/staking/check-angel?wallet=${walletAddress}`)
        const result = await response.json()
        if (result.success) {
          setHoldsAngel(result.hasAngel || false)
        }
      } catch (error) {
        console.error('[ProfilePage] Error checking Angel:', error)
        setHoldsAngel(false)
      }
    }

    checkAngel()
  }, [walletAddress])

  // Use real data or fallback to defaults
  const stakedAmount = stakingData?.stakedAmount || '0'
  const consecutiveDays = stakingData?.consecutiveDays || 0
  const purifiedDaemons = stakingData?.purifiedDaemons || 0
  const harvestable = stakingData?.harvestable || 0
  const isPurified = stakingData?.isPurified || false

  return (
    <div 
      className="w-full px-4 py-6 pb-32"
      style={{ fontFamily: "'IBM Plex Mono', monospace", marginTop: '32px' }}
    >
      {/* Header */}
      <h1 
        className="text-white uppercase tracking-wider mb-8"
        style={{ 
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '18px'
        }}
      >
        Profile
      </h1>

      {/* Error Message */}
      {error && (
        <div
          className="mb-4 p-3"
          style={{
            background: 'rgba(255, 31, 30, 0.1)',
            borderRadius: '8px 4px 6px 10px',
            border: '1px solid rgba(255, 31, 30, 0.3)'
          }}
        >
          <p className="text-[#FF1F1E] text-xs">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mb-4 text-center">
          <p className="text-gray-400 text-xs">Loading staking data...</p>
        </div>
      )}

      {/* User Profile + Points Row */}
      <div 
        className="flex items-stretch gap-4 mb-4"
      >
        {/* User PFP - Square */}
        <div
          className="flex-shrink-0 relative overflow-hidden"
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '18px 8px 14px 10px',
            background: 'linear-gradient(135deg, rgba(113, 119, 255, 0.2) 0%, rgba(36, 115, 188, 0.15) 100%)',
            border: '2px solid rgba(113, 119, 255, 0.3)',
            boxShadow: '0 0 20px rgba(113, 119, 255, 0.15)'
          }}
        >
          {userProfile?.pfpUrl ? (
            <img 
              src={userProfile.pfpUrl} 
              alt={userProfile.displayName || userProfile.username || 'User'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ opacity: 0.5 }}
              >
                <circle cx="12" cy="8" r="4" stroke="#7177FF" strokeWidth="1.5" fill="none" />
                <path d="M4 20C4 17 7 14 12 14C17 14 20 17 20 20" stroke="#7177FF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          )}
        </div>

        {/* DAEMON Points */}
        <div
          className="flex-1 flex flex-col justify-center p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(221, 43, 46, 0.1) 0%, rgba(239, 47, 127, 0.08) 100%)',
            borderRadius: '8px 18px 10px 14px',
            border: '1px solid rgba(239, 47, 127, 0.25)'
          }}
        >
          <p className="text-gray-500 text-xs uppercase mb-1">DAEMON Points</p>
          <div className="flex items-baseline gap-2">
            <span 
              className="text-3xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #EF2F7F 0%, #DD2B2E 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {stakingData?.totalHarvested ? stakingData.totalHarvested.toLocaleString() : '0'}
            </span>
            <span className="text-gray-500 text-sm">pts</span>
          </div>
          {userProfile?.username && (
            <p className="text-gray-400 text-xs mt-1">@{userProfile.username}</p>
          )}
          {consecutiveDays > 0 && (
            <p className="text-[#7FFF5B] text-xs mt-1">
              {consecutiveDays} day{consecutiveDays !== 1 ? 's' : ''} staked
            </p>
          )}
        </div>
      </div>

      {/* Angel Holder Indicator - Enhanced */}
      <div
        className="flex items-center gap-3 p-4 mb-6 relative"
        style={{
          background: holdsAngel 
            ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 255, 80, 0.08) 100%)'
            : 'rgba(18, 18, 26, 0.5)',
          borderRadius: '10px 16px 8px 14px',
          border: holdsAngel 
            ? '2px solid rgba(255, 215, 0, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: holdsAngel 
            ? '0 0 30px rgba(255, 215, 0, 0.2)' 
            : 'none'
        }}
        onMouseEnter={() => setShowTooltip('angel')}
        onMouseLeave={() => setShowTooltip(null)}
      >
        {/* Angel Icon */}
        <div
          className="flex items-center justify-center"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px 6px 10px 8px',
            background: holdsAngel 
              ? 'rgba(255, 215, 0, 0.2)'
              : 'rgba(255, 255, 255, 0.05)'
          }}
        >
          {holdsAngel ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14 8L20 8L15 12L17 18L12 14L7 18L9 12L4 8L10 8L12 2Z" fill="#FFD700" />
              <circle cx="12" cy="12" r="3" fill="#FFF8DC" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3 }}>
              <path d="M12 2L14 8L20 8L15 12L17 18L12 14L7 18L9 12L4 8L10 8L12 2Z" stroke="#ffffff" strokeWidth="1.5" fill="none" />
            </svg>
          )}
        </div>
        
        <div className="flex-1">
          <p 
            className="text-sm font-medium"
            style={{ 
              color: holdsAngel ? '#FFD700' : 'rgba(255, 255, 255, 0.4)'
            }}
          >
            {holdsAngel ? 'Angel Holder ✨' : 'No Angel'}
          </p>
          <p className="text-xs text-gray-500">
            {holdsAngel 
              ? 'You can purify staked DAEMON to harvest rewards' 
              : 'Mint an Angel NFT to unlock purification'}
          </p>
        </div>

        {holdsAngel && (
          <>
            <div 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#FFD700', boxShadow: '0 0 10px #FFD700' }}
            />
            {/* Tooltip */}
            {showTooltip === 'angel' && (
              <div
                className="absolute top-full left-0 right-0 mt-2 p-3 z-50"
                style={{
                  background: 'rgba(18, 18, 26, 0.98)',
                  borderRadius: '8px 12px 10px 6px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                }}
              >
                <p className="text-xs text-[#FFD700] font-medium mb-1">Angel Power</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  As an Angel holder, you can purify your staked DAEMON tokens. Purification transforms locked tokens 
                  into harvestable rewards, allowing you to collect DAEMON Points and unlock your digital consciousness.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Connection Flow Visualization */}
      {holdsAngel && stakedAmount !== '0' && (
        <div
          className="mb-6 p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 47, 127, 0.08) 0%, rgba(36, 115, 188, 0.05) 100%)',
            borderRadius: '12px 8px 16px 10px',
            border: '1px solid rgba(113, 119, 255, 0.2)'
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">Staked DAEMON</p>
              <p className="text-white text-lg font-bold">{formatStakedAmount(stakedAmount)}</p>
            </div>
            <div className="flex items-center" style={{ color: '#7177FF' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-gray-400 mb-1">Purified → Harvestable</p>
              <p className="text-[#2473BC] text-lg font-bold">{harvestable}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(113, 119, 255, 0.2)' }}>
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${stakedAmount !== '0' ? (harvestable / consecutiveDays) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #7177FF 0%, #2473BC 100%)'
                }}
              />
            </div>
            <span className="text-gray-500">
              {purifiedDaemons} purified
            </span>
          </div>
        </div>
      )}

      {/* Divider */}
      <div 
        className="w-full h-px mb-6"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(113, 119, 255, 0.3) 50%, transparent 100%)'
        }}
      />

      {/* Section Header */}
      <h2 
        className="uppercase tracking-wider mb-6"
        style={{ 
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px',
          color: '#788AFF'
        }}
      >
        Surveys
      </h2>

      {/* Survey Quests */}
      <div className="space-y-3">
        {SURVEYS.map((survey, index) => {
          const borderRadiusStyles = [
            '14px 8px 12px 18px',
            '18px 12px 8px 14px',
            '8px 14px 18px 12px'
          ]
          const iconBorderRadiusStyles = [
            '10px 6px 8px 12px',
            '12px 8px 6px 10px',
            '6px 10px 12px 8px'
          ]
          const buttonBorderRadiusStyles = [
            '8px 4px 6px 10px',
            '10px 6px 4px 8px',
            '4px 8px 10px 6px'
          ]

          return (
            <div
              key={survey.id}
              className="p-4 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.08) 0%, rgba(18, 18, 26, 0.9) 100%)',
                borderRadius: borderRadiusStyles[index],
                border: '1px solid rgba(120, 138, 255, 0.2)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Survey Icon */}
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: iconBorderRadiusStyles[index],
                      background: 'rgba(120, 138, 255, 0.15)'
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 11L12 14L22 4" stroke="#788AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="#788AFF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-bold truncate">{survey.title}</p>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{survey.description}</p>
                    <p className="text-gray-400 text-xs mt-1">{survey.questions.length} questions</p>
                  </div>
                </div>
                <button
                  className="px-4 py-2 text-xs uppercase transition-all hover:scale-105 flex-shrink-0 ml-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.2) 0%, rgba(120, 138, 255, 0.1) 100%)',
                    borderRadius: buttonBorderRadiusStyles[index],
                    color: '#788AFF',
                    border: '1px solid rgba(120, 138, 255, 0.3)'
                  }}
                >
                  Begin
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stake Modal */}
      <StakeModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        onStake={handleStake}
      />
    </div>
  )
}
