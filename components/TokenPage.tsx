import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import TokenomicsCycle from './TokenomicsCycle'

// DAEMON Token Contract
const DAEMON_CONTRACT = '0x715389db05be6279bb69012242ba8380d2439b07'
const BASE_CHAIN_ID = 8453

export default function TokenPage() {
  const [isMiniApp, setIsMiniApp] = useState(false)

  useEffect(() => {
    // Check if we're in a Farcaster mini-app context
    const checkContext = async () => {
      try {
        const context = await sdk.context
        setIsMiniApp(!!context)
      } catch (error) {
        setIsMiniApp(false)
      }
    }
    checkContext()
  }, [])

  const handleSwap = async () => {
    try {
      if (isMiniApp) {
        // Use Farcaster's native swap feature through Warpcast
        // Warpcast is Farcaster's native client with built-in swap
        const swapUrl = `https://warpcast.com/~/swap?token=${DAEMON_CONTRACT}&chainId=${BASE_CHAIN_ID}`
        await sdk.actions.openUrl(swapUrl)
      } else {
        // Fallback: open in browser with Farcaster's native swap interface
        const swapUrl = `https://warpcast.com/~/swap?token=${DAEMON_CONTRACT}&chainId=${BASE_CHAIN_ID}`
        window.open(swapUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Error opening swap:', error)
      // Final fallback: use Farcaster's native swap URL
      const swapUrl = `https://warpcast.com/~/swap?token=${DAEMON_CONTRACT}&chainId=${BASE_CHAIN_ID}`
      window.open(swapUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div 
      className="w-full px-4 py-6 pb-32"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {/* Tokenomics Cycle */}
      <TokenomicsCycle />

      {/* Swap Feature */}
      <div className="w-full mb-4">
        <button
          onClick={handleSwap}
          className="flex items-center justify-center gap-3 p-5 transition-all hover:scale-[1.02] w-full cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(113, 119, 255, 0.15) 0%, rgba(18, 18, 26, 0.9) 100%)',
            borderRadius: '14px 10px 18px 8px',
            border: '1px solid rgba(113, 119, 255, 0.3)',
            textDecoration: 'none'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="#7177FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[#7177FF] text-sm font-semibold uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Swap $DAEMON
          </span>
        </button>
      </div>

      {/* Pattern Image */}
      <div className="w-full mb-8">
        <img 
          src="/pattern2.png" 
          alt="Pattern" 
          className="w-full h-auto"
          style={{
            borderRadius: '12px 8px 16px 10px',
            opacity: 0.8
          }}
        />
      </div>

    </div>
  )
}
