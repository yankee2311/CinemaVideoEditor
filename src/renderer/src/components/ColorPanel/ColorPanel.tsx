import React from 'react'
import ColorWheel from '@/components/ColorWheel/ColorWheel'
import CurvesEditor from '@/components/ColorPanel/CurvesEditor'
import { useProjectStore } from '@/store/projectStore'

export default function ColorPanel() {
  const { project, timeline, setClipTransform } = useProjectStore()
  const [tab, setTab] = React.useState<'wheels' | 'curves' | 'lut'>('wheels')

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const tabs = [
    { id: 'wheels' as const, label: 'Wheels' },
    { id: 'curves' as const, label: 'Curves' },
    { id: 'lut' as const, label: 'LUT' },
  ]

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
        Color Correction
      </h3>

      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '4px 8px', fontSize: 9, fontWeight: 600,
              background: tab === t.id ? 'var(--bg-active)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'wheels' && <ColorWheels />}
      {tab === 'curves' && <CurvesEditor />}
      {tab === 'lut' && <LUTPanel />}
    </div>
  )
}

function ColorWheels() {
  const { project, timeline, updateEffectParam } = useProjectStore()

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const [shadows, setShadows] = React.useState<[number, number]>([0, 0])
  const [midtones, setMidtones] = React.useState<[number, number]>([0, 0])
  const [highlights, setHighlights] = React.useState<[number, number]>([0, 0])
  const [intensity, setIntensity] = React.useState(50)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <ColorWheel label="Shadows" value={shadows} onChange={setShadows} />
        <ColorWheel label="Midtones" value={midtones} onChange={setMidtones} />
        <ColorWheel label="Highlights" value={highlights} onChange={setHighlights} />
      </div>
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Intensity
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={intensity}
          onChange={(e) => setIntensity(parseInt(e.target.value))}
          style={{ width: '100%', height: 3 }}
        />
      </div>
    </div>
  )
}

function LUTPanel() {
  const [luts, setLuts] = React.useState<Array<{ id: string; name: string }>>([])
  const [selectedLut, setSelectedLut] = React.useState<string | null>(null)
  const [opacity, setOpacity] = React.useState(1)

  const handleImport = async () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.cube,.3dl'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const result = await window.cineflow.loadLut((file as any).path)
        if (result) {
          setLuts(prev => [...prev, { id: result.id, name: result.name }])
        }
      }
      input.click()
    } catch {}
  }

  return (
    <div>
      <button
        onClick={handleImport}
        style={{
          width: '100%', padding: '6px 0', fontSize: 11,
          background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', marginBottom: 10,
        }}
      >
        Import LUT (.cube / .3dl)
      </button>

      {luts.length === 0 && (
        <p style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)' }}>
          No LUTs loaded
        </p>
      )}

      {luts.map(lut => (
        <div
          key={lut.id}
          onClick={() => setSelectedLut(lut.id)}
          style={{
            padding: '6px 8px',
            background: selectedLut === lut.id ? 'var(--bg-active)' : 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 4,
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--text-primary)',
          }}
        >
          {lut.name}
        </div>
      ))}

      {selectedLut && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Opacity
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', height: 3 }}
          />
        </div>
      )}
    </div>
  )
}
