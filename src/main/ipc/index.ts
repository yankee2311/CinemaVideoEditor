import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { probeMedia, extractThumbnail, extractFrame, extractFrameAsBase64, exportTimeline, syncClipsByAudio, extractAudioWaveform, generateProxy } from '../ffmpeg'
import type { ExportClipInfo, ExportOptions } from '../ffmpeg'
import type { MediaAsset, Project, ImportMediaResult } from '../../shared/types'

const DEFAULT_PROJECTS_PATH = path.join(app.getPath('documents'), 'CineFlow')

export function registerIpcHandlers(): void {
  if (!fs.existsSync(DEFAULT_PROJECTS_PATH)) {
    fs.mkdirSync(DEFAULT_PROJECTS_PATH, { recursive: true })
  }

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

  ipcMain.handle('export:video', async (_e, data: string) => {
    try {
      const { project, settings } = JSON.parse(data) as {
        project: Project
        settings: { format: ExportOptions['format']; resolution: ExportOptions['resolution']; quality: number; fps: number }
      }

      const videoClips: ExportClipInfo[] = []
      let sourceWidth = 1920
      let sourceHeight = 1080

      for (const track of project.tracks) {
        if (track.type !== 'video') continue
        for (const clip of track.clips) {
          const asset = project.mediaAssets.find(m => m.id === clip.mediaId)
          if (!asset) continue
          if (asset.type === 'image') continue
          const audioEffects = clip.effects.filter(e =>
            ['equalizer', 'compressor', 'reverb', 'noise-gate', 'delay'].includes(e.type)
          )
          videoClips.push({
            filePath: asset.filePath,
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
            volume: track.volume,
            pan: track.pan,
          })
          if (asset.width > 0 && asset.height > 0) {
            sourceWidth = asset.width
            sourceHeight = asset.height
          }
        }
      }

      if (videoClips.length === 0) {
        dialog.showErrorBox('Export', 'No video clips found to export.')
        return false
      }

      const result = await dialog.showSaveDialog({
        defaultPath: path.join(DEFAULT_PROJECTS_PATH, `${project.name}.${settings.format}`),
        filters: [{ name: 'Video', extensions: [settings.format] }],
      })

      if (result.canceled || !result.filePath) return false

      const win = BrowserWindow.getFocusedWindow()

      const exportOptions: ExportOptions = {
        format: settings.format,
        resolution: settings.resolution,
        quality: settings.quality,
        fps: settings.fps,
        onProgress: (progress) => {
          win?.webContents.send('export:progress', progress)
        },
      }

      await exportTimeline(videoClips, result.filePath, exportOptions, sourceWidth, sourceHeight)
      return true
    } catch (err) {
      console.error('Export failed:', err)
      dialog.showErrorBox('Export Failed', String(err))
      return false
    }
  })

  ipcMain.handle('media:generate-proxy', async (_e, filePath: string) => {
    try {
      const ext = path.extname(filePath)
      const proxyDir = path.join(app.getPath('userData'), 'proxies')
      if (!fs.existsSync(proxyDir)) fs.mkdirSync(proxyDir, { recursive: true })
      const proxyPath = path.join(proxyDir, `proxy_${path.basename(filePath, ext)}.mp4`)
      if (fs.existsSync(proxyPath)) return proxyPath
      await generateProxy(filePath, proxyPath)
      return proxyPath
    } catch {
      return null
    }
  })

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
