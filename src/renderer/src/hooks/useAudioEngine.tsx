import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { audioEngine } from '@/engine/audioEngine'

interface AudioEngineContextType {
  engine: typeof audioEngine
  ensureInitialized: () => Promise<void>
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null)

export function useAudioEngine() {
  const ctx = useContext(AudioEngineContext)
  if (!ctx) throw new Error('useAudioEngine must be used within AudioEngineProvider')
  return ctx
}

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const initAttempted = useRef(false)

  const ensureInitialized = useCallback(async (): Promise<void> => {
    if (audioEngine.initialized) return
    try {
      await audioEngine.init()
    } catch (err) {
      console.warn('[AudioEngine] init failed, will retry on user interaction:', err)
    }
  }, [])

  // Try to initialize on mount (may fail due to autoplay policy)
  useEffect(() => {
    if (!initAttempted.current) {
      initAttempted.current = true
      ensureInitialized()
    }
  }, [ensureInitialized])

  // Retry initialization on first user click (autoplay policy workaround)
  useEffect(() => {
    const handler = () => {
      if (!audioEngine.initialized) {
        ensureInitialized()
      }
    }
    window.addEventListener('click', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [ensureInitialized])

  // Dispose on unmount
  useEffect(() => {
    return () => {
      audioEngine.destroy()
    }
  }, [])

  return (
    <AudioEngineContext.Provider value={{ engine: audioEngine, ensureInitialized }}>
      {children}
    </AudioEngineContext.Provider>
  )
}
