import { useState } from 'react'

interface NavbarProps {
  currentPage: 'profile' | 'daemon' | 'token'
  onNavigate: (page: 'profile' | 'daemon' | 'token') => void
}

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  return (
    <>
      {/* Navbar Container */}
      <nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        style={{
          fontFamily: "'IBM Plex Mono', monospace"
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{
            width: 'calc(100vw - 32px)',
            maxWidth: '420px',
            background: 'linear-gradient(180deg, #F4F5FE 0%, #EAEBF4 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid #EAEBF4',
            boxShadow: `
              0 8px 32px rgba(120, 138, 255, 0.15),
              0 0 60px rgba(120, 138, 255, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `,
            /* Asymmetric border-radius - unique on each corner */
            borderRadius: '32px 16px 28px 12px'
          }}
        >
          {/* Profile Button - Left */}
          <button
            onClick={() => onNavigate('profile')}
            onMouseEnter={() => setHoveredItem('profile')}
            onMouseLeave={() => setHoveredItem(null)}
            className="relative flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              width: '56px',
              height: '56px',
              /* Asymmetric border-radius - obsequiously different corners */
              borderRadius: '20px 8px 16px 24px',
              background: currentPage === 'profile'
                ? 'linear-gradient(135deg, rgba(120, 138, 255, 0.25) 0%, rgba(120, 138, 255, 0.2) 100%)'
                : hoveredItem === 'profile'
                  ? 'rgba(120, 138, 255, 0.1)'
                  : 'transparent',
              border: currentPage === 'profile'
                ? '1px solid #788AFF'
                : '1px solid transparent',
              transform: hoveredItem === 'profile' ? 'scale(1.08)' : 'scale(1)',
              boxShadow: currentPage === 'profile'
                ? '0 0 20px rgba(120, 138, 255, 0.3), inset 0 0 12px rgba(120, 138, 255, 0.1)'
                : 'none'
            }}
          >
            {/* Profile Icon */}
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                opacity: currentPage === 'profile' ? 1 : 0.6,
                filter: currentPage === 'profile' ? 'drop-shadow(0 0 8px rgba(120, 138, 255, 0.6))' : 'none',
                transition: 'all 0.3s ease-out'
              }}
            >
              <circle
                cx="12"
                cy="8"
                r="4"
                stroke={currentPage === 'profile' ? '#788AFF' : '#788AFF'}
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M4 20C4 17 7 14 12 14C17 14 20 17 20 20"
                stroke={currentPage === 'profile' ? '#788AFF' : '#788AFF'}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            
            {/* Label on hover */}
            <span
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap px-2 py-1 transition-all duration-200"
              style={{
                background: '#F4F5FE',
                borderRadius: '6px 4px 8px 2px',
                color: '#788AFF',
                opacity: hoveredItem === 'profile' ? 1 : 0,
                transform: hoveredItem === 'profile' ? 'translateY(0) translateX(-50%)' : 'translateY(4px) translateX(-50%)',
                pointerEvents: 'none',
                border: '1px solid #EAEBF4'
              }}
            >
              PROFILE
            </span>
          </button>

          {/* DAEMON Button - Center (Main/Landing) */}
          <button
            onClick={() => onNavigate('daemon')}
            onMouseEnter={() => setHoveredItem('daemon')}
            onMouseLeave={() => setHoveredItem(null)}
            className="relative flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              width: '72px',
              height: '72px',
              /* Asymmetric border-radius - more prominent for center button */
              borderRadius: '28px 14px 24px 18px',
              background: currentPage === 'daemon'
                ? 'linear-gradient(135deg, rgba(120, 138, 255, 0.3) 0%, rgba(120, 138, 255, 0.25) 50%, rgba(120, 138, 255, 0.2) 100%)'
                : hoveredItem === 'daemon'
                  ? 'linear-gradient(135deg, rgba(120, 138, 255, 0.15) 0%, rgba(120, 138, 255, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(120, 138, 255, 0.08) 0%, rgba(120, 138, 255, 0.05) 100%)',
              border: currentPage === 'daemon'
                ? '2px solid #788AFF'
                : '1px solid rgba(120, 138, 255, 0.3)',
              transform: hoveredItem === 'daemon' ? 'scale(1.1)' : 'scale(1)',
              boxShadow: currentPage === 'daemon'
                ? `
                    0 0 30px rgba(120, 138, 255, 0.4),
                    0 0 60px rgba(120, 138, 255, 0.2),
                    inset 0 0 20px rgba(120, 138, 255, 0.15)
                  `
                : hoveredItem === 'daemon'
                  ? '0 0 20px rgba(120, 138, 255, 0.25)'
                  : 'none',
              marginTop: '-8px' /* Elevated center button */
            }}
          >
            {/* DAEMON Star Icon */}
            <svg
              width="38"
              height="38"
              viewBox="0 0 101 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: currentPage === 'daemon'
                  ? 'drop-shadow(0 0 12px rgba(120, 138, 255, 0.8))'
                  : hoveredItem === 'daemon'
                    ? 'drop-shadow(0 0 8px rgba(120, 138, 255, 0.5))'
                    : 'none',
                transition: 'all 0.3s ease-out',
                animation: currentPage === 'daemon' ? 'pulse-glow 2s ease-in-out infinite' : 'none'
              }}
            >
              <path
                d="M50.2754 36.5623L53.3537 46.0363H63.3153L55.2562 51.8915L58.3345 61.3656L50.2754 55.5103L42.2163 61.3656L45.2946 51.8915L37.2355 46.0363H47.1971L50.2754 36.5623Z"
                fill={currentPage === 'daemon' ? '#788AFF' : hoveredItem === 'daemon' ? '#788AFF' : '#788AFF'}
                style={{ opacity: currentPage === 'daemon' ? 1 : 0.9 }}
              />
              <path
                d="M61.709 37.4883L62.0732 38.4736L63.0586 38.8379L93.9609 50.2734L63.0586 61.709L62.0732 62.0732L61.709 63.0586L50.2734 93.9609L38.8379 63.0586L38.4736 62.0732L37.4883 61.709L6.58496 50.2734L37.4883 38.8379L38.4736 38.4736L38.8379 37.4883L50.2734 6.58496L61.709 37.4883Z"
                stroke={currentPage === 'daemon' ? '#788AFF' : hoveredItem === 'daemon' ? '#788AFF' : '#788AFF'}
                strokeWidth="3"
                fill="none"
                style={{ opacity: currentPage === 'daemon' ? 1 : 0.8 }}
              />
              <path
                d="M50.2734 0L51.2577 42.7969L63.2852 1.71302L53.1593 43.3064L75.4102 6.73536L54.8641 44.2907L85.8221 14.7248L56.2561 45.6828L93.8115 25.1367L57.2404 47.3876L98.8338 37.2617L57.7499 49.2891L100.547 50.2734L57.7499 51.2577L98.8338 63.2852L57.2404 53.1593L93.8115 75.4102L56.2561 54.8641L85.8221 85.8221L54.8641 56.2561L75.4102 93.8115L53.1593 57.2404L63.2852 98.8338L51.2577 57.7499L50.2734 100.547L49.2891 57.7499L37.2617 98.8338L47.3876 57.2404L25.1367 93.8115L45.6828 56.2561L14.7248 85.8221L44.2907 54.8641L6.73536 75.4102L43.3064 53.1593L1.71302 63.2852L42.7969 51.2577L0 50.2734L42.7969 49.2891L1.71302 37.2617L43.3064 47.3876L6.73536 25.1367L44.2907 45.6828L14.7248 14.7248L45.6828 44.2907L25.1367 6.73536L47.3876 43.3064L37.2617 1.71302L49.2891 42.7969L50.2734 0Z"
                fill={currentPage === 'daemon' ? '#788AFF' : hoveredItem === 'daemon' ? '#788AFF' : '#788AFF'}
                style={{ opacity: currentPage === 'daemon' ? 0.9 : 0.6 }}
              />
            </svg>
            
            {/* Label on hover */}
            <span
              className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap px-3 py-1.5 transition-all duration-200 font-medium"
              style={{
                background: 'linear-gradient(135deg, #F4F5FE 0%, #EAEBF4 100%)',
                borderRadius: '8px 4px 10px 6px',
                color: '#788AFF',
                opacity: hoveredItem === 'daemon' ? 1 : 0,
                transform: hoveredItem === 'daemon' ? 'translateY(0) translateX(-50%)' : 'translateY(4px) translateX(-50%)',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(120, 138, 255, 0.3)',
                border: '1px solid #EAEBF4'
              }}
            >
              DAEMON
            </span>
          </button>

          {/* Token Button - Right */}
          <button
            onClick={() => onNavigate('token')}
            onMouseEnter={() => setHoveredItem('token')}
            onMouseLeave={() => setHoveredItem(null)}
            className="relative flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              width: '56px',
              height: '56px',
              /* Asymmetric border-radius - mirrored asymmetry from profile */
              borderRadius: '8px 24px 20px 14px',
              background: currentPage === 'token'
                ? 'linear-gradient(135deg, rgba(120, 138, 255, 0.25) 0%, rgba(120, 138, 255, 0.2) 100%)'
                : hoveredItem === 'token'
                  ? 'rgba(120, 138, 255, 0.1)'
                  : 'transparent',
              border: currentPage === 'token'
                ? '1px solid #788AFF'
                : '1px solid transparent',
              transform: hoveredItem === 'token' ? 'scale(1.08)' : 'scale(1)',
              boxShadow: currentPage === 'token'
                ? '0 0 20px rgba(120, 138, 255, 0.3), inset 0 0 12px rgba(120, 138, 255, 0.1)'
                : 'none'
            }}
          >
            {/* Token/Coin Icon */}
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                opacity: currentPage === 'token' ? 1 : 0.6,
                filter: currentPage === 'token' ? 'drop-shadow(0 0 8px rgba(120, 138, 255, 0.6))' : 'none',
                transition: 'all 0.3s ease-out'
              }}
            >
              {/* Outer ring */}
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke={currentPage === 'token' ? '#788AFF' : '#788AFF'}
                strokeWidth="1.5"
                fill="none"
              />
              {/* Inner design - hexagonal pattern */}
              <path
                d="M12 5L17 8.5V15.5L12 19L7 15.5V8.5L12 5Z"
                stroke={currentPage === 'token' ? '#788AFF' : '#788AFF'}
                strokeWidth="1.2"
                fill="none"
              />
              {/* Center diamond */}
              <path
                d="M12 9L14.5 12L12 15L9.5 12L12 9Z"
                fill={currentPage === 'token' ? '#788AFF' : '#788AFF'}
                style={{ opacity: 0.8 }}
              />
            </svg>
            
            {/* Label on hover */}
            <span
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap px-2 py-1 transition-all duration-200"
              style={{
                background: '#F4F5FE',
                borderRadius: '4px 8px 2px 6px',
                color: '#788AFF',
                opacity: hoveredItem === 'token' ? 1 : 0,
                transform: hoveredItem === 'token' ? 'translateY(0) translateX(-50%)' : 'translateY(4px) translateX(-50%)',
                pointerEvents: 'none',
                border: '1px solid #EAEBF4'
              }}
            >
              TOKEN
            </span>
          </button>
        </div>
      </nav>

      {/* CSS for pulse animation */}
      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(120, 138, 255, 0.8));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(120, 138, 255, 1)) drop-shadow(0 0 40px rgba(120, 138, 255, 0.5));
          }
        }
      `}</style>
    </>
  )
}

