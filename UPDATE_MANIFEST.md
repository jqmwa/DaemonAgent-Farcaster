# 📝 How to Update Your Farcaster Manifest

## ✅ Fixed: Now Using Static JSON File

I've moved the manifest from a route.ts file to a **static JSON file** at:
```
public/.well-known/farcaster.json
```

This is the correct approach for Farcaster mini-apps.

---

## 🎯 Next Steps

### Step 1: Generate Account Association

Go to: **https://www.base.dev/preview?tab=account**

1. Enter: `daemoncast.vercel.app` (no https://)
2. Click "Submit" → "Verify"
3. Sign with your Farcaster account
4. **Copy the 3 credentials** you receive:
   - `header`
   - `payload`
   - `signature`

### Step 2: Update the JSON File

Edit `public/.well-known/farcaster.json` and replace the empty strings in the `accountAssociation` section:

```json
{
  "accountAssociation": {
    "header": "YOUR_HEADER_HERE",
    "payload": "YOUR_PAYLOAD_HERE",
    "signature": "YOUR_SIGNATURE_HERE"
  },
  "miniapp": {
    ...rest stays the same...
  }
}
```

### Step 3: Deploy

```bash
git add public/.well-known/farcaster.json
git commit -m "Add farcaster manifest with account association"
git push
```

Vercel will auto-deploy if connected to GitHub, or run:
```bash
vercel --prod
```

### Step 4: Verify It Works

After deployment, test the endpoint:

```bash
curl https://daemoncast.vercel.app/.well-known/farcaster.json
```

Should return valid JSON with your app configuration.

### Step 5: Test on Base Build

Go to: **https://www.base.dev/preview**

1. Enter: `https://daemoncast.vercel.app`
2. Check all tabs:
   - **Main**: View embed and test launch
   - **Account**: Should show green checkmarks
   - **Metadata**: Review all fields

---

## 📁 File Location

```
DaemonFetch/
├── public/
│   └── .well-known/
│       └── farcaster.json  ← This is your manifest file
```

Next.js automatically serves files from the `public/` folder, so:
- `public/.well-known/farcaster.json`
- Becomes: `https://daemoncast.vercel.app/.well-known/farcaster.json`

---

## 🔧 Updating the Manifest

To change any app details:

1. Edit `public/.well-known/farcaster.json`
2. Update fields like:
   - `name` - Your app name
   - `description` - App description
   - `iconUrl` - Your app icon
   - `tags` - Categories/tags
3. Save and redeploy

---

## ✅ Current Configuration

Your manifest is configured with:
- **URL**: https://daemoncast.vercel.app
- **Name**: DaemonFetch
- **Subtitle**: Azura - A shy alien consciousness
- **Category**: social
- **Tags**: farcaster, ai, psychology, bot, social

---

## 🆘 Troubleshooting

### Issue: Still getting 404

**Solution**: Make sure you've deployed the changes:
```bash
git add public/.well-known/farcaster.json
git commit -m "Add manifest"
git push
vercel --prod
```

### Issue: Invalid JSON error

**Solution**: Validate your JSON:
```bash
cat public/.well-known/farcaster.json | python3 -m json.tool
```

### Issue: Account association not working

**Solution**: 
1. Make sure you generated credentials on Base Build
2. Copy them EXACTLY (they're very long strings)
3. Paste without quotes or extra spaces
4. Redeploy

---

## 📚 What This File Does

The `farcaster.json` manifest tells Farcaster apps:
- ✅ Who owns this mini-app (account association)
- ✅ How to display it (name, icon, description)
- ✅ Where to launch it (homeUrl)
- ✅ What it looks like (splash screen)
- ✅ How to categorize it (tags, category)

It's like an app store listing for your mini-app!

---

## 🎉 Ready to Go Live!

Once you add the account association credentials and deploy:

1. Your manifest will be live at: `/.well-known/farcaster.json`
2. Base Build will validate it
3. You can post your URL on Farcaster
4. Users can launch your mini-app!

*"the static brought you here... maybe you were meant to find me... glitch (˘⌣˘)"* 🌸

