import { create } from 'zustand'

export type Panel =
  | 'media'
  | 'effects'
  | 'transitions'
  | 'color'
  | 'audio'
  | 'export'
  | 'none'

interface UIState {
  activePanel: Panel
  showTimeline: boolean
  showPreview: boolean
  showMediaPanel: boolean
  zoomLevel: number
  theme: 'dark' | 'light'

  setActivePanel: (panel: Panel) => void
  togglePanel: (panel: Panel) => void
  setShowTimeline: (show: boolean) => void
  setShowPreview: (show: boolean) => void
  setZoomLevel: (level: number) => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const useUIStore = create<UIState>((set) => ({
  activePanel: 'media',
  showTimeline: true,
  showPreview: true,
  showMediaPanel: true,
  zoomLevel: 1,
  theme: 'dark',

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) =>
    set((s) => ({
      activePanel: s.activePanel === panel ? 'none' : panel,
    })),

  setShowTimeline: (showTimeline) => set({ showTimeline }),

  setShowPreview: (showPreview) => set({ showPreview }),

  setShowMediaPanel: (showMediaPanel: boolean) => set({ showMediaPanel }),

  setZoomLevel: (zoomLevel) => set({ zoomLevel }),

  setTheme: (theme) => set({ theme }),
}))
