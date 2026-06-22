import { create } from 'zustand'

export interface ShortcutBinding {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
}

export type ShortcutAction =
  | 'select-tool'
  | 'razor-tool'
  | 'slip-tool'
  | 'slide-tool'
  | 'split-clip'
  | 'delete-clip'
  | 'undo'
  | 'redo'
  | 'play-pause'
  | 'seek-forward'
  | 'seek-backward'
  | 'seek-start'
  | 'seek-end'
  | 'add-marker'
  | 'add-text'
  | 'export'
  | 'save'
  | 'fit-to-view'
  | 'center-playhead'

const DEFAULT_SHORTCUTS: Record<ShortcutAction, ShortcutBinding> = {
  'select-tool': { key: 'v', ctrl: false, shift: false, alt: false },
  'razor-tool': { key: 'c', ctrl: false, shift: false, alt: false },
  'slip-tool': { key: 'a', ctrl: false, shift: false, alt: false },
  'slide-tool': { key: 's', ctrl: false, shift: true, alt: false },
  'split-clip': { key: 's', ctrl: false, shift: false, alt: false },
  'delete-clip': { key: 'Delete', ctrl: false, shift: false, alt: false },
  'undo': { key: 'z', ctrl: true, shift: false, alt: false },
  'redo': { key: 'y', ctrl: true, shift: false, alt: false },
  'play-pause': { key: 'k', ctrl: false, shift: false, alt: false },
  'seek-forward': { key: 'ArrowRight', ctrl: false, shift: false, alt: false },
  'seek-backward': { key: 'ArrowLeft', ctrl: false, shift: false, alt: false },
  'seek-start': { key: 'Home', ctrl: false, shift: false, alt: false },
  'seek-end': { key: 'End', ctrl: false, shift: false, alt: false },
  'add-marker': { key: 'm', ctrl: false, shift: false, alt: false },
  'add-text': { key: 't', ctrl: false, shift: false, alt: false },
  'export': { key: 'e', ctrl: true, shift: false, alt: false },
  'save': { key: 's', ctrl: true, shift: false, alt: false },
  'fit-to-view': { key: 'f', ctrl: true, shift: false, alt: false },
  'center-playhead': { key: 'h', ctrl: true, shift: false, alt: false },
}

interface ShortcutState {
  shortcuts: Record<ShortcutAction, ShortcutBinding>
  setShortcut: (action: ShortcutAction, binding: ShortcutBinding) => void
  resetToDefaults: () => void
  getBinding: (action: ShortcutAction) => ShortcutBinding
  matchEvent: (e: KeyboardEvent) => ShortcutAction | null
}

function loadShortcuts(): Record<ShortcutAction, ShortcutBinding> {
  try {
    const saved = localStorage.getItem('cineflow-shortcuts')
    if (saved) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) }
    }
  } catch {}
  return { ...DEFAULT_SHORTCUTS }
}

function saveShortcuts(shortcuts: Record<ShortcutAction, ShortcutBinding>) {
  try {
    localStorage.setItem('cineflow-shortcuts', JSON.stringify(shortcuts))
  } catch {}
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: loadShortcuts(),

  setShortcut: (action, binding) =>
    set((s) => {
      const newShortcuts = { ...s.shortcuts, [action]: binding }
      saveShortcuts(newShortcuts)
      return { shortcuts: newShortcuts }
    }),

  resetToDefaults: () => {
    saveShortcuts(DEFAULT_SHORTCUTS)
    set({ shortcuts: { ...DEFAULT_SHORTCUTS } })
  },

  getBinding: (action) => {
    return get().shortcuts[action] || DEFAULT_SHORTCUTS[action]
  },

  matchEvent: (e) => {
    const shortcuts = get().shortcuts
    for (const [action, binding] of Object.entries(shortcuts)) {
      const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase() ||
        e.code === binding.key ||
        e.key === binding.key
      if (
        keyMatch &&
        e.ctrlKey === binding.ctrl &&
        e.shiftKey === binding.shift &&
        e.altKey === binding.alt
      ) {
        return action as ShortcutAction
      }
    }
    return null
  },
}))
