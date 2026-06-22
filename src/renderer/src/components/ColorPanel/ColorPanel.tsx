import React from 'react'
import ColorWheel from '@/components/ColorWheel/ColorWheel'
import CurvesEditor from '@/components/ColorPanel/CurvesEditor'
import { useProjectStore } from '@/store/projectStore'
import type { PrimaryColorParams, ColorWheelsParams, RGBACurve, ParametricCurves, CurvePoint } from '@shared/color'

export default function ColorPanel() {
  const { project, timeline } = useProjectStore()
  const [tab, setTab] = React.useState<'primary' | 'wheels' | 'curves' | 'parametric' | 'lut'>('primary')

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const tabs = [
    { id: 'primary' as const, label: 'Primary' },
    { id: 'wheels' as const, label: 'Wheels' },
    { id: 'curves' as const, label: 'Curves' },
    { id: 'parametric' as const, label: 'Param' },
    { id: 'lut' as const, label: 'LUT' },
  ]

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Color Correction
      </h3>

      <div style={{ display: 'flex', gap: 1, marginBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, minWidth: 40, padding: '4px 6px', fontSize: 9, fontWeight: 600,
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

      {!selectedClip && (
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          Select a clip to edit color
        </div>
      )}

      {selectedClip && (
        <>
          {tab === 'primary' && <PrimaryTab clipId={selectedClip.id} primaryColor={selectedClip.primaryColor} />}
          {tab === 'wheels' && <WheelsTab clipId={selectedClip.id} colorWheels={selectedClip.colorWheels} />}
          {tab === 'curves' && <CurvesTab clipId={selectedClip.id} rgbCurves={selectedClip.rgbCurves} />}
          {tab === 'parametric' && <ParametricTab clipId={selectedClip.id} parametricCurves={selectedClip.parametricCurves} />}
          {tab === 'lut' && <LUTTab clipId={selectedClip.id} appliedLutId={selectedClip.appliedLutId} />}
        </>
      )}
    </div>
  )
}

/* ======== Primary Tab ======== */

const PRIMARY_PARAMS: Array<{ key: keyof PrimaryColorParams; label: string; min: number; max: number; step: number }> = [
  { key: 'exposure', label: 'Exposure', min: -5, max: 5, step: 0.05 },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.01 },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
  { key: 'whites', label: 'Whites', min: -1, max: 1, step: 0.01 },
  { key: 'blacks', label: 'Blacks', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'Tint', min: -1, max: 1, step: 0.01 },
]

function PrimaryTab({ clipId, primaryColor }: { clipId: string; primaryColor?: PrimaryColorParams }) {
  const { setPrimaryColor, addPrimaryColorKeyframe, timeline } = useProjectStore()

  const defaults = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, saturation: 0, temperature: 0, tint: 0 }
  const vals = { ...defaults, ...primaryColor }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Reset button */}
      <button
        onClick={() => setPrimaryColor(clipId, defaults)}
        style={{
          alignSelf: 'flex-end', padding: '3px 10px', fontSize: 9, fontWeight: 600,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', marginBottom: 8,
        }}
      >
        Reset All
      </button>

      {PRIMARY_PARAMS.map(param => (
        <SliderRow
          key={param.key}
          label={param.label}
          value={vals[param.key]}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={(v) => setPrimaryColor(clipId, { [param.key]: v })}
          onAddKeyframe={() => addPrimaryColorKeyframe(clipId, param.key, timeline.currentTime, vals[param.key])}
        />
      ))}
    </div>
  )
}

function SliderRow({
  label, value, min, max, step, onChange, onAddKeyframe,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; onAddKeyframe: () => void;
}) {
  const [inputVal, setInputVal] = React.useState(String(Math.round(value * 100) / 100))
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef({ x: 0, v: 0 })

  React.useEffect(() => { setInputVal(String(Math.round(value * 100) / 100)) }, [value])

  const handleLabelDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = { x: e.clientX, v: value }
    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - dragRef.current.x) * step * 10
      let v = Math.round((dragRef.current.v + delta) / step) * step
      v = Math.max(min, Math.min(max, v))
      setInputVal(String(Math.round(v * 100) / 100))
      onChange(v)
    }
    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
      <span
        className="label-drag"
        onMouseDown={handleLabelDrag}
        style={{
          fontSize: 10, color: isDragging ? 'var(--accent)' : 'var(--text-label)',
          minWidth: 72, textTransform: 'uppercase', letterSpacing: 0.4,
          cursor: 'ew-resize', userSelect: 'none',
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          setInputVal(String(Math.round(v * 100) / 100))
          onChange(v)
        }}
        style={{ flex: 1, height: 3 }}
      />
      <input
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={() => {
          let v = parseFloat(inputVal)
          if (isNaN(v)) v = value
          v = Math.max(min, Math.min(max, v))
          setInputVal(String(Math.round(v * 100) / 100))
          onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            let v = parseFloat(inputVal)
            if (isNaN(v)) v = value
            v = Math.max(min, Math.min(max, v))
            setInputVal(String(Math.round(v * 100) / 100))
            onChange(v)
          }
        }}
        style={{
          width: 44, textAlign: 'right', fontSize: 10,
          fontFamily: 'var(--font-mono)', padding: '2px 4px',
        }}
      />
      <button
        onClick={onAddKeyframe}
        title="Add keyframe"
        style={{
          width: 16, height: 16, padding: 0, fontSize: 8, lineHeight: 1,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ◆
      </button>
    </div>
  )
}

/* ======== Wheels Tab ======== */

function WheelsTab({ clipId, colorWheels }: { clipId: string; colorWheels?: ColorWheelsParams }) {
  const { setColorWheels } = useProjectStore()
  const ws = colorWheels ?? { shadows: [0, 0] as [number, number], midtones: [0, 0] as [number, number], highlights: [0, 0] as [number, number], intensity: 50 }

  const handleShadowChange = (v: [number, number]) => setColorWheels(clipId, { shadows: v })
  const handleMidChange = (v: [number, number]) => setColorWheels(clipId, { midtones: v })
  const handleHLChange = (v: [number, number]) => setColorWheels(clipId, { highlights: v })
  const handleIntensity = (v: number) => setColorWheels(clipId, { intensity: v })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <ColorWheel label="Shadows" value={ws.shadows} onChange={handleShadowChange} size={78} />
        <ColorWheel label="Midtones" value={ws.midtones} onChange={handleMidChange} size={78} />
        <ColorWheel label="Highlights" value={ws.highlights} onChange={handleHLChange} size={78} />
      </div>

      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Intensity {ws.intensity}%
        </div>
        <input
          type="range"
          min={0} max={100} step={1}
          value={ws.intensity}
          onChange={(e) => handleIntensity(parseInt(e.target.value))}
          style={{ width: '100%', height: 3 }}
        />
      </div>

      <button
        onClick={() => setColorWheels(clipId, { shadows: [0, 0], midtones: [0, 0], highlights: [0, 0], intensity: 50 })}
        style={{
          padding: '3px 10px', fontSize: 9, fontWeight: 600,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        Reset Wheels
      </button>
    </div>
  )
}

/* ======== Curves Tab ======== */

function CurvesTab({ clipId, rgbCurves }: { clipId: string; rgbCurves?: RGBACurve }) {
  const { setRGBCurves } = useProjectStore()

  const curves = rgbCurves ?? {
    master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    alpha: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  }

  const channels = [
    { key: 'master' as const, label: 'RGB', color: '#fff' },
    { key: 'red' as const, label: 'R', color: '#e74c3c' },
    { key: 'green' as const, label: 'G', color: '#2ecc71' },
    { key: 'blue' as const, label: 'B', color: '#3498db' },
    { key: 'alpha' as const, label: 'A', color: '#f39c12' },
  ]

  return (
    <div>
      <CurvesEditor
        channels={channels.map(ch => ({
          label: ch.label,
          color: ch.color,
          points: curves[ch.key],
        }))}
        onPointsChange={(channelIndex, points) => {
          const key = channels[channelIndex].key
          setRGBCurves(clipId, { [key]: points })
        }}
      />
      <button
        onClick={() => {
          const reset = {
            master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            alpha: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          }
          setRGBCurves(clipId, reset)
        }}
        style={{
          marginTop: 8, width: '100%', padding: '4px 0', fontSize: 10, fontWeight: 600,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        Reset Curves
      </button>
    </div>
  )
}

/* ======== Parametric Curves Tab ======== */

function ParametricTab({ clipId, parametricCurves }: { clipId: string; parametricCurves?: ParametricCurves }) {
  const { setParametricCurves } = useProjectStore()

  const curves = parametricCurves ?? {
    hueVsHue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    hueVsSat: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    lumaVsSat: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    hueVsLuma: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  }

  const channels = [
    { key: 'hueVsHue' as const, label: 'H vs H', color: '#e74c3c' },
    { key: 'hueVsSat' as const, label: 'H vs S', color: '#2ecc71' },
    { key: 'lumaVsSat' as const, label: 'L vs S', color: '#3498db' },
    { key: 'hueVsLuma' as const, label: 'H vs L', color: '#f39c12' },
  ]

  return (
    <div>
      <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, fontStyle: 'italic' }}>
        Parametric curves adjust colors based on their input hue/sat/luma values.
      </p>
      <CurvesEditor
        channels={channels.map(ch => ({
          label: ch.label,
          color: ch.color,
          points: curves[ch.key],
        }))}
        onPointsChange={(channelIndex, points) => {
          const key = channels[channelIndex].key
          setParametricCurves(clipId, { [key]: points })
        }}
      />
      <button
        onClick={() => {
          const reset = {
            hueVsHue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            hueVsSat: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            lumaVsSat: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            hueVsLuma: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          }
          setParametricCurves(clipId, reset)
        }}
        style={{
          marginTop: 8, width: '100%', padding: '4px 0', fontSize: 10, fontWeight: 600,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        Reset Parametric
      </button>
    </div>
  )
}

/* ======== LUT Tab ======== */

function LUTTab({ clipId, appliedLutId }: { clipId: string; appliedLutId?: string }) {
  const { project, addLut, removeLut, applyLutToClip } = useProjectStore()
  const [opacity, setOpacity] = React.useState(1)
  const luts = project?.luts ?? []

  const handleImport = async () => {
    try {
      const result = await window.cineflow.importLut()
      if (result) {
        addLut({
          id: result.id,
          name: result.name,
          filePath: result.filePath,
          data: null,
          size: result.size,
        })
      }
    } catch (err) {
      console.error('Failed to import LUT:', err)
    }
  }

  const appliedLut = luts.find(l => l.id === appliedLutId)

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

      {appliedLut && (
        <div style={{
          padding: '6px 8px', marginBottom: 8,
          background: 'var(--accent)', borderRadius: 'var(--radius-sm)',
          fontSize: 11, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            ✓ {appliedLut.name}
          </span>
          <button
            onClick={() => applyLutToClip(clipId, null)}
            style={{
              background: 'transparent', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14, lineHeight: 1, fontWeight: 'bold',
            }}
          >
            ×
          </button>
        </div>
      )}

      {luts.length === 0 && (
        <p style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)' }}>
          No LUTs loaded. Import a .cube or .3dl file.
        </p>
      )}

      {luts.map(lut => (
        <div
          key={lut.id}
          onClick={() => applyLutToClip(clipId, lut.id)}
          style={{
            padding: '6px 8px',
            background: appliedLutId === lut.id ? 'var(--bg-active)' : 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)', marginBottom: 4,
            cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {lut.name}
          </span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', marginLeft: 8 }}>
            {lut.size}³
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); removeLut(lut.id) }}
            style={{
              background: 'transparent', color: 'var(--text-muted)', border: 'none',
              cursor: 'pointer', fontSize: 12, lineHeight: 1, marginLeft: 4,
              padding: '0 2px',
            }}
            title="Remove LUT"
          >
            ×
          </button>
        </div>
      ))}

      {appliedLutId && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Blend Opacity
          </div>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', height: 3 }}
          />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
            {Math.round(opacity * 100)}%
          </div>
        </div>
      )}
    </div>
  )
}
