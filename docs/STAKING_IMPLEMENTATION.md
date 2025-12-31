# Staking Implementation Guide

## Overview

The staking system allows Farcaster users to stake $DAEMON tokens, track consecutive staking days, purify tokens (if they hold an Angel NFT), and harvest rewards.

## Core Concepts

### 1. **Consecutive Days Tracking**
- Each day a user has tokens staked without unstaking = 1 consecutive day
- If user unstakes (even partially), the streak resets to 0
- If there's a gap of more than 1 day between updates, the streak resets

### 2. **Purification (Requires Angel NFT)**
- Only Angel NFT holders can purify their staked tokens
- Purified daemons = consecutive days staked
- Example: If staked for 7 consecutive days, 7 daemons can be purified

### 3. **Harvesting**
- Harvestable amount = consecutive days (if purified) - already harvested
- Each consecutive day = 1 harvestable daemon
- Harvesting doesn't break the streak, but reduces available purified daemons

## API Endpoints

### GET `/api/staking?fid={fid}`
Get staking data for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "fid": 123,
    "walletAddress": "0x...",
    "stakedAmount": "1500000000000000000",
    "startDate": "2024-01-01T00:00:00.000Z",
    "lastUpdateDate": "2024-01-08T00:00:00.000Z",
    "consecutiveDays": 7,
    "purifiedDaemons": 7,
    "isPurified": true,
    "lastHarvestDate": null,
    "totalHarvested": 0
  },
  "harvestable": 7
}
```

### POST `/api/staking`
Stake tokens.

**Request:**
```json
{
  "fid": 123,
  "walletAddress": "0x...",
  "amount": "1000000000000000000",
  "txHash": "0x..." // Optional, for verification
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* StakingRecord */ }
}
```

### PUT `/api/staking`
Unstake tokens (resets consecutive days).

**Request:**
```json
{
  "fid": 123,
  "amount": "500000000000000000"
}
```

### POST `/api/staking/purify`
Purify staked tokens (requires Angel NFT).

**Request:**
```json
{
  "fid": 123,
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Updated StakingRecord */ },
  "message": "Purified 7 DAEMON tokens (7 consecutive days staked)"
}
```

### POST `/api/staking/harvest`
Harvest purified tokens.

**Request:**
```json
{
  "fid": 123,
  "walletAddress": "0x...",
  "amount": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Updated StakingRecord */ },
  "harvested": 5,
  "message": "Successfully harvested 5 DAEMON tokens"
}
```

## Frontend Integration

### Using the Staking Service

```typescript
import { getStakingData, stakeTokens, purifyTokens, harvestTokens } from '@/lib/staking-service'

// Get user's staking data
const stakingData = await getStakingData(userFid)
if (stakingData) {
  console.log(`Staked: ${stakingData.stakedAmount}`)
  console.log(`Consecutive days: ${stakingData.consecutiveDays}`)
  console.log(`Harvestable: ${stakingData.harvestable}`)
}

// Stake tokens
await stakeTokens({
  fid: userFid,
  walletAddress: userWallet,
  amount: '1000000000000000000' // 1 token in wei
})

// Purify (requires Angel NFT)
await purifyTokens({
  fid: userFid,
  walletAddress: userWallet
})

// Harvest
await harvestTokens({
  fid: userFid,
  walletAddress: userWallet,
  amount: 5 // Number of daemons to harvest
})
```

## Data Storage

Currently using in-memory storage (`lib/staking-storage.ts`). 

**For production, replace with a database:**

### PostgreSQL Example

```sql
CREATE TABLE staking_records (
  fid BIGINT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  staked_amount TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  last_update_date TIMESTAMP NOT NULL,
  consecutive_days INTEGER NOT NULL DEFAULT 0,
  purified_daemons INTEGER NOT NULL DEFAULT 0,
  is_purified BOOLEAN NOT NULL DEFAULT false,
  last_harvest_date TIMESTAMP,
  total_harvested INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Update `lib/staking-storage.ts` to use database queries instead of Map.

## Angel NFT Verification

Currently returns `true` for testing. **Implement in production:**

```typescript
// In app/api/staking/purify/route.ts
async function checkAngelOwnership(walletAddress: string): Promise<boolean> {
  // Query Base NFT contract
  // Check if wallet owns Angel NFT (token ID or collection)
  // Return true if owned, false otherwise
}
```

## Key Logic

### Consecutive Days Calculation
```typescript
function calculateConsecutiveDays(
  startDate: Date,
  lastUpdateDate: Date,
  currentDate: Date = new Date()
): number {
  // If gap > 1 day, streak is broken
  const daysSinceLastUpdate = Math.floor(
    (currentDate.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  if (daysSinceLastUpdate > 1) {
    return 0 // Streak broken
  }
  
  return Math.floor(
    (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
}
```

### Harvestable Calculation
```typescript
function calculateHarvestable(
  consecutiveDays: number,
  isPurified: boolean,
  alreadyHarvested: number = 0
): number {
  if (!isPurified) return 0
  return Math.max(0, consecutiveDays - alreadyHarvested)
}
```

## Testing

Test the endpoints:

```bash
# Get staking data
curl "http://localhost:3000/api/staking?fid=123"

# Stake tokens
curl -X POST http://localhost:3000/api/staking \
  -H "Content-Type: application/json" \
  -d '{"fid":123,"walletAddress":"0x...","amount":"1000000000000000000"}'

# Purify
curl -X POST http://localhost:3000/api/staking/purify \
  -H "Content-Type: application/json" \
  -d '{"fid":123,"walletAddress":"0x..."}'

# Harvest
curl -X POST http://localhost:3000/api/staking/harvest \
  -H "Content-Type: application/json" \
  -d '{"fid":123,"walletAddress":"0x...","amount":5}'
```

## Next Steps

1. **Update ProfilePage** to fetch real data from API instead of mock data
2. **Get FID from Farcaster SDK** context (may need to fetch via Neynar API)
3. **Integrate wallet connection** for staking/unstaking transactions
4. **Implement Angel NFT check** against actual contract
5. **Set up database** for persistent storage
6. **Add transaction verification** (verify on-chain staking transactions)












