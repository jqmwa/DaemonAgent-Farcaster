'use client'

import { useEffect, useRef, useState } from 'react'

const TRACKS = [
  { name: 'Heavenly Drift', url: '/Heavenly Drift.mp3' },
  { name: 'Crumbling World', url: '/Crumbling World.wav' },
  { name: 'Digital World', url: '/Digital World.wav' },
  { name: 'Mental Wealth Academy', url: '/Mental Wealth Academy 精神財富学院.wav' },
]

export default function AudioPlayer() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const isInitialMountRef = useRef(true)

  const currentTrack = TRACKS[currentTrackIndex]

  // Set up event listeners once
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Handle track end - move to next track
    const handleEnded = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length)
    }

    // Handle play/pause state
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [])

  // Initialize audio source and autoplay on mount
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.src = currentTrack.url
    audio.load()
    
    // Try to autoplay on initial mount
    if (isInitialMountRef.current) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true)
            isInitialMountRef.current = false
          })
          .catch((error) => {
            // Autoplay was prevented - this is normal in many browsers
            console.log('Autoplay prevented:', error)
            isInitialMountRef.current = false
          })
      }
    }
  }, [])

  // Update audio source when track changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isInitialMountRef.current) return // Skip if initial mount hasn't completed

    const wasPlaying = isPlaying
    audio.src = currentTrack.url
    audio.load()
    
    // Continue playing if it was playing before
    if (wasPlaying) {
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log('Play error:', error)
          setIsPlaying(false)
        })
      }
    }
  }, [currentTrackIndex, currentTrack.url])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length)
  }

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center justify-center px-4 py-2 gap-3">
        {/* Previous Button */}
        <button
          onClick={prevTrack}
          className="text-white/70 hover:text-white transition-colors p-1"
          aria-label="Previous track"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 6L6 18M17 6L10 12L17 18L17 6Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          className="text-white hover:text-[#7177FF] transition-colors p-1"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="6" y="4" width="4" height="16" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" fill="currentColor" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 5L8 19L19 12L8 5Z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>

        {/* Next Button */}
        <button
          onClick={nextTrack}
          className="text-white/70 hover:text-white transition-colors p-1"
          aria-label="Next track"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6L18 18M7 6L14 12L7 18L7 6Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Track Name */}
        <div className="text-white/80 text-xs px-2 min-w-[120px] text-center">
          {currentTrack.name}
        </div>

        {/* Audio Element (hidden) */}
        <audio ref={audioRef} preload="auto" loop={false} autoPlay />
      </div>
    </div>
  )
}

