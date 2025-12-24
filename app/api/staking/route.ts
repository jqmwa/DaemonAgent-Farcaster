import { NextRequest, NextResponse } from 'next/server'
import { calculateConsecutiveDays, calculateHarvestable, StakingRecord } from '@/lib/staking-types'
import { getStakingRecord, setStakingRecord } from '@/lib/staking-storage'

// GET - Fetch staking data for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fid = searchParams.get('fid')
    
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'FID is required' },
        { status: 400 }
      )
    }

    const fidNumber = parseInt(fid, 10)
    const record = getStakingRecord(fidNumber)
    
    if (!record) {
      return NextResponse.json({
        success: true,
        data: {
          fid: fidNumber,
          walletAddress: '',
          stakedAmount: '0',
          startDate: new Date(),
          lastUpdateDate: new Date(),
          consecutiveDays: 0,
          purifiedDaemons: 0,
          isPurified: false,
          lastHarvestDate: null,
          totalHarvested: 0
        }
      })
    }

    // Update consecutive days based on current time
    const now = new Date()
    const consecutiveDays = calculateConsecutiveDays(
      new Date(record.startDate),
      new Date(record.lastUpdateDate),
      now
    )
    
    // Update purified daemons if purified (equals consecutive days)
    const purifiedDaemons = record.isPurified ? consecutiveDays : 0
    
    // Calculate harvestable
    const harvestable = calculateHarvestable(
      consecutiveDays,
      record.isPurified,
      record.totalHarvested
    )

    // Update the record
    const updatedRecord: StakingRecord = {
      ...record,
      consecutiveDays,
      purifiedDaemons,
      lastUpdateDate: now
    }
    
    setStakingRecord(fidNumber, updatedRecord)

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      harvestable // Include calculated harvestable amount
    })
  } catch (error) {
    console.error('[Staking API] Error fetching staking data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// POST - Stake tokens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fid, walletAddress, amount, txHash } = body

    if (!fid || !walletAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'FID, walletAddress, and amount are required' },
        { status: 400 }
      )
    }

    const fidNumber = parseInt(fid, 10)
    const existingRecord = getStakingRecord(fidNumber)
    
    const now = new Date()
    
    if (existingRecord) {
      // If already staking, check if streak continues
      const daysSinceLastUpdate = Math.floor(
        (now.getTime() - new Date(existingRecord.lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // If gap > 1 day, reset streak
      const shouldResetStreak = daysSinceLastUpdate > 1
      
      const updatedRecord: StakingRecord = {
        ...existingRecord,
        stakedAmount: (BigInt(existingRecord.stakedAmount) + BigInt(amount)).toString(),
        startDate: shouldResetStreak ? now : existingRecord.startDate,
        lastUpdateDate: now,
        consecutiveDays: shouldResetStreak ? 1 : calculateConsecutiveDays(
          new Date(existingRecord.startDate),
          new Date(existingRecord.lastUpdateDate),
          now
        ),
        isPurified: shouldResetStreak ? false : existingRecord.isPurified // Reset purification if streak broken
      }
      
      setStakingRecord(fidNumber, updatedRecord)
      
      return NextResponse.json({
        success: true,
        data: updatedRecord
      })
    } else {
      // New stake
      const newRecord: StakingRecord = {
        fid: fidNumber,
        walletAddress,
        stakedAmount: amount,
        startDate: now,
        lastUpdateDate: now,
        consecutiveDays: 1,
        purifiedDaemons: 0,
        isPurified: false,
        lastHarvestDate: null,
        totalHarvested: 0
      }
      
      setStakingRecord(fidNumber, newRecord)
      
      return NextResponse.json({
        success: true,
        data: newRecord
      })
    }
  } catch (error) {
    console.error('[Staking API] Error staking tokens:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// PUT - Unstake tokens (resets consecutive days)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { fid, amount } = body

    if (!fid || !amount) {
      return NextResponse.json(
        { success: false, error: 'FID and amount are required' },
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

    const newAmount = BigInt(existingRecord.stakedAmount) - BigInt(amount)
    
    if (newAmount < 0) {
      return NextResponse.json(
        { success: false, error: 'Insufficient staked amount' },
        { status: 400 }
      )
    }

    // Unstaking resets the streak
    const updatedRecord: StakingRecord = {
      ...existingRecord,
      stakedAmount: newAmount.toString(),
      startDate: new Date(), // Reset start date
      lastUpdateDate: new Date(),
      consecutiveDays: 0, // Reset streak
      purifiedDaemons: 0, // Reset purified
      isPurified: false // Reset purification status
    }
    
    setStakingRecord(fidNumber, updatedRecord)

    return NextResponse.json({
      success: true,
      data: updatedRecord
    })
  } catch (error) {
    console.error('[Staking API] Error unstaking tokens:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

