import React from 'react'
import { useShortcutStore, type ShortcutAction } from '@/store/shortcutStore'
import { useUIStore } from '@/store/uiStore'

const ACTION_LABELS: Record<ShortcutAction, string> = {
  'select-tool': 'Selection Tool',
  'razor-tool': 'Razor Tool',
  'slip-tool': 'Slip Tool',
  'slide-tool': 'Slide Tool',
  'split-clip': 'Split Clip',
  'delete-clip': 'Delete Clip',
  'undo': 'Undo',
  'redo': 'Redo',
  'play-pause': 'Play / Pause',
  'seek-forward': 'Seek Forward',
  'seek-backward': 'Seek Backward',
  'seek-start': 'Go to Start',
  'seek-end': 'Go to End',
  'add-marker': 'Add Marker',
  'add-text': 'Add Text',
  'export': 'Export',
  'save': 'Save Project',
  'fit-to-view': 'Fit to View',
  'center-playhead': 'Center Playhead',
}

export default function SettingsPanel() {
  const [tab, setTab] = React.useState<'shortcuts' | 'general'>('shortcuts')
  const { theme, setTheme } = useUIStore()

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Settings
      </h3>

      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        <button onClick={() => setTab('shortcuts')}
          style={{ flex: 1, padding: '4px 8px', fontSize: 9, fontWeight: 600,
            background: tab === 'shortcuts' ? 'var(--bg-active)' : 'transparent',
            color: tab === 'shortcuts' ? 'var(--text-primary)' : 'var(--text-muted)',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>Shortcuts</button>
        <button onClick={() => setTab('general')}
          style={{ flex: 1, padding: '4px 8px', fontSize: 9, fontWeight: 600,
            background: tab === 'general' ? 'var(--bg-active)' : 'transparent',
            color: tab === 'general' ? 'var(--text-primary)' : 'var(--text-muted)',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>General</button>
      </div>

      {tab === 'shortcuts' && <ShortcutEditor />}
      {tab === 'general' && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Theme
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTheme('dark')}
              style={{ padding: '5px 12px', fontSize: 11,
                background: theme === 'dark' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: theme === 'dark' ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>Dark</button>
            <button onClick={() => setTheme('light')}
              style={{ padding: '5px 12px', fontSize: 11,
                background: theme === 'light' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: theme === 'light' ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>Light</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShortcutEditor() {
  const { shortcuts, setShortcut, resetToDefaults } = useShortcutStore()
  const [recording, setRecording] = React.useState<ShortcutAction | null>(null)

  const handleRecord = (action: ShortcutAction) => {
    setRecording(action)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    const binding = {
      key: e.key === ' ' ? 'Space' : e.key,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    }
    setShortcut(recording, binding)
    setRecording(null)
  }

  const formatBinding = (binding: { key: string; ctrl: boolean; shift: boolean; alt: boolean }) => {
    const parts: string[] = []
    if (binding.ctrl) parts.push('Ctrl')
    if (binding.shift) parts.push('Shift')
    if (binding.alt) parts.push('Alt')
    parts.push(binding.key)
    return parts.join('+')
  }

  const actions = Object.keys(ACTION_LABELS) as ShortcutAction[]

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      {actions.map(action => (
        <div
          key={action}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 0', borderBottom: '1px solid var(--border-color)',
            fontSize: 11,
          }}
        >
          <span style={{ flex: 1, color: 'var(--text-primary)' }}>
            {ACTION_LABELS[action]}
          </span>
          <button
            onClick={() => handleRecord(action)}
            style={{
              padding: '3px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
              background: recording === action ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: recording === action ? '#fff' : 'var(--text-secondary)',
              border: recording === action ? '2px solid var(--accent)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', minWidth: 80, textAlign: 'center',
            }}
          >
            {recording === action ? 'Press key...' : formatBinding(shortcuts[action])}
          </button>
        </div>
      ))}
      <button
        onClick={resetToDefaults}
        style={{
          marginTop: 12, padding: '5px 12px', fontSize: 10,
          background: 'var(--danger)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        }}
      >
        Reset to Defaults
      </button>
    </div>
  )
}
