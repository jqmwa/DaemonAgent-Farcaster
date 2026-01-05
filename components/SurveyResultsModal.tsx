'use client'

import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

interface SurveyResults {
  surveyId: string
  surveyTitle: string
  answers: Record<number, string>
  analysis: string
  insights: string[]
  timestamp: string
}

interface SurveyResultsModalProps {
  isOpen: boolean
  onClose: () => void
  results: SurveyResults | null
  txHash?: string
}

export default function SurveyResultsModal({ isOpen, onClose, results, txHash }: SurveyResultsModalProps) {
  const [showContent, setShowContent] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && results) {
      // Trigger animation after modal opens
      setTimeout(() => setShowContent(true), 300)
    } else {
      setShowContent(false)
    }
  }, [isOpen, results])

  if (!isOpen || !results) return null

  const handleShareFarcaster = async () => {
    setIsSharing(true)
    setShareError(null)

    try {
      const shareText = `I just completed the "${results.surveyTitle}" survey!\n\n${results.analysis.substring(0, 200)}${results.analysis.length > 200 ? '...' : ''}`

      if (sdk.actions?.composeCast) {
        await sdk.actions.composeCast({
          text: shareText,
        })
      } else {
        // Fallback: open Warpcast compose URL
        const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`
        window.open(composeUrl, '_blank')
      }
    } catch (error) {
      console.error('[SurveyResultsModal] Error sharing to Farcaster:', error)
      setShareError('Failed to share. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareBase = async () => {
    setIsSharing(true)
    setShareError(null)

    try {
      // Create a shareable URL with the results
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const shareUrl = `${baseUrl}/survey-results?survey=${results.surveyId}&tx=${txHash || 'pending'}`
      
      // For Base, we can open a transaction explorer or share URL
      if (txHash) {
        const explorerUrl = `https://basescan.org/tx/${txHash}`
        window.open(explorerUrl, '_blank')
      } else {
        // Copy to clipboard as fallback
        await navigator.clipboard.writeText(shareUrl)
        alert('Results URL copied to clipboard!')
      }
    } catch (error) {
      console.error('[SurveyResultsModal] Error sharing to Base:', error)
      setShareError('Failed to share. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setShowContent(false)
    setTimeout(() => onClose(), 200)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        paddingTop: '100px',
        paddingBottom: '20px',
        paddingLeft: '12px',
        paddingRight: '12px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl flex flex-col"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(12, 12, 18, 0.98) 100%)',
          borderRadius: '16px 8px 12px 6px',
          border: '2px solid rgba(120, 138, 255, 0.4)',
          boxShadow: '0 0 60px rgba(120, 138, 255, 0.3)',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex-shrink-0 p-4 border-b" style={{ background: 'rgba(18, 18, 26, 0.95)', borderColor: 'rgba(120, 138, 255, 0.2)' }}>
          <div className="flex items-center justify-between">
            <h2
              className="text-white font-bold flex-1 pr-3"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '10px',
                lineHeight: '1.3'
              }}
            >
              Survey Complete
            </h2>
            <button
              onClick={(e) => handleClose(e)}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '32px',
                lineHeight: '1',
                padding: '4px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Animated Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }}>
          {/* Success Animation */}
          <div 
            className="flex justify-center mb-6"
            style={{
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-180deg)',
              transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <div
              className="relative"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.3) 0%, rgba(113, 119, 255, 0.2) 100%)',
                border: '3px solid rgba(120, 138, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(120, 138, 255, 0.4)'
              }}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(120, 138, 255, 1)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  opacity: showContent ? 1 : 0,
                  transform: showContent ? 'scale(1)' : 'scale(0)',
                  transition: 'all 0.3s ease 0.2s'
                }}
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>

          {/* Survey Title */}
          <div
            className="text-center mb-6"
            style={{
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.4s ease 0.3s'
            }}
          >
            <h3
              className="text-white font-bold mb-2"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '18px',
                lineHeight: '1.4'
              }}
            >
              {results.surveyTitle}
            </h3>
            {txHash && (
              <p
                className="text-gray-400 text-xs"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  wordBreak: 'break-all'
                }}
              >
                TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            )}
          </div>

          {/* Analysis Text */}
          <div
            className="mb-6 p-4 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.1) 0%, rgba(18, 18, 26, 0.8) 100%)',
              border: '2px solid rgba(120, 138, 255, 0.2)',
              borderRadius: '12px 6px 10px 8px',
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.4s ease 0.4s'
            }}
          >
            <p
              className="text-white leading-relaxed"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '13px',
                lineHeight: '1.6'
              }}
            >
              {results.analysis}
            </p>
          </div>

          {/* Insights */}
          {results.insights && results.insights.length > 0 && (
            <div
              className="mb-6"
              style={{
                opacity: showContent ? 1 : 0,
                transform: showContent ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.4s ease 0.5s'
              }}
            >
              <h4
                className="text-white font-bold mb-3"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '14px'
                }}
              >
                Key Insights
              </h4>
              <div className="space-y-2">
                {results.insights.map((insight, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'rgba(120, 138, 255, 0.08)',
                      border: '1px solid rgba(120, 138, 255, 0.2)',
                      borderRadius: '8px 4px 6px 10px'
                    }}
                  >
                    <p
                      className="text-gray-300"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px',
                        lineHeight: '1.5'
                      }}
                    >
                      • {insight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share Error */}
          {shareError && (
            <div
              className="mb-4 p-3 rounded-lg"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px'
              }}
            >
              <p
                className="text-red-400 text-xs"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}
              >
                {shareError}
              </p>
            </div>
          )}
        </div>

        {/* Footer with Share Buttons */}
        <div
          className="flex-shrink-0 p-4 border-t"
          style={{
            background: 'rgba(18, 18, 26, 0.95)',
            borderColor: 'rgba(120, 138, 255, 0.2)',
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.4s ease 0.6s'
          }}
        >
          <div className="flex gap-3">
            <button
              onClick={handleShareFarcaster}
              disabled={isSharing}
              className="flex-1 px-4 py-3 text-sm uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(120, 138, 255, 0.2) 0%, rgba(120, 138, 255, 0.1) 100%)',
                borderRadius: '8px 4px 6px 10px',
                color: '#788AFF',
                border: '2px solid rgba(120, 138, 255, 0.3)',
                fontSize: '11px',
                fontFamily: "'Press Start 2P', monospace"
              }}
            >
              {isSharing ? 'Sharing...' : 'Share on Farcaster'}
            </button>
            <button
              onClick={handleShareBase}
              disabled={isSharing}
              className="flex-1 px-4 py-3 text-sm uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.2) 0%, rgba(0, 82, 255, 0.1) 100%)',
                borderRadius: '4px 8px 10px 6px',
                color: '#0052FF',
                border: '2px solid rgba(0, 82, 255, 0.3)',
                fontSize: '11px',
                fontFamily: "'Press Start 2P', monospace"
              }}
            >
              {isSharing ? 'Sharing...' : 'View on Base'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
