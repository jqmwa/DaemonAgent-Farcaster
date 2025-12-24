import { NextRequest, NextResponse } from 'next/server'
import { calculateConsecutiveDays, calculateHarvestable, StakingRecord } from '@/lib/staking-types'
import { getStakingRecord, setStakingRecord } from '@/lib/staking-storage'

// Helper function to check if user owns Angel NFT
// In production, check against NFT contract on Base
async function checkAngelOwnership(walletAddress: string): Promise<boolean> {
  try {
    // Call the check-angel API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || 'http://localhost:3000'
    const protocol = baseUrl.startsWith('http') ? '' : 'https://'
    const url = `${protocol}${baseUrl}/api/staking/check-angel?wallet=${walletAddress}`
    
    const response = await fetch(url)
    const result = await response.json()
    return result.success && result.hasAngel === true
  } catch (error) {
    console.error('[Purify API] Error checking Angel ownership:', error)
    // For now, return false (implement real check)
    return false
  }
}

// POST - Purify staked tokens (requires Angel NFT)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fid, walletAddress } = body

    if (!fid || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'FID and walletAddress are required' },
        { status: 400 }
      )
    }

    // Check Angel NFT ownership
    const hasAngel = await checkAngelOwnership(walletAddress)
    
    if (!hasAngel) {
      return NextResponse.json(
        { success: false, error: 'Angel NFT ownership required for purification' },
        { status: 403 }
      )
    }

    const fidNumber = parseInt(fid, 10)
    const existingRecord = getStakingRecord(fidNumber)
    
    if (!existingRecord) {
      return NextResponse.json(
        { success: false, error: 'No staking record found. Stake tokens first.' },
        { status: 404 }
      )
    }

    if (existingRecord.stakedAmount === '0' || existingRecord.stakedAmount === '') {
      return NextResponse.json(
        { success: false, error: 'No tokens staked' },
        { status: 400 }
      )
    }

    // Calculate current consecutive days
    const now = new Date()
    const consecutiveDays = calculateConsecutiveDays(
      new Date(existingRecord.startDate),
      new Date(existingRecord.lastUpdateDate),
      now
    )

    // Purification: purified daemons = consecutive days
    const updatedRecord: StakingRecord = {
      ...existingRecord,
      isPurified: true,
      purifiedDaemons: consecutiveDays,
      lastUpdateDate: now,
      consecutiveDays
    }
    
    setStakingRecord(fidNumber, updatedRecord)

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `Purified ${consecutiveDays} DAEMON tokens (${consecutiveDays} consecutive days staked)`
    })
  } catch (error) {
    console.error('[Purify API] Error purifying tokens:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

