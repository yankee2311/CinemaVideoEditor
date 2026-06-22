import { useRef, useCallback } from 'react'

interface WaveformEntry {
  samples: number[]
  sampleRate: number
  duration: number
}

const MAX_CACHE = 50

export function useWaveformCache() {
  const cacheRef = useRef<Map<string, WaveformEntry>>(new Map())

  const getWaveform = useCallback(async (
    filePath: string,
    startTime: number,
    duration: number,
    sampleRate: number = 100,
  ): Promise<WaveformEntry> => {
    const key = `${filePath}|${startTime}|${duration}|${sampleRate}`
    const cached = cacheRef.current.get(key)
    if (cached) return cached

    try {
      const data = await window.cineflow.getWaveform(filePath, startTime, duration, sampleRate)
      if (cacheRef.current.size >= MAX_CACHE) {
        const firstKey = cacheRef.current.keys().next().value
        if (firstKey) cacheRef.current.delete(firstKey)
      }
      cacheRef.current.set(key, data)
      return data
    } catch {
      return { samples: [], sampleRate, duration: 0 }
    }
  }, [])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  return { getWaveform, clearCache }
}
