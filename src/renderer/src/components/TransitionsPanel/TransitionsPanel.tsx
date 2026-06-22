import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { Transition } from '@shared/types'

const TRANSITION_TYPES: { type: Transition['type']; label: string; icon: string }[] = [
  { type: 'dissolve', label: 'Dissolve', icon: '\u229E' },
  { type: 'fade', label: 'Fade', icon: '\u25A3' },
  { type: 'wipe', label: 'Wipe', icon: '\u21E8' },
  { type: 'slide', label: 'Slide', icon: '\u290D' },
  { type: 'zoom', label: 'Zoom', icon: '\u2295' },
]

export default function TransitionsPanel() {
  const { project, timeline, setTransition } = useProjectStore()

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const [duration, setDuration] = React.useState(0.5)
  const [position, setPosition] = React.useState<'in' | 'out'>('out')

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Transitions
      </h3>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
        }}>
          Types
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: 'var(--text-muted)', marginBottom: 8,
        }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Apply to:</span>
          <button
            onClick={() => setPosition('in')}
            style={{
              padding: '2px 10px', fontSize: 10, fontWeight: 500,
              background: position === 'in' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: position === 'in' ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            }}
          >In</button>
          <button
            onClick={() => setPosition('out')}
            style={{
              padding: '2px 10px', fontSize: 10, fontWeight: 500,
              background: position === 'out' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: position === 'out' ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            }}
          >Out</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TRANSITION_TYPES.map(t => (
            <button
              key={t.type}
              onClick={() => {
                if (selectedClip) {
                  setTransition(selectedClip.id, { type: t.type, duration }, position)
                }
              }}
              disabled={!selectedClip}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', fontSize: 10, fontWeight: 500,
                background: 'var(--bg-tertiary)',
                color: selectedClip ? 'var(--text-primary)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                cursor: selectedClip ? 'pointer' : 'default',
                opacity: selectedClip ? 1 : 0.5,
              }}
              title={`Add ${t.label} transition (out)`}
            >
              <span style={{ fontSize: 12 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
        }}>
          Duration: {duration.toFixed(1)}s
        </div>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.1}
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value))}
          style={{ width: '100%', height: 4, accentColor: 'var(--accent)' }}
        />
      </div>

      <h4 style={{
        fontSize: 10, fontWeight: 600, marginBottom: 8,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        Selected Clip
      </h4>
      {!selectedClip && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)' }}>
          Select a clip to edit transitions
        </p>
      )}
      {selectedClip && (
        <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-label)', textTransform: 'uppercase' }}>In: </span>
            {selectedClip.transitionIn
              ? <span>{selectedClip.transitionIn.type} ({selectedClip.transitionIn.duration}s)</span>
              : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None</span>}
            {selectedClip.transitionIn && (
              <button
                onClick={() => setTransition(selectedClip.id, null, 'in')}
                style={{
                  marginLeft: 8, background: 'none', border: 'none',
                  color: 'var(--danger)', cursor: 'pointer', fontSize: 11,
                }}
              >x</button>
            )}
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-label)', textTransform: 'uppercase' }}>Out: </span>
            {selectedClip.transitionOut
              ? <span>{selectedClip.transitionOut.type} ({selectedClip.transitionOut.duration}s)</span>
              : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None</span>}
            {selectedClip.transitionOut && (
              <button
                onClick={() => setTransition(selectedClip.id, null, 'out')}
                style={{
                  marginLeft: 8, background: 'none', border: 'none',
                  color: 'var(--danger)', cursor: 'pointer', fontSize: 11,
                }}
              >x</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
