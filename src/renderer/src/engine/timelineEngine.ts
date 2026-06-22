export function timeToString(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const cs = Math.floor((s % 1) * 100)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function timeToPixels(time: number, zoom: number): number {
  return time * zoom
}

export function pixelsToTime(pixels: number, zoom: number): number {
  return pixels / zoom
}

export function snapTime(
  time: number,
  snapPoints: number[],
  threshold: number = 0.05
): number {
  for (const point of snapPoints) {
    if (Math.abs(time - point) < threshold) {
      return point
    }
  }
  return time
}

export function getSnapPoints(clips: { timelineStart: number; timelineDuration: number }[]): number[] {
  const points = [0]
  for (const clip of clips) {
    points.push(clip.timelineStart)
    points.push(clip.timelineStart + clip.timelineDuration)
  }
  return points
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
