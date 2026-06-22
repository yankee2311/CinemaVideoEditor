import React from 'react'
import { useProjectStore } from '@/store/projectStore'

const MARKER_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#ffffff']

export default function MarkersPanel() {
  const { timeline, addMarker, removeMarker, updateMarker, setCurrentTime } = useProjectStore()
  const { markers } = timeline

  const [editingId, setEditingId] = React.useState<string | null>(null)

  const handleAdd = () => {
    addMarker(timeline.currentTime)
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
  }

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{
          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: 1, margin: 0,
        }}>
          Markers
        </h3>
        <button
          onClick={handleAdd}
          style={{
            padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          + Add (M)
        </button>
      </div>

      {markers.length === 0 && (
        <p style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)' }}>
          No markers. Press M to add at playhead.
        </p>
      )}

      {markers.map(marker => (
        <div
          key={marker.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 6px', marginBottom: 3,
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontSize: 11,
          }}
          onClick={() => handleSeek(marker.time)}
        >
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: marker.color, flexShrink: 0,
          }} />
          <div style={{
            fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            minWidth: 50,
          }}>
            {formatTime(marker.time)}
          </div>
          {editingId === marker.id ? (
            <input
              autoFocus
              value={marker.label}
              onChange={(e) => updateMarker(marker.id, { label: e.target.value })}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
              style={{ flex: 1, fontSize: 10, padding: '1px 4px' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              style={{ flex: 1, color: 'var(--text-primary)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(marker.id) }}
            >
              {marker.label}
            </div>
          )}
          <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
            {MARKER_COLORS.map(c => (
              <div
                key={c}
                onClick={() => updateMarker(marker.id, { color: c })}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: c, cursor: 'pointer', opacity: marker.color === c ? 1 : 0.4,
                }}
              />
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); removeMarker(marker.id) }}
            style={{
              background: 'none', border: 'none', color: 'var(--danger)',
              cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`
}
