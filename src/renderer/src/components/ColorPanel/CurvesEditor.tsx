import React from 'react'

interface CurvePoint {
  x: number
  y: number
}

interface CurveChannel {
  label: string
  color: string
  points: CurvePoint[]
}

const DEFAULT_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 },
]

export default function CurvesEditor() {
  const [channels, setChannels] = React.useState<CurveChannel[]>([
    { label: 'RGB', color: '#fff', points: [...DEFAULT_POINTS] },
    { label: 'R', color: '#e74c3c', points: [...DEFAULT_POINTS] },
    { label: 'G', color: '#2ecc71', points: [...DEFAULT_POINTS] },
    { label: 'B', color: '#3498db', points: [...DEFAULT_POINTS] },
    { label: 'A', color: '#f39c12', points: [...DEFAULT_POINTS] },
  ])
  const [activeChannel, setActiveChannel] = React.useState(0)
  const [draggingPoint, setDraggingPoint] = React.useState<number | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const SIZE = 200

  const current = channels[activeChannel]

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    // Background grid
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIZE, SIZE)

    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * SIZE
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(SIZE, pos); ctx.stroke()
    }

    // Draw curve
    if (current.points.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(current.points[0].x * SIZE, SIZE - current.points[0].y * SIZE)
      for (let i = 1; i < current.points.length; i++) {
        ctx.lineTo(current.points[i].x * SIZE, SIZE - current.points[i].y * SIZE)
      }
      ctx.strokeStyle = current.color
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Draw points
    for (const pt of current.points) {
      const px = pt.x * SIZE
      const py = SIZE - pt.y * SIZE
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fillStyle = current.color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [channels, activeChannel])

  const getCanvasPoint = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / SIZE))
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / SIZE))
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pt = getCanvasPoint(e)
    let closestIdx = -1
    let closestDist = 0.1
    for (let i = 0; i < current.points.length; i++) {
      const d = Math.sqrt((current.points[i].x - pt.x) ** 2 + (current.points[i].y - pt.y) ** 2)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    }
    if (closestIdx >= 0) {
      setDraggingPoint(closestIdx)
    } else {
      const newPoints = [...current.points, pt].sort((a, b) => a.x - b.x)
      const newChannels = [...channels]
      newChannels[activeChannel] = { ...current, points: newPoints }
      setChannels(newChannels)
      setDraggingPoint(newPoints.findIndex(p => p.x === pt.x && p.y === pt.y))
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPoint === null) return
    const pt = getCanvasPoint(e)
    if (draggingPoint === 0 || draggingPoint === current.points.length - 1) {
      if (draggingPoint === 0) { pt.x = 0 }
      if (draggingPoint === current.points.length - 1) { pt.x = 1 }
    }
    const newPoints = [...current.points]
    newPoints[draggingPoint] = pt
    newPoints.sort((a, b) => a.x - b.x)
    const newIdx = newPoints.findIndex(p => p.x === pt.x && p.y === pt.y)
    const newChannels = [...channels]
    newChannels[activeChannel] = { ...current, points: newPoints }
    setChannels(newChannels)
    setDraggingPoint(newIdx)
  }

  const handleMouseUp = () => setDraggingPoint(null)

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'wrap' }}>
        {channels.map((ch, i) => (
          <button
            key={ch.label}
            onClick={() => setActiveChannel(i)}
            style={{
              padding: '3px 8px', fontSize: 9, fontWeight: 600,
              background: activeChannel === i ? ch.color : 'var(--bg-tertiary)',
              color: activeChannel === i ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', minWidth: 30,
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: SIZE, height: SIZE, borderRadius: 'var(--radius-sm)', cursor: 'crosshair', display: 'block', margin: '0 auto' }}
      />
      <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
        Click to add point · Drag to adjust
      </p>
    </div>
  )
}
