import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { app } from 'electron'

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
  // Kill any previous extraction still running
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

export interface ExportClipInfo {
  filePath: string
  sourceStart: number
  sourceEnd: number
  speed: number
  muted: boolean
  timelineStart: number
  effects?: ExportEffectInfo[]
  transitionOut?: ExportTransitionInfo | null
  audioEffects?: ExportEffectInfo[]
  volume?: number
  pan?: number
}

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
        const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
        for (let i = 0; i < 10; i++) {
          const gain = (effect.params[`band${i + 1}`]?.value as number) ?? 0
          if (gain !== 0) {
            filters.push(`equalizer=f=${bands[i]}:width_type=q:width=1:g=${gain.toFixed(1)}`)
          }
        }
        break
      }
      case 'compressor': {
        const threshold = (effect.params.threshold?.value as number) ?? -24
        const ratio = (effect.params.ratio?.value as number) ?? 4
        const attack = (effect.params.attack?.value as number) ?? 3
        const release = (effect.params.release?.value as number) ?? 100
        const knee = (effect.params.knee?.value as number) ?? 3
        filters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio.toFixed(1)}:attack=${attack}ms:release=${release}ms:knee=${knee}dB`)
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

export interface ExportOptions {
  format: 'mp4' | 'mov' | 'avi' | 'webm'
  resolution: 'source' | '1080p' | '720p' | '480p'
  quality: number
  fps: number
  onProgress?: (progress: number) => void
}

export function exportTimeline(
  clips: ExportClipInfo[],
  outputPath: string,
  options: ExportOptions,
  sourceWidth: number,
  sourceHeight: number
): Promise<void> {
  const sortedClips = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)

  const resolutionMap: Record<string, [number, number]> = {
    '1080p': [1920, 1080],
    '720p': [1280, 720],
    '480p': [854, 480],
  }
  const [outW, outH] = options.resolution === 'source'
    ? [sourceWidth, sourceHeight]
    : resolutionMap[options.resolution] ?? [sourceWidth, sourceHeight]

  const codecMap: Record<string, string> = {
    mp4: 'libx264',
    mov: 'libx264',
    webm: 'libvpx-vp9',
    avi: 'libx264',
  }
  const videoCodec = codecMap[options.format] ?? 'libx264'

  if (sortedClips.length === 1) {
    return exportSingleClip(sortedClips[0], outputPath, options, outW, outH, videoCodec)
  }

  return exportMultiClips(sortedClips, outputPath, options, outW, outH, videoCodec)
}

function exportSingleClip(
  clip: ExportClipInfo,
  outputPath: string,
  options: ExportOptions,
  outW: number,
  outH: number,
  videoCodec: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = (clip.sourceEnd - clip.sourceStart) / clip.speed
    const ptsFactor = 1 / clip.speed
    const atempo = Math.min(2, clip.speed)

    const vfFilters: string[] = [`setpts=${ptsFactor}*PTS`, `scale=${outW}:${outH}`]
    if (clip.effects && clip.effects.length > 0) {
      const ef = buildEffectsFilter(clip.effects)
      if (ef) {
        vfFilters.push(ef)
      }
    }

    const afFilters: string[] = [`atempo=${atempo}`]
    if (clip.audioEffects && clip.audioEffects.length > 0) {
      const aef = buildAudioEffectsFilter(clip.audioEffects)
      if (aef) {
        afFilters.push(aef)
      }
    }
    if (clip.volume !== undefined && clip.volume !== 1) {
      afFilters.push(`volume=${clip.volume.toFixed(2)}`)
    }
    if (clip.pan !== undefined && clip.pan !== 0) {
      const panVal = Math.max(-1, Math.min(1, clip.pan))
      afFilters.push(`pan=stereo|FL=${(1 - Math.max(0, panVal)).toFixed(2)}*FC+${(Math.max(0, panVal)).toFixed(2)}*FC|FR=${(1 - Math.max(0, -panVal)).toFixed(2)}*FC+${(Math.max(0, -panVal)).toFixed(2)}*FC`)
    }

    const command = ffmpeg(clip.filePath)
      .inputOptions([`-ss ${clip.sourceStart}`, `-t ${duration}`])
      .output(outputPath)
      .outputOptions([
        `-vf ${vfFilters.join(',')}`,
        `-r ${options.fps}`,
        `-c:v ${videoCodec}`,
        `-preset fast`,
        `-crf ${options.quality}`,
        ...(clip.muted ? ['-an'] : [`-af ${afFilters.join(',')}`, '-c:a aac', '-b:a 192k']),
        ...(options.format === 'webm' ? ['-f webm'] : []),
      ])
      .on('progress', (info: { percent?: number }) => {
        if (options.onProgress && info.percent != null) {
          options.onProgress(Math.min(99, info.percent))
        }
      })
      .on('end', () => {
        if (options.onProgress) options.onProgress(100)
        resolve()
      })
      .on('error', reject)

    command.run()
  })
}

function buildTransitionFilter(
  transition: ExportTransitionInfo | null | undefined,
  nextTransition: ExportTransitionInfo | null | undefined,
): string | null {
  if (!transition) return null
  switch (transition.type) {
    case 'dissolve': return 'fade'
    case 'fade': return 'fade'
    case 'wipe': return 'wipeleft'
    case 'slide': return 'slideright'
    case 'zoom': return 'zoomin'
    default: return 'fade'
  }
}

function exportMultiClips(
  clips: ExportClipInfo[],
  outputPath: string,
  options: ExportOptions,
  outW: number,
  outH: number,
  videoCodec: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const tempDir = getTempDir()
    const tempFiles: string[] = []
    let currentProgress = 0
    const perClipWeight = 100 / clips.length

    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const tempPath = path.join(tempDir, `export_segment_${i}.mp4`)
        tempFiles.push(tempPath)

        await exportSingleClip(clip, tempPath, {
          ...options,
          onProgress: (p) => {
            if (options.onProgress) {
              options.onProgress(currentProgress + (p * perClipWeight) / 100)
            }
          },
        }, outW, outH, videoCodec)

        currentProgress += perClipWeight
        if (options.onProgress) options.onProgress(currentProgress)
      }

      // Use xfade transitions if any clip has transitionOut
      const hasTransitions = clips.some(c => c.transitionOut)
      if (hasTransitions && tempFiles.length >= 2) {
        await exportWithTransitions(tempFiles, clips, outputPath, options, videoCodec)
      } else {
        const concatListPath = path.join(tempDir, `concat_${uid()}.txt`)
        const concatContent = tempFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
        fs.writeFileSync(concatListPath, concatContent, 'utf-8')

        await new Promise<void>((res, rej) => {
          ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .output(outputPath)
            .outputOptions(['-c copy'])
            .on('end', () => res())
            .on('error', rej)
            .run()
        })
        try { fs.unlinkSync(concatListPath) } catch { }
      }

      for (const f of tempFiles) {
        try { fs.unlinkSync(f) } catch { }
      }

      if (options.onProgress) options.onProgress(100)
      resolve()
    } catch (err) {
      for (const f of tempFiles) {
        try { fs.unlinkSync(f) } catch { }
      }
      reject(err)
    }
  })
}

function exportWithTransitions(
  tempFiles: string[],
  clips: ExportClipInfo[],
  outputPath: string,
  options: ExportOptions,
  videoCodec: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg()
    const inputs: string[] = []

    for (const f of tempFiles) {
      command = command.input(f)
      inputs.push(f)
    }

    let filterComplex = ''
    let prevLabel = '0:v:0'

    for (let i = 1; i < inputs.length; i++) {
      const transition = clips[i - 1]?.transitionOut
      const xfadeType = buildTransitionFilter(transition, null)
      const duration = transition?.duration ?? 0.5
      const offset = clips.slice(0, i).reduce((sum, c) => {
        const dur = (c.sourceEnd - c.sourceStart) / c.speed
        return sum + dur
      }, 0) - duration

      const label = `xfade${i}`
      if (i === 1) {
        filterComplex = `[0:v:0][1:v:0]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[${label}]`
        prevLabel = label
      } else {
        filterComplex = `[${prevLabel}][${i}:v:0]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[${label}]`
        prevLabel = label
      }
    }

    const audioFilterComplex = inputs.slice(1).map((_, i) => `[${i + 1}:a:0]`).join('')
    const allAudioInputs = inputs.map((_, i) => `[${i}:a:0]`).join('')
    const amixLabel = 'amixout'
    filterComplex += `;${allAudioInputs}amix=inputs=${inputs.length}:duration=first[${amixLabel}]`

    command = command
      .complexFilter([filterComplex])
      .output(outputPath)
      .outputOptions([
        `-map [${prevLabel}]`,
        `-map [${amixLabel}]`,
        `-c:v ${videoCodec}`,
        '-preset fast',
        `-crf ${options.quality}`,
        '-c:a aac',
        '-b:a 192k',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))

    command.run()
  })
}

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
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

export function cleanupTempFiles(): void {
  const dir = getTempDir()
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file)
    try {
      fs.unlinkSync(filePath)
    } catch { }
  })
}

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
