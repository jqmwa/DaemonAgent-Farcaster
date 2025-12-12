# Neynar Score Quality Filter

## Overview

Azura now requires users to have a **Neynar score of 0.8 or above** to interact with her. This prevents spam and ensures quality interactions.

## How It Works

### Score Check Process

1. User mentions @azura or triggers a command
2. Webhook fetches user's Neynar score via FID
3. If score < 0.8 → Request is blocked (silently)
4. If score >= 0.8 → Request is processed normally

### Implementation

**Location:** `app/api/webhook/route.ts`

```typescript
async function checkNeynarScore(fid: number, apiKey: string): Promise<{ allowed: boolean; score: number | null }> {
  // Fetches user data from Neynar API
  // Returns allowed: true if score >= 0.8
  // Returns allowed: false if score < 0.8
}
```

### Check Happens Early

The score check occurs right after:
- Self-cast detection (blocking own messages)
- Before deduplication checks
- Before any processing or AI calls

This saves resources by rejecting low-quality users immediately.

## What Gets Blocked

Users with Neynar score < 0.8 cannot:
- ❌ Get responses from Azura on mentions
- ❌ Use "fix this" feature
- ❌ Request daemon analysis
- ❌ Continue threads with Azura

## What's Allowed

Users with Neynar score >= 0.8 can:
- ✅ Mention Azura and get responses
- ✅ Use all features ("fix this", daemon analysis)
- ✅ Continue conversations in threads
- ✅ All normal bot interactions

## Error Handling

If Neynar API fails or score cannot be fetched:
- ✅ **User is ALLOWED by default**
- Prevents blocking legitimate users due to API issues
- Logs error for monitoring

## Response to Low-Score Users

When blocked, the webhook:
- Returns success (doesn't error)
- Marks cast as processed (prevents retry)
- Logs the block with user info
- **Does NOT reply to the user** (silent block)

No message is sent to the user - they simply don't get a response from Azura.

## Configuration

### Current Threshold

```typescript
const REQUIRED_SCORE = 0.8
```

### Adjusting the Threshold

To change the required score, edit `app/api/webhook/route.ts`:

```typescript
// Line ~110 (in checkNeynarScore function)
return { allowed: score >= 0.8, score }  // Change 0.8 to your threshold
```

**Recommended thresholds:**
- `0.9` - Very strict (only established users)
- `0.8` - Strict (current setting, good quality)
- `0.7` - Moderate (allows more users)
- `0.6` - Lenient (minimal filtering)

## Neynar Score Explanation

### What is Neynar Score?

Neynar provides an experimental score for each Farcaster user based on:
- Account age
- Activity patterns
- Engagement quality
- Network connections
- Spam indicators

### Score Ranges

- **0.9-1.0**: Highly trusted, established users
- **0.8-0.9**: Good quality, active users
- **0.7-0.8**: Moderate quality
- **0.6-0.7**: Newer or less active users
- **< 0.6**: Potentially spam or very new accounts

## Monitoring

### Logs to Watch

The webhook logs score checks:

```bash
[Neynar Score] User FID: 123456 Score: 0.85
[WEBHOOK] User passed Neynar score check: { username: 'alice', fid: 123456, score: 0.85 }
```

Or when blocked:

```bash
[Neynar Score] User FID: 999999 Score: 0.5
[WEBHOOK] User blocked due to low Neynar score: { username: 'spammer', fid: 999999, score: 0.5 }
```

### Metrics to Track

Monitor these to tune the threshold:
- Number of users blocked
- Score distribution of blocked users
- False positives (good users blocked)
- Spam reduction effectiveness

## Testing

### Test High-Score User

Use your own account (likely high score):
```
@azura hey there
```
Should get response.

### Test Low-Score User

Use a test account with low score:
```
@azura hey there
```
Should get no response (silently blocked).

### Check User Score

You can manually check a user's score:

```bash
curl "https://api.neynar.com/v2/farcaster/user/bulk?fids=USER_FID" \
  -H "x-api-key: YOUR_API_KEY"
```

Look for `experimental.neynar_user_score` in response.

## Benefits

### Spam Prevention
- ✅ Blocks bot accounts
- ✅ Filters out spam accounts
- ✅ Reduces malicious interactions

### Resource Savings
- ✅ No AI calls for low-quality users
- ✅ No API calls for processing spam
- ✅ Saves DeepSeek/Claude costs

### Better User Experience
- ✅ High-quality interactions only
- ✅ Less spam in replies
- ✅ Better conversation quality

## Considerations

### Potential Issues

**New Users:**
- New legitimate users may have low scores initially
- They won't be able to interact with Azura until score improves
- Consider this trade-off vs spam prevention

**False Positives:**
- Some real users may be below 0.8
- Monitor logs for legitimate users being blocked
- Adjust threshold if needed

**API Dependency:**
- Relies on Neynar API availability
- Falls back to allowing on error (safe default)

### When to Adjust Threshold

**Increase to 0.9 if:**
- Getting too much spam
- Want only established users
- High-value interactions only

**Decrease to 0.7 if:**
- Blocking too many legitimate users
- Want to be more inclusive
- New user growth is important

## Alternatives

If you want different filtering:

### Whitelist Approach
```typescript
const ALLOWED_FIDS = [123, 456, 789]
if (!ALLOWED_FIDS.includes(authorFid)) return
```

### Follower Count Filter
```typescript
if (user.follower_count < 100) return
```

### Account Age Filter
```typescript
const accountAge = Date.now() - user.registered_at
if (accountAge < 30 * 24 * 60 * 60 * 1000) return // 30 days
```

## Disabling the Filter

To disable the score check completely:

```typescript
// In app/api/webhook/route.ts
// Comment out or remove this section:
/*
const scoreCheck = await checkNeynarScore(authorFid, apiKey)
if (!scoreCheck.allowed) {
  // ... block logic
}
*/
```

## Summary

- ✅ Neynar score >= 0.8 required
- ✅ Checked early in webhook processing
- ✅ Silent blocks (no message to user)
- ✅ Fails open (allows on API error)
- ✅ Logs all score checks
- ✅ Configurable threshold
- ✅ Prevents spam and low-quality interactions

---

**Status:** ✅ Active

**Threshold:** 0.8

**Last Updated:** December 12, 2024
