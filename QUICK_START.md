# 🚀 Quick Start Guide - Deploy Your Mini App NOW

## TL;DR - Get Live in 15 Minutes

```bash
# 1. Set your URL
echo 'NEXT_PUBLIC_URL=https://your-domain.vercel.app' >> .env.local

# 2. Deploy to Vercel
vercel --prod

# 3. Generate account association at:
# https://www.base.dev/preview?tab=account

# 4. Update credentials in:
# app/.well-known/farcaster.json/route.ts

# 5. Redeploy
vercel --prod

# 6. Post your URL on Base app!
```

---

## Step-by-Step (First Time)

### 1. Install Vercel CLI (if needed)
```bash
npm i -g vercel
vercel login
```

### 2. Set Environment Variable
Create `.env.local` with your current variables + this:
```bash
NEXT_PUBLIC_URL=https://daemonfetch.vercel.app
# Replace with your actual domain after deploying
```

### 3. Deploy
```bash
vercel --prod
```

Copy the production URL you get (e.g., `daemonfetch.vercel.app`)

### 4. Update Environment Variable
Update `NEXT_PUBLIC_URL` in:
- Local `.env.local`
- Vercel Dashboard → Project → Settings → Environment Variables

### 5. Generate Account Association

1. Go to: https://www.base.dev/preview?tab=account
2. Paste your domain (without https://)
3. Click "Submit" → "Verify"
4. Sign with your Farcaster account
5. Copy the three credentials

### 6. Add Credentials

Edit `app/.well-known/farcaster.json/route.ts`:

```typescript
accountAssociation: {
  header: "YOUR_HEADER_HERE",
  payload: "YOUR_PAYLOAD_HERE", 
  signature: "YOUR_SIGNATURE_HERE"
}
```

### 7. Push & Redeploy
```bash
git add .
git commit -m "Add account association"
git push
# Vercel auto-deploys if connected to GitHub
```

### 8. Test
Go to: https://www.base.dev/preview
- Enter your URL
- Test the launch button
- Verify everything works

### 9. Publish
Post on Base app:
```
Meet Azura 🌸

https://your-domain.vercel.app
```

---

## Verification Checklist

✅ Manifest loads: `curl https://your-domain/.well-known/farcaster.json`
✅ Preview tool shows green checkmarks
✅ App launches in preview
✅ User avatar appears
✅ Tip button works

---

## Need Help?

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## Current Status

**Your app is configured with:**
- ✅ MiniApp SDK integrated
- ✅ User avatar (top right)
- ✅ In-app ETH tipping (0.01 ETH)
- ✅ 3D Azura model
- ✅ Rotating status messages
- ✅ All commands visible
- ✅ Manifest route ready
- ✅ Embed metadata configured

**What you need to do:**
1. Deploy to production
2. Generate account association
3. Post on Base app

That's it! 🎉

