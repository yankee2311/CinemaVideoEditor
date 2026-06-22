import React from 'react'

export default function ScopesPanel() {
  const [tab, setTab] = React.useState<'histogram' | 'waveform' | 'vectorscope'>('histogram')
  const histogramCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const waveformCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const vectorscopeCanvasRef = React.useRef<HTMLCanvasElement>(null)

  const [histogramData] = React.useState(() => {
    const r = new Array(256).fill(0)
    const g = new Array(256).fill(0)
    const b = new Array(256).fill(0)
    const luma = new Array(256).fill(0)
    for (let i = 0; i < 256; i++) {
      const val = Math.sin(i / 256 * Math.PI) * 50 + 10
      r[i] = val * (0.5 + Math.random() * 0.5)
      g[i] = val * (0.5 + Math.random() * 0.5)
      b[i] = val * (0.5 + Math.random() * 0.5)
      luma[i] = (r[i] + g[i] + b[i]) / 3
    }
    return { r, g, b, luma }
  })

  React.useEffect(() => {
    drawHistogram()
    drawWaveform()
    drawVectorscope()
  }, [tab, histogramData])

  const drawHistogram = () => {
    const canvas = histogramCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = 240, h = 120
    canvas.width = w * dpr; canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, w, h)

    const drawChannel = (data: number[], color: string, alpha: number = 0.5) => {
      const max = Math.max(...data, 1)
      ctx.fillStyle = color
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let i = 0; i < 256; i++) {
        const barH = (data[i] / max) * h
        ctx.lineTo((i / 256) * w, h - barH)
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
      ctx.globalAlpha = 1
    }

    drawChannel(histogramData.r, '#e74c3c')
    drawChannel(histogramData.g, '#2ecc71')
    drawChannel(histogramData.b, '#3498db')
  }

  const drawWaveform = () => {
    const canvas = waveformCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = 240, h = 120
    canvas.width = w * dpr; canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#2ecc71'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.3
    for (let line = 0; line < 10; line++) {
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin((x + line * 20) / 20) * h / 3
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  const drawVectorscope = () => {
    const canvas = vectorscopeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = 160
    canvas.width = size * dpr; canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, size, size)

    // Circle
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth = 1
    ctx.stroke()

    // Crosshair
    ctx.beginPath()
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
    ctx.stroke()

    // Sample points
    ctx.fillStyle = '#2ecc71'
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * r * 0.8
      const px = cx + Math.cos(angle) * dist
      const py = cy + Math.sin(angle) * dist
      ctx.fillRect(px, py, 2, 2)
    }
    ctx.globalAlpha = 1

    // Color targets
    const targets = [
      { label: 'R', angle: 0, dist: r * 0.85, color: '#e74c3c' },
      { label: 'G', angle: 120, dist: r * 0.85, color: '#2ecc71' },
      { label: 'B', angle: 240, dist: r * 0.85, color: '#3498db' },
      { label: 'Y', angle: 60, dist: r * 0.85, color: '#f1c40f' },
      { label: 'C', angle: 180, dist: r * 0.85, color: '#1abc9c' },
      { label: 'M', angle: 300, dist: r * 0.85, color: '#9b59b6' },
    ]
    for (const t of targets) {
      const rad = (t.angle - 90) * Math.PI / 180
      const px = cx + Math.cos(rad) * t.dist
      const py = cy + Math.sin(rad) * t.dist
      ctx.fillStyle = t.color
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t.label, px, py + 3)
    }
  }

  const tabs = [
    { id: 'histogram' as const, label: 'Histogram' },
    { id: 'waveform' as const, label: 'Waveform' },
    { id: 'vectorscope' as const, label: 'Vectorscope' },
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

      {tab === 'histogram' && <canvas ref={histogramCanvasRef} style={{ width: 240, height: 120, borderRadius: 'var(--radius-sm)' }} />}
      {tab === 'waveform' && <canvas ref={waveformCanvasRef} style={{ width: 240, height: 120, borderRadius: 'var(--radius-sm)' }} />}
      {tab === 'vectorscope' && <canvas ref={vectorscopeCanvasRef} style={{ width: 160, height: 160, borderRadius: 'var(--radius-sm)', display: 'block', margin: '0 auto' }} />}
    </div>
  )
}
