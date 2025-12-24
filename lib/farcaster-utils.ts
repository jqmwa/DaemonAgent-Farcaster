// Utilities for working with Farcaster user data

export interface FarcasterUser {
  fid?: number
  username?: string
  displayName?: string
  pfpUrl?: string
  walletAddress?: string
}

// Get FID from username using Neynar API
export async function getFidFromUsername(username: string): Promise<number | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || process.env.NEYNAR_API_KEY
    if (!apiKey) {
      console.warn('[Farcaster Utils] No Neynar API key found')
      return null
    }

    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`, {
      headers: { 'x-api-key': apiKey },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.result?.user?.fid || null
  } catch (error) {
    console.error('[Farcaster Utils] Error fetching FID:', error)
    return null
  }
}

// Get wallet address from Farcaster SDK
export async function getWalletAddress(): Promise<string | null> {
  try {
    // Try to get wallet from Farcaster SDK
    const { sdk } = await import('@farcaster/miniapp-sdk')
    const provider = await sdk.wallet.getEthereumProvider()
    
    if (provider) {
      const accounts = await provider.request({ method: 'eth_accounts' })
      return accounts?.[0] || null
    }
    
    return null
  } catch (error) {
    console.error('[Farcaster Utils] Error getting wallet:', error)
    return null
  }
}

