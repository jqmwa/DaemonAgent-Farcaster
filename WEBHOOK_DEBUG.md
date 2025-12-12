# Webhook Debugging Guide

## Issue: No logs appearing in Vercel

If you're not seeing any logs in Vercel, it means the webhook requests aren't reaching the endpoint. Here's how to debug:

## Step 1: Verify Endpoint is Deployed

Test the health check endpoint:
```bash
curl https://your-domain.vercel.app/api/farcaster-webhook
```

Expected response:
```json
{
  "status": "OK",
  "endpoint": "/api/farcaster-webhook",
  "timestamp": "...",
  "message": "Webhook endpoint is active"
}
```

If this doesn't work, the route isn't deployed correctly.

## Step 2: Check Neynar Webhook Configuration

1. Go to Neynar Dashboard → Webhooks
2. Verify the webhook URL is: `https://your-domain.vercel.app/api/farcaster-webhook`
3. Check that webhook is **enabled** and **active**
4. Verify the webhook secret matches `NEYNAR_WEBHOOK_SECRET` in Vercel environment variables

## Step 3: Check Vercel Environment Variables

Required variables:
- `NEYNAR_API_KEY` (or `FARCASTER_NEYNAR_API_KEY`)
- `NEYNAR_SIGNER_UUID` (or `FARCASTER_SIGNER_UUID`)
- `BOT_FID` (or `FARCASTER_FID`)
- `NEYNAR_WEBHOOK_SECRET` (optional, but recommended)

## Step 4: Test Webhook Manually

You can test the webhook endpoint manually:

```bash
curl -X POST https://your-domain.vercel.app/api/farcaster-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cast.created",
    "data": {
      "hash": "0xtest",
      "text": "test @daemonagent",
      "author": {
        "fid": 123,
        "username": "testuser"
      }
    }
  }'
```

Check Vercel logs after this - you should see `[WEBHOOK] ====== REQUEST RECEIVED ======`

## Step 5: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by "WEBHOOK" to see webhook-specific logs
3. Look for:
   - `[WEBHOOK] ====== REQUEST RECEIVED ======` - confirms request reached endpoint
   - `[WEBHOOK] Environment check:` - shows if env vars are loaded
   - `[WEBHOOK] Event parsed:` - shows if event was parsed correctly
   - Any error messages with `❌`

## Step 6: Common Issues

### Issue: No logs at all
**Cause:** Webhook not reaching endpoint
**Fix:** 
- Check Neynar webhook URL is correct
- Verify webhook is enabled in Neynar
- Check Vercel deployment is live

### Issue: 401 Unauthorized
**Cause:** Signature verification failing
**Fix:**
- Verify `NEYNAR_WEBHOOK_SECRET` matches Neynar webhook secret
- Or remove webhook secret to skip verification (not recommended for production)

### Issue: 500 Error - ElizaOS not available
**Cause:** Missing environment variables
**Fix:**
- Ensure `FARCASTER_FID`, `NEYNAR_API_KEY`, `NEYNAR_SIGNER_UUID` are set
- Check variable names match exactly (case-sensitive)

### Issue: Route not found (404)
**Cause:** Route not deployed or wrong path
**Fix:**
- Verify route is at `app/api/farcaster-webhook/route.ts`
- Redeploy to Vercel
- Check Vercel build logs for errors

## Step 7: Enable Detailed Logging

The webhook now logs extensively:
- Request received (with headers)
- Environment variable status
- Event parsing
- Cast details
- ElizaOS initialization
- Processing results
- All errors with stack traces

All logs are prefixed with `[WEBHOOK]` for easy filtering.

## Testing Checklist

- [ ] Health check endpoint responds (`GET /api/farcaster-webhook`)
- [ ] Neynar webhook URL is correct
- [ ] Neynar webhook is enabled
- [ ] All environment variables are set in Vercel
- [ ] Manual POST test shows logs in Vercel
- [ ] Real webhook events show logs in Vercel

## Next Steps

If you still don't see logs:
1. Check Vercel function logs (not just deployment logs)
2. Verify the route file is committed and deployed
3. Try redeploying the project
4. Check if there are any build errors preventing the route from being created

