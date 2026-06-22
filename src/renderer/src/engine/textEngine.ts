import type { TextClipData } from '@shared/types'

export function renderTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  textData: TextClipData,
  width: number,
  height: number,
  currentTime: number,
  clipStart: number,
  clipDuration: number,
) {
  const {
    content, fontFamily, fontSize, fontWeight, fontStyle,
    textAlign, textVAlign, color, strokeColor, strokeWidth,
    shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur,
    letterSpacing, lineHeight, backgroundColor, backgroundOpacity,
    padding, borderRadius,
  } = textData

  const scale = Math.min(width / 1920, height / 1080)
  const fs = fontSize * scale
  const ls = letterSpacing * scale
  const lh = lineHeight * fs
  const pad = padding * scale
  const br = borderRadius * scale

  ctx.save()

  // Background
  if (backgroundColor && backgroundOpacity > 0) {
    ctx.globalAlpha = backgroundOpacity
    ctx.fillStyle = backgroundColor
    const rx = pad
    const ry = pad
    const rw = width - pad * 2
    const rh = height - pad * 2
    if (br > 0) {
      roundRect(ctx, rx, ry, rw, rh, br)
      ctx.fill()
    } else {
      ctx.fillRect(rx, ry, rw, rh)
    }
    ctx.globalAlpha = 1
  }

  // Text shadow
  if (shadowColor && (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0)) {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = shadowBlur * scale
    ctx.shadowOffsetX = shadowOffsetX * scale
    ctx.shadowOffsetY = shadowOffsetY * scale
  }

  // Font
  ctx.font = `${fontStyle} ${fontWeight} ${fs}px "${fontFamily}", sans-serif`
  ctx.textAlign = textAlign === 'left' ? 'left' : textAlign === 'right' ? 'right' : 'center'
  ctx.textBaseline = 'middle'

  // Split lines
  const lines = content.split('\n')

  // Calculate text block height
  const totalTextHeight = lines.length * lh

  // Starting Y
  let startY: number
  switch (textVAlign) {
    case 'top':
      startY = pad + fs / 2
      break
    case 'bottom':
      startY = height - pad - totalTextHeight + fs / 2
      break
    case 'middle':
    default:
      startY = (height - totalTextHeight) / 2 + fs / 2
      break
  }

  // Calculate X position
  const getX = (lineWidth: number): number => {
    switch (textAlign) {
      case 'left': return pad
      case 'right': return width - pad
      case 'center': return width / 2
    }
  }

  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const y = startY + i * lh
    const x = getX(ctx.measureText(line).width)

    // Draw stroke
    if (strokeWidth > 0 && strokeColor) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth * scale
      ctx.lineJoin = 'round'
      if (letterSpacing !== 0) {
        drawLetterSpacedText(ctx, line, x, y, ls)
      } else {
        ctx.strokeText(line, x, y)
      }
    }

    // Draw fill
    ctx.fillStyle = color
    if (letterSpacing !== 0) {
      drawLetterSpacedText(ctx, line, x, y, ls)
    } else {
      ctx.fillText(line, x, y)
    }
  }

  ctx.restore()
}

function drawLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  const chars = text.split('')
  let totalWidth = 0
  for (let i = 0; i < chars.length; i++) {
    const charWidth = ctx.measureText(chars[i]).width
    totalWidth += charWidth + spacing
  }
  totalWidth -= spacing

  let startX: number
  switch (ctx.textAlign) {
    case 'center': startX = x - totalWidth / 2; break
    case 'right': startX = x - totalWidth; break
    default: startX = x; break
  }

  let cx = startX
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y)
    ctx.strokeText(chars[i], cx, y)
    cx += ctx.measureText(chars[i]).width + spacing
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
