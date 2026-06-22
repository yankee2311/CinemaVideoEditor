import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { app, BrowserWindow } from 'electron'
import { detectGPU, getEncoder, supportsHardwareAccel } from './hardware'
import type { GPUInfo, HardwareAccel, ExportSettings } from '../../shared/types'

const ffmpegDir = path.join(app.getAppPath(), 'resources', 'ffmpeg')
const ffmpegPath = path.join(ffmpegDir, 'ffmpeg.exe')
const ffprobePath = path.join(ffmpegDir, 'ffprobe.exe')

if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}
if (fs.existsSync(ffprobePath)) {
  ffmpeg.setFfprobePath(ffprobePath)
}

function uid(): string {
  return crypto.randomUUID()
}

export interface MediaProbeResult {
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  audioChannels: number
  audioSampleRate: number
  hasAudio: boolean
  hasVideo: boolean
}

function getTempDir(): string {
  const dir = path.join(os.tmpdir(), 'cineflow')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function probeMedia(filePath: string): Promise<MediaProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) return reject(err)

      const videoStream = data.streams.find(s => s.codec_type === 'video')
      const audioStream = data.streams.find(s => s.codec_type === 'audio')

      let fps = 30
      if (videoStream?.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/')
        fps = parseInt(num) / parseInt(den)
      }

      resolve({
        duration: data.format.duration ?? 0,
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
        fps: isNaN(fps) ? 30 : fps,
        codec: videoStream?.codec_name ?? '',
        audioChannels: audioStream?.channels ?? 0,
        audioSampleRate: audioStream?.sample_rate ?? 0,
        hasAudio: !!audioStream,
        hasVideo: !!videoStream,
      })
    })
  })
}

export function extractThumbnail(
  filePath: string,
  time: number
): Promise<string> {
  const outputPath = path.join(getTempDir(), `thumb_${uid()}.png`)

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .screenshots({
        timestamps: [time],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x?',
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject)
  })
}

import type { FfmpegCommand } from 'fluent-ffmpeg'

let activeProcess: FfmpegCommand | null = null

export function extractFrameAsBase64(
  filePath: string,
  time: number
): Promise<string> {
  if (activeProcess) {
    try { activeProcess.kill('SIGKILL') } catch { }
    activeProcess = null
  }

  const tmpPath = path.join(getTempDir(), `frame_${uid()}.png`)

  return new Promise<string>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        try { command.kill('SIGKILL') } catch { }
        reject(new Error('timeout'))
      }
    }, 15000)

    const command = ffmpeg(filePath)
      .inputOptions(['-ss', String(time)])
      .outputOptions(['-vframes 1', '-f image2', '-vsync vfr', '-sws_flags bilinear'])
      .output(tmpPath)
      .on('end', () => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        activeProcess = null
        try {
          if (fs.existsSync(tmpPath)) {
            const data = fs.readFileSync(tmpPath)
            fs.unlinkSync(tmpPath)
            resolve(`data:image/png;base64,${data.toString('base64')}`)
          } else {
            reject(new Error('output file not found'))
          }
        } catch (err) {
          reject(err)
        }
      })
      .on('error', (err: Error) => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        activeProcess = null
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch { }
        reject(err)
      })

    activeProcess = command
    command.run()
  })
}

export function extractFrame(
  filePath: string,
  time: number
): Promise<string> {
  const outputPath = path.join(getTempDir(), `frame_${uid()}.png`)

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .output(outputPath)
      .outputOptions([
        `-ss ${time}`,
        '-vframes 1',
        '-f image2',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

export function generatePreviewVideo(
  filePath: string,
  speed: number,
  start: number,
  end: number
): Promise<string> {
  const outputPath = path.join(getTempDir(), `preview_${uid()}.mp4`)
  const duration = end - start

  return new Promise((resolve, reject) => {
    const command = ffmpeg(filePath)
      .output(outputPath)
      .outputOptions([
        `-ss ${start}`,
        `-t ${duration}`,
        `-filter:v setpts=${1 / speed}*PTS`,
        '-c:v libx264',
        '-preset ultrafast',
        '-crf 28',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)

    command.run()
  })
}

export interface ExportEffectInfo {
  type: string
  enabled: boolean
  params: Record<string, { value: number | boolean | [number, number] | [number, number, number] | string; type: string }>
}

export interface ExportTransitionInfo {
  type: string
  duration: number
}

import type { PrimaryColorParams, ColorWheelsParams, RGBACurve, CurvePoint } from '../../shared/color'

export interface ExportClipInfo {
  filePath: string
  sourceStart: number
  sourceEnd: number
  speed: number
  muted: boolean
  timelineStart: number
  effects?: ExportEffectInfo[]
  transitionIn?: ExportTransitionInfo | null
  transitionOut?: ExportTransitionInfo | null
  audioEffects?: ExportEffectInfo[]
  volume?: number
  pan?: number
  primaryColor?: PrimaryColorParams | null
  colorWheels?: ColorWheelsParams | null
  rgbCurves?: RGBACurve | null
  appliedLutPath?: string | null
  transform?: {
    positionX: number
    positionY: number
    scaleX: number
    scaleY: number
    rotation: number
    opacity: number
  }
}

// ═══════════════════════════════════════════════
// Effect filter builders
// ═══════════════════════════════════════════════

function buildEffectsFilter(effects: ExportEffectInfo[]): string {
  const filters: string[] = []
  for (const effect of effects) {
    if (!effect.enabled) continue
    switch (effect.type) {
      case 'brightness-contrast': {
        const b = (effect.params.brightness?.value as number) ?? 0
        const c = (effect.params.contrast?.value as number) ?? 0
        if (b !== 0 || c !== 0) {
          filters.push(`eq=brightness=${b.toFixed(2)}:contrast=${(1 + c).toFixed(2)}`)
        }
        break
      }
      case 'hue-saturation': {
        const h = (effect.params.hue?.value as number) ?? 0
        const s = (effect.params.saturation?.value as number) ?? 0
        const l = (effect.params.lightness?.value as number) ?? 0
        if (h !== 0 || s !== 0 || l !== 0) {
          filters.push(`hue=h=${h.toFixed(1)}:s=${(1 + s).toFixed(2)}`)
          if (l !== 0) {
            filters.push(`eq=brightness=${l.toFixed(2)}`)
          }
        }
        break
      }
      case 'blur': {
        const a = (effect.params.amount?.value as number) ?? 0
        if (a > 0) {
          filters.push(`gblur=sigma=${a.toFixed(2)}`)
        }
        break
      }
      case 'sharpen': {
        const a = (effect.params.amount?.value as number) ?? 0
        if (a > 0) {
          filters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${a.toFixed(2)}`)
        }
        break
      }
      case 'transform-2d': {
        const posX = (effect.params.positionX?.value as number) ?? 0
        const posY = (effect.params.positionY?.value as number) ?? 0
        const scaleX = (effect.params.scaleX?.value as number) ?? 1
        const scaleY = (effect.params.scaleY?.value as number) ?? 1
        const rotation = (effect.params.rotation?.value as number) ?? 0
        if (posX !== 0 || posY !== 0 || scaleX !== 1 || scaleY !== 1 || rotation !== 0) {
          // rotation in radians
          const rotRad = (rotation * Math.PI) / 180
          filters.push(
            `rotate=${rotation}*PI/180:ow=iw*${scaleX.toFixed(2)}:oh=ih*${scaleY.toFixed(2)}:c=none`
          )
        }
        break
      }
    }
  }
  return filters.join(',')
}

function buildAudioEffectsFilter(effects: ExportEffectInfo[]): string {
  const filters: string[] = []
  for (const effect of effects) {
    if (!effect.enabled) continue
    switch (effect.type) {
      case 'equalizer': {
        // 5-band parametric EQ matching the UI (80, 250, 800, 2500, 8000 Hz)
        const eqBands = [
          { f: 80, w: 70 },
          { f: 250, w: 100 },
          { f: 800, w: 200 },
          { f: 2500, w: 500 },
          { f: 8000, w: 1000 },
        ]
        const eqParts: string[] = []
        for (let i = 0; i < 5; i++) {
          const gain = (effect.params[`band${i + 1}`]?.value as number) ?? 0
          eqParts.push(`c${i} f=${eqBands[i].f} w=${eqBands[i].w} g=${gain.toFixed(1)}`)
        }
        filters.push(`anequalizer=${eqParts.join('|')}`)
        break
      }
      case 'compressor': {
        const threshold = (effect.params.threshold?.value as number) ?? -24
        const ratio = (effect.params.ratio?.value as number) ?? 4
        const attack = (effect.params.attack?.value as number) ?? 3
        const release = (effect.params.release?.value as number) ?? 100
        const knee = (effect.params.knee?.value as number) ?? 3
        // Auto makeup gain: compensate for gain reduction
        const makeupDb = Math.max(0, (-threshold * (1 - 1 / ratio)) / 2)
        filters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio.toFixed(1)}:attack=${attack}ms:release=${release}ms:knee=${knee}dB:makeup=${makeupDb.toFixed(1)}`)
        break
      }
      case 'reverb': {
        const decay = (effect.params.decay?.value as number) ?? 2
        const mix = (effect.params.mix?.value as number) ?? 0.3
        const preDelay = (effect.params.preDelay?.value as number) ?? 20
        filters.push(`aecho=0.8:0.9:${preDelay}:${decay}|${decay * 1.5}:0.3:${mix}`)
        break
      }
      case 'noise-gate': {
        const threshold = (effect.params.threshold?.value as number) ?? -40
        const attack = (effect.params.attack?.value as number) ?? 1
        const release = (effect.params.release?.value as number) ?? 50
        const hold = (effect.params.hold?.value as number) ?? 10
        filters.push(`agate=threshold=${threshold}dB:attack=${attack}ms:release=${release}ms:hold=${hold}ms`)
        break
      }
      case 'delay': {
        const delay = (effect.params.delay?.value as number) ?? 200
        const feedback = (effect.params.feedback?.value as number) ?? 0.3
        const mixAmount = (effect.params.mix?.value as number) ?? 0.3
        filters.push(`aecho=0.8:0.9:${delay}:${feedback}:${mixAmount}:${1 - mixAmount}`)
        break
      }
    }
  }
  return filters.join(',')
}

// ---- Color Correction Filters ----

function buildPrimaryColorFilter(primary: PrimaryColorParams | null | undefined): string {
  if (!primary) return ''
  const filters: string[] = []
  const {
    exposure = 0,
    contrast = 0,
    highlights = 0,
    shadows = 0,
    whites = 0,
    blacks = 0,
    saturation = 0,
    temperature = 0,
    tint = 0,
  } = primary

  const hasEq = exposure !== 0 || contrast !== 0 || saturation !== 0 || blacks !== 0 || whites !== 0
  if (hasEq) {
    // exposure → brightness (ffmpeg eq: -1 to 1 range, exposure mapped from -5..5 → -1..1)
    const brightness = Math.max(-1, Math.min(1, exposure / 5))
    // contrast: 0=1.0, -1..1 → 0.5..2.0
    const contrastVal = 1 + contrast
    // saturation: 0=1.0, -1..1 → 0..3
    const saturationVal = 1 + saturation * 2
    // blacks as gamma adjustment: -1..1 → 0.5..2
    const gamma = blacks !== 0 ? (1 - blacks * 0.5) : 1
    filters.push(`eq=brightness=${brightness.toFixed(3)}:contrast=${contrastVal.toFixed(3)}:saturation=${saturationVal.toFixed(3)}:gamma=${gamma.toFixed(3)}`)
  }

  const hasColorBalance = highlights !== 0 || shadows !== 0 || whites !== 0 || temperature !== 0 || tint !== 0
  if (hasColorBalance) {
    // Map highlights/shadows/whites to colorbalance
    const rh = highlights > 0 ? highlights * 0.3 : 0
    const gh = highlights > 0 ? highlights * 0.3 : 0
    const bh = highlights > 0 ? highlights * 0.3 : 0
    const rs = shadows > 0 ? shadows * 0.3 : 0
    const gs = shadows > 0 ? shadows * 0.3 : 0
    const bs = shadows > 0 ? shadows * 0.3 : 0
    const rm = (whites - blacks) * 0.2
    const gm = (whites - blacks) * 0.2
    const bm = (whites - blacks) * 0.2

    // temperature: blue(-) to orange(+) → adjust red/blue balance
    const tempR = temperature > 0 ? temperature * 0.2 : 0
    const tempB = temperature < 0 ? -temperature * 0.2 : 0
    // tint: green(-) to magenta(+) → adjust green/red+blue balance
    const tintG = tint < 0 ? -tint * 0.2 : 0
    const tintR = tint > 0 ? tint * 0.2 : 0
    const tintB = tint > 0 ? tint * 0.2 : 0

    filters.push(`colorbalance=rs=${(rs + tempR + tintR).toFixed(3)}:gs=${(gs + tintG).toFixed(3)}:bs=${(bs + tempB + tintB).toFixed(3)}:rh=${(rh).toFixed(3)}:gh=${(gh).toFixed(3)}:bh=${(bh).toFixed(3)}:rm=${(rm).toFixed(3)}:gm=${(gm).toFixed(3)}:bm=${(bm).toFixed(3)}`)
  }

  return filters.join(',')
}

function buildColorWheelsFilter(wheels: ColorWheelsParams | null | undefined): string {
  if (!wheels) return ''
  const intensity = (wheels.intensity ?? 50) / 100
  if (intensity <= 0) return ''

  // Convert wheel [dy, dx] values (where dy = blue/yellow, dx = red/green in typical wheel UI)
  // to colorbalance RGB offsets
  const [shadowsY, shadowsX] = wheels.shadows ?? [0, 0]
  const [midtonesY, midtonesX] = wheels.midtones ?? [0, 0]
  const [highlightsY, highlightsX] = wheels.highlights ?? [0, 0]

  // Convert polar-like coords to RGB offsets
  // In a color wheel: top=yellow (-b,+r,+g), bottom=blue (+b,-r,-g), left=cyan (-r,+g,+b), right=red (+r,-g,-b)
  const wheelToRGB = (dy: number, dx: number): [number, number, number] => {
    const r = dx * intensity
    const g = (-dx * 0.5 + dy * 0.866) * intensity
    const b = (-dx * 0.5 - dy * 0.866) * intensity
    return [
      Math.max(-1, Math.min(1, r)),
      Math.max(-1, Math.min(1, g)),
      Math.max(-1, Math.min(1, b)),
    ]
  }

  const [sr, sg, sb] = wheelToRGB(shadowsY, shadowsX)
  const [mr, mg, mb] = wheelToRGB(midtonesY, midtonesX)
  const [hr, hg, hb] = wheelToRGB(highlightsY, highlightsX)

  return `colorbalance=rs=${sr.toFixed(3)}:gs=${sg.toFixed(3)}:bs=${sb.toFixed(3)}:rm=${mr.toFixed(3)}:gm=${mg.toFixed(3)}:bm=${mb.toFixed(3)}:rh=${hr.toFixed(3)}:gh=${hg.toFixed(3)}:bh=${hb.toFixed(3)}`
}

function buildCurvesFilter(curves: RGBACurve | null | undefined): string {
  if (!curves) return ''

  const buildCurveStr = (pts: CurvePoint[] | undefined, label: string): string => {
    if (!pts || pts.length < 2) return ''
    // Sort by x
    const sorted = [...pts].sort((a, b) => a.x - b.x)
    const parts = sorted.map(p => `${p.x.toFixed(3)}/${p.y.toFixed(3)}`)
    return `${label}='${parts.join(' ')}'`
  }

  const parts: string[] = []
  const master = buildCurveStr(curves.master, 'master')
  const red = buildCurveStr(curves.red, 'red')
  const green = buildCurveStr(curves.green, 'green')
  const blue = buildCurveStr(curves.blue, 'blue')

  if (master) parts.push(master)
  if (red) parts.push(red)
  if (green) parts.push(green)
  if (blue) parts.push(blue)

  if (parts.length === 0) return ''
  return `curves=${parts.join(':')}`
}

export interface ExportOptions {
  format: 'mp4' | 'mov' | 'avi' | 'webm'
  resolution: 'source' | '1080p' | '720p' | '480p'
  quality: number
  fps: number
  onProgress?: (progress: number) => void
// ═══════════════════════════════════════════════
// Resolution mapping
// ═══════════════════════════════════════════════

const RESOLUTION_MAP: Record<string, [number, number]> = {
  '4K': [3840, 2160],
  '1080p': [1920, 1080],
  '720p': [1280, 720],
  '480p': [854, 480],
}

function resolveOutputSize(
  resolution: string,
  sourceW: number,
  sourceH: number,
  presetAspectH?: number,
  presetAspectV?: number,
): [number, number] {
  let [w, h] = resolution === 'source' || resolution === 'source'
    ? [sourceW, sourceH]
    : RESOLUTION_MAP[resolution] ?? [sourceW, sourceH]

  // Apply preset aspect ratio override (e.g. TikTok 9:16)
  if (presetAspectH && presetAspectV) {
    const targetRatio = presetAspectH / presetAspectV
    if (w / h > targetRatio) {
      w = Math.round(h * targetRatio)
    } else {
      h = Math.round(w / targetRatio)
    }
    // Ensure even dimensions (required by many codecs)
    w = w % 2 === 0 ? w : w - 1
    h = h % 2 === 0 ? h : h - 1
  }

  return [w, h]
}

// ═══════════════════════════════════════════════
// Codec selection from ExportSettings
// ═══════════════════════════════════════════════

interface CodecConfig {
  videoCodec: string
  format: string
  audioCodec: string
  needBitrate: boolean // false for lossless/internal-rate codecs
  pixelFormat?: string
}

function getCodecConfig(settings: ExportSettings, gpu?: GPUInfo): CodecConfig {
  const gpuInfo = gpu ?? detectGPU()
  const accel: HardwareAccel = settings.hardwareAccel === 'auto'
    ? (supportsHardwareAccel('nvenc', gpuInfo) ? 'nvenc'
      : supportsHardwareAccel('amf', gpuInfo) ? 'amf'
      : supportsHardwareAccel('videotoolbox', gpuInfo) ? 'videotoolbox'
      : 'software')
    : settings.hardwareAccel

  switch (settings.codec) {
    case 'prores':
      return {
        videoCodec: 'prores_ks',
        format: 'mov',
        audioCodec: 'pcm_s16le',
        needBitrate: false,
        pixelFormat: 'yuv422p10le',
      }
    case 'dnxhr':
      return {
        videoCodec: 'dnxhd',
        format: 'mov',
        audioCodec: 'pcm_s16le',
        needBitrate: false,
        pixelFormat: 'yuv422p',
      }
    case 'av1':
      return {
        videoCodec: 'libaom-av1',
        format: 'mkv',
        audioCodec: 'libopus',
        needBitrate: true,
      }
    case 'vp9':
      return {
        videoCodec: 'libvpx-vp9',
        format: 'webm',
        audioCodec: 'libopus',
        needBitrate: true,
      }
    case 'h265': {
      if (accel === 'nvenc' && supportsHardwareAccel('nvenc', gpuInfo)) {
        return { videoCodec: 'hevc_nvenc', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      if (accel === 'amf' && supportsHardwareAccel('amf', gpuInfo)) {
        return { videoCodec: 'hevc_amf', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      if (accel === 'videotoolbox' && supportsHardwareAccel('videotoolbox', gpuInfo)) {
        return { videoCodec: 'hevc_videotoolbox', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      return { videoCodec: 'libx265', format: 'mp4', audioCodec: 'aac', needBitrate: true }
    }
    case 'h264':
    default: {
      if (accel === 'nvenc' && supportsHardwareAccel('nvenc', gpuInfo)) {
        return { videoCodec: 'h264_nvenc', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      if (accel === 'amf' && supportsHardwareAccel('amf', gpuInfo)) {
        return { videoCodec: 'h264_amf', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      if (accel === 'videotoolbox' && supportsHardwareAccel('videotoolbox', gpuInfo)) {
        return { videoCodec: 'h264_videotoolbox', format: 'mp4', audioCodec: 'aac', needBitrate: true }
      }
      return { videoCodec: 'libx264', format: 'mp4', audioCodec: 'aac', needBitrate: true }
    }
  }
}

// ═══════════════════════════════════════════════
// Transform filter
// ═══════════════════════════════════════════════

function buildTransformFilter(
  transform?: ExportClipInfo['transform'],
  outW?: number,
  outH?: number,
): string {
  if (!transform) return ''
  if (!outW || !outH) return ''

  const {
    positionX = 0,
    positionY = 0,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    opacity = 1,
  } = transform

  // Build filter chain: scale → rotate → translate → fade
  const filters: string[] = []
  // Always scale to output dimensions as base
  filters.push(`scale=${outW}:${outH}:force_original_aspect_ratio=decrease`)
  filters.push(`pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`)

  if (scaleX !== 1 || scaleY !== 1) {
    filters.push(`scale=iw*${scaleX.toFixed(3)}:ih*${scaleY.toFixed(3)}:flags=lanczos`)
  }
  if (rotation !== 0) {
    filters.push(`rotate=${(rotation * Math.PI / 180).toFixed(4)}:c=none`)
  }
  if (positionX !== 0 || positionY !== 0) {
    filters.push(`overlay=x=${positionX}:y=${positionY}`)
  }
  if (opacity < 1 && opacity >= 0) {
    filters.push(`format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}`)
  }

  return filters.join(',')
}

// ═══════════════════════════════════════════════
// Main export pipeline
// ═══════════════════════════════════════════════

export function exportTimeline(
  clips: ExportClipInfo[],
  outputPath: string,
  settings: ExportSettings,
  sourceWidth: number,
  sourceHeight: number,
  isCancelled?: () => boolean,
): Promise<void> {
  const sortedClips = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)
  const codecConfig = getCodecConfig(settings)
  const gpu = detectGPU()

  // Resolve output size
  let presetAspectH: number | undefined
  let presetAspectV: number | undefined
  if (settings.preset === 'tiktok') {
    presetAspectH = 9
    presetAspectV = 16
  }
  const [outW, outH] = resolveOutputSize(settings.resolution, sourceWidth, sourceHeight, presetAspectH, presetAspectV)

  // 2-pass encoding for software H.264/H.265
  if (settings.twoPass && (settings.codec === 'h264' || settings.codec === 'h265') && codecConfig.videoCodec.startsWith('libx')) {
    return twoPassExport(sortedClips, outputPath, settings, outW, outH, codecConfig, isCancelled)
  }

  if (sortedClips.length === 1) {
    return exportSingleClip(sortedClips[0], outputPath, settings, outW, outH, codecConfig, gpu, isCancelled)
  }

  return exportMultiClips(sortedClips, outputPath, settings, outW, outH, codecConfig, gpu, isCancelled)
}

// ═══════════════════════════════════════════════
// Two-pass encoding
// ═══════════════════════════════════════════════

function twoPassExport(
  clips: ExportClipInfo[],
  outputPath: string,
  settings: ExportSettings,
  outW: number,
  outH: number,
  codecConfig: CodecConfig,
  isCancelled?: () => boolean,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const tempDir = getTempDir()
    const passLogFile = path.join(tempDir, `2pass_${uid()}.log`)

    try {
      const sortedClips = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)
      // Build a single temp file first for simplicity
      const concatFile = path.join(tempDir, `concat_input_${uid()}.mp4`)

      if (sortedClips.length === 1) {
        // Use direct file for 2-pass
        const clip = sortedClips[0]
        const duration = (clip.sourceEnd - clip.sourceStart) / clip.speed

        // Pass 1
        await new Promise<void>((res, rej) => {
          let cmd = ffmpeg(clip.filePath)
            .inputOptions([`-ss ${clip.sourceStart}`, `-t ${duration}`])
            .outputOptions([
              `-vf setpts=${(1 / clip.speed).toFixed(4)}*PTS,scale=${outW}:${outH}`,
              `-c:v ${codecConfig.videoCodec}`,
              '-preset fast',
              '-b:v 0',
              `-pass 1`,
              `-passlogfile ${passLogFile.replace(/\\/g, '/')}`,
              '-f null',
              '-an',
            ])
            .output('/dev/null')
            .on('progress', (info: { percent?: number }) => {
              if (isCancelled?.()) { cmd.kill('SIGKILL'); return }
              // Pass 1: 0-50%
              if (info.percent != null) {
                const win = BrowserWindow.getFocusedWindow()
                win?.webContents.send('export:progress', Math.min(49, info.percent / 2))
              }
            })
            .on('end', () => res())
            .on('error', rej)
          cmd.run()
        })

        // Pass 2
        const vfFilters = [`setpts=${(1 / clip.speed).toFixed(4)}*PTS`, `scale=${outW}:${outH}`]
        if (clip.effects?.length) {
          const ef = buildEffectsFilter(clip.effects)
          if (ef) vfFilters.push(ef)
        }
        // Transform filter
        if (clip.transform) {
          const tf = buildTransformFilter(clip.transform, outW, outH)
          if (tf) vfFilters.push(tf)
        }

        const afFilters: string[] = []
        if (clip.audioEffects?.length) {
          const aef = buildAudioEffectsFilter(clip.audioEffects)
          if (aef) afFilters.push(aef)
        }
        if (clip.volume !== undefined && clip.volume !== 1) {
          afFilters.push(`volume=${clip.volume.toFixed(2)}`)
        }

        const outputOpts: string[] = [
          `-vf ${vfFilters.join(',')}`,
          `-r ${settings.fps}`,
          `-c:v ${codecConfig.videoCodec}`,
          '-preset fast',
          `-pass 2`,
          `-passlogfile ${passLogFile.replace(/\\/g, '/')}`,
        ]
        if (codecConfig.needBitrate && settings.bitrate > 0) {
          outputOpts.push(`-b:v ${settings.bitrate}k`)
        }
        if (clip.muted) {
          outputOpts.push('-an')
        } else {
          outputOpts.push(`-af ${afFilters.join(',')}`, `-c:a ${codecConfig.audioCodec}`, '-b:a 192k')
        }
        if (codecConfig.pixelFormat) {
          outputOpts.push(`-pix_fmt ${codecConfig.pixelFormat}`)
        }

        await new Promise<void>((res, rej) => {
          let cmd = ffmpeg(clip.filePath)
            .inputOptions([`-ss ${clip.sourceStart}`, `-t ${duration}`])
            .output(outputPath)
            .outputOptions(outputOpts)
            .on('progress', (info: { percent?: number }) => {
              if (isCancelled?.()) { cmd.kill('SIGKILL'); return }
              if (info.percent != null) {
                const win = BrowserWindow.getFocusedWindow()
                win?.webContents.send('export:progress', 50 + Math.min(49, info.percent / 2))
              }
            })
            .on('end', () => res())
            .on('error', rej)
          cmd.run()
        })
      } else {
        // Multi-clip 2-pass: export to temp first, then 2-pass the temp
        const gpu = detectGPU()
        const gpuInfo = detectGPU()
        const swSettings: ExportSettings = { ...settings, hardwareAccel: 'software', twoPass: false }
        const swCodec: CodecConfig = {
          videoCodec: 'libx264',
          format: 'mp4',
          audioCodec: 'aac',
          needBitrate: true,
        }
        await exportMultiClips(sortedClips, concatFile, swSettings, outW, outH, swCodec, gpuInfo, isCancelled)

        // Pass 1
        await new Promise<void>((res, rej) => {
          let cmd = ffmpeg(concatFile)
            .outputOptions([
              `-c:v ${codecConfig.videoCodec}`,
              '-preset fast',
              `-pass 1`,
              `-passlogfile ${passLogFile.replace(/\\/g, '/')}`,
              '-f null',
              '-an',
            ])
            .output('/dev/null')
            .on('progress', (info: { percent?: number }) => {
              if (isCancelled?.()) { cmd.kill('SIGKILL'); return }
              if (info.percent != null) {
                const win = BrowserWindow.getFocusedWindow()
                win?.webContents.send('export:progress', Math.min(49, info.percent / 2))
              }
            })
            .on('end', () => res())
            .on('error', rej)
          cmd.run()
        })

        // Pass 2
        await new Promise<void>((res, rej) => {
          const outputOpts: string[] = [
            `-c:v ${codecConfig.videoCodec}`,
            '-preset fast',
            `-pass 2`,
            `-passlogfile ${passLogFile.replace(/\\/g, '/')}`,
          ]
          if (codecConfig.needBitrate && settings.bitrate > 0) {
            outputOpts.push(`-b:v ${settings.bitrate}k`)
          }
          outputOpts.push(`-c:a copy`)

          let cmd = ffmpeg(concatFile)
            .output(outputPath)
            .outputOptions(outputOpts)
            .on('progress', (info: { percent?: number }) => {
              if (isCancelled?.()) { cmd.kill('SIGKILL'); return }
              if (info.percent != null) {
                const win = BrowserWindow.getFocusedWindow()
                win?.webContents.send('export:progress', 50 + Math.min(49, info.percent / 2))
              }
            })
            .on('end', () => {
              try { fs.unlinkSync(concatFile) } catch {}
              res()
            })
            .on('error', (err) => {
              try { fs.unlinkSync(concatFile) } catch {}
              rej(err)
            })
          cmd.run()
        })
      }

      // Cleanup
      try { fs.unlinkSync(passLogFile) } catch {}
      try { fs.unlinkSync(passLogFile + '.mbtree') } catch {}
      try { fs.unlinkSync(passLogFile + '.temp') } catch {}

      const win = BrowserWindow.getFocusedWindow()
      win?.webContents.send('export:progress', 100)

      resolve()
    } catch (err) {
      try { fs.unlinkSync(passLogFile) } catch {}
      try { fs.unlinkSync(passLogFile + '.mbtree') } catch {}
      try { fs.unlinkSync(passLogFile + '.temp') } catch {}
      reject(err)
    }
  })
}

// ═══════════════════════════════════════════════
// Single clip export
// ═══════════════════════════════════════════════

function exportSingleClip(
  clip: ExportClipInfo,
  outputPath: string,
  settings: ExportSettings,
  outW: number,
  outH: number,
  codecConfig: CodecConfig,
  gpu: GPUInfo,
  isCancelled?: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = (clip.sourceEnd - clip.sourceStart) / clip.speed
    const ptsFactor = 1 / clip.speed
    let atempoStr = ''
    if (clip.speed !== 1) {
      // atempo only supports 0.5–2.0, chain if needed
      let speed = clip.speed
      const atempos: string[] = []
      while (speed > 2) { atempos.push('atempo=2'); speed /= 2 }
      while (speed < 0.5) { atempos.push('atempo=0.5'); speed *= 2 }
      atempos.push(`atempo=${speed.toFixed(2)}`)
      atempoStr = atempos.join(',')
    }

    const vfFilters: string[] = [`setpts=${ptsFactor.toFixed(4)}*PTS`, `scale=${outW}:${outH}:force_original_aspect_ratio=decrease`, `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`]

    const vfFilters: string[] = [`setpts=${ptsFactor}*PTS`, `scale=${outW}:${outH}`]

    // Apply color correction filters
    const primaryFilter = buildPrimaryColorFilter(clip.primaryColor)
    if (primaryFilter) {
      vfFilters.push(primaryFilter)
    }

    const wheelsFilter = buildColorWheelsFilter(clip.colorWheels)
    if (wheelsFilter) {
      vfFilters.push(wheelsFilter)
    }

    const curvesFilter = buildCurvesFilter(clip.rgbCurves)
    if (curvesFilter) {
      vfFilters.push(curvesFilter)
    }

    // Apply LUT
    if (clip.appliedLutPath) {
      vfFilters.push(`lut3d=file='${clip.appliedLutPath.replace(/'/g, "\\'")}'`)
    }

    if (clip.effects && clip.effects.length > 0) {
      const ef = buildEffectsFilter(clip.effects)
      if (ef) vfFilters.push(ef)
    }

    // Transform filter
    if (clip.transform) {
      const tf = buildTransformFilter(clip.transform, outW, outH)
      if (tf) {
        // Replace scale+pad with transform chain
        vfFilters.length = 0
        vfFilters.push(`setpts=${ptsFactor.toFixed(4)}*PTS`)
        vfFilters.push(tf)
        if (clip.effects?.length) {
          const ef = buildEffectsFilter(clip.effects)
          if (ef) vfFilters.push(ef)
        }
      }
    }

    const afFilters: string[] = []
    if (atempoStr) afFilters.push(atempoStr)
    if (clip.audioEffects && clip.audioEffects.length > 0) {
      const aef = buildAudioEffectsFilter(clip.audioEffects)
      if (aef) afFilters.push(aef)
    }
    if (clip.volume !== undefined && clip.volume !== 1) {
      afFilters.push(`volume=${clip.volume.toFixed(2)}`)
    }
    if (clip.pan !== undefined && clip.pan !== 0) {
      const panVal = Math.max(-1, Math.min(1, clip.pan))
      afFilters.push(`pan=stereo|FL<c0+${(1 - Math.max(0, panVal)).toFixed(2)}*c0|FR<c0+${(1 - Math.max(0, -panVal)).toFixed(2)}*c0`)
    }

    const outputOpts: string[] = [
      `-vf ${vfFilters.join(',')}`,
      `-r ${settings.fps}`,
      `-c:v ${codecConfig.videoCodec}`,
    ]

    // Codec-specific options
    if (codecConfig.videoCodec === 'libx264' || codecConfig.videoCodec === 'libx265') {
      outputOpts.push(`-preset fast`, `-crf ${settings.quality}`)
      if (codecConfig.videoCodec === 'libx265') {
        outputOpts.push('-tag:v hvc1')
      }
    }
    if (codecConfig.videoCodec.startsWith('h264_nvenc') || codecConfig.videoCodec.startsWith('hevc_nvenc')) {
      outputOpts.push('-preset p4', '-tune hq', '-rc vbr')
    }
    if (codecConfig.videoCodec.startsWith('h264_amf') || codecConfig.videoCodec.startsWith('hevc_amf')) {
      outputOpts.push('-usage transcoding', '-quality quality')
    }
    if (codecConfig.videoCodec.startsWith('h264_videotoolbox') || codecConfig.videoCodec.startsWith('hevc_videotoolbox')) {
      outputOpts.push('-allow_sw 1', '-realtime 0')
    }
    if (codecConfig.videoCodec === 'prores_ks') {
      outputOpts.push('-profile:v 2') // ProRes 422
    }
    if (codecConfig.videoCodec === 'libaom-av1') {
      outputOpts.push('-cpu-used 4', '-row-mt 1')
    }
    if (codecConfig.videoCodec === 'libvpx-vp9') {
      outputOpts.push('-deadline good', '-cpu-used 2')
    }

    // Bitrate override (for non-CRF modes, HW encoders)
    if (codecConfig.needBitrate && settings.bitrate > 0) {
      outputOpts.push(`-b:v ${settings.bitrate}k`, `-maxrate ${settings.bitrate * 1.5}k`, `-bufsize ${settings.bitrate * 2}k`)
    }

    if (clip.muted) {
      outputOpts.push('-an')
    } else {
      outputOpts.push(`-af ${afFilters.join(',')}`, `-c:a ${codecConfig.audioCodec}`, '-b:a 192k')
    }
    if (codecConfig.pixelFormat) {
      outputOpts.push(`-pix_fmt ${codecConfig.pixelFormat}`)
    }
    // Format override
    if (codecConfig.format === 'webm') {
      outputOpts.push('-f webm')
    }
    if (codecConfig.format === 'mkv') {
      outputOpts.push('-f matroska')
    }
    outputOpts.push('-y')

    const command = ffmpeg(clip.filePath)
      .inputOptions([`-ss ${clip.sourceStart}`, `-t ${duration}`])
      .output(outputPath)
      .outputOptions(outputOpts)
      .on('progress', (info: { percent?: number }) => {
        if (isCancelled?.()) {
          command.kill('SIGKILL')
          return
        }
        if (info.percent != null) {
          const win = BrowserWindow.getFocusedWindow()
          win?.webContents.send('export:progress', Math.min(99, info.percent))
        }
      })
      .on('end', () => {
        if (isCancelled?.()) return
        const win = BrowserWindow.getFocusedWindow()
        win?.webContents.send('export:progress', 100)
        resolve()
      })
      .on('error', (err) => {
        if (isCancelled?.()) return
        reject(err)
      })

    command.run()
  })
}

// ═══════════════════════════════════════════════
// Multi-clip export (concat + transitions)
// ═══════════════════════════════════════════════

function exportMultiClips(
  clips: ExportClipInfo[],
  outputPath: string,
  settings: ExportSettings,
  outW: number,
  outH: number,
  codecConfig: CodecConfig,
  gpu: GPUInfo,
  isCancelled?: () => boolean,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const tempDir = getTempDir()
    const tempFiles: string[] = []
    let currentProgress = 0
    const perClipWeight = 100 / clips.length

    try {
      for (let i = 0; i < clips.length; i++) {
        if (isCancelled?.()) throw new Error('CANCELLED')

        const clip = clips[i]
        const tempPath = path.join(tempDir, `export_segment_${i}_${uid()}.mp4`)
        tempFiles.push(tempPath)

        // Export each clip individually to temporary files
        await exportSingleClip(clip, tempPath, {
          ...settings,
          hardwareAccel: 'software', // Use software for segments to ensure compat
          twoPass: false,
        }, outW, outH, {
          videoCodec: 'libx264',
          format: 'mp4',
          audioCodec: 'aac',
          needBitrate: true,
        }, gpu, isCancelled)

        currentProgress += perClipWeight
        const win = BrowserWindow.getFocusedWindow()
        win?.webContents.send('export:progress', Math.min(90, currentProgress))
      }

      // Now concatenate or apply transitions
      const hasTransitions = clips.some(c => c.transitionOut)
      if (hasTransitions && tempFiles.length >= 2) {
        await concatWithTransitions(tempFiles, clips, outputPath, settings, outW, outH, codecConfig, gpu, isCancelled)
      } else {
        await concatSimple(tempFiles, outputPath, codecConfig)
      }

      // Cleanup temp files
      for (const f of tempFiles) {
        try { fs.unlinkSync(f) } catch {}
      }

      const win = BrowserWindow.getFocusedWindow()
      win?.webContents.send('export:progress', 100)
      resolve()
    } catch (err) {
      for (const f of tempFiles) {
        try { fs.unlinkSync(f) } catch {}
      }
      reject(err)
    }
  })
}

function concatSimple(tempFiles: string[], outputPath: string, codecConfig: CodecConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const concatListPath = path.join(getTempDir(), `concat_${uid()}.txt`)
    const concatContent = tempFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    fs.writeFileSync(concatListPath, concatContent, 'utf-8')

    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .output(outputPath)
      .outputOptions(['-c copy', '-y'])
      .on('end', () => {
        try { fs.unlinkSync(concatListPath) } catch {}
        resolve()
      })
      .on('error', (err) => {
        try { fs.unlinkSync(concatListPath) } catch {}
        reject(err)
      })
      .run()
  })
}

function concatWithTransitions(
  tempFiles: string[],
  clips: ExportClipInfo[],
  outputPath: string,
  settings: ExportSettings,
  outW: number,
  outH: number,
  codecConfig: CodecConfig,
  gpu: GPUInfo,
  isCancelled?: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg()

    for (const f of tempFiles) {
      command = command.input(f)
    }

    let filterComplex = ''
    let prevLabel = '0:v:0'
    let totalFilterParts: string[] = []

    for (let i = 1; i < tempFiles.length; i++) {
      if (isCancelled?.()) {
        reject(new Error('CANCELLED'))
        return
      }
      const transition = clips[i - 1]?.transitionOut
      const xfadeType = mapTransitionType(transition?.type ?? 'dissolve')
      const duration = transition?.duration ?? 0.5

      // Calculate offset: sum duration of previous clips minus transition duration
      const offset = clips.slice(0, i).reduce((sum, c) => {
        const dur = (c.sourceEnd - c.sourceStart) / c.speed
        return sum + dur
      }, 0) - duration

      const label = `xfade${i}`
      totalFilterParts.push(`[${prevLabel}][${i}:v:0]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[${label}]`)
      prevLabel = label
    }

    // Audio mix
    const amixInputs = tempFiles.map((_, i) => `[${i}:a:0]`).join('')
    const amixLabel = 'amixout'
    totalFilterParts.push(`${amixInputs}amix=inputs=${tempFiles.length}:duration=first:dropout_transition=0[${amixLabel}]`)

    filterComplex = totalFilterParts.join(';')

    const outputOpts: string[] = [
      `-map [${prevLabel}]`,
      `-map [${amixLabel}]`,
      `-c:v ${codecConfig.videoCodec}`,
      `-r ${settings.fps}`,
    ]

    // Codec-specific
    if (codecConfig.videoCodec === 'libx264' || codecConfig.videoCodec === 'libx265') {
      outputOpts.push('-preset fast', `-crf ${settings.quality}`)
    }
    if (codecConfig.needBitrate && settings.bitrate > 0) {
      outputOpts.push(`-b:v ${settings.bitrate}k`)
    }
    outputOpts.push(`-c:a ${codecConfig.audioCodec}`, '-b:a 192k')
    if (codecConfig.pixelFormat) outputOpts.push(`-pix_fmt ${codecConfig.pixelFormat}`)
    outputOpts.push('-y')

    command = command
      .complexFilter([filterComplex])
      .output(outputPath)
      .outputOptions(outputOpts)
      .on('progress', (info: { percent?: number }) => {
        if (isCancelled?.()) {
          command.kill('SIGKILL')
          return
        }
        if (info.percent != null) {
          const win = BrowserWindow.getFocusedWindow()
          win?.webContents.send('export:progress', 90 + Math.min(9, info.percent / 11.1))
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => {
        if (isCancelled?.()) return
        reject(err)
      })

    command.run()
  })
}

function mapTransitionType(type: string): string {
  switch (type) {
    case 'dissolve': return 'fade'
    case 'fade': return 'fadeblack'
    case 'wipe': return 'wipeleft'
    case 'slide': return 'slideright'
    case 'zoom': return 'zoomin'
    default: return 'fade'
  }
}

// ═══════════════════════════════════════════════
// Proxy generation
// ═══════════════════════════════════════════════

export function generateProxy(inputPath: string, outputPath: string, resolution: number = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .outputOptions([
        `-vf scale=-2:${resolution}`,
        '-c:v libx264',
        '-preset fast',
        '-crf 28',
        '-an',
        '-y',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

// ═══════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════

export function cleanupTempFiles(): void {
  const dir = getTempDir()
  if (!fs.existsSync(dir)) return
  try {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file)
      try {
        fs.unlinkSync(filePath)
      } catch { }
    })
  } catch {}
}

// ═══════════════════════════════════════════════
// Audio waveform
// ═══════════════════════════════════════════════

export interface AudioWaveformData {
  samples: number[]
  sampleRate: number
  duration: number
}

export function extractAudioWaveform(
  filePath: string,
  startTime: number = 0,
  duration: number = 30,
  targetSampleRate: number = 100
): Promise<AudioWaveformData> {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(getTempDir(), `waveform_${uid()}.raw`)

    ffmpeg(filePath)
      .inputOptions([`-ss ${startTime}`, `-t ${duration}`])
      .outputOptions([
        '-f s16le',
        '-acodec pcm_s16le',
        '-ac 1',
        `-ar ${targetSampleRate}`,
      ])
      .output(tempPath)
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(tempPath)
          const samples: number[] = []
          for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i) / 32768
            samples.push(Math.abs(sample))
          }
          fs.unlinkSync(tempPath)
          resolve({
            samples,
            sampleRate: targetSampleRate,
            duration: samples.length / targetSampleRate,
          })
        } catch (err) {
          reject(err)
        }
      })
      .on('error', reject)
      .run()
  })
}

export function crossCorrelate(
  signal1: number[],
  signal2: number[]
): { lag: number; correlation: number } {
  const len1 = signal1.length
  const len2 = signal2.length
  const maxLag = Math.min(len1, len2) - 1

  let bestCorrelation = -Infinity
  let bestLag = 0

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0
    let count = 0
    let sum1Sq = 0
    let sum2Sq = 0

    for (let i = 0; i < len1; i++) {
      const j = i + lag
      if (j >= 0 && j < len2) {
        sum += signal1[i] * signal2[j]
        sum1Sq += signal1[i] * signal1[i]
        sum2Sq += signal2[j] * signal2[j]
        count++
      }
    }

    if (count > 0) {
      const denominator = Math.sqrt(sum1Sq * sum2Sq)
      const correlation = denominator > 0 ? sum / denominator : 0
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestLag = lag
      }
    }
  }

  return { lag: bestLag, correlation: bestCorrelation }
}

export interface SyncResult {
  clipId: string
  offset: number
  confidence: number
}

export async function syncClipsByAudio(
  clipFilePaths: { clipId: string; filePath: string; sourceStart: number; sourceEnd: number }[]
): Promise<SyncResult[]> {
  const waveforms = await Promise.all(
    clipFilePaths.map(async (clip) => {
      const duration = Math.min(30, clip.sourceEnd - clip.sourceStart)
      const waveform = await extractAudioWaveform(clip.filePath, clip.sourceStart, duration)
      return { clipId: clip.clipId, waveform }
    })
  )

  if (waveforms.length < 2) {
    return clipFilePaths.map((c) => ({ clipId: c.clipId, offset: 0, confidence: 1 }))
  }

  const reference = waveforms[0]
  const results: SyncResult[] = [{ clipId: reference.clipId, offset: 0, confidence: 1 }]

  for (let i = 1; i < waveforms.length; i++) {
    const { lag, correlation } = crossCorrelate(
      reference.waveform.samples,
      waveforms[i].waveform.samples
    )
    const offset = lag / reference.waveform.sampleRate
    results.push({
      clipId: waveforms[i].clipId,
      offset,
      confidence: correlation,
    })
  }

  return results
}

// ═══════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════

export { detectGPU, getEncoder, supportsHardwareAccel } from './hardware'
