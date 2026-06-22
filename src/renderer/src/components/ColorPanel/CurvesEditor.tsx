import React from 'react'

export interface CurvePoint {
  x: number
  y: number
}

interface CurvesEditorProps {
  channels: Array<{
    label: string
    color: string
    points: CurvePoint[]
  }>
  onPointsChange: (channelIndex: number, points: CurvePoint[]) => void
  size?: number
}

export default function CurvesEditor({ channels, onPointsChange, size = 200 }: CurvesEditorProps) {
  const [activeChannel, setActiveChannel] = React.useState(0)
  const [draggingPoint, setDraggingPoint] = React.useState<number | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  const current = channels[activeChannel] ?? channels[0]

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, size, size)

    // Grid
    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * size
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(size, pos); ctx.stroke()
    }

    // Histogram background (subtle)
    ctx.strokeStyle = '#222244'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let x = 0; x < size; x++) {
      const y = size * 0.1 * Math.sin((x / size) * Math.PI * 3) + size * 0.15
      x === 0 ? ctx.moveTo(x, size - y) : ctx.lineTo(x, size - y)
    }
    ctx.stroke()

    if (current && current.points.length >= 2) {
      // Draw curve
      ctx.lineWidth = 2.5
      ctx.strokeStyle = current.color
      ctx.shadowColor = current.color
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.moveTo(current.points[0].x * size, size - current.points[0].y * size)
      for (let i = 1; i < current.points.length; i++) {
        ctx.lineTo(current.points[i].x * size, size - current.points[i].y * size)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Draw points
    for (const pt of current?.points ?? []) {
      const px = pt.x * size
      const py = size - pt.y * size
      // Glow
      ctx.beginPath()
      ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.fillStyle = current.color + '44'
      ctx.fill()
      // Point
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = current.color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [channels, activeChannel, size])

  const getCanvasPoint = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width * (size / rect.width)))
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height * (size / rect.height)))
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!current) return
    const pt = getCanvasPoint(e)
    let closestIdx = -1
    let closestDist = 0.12
    for (let i = 0; i < current.points.length; i++) {
      const d = Math.sqrt((current.points[i].x - pt.x) ** 2 + (current.points[i].y - pt.y) ** 2)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    }
    if (closestIdx >= 0) {
      setDraggingPoint(closestIdx)
    } else if (current.points.length < 12) {
      // Add new point
      const newPoints = [...current.points, pt].sort((a, b) => a.x - b.x)
      const idx = newPoints.findIndex(p => p.x === pt.x && p.y === pt.y)
      onPointsChange(activeChannel, newPoints)
      setDraggingPoint(idx)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPoint === null || !current) return
    const pt = getCanvasPoint(e)
    const newPoints = [...current.points]
    // Don't move endpoints horizontally
    if (draggingPoint === 0) pt.x = 0
    if (draggingPoint === newPoints.length - 1) pt.x = 1
    newPoints[draggingPoint] = pt
    newPoints.sort((a, b) => a.x - b.x)
    onPointsChange(activeChannel, newPoints)
  }

  const handleMouseUp = () => setDraggingPoint(null)

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!current || current.points.length <= 2) return
    const pt = getCanvasPoint(e)
    let closestIdx = -1
    let closestDist = 0.08
    for (let i = 1; i < current.points.length - 1; i++) {
      const d = Math.sqrt((current.points[i].x - pt.x) ** 2 + (current.points[i].y - pt.y) ** 2)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    }
    if (closestIdx >= 0) {
      const newPoints = current.points.filter((_, i) => i !== closestIdx)
      onPointsChange(activeChannel, newPoints)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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
        onDoubleClick={handleDoubleClick}
        style={{
          width: size, height: size,
          borderRadius: 'var(--radius-sm)',
          cursor: 'crosshair',
          display: 'block',
          margin: '0 auto',
        }}
      />
      <p style={{
        fontSize: 9, color: 'var(--text-muted)', textAlign: 'center',
        marginTop: 4, fontStyle: 'italic',
      }}>
        Click to add · Drag to adjust · Double-click to remove
      </p>
    </div>
  )
}
