import type { Caption } from '../types'

export function parseSRT(content: string): Caption[] {
  const captions: Caption[] = []
  const blocks = content.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    // Skip index line
    const timeLine = lines.find(l => l.includes('-->'))
    if (!timeLine) continue

    const textLines = lines.filter(l => !l.includes('-->') && !/^\d+$/.test(l.trim()))
    const text = textLines.join('\n').trim()
    if (!text) continue

    const times = timeLine.split('-->').map(t => parseSRTTime(t.trim()))
    if (times.length !== 2) continue

    captions.push({
      id: `caption-${captions.length + 1}`,
      start: times[0],
      end: times[1],
      text,
    })
  }

  return captions
}

function parseSRTTime(time: string): number {
  const [hms, ms] = time.split(',')
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + s + parseInt(ms || '0') / 1000
}

export function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
