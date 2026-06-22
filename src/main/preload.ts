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
  syncMulticam: (clips: { clipId: string; filePath: string; sourceStart: number; sourceEnd: number }[]) =>
    ipcRenderer.invoke('media:sync-multicam', clips),
  onExportProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('export:progress', (_e, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('export:progress')
  },
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:action', (_e, action) => callback(action))
    return () => ipcRenderer.removeAllListeners('menu:action')
  },
  getWaveform: (filePath: string, startTime: number, duration: number, targetSampleRate?: number) =>
    ipcRenderer.invoke('media:get-waveform', filePath, startTime, duration, targetSampleRate),
  getSystemFonts: () => ipcRenderer.invoke('media:get-system-fonts'),
  loadLut: (filePath: string) => ipcRenderer.invoke('media:load-lut', filePath),
  getScopeData: (filePath: string, time: number) =>
    ipcRenderer.invoke('media:get-scope-data', filePath, time),
  generateProxy: (filePath: string) => ipcRenderer.invoke('media:generate-proxy', filePath),
})
