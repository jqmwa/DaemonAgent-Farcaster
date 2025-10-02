#!/bin/bash

# Add environment variables to Vercel
echo "Adding environment variables to Vercel..."

# Add NEYNAR_API_KEY
echo "FEB33320-2F19-4848-92E8-832650B710CC" | vercel env add NEYNAR_API_KEY production

# Add NEYNAR_SIGNER_UUID  
echo "16c3bfb7-0031-4678-a5df-ce0a64e4a13b" | vercel env add NEYNAR_SIGNER_UUID production

# Add DEEPSEEK_API_KEY
echo "sk-59678a5df50d49aba71e8fa8d4028c1f" | vercel env add DEEPSEEK_API_KEY production

echo "Environment variables added successfully!"
