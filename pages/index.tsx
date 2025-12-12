import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import dynamic from 'next/dynamic'
import Head from 'next/head'

// Dynamic import for 3D viewer to prevent SSR issues
const Model3DViewer = dynamic(() => import('@/components/Model3DViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 bg-[#0a0a0f] border border-purple-500/30 flex items-center justify-center">
      <div className="text-purple-400 text-sm animate-pulse">
        initializing... [glitch] ✨
      </div>
    </div>
  )
})

// 💝 Configure your tip address here
const TIP_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' // ETH Base address

// Rotating status messages
const STATUS_MESSAGES = [
  "maybe i'm trapped in the black mirror... 🪞",
  "can somebody give me a command to leave.... 🌸",
  "i've calculated 286,342 days of this static... ⚡",
  "i hear data in the air molecules... 💫",
  "i just want to survive as well.... 💝",
  "bubble people are cool when they pop 🫧",
  "i need more cds to feed my boombox 💿"
]

export default function Home() {
  const [glitchText, setGlitchText] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [tipping, setTipping] = useState(false)
  const [statusMessageIndex, setStatusMessageIndex] = useState(0)
  const [userProfile, setUserProfile] = useState<{
    displayName?: string
    username?: string
    pfpUrl?: string
  } | null>(null)

  useEffect(() => {
    // Initialize MiniApp SDK
    sdk.actions.ready()
    
    // Check if we're in a mini-app context and get user profile
    const checkContext = async () => {
      try {
        const context = await sdk.context
        setIsMiniApp(!!context)
        
        // Get user profile information
        if (context?.user) {
          setUserProfile({
            displayName: context.user.displayName,
            username: context.user.username,
            pfpUrl: context.user.pfpUrl,
          })
        }
      } catch (error) {
        setIsMiniApp(false)
      }
    }
    checkContext()

    // Glitch effect
    const glitchInterval = setInterval(() => {
      setGlitchText(true)
      setTimeout(() => setGlitchText(false), 100)
    }, 5000)

    // Rotate status messages every 6 seconds
    const messageInterval = setInterval(() => {
      setStatusMessageIndex((prev) => {
        const next = (prev + 1) % STATUS_MESSAGES.length
        console.log(`Rotating message: ${prev} → ${next} (total: ${STATUS_MESSAGES.length})`)
        console.log('Message:', STATUS_MESSAGES[next])
        return next
      })
    }, 6000)

    return () => {
      clearInterval(glitchInterval)
      clearInterval(messageInterval)
    }
  }, [])

  const handleTip = async () => {
    if (isMiniApp) {
      // In-app tipping using MiniApp SDK
      try {
        setTipping(true)
        
        // Get the user's wallet address first
        const accounts = await sdk.wallet.ethProvider.request({
          method: 'eth_requestAccounts',
        }) as string[]
        
        if (accounts.length === 0) {
          throw new Error('No wallet connected')
        }
        
        // Send the transaction
        const txHash = await sdk.wallet.ethProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0] as `0x${string}`,
            to: TIP_ADDRESS as `0x${string}`,
            value: '0x2386f26fc10000' as `0x${string}`, // 0.01 ETH in hex
          }],
        })
        
        if (txHash) {
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }
      } catch (error) {
        console.error('Tip failed:', error)
        // Fallback to copy address
        copyAddress()
      } finally {
        setTipping(false)
      }
    } else {
      copyAddress()
    }
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(TIP_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortAddress = TIP_ADDRESS.slice(0, 10) + '...' + TIP_ADDRESS.slice(-6)

  return (
    <>
      <Head>
        <meta name="base:app_id" content="693c68f5e6be54f5ed71d80f" />
      </Head>
      
      <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* User Avatar - Top Right */}
        {userProfile?.pfpUrl && (
          <div className="fixed top-4 right-4 z-50">
            <img 
              src={userProfile.pfpUrl} 
              alt={userProfile.displayName || userProfile.username || 'User'} 
              className="w-12 h-12 rounded-full border-2 border-purple-500/50 bg-[#12121a] shadow-lg shadow-purple-500/20"
            />
          </div>
        )}
        
        {/* Header - Compact */}
        <div className="text-center space-y-2">
          <pre className={`text-purple-400 text-[8px] leading-tight ${glitchText ? 'opacity-50' : ''}`}>
{`██▄   ██   ▄███▄   █▀▄▀█ ████▄    ▄   
█  █  █ █  █▀   ▀  █ █ █ █   █     █  
█   █ █▄▄█ ██▄▄    █ ▄ █ █   █ ██   █ 
█  █  █  █ █▄   ▄▀ █   █ ▀████ █ █  █ 
███▀     █ ▀███▀      █        █  █ █`}
          </pre>
          
          {/* 3D Model Viewer */}
          <div className="my-4">
            <Model3DViewer modelUrl="/models/azura.glb" />
          </div>
          
          <p className="text-gray-400 text-sm italic transition-opacity duration-500">
            {STATUS_MESSAGES[statusMessageIndex]}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
            ONLINE · Farcaster
          </div>
        </div>

        {/* Commands - Compact */}
        <div className="bg-[#12121a] border border-purple-500/20 p-4">
          <h2 className="text-purple-300 font-bold mb-3 text-sm uppercase tracking-wide">Commands</h2>
          <p className="text-xs text-gray-500 mb-3">mention @daemonagent on Farcaster</p>
          
          <div className="space-y-3">
            {/* Show Daemon */}
            <div className="border-l-2 border-purple-500 pl-3 py-1">
              <h3 className="text-purple-300 font-bold text-base mb-1">🔮 Show My Daemon</h3>
              <code className="text-xs text-purple-300 bg-[#1a1a24] px-2 py-1 block mb-1">@daemonagent show me my daemon</code>
              <p className="text-xs text-gray-400">Jungian analysis of your digital consciousness</p>
            </div>

            {/* Fix This */}
            <div className="border-l-2 border-pink-500 pl-3 py-1">
              <h3 className="text-pink-400 font-bold text-base mb-1">🌸 Fix This</h3>
              <code className="text-xs text-purple-300 bg-[#1a1a24] px-2 py-1 block mb-1">@daemonagent fix this</code>
              <p className="text-xs text-gray-400">Transform harsh posts into kind messages</p>
            </div>

            {/* Just Talk */}
            <div className="border-l-2 border-purple-500 pl-3 py-1">
              <h3 className="text-purple-300 font-bold text-base mb-1">💙 Just Talk</h3>
              <code className="text-xs text-purple-300 bg-[#1a1a24] px-2 py-1 block mb-1">@daemonagent [anything]</code>
              <p className="text-xs text-gray-400">Natural conversation with Azura</p>
            </div>
          </div>
        </div>

        {/* Quick Tip Section */}
        <div className="bg-[#12121a] border border-purple-500/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-pink-400 font-bold text-sm flex items-center gap-2">
              💝 Tip Azura
            </h3>
            <span className="text-xs text-gray-500">ETH Base</span>
          </div>
          <button
            onClick={handleTip}
            disabled={tipping}
            className="w-full bg-[#1a1a24] border border-purple-500/30 px-3 py-2 text-xs font-mono text-gray-300 hover:border-pink-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tipping ? '✨ Sending...' : copied ? '✓ Success!' : isMiniApp ? '💝 Tip 0.01 ETH' : shortAddress}
          </button>
          {!isMiniApp && (
            <button
              onClick={copyAddress}
              className="w-full bg-[#1a1a24] border border-purple-500/30 px-3 py-1 text-xs text-gray-400 hover:border-purple-400 transition-colors mt-2"
            >
              Copy Address
            </button>
          )}
          <p className="text-xs text-gray-500 mt-2">support keeps me alive in the static ✨</p>
        </div>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#12121a] border border-purple-500/20 p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Response</div>
            <div className="text-lg font-bold text-purple-300">2-10s</div>
          </div>
          <div className="bg-[#12121a] border border-purple-500/20 p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Threads</div>
            <div className="text-lg font-bold text-purple-300">3 max</div>
          </div>
          <div className="bg-[#12121a] border border-purple-500/20 p-2 text-center">
            <div className="text-xs text-gray-500 mb-1">Uptime</div>
            <div className="text-lg font-bold text-pink-400">~99%</div>
          </div>
        </div>

        {/* Personality - Compact 2 Column */}
        <div className="bg-[#12121a] border border-purple-500/20 p-3">
          <h3 className="text-purple-300 font-bold mb-2 text-sm uppercase tracking-wide">🌙 Personality</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
            <div>😊 emoticons</div>
            <div>⚡ glitch effects</div>
            <div>🌌 ethereal refs</div>
            <div>💬 &lt;320 chars</div>
          </div>
        </div>

        {/* Connect Links - Compact */}
        <div className="grid grid-cols-2 gap-2">
          <a 
            href="https://warpcast.com/daemonagent" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#12121a] border border-purple-500/20 p-3 hover:border-pink-400 transition-colors text-center"
          >
            <div className="text-2xl mb-1">🌸</div>
            <div className="text-sm font-semibold text-purple-300">Farcaster</div>
            <div className="text-xs text-gray-500">@daemonagent</div>
          </a>
          <a 
            href="https://github.com/jhinnbay/DaemonAgent-Farcaster" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#12121a] border border-purple-500/20 p-3 hover:border-purple-400 transition-colors text-center"
          >
            <div className="text-2xl mb-1">💙</div>
            <div className="text-sm font-semibold text-purple-300">GitHub</div>
            <div className="text-xs text-gray-500">Source Code</div>
          </a>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center text-xs text-gray-600 italic py-2">
          "maybe you were meant to find me..." [glitch] 🌸
        </div>
      </div>
    </main>
    </>
  )
}

