import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { usePlayback } from '@/hooks/usePlayback'
import { timeToString } from '@/engine/timelineEngine'

const FRAME_DEBOUNCE_MS = 300

export default function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { project, timeline } = useProjectStore()
  const { togglePlay, seek } = usePlayback()
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [frameLoading, setFrameLoading] = useState(false)
  const [usingVideo, setUsingVideo] = useState(false)

  const lastFrameTime = useRef(-1)
  const frameCache = useRef<Map<string, string>>(new Map())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const activeSrcKey = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const getClipAtTime = useCallback(() => {
    if (!project) return null
    for (const track of project.tracks) {
      if (track.type !== 'video') continue
      for (const clip of track.clips) {
        if (
          timeline.currentTime >= clip.timelineStart &&
          timeline.currentTime < clip.timelineStart + clip.timelineDuration
        ) {
          return { clip, track, asset: project.mediaAssets.find(m => m.id === clip.mediaId) ?? null }
        }
      }
    }
    return null
  }, [project, timeline.currentTime])

  const getMaxTime = useCallback(() => {
    if (!project) return 60
    return project.tracks.reduce((max, t) => {
      return Math.max(max, ...t.clips.map(c => c.timelineStart + c.timelineDuration))
    }, 60)
  }, [project])

  useEffect(() => {
    setDuration(getMaxTime())
  }, [getMaxTime])

  // Stable key for the clip at current time (same during playback of one clip)
  const activeClipKey = useMemo(() => {
    const result = getClipAtTime()
    if (!result || !result.asset) return null
    return `${result.asset.id}_${result.clip.id}`
  }, [getClipAtTime])

  const doExtract = useCallback((filePath: string, sourceTime: number, cacheKey: string) => {
    setFrameLoading(true)
    window.cineflow.extractFrameBase64(filePath, sourceTime)
      .then((dataUrl: string) => {
        if (!mountedRef.current) return
        frameCache.current.set(cacheKey, dataUrl)
        if (frameCache.current.size > 50) {
          const firstKey = frameCache.current.keys().next().value
          if (firstKey) frameCache.current.delete(firstKey)
        }
        setCurrentFrame(dataUrl)
        lastFrameTime.current = sourceTime
      })
      .catch(() => {
        if (mountedRef.current) setCurrentFrame(null)
      })
      .finally(() => {
        if (mountedRef.current) setFrameLoading(false)
      })
  }, [])

  const extractCurrentFrame = useCallback(() => {
    const result = getClipAtTime()
    if (!result || !result.asset) {
      setCurrentFrame(null)
      return false
    }

    const { clip, asset } = result
    const localTime = timeline.currentTime - clip.timelineStart
    const sourceTime = clip.sourceStart + localTime / clip.speed

    const cacheKey = `${asset.id}_${Math.round(sourceTime)}`

    if (frameCache.current.has(cacheKey)) {
      setCurrentFrame(frameCache.current.get(cacheKey)!)
      lastFrameTime.current = sourceTime
      return true
    }

    doExtract(asset.filePath, sourceTime, cacheKey)
    return true
  }, [getClipAtTime, timeline.currentTime, doExtract])

  // ── Playback setup / teardown ──────────────────────────────────
  // Only runs when playing state changes OR when the active clip changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (timeline.playing) {
      const result = getClipAtTime()
      if (!result || !result.asset) {
        video.pause()
        if (usingVideo) setUsingVideo(false)
        return
      }

      const { clip, asset } = result
      const mediaUrl = window.cineflow.getMediaUrl(asset.filePath)
      const localTime = timeline.currentTime - clip.timelineStart
      const sourceTime = clip.sourceStart + localTime / clip.speed
      const srcKey = `${asset.id}_${clip.id}`

      if (activeSrcKey.current !== srcKey) {
        video.pause()
        video.src = mediaUrl
        video.preload = 'auto'
        video.currentTime = sourceTime
        video.playbackRate = clip.speed
        video.muted = clip.muted
        video.volume = clip.muted ? 0 : 1
        activeSrcKey.current = srcKey
        video.play().catch((err) => {
          console.warn('[PreviewPanel] play init failed:', err.message)
        })
      } else {
        video.playbackRate = clip.speed
        video.muted = clip.muted
        video.volume = clip.muted ? 0 : 1
        video.play().catch((err) => {
          console.warn('[PreviewPanel] play resume failed:', err.message)
        })
      }

      if (!usingVideo) setUsingVideo(true)
      return
    }

    // Paused
    if (usingVideo) {
      video.pause()
      setUsingVideo(false)
    }
    activeSrcKey.current = null
  }, [timeline.playing, activeClipKey])

  // ── Seek / scrub when paused ─────────────────────────────────
  useEffect(() => {
    if (timeline.playing) return

    const video = videoRef.current
    const result = getClipAtTime()

    if (!result || !result.asset) {
      setCurrentFrame(null)
      return
    }

    const { clip, asset } = result
    const localTime = timeline.currentTime - clip.timelineStart
    const sourceTime = clip.sourceStart + localTime / clip.speed

    // Seek the video element if it has a loaded source
    if (video && video.readyState >= 1 && activeSrcKey.current) {
      video.currentTime = sourceTime
    }

    // Frame extraction via debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      if (!mountedRef.current) return
      extractCurrentFrame()
    }, FRAME_DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [timeline.currentTime, timeline.playing])

  // Pause video on unmount
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v) v.pause()
    }
  }, [])

  // Auto-extract frame on mount if there are clips
  useEffect(() => {
    if (project?.tracks.some(t => t.clips.length > 0)) {
      extractCurrentFrame()
    }
  }, [])
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        seek(Math.max(0, timeline.currentTime - 1))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        seek(timeline.currentTime + 1)
      }
    },
    [togglePlay, seek, timeline.currentTime]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const progress = (timeline.currentTime / Math.max(duration, 1)) * 100

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video element for playback */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: usingVideo ? 'block' : 'none',
        }}
        playsInline
      />

      {/* Image fallback for scrubbing */}
      {!usingVideo && (
        currentFrame ? (
          <img
            ref={imgRef}
            src={currentFrame}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              opacity: frameLoading ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
            alt="Preview frame"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
              <line x1="17" y1="17" x2="22" y2="17" />
            </svg>
            <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.4 }}>
              {timeline.playing
                ? 'Loading...'
                : project?.tracks.some(t => t.clips.length > 0)
                  ? frameLoading
                    ? 'Loading frame...'
                    : 'Drag playhead over a clip to preview'
                  : 'Import media and drag to timeline to start'}
            </span>
          </div>
        )
      )}

      {/* Controls overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          padding: '20px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            {timeline.playing ? (
              <>
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </>
            ) : (
              <polygon points="5,3 19,12 5,21" />
            )}
          </svg>
        </button>

        <div
          style={{
            flex: 1,
            height: 4,
            background: '#444',
            borderRadius: 2,
            cursor: 'pointer',
            position: 'relative',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            seek(pct * (duration || 60))
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
            }}
          />
        </div>

        <span style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>
          {timeToString(timeline.currentTime)}
        </span>
      </div>
    </div>
  )
}
