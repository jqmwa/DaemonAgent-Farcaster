# API Credit Estimate: Voice Analysis for FID 286924

## Task Overview
Analyze the most successful posts from Farcaster user FID: 286924 to identify the most consistent voice across their posts.

## API Calls Breakdown

### 1. Neynar API Calls

#### User Profile Fetch
- **Endpoint**: `GET /v2/farcaster/user/bulk?fids=286924`
- **Calls**: 1
- **Credits**: ~1 credit (user lookup)
- **Purpose**: Get user profile info (username, bio, etc.)

#### Fetch User Casts
- **Endpoint**: `GET /v2/farcaster/feed?fid=286924&limit=100`
- **Calls**: 1-2 (depending on pagination)
- **Credits**: ~1-2 credits per call
- **Purpose**: Fetch recent casts (need enough to identify "most successful")
- **Note**: May need to fetch more if user has many posts

#### Optional: Engagement Metrics
- If we need to fetch individual cast details for engagement:
- **Calls**: 0-50 (if fetching individual cast details)
- **Credits**: ~0.1-0.5 credits per cast detail
- **Note**: Engagement data (likes/recasts) is usually included in feed response

**Total Neynar API Credits: 2-5 credits**

### 2. DeepSeek AI API Calls

#### Step 1: Identify Most Successful Posts
- **Purpose**: Analyze engagement metrics and select top posts
- **Input**: ~100 casts with engagement data
- **Tokens**: ~2,000-3,000 input tokens, ~500-800 output tokens
- **Calls**: 1
- **Cost**: ~$0.0001-0.0002 (DeepSeek is very cheap)

#### Step 2: Analyze Voice Consistency
- **Purpose**: Extract consistent voice patterns from successful posts
- **Input**: Top 10-20 successful posts (text content)
- **Tokens**: ~3,000-5,000 input tokens, ~1,000-2,000 output tokens
- **Calls**: 1
- **Cost**: ~$0.0002-0.0003

**Total DeepSeek API Cost: ~$0.0003-0.0005 (essentially free)**

## Total Estimate

### Conservative Estimate (Minimal Approach)
- **Neynar API**: 2-3 credits
- **DeepSeek API**: ~$0.0003-0.0005
- **Total Cost**: ~$0.0003-0.0005 (Neynar credits are typically included in subscription)

### Realistic Estimate (Thorough Analysis)
- **Neynar API**: 3-5 credits
- **DeepSeek API**: ~$0.0005-0.001
- **Total Cost**: ~$0.0005-0.001

### Maximum Estimate (Deep Analysis)
- **Neynar API**: 5-10 credits (if fetching many casts with pagination)
- **DeepSeek API**: ~$0.001-0.002 (if doing multiple analysis passes)
- **Total Cost**: ~$0.001-0.002

## Implementation Approach

### Recommended Flow:
1. **Fetch User Profile** (1 Neynar call)
2. **Fetch User Casts** (1-2 Neynar calls, limit=100)
3. **Filter by Engagement** (local processing - no API calls)
   - Sort by: (likes + recasts + replies) / time_since_post
   - Select top 10-20 most successful posts
4. **Analyze Voice Consistency** (1 DeepSeek call)
   - Input: Top posts' text content
   - Output: Consistent voice patterns, tone, themes

### Optimization Tips:
- Cache user profile data
- Fetch casts in batches (limit=100 per call)
- Process engagement metrics locally (no extra API calls)
- Use single DeepSeek call for voice analysis (combine all posts in one prompt)

## Cost Comparison

Compared to existing `daemon-analysis` function:
- **Current**: 2 Neynar calls + 1 DeepSeek call = ~3 credits + $0.0001
- **This Task**: 2-3 Neynar calls + 1-2 DeepSeek calls = ~3-5 credits + $0.0003-0.0005

**Verdict**: This task will use approximately **1.5-2x** the credits of a standard daemon analysis, but still extremely cheap.

## Notes

- Neynar API credits are typically included in subscription plans
- DeepSeek API is extremely affordable (~$0.14 per 1M input tokens, ~$0.28 per 1M output tokens)
- Most cost is in Neynar API credits, which are usually part of your subscription
- Actual cost will depend on:
  - Number of posts the user has
  - Whether engagement data is included in feed response
  - How many posts you want to analyze (top 10 vs top 50)

## Recommendation

**Proceed with confidence** - This task will cost less than $0.01 in actual API costs, and Neynar credits are typically included in your subscription tier.
