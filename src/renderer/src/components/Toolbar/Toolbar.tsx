import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import ExportDialog from '@/components/Export/ExportDialog'
import type { Project, ToolMode } from '@shared/types'

export default function Toolbar() {
  const { project, addTrack, addTextClip, rippleDeleteClip, splitClip, timeline, setToolMode, undo, redo, scrollToPlayhead, fitToView } = useProjectStore()
  const selectedClipId = timeline.selectedClipId
  const selectedTrackId = timeline.selectedTrackId
  const currentTime = timeline.currentTime
  const toolMode = timeline.toolMode
  const [showExport, setShowExport] = React.useState(false)

  const handleAddVideoTrack = () => addTrack('video')
  const handleAddAudioTrack = () => addTrack('audio')
  const handleAddTextTrack = () => addTrack('text')

  const handleAddText = () => {
    if (!project) return
    let textTrack = project.tracks.find(t => t.type === 'text')
    if (!textTrack) {
      addTrack('text')
      textTrack = useProjectStore.getState().project?.tracks.find(t => t.type === 'text')
    }
    if (textTrack) {
      addTextClip(textTrack.id, currentTime)
    }
  }

  const handleSplit = () => {
    if (selectedClipId) {
      splitClip(selectedClipId, currentTime)
    } else if (selectedTrackId && project) {
      const track = project.tracks.find(t => t.id === selectedTrackId)
      if (track) {
        const clip = track.clips.find(
          c => currentTime >= c.timelineStart && currentTime <= c.timelineStart + c.timelineDuration
        )
        if (clip) {
          splitClip(clip.id, currentTime)
        }
      }
    }
  }

  const handleDelete = () => {
    if (selectedClipId) {
      rippleDeleteClip(selectedClipId)
    }
  }

  const handleScrollToPlayhead = () => {
    scrollToPlayhead(window.innerWidth, 120)
  }

  const handleFitToView = () => {
    fitToView(window.innerWidth, 300, 120, 32, 52)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 8px',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <ToolButton
        icon="select"
        label="Selection"
        shortcut="V"
        active={toolMode === 'select'}
        onClick={() => setToolMode('select')}
      />
      <ToolButton
        icon="razor"
        label="Razor"
        shortcut="C"
        active={toolMode === 'razor'}
        onClick={() => setToolMode('razor')}
      />
      <ToolButton
        icon="slip"
        label="Slip"
        shortcut="A"
        active={toolMode === 'slip'}
        onClick={() => setToolMode('slip')}
      />
      <ToolButton
        icon="slide"
        label="Slide"
        active={toolMode === 'slide'}
        onClick={() => setToolMode('slide')}
      />
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
      <ToolbarButton label="Split" shortcut="S" onClick={handleSplit} />
      <ToolbarButton label="Delete" shortcut="Del" onClick={handleDelete} />
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
      <ToolbarButton label="Undo" shortcut="Ctrl+Z" onClick={undo} />
      <ToolbarButton label="Redo" shortcut="Ctrl+Y" onClick={redo} />
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
      <ToolbarButton label="Fit" shortcut="Ctrl+F" onClick={handleFitToView} />
      <ToolbarButton label="Center" shortcut="Ctrl+H" onClick={handleScrollToPlayhead} />
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
      <ToolbarButton label="Video Track" onClick={handleAddVideoTrack} />
      <ToolbarButton label="Audio Track" onClick={handleAddAudioTrack} />
      <ToolbarButton label="Text Track" onClick={handleAddTextTrack} />
      <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
      <ToolbarButton label="Add Text" shortcut="T" onClick={handleAddText} />
      <div style={{ flex: 1 }} />
      <ToolbarButton label="Export" onClick={() => setShowExport(true)} />
      {showExport && (
        <ExportDialog project={project} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  shortcut,
  onClick,
  active,
}: {
  label: string
  shortcut?: string
  onClick?: () => void
  active?: boolean
}) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {shortcut && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

function ToolButton({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: string
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = React.useState(false)

  const renderIcon = () => {
    const color = active ? '#fff' : 'currentColor'
    const size = 16

    switch (icon) {
      case 'select':
        // Arrow cursor icon
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        )
      case 'razor':
        // Blade/razor icon
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        )
      case 'slip':
        // Slip edit icon (arrows with bars)
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="4" x2="8" y2="20" />
            <line x1="16" y1="4" x2="16" y2="20" />
            <polyline points="4 12 8 8 8 16" />
            <polyline points="20 12 16 8 16 16" />
          </svg>
        )
      case 'slide':
        // Slide edit icon (move with arrows)
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15" />
            <polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="12" y1="2" x2="12" y2="22" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        background: active ? 'var(--accent)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--accent)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {renderIcon()}
    </button>
  )
}
