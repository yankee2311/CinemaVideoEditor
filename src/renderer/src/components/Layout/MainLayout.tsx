import React from 'react'
import Timeline from '@/components/Timeline/Timeline'
import PreviewPanel from '@/components/Preview/PreviewPanel'
import MediaPanel from '@/components/MediaPanel/MediaPanel'
import Toolbar from '@/components/Toolbar/Toolbar'
import EffectsPanel from '@/components/EffectsPanel/EffectsPanel'
import TransitionsPanel from '@/components/TransitionsPanel/TransitionsPanel'
import KeyframeEditor from '@/components/KeyframeEditor/KeyframeEditor'
import MixerPanel from '@/components/MixerPanel/MixerPanel'
import ColorPanel from '@/components/ColorPanel/ColorPanel'
import ScopesPanel from '@/components/ScopesPanel/ScopesPanel'
import TextPanel from '@/components/TextPanel/TextPanel'
import MarkersPanel from '@/components/MarkersPanel/MarkersPanel'
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    padding: '0 12px',
    gap: 8,
  },
  logo: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: 1,
  },
  topBarButtons: {
    display: 'flex',
    gap: 4,
    marginLeft: 16,
  },
  topBarBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    cursor: 'pointer',
    border: '1px solid transparent',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    width: 240,
    minWidth: 180,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    minHeight: 200,
    position: 'relative',
  },
  bottomPanel: {
    height: 280,
    minHeight: 150,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightPanel: {
    width: 240,
    minWidth: 180,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  statusBar: {
    height: 24,
    background: 'var(--bg-tertiary)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: 11,
    color: 'var(--text-muted)',
    gap: 16,
  },
}

export default function MainLayout() {
  const { project, timeline, setAutoFollow, setSnap } = useProjectStore()
  const { activePanel } = useUIStore()

  const [rightTab, setRightTab] = React.useState<'properties' | 'effects' | 'transitions' | 'keyframes' | 'mixer' | 'color' | 'scopes' | 'text' | 'markers' | 'settings'>('properties')

  const tabs = [
    { id: 'properties' as const, label: 'Props' },
    { id: 'effects' as const, label: 'FX' },
    { id: 'transitions' as const, label: 'Trans' },
    { id: 'keyframes' as const, label: 'KF' },
    { id: 'mixer' as const, label: 'Mix' },
    { id: 'color' as const, label: 'Color' },
    { id: 'scopes' as const, label: 'Scope' },
    { id: 'text' as const, label: 'Text' },
    { id: 'markers' as const, label: 'Marks' },
    { id: 'settings' as const, label: 'Set' },
  ]

  if (!project) {
    return <WelcomeScreen />
  }

  const toolLabels: Record<string, string> = {
    select: 'Selection (V)',
    razor: 'Razor (C)',
    slip: 'Slip (A)',
    slide: 'Slide',
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <span style={styles.logo}>CineFlow</span>
        <div style={styles.topBarButtons}>
          <TopBarBtn label="File" />
          <TopBarBtn label="Edit" />
          <TopBarBtn label="View" />
          <TopBarBtn label="Help" />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {project.name}
        </span>
      </div>

      <div style={styles.workspace}>
        <div style={styles.leftPanel}>
          <MediaPanel />
        </div>
        <div style={styles.centerPanel}>
          <Toolbar />
          <div style={styles.previewArea}>
            <PreviewPanel />
          </div>
          <div style={styles.bottomPanel}>
            <Timeline />
          </div>
        </div>
        <div style={styles.rightPanel}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                style={{
                  flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: 600,
                  background: rightTab === tab.id ? 'var(--bg-active)' : 'transparent',
                  color: rightTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none', borderBottom: rightTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {rightTab === 'properties' && <InspectorPanel />}
          {rightTab === 'effects' && <EffectsPanel />}
          {rightTab === 'transitions' && <TransitionsPanel />}
          {rightTab === 'keyframes' && <KeyframeEditor />}
          {rightTab === 'mixer' && <MixerPanel />}
          {rightTab === 'color' && <ColorPanel />}
          {rightTab === 'scopes' && <ScopesPanel />}
          {rightTab === 'text' && <TextPanel />}
          {rightTab === 'markers' && <MarkersPanel />}
          {rightTab === 'settings' && <SettingsPanel />}
        </div>
      </div>

      <div style={styles.statusBar}>
        <span>FPS: {project.settings.fps}</span>
        <span>Resolution: {project.settings.width}x{project.settings.height}</span>
        <span>Tool: {toolLabels[timeline.toolMode] || timeline.toolMode}</span>
        <div style={{ flex: 1 }} />
        <SpanBtn onClick={() => setAutoFollow(!timeline.autoFollowEnabled)}>
          Follow: {timeline.autoFollowEnabled ? 'On' : 'Off'}
        </SpanBtn>
        <SpanBtn onClick={() => setSnap(!timeline.snapEnabled)}>
          Snap: {timeline.snapEnabled ? 'On' : 'Off'}
        </SpanBtn>
      </div>
    </div>
  )
}

function SpanBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer', color: hovered ? 'var(--text-primary)' : undefined }}
    >
      {children}
    </span>
  )
}

function TopBarBtn({ label }: { label: string }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <button
      style={{
        ...styles.topBarBtn,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  )
}

function InspectorPanel() {
  const { project, timeline, setClipSpeed, setClipTransform, setClipMuted } = useProjectStore()

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip) return { clip, track }
    }
    return null
  }, [project, timeline.selectedClipId])

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 14,
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        Properties
      </h3>

      {!selectedClip && (
        <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)' }}>
          Select a clip to edit
        </p>
      )}

      {selectedClip && (
        <ClipProperties
          clip={selectedClip.clip}
          track={selectedClip.track}
          onSpeedChange={(speed) => setClipSpeed(selectedClip.clip.id, speed)}
          onTransformChange={(t) => setClipTransform(selectedClip.clip.id, t)}
          onMuteChange={(muted) => setClipMuted(selectedClip.clip.id, muted)}
        />
      )}
    </div>
  )
}

function ClipProperties({
  clip,
  track,
  onSpeedChange,
  onTransformChange,
  onMuteChange,
}: {
  clip: import('@shared/types').Clip
  track: import('@shared/types').Track
  onSpeedChange: (speed: number) => void
  onTransformChange: (t: Partial<import('@shared/types').Clip['transform']>) => void
  onMuteChange?: (muted: boolean) => void
}) {
  const [speedInput, setSpeedInput] = React.useState(String(clip.speed))

  React.useEffect(() => {
    setSpeedInput(String(clip.speed))
  }, [clip.speed])

  const section: React.CSSProperties = {
    marginBottom: 16,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid var(--border-color)',
  }

  const label: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-label)',
    marginBottom: 0,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }

  const value: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  }

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  }

  return (
    <div>
      {/* Clip info */}
      <div style={section}>
        <h4 style={sectionTitle}>Clip Info</h4>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {clip.name}
          </span>
        </div>
        <div style={row}>
          <span style={label}>Track</span>
          <span style={{ ...value, fontSize: 11 }}>{track.name}</span>
        </div>
        <div style={row}>
          <span style={label}>Type</span>
          <span style={{ ...value, fontSize: 11, textTransform: 'capitalize' }}>{track.type}</span>
        </div>
        {onMuteChange && (
          <div style={row}>
            <span style={label}>Audio</span>
            <button
              onClick={() => onMuteChange(!clip.muted)}
              style={{
                padding: '2px 10px',
                fontSize: 10,
                fontWeight: 600,
                background: clip.muted ? 'var(--danger)' : 'var(--success)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              {clip.muted ? 'MUTED' : 'ACTIVE'}
            </button>
          </div>
        )}
      </div>

      {/* Speed */}
      <div style={section}>
        <h4 style={sectionTitle}>Speed</h4>
        <div style={row}>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={clip.speed}
            onChange={(e) => {
              const s = parseFloat(e.target.value)
              setSpeedInput(String(s))
              onSpeedChange(s)
            }}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={speedInput}
            onChange={(e) => setSpeedInput(e.target.value)}
            onBlur={() => {
              const s = Math.max(0.1, Math.min(10, parseFloat(speedInput) || 1))
              setSpeedInput(String(s))
              onSpeedChange(s)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const s = Math.max(0.1, Math.min(10, parseFloat(speedInput) || 1))
                setSpeedInput(String(s))
                onSpeedChange(s)
              }
            }}
            style={{ width: 52, textAlign: 'center', fontSize: 11 }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 12 }}>x</span>
        </div>

        {/* Preset speed buttons */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {[0.25, 0.5, 1, 1.5, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeedInput(String(s))
                onSpeedChange(s)
              }}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: clip.speed === s ? 600 : 400,
                background: clip.speed === s ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: clip.speed === s ? '#fff' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: clip.speed === s ? '1px solid var(--accent)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Transform */}
      <div style={section}>
        <h4 style={sectionTitle}>Transform</h4>

        <TransformRow label="X" value={clip.transform.positionX} onChange={(v) => onTransformChange({ positionX: v })} />
        <TransformRow label="Y" value={clip.transform.positionY} onChange={(v) => onTransformChange({ positionY: v })} />
        <TransformRow label="Scale X" value={clip.transform.scaleX} min={0.01} max={5} step={0.01} onChange={(v) => onTransformChange({ scaleX: v })} />
        <TransformRow label="Scale Y" value={clip.transform.scaleY} min={0.01} max={5} step={0.01} onChange={(v) => onTransformChange({ scaleY: v })} />
        <TransformRow label="Rotation" value={clip.transform.rotation} min={-360} max={360} step={1} suffix="°" onChange={(v) => onTransformChange({ rotation: v })} />
        <TransformRow label="Opacity" value={clip.transform.opacity} min={0} max={1} step={0.01} onChange={(v) => onTransformChange({ opacity: v })} />
      </div>

      {/* Source timing */}
      <div style={section}>
        <h4 style={sectionTitle}>Source</h4>
        <div style={row}>
          <span style={label}>In</span>
          <span style={{ ...value, fontSize: 11 }}>
            {timeToString(clip.sourceStart)}
          </span>
        </div>
        <div style={row}>
          <span style={label}>Out</span>
          <span style={{ ...value, fontSize: 11 }}>
            {timeToString(clip.sourceEnd)}
          </span>
        </div>
        <div style={{ ...row, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
          <span style={label}>Duration</span>
          <span style={{ ...value, fontSize: 11, fontWeight: 600 }}>
            {timeToString(clip.timelineDuration)}
          </span>
        </div>
      </div>
    </div>
  )
}

function TransformRow({
  label,
  value,
  min = -9999,
  max = 9999,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  const [val, setVal] = React.useState(String(value))
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef({ x: 0, startValue: 0 })

  React.useEffect(() => {
    setVal(String(Math.round(value * 100) / 100))
  }, [value])

  const handleLabelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, startValue: value }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - dragStartRef.current.x
      const sensitivity = step >= 1 ? 1 : 0.01
      let newValue = dragStartRef.current.startValue + delta * sensitivity * (step >= 1 ? 1 : 0.1)
      newValue = Math.max(min, Math.min(max, newValue))
      newValue = Math.round(newValue / step) * step
      setVal(String(Math.round(newValue * 100) / 100))
      onChange(newValue)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span
        className="label-drag"
        onMouseDown={handleLabelMouseDown}
        style={{
          fontSize: 10,
          color: isDragging ? 'var(--accent)' : 'var(--text-label)',
          minWidth: 50,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          cursor: 'ew-resize',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const v = Math.max(min, Math.min(max, parseFloat(val) || 0))
          setVal(String(v))
          onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const v = Math.max(min, Math.min(max, parseFloat(val) || 0))
            setVal(String(v))
            onChange(v)
          }
        }}
        style={{
          width: 60,
          textAlign: 'right',
          fontSize: 11,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
        }}
      />
      {suffix && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{suffix}</span>}
    </div>
  )
}

function timeToString(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`
}

function WelcomeScreen() {
  const { newProject, loadProject } = useProjectStore()

  const handleNew = () => {
    newProject('Untitled Project')
  }

  const handleOpen = async () => {
    const filePath = await window.cineflow.showOpenDialog()
    if (filePath) {
      const data = await window.cineflow.loadProject()
      if (data) {
        try {
          const project = JSON.parse(data)
          loadProject(project)
        } catch { }
      }
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'var(--bg-primary)',
        gap: 24,
      }}
    >
      <h1
        style={{
          fontSize: 48,
          fontWeight: 200,
          color: 'var(--accent)',
          letterSpacing: 4,
        }}
      >
        CineFlow
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Professional Video Editor
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          onClick={handleNew}
          style={{
            padding: '10px 32px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          New Project
        </button>
        <button
          onClick={handleOpen}
          style={{
            padding: '10px 32px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 600,
            border: '1px solid var(--border-color)',
          }}
        >
          Open Project
        </button>
      </div>
    </div>
  )
}
