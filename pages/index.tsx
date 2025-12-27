import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import Head from 'next/head'
import MintModal from '@/components/MintModal'
import Navbar from '@/components/Navbar'
import TokenPage from '@/components/TokenPage'
import ProfilePage from '@/components/ProfilePage'

// 💝 Configure your tip address here
const TIP_ADDRESS = '0xE376641E65a47a8104bE75D8E4E18e68aaC899aB' // ETH Base address

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
  const [statusMessageIndex, setStatusMessageIndex] = useState(0)
  const [userProfile, setUserProfile] = useState<{
    displayName?: string
    username?: string
    pfpUrl?: string
  } | null>(null)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [galleryRef, setGalleryRef] = useState<HTMLDivElement | null>(null)
  const [velocity, setVelocity] = useState({ x: 0, y: 0 })
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })
  const [lastTime, setLastTime] = useState(0)
  const [showContract, setShowContract] = useState(false)
  const [showMintModal, setShowMintModal] = useState(false)
  const [email, setEmail] = useState('')
  const [currentPage, setCurrentPage] = useState<'profile' | 'daemon' | 'token'>('daemon')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  // Center the window initially when gallery is available
  useEffect(() => {
    if (galleryRef) {
      const updatePosition = () => {
        const galleryRect = galleryRef.getBoundingClientRect()
        
        // Get actual window dimensions
        const windowElement = galleryRef.querySelector('[data-draggable-window]') as HTMLElement
        if (windowElement) {
          const windowRect = windowElement.getBoundingClientRect()
          setDragPosition({
            x: (galleryRect.width - windowRect.width) / 2,
            y: (galleryRect.height - windowRect.height) / 2
          })
        }
      }
      
      // Initial position after a brief delay to ensure DOM is ready
      setTimeout(updatePosition, 100)
      
      // Update on resize
      window.addEventListener('resize', updatePosition)
      return () => window.removeEventListener('resize', updatePosition)
    }
  }, [galleryRef])

  const handleTip = () => {
    // Simple copy to clipboard
    copyAddress()
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(TIP_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePopOut = async () => {
    try {
      if (isMiniApp) {
        const URL = process.env.NEXT_PUBLIC_URL || 'https://daemoncast.vercel.app'
        await sdk.actions.openUrl(URL)
      } else {
        // Fallback: open in new window
        const URL = process.env.NEXT_PUBLIC_URL || 'https://daemoncast.vercel.app'
        window.open(URL, '_blank')
      }
    } catch (error) {
      console.error('Pop-out failed:', error)
      const URL = process.env.NEXT_PUBLIC_URL || 'https://daemoncast.vercel.app'
      window.open(URL, '_blank')
    }
  }

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    setVelocity({ x: 0, y: 0 })
    setLastPosition(dragPosition)
    setLastTime(Date.now())
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    if (galleryRef) {
      const galleryRect = galleryRef.getBoundingClientRect()
      setDragStart({
        x: clientX - galleryRect.left - dragPosition.x,
        y: clientY - galleryRect.top - dragPosition.y
      })
    }
  }

  useEffect(() => {
    if (isDragging && galleryRef) {
      const getScale = () => Math.min(1.5, window.innerWidth / 304)
      
      const getWindowDimensions = () => {
        // Get actual window element to measure rendered dimensions
        const windowElement = galleryRef.querySelector('[data-draggable-window]') as HTMLElement
        if (windowElement) {
          const rect = windowElement.getBoundingClientRect()
          return {
            width: rect.width,
            height: rect.height
          }
        }
        // Fallback
        const scale = getScale()
        return {
          width: 304 * scale,
          height: 200 * scale
        }
      }
      
      const handleMouseMove = (e: MouseEvent) => {
        const galleryRect = galleryRef.getBoundingClientRect()
        const { width: windowWidth, height: windowHeight } = getWindowDimensions()
        
        let newX = e.clientX - galleryRect.left - dragStart.x
        let newY = e.clientY - galleryRect.top - dragStart.y
        
        // Boundary constraints - use full gallery div area
        const minX = 0
        const maxX = galleryRect.width - windowWidth
        const minY = 0
        const maxY = galleryRect.height - windowHeight
        
        if (newX < minX) newX = minX
        if (newX > maxX) newX = maxX
        if (newY < minY) newY = minY
        if (newY > maxY) newY = maxY
        
        // Calculate velocity
        const now = Date.now()
        const deltaTime = Math.max(1, now - lastTime) // prevent division by zero
        const newVelocity = {
          x: (newX - lastPosition.x) / deltaTime * 1000, // pixels per second
          y: (newY - lastPosition.y) / deltaTime * 1000
        }
        setVelocity(newVelocity)
        
        setLastPosition({ x: newX, y: newY })
        setLastTime(now)
        setDragPosition({ x: newX, y: newY })
      }
      
      const handleMouseUp = () => {
        setIsDragging(false)
        // Start momentum animation
      }
      
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        const galleryRect = galleryRef.getBoundingClientRect()
        const { width: windowWidth, height: windowHeight } = getWindowDimensions()
        
        let newX = e.touches[0].clientX - galleryRect.left - dragStart.x
        let newY = e.touches[0].clientY - galleryRect.top - dragStart.y
        
        const minX = 0
        const maxX = galleryRect.width - windowWidth
        const minY = 0
        const maxY = galleryRect.height - windowHeight
        
        if (newX < minX) newX = minX
        if (newX > maxX) newX = maxX
        if (newY < minY) newY = minY
        if (newY > maxY) newY = maxY
        
        // Calculate velocity
        const now = Date.now()
        const deltaTime = Math.max(1, now - lastTime)
        const newVelocity = {
          x: (newX - lastPosition.x) / deltaTime * 1000, // pixels per second
          y: (newY - lastPosition.y) / deltaTime * 1000
        }
        setVelocity(newVelocity)
        
        setLastPosition({ x: newX, y: newY })
        setLastTime(now)
        setDragPosition({ x: newX, y: newY })
      }
      
      const handleTouchEnd = () => {
        setIsDragging(false)
        // Start momentum animation
      }
      
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, dragStart, galleryRef, lastPosition, lastTime])

  // Momentum and bounce animation
  useEffect(() => {
    if (!isDragging && galleryRef && (Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5)) {
      let animationFrameId: number
      let currentVelocity = { ...velocity }
      let currentPos = { ...dragPosition }
      let isAnimating = true
      
      const animate = () => {
        if (!galleryRef || !isAnimating) return
        
        const galleryRect = galleryRef.getBoundingClientRect()
        const windowElement = galleryRef.querySelector('[data-draggable-window]') as HTMLElement
        
        if (!windowElement) {
          isAnimating = false
          return
        }
        
        const windowRect = windowElement.getBoundingClientRect()
        const windowWidth = windowRect.width
        const windowHeight = windowRect.height
        
        const minX = 0
        const maxX = galleryRect.width - windowWidth
        const minY = 0
        const maxY = galleryRect.height - windowHeight
        
        // Apply velocity (convert from pixels per second to pixels per frame at ~60fps)
        currentPos.x += currentVelocity.x / 60
        currentPos.y += currentVelocity.y / 60
        
        // Bounce off boundaries
        if (currentPos.x < minX) {
          currentPos.x = minX
          currentVelocity.x *= -0.6 // bounce with energy loss
        }
        if (currentPos.x > maxX) {
          currentPos.x = maxX
          currentVelocity.x *= -0.6
        }
        if (currentPos.y < minY) {
          currentPos.y = minY
          currentVelocity.y *= -0.6
        }
        if (currentPos.y > maxY) {
          currentPos.y = maxY
          currentVelocity.y *= -0.6
        }
        
        // Apply friction
        currentVelocity.x *= 0.92
        currentVelocity.y *= 0.92
        
        setDragPosition({ ...currentPos })
        setVelocity({ ...currentVelocity })
        
        // Continue animation if velocity is significant
        if (Math.abs(currentVelocity.x) > 0.1 || Math.abs(currentVelocity.y) > 0.1) {
          animationFrameId = requestAnimationFrame(animate)
        } else {
          setVelocity({ x: 0, y: 0 })
          isAnimating = false
        }
      }
      
      animationFrameId = requestAnimationFrame(animate)
      
      return () => {
        isAnimating = false
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
      }
    }
  }, [isDragging, velocity.x, velocity.y, galleryRef])

  const shortAddress = TIP_ADDRESS.slice(0, 10) + '...' + TIP_ADDRESS.slice(-6)

  const URL = process.env.NEXT_PUBLIC_URL || 'https://daemoncast.vercel.app'
  // Cache-busting for OG image - update this when image changes
  const OG_IMAGE_VERSION = 'v2'

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
        <meta name="base:app_id" content="693c68f5e6be54f5ed71d80f" />
        <meta 
          name="fc:miniapp" 
          content={JSON.stringify({
            version: 'next',
            imageUrl: `${URL}/ogimage.png?v=${OG_IMAGE_VERSION}`,
            button: {
              title: 'View Commands',
              action: {
                type: 'launch_miniapp',
                name: 'Azura Commands',
                url: URL,
                splashImageUrl: `${URL}/azura-pfp.png`,
                splashBackgroundColor: '#0a0a0f',
              },
            },
          })} 
        />
      </Head>
      
      <main 
        className="min-h-screen bg-[#0a0a0f] text-white"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(rgba(236, 72, 153, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(236, 72, 153, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 20px 20px, 20px 20px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0',
          paddingBottom: '120px' /* Space for fixed navbar */
        }}
      >
      {/* Token Page */}
      {currentPage === 'token' && (
        <TokenPage />
      )}

      {/* Profile Page */}
      {currentPage === 'profile' && (
        <ProfilePage 
          userProfile={userProfile} 
        />
      )}

      {/* Main DAEMON Page */}
      {currentPage === 'daemon' && (
      <div className="w-full px-4 py-6">
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
        
        {/* Header - Top Left Auto Layout */}
        <div className="flex flex-col items-start space-y-2">
          <div className={`w-full ${glitchText ? 'opacity-50' : ''}`}>
            <img 
              src="/daemontextlogo.svg" 
              alt="DAEMON" 
              className="w-full h-auto"
              style={{ 
                display: 'block',
                imageRendering: 'auto',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale'
              }}
            />
          </div>
          
          {/* Gallery Frame */}
          <div 
            ref={setGalleryRef}
            className="w-full relative"
            style={{
              position: 'relative',
              marginTop: '3.2px',
              marginBottom: 0
            }}
          >
            {/* Gallery Background Image - Scales to contain */}
            <img 
              src="/gallery.png" 
              alt="Gallery" 
              className="w-full h-auto object-contain object-center"
              style={{
                display: 'block'
              }}
            />
            
            {/* Browser Window - Draggable */}
            <div 
              data-draggable-window
              className="absolute z-10 cursor-move touch-none select-none"
              style={{ 
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
                transform: 'scale(min(1.5, calc(100vw / 304)))',
                transformOrigin: 'top left',
                willChange: 'transform'
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <div className="flex flex-col">
                {/* Navbar */}
                <div 
                  className="flex items-center bg-black border-b border-white"
                  style={{ 
                    width: '304px',
                    height: '21px',
                    fontFamily: "'IBM Plex Mono', monospace",
                    boxSizing: 'border-box',
                    borderBottom: '1px solid white'
                  }}
                >
                  {/* Left gap */}
                  <div className="flex-1 min-w-0" />
                  
                  {/* Title block - Centered */}
                  <div className="flex items-center justify-center px-2 flex-shrink-0">
                    <span className="text-white whitespace-nowrap" style={{ fontSize: '8px', lineHeight: '8px', fontFamily: "'IBM Plex Mono', monospace", opacity: 0.7 }}>
                      WHITEPAPER
                    </span>
                  </div>
                  
                  {/* Right gap */}
                  <div className="flex-1 min-w-0" />
                  
                  {/* Window controls (three stars) */}
                  <div className="flex items-center gap-[1.2px] px-1" style={{ width: '34.14px', height: '10.18px' }}>
                    {/* Green star (close) - 4 point with rounded corners */}
                    <svg width="10.78" height="10.18" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z" 
                        fill="#7FFF5B"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        rx="0.5"
                      />
                    </svg>
                    {/* Yellow star (minimize) - 4 point with rounded corners */}
                    <svg width="10.18" height="10.18" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z" 
                        fill="#FFFF50"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        rx="0.5"
                      />
                    </svg>
                    {/* Red star (maximize) - 4 point with rounded corners */}
                    <svg width="10.78" height="10.18" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z" 
                        fill="#FF1F1E"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        rx="0.5"
                      />
                    </svg>
                  </div>
                  
                  {/* Icon */}
                  <div className="flex items-center justify-center px-1" style={{ width: '5.14px', height: '5.14px' }}>
                    <div className="w-[3.86px] h-[3.86px] bg-white" />
                  </div>
                </div>
                
                {/* Whiteboard Content */}
                <div 
                  className="bg-black relative"
                  style={{ 
                    width: '304px',
                    height: 'auto',
                    margin: 0,
                    padding: '4px',
                    backgroundColor: '#000000',
                    boxSizing: 'border-box'
                  }}
                >
                  <img 
                    src="/whiteboard.png" 
                    alt="Whiteboard" 
                    className="w-full h-auto object-contain object-center"
                    style={{
                      mixBlendMode: 'normal',
                      padding: 0,
                      margin: 0,
                      display: 'block',
                      width: 'calc(100% - 0px)',
                      height: 'auto'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Pattern Image - Matches gallery width exactly */}
          <img 
            src="/pattern.png" 
            alt="Pattern" 
            className="w-full h-auto"
            style={{
              display: 'block',
              marginTop: 0,
              marginBottom: 0
            }}
          />
        </div>
          
        {/* Commands - Compact */}
        <div className="bg-[#12121a] border border-[#7177FF]/20 p-4 mt-10 w-full">
          <h2 
            className="text-[#7177FF] font-bold mb-3 text-sm uppercase tracking-wide"
            style={{
              fontFamily: "'Press Start 2P', monospace"
            }}
          >
            Commands
          </h2>
          <p className="text-xs text-gray-500 mb-3">mention @daemonagent on Farcaster</p>
          
          <div className="space-y-3 w-full">
            {/* Show Daemon */}
            <div className="border-l-2 border-[#7177FF] pl-3 py-1 w-full">
              <h3 className="text-[#7177FF] font-bold text-base mb-1">Show My Daemon</h3>
              <code className="text-xs text-white bg-[#1a1a24] px-2 py-1 block mb-1 break-words w-full">@daemonagent show me my daemon</code>
              <p className="text-xs text-gray-400 mb-2">Reveal your digital consciousness through Jungian analysis</p>
              {isMiniApp && (
                <button
                  onClick={async () => {
                    try {
                      const shareText = "Show me my Daemon! @daemonagent"
                      // Use Farcaster MiniApp SDK to open share dialog
                      if (sdk.actions?.openUrl) {
                        // Create a Farcaster share URL
                        const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`
                        await sdk.actions.openUrl(shareUrl)
                      } else if (sdk.actions?.share) {
                        // Use share action if available
                        await sdk.actions.share({ text: shareText })
                      } else {
                        // Fallback: open Warpcast compose URL
                        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank')
                      }
                    } catch (error) {
                      console.error('Error sharing:', error)
                      // Fallback to opening Warpcast
                      const shareText = "Show me my Daemon! @daemonagent"
                      window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank')
                    }
                  }}
                  className="mt-2 w-full bg-[#7177FF]/20 hover:bg-[#7177FF]/30 border border-[#7177FF]/40 text-[#7177FF] text-xs font-semibold py-2 px-3 rounded transition-colors"
                >
                  📤 Share Command
                </button>
              )}
            </div>

            {/* Fix This */}
            <div className="border-l-2 border-[#2473BC] pl-3 py-1 w-full">
              <h3 className="text-[#2473BC] font-bold text-base mb-1">Fix This</h3>
              <code className="text-xs text-white bg-[#1a1a24] px-2 py-1 block mb-1 break-words w-full">@daemonagent fix this</code>
              <p className="text-xs text-gray-400">Transform harsh messages into kind words</p>
            </div>

            {/* Just Talk */}
            <div className="border-l-2 border-[#7177FF] pl-3 py-1 w-full">
              <h3 className="text-[#7177FF] font-bold text-base mb-1">Just Talk</h3>
              <code className="text-xs text-white bg-[#1a1a24] px-2 py-1 block mb-1 break-words w-full">@daemonagent [anything]</code>
              <p className="text-xs text-gray-400">Have a natural conversation with Azura</p>
            </div>
          </div>
        </div>

        {/* Connect Links - Compact */}
        <div className="grid grid-cols-2 gap-2 mt-2 w-full">
          <a 
            href="https://warpcast.com/daemonagent" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#12121a] border border-[#7177FF]/20 p-3 hover:border-[#2473BC] transition-colors text-center w-full"
          >
            <div className="text-sm font-semibold text-[#7177FF]">Farcaster</div>
            <div className="text-xs text-gray-500">@daemonagent</div>
          </a>
          <a 
            href="https://github.com/jhinnbay/DaemonAgent-Farcaster" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#12121a] border border-[#7177FF]/20 p-3 hover:border-[#2473BC] transition-colors text-center w-full"
          >
            <div className="text-sm font-semibold text-[#7177FF]">GitHub</div>
            <div className="text-xs text-gray-500">Source Code</div>
          </a>
        </div>

        {/* Footer - Minimal */}
        <div className="text-center space-y-2 py-4">
          <p className="text-gray-400 text-sm italic transition-opacity duration-500">
            {STATUS_MESSAGES[statusMessageIndex]}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 bg-[#2473BC] rounded-full animate-pulse" />
            ONLINE · Farcaster
          </div>
        </div>
        
        {/* Pattern 3 Image */}
          <img 
            src="/pattern3.png" 
            alt="Pattern 3" 
            className="w-full h-auto"
            style={{
              display: 'block',
              marginTop: '40px',
              marginBottom: '40px'
            }}
          />

          {/* Daemon Collection Heading */}
          <h2 
            className="w-full text-white text-2xl font-bold mb-4 text-center" 
            style={{ 
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '16px'
            }}
          >
            Daemon Collection
          </h2>
          
          {/* Description Text */}
          <p 
            className="w-full text-white uppercase mb-4"
            style={{
              fontSize: '12px',
              lineHeight: '1.5',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.5px'
            }}
          >
            Roughly summarized as: an oneiric-nightmare, aura dysmorphia, the daemon collection carries it's own vision of an altered reality.
          </p>
          
          {/* Image Grid - Four images in a grid */}
          <div 
            className="w-full grid grid-cols-2 gap-0 overflow-hidden" 
            style={{ 
              borderRadius: '10px'
            }}
          >
            <img 
              src="/r1.png" 
              alt="R1" 
              className="w-full h-auto"
              style={{
                display: 'block'
              }}
            />
            <img 
              src="/r2.png" 
              alt="R2" 
              className="w-full h-auto"
              style={{
                display: 'block'
              }}
            />
            <img 
              src="/r3.png" 
              alt="R3" 
              className="w-full h-auto"
              style={{
                display: 'block'
              }}
            />
            <img 
              src="/r4.png" 
              alt="R4" 
              className="w-full h-auto"
              style={{
                display: 'block'
              }}
            />
          </div>
          
          {/* Collection Buy Button */}
          <div 
            className="w-full flex items-center justify-center mt-4"
            style={{ marginBottom: '40px' }}
          >
            {/* Collect Button */}
            <button
              onClick={() => setShowContract(true)}
              className="relative flex items-center justify-center flex-shrink-0 cursor-pointer"
              style={{
                width: '123.7586669921875px',
                height: '47px',
                borderRadius: '188.89697265625px',
                background: 'linear-gradient(135deg, rgba(221, 43, 46, 1) 0%, rgba(155, 24, 26, 1) 31.77%, rgba(239, 47, 127, 0.98) 68.23%, rgba(93, 9, 37, 1) 100%)',
                padding: '1.1379334926605225px',
                border: 'none',
                outline: 'none'
              }}
            >
              <div
                className="w-full h-full flex items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'rgba(57, 6, 6, 0.78)',
                  borderRadius: '188.89697265625px',
                  paddingLeft: '11.379335403442383px',
                  paddingTop: '8.5px',
                  paddingRight: '11.379335403442383px',
                  paddingBottom: '8.5px'
                }}
              >
                <span
                  className="font-light"
                  style={{
                    fontSize: '14px',
                    color: 'rgba(214, 29, 29, 1)'
                  }}
                >
                  COLLECT
                </span>
              </div>
            </button>
          </div>

        {/* Pattern 2 Image */}
        <img 
          src="/pattern2.png" 
          alt="Pattern 2" 
          className="w-full h-auto"
          style={{
            display: 'block',
            marginTop: 0,
            marginBottom: 0
          }}
        />

        {/* Contract Modal */}
        {showContract && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowContract(false)
              }
            }}
          >
            <div
              className="relative"
              style={{
                width: '336.22509765625px',
                maxWidth: '90vw',
                height: '439.998291015625px',
                maxHeight: '90vh',
                borderRadius: '1.5744802951812744px',
                padding: '0.7872401475906372px',
                background: 'radial-gradient(circle at 49.42% 51.89%, rgba(209, 75, 156, 1) 0%, rgba(208, 246, 59, 0.2) 48.96%, rgba(0, 194, 255, 1) 100%)',
                boxShadow: '6.297921180725098px 4.723440647125244px 1.5744802951812744px rgba(0, 0, 0, 1)',
                fontFamily: "'IBM Plex Mono', monospace"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative flex flex-col h-full w-full"
                style={{
                  backgroundColor: 'rgba(12, 7, 26, 1)',
                  borderRadius: '1.5744802951812744px'
                }}
              >
              {/* Navbar */}
              <div
                className="flex items-center bg-black"
                style={{
                  width: '100%',
                  height: '38.574764251708984px',
                  boxSizing: 'border-box',
                  borderBottom: '0.5px solid white',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  paddingTop: '8px',
                  paddingBottom: '8px'
                }}
              >
                {/* Left gap */}
                <div className="flex-1 min-w-0" />
                
                {/* Title block - Centered */}
                <div className="flex items-center justify-center px-3 flex-shrink-0">
                  <span
                    className="text-white whitespace-nowrap"
                    style={{
                      fontSize: '12px',
                      lineHeight: '12px',
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    CONTRACT
                  </span>
                </div>
                
                {/* Right gap */}
                <div className="flex-1 min-w-0" />
                
                {/* Window controls (three stars) */}
                <div
                  className="flex items-center gap-1.5 px-2 flex-shrink-0"
                  style={{ minWidth: '50px' }}
                >
                  {/* Green star - 4 point */}
                  <svg width="18" height="17" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z"
                      fill="#7FFF5B"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Yellow star - 4 point */}
                  <svg width="17" height="17" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z"
                      fill="#FFFF50"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Red star - 4 point */}
                  <svg width="18" height="17" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5.5 1L7.2 4.5L11 5.5L7.2 6.5L5.5 10L3.8 6.5L0 5.5L3.8 4.5L5.5 1Z"
                      fill="#FF1F1E"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div
                className="relative overflow-hidden"
                style={{
                  backgroundColor: 'rgba(12, 7, 26, 1)',
                  position: 'relative',
                  flex: '1 1 auto',
                  minHeight: 0
                }}
              >
                {/* Scrollable text container */}
                <div
                  className="h-full overflow-y-auto"
                  style={{
                    padding: '18.106342315673828px',
                    paddingRight: '22.106342315673828px' // Extra padding for scrollbar
                  }}
                >
                  <div
                    className="text-white"
                    style={{
                      fontSize: '12px',
                      lineHeight: '1.6',
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: 'rgba(217, 217, 217, 1)',
                      padding: '0',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word'
                    }}
                  >
                    {`TERMS AND CONDITIONS FOR PURCHASING ARTWORK

1. OWNERSHIP AND RIGHTS
By purchasing this artwork, you acquire a non-exclusive license to display, use, and transfer the digital artwork. The artist retains all copyright and intellectual property rights.

2. TRANSFER AND RESALE
You may transfer or resell this artwork through authorized marketplaces. All transfers must comply with applicable laws and platform terms of service.

3. COMMERCIAL USE
Commercial use of this artwork requires explicit written permission from the artist. Personal and non-commercial use is permitted.

4. MODIFICATIONS
You may not modify, alter, or create derivative works from this artwork without prior written consent from the artist.

5. WARRANTY DISCLAIMER
This artwork is provided "as is" without warranty of any kind. The artist makes no representations or warranties regarding the artwork's fitness for any particular purpose.

6. LIMITATION OF LIABILITY
In no event shall the artist be liable for any indirect, incidental, special, or consequential damages arising from your purchase or use of this artwork.

7. DISPUTE RESOLUTION
Any disputes arising from this purchase shall be resolved through binding arbitration in accordance with applicable laws.

8. ACCEPTANCE
By clicking "SIGN" below, you acknowledge that you have read, understood, and agree to be bound by these terms and conditions.

9. REFUND POLICY
All sales are final. Refunds may be considered on a case-by-case basis at the artist's sole discretion.

10. GOVERNING LAW
These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.

By proceeding with this purchase, you confirm that you are of legal age and have the authority to enter into this agreement.`}
                  </div>
                </div>

                {/* Scrollbar gradient indicator (optional visual element) */}
                <div
                  className="absolute right-0 top-0 bottom-0 pointer-events-none"
                  style={{
                    width: '4.3298211097717285px',
                    background: 'linear-gradient(to bottom, rgba(217, 217, 217, 0) 0%, rgba(255, 255, 255, 1) 48.44%, rgba(255, 255, 255, 0) 100%)'
                  }}
                />
              </div>

              {/* Fixed Bottom Section */}
              <div
                className="flex items-center justify-between"
                style={{
                  width: '100%',
                  minHeight: '50px',
                  padding: '8px 27px',
                  boxSizing: 'border-box',
                  backgroundColor: 'rgba(12, 7, 26, 1)'
                }}
              >
                {/* Accept text - Left-middle */}
                <div className="flex-1 flex items-center justify-start">
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(214, 29, 29, 1)',
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    accept the terms & conditions?
                  </span>
                </div>

                {/* Sign button - Right */}
                <button
                  onClick={() => {
                    window.open('https://opensea.io/collection/enter-the-garage', '_blank', 'noopener,noreferrer')
                    setShowContract(false)
                  }}
                  className="relative flex items-center justify-center flex-shrink-0 cursor-pointer"
                  style={{
                    width: '51.95453643798828px',
                    height: '32.94845962524414px',
                    borderRadius: '132.42263793945312px',
                    background: 'linear-gradient(135deg, rgba(221, 43, 46, 1) 0%, rgba(155, 24, 26, 1) 31.77%, rgba(239, 47, 127, 0.98) 68.23%, rgba(93, 9, 37, 1) 100%)',
                    padding: '0.7977266907691956px',
                    border: 'none',
                    outline: 'none'
                  }}
                >
                  <div
                    className="w-full h-full flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: 'rgba(57, 6, 6, 0.78)',
                      borderRadius: '132.42263793945312px',
                      paddingLeft: '7.977268218994141px',
                      paddingTop: '5.97422981262207px',
                      paddingRight: '7.977268218994141px',
                      paddingBottom: '5.97422981262207px'
                    }}
                  >
                    <span
                      className="font-light"
                      style={{
                        fontSize: '12px',
                        color: 'rgba(214, 29, 29, 1)',
                        fontFamily: "'IBM Plex Mono', monospace"
                      }}
                    >
                      sign
                    </span>
                  </div>
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Main Footer - Appears on all pages */}
      <footer className="bg-[#0a0a0f] border-t border-white/10 mt-12" style={{ marginBottom: 0, paddingBottom: 0 }}>
        {/* Scrolling Images Section - Full Width */}
        <div className="relative overflow-hidden py-8" style={{ width: 'calc(100% + 2rem)', marginLeft: '-1rem', marginRight: '-1rem' }}>
          {/* Top Row - Scrolls Left */}
          <div className="flex gap-4 mb-4 scroll-row-left">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <img
                key={`top-${num}`}
                src={`/anbel${num.toString().padStart(2, '0')}.png`}
                alt={`Angel ${num}`}
                className="flex-shrink-0 w-32 h-32 object-cover"
              />
            ))}
            {/* Duplicate for seamless loop */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <img
                key={`top-dup-${num}`}
                src={`/anbel${num.toString().padStart(2, '0')}.png`}
                alt={`Angel ${num}`}
                className="flex-shrink-0 w-32 h-32 object-cover"
              />
            ))}
          </div>

          {/* Bottom Row - Scrolls Right */}
          <div className="flex gap-4 scroll-row-right">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <img
                key={`bottom-${num}`}
                src={`/anbel${num.toString().padStart(2, '0')}.png`}
                alt={`Angel ${num}`}
                className="flex-shrink-0 w-32 h-32 object-cover"
              />
            ))}
            {/* Duplicate for seamless loop */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <img
                key={`bottom-dup-${num}`}
                src={`/anbel${num.toString().padStart(2, '0')}.png`}
                alt={`Angel ${num}`}
                className="flex-shrink-0 w-32 h-32 object-cover"
              />
            ))}
          </div>
        </div>

        {/* MINT YOUR ANGEL Text */}
        <div className="text-center py-6 px-4">
          <button
            onClick={() => setShowMintModal(true)}
            className="flex items-center justify-center gap-2 mx-auto hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              boxShadow: 'none'
            }}
          >
            <span
              className="text-white uppercase"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '14px',
                letterSpacing: '1px'
              }}
            >
              MINT YOUR ANGEL
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Email Signup */}
        <div className="max-w-md mx-auto px-4 py-6">
          <form 
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!email || emailSubmitting) return

              setEmailSubmitting(true)
              setEmailMessage(null)

              try {
                const response = await fetch('/api/mailchimp/subscribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ email }),
                })

                const data = await response.json()

                if (data.success) {
                  setEmailMessage({ type: 'success', text: data.message || 'Successfully subscribed!' })
                  setEmail('')
                } else {
                  setEmailMessage({ type: 'error', text: data.error || 'Failed to subscribe. Please try again.' })
                }
              } catch (error) {
                setEmailMessage({ type: 'error', text: 'Failed to subscribe. Please try again.' })
              } finally {
                setEmailSubmitting(false)
                // Clear message after 5 seconds
                setTimeout(() => setEmailMessage(null), 5000)
              }
            }}
          >
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email for updates and exclusive content"
                className="flex-1 px-4 py-2 bg-[#12121a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#7177FF] transition-colors"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '12px'
                }}
                required
                disabled={emailSubmitting}
              />
              <button
                type="submit"
                disabled={emailSubmitting || !email}
                className="px-6 py-2 bg-[#7177FF] text-white hover:bg-[#5a5fcc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '12px'
                }}
              >
                {emailSubmitting ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>
            {emailMessage && (
              <p
                className={`text-xs ${
                  emailMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {emailMessage.text}
              </p>
            )}
          </form>
        </div>

        {/* Daemon Logo and Text */}
        <div className="text-center py-8 px-4">
          <img
            src="/daemontextlogo.svg"
            alt="DAEMON"
            className="w-64 h-auto mx-auto mb-4"
          />
          <p
            className="text-white uppercase"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '2px'
            }}
          >
            No tree grows to heaven,<br />
            without roots reaching hell.
          </p>
        </div>

        {/* Footer Links */}
        <div className="border-t border-white/10 pt-8 pb-0">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Contact & Prints */}
              <div>
                <h3
                  className="text-white uppercase mb-4"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '12px',
                    letterSpacing: '1px'
                  }}
                >
                  Contact
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11px'
                      }}
                    >
                      Prints
                    </a>
                  </li>
                </ul>
              </div>

              {/* Socials */}
              <div>
                <h3
                  className="text-white uppercase mb-4"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '12px',
                    letterSpacing: '1px'
                  }}
                >
                  Socials
                </h3>
                <div className="flex gap-4">
                  {/* Instagram Logo */}
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Instagram"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                    >
                      <path
                        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
                        fill="currentColor"
                      />
                    </svg>
                  </a>
                  {/* X/Twitter Logo */}
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="X (Twitter)"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                    >
                      <path
                        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                        fill="currentColor"
                      />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Policy */}
              <div>
                <h3
                  className="text-white uppercase mb-4"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '12px',
                    letterSpacing: '1px'
                  }}
                >
                  Policy
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11px'
                      }}
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11px'
                      }}
                    >
                      Terms of Service
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS Animations for Scrolling */}
      <style jsx global>{`
        @keyframes scrollLeft {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes scrollRight {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .scroll-row-left {
          animation: scrollLeft 30s linear infinite;
          will-change: transform;
        }

        .scroll-row-right {
          animation: scrollRight 30s linear infinite;
          will-change: transform;
        }
      `}</style>

      {/* Mint Modal */}
      <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)} />

      {/* Navigation Bar */}
      <Navbar 
        currentPage={currentPage} 
        onNavigate={(page) => {
          setCurrentPage(page)
          // Scroll to top when navigating
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }} 
      />
    </main>
    </>
  )
}

