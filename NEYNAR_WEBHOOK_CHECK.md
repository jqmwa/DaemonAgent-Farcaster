# Neynar Webhook Not Reaching Vercel - Debug Steps

## Problem
- Neynar credits are being used (webhooks are being sent)
- No logs appear in Vercel (webhooks not reaching endpoint)

## Immediate Checks

### 1. Verify Endpoint is Accessible

Test the health check:
```bash
curl https://your-domain.vercel.app/api/farcaster-webhook
```

**Expected:** JSON response with `"status": "OK"`

**If this fails:**
- Route isn't deployed
- Wrong domain/URL
- Vercel deployment issue

### 2. Check Neynar Webhook Configuration

In Neynar Dashboard → Webhooks:

1. **Webhook URL** should be exactly:
   ```
   https://your-domain.vercel.app/api/farcaster-webhook
   ```
   - No trailing slash
   - Must be HTTPS
   - Must match your Vercel domain exactly

2. **Webhook Status:**
   - Should show as "Active" or "Enabled"
   - Check delivery logs if available

3. **Webhook Secret:**
   - Should match `NEYNAR_WEBHOOK_SECRET` in Vercel
   - Or leave empty if you want to skip verification

### 3. Check Neynar Webhook Delivery Logs

In Neynar Dashboard, check:
- Webhook delivery attempts
- Response codes (should be 200)
- Error messages if any

**Common issues:**
- 404 = Wrong URL
- 401 = Signature mismatch
- 500 = Server error (check Vercel logs)
- Timeout = Function taking too long

### 4. Test Webhook Manually

Send a test webhook to verify the endpoint works:

```bash
curl -X POST https://your-domain.vercel.app/api/farcaster-webhook \
  -H "Content-Type: application/json" \
  -H "x-neynar-signature: test" \
  -d '{
    "type": "cast.created",
    "data": {
      "hash": "0xtest123",
      "text": "test @daemonagent",
      "author": {
        "fid": 999999,
        "username": "testuser"
      }
    }
  }'
```

**Check Vercel logs immediately after** - you should see:
```
[WEBHOOK] ====== REQUEST RECEIVED ======
```

### 5. Verify Vercel Deployment

1. Go to Vercel Dashboard → Your Project
2. Check latest deployment:
   - Status should be "Ready"
   - Check build logs for errors
   - Verify `app/api/farcaster-webhook/route.ts` is in the build

3. Check Function Logs:
   - Go to "Functions" tab
   - Look for `/api/farcaster-webhook`
   - Check invocation count (should increase when webhooks arrive)

### 6. Common Issues & Fixes

#### Issue: Wrong URL in Neynar
**Symptom:** 404 errors in Neynar logs
**Fix:** Update webhook URL to match your Vercel domain exactly

#### Issue: Webhook Secret Mismatch
**Symptom:** 401 errors in Neynar logs, but requests reach Vercel
**Fix:** 
- Match `NEYNAR_WEBHOOK_SECRET` in Vercel with Neynar webhook secret
- Or remove secret from both sides to skip verification

#### Issue: Function Timeout
**Symptom:** 504 errors or timeouts
**Fix:** 
- Check `maxDuration` in route.ts (currently 30s)
- Optimize ElizaOS initialization
- Check for hanging async operations

#### Issue: Route Not Deployed
**Symptom:** 404 on health check
**Fix:**
- Verify route file exists: `app/api/farcaster-webhook/route.ts`
- Commit and push to trigger new deployment
- Check Vercel build logs

#### Issue: CORS or Network Blocking
**Symptom:** No errors, but requests don't arrive
**Fix:**
- Check Vercel firewall/security settings
- Verify no IP restrictions
- Check if domain is properly configured

### 7. Verify Environment Variables in Vercel

Go to Vercel → Settings → Environment Variables:

Required:
- `NEYNAR_API_KEY` or `FARCASTER_NEYNAR_API_KEY`
- `NEYNAR_SIGNER_UUID` or `FARCASTER_SIGNER_UUID`
- `BOT_FID` or `FARCASTER_FID`
- `NEYNAR_WEBHOOK_SECRET` (optional)

**Important:** After adding/updating env vars, **redeploy** the project!

### 8. Check Vercel Function Configuration

The route should have:
```typescript
export const runtime = 'nodejs'
export const maxDuration = 30
```

This ensures it runs on Node.js runtime (required for some packages).

## Quick Test Checklist

Run these in order:

1. ✅ `curl https://your-domain.vercel.app/api/farcaster-webhook` → Should return JSON
2. ✅ Check Neynar webhook URL matches exactly
3. ✅ Check Neynar webhook is enabled
4. ✅ Test manual POST (see step 4 above)
5. ✅ Check Vercel function logs after manual test
6. ✅ Verify env vars are set in Vercel
7. ✅ Check Neynar webhook delivery logs

## If Still Not Working

1. **Check Neynar webhook delivery logs** - they'll show the exact error
2. **Check Vercel function logs** - filter by "WEBHOOK" or function name
3. **Try removing webhook secret** temporarily to rule out signature issues
4. **Redeploy** the Vercel project to ensure latest code is deployed
5. **Check Vercel function invocations** - if count is 0, requests aren't reaching Vercel

## Next Steps

Once you confirm:
- Health check works (GET request)
- Manual POST test shows logs in Vercel
- Neynar webhook URL is correct

Then check Neynar's webhook delivery logs to see why real webhooks aren't reaching Vercel.

