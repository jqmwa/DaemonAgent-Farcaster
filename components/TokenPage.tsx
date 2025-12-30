import TokenomicsCycle from './TokenomicsCycle'

// DAEMON Token Contract
const DAEMON_CONTRACT = '0x715389db05be6279bb69012242ba8380d2439b07'

export default function TokenPage() {
  return (
    <div 
      className="w-full px-4 py-6 pb-32"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {/* Tokenomics Cycle */}
      <TokenomicsCycle />

      {/* Swap Feature */}
      <div className="w-full mb-4">
        <a
          href={`https://app.uniswap.org/#/swap?outputCurrency=${DAEMON_CONTRACT}&chain=base`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 p-5 transition-all hover:scale-[1.02] w-full"
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
        </a>
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
