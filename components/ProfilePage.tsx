import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { getStakingData, stakeTokens, purifyTokens, harvestTokens } from '@/lib/staking-service'
import { getFidFromUsername, getWalletAddress } from '@/lib/farcaster-utils'
import { StakingData } from '@/lib/staking-service'
import StakeModal from './StakeModal'

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
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
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
        className="text-[#7177FF] uppercase tracking-wider mb-6"
        style={{ 
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px'
        }}
      >
        Your DAEMONs
      </h2>

      {/* Staking Stats */}
      <div className="space-y-3">
        {/* Staked DAEMON */}
        <div
          className="p-4 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(113, 119, 255, 0.08) 0%, rgba(18, 18, 26, 0.9) 100%)',
            borderRadius: '14px 8px 12px 18px',
            border: '1px solid rgba(113, 119, 255, 0.2)'
          }}
          onMouseEnter={() => setShowTooltip('stake')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Lock Icon */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px 6px 8px 12px',
                  background: 'rgba(113, 119, 255, 0.15)'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="#7177FF" strokeWidth="1.5" fill="none" />
                  <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#7177FF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  <circle cx="12" cy="16" r="1.5" fill="#7177FF" />
                </svg>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase">Staked DAEMON</p>
                <p className="text-white text-xl font-bold">{formatStakedAmount(stakedAmount)}</p>
                {consecutiveDays > 0 && (
                  <p className="text-[#7FFF5B] text-xs mt-1">{consecutiveDays} consecutive day{consecutiveDays !== 1 ? 's' : ''}</p>
                )}
                {!holdsAngel && stakedAmount !== '0' && (
                  <p className="text-gray-500 text-xs mt-1">Locked until purified</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowStakeModal(true)}
              disabled={actionLoading === 'stake' || !walletAddress}
              className="px-4 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(113, 119, 255, 0.2) 0%, rgba(113, 119, 255, 0.1) 100%)',
                borderRadius: '8px 4px 6px 10px',
                color: '#7177FF',
                border: '1px solid rgba(113, 119, 255, 0.3)'
              }}
            >
              {actionLoading === 'stake' ? 'Staking...' : 'Stake'}
            </button>
          </div>
          {showTooltip === 'stake' && (
            <div
              className="absolute top-full left-0 right-0 mt-2 p-3 z-50"
              style={{
                background: 'rgba(18, 18, 26, 0.98)',
                borderRadius: '8px 12px 10px 6px',
                border: '1px solid rgba(113, 119, 255, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              <p className="text-xs text-[#7177FF] font-medium mb-1">Staking Explained</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                Staking locks your $DAEMON tokens to earn passive rewards. Each consecutive day staked = 1 purified daemon (if you have an Angel). 
                Unstaking resets your streak.
              </p>
            </div>
          )}
        </div>

        {/* Purified DAEMONs - Show connection to harvesting */}
        {holdsAngel && purifiedDaemons > 0 && (
          <div
            className="p-4 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 47, 127, 0.08) 0%, rgba(18, 18, 26, 0.9) 100%)',
              borderRadius: '18px 12px 8px 14px',
              border: '2px solid rgba(239, 47, 127, 0.3)'
            }}
            onMouseEnter={() => setShowTooltip('purify')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Purified Icon */}
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px 8px 6px 10px',
                    background: 'rgba(239, 47, 127, 0.2)'
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L13.5 6.5L18 8L13.5 9.5L12 14L10.5 9.5L6 8L10.5 6.5L12 2Z" fill="#EF2F7F" />
                    <path d="M5 14L5.75 16.25L8 17L5.75 17.75L5 20L4.25 17.75L2 17L4.25 16.25L5 14Z" fill="#EF2F7F" style={{ opacity: 0.7 }} />
                    <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z" fill="#EF2F7F" style={{ opacity: 0.7 }} />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">Purified DAEMONs</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-white text-xl font-bold">{purifiedDaemons}</p>
                    <span className="text-gray-500 text-sm">collected</span>
                  </div>
                  <p className="text-[#2473BC] text-xs mt-1">→ {harvestable} ready to harvest</p>
                </div>
              </div>
              <button
                onClick={handlePurify}
                disabled={actionLoading === 'purify' || isPurified || !walletAddress}
                className="px-4 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 47, 127, 0.2) 0%, rgba(239, 47, 127, 0.1) 100%)',
                  borderRadius: '10px 6px 4px 8px',
                  color: '#EF2F7F',
                  border: '1px solid rgba(239, 47, 127, 0.3)'
                }}
              >
                {actionLoading === 'purify' ? 'Purifying...' : isPurified ? 'Purified' : 'Purify'}
              </button>
            </div>
            {showTooltip === 'purify' && (
              <div
                className="absolute top-full left-0 right-0 mt-2 p-3 z-50"
                style={{
                  background: 'rgba(18, 18, 26, 0.98)',
                  borderRadius: '8px 12px 10px 6px',
                  border: '1px solid rgba(239, 47, 127, 0.3)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                }}
              >
                <p className="text-xs text-[#EF2F7F] font-medium mb-1">Purification Process</p>
                <p className="text-xs text-gray-300 leading-relaxed mb-2">
                  As an Angel holder, you can purify your staked DAEMON. Each consecutive day staked = 1 purified daemon. 
                  Purified daemons become harvestable, allowing you to collect rewards and DAEMON Points.
                </p>
                <p className="text-xs text-[#2473BC] font-medium">
                  {harvestable} DAEMON ready to harvest from {purifiedDaemons} purified tokens
                </p>
              </div>
            )}
          </div>
        )}

        {/* DAEMON Harvesting */}
        <div
          className="p-4 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(36, 115, 188, 0.08) 0%, rgba(18, 18, 26, 0.9) 100%)',
            borderRadius: '8px 14px 18px 12px',
            border: harvestable > 0 ? '2px solid rgba(36, 115, 188, 0.4)' : '1px solid rgba(36, 115, 188, 0.2)'
          }}
          onMouseEnter={() => setShowTooltip('harvest')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Harvest Icon */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '6px 10px 12px 8px',
                  background: 'rgba(36, 115, 188, 0.15)'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3V8M12 8L9 5M12 8L15 5" stroke="#2473BC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 21V16M12 16L9 19M12 16L15 19" stroke="#2473BC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="#2473BC" strokeWidth="1.5" fill="none" />
                  <path d="M3 12H6M18 12H21" stroke="#2473BC" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase">Harvesting</p>
                <p className="text-white text-xl font-bold">{harvestable}</p>
                {holdsAngel && harvestable > 0 && (
                  <p className="text-[#7FFF5B] text-xs mt-1">✓ Ready to collect</p>
                )}
                {!holdsAngel && (
                  <p className="text-gray-500 text-xs mt-1">Requires Angel + Purification</p>
                )}
                {holdsAngel && harvestable === 0 && isPurified && (
                  <p className="text-gray-500 text-xs mt-1">All harvested</p>
                )}
              </div>
            </div>
            <button
              onClick={handleHarvest}
              disabled={harvestable === 0 || !holdsAngel || !walletAddress || actionLoading === 'harvest'}
              className="px-4 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: harvestable > 0 && holdsAngel
                  ? 'linear-gradient(135deg, rgba(36, 115, 188, 0.2) 0%, rgba(36, 115, 188, 0.1) 100%)'
                  : 'rgba(36, 115, 188, 0.1)',
                borderRadius: '4px 8px 10px 6px',
                color: '#2473BC',
                border: '1px solid rgba(36, 115, 188, 0.3)'
              }}
            >
              {actionLoading === 'harvest' ? 'Harvesting...' : 'Harvest'}
            </button>
          </div>
          {showTooltip === 'harvest' && (
            <div
              className="absolute top-full left-0 right-0 mt-2 p-3 z-50"
              style={{
                background: 'rgba(18, 18, 26, 0.98)',
                borderRadius: '8px 12px 10px 6px',
                border: '1px solid rgba(36, 115, 188, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              <p className="text-xs text-[#2473BC] font-medium mb-1">Harvesting Rewards</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                {holdsAngel 
                  ? `Harvest your purified DAEMON to collect rewards and earn DAEMON Points. You currently have ${harvestable} ready to harvest (${consecutiveDays} consecutive days staked).`
                  : 'Harvesting requires an Angel NFT to purify staked DAEMON first. Without purification, tokens remain locked.'}
              </p>
            </div>
          )}
        </div>
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
