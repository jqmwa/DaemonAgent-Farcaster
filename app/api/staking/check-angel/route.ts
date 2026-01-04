import { NextRequest, NextResponse } from 'next/server'

// Angel NFT contract address on Base
const ANGEL_NFT_CONTRACT = '0x39f259b58a9ab02d42bc3df5836ba7fc76a8880f'
const BASE_CHAIN_ID = 8453

// ERC721 balanceOf function selector: balanceOf(address) = 0x70a08231
const BALANCE_OF_SELECTOR = '0x70a08231'

// Check if wallet owns Angel NFT using Alchemy or Base RPC
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const walletAddress = searchParams.get('wallet')
    
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Normalize wallet address (lowercase, remove 0x prefix for encoding)
    const normalizedAddress = walletAddress.toLowerCase()
    const addressWithoutPrefix = normalizedAddress.startsWith('0x') 
      ? normalizedAddress.slice(2) 
      : normalizedAddress

    // Pad address to 32 bytes (64 hex chars) for function call
    const paddedAddress = addressWithoutPrefix.padStart(64, '0')
    
    // Construct the data payload: function selector + padded address
    const callData = BALANCE_OF_SELECTOR + paddedAddress

    // Try Alchemy API first if API key is available
    const alchemyApiKey = process.env.ALCHEMY_API_KEY
    let rpcUrl = 'https://mainnet.base.org'
    
    if (alchemyApiKey) {
      rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
      
      // Try Alchemy's getNFTs endpoint first (more efficient)
      try {
        const alchemyResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'alchemy_getNFTs',
            params: {
              owner: normalizedAddress,
              contractAddresses: [ANGEL_NFT_CONTRACT],
              withMetadata: false,
            },
          }),
        })

        if (alchemyResponse.ok) {
          const data = await alchemyResponse.json()
          if (data.result && data.result.ownedNfts && data.result.ownedNfts.length > 0) {
            return NextResponse.json({
              success: true,
              hasAngel: true,
              walletAddress: normalizedAddress,
              count: data.result.ownedNfts.length
            })
          }
          // If no NFTs found, return false
          if (data.result && (!data.result.ownedNfts || data.result.ownedNfts.length === 0)) {
            return NextResponse.json({
              success: true,
              hasAngel: false,
              walletAddress: normalizedAddress,
              count: 0
            })
          }
        }
      } catch (alchemyError) {
        console.warn('[Check Angel API] Alchemy getNFTs failed, falling back to eth_call:', alchemyError)
      }
    }

    // Fallback: Use eth_call to check balanceOf directly
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: ANGEL_NFT_CONTRACT,
              data: callData,
            },
            'latest',
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`RPC call failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'RPC error')
      }

      // Parse the result (hex string representing uint256)
      const balanceHex = data.result || '0x0'
      const balance = BigInt(balanceHex)
      const hasAngel = balance > 0n

      return NextResponse.json({
        success: true,
        hasAngel,
        walletAddress: normalizedAddress,
        count: hasAngel ? Number(balance) : 0
      })
    } catch (rpcError) {
      console.error('[Check Angel API] RPC check failed:', rpcError)
      throw rpcError
    }
  } catch (error) {
    console.error('[Check Angel API] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

