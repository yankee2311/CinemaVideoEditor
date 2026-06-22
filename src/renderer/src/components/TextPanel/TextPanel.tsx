import React from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { TextClipData, Caption } from '@shared/types'
import { parseSRT } from '@shared/utils/srtParser'

const DEFAULT_TEXT_DATA: TextClipData = {
  content: 'Double-click to edit',
  fontFamily: 'Arial',
  fontSize: 64,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'center',
  textVAlign: 'middle',
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowBlur: 4,
  letterSpacing: 0,
  lineHeight: 1.2,
  backgroundColor: 'transparent',
  backgroundOpacity: 0,
  padding: 20,
  borderRadius: 0,
}

export default function TextPanel() {
  const { project, timeline } = useProjectStore()

  const selectedClip = React.useMemo(() => {
    if (!project || !timeline.selectedClipId) return null
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === timeline.selectedClipId)
      if (clip && clip.textData) return clip
    }
    return null
  }, [project, timeline.selectedClipId])

  const [textData, setTextData] = React.useState<TextClipData>(DEFAULT_TEXT_DATA)

  React.useEffect(() => {
    if (selectedClip?.textData) {
      setTextData(selectedClip.textData)
    }
  }, [selectedClip?.id])

  const updateTextData = (update: Partial<TextClipData>) => {
    const newData = { ...textData, ...update }
    setTextData(newData)
  }

  const [tab, setTab] = React.useState<'edit' | 'style' | 'layout'>('edit')

  const tabs = [
    { id: 'edit' as const, label: 'Edit' },
    { id: 'style' as const, label: 'Style' },
    { id: 'layout' as const, label: 'Layout' },
  ]

  return (
    <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, marginBottom: 14,
        color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Text
      </h3>

      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '4px 8px', fontSize: 9, fontWeight: 600,
              background: tab === t.id ? 'var(--bg-active)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'edit' && (
        <div>
          <textarea
            value={textData.content}
            onChange={(e) => updateTextData({ content: e.target.value })}
            rows={6}
            style={{
              width: '100%', fontSize: 12, padding: 8,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
              resize: 'vertical', fontFamily: 'monospace',
            }}
          />

          <CaptionImport selectedClip={selectedClip} />
          <div style={{ marginTop: 8 }}>
            <FieldLabel>Font</FieldLabel>
            <FontFamilySelect value={textData.fontFamily} onChange={(v) => updateTextData({ fontFamily: v })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Size</FieldLabel>
              <input
                type="range" min={8} max={200} step={1}
                value={textData.fontSize}
                onChange={(e) => updateTextData({ fontSize: parseInt(e.target.value) })}
                style={{ width: '100%', height: 3 }}
              />
            </div>
            <div style={{ width: 44, textAlign: 'right', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', paddingTop: 14 }}>
              {textData.fontSize}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div>
              <FieldLabel>Weight</FieldLabel>
              <ToggleGroup value={textData.fontWeight} options={['normal', 'bold']} onChange={(v) => updateTextData({ fontWeight: v as 'normal' | 'bold' })} />
            </div>
            <div>
              <FieldLabel>Style</FieldLabel>
              <ToggleGroup value={textData.fontStyle} options={['normal', 'italic']} onChange={(v) => updateTextData({ fontStyle: v as 'normal' | 'italic' })} />
            </div>
          </div>
        </div>
      )}

      {tab === 'style' && (
        <div>
          <FieldLabel>Fill Color</FieldLabel>
          <ColorInput value={textData.color} onChange={(v) => updateTextData({ color: v })} />

          <div style={{ marginTop: 8 }}>
            <FieldLabel>Stroke</FieldLabel>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ColorInput value={textData.strokeColor} onChange={(v) => updateTextData({ strokeColor: v })} />
              <input
                type="number" min={0} max={20} step={0.5}
                value={textData.strokeWidth}
                onChange={(e) => updateTextData({ strokeWidth: parseFloat(e.target.value) })}
                style={{ width: 48, fontSize: 11, textAlign: 'center' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <FieldLabel>Shadow</FieldLabel>
            <ColorInput value={textData.shadowColor} onChange={(v) => updateTextData({ shadowColor: v })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <div><FieldLabel>X</FieldLabel><input type="number" value={textData.shadowOffsetX} onChange={(e) => updateTextData({ shadowOffsetX: parseInt(e.target.value) })} style={{ width: 48, fontSize: 11 }} /></div>
              <div><FieldLabel>Y</FieldLabel><input type="number" value={textData.shadowOffsetY} onChange={(e) => updateTextData({ shadowOffsetY: parseInt(e.target.value) })} style={{ width: 48, fontSize: 11 }} /></div>
              <div><FieldLabel>Blur</FieldLabel><input type="number" min={0} value={textData.shadowBlur} onChange={(e) => updateTextData({ shadowBlur: parseInt(e.target.value) })} style={{ width: 48, fontSize: 11 }} /></div>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <FieldLabel>Letter Spacing</FieldLabel>
            <input type="range" min={-5} max={20} step={0.5} value={textData.letterSpacing}
              onChange={(e) => updateTextData({ letterSpacing: parseFloat(e.target.value) })}
              style={{ width: '100%', height: 3 }} />
          </div>

          <div style={{ marginTop: 8 }}>
            <FieldLabel>Line Height</FieldLabel>
            <input type="range" min={0.5} max={3} step={0.1} value={textData.lineHeight}
              onChange={(e) => updateTextData({ lineHeight: parseFloat(e.target.value) })}
              style={{ width: '100%', height: 3 }} />
          </div>
        </div>
      )}

      {tab === 'layout' && (
        <div>
          <div style={{ marginBottom: 8 }}>
            <FieldLabel>Align</FieldLabel>
            <ToggleGroup value={textData.textAlign} options={['left', 'center', 'right']} onChange={(v) => updateTextData({ textAlign: v as 'left' | 'center' | 'right' })} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <FieldLabel>Vertical Align</FieldLabel>
            <ToggleGroup value={textData.textVAlign} options={['top', 'middle', 'bottom']} onChange={(v) => updateTextData({ textVAlign: v as 'top' | 'middle' | 'bottom' })} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <FieldLabel>Background</FieldLabel>
            <ColorInput value={textData.backgroundColor} onChange={(v) => updateTextData({ backgroundColor: v })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <div><FieldLabel>Opacity</FieldLabel><input type="range" min={0} max={1} step={0.01} value={textData.backgroundOpacity} onChange={(e) => updateTextData({ backgroundOpacity: parseFloat(e.target.value) })} style={{ width: 80, height: 3 }} /></div>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <FieldLabel>Padding</FieldLabel>
            <input type="range" min={0} max={100} step={1} value={textData.padding}
              onChange={(e) => updateTextData({ padding: parseInt(e.target.value) })}
              style={{ width: '100%', height: 3 }} />
          </div>
          <div>
            <FieldLabel>Border Radius</FieldLabel>
            <input type="range" min={0} max={50} step={1} value={textData.borderRadius}
              onChange={(e) => updateTextData({ borderRadius: parseInt(e.target.value) })}
              style={{ width: '100%', height: 3 }} />
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function ToggleGroup({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '3px 8px', fontSize: 9, fontWeight: 600,
            background: value === opt ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: value === opt ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', textTransform: 'capitalize',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={value === 'transparent' ? '#000000' : value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, fontSize: 11, padding: '3px 6px', fontFamily: 'monospace' }}
      />
    </div>
  )
}

function FontFamilySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fonts, setFonts] = React.useState<string[]>([value])

  React.useEffect(() => {
    window.cineflow.getSystemFonts().then(setFonts).catch(() => {})
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
    >
      {fonts.map(f => (
        <option key={f} value={f}>{f}</option>
      ))}
    </select>
  )
}

function CaptionImport({ selectedClip }: { selectedClip: { id: string; textData?: TextClipData } | null }) {
  const { updateTextClip } = useProjectStore()
  const [captions, setCaptions] = React.useState<Caption[]>([])

  const handleImportSRT = async () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.srt,.vtt'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          if (text) {
            const parsed = parseSRT(text)
            setCaptions(parsed)
            if (selectedClip) {
              updateTextClip(selectedClip.id, { content: parsed.map(c => c.text).join('\n') })
            }
          }
        }
        reader.readAsText(file)
      }
      input.click()
    } catch {}
  }

  return (
    <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-label)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Subtitles
      </div>
      <button
        onClick={handleImportSRT}
        style={{
          padding: '4px 12px', fontSize: 10, fontWeight: 600,
          background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: 6,
        }}
      >
        Import SRT
      </button>
      {captions.length > 0 && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          {captions.length} captions loaded
        </div>
      )}
      {captions.map((cap, i) => (
        <div key={cap.id} style={{
          fontSize: 9, color: 'var(--text-secondary)', padding: '2px 0',
          borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6,
        }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>
            {cap.start.toFixed(1)}s-{cap.end.toFixed(1)}s
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cap.text}
          </span>
        </div>
      ))}
    </div>
  )
}
