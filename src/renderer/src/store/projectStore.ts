import { create } from 'zustand'
import {
  BUILTIN_EFFECTS,
  type Project,
  type Track,
  type Clip,
  type MediaAsset,
  type TimelineState,
  type ProjectSettings,
  type ToolMode,
  type EffectType,
  type Transition,
  type Keyframe,
  type TextClipData,
  type Marker,
} from '@shared/types'
import type {
  PrimaryColorParams,
  ColorWheelsParams,
  RGBACurve,
  ParametricCurves,
  LUTData,
} from '@shared/color'

interface ProjectStore {
  project: Project | null
  timeline: TimelineState

  // Actions
  newProject: (name: string, settings?: Partial<ProjectSettings>) => void
  loadProject: (project: Project) => void
  setCurrentTime: (time: number) => void
  setZoom: (zoom: number) => void
  setPlaying: (playing: boolean) => void
  selectClip: (clipId: string | null) => void
  selectTrack: (trackId: string | null) => void
  setSnap: (snap: boolean) => void
  setAutoFollow: (enabled: boolean) => void
  setScrollX: (x: number) => void
  setScrollY: (y: number) => void

  // Tool mode
  setToolMode: (mode: ToolMode) => void

  // Navigation
  scrollToPlayhead: (viewportWidth: number, labelWidth: number) => void
  fitToView: (viewportWidth: number, viewportHeight: number, labelWidth: number, rulerHeight: number, trackHeight: number) => void

  // Media
  addMediaAssets: (assets: MediaAsset[]) => void

  // Tracks
  addTrack: (type: Track['type'], name?: string) => void
  removeTrack: (trackId: string) => void

  // Clips
  addClip: (mediaId: string, trackId: string, timelineStart: number) => void
  removeClip: (clipId: string) => void
  moveClip: (clipId: string, newTrackId: string, newStart: number) => void
  trimClip: (clipId: string, newStart: number, newEnd: number) => void
  rippleDeleteClip: (clipId: string) => void
  splitClip: (clipId: string, time: number) => void
  slipClip: (clipId: string, sourceOffset: number) => void
  slideClip: (clipId: string, newStart: number) => void

  // Track audio
  setTrackVolume: (trackId: string, volume: number) => void
  setTrackPan: (trackId: string, pan: number) => void
  setTrackMuted: (trackId: string, muted: boolean) => void
  setTrackSolo: (trackId: string, solo: boolean) => void
  addTrackEffect: (trackId: string, effectType: EffectType) => void
  removeTrackEffect: (trackId: string, effectId: string) => void
  updateTrackEffectParam: (trackId: string, effectId: string, paramName: string, value: number | [number, number] | boolean) => void
  setTrackEffectEnabled: (trackId: string, effectId: string, enabled: boolean) => void

  // Effects
  addEffect: (clipId: string, effectType: EffectType) => void
  removeEffect: (clipId: string, effectId: string) => void
  updateEffectParam: (clipId: string, effectId: string, paramName: string, value: number | [number, number] | boolean) => void
  setEffectEnabled: (clipId: string, effectId: string, enabled: boolean) => void
  addKeyframe: (clipId: string, effectId: string, paramName: string, time: number, value: number) => void
  removeKeyframe: (clipId: string, effectId: string, paramName: string, keyframeId: string) => void

  // Transitions
  setTransition: (clipId: string, transition: Transition | null, edge: 'in' | 'out') => void

  // Clip properties
  setClipSpeed: (clipId: string, speed: number) => void
  setClipTransform: (clipId: string, transform: Partial<Clip['transform']>) => void
  setClipMuted: (clipId: string, muted: boolean) => void

  // Markers
  addMarker: (time: number, color?: string, label?: string) => void
  removeMarker: (markerId: string) => void
  updateMarker: (markerId: string, updates: Partial<Marker>) => void

  // Text clips
  addTextClip: (trackId: string, timelineStart: number, textData?: Partial<TextClipData>) => void
  updateTextClip: (clipId: string, textData: Partial<TextClipData>) => void

  // Proxy management
  setMediaProxyPath: (assetId: string, proxyPath: string) => void
  useProxyForPreview: (clipId: string, useProxy: boolean) => void

  // Multicam sync
  syncMulticam: (clipIds: string[]) => Promise<void>

  // Color
  setPrimaryColor: (clipId: string, params: Partial<PrimaryColorParams>) => void
  setColorWheels: (clipId: string, params: Partial<ColorWheelsParams>) => void
  setRGBCurves: (clipId: string, curves: Partial<RGBACurve>) => void
  setParametricCurves: (clipId: string, curves: Partial<ParametricCurves>) => void
  addPrimaryColorKeyframe: (clipId: string, paramName: string, time: number, value: number) => void
  removePrimaryColorKeyframe: (clipId: string, paramName: string, keyframeId: string) => void

  // LUTs
  addLut: (lut: LUTData) => void
  removeLut: (lutId: string) => void
  applyLutToClip: (clipId: string, lutId: string | null) => void

  // Undo/Redo
  undo: () => void
  redo: () => void

  // Project IO
  serializeProject: () => string
}

const DEFAULT_SETTINGS: ProjectSettings = {
  fps: 30,
  width: 1920,
  height: 1080,
  audioSampleRate: 48000,
  duration: 60,
  basePath: '',
}

const DEFAULT_TIMELINE: TimelineState = {
  currentTime: 0,
  zoom: 30,
  scrollX: 0,
  scrollY: 0,
  playing: false,
  selectedTrackId: null,
  selectedClipId: null,
  snapEnabled: true,
  autoFollowEnabled: true,
  isDragging: false,
  dragType: 'none',
  toolMode: 'select',
  undoStack: [],
  redoStack: [],
  markers: [],
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function pushUndo(state: { project: Project | null; timeline: TimelineState }) {
  if (!state.project) return state
  const snapshot = JSON.stringify(state.project)
  const newStack = [...state.timeline.undoStack, snapshot].slice(-50)
  return {
    timeline: { ...state.timeline, undoStack: newStack, redoStack: [] },
  }
}

function createDefaultProject(name: string, settings?: Partial<ProjectSettings>): Project {
  return {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    tracks: [
      {
        id: uid(),
        name: 'Video 1',
        type: 'video',
        order: 0,
        clips: [],
        enabled: true,
        locked: false,
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        effects: [],
      },
      {
        id: uid(),
        name: 'Audio 1',
        type: 'audio',
        order: 1,
        clips: [],
        enabled: true,
        locked: false,
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        effects: [],
      },
    ],
    mediaAssets: [],
    luts: [],
    version: 1,
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  timeline: { ...DEFAULT_TIMELINE },

  newProject: (name, settings) => {
    set({
      project: createDefaultProject(name, settings),
      timeline: { ...DEFAULT_TIMELINE },
    })
  },

  loadProject: (project) => {
    set({
      project,
      timeline: { ...DEFAULT_TIMELINE, zoom: 30 },
    })
  },

  setCurrentTime: (time) =>
    set((s) => ({
      timeline: { ...s.timeline, currentTime: Math.max(0, time) },
    })),

  setZoom: (zoom) =>
    set((s) => ({
      timeline: { ...s.timeline, zoom: Math.max(1, Math.min(200, zoom)) },
    })),

  setPlaying: (playing) =>
    set((s) => ({ timeline: { ...s.timeline, playing } })),

  selectClip: (clipId) =>
    set((s) => ({ timeline: { ...s.timeline, selectedClipId: clipId } })),

  selectTrack: (trackId) =>
    set((s) => ({ timeline: { ...s.timeline, selectedTrackId: trackId } })),

  setSnap: (snapEnabled) =>
    set((s) => ({ timeline: { ...s.timeline, snapEnabled } })),

  setAutoFollow: (autoFollowEnabled) =>
    set((s) => ({ timeline: { ...s.timeline, autoFollowEnabled } })),

  setScrollX: (scrollX) =>
    set((s) => ({ timeline: { ...s.timeline, scrollX } })),

  setScrollY: (scrollY) =>
    set((s) => ({ timeline: { ...s.timeline, scrollY } })),

  setToolMode: (toolMode) =>
    set((s) => ({ timeline: { ...s.timeline, toolMode } })),

  scrollToPlayhead: (viewportWidth, labelWidth) =>
    set((s) => {
      if (!s.project) return s
      const zoom = s.timeline.zoom
      const playheadPx = s.timeline.currentTime * zoom
      const visibleWidth = viewportWidth - labelWidth
      const newScrollX = Math.max(0, playheadPx - visibleWidth / 2)
      return { timeline: { ...s.timeline, scrollX: newScrollX } }
    }),

  fitToView: (viewportWidth, viewportHeight, labelWidth, rulerHeight, trackHeight) =>
    set((s) => {
      if (!s.project) return s
      const allClips = s.project.tracks.flatMap(t => t.clips)
      if (allClips.length === 0) {
        return { timeline: { ...s.timeline, scrollX: 0, scrollY: 0, zoom: 30 } }
      }
      const maxEnd = Math.max(...allClips.map(c => c.timelineStart + c.timelineDuration))
      const minStart = Math.min(...allClips.map(c => c.timelineStart))
      const contentDuration = Math.max(maxEnd - minStart + 10, 10)
      const visibleWidth = viewportWidth - labelWidth
      const newZoom = Math.max(1, Math.min(200, visibleWidth / contentDuration))
      const newScrollX = Math.max(0, minStart * newZoom - 20)
      const tracksCount = s.project.tracks.length
      const totalTracksHeight = tracksCount * trackHeight
      const visibleHeight = viewportHeight - rulerHeight
      const newScrollY = Math.max(0, (totalTracksHeight - visibleHeight) / 2)
      return {
        timeline: {
          ...s.timeline,
          zoom: newZoom,
          scrollX: newScrollX,
          scrollY: newScrollY,
        },
      }
    }),

  addMediaAssets: (assets) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          mediaAssets: [...s.project.mediaAssets, ...assets],
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addTrack: (type, name) =>
    set((s) => {
      if (!s.project) return s
      const newTrack: Track = {
        id: uid(),
        name: name || `${type === 'video' ? 'Video' : 'Audio'} ${s.project.tracks.filter(t => t.type === type).length + 1}`,
        type,
        order: s.project.tracks.length,
        clips: [],
        enabled: true,
        locked: false,
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        effects: [],
      }
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: [...s.project.tracks, newTrack],
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeTrack: (trackId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.filter((t) => t.id !== trackId),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addClip: (mediaId, trackId, timelineStart) =>
    set((s) => {
      if (!s.project) return s
      const asset = s.project.mediaAssets.find((m) => m.id === mediaId)
      if (!asset) return s

      const newClip: Clip = {
        id: uid(),
        name: asset.name,
        mediaId,
        trackId,
        sourceStart: 0,
        sourceEnd: asset.duration,
        timelineStart,
        timelineDuration: asset.duration,
        speed: 1,
        speedRamps: [],
        effects: [],
        transform: {
          positionX: 0,
          positionY: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        transformKeyframes: {},
        muted: false,
        enabled: true,
        color: asset.type === 'video' ? '#4a9eff' : '#2ecc71',
      }

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, newClip] }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeClip: (clipId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.filter((c) => c.id !== clipId),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  moveClip: (clipId, newTrackId, newStart) =>
    set((s) => {
      if (!s.project) return s

      const clipToMove = s.project.tracks.flatMap(t => t.clips).find(c => c.id === clipId)
      if (!clipToMove) return s

      const tracksWithout = s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))

      const updatedClip: Clip = {
        ...clipToMove,
        trackId: newTrackId,
        timelineStart: newStart,
      }

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: tracksWithout.map((t) =>
            t.id === newTrackId
              ? { ...t, clips: [...t.clips, updatedClip].sort((a, b) => a.timelineStart - b.timelineStart) }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  trimClip: (clipId, newStart, newEnd) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    sourceStart: newStart,
                    sourceEnd: newEnd,
                    timelineDuration: newEnd - newStart,
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  rippleDeleteClip: (clipId) =>
    set((s) => {
      if (!s.project) return s

      const allClips = s.project.tracks.flatMap(t => t.clips)
      const deletedClip = allClips.find(c => c.id === clipId)
      if (!deletedClip) return s

      const deletedDuration = deletedClip.timelineDuration
      const deletedStart = deletedClip.timelineStart
      const deletedTrackId = deletedClip.trackId

      const tracks = s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))

      const shiftedTracks = tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.timelineStart >= deletedStart + deletedDuration && c.trackId === deletedTrackId
            ? { ...c, timelineStart: c.timelineStart - deletedDuration }
            : c
        ),
      }))

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: shiftedTracks,
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  splitClip: (clipId, time) =>
    set((s) => {
      if (!s.project) return s

      const foundClip = s.project.tracks.flatMap(t => t.clips).find(c => c.id === clipId)
      if (!foundClip) return s

      const localTime = time - foundClip.timelineStart
      if (localTime <= 0) return s
      const remaining = foundClip.timelineDuration - localTime
      if (remaining <= 0) return s

      const sourceOffset = foundClip.sourceStart + localTime / foundClip.speed

      const firstPart: Clip = {
        ...foundClip,
        id: uid(),
        sourceEnd: sourceOffset,
        timelineDuration: localTime,
      }

      const secondPart: Clip = {
        ...foundClip,
        id: uid(),
        sourceStart: sourceOffset,
        timelineStart: time,
        timelineDuration: remaining,
      }

      const tracks = s.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.flatMap((c) =>
          c.id === clipId ? [firstPart, secondPart] : [c]
        ),
      }))

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks,
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  slipClip: (clipId, sourceOffset) =>
    set((s) => {
      if (!s.project) return s

      const foundClip = s.project.tracks.flatMap(t => t.clips).find(c => c.id === clipId)
      if (!foundClip) return s

      const asset = s.project.mediaAssets.find(m => m.id === foundClip.mediaId)
      const mediaDuration = asset?.duration ?? (foundClip.sourceEnd - foundClip.sourceStart)
      const clipDuration = foundClip.sourceEnd - foundClip.sourceStart

      let newSourceStart = foundClip.sourceStart + sourceOffset
      let newSourceEnd = foundClip.sourceEnd + sourceOffset

      if (newSourceStart < 0) {
        newSourceStart = 0
        newSourceEnd = clipDuration
      }
      if (newSourceEnd > mediaDuration) {
        newSourceEnd = mediaDuration
        newSourceStart = mediaDuration - clipDuration
      }

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? { ...c, sourceStart: newSourceStart, sourceEnd: newSourceEnd }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  slideClip: (clipId, newStart) =>
    set((s) => {
      if (!s.project) return s

      const foundClip = s.project.tracks.flatMap(t => t.clips).find(c => c.id === clipId)
      if (!foundClip) return s

      const track = s.project.tracks.find(t => t.id === foundClip.trackId)
      if (!track) return s

      const delta = newStart - foundClip.timelineStart
      const clampedStart = Math.max(0, newStart)

      const otherClips = track.clips
        .filter(c => c.id !== clipId)
        .sort((a, b) => a.timelineStart - b.timelineStart)

      let adjustedStart = clampedStart
      let adjustedDuration = foundClip.timelineDuration

      if (delta > 0) {
        const nextClip = otherClips.find(c => c.timelineStart >= foundClip.timelineStart + foundClip.timelineDuration)
        if (nextClip) {
          const availableSpace = nextClip.timelineStart - (foundClip.timelineStart + foundClip.timelineDuration)
          const maxDelta = Math.min(delta, availableSpace)
          adjustedStart = foundClip.timelineStart + maxDelta
        }
      } else if (delta < 0) {
        const prevClip = otherClips.filter(c => c.timelineStart < foundClip.timelineStart).pop()
        if (prevClip) {
          const availableSpace = foundClip.timelineStart - (prevClip.timelineStart + prevClip.timelineDuration)
          const maxDelta = Math.min(Math.abs(delta), availableSpace)
          adjustedStart = foundClip.timelineStart - maxDelta
        } else {
          adjustedStart = Math.max(0, foundClip.timelineStart + delta)
        }
      }

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === foundClip.trackId
              ? {
                  ...t,
                  clips: t.clips
                    .map((c) =>
                      c.id === clipId
                        ? { ...c, timelineStart: adjustedStart, timelineDuration: adjustedDuration }
                        : c
                    )
                    .sort((a, b) => a.timelineStart - b.timelineStart),
                }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  // Track audio actions
  setTrackVolume: (trackId, volume) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId ? { ...t, volume: Math.max(0, Math.min(2, volume)) } : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setTrackPan: (trackId, pan) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId ? { ...t, pan: Math.max(-1, Math.min(1, pan)) } : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setTrackMuted: (trackId, muted) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId ? { ...t, muted } : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setTrackSolo: (trackId, solo) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId ? { ...t, solo } : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addTrackEffect: (trackId, effectType) =>
    set((s) => {
      if (!s.project) return s
      const def = BUILTIN_EFFECTS.find(e => e.type === effectType)
      if (!def) return s
      const newEffect = {
        id: uid(),
        name: def.name,
        type: def.type,
        enabled: true,
        params: Object.fromEntries(def.params.map(p => [p.name, { ...p, keyframes: [] }])),
      }
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId
              ? { ...t, effects: [...t.effects, newEffect] }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeTrackEffect: (trackId, effectId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId
              ? { ...t, effects: t.effects.filter(e => e.id !== effectId) }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  updateTrackEffectParam: (trackId, effectId, paramName, value) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId
              ? {
                  ...t,
                  effects: t.effects.map(e =>
                    e.id === effectId
                      ? { ...e, params: { ...e.params, [paramName]: { ...e.params[paramName], value } } }
                      : e
                  ),
                }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setTrackEffectEnabled: (trackId, effectId, enabled) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t =>
            t.id === trackId
              ? {
                  ...t,
                  effects: t.effects.map(e =>
                    e.id === effectId ? { ...e, enabled } : e
                  ),
                }
              : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addEffect: (clipId, effectType) =>
    set((s) => {
      if (!s.project) return s
      const def = BUILTIN_EFFECTS.find(e => e.type === effectType)
      if (!def) return s
      const newEffect = {
        id: uid(),
        name: def.name,
        type: def.type,
        enabled: true,
        params: Object.fromEntries(def.params.map(p => [p.name, { ...p, keyframes: [] }])),
      }
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? { ...c, effects: [...c.effects, newEffect] }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeEffect: (clipId, effectId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? { ...c, effects: c.effects.filter(e => e.id !== effectId) }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  updateEffectParam: (clipId, effectId, paramName, value) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? {
                    ...c,
                    effects: c.effects.map(e =>
                      e.id === effectId
                        ? { ...e, params: { ...e.params, [paramName]: { ...e.params[paramName], value } } }
                        : e
                    ),
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setEffectEnabled: (clipId, effectId, enabled) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? {
                    ...c,
                    effects: c.effects.map(e =>
                      e.id === effectId ? { ...e, enabled } : e
                    ),
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addKeyframe: (clipId, effectId, paramName, time, value) =>
    set((s) => {
      if (!s.project) return s
      const kf: Keyframe = { id: uid(), time, value, interpolation: 'linear' }
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? {
                    ...c,
                    effects: c.effects.map(e =>
                      e.id === effectId
                        ? {
                            ...e,
                            params: {
                              ...e.params,
                              [paramName]: {
                                ...e.params[paramName],
                                keyframes: [...(e.params[paramName]?.keyframes ?? []), kf],
                              },
                            },
                          }
                        : e
                    ),
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeKeyframe: (clipId, effectId, paramName, keyframeId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? {
                    ...c,
                    effects: c.effects.map(e =>
                      e.id === effectId
                        ? {
                            ...e,
                            params: {
                              ...e.params,
                              [paramName]: {
                                ...e.params[paramName],
                                keyframes: (e.params[paramName]?.keyframes ?? []).filter(k => k.id !== keyframeId),
                              },
                            },
                          }
                        : e
                    ),
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setTransition: (clipId, transition, edge) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c =>
              c.id === clipId
                ? edge === 'in'
                  ? { ...c, transitionIn: transition ?? undefined }
                  : { ...c, transitionOut: transition ?? undefined }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setClipSpeed: (clipId, speed) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    speed: Math.max(0.1, Math.min(10, speed)),
                    timelineDuration: (c.sourceEnd - c.sourceStart) / Math.max(0.1, speed),
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setClipTransform: (clipId, transform) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? { ...c, transform: { ...c.transform, ...transform } }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setClipMuted: (clipId, muted) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, muted } : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addMarker: (time, color = '#f39c12', label = 'Marker') =>
    set((s) => {
      const marker: Marker = {
        id: uid(),
        time,
        color,
        label,
      }
      return {
        ...pushUndo(s),
        timeline: {
          ...s.timeline,
          markers: [...s.timeline.markers, marker].sort((a, b) => a.time - b.time),
        },
      }
    }),

  removeMarker: (markerId) =>
    set((s) => ({
      ...pushUndo(s),
      timeline: {
        ...s.timeline,
        markers: s.timeline.markers.filter(m => m.id !== markerId),
      },
    })),

  updateMarker: (markerId, updates) =>
    set((s) => ({
      timeline: {
        ...s.timeline,
        markers: s.timeline.markers.map(m =>
          m.id === markerId ? { ...m, ...updates } : m
        ),
      },
    })),

  addTextClip: (trackId, timelineStart, partialTextData) =>
    set((s) => {
      if (!s.project) return s
      const track = s.project.tracks.find(t => t.id === trackId)
      if (!track) return s

      const defaultTextData: TextClipData = {
        content: 'New Text',
        fontFamily: 'Arial',
        fontSize: 64,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        textVAlign: 'middle',
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 0,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        letterSpacing: 0,
        lineHeight: 1.2,
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        padding: 20,
        borderRadius: 0,
      }

      const newClip: Clip = {
        id: uid(),
        name: 'Text',
        mediaId: '',
        trackId,
        sourceStart: 0,
        sourceEnd: 5,
        timelineStart,
        timelineDuration: 5,
        speed: 1,
        speedRamps: [],
        effects: [],
        transform: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        transformKeyframes: {},
        muted: true,
        enabled: true,
        color: '#e67e22',
        textData: { ...defaultTextData, ...partialTextData },
      }

      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  updateTextClip: (clipId, textData) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId && c.textData
                ? { ...c, textData: { ...c.textData, ...textData } }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  // ── Proxy management ──
  setMediaProxyPath: (assetId, proxyPath) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          mediaAssets: s.project.mediaAssets.map((a) =>
            a.id === assetId ? { ...a, proxyPath } : a
          ),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  useProxyForPreview: (clipId, useProxy) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? { ...c, _useProxy: useProxy as any }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  syncMulticam: async (clipIds) => {
    const state = get()
    if (!state.project) return

    const allClips = state.project.tracks.flatMap(t => t.clips)
    const clipsToSync = clipIds
      .map(id => allClips.find(c => c.id === id))
      .filter((c): c is Clip => c !== undefined)

    if (clipsToSync.length < 2) return

    const syncData = clipsToSync.map(clip => {
      const asset = state.project!.mediaAssets.find(m => m.id === clip.mediaId)
      return {
        clipId: clip.id,
        filePath: asset?.filePath ?? '',
        sourceStart: clip.sourceStart,
        sourceEnd: clip.sourceEnd,
      }
    }).filter(c => c.filePath)

    try {
      const results = await window.cineflow.syncMulticam(syncData)
      const referenceClip = clipsToSync[0]
      const referenceResult = results.find(r => r.clipId === referenceClip.id)
      const referenceOffset = referenceResult?.offset ?? 0

      set((s) => {
        if (!s.project) return s
        return {
          ...pushUndo(s),
          project: {
            ...s.project,
            tracks: s.project.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) => {
                const result = results.find(r => r.clipId === c.id)
                if (!result) return c
                const timeOffset = result.offset - referenceOffset
                return {
                  ...c,
                  timelineStart: c.timelineStart + timeOffset,
                }
              }),
            })),
            modifiedAt: new Date().toISOString(),
          },
        }
      })
    } catch (err) {
      console.error('Multicam sync failed:', err)
    }
  },

  // ---- Color ----

  setPrimaryColor: (clipId, params) =>
    set((s) => {
      if (!s.project) return s
      const defaults = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, saturation: 0, temperature: 0, tint: 0 }
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? { ...c, primaryColor: { ...defaults, ...c.primaryColor, ...params } }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setColorWheels: (clipId, params) =>
    set((s) => {
      if (!s.project) return s
      const defaults = { shadows: [0, 0] as [number, number], midtones: [0, 0] as [number, number], highlights: [0, 0] as [number, number], intensity: 50 }
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? { ...c, colorWheels: { ...defaults, ...c.colorWheels, ...params } }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setRGBCurves: (clipId, curves) =>
    set((s) => {
      if (!s.project) return s
      const defaultMono = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    rgbCurves: {
                      master: [...defaultMono],
                      red: [...defaultMono],
                      green: [...defaultMono],
                      blue: [...defaultMono],
                      alpha: [...defaultMono],
                      ...c.rgbCurves,
                      ...curves,
                    },
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  setParametricCurves: (clipId, curves) =>
    set((s) => {
      if (!s.project) return s
      const defaultMono = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    parametricCurves: {
                      hueVsHue: [...defaultMono],
                      hueVsSat: [...defaultMono],
                      lumaVsSat: [...defaultMono],
                      hueVsLuma: [...defaultMono],
                      ...c.parametricCurves,
                      ...curves,
                    },
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  addPrimaryColorKeyframe: (clipId, paramName, time, value) =>
    set((s) => {
      if (!s.project) return s
      const kf: Keyframe = { id: uid(), time, value, interpolation: 'linear' }
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    primaryColorKeyframes: {
                      ...c.primaryColorKeyframes,
                      [paramName]: [...(c.primaryColorKeyframes?.[paramName] ?? []), kf],
                    },
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removePrimaryColorKeyframe: (clipId, paramName, keyframeId) =>
    set((s) => {
      if (!s.project) return s
      return {
        ...pushUndo(s),
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    primaryColorKeyframes: {
                      ...c.primaryColorKeyframes,
                      [paramName]: (c.primaryColorKeyframes?.[paramName] ?? []).filter(
                        (k) => k.id !== keyframeId
                      ),
                    },
                  }
                : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  // ---- LUTs ----

  addLut: (lut) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          luts: [...(s.project.luts ?? []), lut],
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  removeLut: (lutId) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          luts: (s.project.luts ?? []).filter((l) => l.id !== lutId),
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.appliedLutId === lutId ? { ...c, appliedLutId: undefined } : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  applyLutToClip: (clipId, lutId) =>
    set((s) => {
      if (!s.project) return s
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, appliedLutId: lutId ?? undefined } : c
            ),
          })),
          modifiedAt: new Date().toISOString(),
        },
      }
    }),

  serializeProject: () => {
    const state = get()
    if (!state.project) return '{}'
    return JSON.stringify({
      ...state.project,
      modifiedAt: new Date().toISOString(),
    })
  },

  undo: () =>
    set((s) => {
      if (s.timeline.undoStack.length === 0 || !s.project) return s
      const currentSnapshot = JSON.stringify(s.project)
      const prevSnapshot = s.timeline.undoStack[s.timeline.undoStack.length - 1]
      try {
        const prevProject = JSON.parse(prevSnapshot)
        return {
          project: prevProject,
          timeline: {
            ...s.timeline,
            undoStack: s.timeline.undoStack.slice(0, -1),
            redoStack: [...s.timeline.redoStack, currentSnapshot],
          },
        }
      } catch {
        console.error('Undo: failed to parse snapshot, clearing undo stack')
        return {
          ...s,
          timeline: { ...s.timeline, undoStack: [], redoStack: [] },
        }
      }
    }),

  redo: () =>
    set((s) => {
      if (s.timeline.redoStack.length === 0 || !s.project) return s
      const currentSnapshot = JSON.stringify(s.project)
      const nextSnapshot = s.timeline.redoStack[s.timeline.redoStack.length - 1]
      try {
        const nextProject = JSON.parse(nextSnapshot)
        return {
          project: nextProject,
          timeline: {
            ...s.timeline,
            redoStack: s.timeline.redoStack.slice(0, -1),
            undoStack: [...s.timeline.undoStack, currentSnapshot],
          },
        }
      } catch {
        console.error('Redo: failed to parse snapshot, clearing redo stack')
        return {
          ...s,
          timeline: { ...s.timeline, undoStack: [], redoStack: [] },
        }
      }
    }),
}))
