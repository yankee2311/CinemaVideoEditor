import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cineflow', {
  importMedia: () => ipcRenderer.invoke('media:import'),
  getMediaInfo: (filePath: string) => ipcRenderer.invoke('media:get-info', filePath),
  getThumbnail: (filePath: string, time: number) =>
    ipcRenderer.invoke('media:get-thumbnail', filePath, time),
  extractFrame: (filePath: string, time: number) =>
    ipcRenderer.invoke('media:extract-frame', filePath, time),
  extractFrameBase64: (filePath: string, time: number) =>
    ipcRenderer.invoke('media:extract-frame-base64', filePath, time),
  saveProject: (data: string) => ipcRenderer.invoke('project:save', data),
  loadProject: () => ipcRenderer.invoke('project:load'),
  showSaveDialog: (defaultName: string) =>
    ipcRenderer.invoke('dialog:save', defaultName),
  showOpenDialog: () => ipcRenderer.invoke('dialog:open'),
  getMediaUrl: (filePath: string) => `media:///${encodeURI(filePath.replace(/\\/g, '/'))}`,
  exportVideo: (data: string) => ipcRenderer.invoke('export:video', data),
  cancelExport: (queueId: string) => ipcRenderer.invoke('export:cancel', queueId),
  getExportQueue: () => ipcRenderer.invoke('export:get-queue'),
  syncMulticam: (clips: { clipId: string; filePath: string; sourceStart: number; sourceEnd: number }[]) =>
    ipcRenderer.invoke('media:sync-multicam', clips),
  onExportProgress: (callback: (progress: number) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: number) => callback(progress)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.removeListener('export:progress', handler)
  },
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },
  getWaveform: (filePath: string, startTime: number, duration: number, targetSampleRate?: number) =>
    ipcRenderer.invoke('media:get-waveform', filePath, startTime, duration, targetSampleRate),
  getSystemFonts: () => ipcRenderer.invoke('media:get-system-fonts'),
  loadLut: (filePath: string) => ipcRenderer.invoke('media:load-lut', filePath),
  importLut: () => ipcRenderer.invoke('media:import-lut'),
  getScopeData: (filePath: string, time: number) =>
    ipcRenderer.invoke('media:get-scope-data', filePath, time),
  extractFramePixels: (filePath: string, time: number, width: number, height: number) =>
    ipcRenderer.invoke('media:extract-frame-pixels', filePath, time, width, height),
  generateProxy: (filePath: string) => ipcRenderer.invoke('media:generate-proxy', filePath),
  detectGPU: () => ipcRenderer.invoke('gpu:detect'),
  saveVersion: (data: string) => ipcRenderer.invoke('version:save', data),
  listVersions: (projectId: string) => ipcRenderer.invoke('version:list', projectId),
  restoreVersion: (versionId: string, projectId: string) => ipcRenderer.invoke('version:restore', versionId, projectId),
  onExportQueueUpdate: (callback: (queue: any[]) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, queue: any[]) => callback(queue)
    ipcRenderer.on('export:queue-update', handler)
    return () => ipcRenderer.removeListener('export:queue-update', handler)
  },
})
