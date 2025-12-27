// Types for staking system

export interface StakingRecord {
  fid: number // Farcaster FID
  walletAddress: string // User's wallet address
  stakedAmount: string // Amount staked in wei or token units
  startDate: Date // When staking started
  lastUpdateDate: Date // Last time staking was updated/checked
  consecutiveDays: number // Days staked without unstaking
  purifiedDaemons: number // Number of purified daemons (equals consecutive days if purified)
  isPurified: boolean // Whether the staked tokens have been purified
  lastHarvestDate: Date | null // Last time tokens were harvested
  totalHarvested: number // Total daemons harvested over time
}

export interface StakingResponse {
  success: boolean
  data?: StakingRecord
  error?: string
}

export interface StakeTransactionRequest {
  fid: number
  walletAddress: string
  amount: string // Amount to stake
  txHash?: string // Transaction hash for verification
}

export interface PurifyRequest {
  fid: number
  walletAddress: string
  // Angel NFT ownership will be checked on backend
}

export interface HarvestRequest {
  fid: number
  walletAddress: string
  amount: number // Amount to harvest
}

// Calculate consecutive days helper
export function calculateConsecutiveDays(
  startDate: Date,
  lastUpdateDate: Date,
  currentDate: Date = new Date()
): number {
  // Reset if there's a gap between lastUpdateDate and currentDate
  const daysSinceLastUpdate = Math.floor(
    (currentDate.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  // If more than 1 day gap, streak is broken
  if (daysSinceLastUpdate > 1) {
    return 0
  }
  
  // Calculate total days from start
  const totalDays = Math.floor(
    (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  return Math.max(0, totalDays)
}

// Calculate harvestable amount (equals consecutive days for purified tokens)
export function calculateHarvestable(
  consecutiveDays: number,
  isPurified: boolean,
  alreadyHarvested: number = 0
): number {
  if (!isPurified) {
    return 0 // Must be purified to harvest
  }
  
  // Harvestable equals consecutive days (1 daemon per day)
  const totalHarvestable = consecutiveDays
  return Math.max(0, totalHarvestable - alreadyHarvested)
}


