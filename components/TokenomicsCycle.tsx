import { useState } from 'react'

interface CycleStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

export default function TokenomicsCycle() {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)

  const steps: CycleStep[] = [
    {
      id: 'buy',
      title: 'BUY',
      description: 'Acquire $DAEMON tokens to start your journey',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      color: '#EF2F7F'
    },
    {
      id: 'stake',
      title: 'STAKE',
      description: 'Lock your $DAEMON to earn passive rewards over time',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
        </svg>
      ),
      color: '#7177FF'
    },
    {
      id: 'purify',
      title: 'PURIFY',
      description: 'Purify staked DAEMON, making it harvestable',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14 8L20 8L15 12L17 18L12 14L7 18L9 12L4 8L10 8L12 2Z" fill="currentColor" />
        </svg>
      ),
      color: '#FFD700'
    },
    {
      id: 'harvest',
      title: 'HARVEST',
      description: 'Collect your purified DAEMON rewards and DAEMON Points',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3V8M12 8L9 5M12 8L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 21V16M12 16L9 19M12 16L15 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M3 12H6M18 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      color: '#2473BC'
    }
  ]

  return (
    <div className="w-full py-6">
      <h2 
        className="text-[#7177FF] uppercase tracking-wider mb-6 text-center"
        style={{ 
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px'
        }}
      >
        The DAEMON Cycle
      </h2>

      {/* Cycle Visualization */}
      <div className="relative w-full" style={{ minHeight: '300px' }}>
        {/* Circular path/arrows */}
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 400 300"
          style={{ overflow: 'visible' }}
        >
          {/* Arrow paths connecting steps */}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#7177FF" opacity="0.6" />
            </marker>
          </defs>
          
          {/* Path from Buy to Stake */}
          <path
            d="M 100 80 Q 150 50 200 80"
            stroke="#7177FF"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Stake to Purify */}
          <path
            d="M 320 80 Q 350 120 320 160"
            stroke="#FFD700"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Purify to Harvest */}
          <path
            d="M 320 220 Q 280 250 200 250"
            stroke="#2473BC"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Harvest to Buy (cycle continues) */}
          <path
            d="M 80 250 Q 50 180 80 130"
            stroke="#EF2F7F"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
            strokeDasharray="5,5"
            markerEnd="url(#arrowhead)"
          />
        </svg>

        {/* Step Cards */}
        <div className="relative grid grid-cols-2 gap-6">
          {/* Buy */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('buy')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'buy'
                  ? `linear-gradient(135deg, rgba(239, 47, 127, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '16px 8px 12px 6px',
                border: `2px solid ${hoveredStep === 'buy' ? steps[0].color : 'rgba(239, 47, 127, 0.2)'}`,
                transform: hoveredStep === 'buy' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'buy' ? `0 0 20px ${steps[0].color}40` : 'none'
              }}
            >
              <div 
                className="flex items-center justify-center mb-3"
                style={{ color: steps[0].color }}
              >
                {steps[0].icon}
              </div>
              <h3 
                className="text-center font-bold mb-2"
                style={{ 
                  color: steps[0].color,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '10px'
                }}
              >
                {steps[0].title}
              </h3>
              <p className="text-xs text-gray-400 text-center">
                {steps[0].description}
              </p>
            </div>
          </div>

          {/* Stake */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('stake')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'stake'
                  ? `linear-gradient(135deg, rgba(113, 119, 255, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '8px 16px 6px 12px',
                border: `2px solid ${hoveredStep === 'stake' ? steps[1].color : 'rgba(113, 119, 255, 0.2)'}`,
                transform: hoveredStep === 'stake' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'stake' ? `0 0 20px ${steps[1].color}40` : 'none'
              }}
            >
              <div 
                className="flex items-center justify-center mb-3"
                style={{ color: steps[1].color }}
              >
                {steps[1].icon}
              </div>
              <h3 
                className="text-center font-bold mb-2"
                style={{ 
                  color: steps[1].color,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '10px'
                }}
              >
                {steps[1].title}
              </h3>
              <p className="text-xs text-gray-400 text-center">
                {steps[1].description}
              </p>
            </div>
          </div>

          {/* Purify (with Angel requirement) */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('purify')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all relative"
              style={{
                background: hoveredStep === 'purify'
                  ? `linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '12px 6px 16px 8px',
                border: `2px solid ${hoveredStep === 'purify' ? steps[2].color : 'rgba(255, 215, 0, 0.3)'}`,
                transform: hoveredStep === 'purify' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'purify' ? `0 0 20px ${steps[2].color}40` : 'none'
              }}
            >
              <div 
                className="flex items-center justify-center mb-3"
                style={{ color: steps[2].color }}
              >
                {steps[2].icon}
              </div>
              <h3 
                className="text-center font-bold mb-2"
                style={{ 
                  color: steps[2].color,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '10px'
                }}
              >
                {steps[2].title}
              </h3>
              <p className="text-xs text-gray-400 text-center">
                {steps[2].description}
              </p>
            </div>
          </div>

          {/* Harvest */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('harvest')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'harvest'
                  ? `linear-gradient(135deg, rgba(36, 115, 188, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '6px 12px 8px 16px',
                border: `2px solid ${hoveredStep === 'harvest' ? steps[3].color : 'rgba(36, 115, 188, 0.2)'}`,
                transform: hoveredStep === 'harvest' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'harvest' ? `0 0 20px ${steps[3].color}40` : 'none'
              }}
            >
              <div 
                className="flex items-center justify-center mb-3"
                style={{ color: steps[3].color }}
              >
                {steps[3].icon}
              </div>
              <h3 
                className="text-center font-bold mb-2"
                style={{ 
                  color: steps[3].color,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '10px'
                }}
              >
                {steps[3].title}
              </h3>
              <p className="text-xs text-gray-400 text-center">
                {steps[3].description}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

