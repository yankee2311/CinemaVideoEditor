import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { Transition } from '@shared/types'

const TRANSITION_TYPES: { type: Transition['type']; label: string; icon: string }[] = [
  { type: 'dissolve', label: 'Dissolve', icon: '⊞' },
  { type: 'fade', label: 'Fade', icon: '▣' },
  { type: 'wipe', label: 'Wipe', icon: '⇨' },
  { type: 'slide', label: 'Slide', icon: '⤍' },
  { type: 'zoom', label: 'Zoom', icon: '⊕' },
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
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
          Types
        </div>
        <div style={{\n          display: 'flex', alignItems: 'center', gap: 6,\n          fontSize: 10, color: 'var(--text-muted)', marginBottom: 8,\n        }}>\n          <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Apply to:</span>\n          <button\n            onClick={() => setPosition('in')}\n            style={{\n              padding: '2px 10px', fontSize: 10, fontWeight: 500,\n              background: position === 'in' ? 'var(--accent)' : 'var(--bg-secondary)',\n              color: position === 'in' ? '#fff' : 'var(--text-muted)',\n              borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',\n            }}\n          >In</button>\n          <button\n            onClick={() => setPosition('out')}\n            style={{\n              padding: '2px 10px', fontSize: 10, fontWeight: 500,\n              background: position === 'out' ? 'var(--accent)' : 'var(--bg-secondary)',\n              color: position === 'out' ? '#fff' : 'var(--text-muted)',\n              borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',\n            }}\n          >Out</button>\n        </div>\n        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>\n          {TRANSITION_TYPES.map(t => (\n            <button\n              key={t.type}\n              onClick={() => {\n                if (selectedClip) {\n                  setTransition(selectedClip.id, { type: t.type, duration }, position)\n                }\n              }}
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
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
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

      <h4 style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11 }}
              >
                ×
              </button>
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
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
