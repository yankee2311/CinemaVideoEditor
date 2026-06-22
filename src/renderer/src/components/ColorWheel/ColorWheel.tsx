import React from 'react'

interface ColorWheelProps {
  label: string
  value: [number, number]
  onChange: (value: [number, number]) => void
  size?: number
}

export default function ColorWheel({ label, value, onChange, size = 80 }: ColorWheelProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 4

    // Draw color wheel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > radius) continue

        const angle = Math.atan2(dy, dx)
        const hue = ((angle + Math.PI) / (Math.PI * 2)) * 360
        const sat = Math.min(1, dist / radius)
        ctx.fillStyle = `hsl(${hue}, ${sat * 100}%, 50%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Draw indicator
    const [dx, dy] = value
    const indX = cx + dx * radius
    const indY = cy + dy * radius
    ctx.beginPath()
    ctx.arc(indX, indY, 5, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(indX, indY, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }, [size, value])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    updatePosition(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) updatePosition(e)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const updatePosition = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 4
    const x = e.clientX - rect.left - cx
    const y = e.clientY - rect.top - cy
    const dist = Math.sqrt(x * x + y * y)
    const clampedDist = Math.min(dist, radius)
    const angle = Math.atan2(y, x)
    const nx = Math.cos(angle) * (clampedDist / radius)
    const ny = Math.sin(angle) * (clampedDist / radius)
    onChange([Math.round(nx * 100) / 100, Math.round(ny * 100) / 100])
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: size, height: size, borderRadius: '50%', cursor: 'crosshair', display: 'block', margin: '0 auto' }}
      />
    </div>
  )
}
