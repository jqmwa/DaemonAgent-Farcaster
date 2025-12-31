// Shared storage for staking data
// In production, replace this with a real database (PostgreSQL, MongoDB, Supabase, etc.)

import { StakingRecord } from './staking-types'

// Shared in-memory storage (will be shared across all API routes)
export const stakingStorage = new Map<number, StakingRecord>()

// Helper functions for storage operations
export function getStakingRecord(fid: number): StakingRecord | undefined {
  return stakingStorage.get(fid)
}

export function setStakingRecord(fid: number, record: StakingRecord): void {
  stakingStorage.set(fid, record)
}

export function deleteStakingRecord(fid: number): void {
  stakingStorage.delete(fid)
}

// For production: Replace with database operations
// Example with PostgreSQL:
/*
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export async function getStakingRecord(fid: number): Promise<StakingRecord | null> {
  const result = await pool.query(
    'SELECT * FROM staking_records WHERE fid = $1',
    [fid]
  )
  return result.rows[0] || null
}

export async function setStakingRecord(fid: number, record: StakingRecord): Promise<void> {
  await pool.query(
    `INSERT INTO staking_records (fid, wallet_address, staked_amount, start_date, last_update_date, consecutive_days, purified_daemons, is_purified, last_harvest_date, total_harvested)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (fid) 
     DO UPDATE SET 
       wallet_address = $2,
       staked_amount = $3,
       start_date = $4,
       last_update_date = $5,
       consecutive_days = $6,
       purified_daemons = $7,
       is_purified = $8,
       last_harvest_date = $9,
       total_harvested = $10`,
    [fid, record.walletAddress, record.stakedAmount, record.startDate, record.lastUpdateDate, record.consecutiveDays, record.purifiedDaemons, record.isPurified, record.lastHarvestDate, record.totalHarvested]
  )
}
*/












