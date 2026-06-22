import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { timeToString } from '@/engine/timelineEngine'
import type { Effect, Keyframe } from '@shared/types'

export default function KeyframeEditor() {
  const { project, timeline, removeKeyframe } = useProjectStore()

  const [selectedEffectId, setSelectedEffectId] = React.useState<string | null>(null)
  const [selectedParam, setSelectedParam] = React.useState<string | null>(null)

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  React.useEffect(() => {
    setSelectedEffectId(null)
    setSelectedParam(null)
  }, [timeline.selectedClipId])

  const selectedEffect = selectedClip?.effects.find(e => e.id === selectedEffectId) ?? null

  const keyframes: Keyframe[] = (() => {
    if (!selectedEffect || !selectedParam) return []
    const param = selectedEffect.params[selectedParam]
    return param?.keyframes ?? []
  })()

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Keyframes
      </h3>

      {!selectedClip && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)' }}>
          Select a clip to edit keyframes
        </p>
      )}

      {selectedClip && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
              Effect
            </div>
            <select
              value={selectedEffectId ?? ''}
              onChange={(e) => { setSelectedEffectId(e.target.value || null); setSelectedParam(null) }}
              style={{
                width: '100%', padding: '4px 6px', fontSize: 11,
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
              }}
            >
              <option value="">-- Select effect --</option>
              {selectedClip.effects.filter(e => e.enabled).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {selectedEffect && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                Parameter
              </div>
              <select
                value={selectedParam ?? ''}
                onChange={(e) => setSelectedParam(e.target.value || null)}
                style={{
                  width: '100%', padding: '4px 6px', fontSize: 11,
                  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                }}
              >
                <option value="">-- Select param --</option>
                {Object.values(selectedEffect.params).filter(p => p.animatable).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedEffect && selectedParam && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Keyframes ({keyframes.length})
              </div>
              {keyframes.length === 0 && (
                <p style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)' }}>
                  No keyframes. Add one from the Effects panel.
                </p>
              )}
              {keyframes.map(kf => (
                <div
                  key={kf.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 6px', marginBottom: 3,
                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-label)', minWidth: 50 }}>
                    T:{timeToString(kf.time)}
                  </span>
                  <span style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    V:{kf.value.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {kf.interpolation}
                  </span>
                  <button
                    onClick={() => removeKeyframe(selectedClip!.id, selectedEffect!.id, selectedParam!, kf.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
