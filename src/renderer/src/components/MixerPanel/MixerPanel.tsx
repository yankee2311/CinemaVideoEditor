import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/audioEngine'
import type { Track } from '@shared/types'

export default function MixerPanel() {
  const { project } = useProjectStore()
  const tracks = project?.tracks ?? []
  const audioTracks = tracks.filter(t => t.type === 'audio' || t.type === 'video')

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {audioTracks.map(track => (
          <MixerChannel key={track.id} track={track} />
        ))}
      </div>
    </div>
  )
}

function MixerChannel({ track }: { track: Track }) {
  const [volume, setVolume] = React.useState(track.volume)
  const [pan, setPan] = React.useState(track.pan)
  const [vuPeak, setVuPeak] = React.useState(0)
  const [vuRms, setVuRms] = React.useState(0)
  const animRef = React.useRef<number>(0)
  const { project } = useProjectStore()

  React.useEffect(() => {
    const tick = () => {
      if (audioEngine.initialized && project?.settings) {
        const data = audioEngine.getVUData()
        setVuPeak(data.peak)
        setVuRms(data.rms)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [project?.settings])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    audioEngine.setMasterVolume(v)
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value)
    setPan(p)
    audioEngine.setMasterPan(p)
  }

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-sm)',
      padding: 10,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{track.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase' }}>
          {track.type}
        </span>
      </div>

      {/* VU Meter */}
      <div style={{
        height: 6,
        background: 'var(--bg-secondary)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, vuRms * 100)}%`,
          background: vuPeak > 0.8 ? 'var(--danger)' : 'var(--success)',
          borderRadius: 3,
          transition: 'width 0.05s',
        }} />
      </div>

      {/* Volume fader */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Volume</div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          style={{ width: '100%', height: 3 }}
        />
      </div>

      {/* Pan knob */}
      <div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Pan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 20 }}>L</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={pan}
            onChange={handlePanChange}
            style={{ flex: 1, height: 3 }}
          />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>R</span>
        </div>
      </div>

      {/* Mute/Solo buttons */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <MiniButton active={track.muted} label="M" color="var(--danger)" />
        <MiniButton active={track.solo} label="S" color="var(--warning)" />
      </div>
    </div>
  )
}

function MiniButton({ active, label, color }: { active: boolean; label: string; color: string }) {
  return (
    <button style={{
      padding: '2px 8px',
      fontSize: 9,
      fontWeight: 700,
      background: active ? color : 'var(--bg-secondary)',
      color: active ? '#fff' : 'var(--text-muted)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      minWidth: 22,
    }}>
      {label}
    </button>
  )
}
