import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { getEligibleInviteLists, getMintTransaction, SCATTER_COLLECTION_SLUG, type MintList } from '@/lib/scatter-api'

interface MintModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MintModal({ isOpen, onClose }: MintModalProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [mintLists, setMintLists] = useState<MintList[]>([])
  const [selectedList, setSelectedList] = useState<MintList | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'minting' | 'success'>('select')
  const [collectionAddress, setCollectionAddress] = useState<string | null>(null)
  const [collectionChainId, setCollectionChainId] = useState<number | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Get wallet address from Farcaster SDK
  useEffect(() => {
    if (isOpen) {
      const getWallet = async () => {
        try {
          // Use Farcaster SDK's wallet provider
          const provider = await sdk.wallet.getEthereumProvider()
          
          if (!provider) {
            setError('Wallet provider not available. Please ensure you are using the Farcaster app.')
            return
          }
          
          // Request accounts
          const accounts = await provider.request({ method: 'eth_accounts' })
          
          if (accounts && accounts.length > 0 && accounts[0]) {
            console.log('Found wallet address:', accounts[0])
            setWalletAddress(accounts[0])
            setError(null)
          } else {
            // Request access if not already connected
            try {
              const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' })
              if (requestedAccounts && requestedAccounts.length > 0 && requestedAccounts[0]) {
                console.log('Got wallet address after request:', requestedAccounts[0])
                setWalletAddress(requestedAccounts[0])
                setError(null)
              } else {
                setError('No wallet address found. Please connect your wallet in the Farcaster app.')
              }
            } catch (requestError) {
              console.error('Error requesting accounts:', requestError)
              setError('Please connect your wallet in the Farcaster app to continue.')
            }
          }
        } catch (err) {
          console.error('Error getting wallet:', err)
          setError('Failed to get wallet address. Please ensure your wallet is connected in the Farcaster app.')
        }
      }
      getWallet()
    }
  }, [isOpen])

  // Fetch collection info and eligible mint lists
  useEffect(() => {
    if (isOpen && walletAddress) {
      setLoading(true)
      setError(null)
      
      // First fetch collection info to get address and chain ID
      fetch('/api/scatter/collection')
        .then(async (res) => {
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to fetch collection info')
          }
          return res.json()
        })
        .then(async (collectionInfo) => {
          if (collectionInfo.address) {
            setCollectionAddress(collectionInfo.address)
            setCollectionChainId(collectionInfo.chainId || 8453)
            
            // Then fetch mint lists if we have an address
            try {
              const lists = await getEligibleInviteLists({
                collectionSlug: SCATTER_COLLECTION_SLUG,
                walletAddress: walletAddress,
              })
              if (Array.isArray(lists)) {
                setMintLists(lists)
                if (lists.length > 0) {
                  setSelectedList(lists[0])
                }
              }
            } catch (listError) {
              console.error('Error fetching mint lists:', listError)
              // Don't throw - collection info is loaded, just no lists
            }
          } else {
            throw new Error('Collection address not found')
          }
        })
        .catch((err) => {
          console.error('Error fetching collection info or mint lists:', err)
          setError(err.message || 'Failed to fetch collection information')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, walletAddress])

  const handleMint = async () => {
    if (!selectedList || !walletAddress || !collectionAddress || !collectionChainId) return

    try {
      setLoading(true)
      setError(null)
      setStep('minting')

      // Get mint transaction
      const mintResponse = await getMintTransaction({
        collectionAddress: collectionAddress,
        chainId: collectionChainId,
        minterAddress: walletAddress,
        lists: [{ id: selectedList.id, quantity: 1 }],
      })

      // Use Farcaster SDK's wallet provider to send transaction
      const provider = await sdk.wallet.getEthereumProvider()
      
      if (!provider) {
        throw new Error('Wallet provider not available. Please ensure you are using the Farcaster app.')
      }
      
      // Switch to correct network if needed
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${collectionChainId.toString(16)}` }],
        })
      } catch (switchError: any) {
        // If chain doesn't exist, add it (for Base)
        if (switchError.code === 4902 && collectionChainId === 8453) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          })
        } else {
          throw switchError
        }
      }
      
      // Send transaction
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: mintResponse.mintTransaction.to,
          value: mintResponse.mintTransaction.value,
          data: mintResponse.mintTransaction.data,
        }],
      })
      
      setTxHash(txHash)
      setStep('success')
    } catch (err) {
      console.error('Mint error:', err)
      setError(err instanceof Error ? err.message : 'Failed to mint')
      setStep('select')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="relative bg-[#12121a] border border-[#7177FF]/20 p-6 rounded-lg"
        style={{
          maxWidth: '500px',
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          style={{ fontSize: '24px', lineHeight: '1' }}
        >
          ×
        </button>

        {/* Header */}
        <h2
          className="text-[#7177FF] font-bold mb-4 text-xl uppercase tracking-wide"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Mint Your Angel
        </h2>

        {!walletAddress ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Loading wallet...</p>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>
        ) : step === 'select' ? (
          <>
            {loading && mintLists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Loading mint lists...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/50 p-4 rounded mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : mintLists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No eligible mint lists found</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Select Mint List</label>
                  <select
                    value={selectedList?.id || ''}
                    onChange={(e) => {
                      const list = mintLists.find((l) => l.id === e.target.value)
                      setSelectedList(list || null)
                    }}
                    className="w-full bg-[#0a0a0f] border border-white/20 text-white p-2 rounded focus:outline-none focus:border-[#7177FF]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {mintLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} - {list.token_price} {list.currency_symbol}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedList && (
                  <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded mb-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price:</span>
                        <span className="text-white">
                          {selectedList.token_price} {selectedList.currency_symbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Wallet Limit:</span>
                        <span className="text-white">
                          {selectedList.wallet_limit === 4294967295 ? 'Unlimited' : selectedList.wallet_limit}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleMint}
                  disabled={loading || !selectedList}
                  className="w-full px-6 py-3 bg-[#7177FF] text-white hover:bg-[#5a5fcc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {loading ? 'Processing...' : 'Mint Angel'}
                </button>
              </>
            )}
          </>
        ) : step === 'minting' ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7177FF]"></div>
            </div>
            <p className="text-gray-400 mb-2">Confirming transaction in your wallet...</p>
          </div>
        ) : step === 'success' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-white text-lg mb-2">Mint Successful!</p>
            <p className="text-gray-400 text-sm mb-4">Your angel has been minted</p>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7177FF] text-sm hover:underline"
              >
                View on BaseScan
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-[#7177FF] text-white hover:bg-[#5a5fcc] transition-colors rounded"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
