import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import {
  probeMedia, extractThumbnail, extractFrame, extractFrameAsBase64,
  exportTimeline, syncClipsByAudio, extractAudioWaveform, generateProxy,
  detectGPU,
} from '../ffmpeg'
import type { ExportClipInfo } from '../ffmpeg'
import { saveVersion, listVersions, restoreVersion } from '../version-history'
import { exportQueue } from '../export-queue'
import type {
  MediaAsset, Project, ImportMediaResult, ExportSettings,
} from '../../shared/types'

const DEFAULT_PROJECTS_PATH = path.join(app.getPath('documents'), 'CineFlow')

export function registerIpcHandlers(): void {
  if (!fs.existsSync(DEFAULT_PROJECTS_PATH)) {
    fs.mkdirSync(DEFAULT_PROJECTS_PATH, { recursive: true })
  }

  // ═══════════════════════════════════════
  // Media Import (with auto proxy generation)
  // ═══════════════════════════════════════
  ipcMain.handle('media:import', async (): Promise<ImportMediaResult[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media Files',
          extensions: [
            'mp4', 'mov', 'avi', 'mkv', 'webm',
            'mp3', 'wav', 'aac', 'flac', 'ogg',
            'png', 'jpg', 'jpeg', 'gif', 'bmp',
          ],
        },
      ],
    })

    if (result.canceled || !result.filePaths.length) return []

    const assets: ImportMediaResult[] = []

    for (const filePath of result.filePaths) {
      try {
        const info = await probeMedia(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
        const audioExts = ['.mp3', '.wav', '.aac', '.flac', '.ogg']

        let mediaType: 'video' | 'audio' | 'image' = 'video'
        if (imageExts.includes(ext)) mediaType = 'image'
        else if (audioExts.includes(ext)) mediaType = 'audio'

        const asset: MediaAsset = {
          id: crypto.randomUUID(),
          filePath,
          name: path.basename(filePath),
          type: mediaType,
          duration: info.hasVideo || info.hasAudio ? info.duration : 5,
          width: info.width,
          height: info.height,
          fps: info.fps,
          codec: info.codec,
          audioChannels: info.audioChannels,
          audioSampleRate: info.audioSampleRate,
        }

        const thumbnailPath =
          info.hasVideo
            ? await extractThumbnail(filePath, 0).catch(() => undefined)
            : undefined

        assets.push({ asset, thumbnailPath })

        // ── Auto proxy generation for 4K/8K media ──
        if (mediaType === 'video' && (info.width > 1920 || info.height > 1080)) {
          setImmediate(async () => {
            try {
              const proxyDir = path.join(app.getPath('userData'), 'proxies')
              if (!fs.existsSync(proxyDir)) fs.mkdirSync(proxyDir, { recursive: true })
              const proxyPath = path.join(proxyDir, `proxy_${asset.id}${ext}`)
              if (!fs.existsSync(proxyPath)) {
                const generated = await generateProxy(filePath, proxyPath)
                if (generated) {
                  asset.proxyPath = generated
                }
              } else {
                asset.proxyPath = proxyPath
              }
            } catch (err) {
              console.error('Auto proxy generation failed:', err)
            }
          })
        }
      } catch (err) {
        console.error(`Failed to import ${filePath}:`, err)
      }
    }

    return assets
  })

  ipcMain.handle('media:get-info', async (_e, filePath: string) => {
    const info = await probeMedia(filePath)
    return info
  })

  ipcMain.handle(
    'media:get-thumbnail',
    async (_e, filePath: string, time: number) => {
      return await extractThumbnail(filePath, time)
    }
  )

  ipcMain.handle(
    'media:extract-frame',
    async (_e, filePath: string, time: number) => {
      return await extractFrame(filePath, time)
    }
  )

  ipcMain.handle(
    'media:extract-frame-base64',
    async (_e, filePath: string, time: number) => {
      return await extractFrameAsBase64(filePath, time)
    }
  )

  ipcMain.handle(
    'dialog:save',
    async (_e, defaultName: string) => {
      const result = await dialog.showSaveDialog({
        defaultPath: path.join(DEFAULT_PROJECTS_PATH, defaultName || 'untitled.cineflow'),
        filters: [{ name: 'CineFlow Project', extensions: ['cineflow'] }],
      })
      return result.canceled ? null : result.filePath
    }
  )

  ipcMain.handle('dialog:open', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: DEFAULT_PROJECTS_PATH,
      filters: [{ name: 'CineFlow Project', extensions: ['cineflow'] }],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  ipcMain.handle('project:save', async (_e, data: string) => {
    try {
      const project: Project = JSON.parse(data)
      const fileName = `${project.name}.cineflow`
      const filePath = path.join(DEFAULT_PROJECTS_PATH, fileName)
      fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8')

      // Save to version history
      saveVersion(project.id, data)

      return true
    } catch (err) {
      console.error('Failed to save project:', err)
      return false
    }
  })

  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: DEFAULT_PROJECTS_PATH,
      filters: [{ name: 'CineFlow Project', extensions: ['cineflow'] }],
      properties: ['openFile'],
    })

    if (result.canceled || !result.filePaths.length) return null

    try {
      const data = fs.readFileSync(result.filePaths[0], 'utf-8')
      return data
    } catch (err) {
      console.error('Failed to load project:', err)
      return null
    }
  })

  // ═══════════════════════════════════════
  // Export with Queue
  // ═══════════════════════════════════════
  ipcMain.handle('export:video', async (_e, data: string) => {
    try {
      const { project, settings } = JSON.parse(data) as {
        project: Project
        settings: ExportSettings
      }

      const videoClips: ExportClipInfo[] = []
      let sourceWidth = project.settings.width || 1920
      let sourceHeight = project.settings.height || 1080

      for (const track of project.tracks) {
        if (track.type !== 'video') continue
        for (const clip of track.clips) {
          const asset = project.mediaAssets.find(m => m.id === clip.mediaId)
          // Allow video+image clips, plus text clips
          if (!asset && !clip.textData) continue
          if (asset && asset.type === 'audio') continue

          const audioEffects = clip.effects.filter(e =>
            ['equalizer', 'compressor', 'reverb', 'noise-gate', 'delay'].includes(e.type)
          )

          videoClips.push({
            filePath: asset?.filePath ?? '',
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
            speed: clip.speed,
            muted: clip.muted,
            timelineStart: clip.timelineStart,
            effects: clip.effects.map(e => ({
              type: e.type,
              enabled: e.enabled,
              params: Object.fromEntries(
                Object.entries(e.params).map(([k, v]) => [k, { value: v.value, type: v.type }])
              ),
            })),
            audioEffects: audioEffects.map(e => ({
              type: e.type,
              enabled: e.enabled,
              params: Object.fromEntries(
                Object.entries(e.params).map(([k, v]) => [k, { value: v.value, type: v.type }])
              ),
            })),
            transitionOut: clip.transitionOut
              ? { type: clip.transitionOut.type, duration: clip.transitionOut.duration }
              : null,
            transitionIn: clip.transitionIn
              ? { type: clip.transitionIn.type, duration: clip.transitionIn.duration }
              : null,
            volume: track.volume,
            pan: track.pan,
            transform: clip.transform ? {
              positionX: clip.transform.positionX,
              positionY: clip.transform.positionY,
              scaleX: clip.transform.scaleX,
              scaleY: clip.transform.scaleY,
              rotation: clip.transform.rotation,
              opacity: clip.transform.opacity,
            } : undefined,
          })

          if (asset && asset.width > 0 && asset.height > 0) {
            sourceWidth = asset.width
            sourceHeight = asset.height
          }
        }
      }

      if (videoClips.length === 0) {
        dialog.showErrorBox('Export', 'No video clips found to export.')
        return null
      }

      // Pre-fill output path
      const ext = settings.format === 'webm' ? 'webm' : settings.format === 'mkv' ? 'mkv' : settings.format === 'mov' ? 'mov' : 'mp4'
      const result = await dialog.showSaveDialog({
        defaultPath: path.join(DEFAULT_PROJECTS_PATH, `${project.name}.${ext}`),
        filters: [{ name: 'Video', extensions: [ext] }],
      })

      if (result.canceled || !result.filePath) return null

      // Add to queue
      const queueId = exportQueue.add(
        project.name,
        result.filePath,
        settings,
        async (queueItem, onProgress) => {
          await exportTimeline(
            videoClips,
            result.filePath,
            settings,
            sourceWidth,
            sourceHeight,
            () => exportQueue.isCancelled(queueItem.id),
          )
        },
      )

      return { queueId }
    } catch (err) {
      console.error('Export failed:', err)
      dialog.showErrorBox('Export Failed', String(err))
      return null
    }
  })

  ipcMain.handle('export:cancel', async (_e, queueId: string) => {
    return exportQueue.cancel(queueId)
  })

  ipcMain.handle('export:get-queue', async () => {
    return exportQueue.getQueue()
  })

  // ═══════════════════════════════════════
  // Proxy Management
  // ═══════════════════════════════════════
  ipcMain.handle('media:generate-proxy', async (_e, filePath: string) => {
    try {
      const ext = path.extname(filePath)
      const proxyDir = path.join(app.getPath('userData'), 'proxies')
      if (!fs.existsSync(proxyDir)) fs.mkdirSync(proxyDir, { recursive: true })
      const proxyPath = path.join(proxyDir, `proxy_${crypto.randomUUID().substring(0, 8)}_${path.basename(filePath, ext)}.mp4`)
      if (fs.existsSync(proxyPath)) return proxyPath
      await generateProxy(filePath, proxyPath)
      return proxyPath
    } catch {
      return null
    }
  })

  // ═══════════════════════════════════════
  // GPU Detection
  // ═══════════════════════════════════════
  ipcMain.handle('gpu:detect', async () => {
    return detectGPU()
  })

  // ═══════════════════════════════════════
  // Version History
  // ═══════════════════════════════════════
  ipcMain.handle('version:save', async (_e, data: string) => {
    try {
      const project = JSON.parse(data)
      const result = saveVersion(project.id, data)
      return result !== null
    } catch {
      return false
    }
  })

  ipcMain.handle('version:list', async (_e, projectId: string) => {
    return listVersions(projectId)
  })

  ipcMain.handle('version:restore', async (_e, projectId: string, versionId: string) => {
    return restoreVersion(projectId, versionId)
  })

  // ═══════════════════════════════════════
  // Waveform
  // ═══════════════════════════════════════
  ipcMain.handle('media:get-waveform', async (_e, filePath: string, startTime: number, duration: number, targetSampleRate?: number) => {
    try {
      const result = await extractAudioWaveform(filePath, startTime, duration, targetSampleRate ?? 100)
      return result
    } catch {
      return { samples: [], sampleRate: 100, duration: 0 }
    }
  })

  ipcMain.handle('media:get-system-fonts', async () => {
    const fontDir = process.env.WINDIR
      ? path.join(process.env.WINDIR, 'Fonts')
      : '/System/Library/Fonts'
    try {
      const files = fs.readdirSync(fontDir)
      return files.filter(f => /\.(ttf|otf|ttc)$/i.test(f)).map(f => path.basename(f, path.extname(f)))
    } catch {
      return ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Impact']
    }
  })

  ipcMain.handle('media:load-lut', async (_e, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const lines = data.trim().split('\n')
      const sizeLine = lines.find(l => l.toLowerCase().startsWith('lut3d'))
      const size = sizeLine ? parseInt(sizeLine.split(' ')[1] || '33') : 33
      return { id: path.basename(filePath, path.extname(filePath)), name: path.basename(filePath), size }
    } catch {
      return null
    }
  })

  ipcMain.handle('media:get-scope-data', async (_e, filePath: string, time: number) => {
    try {
      const frameB64 = await extractFrameAsBase64(filePath, time)
      return {
        histogram: { r: Array(256).fill(0), g: Array(256).fill(0), b: Array(256).fill(0), luma: Array(256).fill(0) },
        waveform: [],
        vectorscope: [],
      }
    } catch {
      return { histogram: { r: [], g: [], b: [], luma: [] }, waveform: [], vectorscope: [] }
    }
  })

  ipcMain.handle(
    'media:sync-multicam',
    async (_e, clips: { clipId: string; filePath: string; sourceStart: number; sourceEnd: number }[]) => {
      try {
        const results = await syncClipsByAudio(clips)
        return results
      } catch (err) {
        console.error('Multicam sync failed:', err)
        return clips.map(c => ({ clipId: c.clipId, offset: 0, confidence: 0 }))
      }
    }
  )
}
