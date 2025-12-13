# Local Webhook Setup Guide

## Step 1: Install ngrok

**Option A: Download from website (Recommended)**
1. Go to https://ngrok.com/download
2. Download for macOS
3. Extract and move to a location in your PATH, or use it directly

**Option B: Using the downloaded file**
If the download worked, extract it:
```bash
unzip ngrok.zip
chmod +x ngrok
sudo mv ngrok /usr/local/bin/  # or add to your PATH
```

## Step 2: Start Your Local Server

In one terminal, start your Next.js dev server:
```bash
pnpm dev
```

This will run on `http://localhost:3000`

## Step 3: Expose with ngrok

In another terminal, run:
```bash
ngrok http 3000
```

This will give you a URL like: `https://abc123.ngrok-free.app`

## Step 4: Configure Neynar Webhook

**IMPORTANT:** Your webhook URL should be:
```
https://your-ngrok-url.ngrok-free.app/api/farcaster-webhook
```

**NOT** `/farcaster/webhook` - use `/api/farcaster-webhook`

### Steps in Neynar Dashboard:
1. Go to Neynar Dashboard → Webhooks
2. Click "New webhook" or edit existing
3. Set Target URL to: `https://your-ngrok-url.ngrok-free.app/api/farcaster-webhook`
4. Configure Event Types:
   - Select `cast.created`
5. Set Filters:
   - **Mentioned users:** Add your bot's Farcaster username (e.g., `daemonagent`)
   - **Parent cast authors:** Add your bot's Farcaster username
6. Set Webhook Secret (optional but recommended):
   - Copy the secret and add it to your `.env.local` as `NEYNAR_WEBHOOK_SECRET`

## Step 5: Test

1. Make sure your dev server is running (`pnpm dev`)
2. Make sure ngrok is running (`ngrok http 3000`)
3. Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok-free.app`)
4. Update Neynar webhook with: `https://abc123.ngrok-free.app/api/farcaster-webhook`
5. Test by mentioning your bot on Farcaster
6. Check your terminal logs for `[WEBHOOK] ====== REQUEST RECEIVED ======`

## Troubleshooting

### ngrok shows "Session Expired"
- Sign up for a free ngrok account at https://dashboard.ngrok.com
- Get your authtoken
- Run: `ngrok config add-authtoken YOUR_TOKEN`

### Webhook not receiving requests
- Verify the URL in Neynar is exactly: `https://your-url.ngrok-free.app/api/farcaster-webhook`
- Check that your dev server is running on port 3000
- Check ngrok is forwarding to port 3000
- Verify webhook is enabled in Neynar dashboard

### 401 Unauthorized errors
- Check that `NEYNAR_WEBHOOK_SECRET` in `.env.local` matches the secret in Neynar
- Or remove the secret from both sides to skip verification (not recommended)

## Quick Commands

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Test webhook endpoint
curl https://your-ngrok-url.ngrok-free.app/api/farcaster-webhook
```

