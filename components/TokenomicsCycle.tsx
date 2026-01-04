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
      id: 'angel',
      title: 'GET ANGEL',
      description: 'Acquire an Angel NFT to participate in surveys',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14 8L20 8L15 12L17 18L12 14L7 18L9 12L4 8L10 8L12 2Z" fill="currentColor" />
          <circle cx="12" cy="12" r="3" fill="currentColor" style={{ opacity: 0.3 }} />
        </svg>
      ),
      color: '#FFD700'
    },
    {
      id: 'start',
      title: 'START QUIZ',
      description: 'Begin a survey to explore your digital consciousness',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      ),
      color: '#EF2F7F'
    },
    {
      id: 'complete',
      title: 'COMPLETE',
      description: 'Finish the survey within the time limit',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      ),
      color: '#7177FF'
    },
    {
      id: 'reward',
      title: 'REWARD',
      description: 'Collect DAEMON Points and unlock your insights',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L13.5 6.5L18 8L13.5 9.5L12 14L10.5 9.5L6 8L10.5 6.5L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
        className="uppercase tracking-wider mb-6 text-center"
        style={{ 
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px',
          color: '#788AFF'
        }}
      >
        The Survey Cycle
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
              <polygon points="0 0, 10 3, 0 6" fill="#788AFF" opacity="0.6" />
            </marker>
          </defs>
          
          {/* Path from Angel to Start */}
          <path
            d="M 100 80 Q 150 50 200 80"
            stroke="#EF2F7F"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Start to Complete */}
          <path
            d="M 320 80 Q 350 120 320 160"
            stroke="#7177FF"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Complete to Reward */}
          <path
            d="M 320 220 Q 280 250 200 250"
            stroke="#2473BC"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
            markerEnd="url(#arrowhead)"
          />
          
          {/* Path from Reward to Angel (cycle continues) */}
          <path
            d="M 80 250 Q 50 180 80 130"
            stroke="#FFD700"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
            strokeDasharray="5,5"
            markerEnd="url(#arrowhead)"
          />
        </svg>

        {/* Step Cards */}
        <div className="relative grid grid-cols-2 gap-6">
          {/* Get Angel */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('angel')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all relative"
              style={{
                background: hoveredStep === 'angel'
                  ? `linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '16px 8px 12px 6px',
                border: `2px solid ${hoveredStep === 'angel' ? steps[0].color : 'rgba(255, 215, 0, 0.3)'}`,
                transform: hoveredStep === 'angel' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'angel' ? `0 0 20px ${steps[0].color}40` : 'none'
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

          {/* Start Quiz */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('start')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'start'
                  ? `linear-gradient(135deg, rgba(239, 47, 127, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '8px 16px 6px 12px',
                border: `2px solid ${hoveredStep === 'start' ? steps[1].color : 'rgba(239, 47, 127, 0.2)'}`,
                transform: hoveredStep === 'start' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'start' ? `0 0 20px ${steps[1].color}40` : 'none'
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

          {/* Complete */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('complete')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'complete'
                  ? `linear-gradient(135deg, rgba(113, 119, 255, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '12px 6px 16px 8px',
                border: `2px solid ${hoveredStep === 'complete' ? steps[2].color : 'rgba(113, 119, 255, 0.2)'}`,
                transform: hoveredStep === 'complete' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'complete' ? `0 0 20px ${steps[2].color}40` : 'none'
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

          {/* Reward */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStep('reward')}
            onMouseLeave={() => setHoveredStep(null)}
          >
            <div
              className="p-4 cursor-pointer transition-all"
              style={{
                background: hoveredStep === 'reward'
                  ? `linear-gradient(135deg, rgba(36, 115, 188, 0.2) 0%, rgba(18, 18, 26, 0.9) 100%)`
                  : 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.95) 100%)',
                borderRadius: '6px 12px 8px 16px',
                border: `2px solid ${hoveredStep === 'reward' ? steps[3].color : 'rgba(36, 115, 188, 0.2)'}`,
                transform: hoveredStep === 'reward' ? 'scale(1.05)' : 'scale(1)',
                boxShadow: hoveredStep === 'reward' ? `0 0 20px ${steps[3].color}40` : 'none'
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

