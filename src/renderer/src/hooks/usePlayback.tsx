import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '@/store/projectStore'

interface PlaybackContextType {
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  isPlaying: boolean
  currentTime: number
}

const PlaybackContext = createContext<PlaybackContextType | null>(null)

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const { project, timeline, setCurrentTime, setPlaying } = useProjectStore()
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const currentTimeRef = useRef(timeline.currentTime)

  currentTimeRef.current = timeline.currentTime

  const getMaxTime = useCallback(() => {
    if (!project) return 60
    return project.tracks.reduce((max, t) => {
      return Math.max(max, ...t.clips.map(c => c.timelineStart + c.timelineDuration))
    }, 60)
  }, [project])

  const tick = useCallback(() => {
    if (!lastTimeRef.current) lastTimeRef.current = performance.now()
    const now = performance.now()
    const delta = (now - lastTimeRef.current) / 1000
    lastTimeRef.current = now

    const nextTime = currentTimeRef.current + delta
    const maxTime = getMaxTime()

    if (nextTime >= maxTime) {
      setCurrentTime(maxTime)
      setPlaying(false)
      return
    }

    setCurrentTime(nextTime)
    animFrameRef.current = requestAnimationFrame(tick)
  }, [setCurrentTime, setPlaying, getMaxTime])

  useEffect(() => {
    if (timeline.playing) {
      const maxTime = getMaxTime()
      if (timeline.currentTime >= maxTime) {
        setCurrentTime(0)
      }
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(animFrameRef.current)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [timeline.playing])

  const play = useCallback(() => setPlaying(true), [setPlaying])
  const pause = useCallback(() => setPlaying(false), [setPlaying])
  const togglePlay = useCallback(
    () => setPlaying(!timeline.playing),
    [timeline.playing, setPlaying]
  )
  const seek = useCallback(
    (time: number) => setCurrentTime(Math.max(0, time)),
    [setCurrentTime]
  )

  return (
    <PlaybackContext.Provider
      value={{
        play,
        pause,
        togglePlay,
        seek,
        isPlaying: timeline.playing,
        currentTime: timeline.currentTime,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  )
}
