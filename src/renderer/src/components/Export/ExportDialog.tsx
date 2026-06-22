import React, { useState, useEffect } from 'react'
import type { Project } from '@shared/types'

interface ExportSettings {
  format: 'mp4' | 'mov' | 'avi' | 'webm'
  resolution: 'source' | '1080p' | '720p' | '480p'
  quality: number
  fps: number
}

export default function ExportDialog({
  project,
  onClose,
}: {
  project: Project | null
  onClose: () => void
}) {
  const [format, setFormat] = useState<ExportSettings['format']>('mp4')
  const [resolution, setResolution] = useState<ExportSettings['resolution']>('source')
  const [quality, setQuality] = useState(23)
  const [fps, setFps] = useState(30)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cleanup = window.cineflow.onExportProgress((p) => {
      setProgress(p)
      if (p >= 100) {
        setExporting(false)
        setDone(true)
      }
    })
    return () => { cleanup() }
  }, [])

  const handleExport = async () => {
    if (!project) return
    setExporting(true)
    setProgress(0)
    setError(null)
    setDone(false)

    try {
      const data = JSON.stringify({
        project,
        settings: { format, resolution, quality, fps },
      })
      const result = await window.cineflow.exportVideo(data)
      if (!result) {
        setError('Export failed or was cancelled')
        setExporting(false)
      }
    } catch (err) {
      setError(String(err))
      setExporting(false)
    }
  }

  const handleClose = () => {
    if (exporting) return
    onClose()
  }

  const hasClips = project?.tracks.some(t => t.clips.length > 0) ?? false

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 24,
          width: 440,
          maxWidth: '90vw',
          color: 'var(--text-primary)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Export Video</h2>
          <button
            onClick={handleClose}
            disabled={exporting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {!hasClips && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', marginBottom: 16 }}>
            No clips in timeline to export.
          </p>
        )}

        {hasClips && !exporting && !done && (
          <>
            <Field label="Format">
              <SelectGroup
                options={['mp4', 'mov', 'webm', 'avi']}
                value={format}
                onChange={(v) => setFormat(v as ExportSettings['format'])}
              />
            </Field>

            <Field label="Resolution">
              <SelectGroup
                options={['source', '1080p', '720p', '480p']}
                value={resolution}
                onChange={(v) => setResolution(v as ExportSettings['resolution'])}
              />
            </Field>

            <Field label={`Quality (CRF ${quality})`}>
              <input
                type="range"
                min={18}
                max={32}
                step={1}
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Best (18)</span>
                <span>Smallest (32)</span>
              </div>
            </Field>

            <Field label="FPS">
              <SelectGroup
                options={['24', '25', '30', '60']}
                value={String(fps)}
                onChange={(v) => setFps(parseInt(v))}
              />
            </Field>

            <button
              onClick={handleExport}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '10px 0',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Export Video
            </button>
          </>
        )}

        {exporting && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
              Rendering... {Math.round(progress)}%
            </p>
            <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
              Do not close the application
            </p>
          </div>
        )}

        {done && !error && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#10003;</div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Export Complete!</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Your video has been saved successfully.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#e74c3c', marginBottom: 8 }}>Export Failed</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function SelectGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 12px',
            fontSize: 12,
            background: value === opt ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: value === opt ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
