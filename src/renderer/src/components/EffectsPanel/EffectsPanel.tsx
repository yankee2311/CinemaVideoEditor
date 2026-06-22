import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import { BUILTIN_EFFECTS } from '@shared/types'
import type { Effect, EffectParam } from '@shared/types'

export default function EffectsPanel() {
  const { project, timeline, addEffect, removeEffect, updateEffectParam, setEffectEnabled, addKeyframe } = useProjectStore()

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const categories = React.useMemo(() => {
    const map = new Map<string, typeof BUILTIN_EFFECTS>()
    for (const def of BUILTIN_EFFECTS) {
      const list = map.get(def.category) ?? []
      list.push(def)
      map.set(def.category, list)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <SectionTitle>Available Effects</SectionTitle>
      <div style={{ marginBottom: 16 }}>
        {categories.map(([category, defs]) => (
          <div key={category} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              {category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {defs.map(def => (
                <button
                  key={def.id}
                  onClick={() => {
                    if (!selectedClip) return
                    const alreadyAdded = selectedClip.effects.some(e => e.type === def.id)
                    if (alreadyAdded) return
                    addEffect(selectedClip.id, def.id)
                  }}
                  disabled={!selectedClip}
                  style={{
                    padding: '4px 10px',
                    fontSize: 10,
                    fontWeight: 500,
                    background: 'var(--bg-tertiary)',
                    color: selectedClip ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    cursor: selectedClip ? 'pointer' : 'default',
                    opacity: selectedClip ? 1 : 0.5,
                  }}
                >
                  {def.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>Clip Effects</SectionTitle>
      {!selectedClip && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)' }}>
          Select a clip to edit effects
        </p>
      )}
      {selectedClip && selectedClip.effects.length === 0 && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)' }}>
          No effects on this clip
        </p>
      )}
      {selectedClip?.effects.map(effect => (
        <EffectItem
          key={effect.id}
          effect={effect}
          onRemove={() => removeEffect(selectedClip.id, effect.id)}
          onToggle={(enabled) => setEffectEnabled(selectedClip.id, effect.id, enabled)}
          onParamChange={(paramName, value) => updateEffectParam(selectedClip.id, effect.id, paramName, value)}
          onAddKeyframe={(paramName, value) => addKeyframe(selectedClip.id, effect.id, paramName, timeline.currentTime, value)}
        />
      ))}
    </div>
  )
}

function EffectItem({
  effect,
  onRemove,
  onToggle,
  onParamChange,
  onAddKeyframe,
}: {
  effect: Effect
  onRemove: () => void
  onToggle: (enabled: boolean) => void
  onParamChange: (paramName: string, value: number | [number, number] | boolean) => void
  onAddKeyframe: (paramName: string, value: number) => void
}) {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div style={{ marginBottom: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 10 }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{effect.name}</span>
        <button
          onClick={() => onToggle(!effect.enabled)}
          style={{
            padding: '1px 8px',
            fontSize: 9,
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
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '4px 8px 8px' }}>
          {Object.values(effect.params).map(param => (
            <EffectParamControl
              key={param.name}
              param={param}
              onChange={(value) => onParamChange(param.name, value)}
              onAddKeyframe={() => onAddKeyframe(param.name, param.value as number)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EffectParamControl({
  param,
  onChange,
  onAddKeyframe,
}: {
  param: EffectParam
  onChange: (value: number | [number, number] | boolean) => void
  onAddKeyframe: () => void
}) {
  const hasKeyframes = (param.keyframes?.length ?? 0) > 0

  if (param.type === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-label)', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {param.name}
        </span>
        <button
          onClick={() => onChange(!param.value)}
          style={{
            padding: '1px 8px',
            fontSize: 9,
            fontWeight: 600,
            background: param.value ? 'var(--accent)' : 'var(--bg-secondary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {param.value ? 'ON' : 'OFF'}
        </button>
      </div>
    )
  }

  if (param.type === 'number') {
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-label)', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {param.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'right' }}>
            {typeof param.value === 'number' ? param.value.toFixed(2) : param.value}
          </span>
          {param.animatable && (
            <button
              onClick={onAddKeyframe}
              title="Add keyframe"
              style={{
                width: 14, height: 14, padding: 0,
                background: hasKeyframes ? 'var(--accent)' : 'transparent',
                border: hasKeyframes ? 'none' : '1px solid var(--text-muted)',
                borderRadius: 2,
                cursor: 'pointer',
                transform: 'rotate(45deg)',
              }}
            />
          )}
        </div>
        {hasKeyframes ? (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
            Keyframed — edit in Keyframes tab
          </div>
        ) : (
          <input
            type="range"
            min={param.min ?? 0}
            max={param.max ?? 1}
            step={param.step ?? 0.01}
            value={typeof param.value === 'number' ? param.value : 0}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{ width: '100%', height: 4, accentColor: 'var(--accent)' }}
          />
        )}
      </div>
    )
  }

  return null
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 11,
      fontWeight: 600,
      marginBottom: 10,
      color: 'var(--accent)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}>
      {children}
    </h3>
  )
}
