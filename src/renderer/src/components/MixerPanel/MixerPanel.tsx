import React, { useRef, useCallback } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/audioEngine'
import { BUILTIN_EFFECTS } from '@shared/types'
import type { Track, Effect } from '@shared/types'

// ─── dB conversion helpers ─────────────────────────────

function linearToDb(linear: number): number {
  if (linear <= 0.000001) return -120
  return 20 * Math.log10(linear)
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

function rmsToDb(rms: number): number {
  if (rms <= 0.000001) return -120
  return 20 * Math.log10(rms)
}

// ─── Types ─────────────────────────────────────────────

interface DuckingConfig {
  voiceTrackId: string | null
  enabled: boolean
  threshold: number
  attenuation: number
  attack: number
  release: number
}

// ─── Main Component ────────────────────────────────────

export default function MixerPanel() {
  const { project, timeline, setTrackVolume, setTrackPan, setTrackMuted, setTrackSolo, addTrackEffect, removeTrackEffect, updateTrackEffectParam, setTrackEffectEnabled } = useProjectStore()
  const tracks = project?.tracks ?? []
  const audioTracks = tracks.filter(t => t.type === 'audio' || t.type === 'video')

  // Ducking state
  const [ducking, setDucking] = React.useState<DuckingConfig>({
    voiceTrackId: null,
    enabled: false,
    threshold: -30,
    attenuation: -12,
    attack: 20,
    release: 150,
  })

  // Apply ducking config to engine
  React.useEffect(() => {
    audioEngine.configureDucking({
      voiceTrackId: ducking.voiceTrackId,
      threshold: ducking.threshold,
      attenuation: ducking.attenuation,
      attack: ducking.attack,
      release: ducking.release,
      hold: 50,
      enabled: ducking.enabled,
    })
  }, [ducking])

  // Run ducking tick on every animation frame when enabled
  React.useEffect(() => {
    if (!ducking.enabled) return
    let raf: number
    const tick = () => {
      audioEngine.tickDucking()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ducking.enabled])

  // Check for solo active on any track
  const hasSolo = tracks.some(t => t.solo)

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 14,
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        Audio Mixer
      </h3>

      {/* Ducking Section */}
      <DuckingSection
        ducking={ducking}
        tracks={audioTracks}
        onChange={setDucking}
      />

      {/* Master Channel */}
      <MasterChannel />

      {/* Track Channels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {audioTracks.map(track => (
          <MixerChannel
            key={track.id}
            track={track}
            hasSolo={hasSolo}
            onVolumeChange={(v) => setTrackVolume(track.id, v)}
            onPanChange={(p) => setTrackPan(track.id, p)}
            onMuteToggle={() => setTrackMuted(track.id, !track.muted)}
            onSoloToggle={() => setTrackSolo(track.id, !track.solo)}
            onAddEffect={(type) => addTrackEffect(track.id, type)}
            onRemoveEffect={(effectId) => removeTrackEffect(track.id, effectId)}
            onUpdateEffectParam={(effectId, paramName, value) => updateTrackEffectParam(track.id, effectId, paramName, value)}
            onToggleEffect={(effectId, enabled) => setTrackEffectEnabled(track.id, effectId, enabled)}
          />
        ))}
      </div>

      {audioTracks.length === 0 && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
          No audio tracks. Add an audio or video track to mix.
        </p>
      )}
    </div>
  )
}

// ─── Master Channel ────────────────────────────────────

function MasterChannel() {
  const [masterVolume, setMasterVolume] = React.useState(1)
  const { project } = useProjectStore()
  const [vuPeak, setVuPeak] = React.useState(0)
  const [vuRms, setVuRms] = React.useState(0)
  const [vuDb, setVuDb] = React.useState(-120)
  const rafRef = useRef<number>(0)
  const peakHoldRef = useRef<{ value: number; time: number }>({ value: 0, time: 0 })

  React.useEffect(() => {
    const tick = () => {
      if (audioEngine.initialized) {
        const data = audioEngine.getVUData()
        setVuPeak(data.peak)
        setVuRms(data.rms)
        setVuDb(rmsToDb(data.rms))

        // Peak hold with 2s decay
        const now = performance.now()
        if (data.peak > peakHoldRef.current.value || now - peakHoldRef.current.time > 2000) {
          peakHoldRef.current = { value: data.peak, time: now }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setMasterVolume(v)
    audioEngine.setMasterVolume(v)
  }

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-sm)',
      padding: 10,
      marginBottom: 12,
      border: '1px solid var(--accent)',
      borderOpacity: 0.3,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--accent)',
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>MASTER</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          {vuDb > -120 ? `${vuDb.toFixed(1)} dB` : '-∞ dB'}
        </span>
      </div>

      {/* Master VU Meter with scale */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
          <span>-∞</span><span>-42</span><span>-24</span><span>-12</span><span>-6</span><span>0</span>
        </div>
        <div style={{
          height: 8,
          background: 'var(--bg-secondary)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Green zone (-∞ to -12dB) */}
          <div style={{
            position: 'absolute',
            height: '100%',
            left: 0,
            width: `${Math.min(70, Math.max(0, (vuDb + 120) / 120 * 70))}%`,
            background: 'linear-gradient(90deg, #27ae60, #2ecc71)',
            borderRadius: '4px 0 0 4px',
          }} />
          {/* Yellow zone (-12dB to -3dB) */}
          <div style={{
            position: 'absolute',
            height: '100%',
            left: `${(108 / 120) * 70}%`,
            width: `${Math.min(15, Math.max(0, (vuDb + 12) / 9 * 15))}%`,
            background: 'linear-gradient(90deg, #f39c12, #f1c40f)',
          }} />
          {/* Red zone (-3dB to 0dB) */}
          <div style={{
            position: 'absolute',
            height: '100%',
            left: `${(117 / 120) * 70}%`,
            width: `${Math.min(8, Math.max(0, (vuDb + 3) / 3 * 8))}%`,
            background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
            borderRadius: '0 4px 4px 0',
          }} />
          {/* Peak hold line */}
          <div style={{
            position: 'absolute',
            height: '100%',
            left: `${Math.min(98, vuPeak * 100)}%`,
            width: 2,
            background: '#fff',
            opacity: 0.8,
          }} />
        </div>
      </div>

      {/* Master volume fader */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>
          <span>Volume</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{(masterVolume * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={handleVolumeChange}
          style={{ width: '100%', height: 4, accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

// ─── Mixer Channel ─────────────────────────────────────

function MixerChannel({
  track,
  hasSolo,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onAddEffect,
  onRemoveEffect,
  onUpdateEffectParam,
  onToggleEffect,
}: {
  track: Track
  hasSolo: boolean
  onVolumeChange: (v: number) => void
  onPanChange: (p: number) => void
  onMuteToggle: () => void
  onSoloToggle: () => void
  onAddEffect: (type: string) => void
  onRemoveEffect: (effectId: string) => void
  onUpdateEffectParam: (effectId: string, paramName: string, value: number | [number, number] | boolean) => void
  onToggleEffect: (effectId: string, enabled: boolean) => void
}) {
  const [vuPeak, setVuPeak] = React.useState(0)
  const [vuRms, setVuRms] = React.useState(0)
  const [vuDb, setVuDb] = React.useState(-120)
  const rafRef = useRef<number>(0)
  const [showEffects, setShowEffects] = React.useState(false)

  // Volume in linear (store uses 0-2 linear scale)
  const volumeDisplay = dbToLinear(linearToDb(track.volume))

  // VU meter animation
  React.useEffect(() => {
    const tick = () => {
      if (audioEngine.initialized) {
        // Get VU from active sources on this track
        // For now we use master VU as a fallback since sources don't store trackId
        const data = audioEngine.getVUData()
        setVuPeak(data.peak)
        setVuRms(data.rms)
        setVuDb(rmsToDb(data.rms))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(parseFloat(e.target.value))
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPanChange(parseFloat(e.target.value))
  }

  // Compute effective mute: muted if explicitly muted, OR if another track has solo
  const effectiveMute = hasSolo ? !track.solo : track.muted

  const audioEffects = BUILTIN_EFFECTS.filter(e => e.category === 'audio')

  return (
    <div style={{
      background: effectiveMute ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-sm)',
      padding: 10,
      opacity: effectiveMute ? 0.5 : 1,
      transition: 'all 0.15s ease',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{track.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>
          {vuDb > -120 ? `${vuDb.toFixed(0)}dB` : '-∞'}
        </span>
      </div>

      {/* VU Meter */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          height: 6,
          background: 'var(--bg-secondary)',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(70, Math.max(0, (vuDb + 120) / 120 * 70))}%`,
            background: 'linear-gradient(90deg, #27ae60, #2ecc71)',
            borderRadius: '3px 0 0 3px',
            transition: 'width 0.05s',
          }} />
          <div style={{
            position: 'absolute',
            height: '100%',
            left: `${Math.min(98, vuPeak * 100)}%`,
            width: 2,
            background: '#fff',
            opacity: 0.8,
            transition: 'left 0.15s',
          }} />
        </div>
      </div>

      {/* Volume fader with dB display */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>
          <span>Vol</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {linearToDb(track.volume) > -60 ? `${linearToDb(track.volume).toFixed(1)}dB` : '-∞dB'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={track.volume}
          onChange={handleVolumeChange}
          style={{ width: '100%', height: 4, accentColor: 'var(--accent)' }}
        />
      </div>

      {/* Pan knob */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>
          Pan: {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 12 }}>L</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={track.pan}
            onChange={handlePanChange}
            style={{ flex: 1, height: 4, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 12, textAlign: 'right' }}>R</span>
        </div>
      </div>

      {/* Mute/Solo/Effects buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <TrackButton
          active={track.muted}
          label="M"
          color="var(--danger)"
          onClick={onMuteToggle}
        />
        <TrackButton
          active={track.solo}
          label="S"
          color="var(--warning)"
          onClick={onSoloToggle}
        />
        <TrackButton
          active={showEffects}
          label="FX"
          color="var(--accent)"
          onClick={() => setShowEffects(!showEffects)}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Track Effects */}
      {showEffects && (
        <TrackEffectsSection
          track={track}
          audioEffects={audioEffects}
          onAddEffect={onAddEffect}
          onRemoveEffect={onRemoveEffect}
          onUpdateEffectParam={onUpdateEffectParam}
          onToggleEffect={onToggleEffect}
        />
      )}

      {/* Clip count indicator */}
      {track.clips.length > 0 && (
        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
          {track.clips.length} clip{track.clips.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────

function TrackButton({
  active,
  label,
  color,
  onClick,
  style,
}: {
  active: boolean
  label: string
  color: string
  onClick: () => void
  style?: React.CSSProperties
}) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '3px 10px',
        fontSize: 9,
        fontWeight: 700,
        background: active ? color : (hovered ? 'var(--bg-hover)' : 'var(--bg-secondary)'),
        color: active ? '#fff' : 'var(--text-muted)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        minWidth: 22,
        transition: 'all 0.1s ease',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

// ─── Ducking Section ───────────────────────────────────

function DuckingSection({
  ducking,
  tracks,
  onChange,
}: {
  ducking: DuckingConfig
  tracks: Track[]
  onChange: (d: DuckingConfig) => void
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-sm)',
      padding: 8,
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          flex: 1,
        }}>
          🎤 Auto Ducking
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onChange({ ...ducking, enabled: !ducking.enabled })
          }}
          style={{
            padding: '2px 10px',
            fontSize: 9,
            fontWeight: 600,
            background: ducking.enabled ? 'var(--success)' : 'var(--bg-secondary)',
            color: ducking.enabled ? '#fff' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {ducking.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Voice track selector */}
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
              Voice Track
            </label>
            <select
              value={ducking.voiceTrackId ?? ''}
              onChange={(e) => onChange({ ...ducking, voiceTrackId: e.target.value || null })}
              style={{
                width: '100%',
                padding: '3px 8px',
                fontSize: 10,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <option value="">None</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Threshold */}
          <DuckingParam
            label="Threshold"
            value={ducking.threshold}
            unit="dB"
            min={-60}
            max={0}
            step={1}
            onChange={(v) => onChange({ ...ducking, threshold: v })}
          />

          {/* Attenuation */}
          <DuckingParam
            label="Attenuation"
            value={ducking.attenuation}
            unit="dB"
            min={-24}
            max={-3}
            step={1}
            onChange={(v) => onChange({ ...ducking, attenuation: v })}
          />

          {/* Attack */}
          <DuckingParam
            label="Attack"
            value={ducking.attack}
            unit="ms"
            min={1}
            max={200}
            step={1}
            onChange={(v) => onChange({ ...ducking, attack: v })}
          />

          {/* Release */}
          <DuckingParam
            label="Release"
            value={ducking.release}
            unit="ms"
            min={10}
            max={1000}
            step={10}
            onChange={(v) => onChange({ ...ducking, release: v })}
          />
        </div>
      )}
    </div>
  )
}

function DuckingParam({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginBottom: 1 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 3, accentColor: 'var(--accent)' }}
      />
    </div>
  )
}

// ─── Track Effects Sub-section ─────────────────────────

function TrackEffectsSection({
  track,
  audioEffects,
  onAddEffect,
  onRemoveEffect,
  onUpdateEffectParam,
  onToggleEffect,
}: {
  track: Track
  audioEffects: { id: string; type: string; name: string }[]
  onAddEffect: (type: string) => void
  onRemoveEffect: (effectId: string) => void
  onUpdateEffectParam: (effectId: string, paramName: string, value: number | [number, number] | boolean) => void
  onToggleEffect: (effectId: string, enabled: boolean) => void
}) {
  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8, marginTop: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Track FX
      </div>

      {/* Add effect buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {audioEffects.map(def => {
          const alreadyAdded = track.effects.some(e => e.type === def.type)
          return (
            <button
              key={def.id}
              onClick={() => !alreadyAdded && onAddEffect(def.type)}
              disabled={alreadyAdded}
              style={{
                padding: '2px 8px',
                fontSize: 8,
                fontWeight: 500,
                background: alreadyAdded ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                color: alreadyAdded ? 'var(--text-muted)' : 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                cursor: alreadyAdded ? 'default' : 'pointer',
                opacity: alreadyAdded ? 0.5 : 1,
              }}
            >
              {def.name}
            </button>
          )
        })}
      </div>

      {/* Active effects */}
      {track.effects.length === 0 && (
        <p style={{ fontSize: 8, fontStyle: 'italic', color: 'var(--text-muted)' }}>
          No track effects
        </p>
      )}

      {track.effects.map(effect => (
        <TrackEffectItem
          key={effect.id}
          effect={effect}
          onRemove={() => onRemoveEffect(effect.id)}
          onToggle={(enabled) => onToggleEffect(effect.id, enabled)}
          onParamChange={(paramName, value) => onUpdateEffectParam(effect.id, paramName, value)}
        />
      ))}
    </div>
  )
}

function TrackEffectItem({
  effect,
  onRemove,
  onToggle,
  onParamChange,
}: {
  effect: Effect
  onRemove: () => void
  onToggle: (enabled: boolean) => void
  onParamChange: (paramName: string, value: number | [number, number] | boolean) => void
}) {
  const [expanded, setExpanded] = React.useState(true)

  // Special rendering for equalizer
  const isEq = effect.type === 'equalizer'

  return (
    <div style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 8 }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{ flex: 1, fontSize: 9, fontWeight: 600, color: 'var(--text-primary)' }}>{effect.name}</span>
        <button
          onClick={() => onToggle(!effect.enabled)}
          style={{
            padding: '1px 6px',
            fontSize: 7,
            fontWeight: 600,
            background: effect.enabled ? 'var(--success)' : 'var(--bg-secondary)',
            color: effect.enabled ? '#fff' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {effect.enabled ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '2px 6px 6px' }}>
          {isEq ? (
            <EQVisualizer
              bands={(Array.from({ length: 5 }, (_, i) => ({
                freq: [80, 250, 800, 2500, 8000][i],
                gain: (effect.params[`band${i + 1}`]?.value as number) ?? 0,
              })))}
              onChange={(bandIdx, gain) => onParamChange(`band${bandIdx + 1}`, gain)}
            />
          ) : (
            Object.values(effect.params).map(param => (
              <div key={param.name} style={{ marginBottom: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 8, color: 'var(--text-label)', textTransform: 'uppercase' }}>
                    {param.name}
                  </span>
                  <span style={{ fontSize: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {typeof param.value === 'number' ? param.value.toFixed(1) : String(param.value)}
                  </span>
                </div>
                {typeof param.value === 'number' && (
                  <input
                    type="range"
                    min={param.min ?? 0}
                    max={param.max ?? 1}
                    step={param.step ?? 0.01}
                    value={param.value}
                    onChange={(e) => onParamChange(param.name, parseFloat(e.target.value))}
                    style={{ width: '100%', height: 3, accentColor: 'var(--accent)', marginTop: 1 }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── EQ Visualizer ─────────────────────────────────────

function EQVisualizer({
  bands,
  onChange,
}: {
  bands: { freq: number; gain: number }[]
  onChange: (bandIdx: number, gain: number) => void
}) {
  return (
    <div>
      {/* EQ curve visualization */}
      <div style={{
        height: 40,
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 6,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
      }}>
        {/* Grid lines */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* EQ curve using SVG */}
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <polyline
            points={bands.map((b, i) => {
              const x = ((i + 1) / (bands.length + 1)) * 100
              const y = 50 - (b.gain / 12) * 45
              return `${x}%,${y}%`
            }).join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
          {bands.map((b, i) => {
            const x = ((i + 1) / (bands.length + 1)) * 100
            const y = 50 - (b.gain / 12) * 45
            return (
              <circle
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                r="2.5"
                fill="var(--accent)"
                stroke="var(--bg-tertiary)"
                strokeWidth="1"
              />
            )
          })}
        </svg>
      </div>

      {/* Band sliders */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
        {bands.map((band, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginBottom: 1 }}>
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={band.gain}
              onChange={(e) => onChange(i, parseFloat(e.target.value))}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                height: 35,
                width: 3,
                accentColor: band.gain > 0 ? '#2ecc71' : band.gain < 0 ? '#e74c3c' : 'var(--text-muted)',
                padding: 0,
              }}
            />
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginTop: 2 }}>
              {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : band.freq}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
