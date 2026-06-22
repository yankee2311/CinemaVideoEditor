import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { timeToString, timeToPixels, pixelsToTime, getSnapPoints, snapTime } from '@/engine/timelineEngine'
import { useWaveformCache } from '@/hooks/useWaveformCache'
import type { Clip, Track } from '@shared/types'

const TRACK_HEIGHT = 52
const TRACK_LABEL_WIDTH = 120
const RULER_HEIGHT = 32
const MIN_CLIP_WIDTH = 4
const SNAP_THRESHOLD_PX = 5
const AUTO_FOLLOW_THRESHOLD = 0.7
const AUDIO_BAR_HEIGHT = 3
const SCROLLBAR_HEIGHT = 12
const SCROLLBAR_MIN_WIDTH = 40
const AUTO_SCROLL_EDGE = 60
const AUTO_SCROLL_SPEED = 8

const CLIP_COLORS = {
  video: { base: '#3d8fd4', selected: '#5aaeff' },
  audio: { base: '#27ae60', selected: '#34d058' },
  text: { base: '#e67e22', selected: '#f39c12' },
}

export default function Timeline() {
  const {
    project,
    timeline,
    setCurrentTime,
    setZoom,
    selectClip,
    selectTrack,
    moveClip,
    trimClip,
    addClip,
    setScrollX,
    setScrollY,
    slipClip,
    slideClip,
    setToolMode,
    rippleDeleteClip,
    splitClip,
  } = useProjectStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraggingRef = useRef(false)
  const dragTypeRef = useRef<'move' | 'trim-start' | 'trim-end' | 'slip' | 'slide' | 'playhead' | 'pan' | 'scrollbar' | 'none'>('none')
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const dragStartScrollXRef = useRef(0)
  const dragStartScrollYRef = useRef(0)
  const dragStartTimeRef = useRef(0)
  const dragClipIdRef = useRef<string | null>(null)
  const dragClipOrigStartRef = useRef(0)
  const dragClipOrigSourceStartRef = useRef(0)
  const dragClipOrigSourceEndRef = useRef(0)
  const dragClipOrigDurationRef = useRef(0)
  const dropIndicatorRef = useRef<number | null>(null)
  const isPanningRef = useRef(false)
  const spaceDownRef = useRef(false)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const handleMouseMoveRef = useRef<(e: React.MouseEvent<HTMLDivElement>) => void>(() => {})
  const handleMouseUpRef = useRef<() => void>(() => {})

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 200 })
  const [isDragging, setIsDragging] = useState(false)

  // Waveform cache for audio tracks
  const { getWaveform } = useWaveformCache()
  const waveformDataRef = useRef<Map<string, { samples: number[]; sampleRate: number }>>(new Map())
  const pendingWaveformsRef = useRef<Set<string>>(new Set())
  const tracks = project?.tracks ?? []

  // Load waveforms for audio clips as they appear
  useEffect(() => {
    if (!project) return
    const audioClips: { clipId: string; mediaId: string }[] = []
    for (const track of tracks) {
      if (track.type === 'audio' || track.type === 'video') {
        for (const clip of track.clips) {
          if (!waveformDataRef.current.has(clip.id)) {
            audioClips.push({ clipId: clip.id, mediaId: clip.mediaId })
          }
        }
      }
    }

    // Load up to 5 at a time
    let loaded = 0
    for (const { clipId, mediaId } of audioClips) {
      if (loaded >= 5) break
      if (pendingWaveformsRef.current.has(clipId)) continue
      const asset = project.mediaAssets.find(m => m.id === mediaId)
      if (!asset) continue

      pendingWaveformsRef.current.add(clipId)
      getWaveform(asset.filePath, 0, Math.min(30, asset.duration), 80).then(data => {
        waveformDataRef.current.set(clipId, { samples: data.samples, sampleRate: data.sampleRate })
        pendingWaveformsRef.current.delete(clipId)
      }).catch(() => {
        pendingWaveformsRef.current.delete(clipId)
      })
      loaded++
    }
  }, [tracks, project, getWaveform])

  const zoom = timeline.zoom
  const currentTime = timeline.currentTime
  const scrollX = timeline.scrollX
  const scrollY = timeline.scrollY

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const totalDuration = project?.tracks.reduce((max, t) => {
    return Math.max(
      max,
      ...t.clips.map((c) => c.timelineStart + c.timelineDuration)
    )
  }, 60) ?? 60

  const visibleWidth = canvasSize.width - TRACK_LABEL_WIDTH
  const totalWidth = Math.max(visibleWidth, timeToPixels(totalDuration + 10, zoom))
  const maxScrollX = Math.max(0, totalWidth - visibleWidth)

  const totalHeight = tracks.length * TRACK_HEIGHT + RULER_HEIGHT
  const visibleHeight = canvasSize.height - RULER_HEIGHT
  const maxScrollY = Math.max(0, totalHeight - visibleHeight)

  const clampScrollX = useCallback((x: number) => Math.max(0, Math.min(maxScrollX, x)), [maxScrollX])
  const clampScrollY = useCallback((y: number) => Math.max(0, Math.min(maxScrollY, y)), [maxScrollY])

  const doSetScrollX = useCallback((x: number) => setScrollX(clampScrollX(x)), [setScrollX, clampScrollX])
  const doSetScrollY = useCallback((y: number) => setScrollY(clampScrollY(y)), [setScrollY, clampScrollY])



  // ── Draw ─────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.width * dpr
    canvas.height = canvasSize.height * dpr
    ctx.scale(dpr, dpr)

    const w = canvasSize.width
    const h = canvasSize.height
    const contentH = h - SCROLLBAR_HEIGHT

    // Background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.beginPath()
    ctx.rect(TRACK_LABEL_WIDTH, 0, w - TRACK_LABEL_WIDTH, contentH)
    ctx.clip()

    ctx.translate(TRACK_LABEL_WIDTH - scrollX, -scrollY)

    // ── Ruler ──────────────────────────────────────────────
    const rulerGradient = ctx.createLinearGradient(0, 0, 0, RULER_HEIGHT)
    rulerGradient.addColorStop(0, '#2a2a2a')
    rulerGradient.addColorStop(1, '#222222')
    ctx.fillStyle = rulerGradient
    ctx.fillRect(0, 0, totalWidth + 40, RULER_HEIGHT)

    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, RULER_HEIGHT)
    ctx.lineTo(totalWidth + 40, RULER_HEIGHT)
    ctx.stroke()

    // Adaptive time interval
    let timeInterval: number
    if (zoom < 10) timeInterval = 10
    else if (zoom < 20) timeInterval = 5
    else if (zoom < 40) timeInterval = 2
    else if (zoom < 80) timeInterval = 1
    else if (zoom < 150) timeInterval = 0.5
    else timeInterval = 0.25

    const avgCharWidth = 7
    const minPixelGap = 60
    const estimatedTextWidth = timeToString(0).length * avgCharWidth
    const pixelInterval = timeInterval * zoom
    if (pixelInterval < estimatedTextWidth + minPixelGap) {
      timeInterval *= 2
    }

    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'

    for (let t = 0; t <= totalDuration + 1; t += timeInterval) {
      const x = timeToPixels(t, zoom)
      const isMajor = Math.abs(t % (timeInterval * 2)) < 0.001 || timeInterval >= 5

      ctx.fillStyle = isMajor ? '#555' : '#3a3a3a'
      ctx.fillRect(x, 0, 1, isMajor ? 8 : 5)

      if (isMajor || timeInterval <= 1) {
        ctx.fillStyle = '#999'
        ctx.fillText(timeToString(t), x, 20)
      }

      if (timeInterval > 0.25) {
        const subCount = timeInterval >= 5 ? 5 : timeInterval >= 2 ? 2 : 4
        for (let sub = 1; sub < subCount; sub++) {
          const subX = timeToPixels(t + (timeInterval / subCount) * sub, zoom)
          ctx.fillStyle = '#2a2a2a'
          ctx.fillRect(subX, 0, 1, 3)
        }
      }
    }

    // ── Tracks ─────────────────────────────────────────────
    tracks.forEach((track, index) => {
      const y = RULER_HEIGHT + index * TRACK_HEIGHT

      ctx.fillStyle = index % 2 === 0 ? '#222' : '#1f1f1f'
      ctx.fillRect(0, y, totalWidth, TRACK_HEIGHT)

      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y + TRACK_HEIGHT)
      ctx.lineTo(totalWidth, y + TRACK_HEIGHT)
      ctx.stroke()

      // ── Clips ──────────────────────────────────────────
      track.clips.forEach((clip) => {
        const cx = timeToPixels(clip.timelineStart, zoom)
        const cw = Math.max(MIN_CLIP_WIDTH, timeToPixels(clip.timelineDuration, zoom))
        const clipY = y + 3
        const clipH = TRACK_HEIGHT - 8
        const isSelected = clip.id === timeline.selectedClipId

        const colors = track.type === 'video' ? CLIP_COLORS.video
          : track.type === 'audio' ? CLIP_COLORS.audio
          : CLIP_COLORS.text

        // Clip shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath()
        ctx.roundRect(cx + 1, clipY + 2, cw, clipH, 4)
        ctx.fill()

        // Clip body
        ctx.fillStyle = isSelected ? colors.selected : colors.base
        ctx.beginPath()
        ctx.roundRect(cx, clipY, cw, clipH, 4)
        ctx.fill()

        // Gradient overlay
        const clipGradient = ctx.createLinearGradient(cx, clipY, cx, clipY + clipH)
        clipGradient.addColorStop(0, 'rgba(255,255,255,0.08)')
        clipGradient.addColorStop(0.5, 'rgba(255,255,255,0)')
        clipGradient.addColorStop(1, 'rgba(0,0,0,0.12)')
        ctx.fillStyle = clipGradient
        ctx.beginPath()
        ctx.roundRect(cx, clipY, cw, clipH, 4)
        ctx.fill()

        // Audio waveform visualization for audio tracks
        if ((track.type === 'audio' || track.type === 'video') && cw > 20) {
          const waveform = waveformDataRef.current.get(clip.id)
          if (waveform && waveform.samples.length > 0) {
            // Render waveform inside the clip
            const waveY = clipY + (track.type === 'audio' ? 10 : clipH - AUDIO_BAR_HEIGHT - 4)
            const waveH = track.type === 'audio' ? clipH - 18 : AUDIO_BAR_HEIGHT + 2
            const gap = Math.max(1, Math.floor(waveform.samples.length / cw))
            const midWaveY = waveY + waveH / 2

            ctx.save()
            ctx.beginPath()
            ctx.roundRect(cx, clipY, cw, clipH, 4)
            ctx.clip()

            ctx.strokeStyle = track.type === 'audio' ? 'rgba(39,174,96,0.7)' : 'rgba(39,174,96,0.4)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            for (let px = 0; px < Math.min(cw, waveform.samples.length); px += 0.5) {
              const sampleIdx = Math.floor((px / cw) * waveform.samples.length)
              const sample = waveform.samples[Math.min(sampleIdx, waveform.samples.length - 1)]
              const barH = sample * (waveH / 2)
              const x = cx + px
              ctx.moveTo(x, midWaveY - barH)
              ctx.lineTo(x, midWaveY + barH)
            }
            ctx.stroke()
            ctx.restore()
          } else {
            // Loading placeholder
            ctx.fillStyle = 'rgba(39,174,96,0.2)'
            const barY = track.type === 'audio' ? clipY + clipH / 2 - 1 : clipY + clipH - AUDIO_BAR_HEIGHT - 3
            const barH = track.type === 'audio' ? 2 : AUDIO_BAR_HEIGHT
            ctx.beginPath()
            ctx.roundRect(cx + 2, barY, cw - 4, barH, 1)
            ctx.fill()
          }
        }

        // Clip name
        if (cw > 30) {
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(cx, clipY, cw, clipH, 4)
          ctx.clip()

          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          ctx.textAlign = 'left'
          const maxChars = Math.floor((cw - 12) / 6)
          const displayName = clip.name.length > maxChars
            ? clip.name.substring(0, maxChars - 3) + '...'
            : clip.name

          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillText(displayName, cx + 7, clipY + clipH / 2 + 4)
          ctx.fillStyle = '#fff'
          ctx.fillText(displayName, cx + 6, clipY + clipH / 2 + 3)

          ctx.restore()
        }

        // Speed badge
        if (clip.speed !== 1 && cw > 40) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.beginPath()
          ctx.roundRect(cx + cw - 32, clipY + 3, 28, 14, 3)
          ctx.fill()
          ctx.fillStyle = '#ffcc00'
          ctx.font = '9px -apple-system, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`${clip.speed.toFixed(1)}x`, cx + cw - 18, clipY + 13)
          ctx.textAlign = 'left'
        }

        // Selection
        if (isSelected) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.roundRect(cx, clipY, cw, clipH, 4)
          ctx.stroke()

          if (cw > 24) {
            const handleW = 3
            const handleH = clipH - 8
            const handleY = clipY + 4
            ctx.fillStyle = 'rgba(255,255,255,0.6)'
            ctx.beginPath()
            ctx.roundRect(cx + 2, handleY, handleW, handleH, 1)
            ctx.fill()
            ctx.beginPath()
            ctx.roundRect(cx + cw - handleW - 2, handleY, handleW, handleH, 1)
            ctx.fill()
          }
        }

        // ── Transition out overlay ────────────────────────
        if (clip.transitionOut && cw > 20) {
          const tx = cx + cw - timeToPixels(clip.transitionOut.duration, zoom)
          const tw = timeToPixels(clip.transitionOut.duration, zoom)
          if (tw > 0) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.15)'
            ctx.beginPath()
            ctx.roundRect(tx, clipY, tw, clipH, 4)
            ctx.fill()
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.roundRect(tx, clipY, tw, clipH, 4)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = 'rgba(255, 200, 0, 0.7)'
            ctx.font = '8px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(clip.transitionOut.type, tx + tw / 2, clipY + clipH / 2 + 3)
          }
        }

        // ── Speed ramp ────────────────────────────────────
        if (clip.speedRamps.length > 0 && cw > 30) {
          const rampY = clipY
          const rampH = 12
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(cx, rampY, cw, rampH, [4, 4, 0, 0])
          ctx.clip()

          ctx.fillStyle = 'rgba(255, 204, 0, 0.15)'
          ctx.fillRect(cx, rampY, cw, rampH)

          const sortedRamps = [...clip.speedRamps].sort((a, b) => a.time - b.time)
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(255, 204, 0, 0.8)'
          ctx.lineWidth = 1.5
          sortedRamps.forEach((sr, i) => {
            const rx = cx + (sr.time / clip.timelineDuration) * cw
            const ry = rampY + rampH - (sr.speed / 4) * rampH
            if (i === 0) ctx.moveTo(rx, ry)
            else ctx.lineTo(rx, ry)
            ctx.arc(rx, ry, 2, 0, Math.PI * 2)
          })
          ctx.stroke()
          ctx.restore()
        }

        // ── Keyframe diamonds ─────────────────────────────
        const allKeyframes: { time: number }[] = []
        for (const effect of clip.effects) {
          for (const param of Object.values(effect.params)) {
            if (param.keyframes) {
              allKeyframes.push(...param.keyframes)
            }
          }
        }
        for (const paramName of Object.keys(clip.transformKeyframes)) {
          allKeyframes.push(...clip.transformKeyframes[paramName])
        }
        if (allKeyframes.length > 0 && cw > 10) {
          const unique = new Map<number, number>()
          allKeyframes.forEach(kf => {
            const t = Math.round(kf.time * 100)
            unique.set(t, kf.time)
          })
          unique.forEach(time => {
            const relTime = time - clip.timelineStart
            if (relTime < 0 || relTime > clip.timelineDuration) return
            const kx = cx + (relTime / clip.timelineDuration) * cw
            const ky = clipY + clipH - 1
            ctx.fillStyle = '#ffcc00'
            ctx.beginPath()
            ctx.moveTo(kx, ky - 4)
            ctx.lineTo(kx + 3, ky - 1)
            ctx.lineTo(kx, ky + 2)
            ctx.lineTo(kx - 3, ky - 1)
            ctx.closePath()
            ctx.fill()
          })
        }
      })
    })

    // Drop indicator
    if (dropIndicatorRef.current !== null) {
      const dx = timeToPixels(dropIndicatorRef.current, zoom)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(dx, RULER_HEIGHT)
      ctx.lineTo(dx, RULER_HEIGHT + tracks.length * TRACK_HEIGHT)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(dx, RULER_HEIGHT, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Playhead
    const phx = timeToPixels(currentTime, zoom)
    ctx.strokeStyle = 'rgba(255,51,51,0.2)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(phx, RULER_HEIGHT)
    ctx.lineTo(phx, totalHeight)
    ctx.stroke()

    ctx.strokeStyle = '#ff3333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(phx, RULER_HEIGHT)
    ctx.lineTo(phx, totalHeight)
    ctx.stroke()

    ctx.fillStyle = '#ff3333'
    ctx.beginPath()
    ctx.moveTo(phx - 6, 0)
    ctx.lineTo(phx + 6, 0)
    ctx.lineTo(phx + 6, 4)
    ctx.lineTo(phx, 10)
    ctx.lineTo(phx - 6, 4)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#cc2222'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.restore()

    // ── Track labels (fixed, no scroll) ──────────────────
    tracks.forEach((track, index) => {
      const y = RULER_HEIGHT + index * TRACK_HEIGHT - scrollY
      if (y + TRACK_HEIGHT < RULER_HEIGHT || y > contentH) return

      ctx.fillStyle = '#1e1e1e'
      ctx.fillRect(0, y, TRACK_LABEL_WIDTH, TRACK_HEIGHT)

      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(TRACK_LABEL_WIDTH, y)
      ctx.lineTo(TRACK_LABEL_WIDTH, y + TRACK_HEIGHT)
      ctx.stroke()

      const indicatorColor = track.type === 'video' ? '#3d8fd4'
        : track.type === 'audio' ? '#27ae60'
        : '#e67e22'
      ctx.fillStyle = indicatorColor
      ctx.fillRect(0, y + 4, 3, TRACK_HEIGHT - 8)

      ctx.fillStyle = '#ccc'
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(track.name, 10, y + TRACK_HEIGHT / 2 + 4)

      const iconX = TRACK_LABEL_WIDTH - 22
      const iconY = y + TRACK_HEIGHT / 2
      ctx.strokeStyle = indicatorColor
      ctx.lineWidth = 1.5

      if (track.type === 'video') {
        ctx.beginPath()
        ctx.rect(iconX - 5, iconY - 5, 10, 10)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(iconX - 5, iconY - 2)
        ctx.lineTo(iconX + 5, iconY - 2)
        ctx.moveTo(iconX - 5, iconY + 2)
        ctx.lineTo(iconX + 5, iconY + 2)
        ctx.stroke()
      } else if (track.type === 'audio') {
        ctx.beginPath()
        ctx.moveTo(iconX - 3, iconY - 3)
        ctx.lineTo(iconX, iconY - 5)
        ctx.lineTo(iconX, iconY + 5)
        ctx.lineTo(iconX - 3, iconY + 3)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(iconX + 2, iconY, 3, -Math.PI / 2, Math.PI / 2)
        ctx.stroke()
      } else {
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = indicatorColor
        ctx.fillText('T', iconX - 3, iconY + 4)
      }
    })

    // ── Current time display ─────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(w - 90, 4, 82, 20, 4)
    ctx.fill()
    ctx.fillStyle = '#ff3333'
    ctx.font = 'bold 11px "SF Mono", "Fira Code", "Consolas", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(timeToString(currentTime), w - 12, 18)

    // ── Horizontal scrollbar ─────────────────────────────
    if (maxScrollX > 0) {
      const sbY = contentH
      const sbW = w - TRACK_LABEL_WIDTH
      const thumbW = Math.max(SCROLLBAR_MIN_WIDTH, (visibleWidth / totalWidth) * sbW)
      const thumbX = TRACK_LABEL_WIDTH + (scrollX / maxScrollX) * (sbW - thumbW)

      // Scrollbar track
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(TRACK_LABEL_WIDTH, sbY, sbW, SCROLLBAR_HEIGHT)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(TRACK_LABEL_WIDTH, sbY)
      ctx.lineTo(w, sbY)
      ctx.stroke()

      // Scrollbar thumb
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.roundRect(thumbX, sbY + 2, thumbW, SCROLLBAR_HEIGHT - 4, 3)
      ctx.fill()

      // Thumb hover/active indicator
      if (isDragging && dragTypeRef.current === 'scrollbar') {
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.beginPath()
        ctx.roundRect(thumbX, sbY + 2, thumbW, SCROLLBAR_HEIGHT - 4, 3)
        ctx.fill()
      }
    }

    // ── Vertical scrollbar ───────────────────────────────
    if (maxScrollY > 0) {
      const sbX = w - 10
      const sbH = contentH
      const thumbH = Math.max(30, (visibleHeight / totalHeight) * sbH)
      const thumbY = RULER_HEIGHT + (scrollY / maxScrollY) * (sbH - thumbH)

      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.roundRect(sbX, thumbY, 8, thumbH, 3)
      ctx.fill()
    }
  }, [canvasSize, tracks, currentTime, zoom, scrollX, scrollY, totalDuration, timeline.selectedClipId, totalWidth, totalHeight, maxScrollX, maxScrollY, visibleWidth, visibleHeight, isDragging])

  useEffect(() => {
    draw()
  }, [draw])

  // ── Auto-follow playhead during playback ─────────────────
  useEffect(() => {
    if (!timeline.playing) return
    if (!timeline.autoFollowEnabled) return
    const phPx = timeToPixels(timeline.currentTime, zoom)
    const threshold = scrollX + visibleWidth * AUTO_FOLLOW_THRESHOLD
    if (phPx > threshold) {
      doSetScrollX(phPx - visibleWidth * (1 - AUTO_FOLLOW_THRESHOLD))
    }
  }, [timeline.playing, timeline.autoFollowEnabled, timeline.currentTime, zoom, scrollX, visibleWidth, doSetScrollX])

  // ── Wheel scroll (on container, not canvas) ──────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useProjectStore.getState()

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left - TRACK_LABEL_WIDTH
        const mouseTime = pixelsToTime(mouseX + s.timeline.scrollX, s.timeline.zoom)
        const delta = e.deltaY > 0 ? -3 : 3
        const newZoom = Math.max(1, Math.min(200, s.timeline.zoom + delta))
        const newMouseTimePx = mouseTime * newZoom
        const newScrollX = Math.max(0, newMouseTimePx - mouseX)
        setZoom(newZoom)
        doSetScrollX(newScrollX)
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scroll
        const dx = e.shiftKey ? e.deltaY : e.deltaX
        doSetScrollX(s.timeline.scrollX + dx)
      } else {
        // Vertical scroll
        doSetScrollY(s.timeline.scrollY + e.deltaY)
      }
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [setZoom, doSetScrollX, doSetScrollY])

  // ── Space key for panning ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        spaceDownRef.current = true
        setIsSpaceDown(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        setIsSpaceDown(false)
        if (isPanningRef.current) {
          isPanningRef.current = false
          isDraggingRef.current = false
          dragTypeRef.current = 'none'
          setIsDragging(false)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ── Get clip/track at position ───────────────────────────
  const getTrackAndClipAt = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      if (!container) return { track: null as Track | null, clip: null as Clip | null, time: 0, edge: 'none' as 'none' | 'start' | 'end', trackIndex: -1 }

      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left + scrollX - TRACK_LABEL_WIDTH
      const y = clientY - rect.top + scrollY - RULER_HEIGHT

      const time = pixelsToTime(x, zoom)
      const trackIndex = Math.floor(y / TRACK_HEIGHT)

      if (trackIndex < 0 || trackIndex >= tracks.length) {
        return { track: null, clip: null, time, edge: 'none', trackIndex: -1 }
      }

      const track = tracks[trackIndex]

      for (const clip of track.clips) {
        const clipStartPx = timeToPixels(clip.timelineStart, zoom)
        const clipEndPx = timeToPixels(clip.timelineStart + clip.timelineDuration, zoom)
        const margin = 6

        if (Math.abs(x - clipStartPx) < margin) {
          return { track, clip, time, edge: 'start', trackIndex }
        }
        if (Math.abs(x - clipEndPx) < margin) {
          return { track, clip, time, edge: 'end', trackIndex }
        }
        if (x >= clipStartPx && x <= clipEndPx) {
          return { track, clip, time, edge: 'none', trackIndex }
        }
      }

      return { track, clip: null, time, edge: 'none', trackIndex }
    },
    [tracks, zoom, scrollX, scrollY]
  )

  const getTimeAtX = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left + scrollX - TRACK_LABEL_WIDTH
    return Math.max(0, pixelsToTime(x, zoom))
  }, [zoom, scrollX])

  // ── Check if click is on scrollbar ───────────────────────
  const isClickOnScrollbar = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return false
    const rect = container.getBoundingClientRect()
    const y = clientY - rect.top
    return y >= canvasSize.height - SCROLLBAR_HEIGHT && maxScrollX > 0
  }, [canvasSize.height, maxScrollX])

  const getScrollbarThumbAt = useCallback((_clientX: number) => {
    const container = containerRef.current
    if (!container) return { thumbX: 0, thumbW: SCROLLBAR_MIN_WIDTH, sbY: 0, sbW: 0 }
    const sbW = canvasSize.width - TRACK_LABEL_WIDTH
    const thumbW = Math.max(SCROLLBAR_MIN_WIDTH, (visibleWidth / totalWidth) * sbW)
    const thumbX = TRACK_LABEL_WIDTH + (scrollX / Math.max(1, maxScrollX)) * (sbW - thumbW)
    const sbY = canvasSize.height - SCROLLBAR_HEIGHT
    return { thumbX, thumbW, sbY, sbW }
  }, [canvasSize, scrollX, maxScrollX, visibleWidth, totalWidth])

  // ── Mouse handlers ───────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Check scrollbar click
      if (isClickOnScrollbar(e.clientX, e.clientY)) {
        const { thumbX, thumbW, sbW } = getScrollbarThumbAt(e.clientX)
        const rect = containerRef.current!.getBoundingClientRect()
        const clickX = e.clientX - rect.left

        if (clickX >= thumbX && clickX <= thumbX + thumbW) {
          // Click on thumb - start dragging
          isDraggingRef.current = true
          dragTypeRef.current = 'scrollbar'
          dragStartXRef.current = e.clientX
          dragStartScrollXRef.current = scrollX
          setIsDragging(true)
        } else {
          // Click on track - jump to position
          const relX = clickX - TRACK_LABEL_WIDTH
          const pct = Math.max(0, Math.min(1, relX / Math.max(1, sbW)))
          doSetScrollX(pct * maxScrollX)
        }
        return
      }

      // Middle-click pan
      if (e.button === 1) {
        e.preventDefault()
        isDraggingRef.current = true
        isPanningRef.current = true
        dragTypeRef.current = 'pan'
        dragStartXRef.current = e.clientX
        dragStartYRef.current = e.clientY
        dragStartScrollXRef.current = scrollX
        dragStartScrollYRef.current = scrollY
        setIsDragging(true)
        return
      }

      // Space+click pan
      if (spaceDownRef.current) {
        isDraggingRef.current = true
        isPanningRef.current = true
        dragTypeRef.current = 'pan'
        dragStartXRef.current = e.clientX
        dragStartYRef.current = e.clientY
        dragStartScrollXRef.current = scrollX
        dragStartScrollYRef.current = scrollY
        setIsDragging(true)
        return
      }

      const result = getTrackAndClipAt(e.clientX, e.clientY)

      // Click on track labels
      if (e.clientX - containerRef.current!.getBoundingClientRect().left < TRACK_LABEL_WIDTH && result.track) {
        selectTrack(result.track.id)
        return
      }

      if (result.clip) {
        selectClip(result.clip.id)
        selectTrack(result.track!.id)

        const isSlip = timeline.toolMode === 'slip' || (e.altKey && !e.ctrlKey)
        const isSlide = timeline.toolMode === 'slide' || (e.altKey && e.ctrlKey)
        const isRazor = timeline.toolMode === 'razor'

        if (isRazor) {
          splitClip(result.clip.id, result.time)
          return
        }

        if (isSlip) {
          dragTypeRef.current = 'slip'
          dragClipIdRef.current = result.clip.id
          dragClipOrigSourceStartRef.current = result.clip.sourceStart
          dragClipOrigSourceEndRef.current = result.clip.sourceEnd
          dragClipOrigDurationRef.current = result.clip.sourceEnd - result.clip.sourceStart
        } else if (isSlide) {
          dragTypeRef.current = 'slide'
          dragClipIdRef.current = result.clip.id
          dragClipOrigStartRef.current = result.clip.timelineStart
          dragClipOrigDurationRef.current = result.clip.timelineDuration
        } else if (result.edge === 'start') {
          dragTypeRef.current = 'trim-start'
          dragClipIdRef.current = result.clip.id
          dragClipOrigSourceStartRef.current = result.clip.sourceStart
          dragClipOrigSourceEndRef.current = result.clip.sourceEnd
          dragClipOrigStartRef.current = result.clip.timelineStart
        } else if (result.edge === 'end') {
          dragTypeRef.current = 'trim-end'
          dragClipIdRef.current = result.clip.id
          dragClipOrigSourceStartRef.current = result.clip.sourceStart
          dragClipOrigSourceEndRef.current = result.clip.sourceEnd
          dragClipOrigStartRef.current = result.clip.timelineStart
        } else {
          dragTypeRef.current = 'move'
          dragClipIdRef.current = result.clip.id
          dragClipOrigStartRef.current = result.clip.timelineStart
        }

        isDraggingRef.current = true
        dragStartXRef.current = e.clientX
        dragStartScrollXRef.current = scrollX
        dragStartTimeRef.current = result.time
        setIsDragging(true)
      } else {
        selectClip(null)
        setCurrentTime(result.time)
        dragTypeRef.current = 'playhead'
        isDraggingRef.current = true
        dragStartXRef.current = e.clientX
        setIsDragging(true)
      }
    },
    [getTrackAndClipAt, selectClip, selectTrack, setCurrentTime, timeline.toolMode, splitClip, scrollX, scrollY, isClickOnScrollbar, getScrollbarThumbAt, doSetScrollX, maxScrollX]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return

      const rect = containerRef.current!.getBoundingClientRect()

      // Scrollbar drag
      if (dragTypeRef.current === 'scrollbar') {
        const { sbW, thumbW } = getScrollbarThumbAt(e.clientX)
        const deltaX = e.clientX - dragStartXRef.current
        const scrollRange = sbW - thumbW
        if (scrollRange > 0) {
          const scrollDelta = (deltaX / scrollRange) * maxScrollX
          doSetScrollX(dragStartScrollXRef.current + scrollDelta)
        }
        return
      }

      // Pan (middle-click or space+drag)
      if (dragTypeRef.current === 'pan') {
        const deltaX = e.clientX - dragStartXRef.current
        const deltaY = e.clientY - dragStartYRef.current
        doSetScrollX(dragStartScrollXRef.current - deltaX)
        doSetScrollY(dragStartScrollYRef.current - deltaY)
        return
      }

      // Auto-scroll during drag
      if (dragTypeRef.current !== 'playhead' && dragTypeRef.current !== 'none') {
        const mouseX = e.clientX - rect.left
        if (mouseX < TRACK_LABEL_WIDTH + AUTO_SCROLL_EDGE && scrollX > 0) {
          const speed = Math.max(1, (AUTO_SCROLL_EDGE - (mouseX - TRACK_LABEL_WIDTH)) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_SPEED
          doSetScrollX(scrollX - speed)
        } else if (mouseX > canvasSize.width - AUTO_SCROLL_EDGE && scrollX < maxScrollX) {
          const speed = Math.max(1, (AUTO_SCROLL_EDGE - (canvasSize.width - mouseX)) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_SPEED
          doSetScrollX(scrollX + speed)
        }
      }

      const x = e.clientX - rect.left + scrollX - TRACK_LABEL_WIDTH
      const time = pixelsToTime(x, zoom)

      const snapPoints = getSnapPoints(
        tracks.flatMap((t) => t.clips.filter((c) => c.id !== dragClipIdRef.current))
      )
      const snappedTime = timeline.snapEnabled
        ? snapTime(time, snapPoints, SNAP_THRESHOLD_PX / zoom)
        : time

      if (dragTypeRef.current === 'playhead') {
        setCurrentTime(Math.max(0, snappedTime))
        return
      }

      if (!dragClipIdRef.current) return

      if (dragTypeRef.current === 'move') {
        const delta = snappedTime - dragStartTimeRef.current
        const newStart = Math.max(0, dragClipOrigStartRef.current + delta)
        moveClip(dragClipIdRef.current, tracks[0]?.id ?? '', newStart)
      } else if (dragTypeRef.current === 'trim-start') {
        const delta = snappedTime - dragStartTimeRef.current
        const newSourceStart = Math.max(0, dragClipOrigSourceStartRef.current + delta)
        trimClip(dragClipIdRef.current, newSourceStart, dragClipOrigSourceEndRef.current)
      } else if (dragTypeRef.current === 'trim-end') {
        const delta = snappedTime - dragStartTimeRef.current
        const newSourceEnd = dragClipOrigSourceEndRef.current + delta
        if (newSourceEnd > dragClipOrigSourceStartRef.current) {
          trimClip(dragClipIdRef.current, dragClipOrigSourceStartRef.current, newSourceEnd)
        }
      } else if (dragTypeRef.current === 'slip') {
        const delta = snappedTime - dragStartTimeRef.current
        slipClip(dragClipIdRef.current, delta)
      } else if (dragTypeRef.current === 'slide') {
        const delta = snappedTime - dragStartTimeRef.current
        const newStart = Math.max(0, dragClipOrigStartRef.current + delta)
        slideClip(dragClipIdRef.current, newStart)
      }
    },
    [tracks, zoom, scrollX, scrollY, timeline.snapEnabled, setCurrentTime, moveClip, trimClip, slipClip, slideClip, canvasSize.width, maxScrollX, doSetScrollX, getScrollbarThumbAt]
  )

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    isPanningRef.current = false
    dragTypeRef.current = 'none'
    dragClipIdRef.current = null
    setIsDragging(false)
  }, [])

  handleMouseMoveRef.current = handleMouseMove
  handleMouseUpRef.current = handleMouseUp

  // ── Window drag listeners ─────────────────────────────────
  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => {
      handleMouseMoveRef.current(e as unknown as React.MouseEvent<HTMLDivElement>)
    }
    const onMouseUp = () => {
      handleMouseUpRef.current()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const state = useProjectStore.getState()

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          state.undo()
          return
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault()
          state.redo()
          return
        }
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault()
          setToolMode('select')
          break
        case 'c':
          e.preventDefault()
          setToolMode('razor')
          break
        case 'a':
          e.preventDefault()
          setToolMode('slip')
          break
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            if (state.timeline.selectedClipId) {
              splitClip(state.timeline.selectedClipId, state.timeline.currentTime)
            }
          }
          break
        case 'delete':
        case 'backspace':
          if (state.timeline.selectedClipId) {
            e.preventDefault()
            rippleDeleteClip(state.timeline.selectedClipId)
          }
          break
        case 'k':
          e.preventDefault()
          state.setPlaying(!state.timeline.playing)
          break
        case 'arrowleft':
          e.preventDefault()
          if (e.shiftKey) {
            state.setCurrentTime(Math.max(0, state.timeline.currentTime - 5))
          } else if (e.ctrlKey) {
            state.setCurrentTime(Math.max(0, state.timeline.currentTime - 1))
          } else {
            state.setCurrentTime(Math.max(0, state.timeline.currentTime - 1 / 30))
          }
          break
        case 'arrowright':
          e.preventDefault()
          if (e.shiftKey) {
            state.setCurrentTime(state.timeline.currentTime + 5)
          } else if (e.ctrlKey) {
            state.setCurrentTime(state.timeline.currentTime + 1)
          } else {
            state.setCurrentTime(state.timeline.currentTime + 1 / 30)
          }
          break
        case 'home':
          e.preventDefault()
          state.setCurrentTime(0)
          doSetScrollX(0)
          break
        case 'end':
          e.preventDefault()
          const maxTime = state.project?.tracks.reduce((max, t) => {
            return Math.max(max, ...t.clips.map(c => c.timelineStart + c.timelineDuration))
          }, 0) ?? 0
          state.setCurrentTime(maxTime)
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setToolMode, splitClip, rippleDeleteClip, doSetScrollX])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    dropIndicatorRef.current = getTimeAtX(e.clientX)
  }, [getTimeAtX])

  const handleDragLeave = useCallback(() => {
    dropIndicatorRef.current = null
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dropIndicatorRef.current = null

    const mediaId = e.dataTransfer.getData('text/plain')
    if (!mediaId || !project) return

    const dropTime = getTimeAtX(e.clientX)
    const rect = containerRef.current!.getBoundingClientRect()
    const y = e.clientY - rect.top + scrollY - RULER_HEIGHT
    const trackIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / TRACK_HEIGHT)))
    const targetTrack = tracks[trackIndex]

    if (targetTrack) {
      addClip(mediaId, targetTrack.id, dropTime)
    }
  }, [getTimeAtX, project, tracks, scrollY, addClip])

  const getCursorStyle = () => {
    if (isSpaceDown || isPanningRef.current) return 'grab'
    if (isDragging && dragTypeRef.current === 'pan') return 'grabbing'
    if (isDragging) return 'grabbing'
    switch (timeline.toolMode) {
      case 'razor': return 'crosshair'
      case 'slip': return 'ew-resize'
      case 'slide': return 'move'
      default: return 'default'
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: getCursorStyle(),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          display: 'block',
        }}
      />
    </div>
  )
}
