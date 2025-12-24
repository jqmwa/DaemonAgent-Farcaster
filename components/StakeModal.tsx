import { useState } from 'react'

interface StakeModalProps {
  isOpen: boolean
  onClose: () => void
  onStake: (amount: string) => Promise<void>
  maxAmount?: string
}

export default function StakeModal({ isOpen, onClose, onStake, maxAmount }: StakeModalProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleStake = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Convert to wei (assuming 18 decimals)
      const amountInWei = (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString()
      
      await onStake(amountInWei)
      
      // Reset and close on success
      setAmount('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stake tokens')
    } finally {
      setLoading(false)
    }
  }

  const handleMax = () => {
    if (maxAmount) {
      try {
        const max = BigInt(maxAmount)
        const maxFormatted = (Number(max) / 1e18).toString()
        setAmount(maxFormatted)
      } catch {
        // If conversion fails, just use the raw amount
        setAmount(maxAmount)
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="relative p-6"
        style={{
          width: '90%',
          maxWidth: '400px',
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(12, 12, 18, 0.98) 100%)',
          borderRadius: '20px 10px 16px 12px',
          border: '1px solid rgba(113, 119, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-white uppercase mb-4"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '14px'
          }}
        >
          Stake $DAEMON
        </h2>

        {error && (
          <div
            className="mb-4 p-3"
            style={{
              background: 'rgba(255, 31, 30, 0.1)',
              borderRadius: '8px 4px 6px 10px',
              border: '1px solid rgba(255, 31, 30, 0.3)'
            }}
          >
            <p className="text-[#FF1F1E] text-xs">{error}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="text-gray-400 text-xs uppercase mb-2 block">
            Amount to Stake
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="flex-1 px-4 py-2 bg-[#12121a] border border-[#7177FF]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#7177FF] transition-colors"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                borderRadius: '8px 4px 6px 10px'
              }}
              disabled={loading}
            />
            {maxAmount && (
              <button
                onClick={handleMax}
                className="px-3 py-2 text-xs uppercase text-[#7177FF] hover:bg-[#7177FF]/10 transition-colors"
                style={{
                  borderRadius: '4px 8px 10px 6px',
                  border: '1px solid rgba(113, 119, 255, 0.3)'
                }}
                disabled={loading}
              >
                MAX
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50"
            style={{
              background: 'rgba(113, 119, 255, 0.1)',
              borderRadius: '8px 4px 6px 10px',
              color: '#7177FF',
              border: '1px solid rgba(113, 119, 255, 0.3)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStake}
            disabled={loading || !amount}
            className="flex-1 px-4 py-2 text-xs uppercase transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(113, 119, 255, 0.2) 0%, rgba(113, 119, 255, 0.1) 100%)',
              borderRadius: '4px 8px 10px 6px',
              color: '#7177FF',
              border: '1px solid rgba(113, 119, 255, 0.3)'
            }}
          >
            {loading ? 'Staking...' : 'Stake'}
          </button>
        </div>
      </div>
    </div>
  )
}

