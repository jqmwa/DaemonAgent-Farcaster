import { NextRequest, NextResponse } from 'next/server'
import { calculateConsecutiveDays, calculateHarvestable, StakingRecord } from '@/lib/staking-types'
import { getStakingRecord, setStakingRecord } from '@/lib/staking-storage'

// POST - Harvest purified DAEMON tokens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fid, walletAddress, amount } = body

    if (!fid || !walletAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'FID, walletAddress, and amount are required' },
        { status: 400 }
      )
    }

    const fidNumber = parseInt(fid, 10)
    const existingRecord = getStakingRecord(fidNumber)
    
    if (!existingRecord) {
      return NextResponse.json(
        { success: false, error: 'No staking record found' },
        { status: 404 }
      )
    }

    if (!existingRecord.isPurified) {
      return NextResponse.json(
        { success: false, error: 'Tokens must be purified before harvesting' },
        { status: 400 }
      )
    }

    // Recalculate current state
    const now = new Date()
    const consecutiveDays = calculateConsecutiveDays(
      new Date(existingRecord.startDate),
      new Date(existingRecord.lastUpdateDate),
      now
    )

    const harvestable = calculateHarvestable(
      consecutiveDays,
      existingRecord.isPurified,
      existingRecord.totalHarvested
    )

    if (amount > harvestable) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Only ${harvestable} DAEMON tokens available to harvest` 
        },
        { status: 400 }
      )
    }

    // Update record after harvest
    const updatedRecord: StakingRecord = {
      ...existingRecord,
      totalHarvested: existingRecord.totalHarvested + amount,
      lastHarvestDate: now,
      lastUpdateDate: now,
      purifiedDaemons: Math.max(0, consecutiveDays - (existingRecord.totalHarvested + amount)) // Remaining purified
    }
    
    setStakingRecord(fidNumber, updatedRecord)

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      harvested: amount,
      message: `Successfully harvested ${amount} DAEMON tokens`
    })
  } catch (error) {
    console.error('[Harvest API] Error harvesting tokens:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

