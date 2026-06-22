import React from 'react'
import { useProjectStore } from '@/store/projectStore'

export default function ScopesPanel() {
  const { project, timeline } = useProjectStore()
  const [tab, setTab] = React.useState<'histogram' | 'waveform' | 'vectorscope'>('histogram')
  const histogramCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const waveformCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const vectorscopeCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const [pixelData, setPixelData] = React.useState<Uint8ClampedArray | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Find selected clip's media file
  const selectedMedia = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) {
        const asset = project.mediaAssets.find(m => m.id === clip.mediaId)
        if (asset && asset.filePath) {
          // Calculate source time from playhead
          const localTime = timeline.currentTime - clip.timelineStart
          const sourceTime = clip.sourceStart + localTime / (clip.speed || 1)
          return { filePath: asset.filePath, time: Math.max(0, sourceTime) }
        }
      }
    }
    return null
  }, [project, timeline.selectedClipId, timeline.currentTime])

  // Fetch pixel data from main process
  React.useEffect(() => {
    if (!selectedMedia) return

    let canceled = false
    setLoading(true)

    window.cineflow.extractFramePixels(selectedMedia.filePath, selectedMedia.time, 320, 180)
      .then(result => {
        if (canceled || !result) return
        setPixelData(new Uint8ClampedArray(result.data))
        setLoading(false)
      })
      .catch(() => {
        if (!canceled) {
          // Generate synthetic data for preview
          const synthetic = new Uint8ClampedArray(320 * 180 * 4)
          for (let i = 0; i < synthetic.length; i += 4) {
            const x = (i / 4) % 320
            const y = Math.floor((i / 4) / 320)
            const hue = ((x / 320) * 360 + y * 0.5) % 360
            const sat = 0.6 + Math.sin(y / 30) * 0.3
            // RGB from HSL
            const h = hue / 60
            const s = sat
            const l = 0.4 + Math.cos(x / 50) * 0.15
            const c = (1 - Math.abs(2 * l - 1)) * s
            const xt = c * (1 - Math.abs((h % 2) - 1))
            let r = 0, g = 0, b = 0
            if (h < 1) { r = c; g = xt; b = 0 }
            else if (h < 2) { r = xt; g = c; b = 0 }
            else if (h < 3) { r = 0; g = c; b = xt }
            else if (h < 4) { r = 0; g = xt; b = c }
            else if (h < 5) { r = xt; g = 0; b = c }
            else { r = c; g = 0; b = xt }
            const m = l - c / 2
            synthetic[i] = Math.round((r + m) * 255)
            synthetic[i + 1] = Math.round((g + m) * 255)
            synthetic[i + 2] = Math.round((b + m) * 255)
            synthetic[i + 3] = 255
          }
          setPixelData(synthetic)
          setLoading(false)
        }
      })

    return () => { canceled = true }
  }, [selectedMedia?.filePath, selectedMedia?.time])

  // Compute scope data from pixelData
  const scopeData = React.useMemo(() => {
    if (!pixelData) return null

    const w = 320, h = 180
    const hist = { r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0), luma: new Array(256).fill(0) }

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixelData.length; i += 16) {
      const r = pixelData[i]
      const g = pixelData[i + 1]
      const b = pixelData[i + 2]
      hist.r[r]++
      hist.g[g]++
      hist.b[b]++
      hist.luma[Math.round(0.299 * r + 0.587 * g + 0.114 * b)]++
    }

    // Waveform: 256 columns, each column shows luminance distribution
    const waveform: number[][] = []
    for (let col = 0; col < 256; col++) {
      const column: number[] = new Array(256).fill(0)
      const srcX = Math.floor((col / 256) * w)
      for (let y = 0; y < h; y++) {
        const idx = (y * w + srcX) * 4
        const luma = Math.round(0.299 * pixelData[idx] + 0.587 * pixelData[idx + 1] + 0.114 * pixelData[idx + 2])
        column[luma]++
      }
      waveform.push(column)
    }

    // Vectorscope data
    const vecData: Array<{ u: number; v: number }> = []
    for (let i = 0; i < pixelData.length; i += 16) {
      const r = pixelData[i] / 255
      const g = pixelData[i + 1] / 255
      const b = pixelData[i + 2] / 255
      // Simple YUV conversion for vectorscope
      const u = -0.147 * r - 0.289 * g + 0.436 * b
      const v = 0.615 * r - 0.515 * g - 0.100 * b
      vecData.push({ u, v })
    }

    return { histogram: hist, waveform, vectorscope: vecData }
  }, [pixelData])

  // Draw histogram (RGB Parade style)
  React.useEffect(() => {
    const canvas = histogramCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cw = 260, canvasH = 130
    canvas.width = cw * dpr; canvas.height = canvasH * dpr
    canvas.style.width = cw + 'px'; canvas.style.height = canvasH + 'px'
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, cw, canvasH)

    // Grid lines
    ctx.strokeStyle = '#1a1a3a'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * (canvasH - 4) + 2
      ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(cw - 2, y); ctx.stroke()
    }
    // IRE reference lines
    ctx.strokeStyle = '#2a2a5a'
    ctx.lineWidth = 1
    const refs = [0.25, 0.5, 0.75]
    for (const ref of refs) {
      const y = canvasH - 2 - ref * (canvasH - 4)
      ctx.beginPath(); ctx.setLineDash([4, 8]); ctx.moveTo(2, y); ctx.lineTo(cw - 2, y); ctx.stroke()
    }
    ctx.setLineDash([])

    if (scopeData) {
      const hist = scopeData.histogram
      const { r, g, b } = hist
      const maxVal = Math.max(
        Math.max(...(r as number[]), 1),
        Math.max(...(g as number[]), 1),
        Math.max(...(b as number[]), 1)
      )

      // Draw each channel in its own third (RGB parade)
      const third = (cw - 4) / 3
      const channels: Array<{ data: number[]; color: string; x: number }> = [
        { data: hist.r, color: '#e74c3c', x: 2 },
        { data: hist.g, color: '#2ecc71', x: 2 + third },
        { data: hist.b, color: '#3498db', x: 2 + third * 2 },
      ]

      for (const channel of channels) {
        ctx.fillStyle = channel.color + '88'
        ctx.strokeStyle = channel.color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(channel.x, canvasH - 2)
        for (let i = 0; i < 256; i++) {
          const barH = (channel.data[i] / maxVal) * (canvasH - 4)
          const bx = channel.x + (i / 256) * third
          ctx.lineTo(bx, canvasH - 2 - barH)
        }
        ctx.lineTo(channel.x + third, canvasH - 2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }

      // Labels
      ctx.fillStyle = '#666'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('R', 2 + third / 2, 14)
      ctx.fillText('G', 2 + third * 1.5, 14)
      ctx.fillText('B', 2 + third * 2.5, 14)
      ctx.fillText('0', 8, canvasH - 4)
      ctx.fillText('100', 8, 10)
    }

    // Border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(1, 1, cw - 2, canvasH - 2)
  }, [scopeData])

  // Draw waveform
  React.useEffect(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cw = 260, canvasH2 = 130
    canvas.width = cw * dpr; canvas.height = canvasH2 * dpr
    canvas.style.width = cw + 'px'; canvas.style.height = canvasH2 + 'px'
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, cw, canvasH2)

    // Grid
    ctx.strokeStyle = '#1a1a3a'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * (canvasH2 - 4) + 2
      ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(cw - 2, y); ctx.stroke()
    }

    if (scopeData && scopeData.waveform.length > 0) {
      const wf = scopeData.waveform
      const drawHeight = canvasH2 - 4

      // Create an image data buffer for the waveform
      const imgData = ctx.createImageData(cw - 4, drawHeight)

      for (let col = 0; col < Math.min(wf.length, cw - 4); col++) {
        const column = wf[col]
        const maxCol = Math.max(...column, 1)
        for (let row = 0; row < drawHeight; row++) {
          // row 0 = bottom (0 IRE), row drawHeight-1 = top (100 IRE)
          const lumaIdx = Math.floor((row / drawHeight) * 256)
          const intensity = Math.min(1, (column[Math.min(lumaIdx, 255)] ?? 0) / maxCol * 3)
          const alpha = Math.min(255, Math.floor(intensity * 180))
          const idx = ((drawHeight - 1 - row) * (cw - 4) + col) * 4
          // Green waveform with glow
          imgData.data[idx] = Math.floor(intensity * 39)
          imgData.data[idx + 1] = Math.floor(intensity * 204)
          imgData.data[idx + 2] = Math.floor(intensity * 82)
          imgData.data[idx + 3] = alpha
        }
      }
      ctx.putImageData(imgData, 2, 2)
    }

    // IRE lines
    ctx.strokeStyle = '#2a2a5a'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    for (const ref of [0.25, 0.5, 0.75]) {
      const y = canvasH2 - 2 - ref * (canvasH2 - 4)
      ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(cw - 2, y); ctx.stroke()
    }
    ctx.setLineDash([])

    // Border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(1, 1, cw - 2, canvasH2 - 2)
  }, [scopeData])

  // Draw vectorscope
  React.useEffect(() => {
    const canvas = vectorscopeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 180
    canvas.width = size * dpr; canvas.height = size * dpr
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px'
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, r = size / 2 - 12

    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, size, size)

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#1a1a3a'
    ctx.lineWidth = 2
    ctx.stroke()

    // Color wheel background (faint)
    const graticuleData = ctx.createImageData(r * 2, r * 2)
    for (let dy = 0; dy < r * 2; dy++) {
      for (let dx = 0; dx < r * 2; dx++) {
        const nx = dx - r, ny = dy - r
        const dist = Math.sqrt(nx * nx + ny * ny)
        if (dist > r) continue
        const angle = Math.atan2(ny, nx)
        const hue = ((angle + Math.PI / 2) / (Math.PI * 2)) * 360
        const sat = Math.min(1, dist / r) * 0.15
        const alpha = 30 + sat * 20
        const idx = (dy * r * 2 + dx) * 4
        // Simple HSL to RGB for the faint graticule
        const h = hue / 60
        const c2 = 1 - Math.abs(2 * 0.3 - 1)
        const x = c2 * (1 - Math.abs((h % 2) - 1))
        let red = 0, grn = 0, blu = 0
        if (h < 1) { red = c2; grn = x }
        else if (h < 2) { red = x; grn = c2 }
        else if (h < 3) { grn = c2; blu = x }
        else if (h < 4) { grn = x; blu = c2 }
        else if (h < 5) { red = x; blu = c2 }
        else { red = c2; blu = x }
        const m = 0.3 - c2 / 2
        graticuleData.data[idx] = (red + m) * 30
        graticuleData.data[idx + 1] = (grn + m) * 30
        graticuleData.data[idx + 2] = (blu + m) * 30
        graticuleData.data[idx + 3] = alpha
      }
    }
    ctx.putImageData(graticuleData, cx - r, cy - r)

    // Skin tone line
    ctx.beginPath()
    const skinAngle = -Math.PI / 6
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(skinAngle) * r * 0.8, cy + Math.sin(skinAngle) * r * 0.8)
    ctx.strokeStyle = '#f0a05044'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Crosshair
    ctx.beginPath()
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
    ctx.strokeStyle = '#2a2a5a'
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Draw vectorscope data
    if (scopeData && scopeData.vectorscope.length > 0) {
      // Draw scalar field as blurred dots
      const vecs = scopeData.vectorscope
      const step = Math.max(1, Math.floor(vecs.length / 2000))
      ctx.fillStyle = '#2ecc7188'
      for (let i = 0; i < vecs.length; i += step) {
        const { u, v } = vecs[i]
        const px = cx + u * r * 1.4
        const py = cy - v * r * 1.4
        if (Math.abs(u) < 1 && Math.abs(v) < 1) {
          ctx.fillRect(px - 1, py - 1, 2, 2)
        }
      }
    }

    // Color targets on graticule
    const targets = [
      { label: 'R', angle: Math.PI * 0.25, dist: 0.7, color: '#e74c3c' },
      { label: 'G', angle: Math.PI * 1.45, dist: 0.7, color: '#2ecc71' },
      { label: 'B', angle: Math.PI * 1.8, dist: 0.7, color: '#3498db' },
      { label: 'Yl', angle: Math.PI * 0.85, dist: 0.7, color: '#f1c40f' },
      { label: 'Cy', angle: Math.PI * 1.6, dist: 0.7, color: '#1abc9c' },
      { label: 'Mg', angle: Math.PI * 0.1, dist: 0.7, color: '#9b59b6' },
    ]
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    for (const t of targets) {
      const px = cx + Math.cos(t.angle) * r * t.dist
      const py = cy + Math.sin(t.angle) * r * t.dist
      ctx.fillStyle = t.color
      ctx.fillText(t.label, px, py + 3)
    }

    // Border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(1, 1, size - 2, size - 2)
  }, [scopeData])

  const tabs = [
    { id: 'histogram' as const, label: 'Histogram' },
    { id: 'waveform' as const, label: 'Waveform' },
    { id: 'vectorscope' as const, label: 'Vectorscope' },
  ]

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Scopes
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

      {!selectedMedia && (
        <div style={{
          fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)',
          textAlign: 'center', padding: 30,
        }}>
          Select a video clip to view scopes
        </div>
      )}

      {selectedMedia && loading && !pixelData && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 11 }}>
          Analyzing frame...
        </div>
      )}

      {selectedMedia && pixelData && (
        <>
          {tab === 'histogram' && (
            <div>
              <canvas ref={histogramCanvasRef} style={{ width: 260, height: 130, borderRadius: 'var(--radius-sm)', display: 'block', margin: '0 auto' }} />
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3, fontStyle: 'italic' }}>
                RGB Parade — Shadows → Highlights
              </div>
            </div>
          )}
          {tab === 'waveform' && (
            <div>
              <canvas ref={waveformCanvasRef} style={{ width: 260, height: 130, borderRadius: 'var(--radius-sm)', display: 'block', margin: '0 auto' }} />
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3, fontStyle: 'italic' }}>
                Luma Waveform — 0-100 IRE
              </div>
            </div>
          )}
          {tab === 'vectorscope' && (
            <div>
              <canvas ref={vectorscopeCanvasRef} style={{ width: 180, height: 180, borderRadius: '50%', display: 'block', margin: '0 auto' }} />
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3, fontStyle: 'italic' }}>
                Vectorscope — Hue & Saturation
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
