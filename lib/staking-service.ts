// Staking service for frontend integration

import { StakingRecord, StakeTransactionRequest, PurifyRequest, HarvestRequest } from './staking-types'

const API_BASE = '/api/staking'

export interface StakingData extends StakingRecord {
  harvestable: number // Calculated harvestable amount
}

// Get staking data for a user
export async function getStakingData(fid: number): Promise<StakingData | null> {
  try {
    const response = await fetch(`${API_BASE}?fid=${fid}`)
    const result = await response.json()
    
    if (result.success && result.data) {
      return {
        ...result.data,
        harvestable: result.harvestable || 0
      }
    }
    
    return null
  } catch (error) {
    console.error('[Staking Service] Error fetching staking data:', error)
    return null
  }
}

// Stake tokens
export async function stakeTokens(request: StakeTransactionRequest): Promise<StakingRecord | null> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    }
    
    throw new Error(result.error || 'Failed to stake tokens')
  } catch (error) {
    console.error('[Staking Service] Error staking tokens:', error)
    throw error
  }
}

// Unstake tokens (resets streak)
export async function unstakeTokens(fid: number, amount: string): Promise<StakingRecord | null> {
  try {
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fid, amount }),
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    }
    
    throw new Error(result.error || 'Failed to unstake tokens')
  } catch (error) {
    console.error('[Staking Service] Error unstaking tokens:', error)
    throw error
  }
}

// Purify staked tokens (requires Angel NFT)
export async function purifyTokens(request: PurifyRequest): Promise<StakingRecord | null> {
  try {
    const response = await fetch(`${API_BASE}/purify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    }
    
    throw new Error(result.error || 'Failed to purify tokens')
  } catch (error) {
    console.error('[Staking Service] Error purifying tokens:', error)
    throw error
  }
}

// Harvest purified tokens
export async function harvestTokens(request: HarvestRequest): Promise<{ data: StakingRecord; harvested: number } | null> {
  try {
    const response = await fetch(`${API_BASE}/harvest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      return {
        data: result.data,
        harvested: result.harvested || 0
      }
    }
    
    throw new Error(result.error || 'Failed to harvest tokens')
  } catch (error) {
    console.error('[Staking Service] Error harvesting tokens:', error)
    throw error
  }
}













