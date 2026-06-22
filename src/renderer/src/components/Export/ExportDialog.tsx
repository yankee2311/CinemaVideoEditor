import React, { useState, useEffect, useCallback } from 'react'
import type { Project, ExportSettings, ExportPreset, HardwareAccel, GPUInfo, QueueItem } from '@shared/types'
import { EXPORT_PRESETS, DEFAULT_EXPORT_SETTINGS } from '@shared/types'
import ExportQueue from './ExportQueue'

interface Props {
  project: Project | null
  onClose: () => void
}

export default function ExportDialog({ project, onClose }: Props) {
  const [preset, setPreset] = useState<ExportPreset>('youtube')
  const [format, setFormat] = useState<ExportSettings['format']>('mp4')
  const [codec, setCodec] = useState<ExportSettings['codec']>('h264')
  const [resolution, setResolution] = useState<ExportSettings['resolution']>('source')
  const [bitrate, setBitrate] = useState(16000)
  const [quality, setQuality] = useState(23)
  const [fps, setFps] = useState(30)
  const [hardwareAccel, setHardwareAccel] = useState<HardwareAccel>('auto')
  const [twoPass, setTwoPass] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null)
  const [showQueue, setShowQueue] = useState(false)
  const [queueId, setQueueId] = useState<string | null>(null)

  // Detect GPU on mount
  useEffect(() => {
    window.cineflow.detectGPU().then(setGpuInfo).catch(() => {})
  }, [])

  // Listen for export progress
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

  // Apply preset config
  const applyPreset = useCallback((p: ExportPreset) => {
    setPreset(p)
    const config = EXPORT_PRESETS[p]
    if (config) {
      setFormat(config.format)
      setCodec(config.codec)
      if (config.bitrate > 0) setBitrate(config.bitrate)
      setQuality(p === 'youtube' ? 23 : p === 'tiktok' ? 26 : 28)
      if (p !== 'h265') setTwoPass(false)
    }
    if (p === 'custom') {
      // Allow user to pick everything
      setFormat('mp4')
      setCodec('h264')
      setBitrate(16000)
      setQuality(23)
      setTwoPass(false)
    }
  }, [])

  const handleExport = async () => {
    if (!project) return
    setExporting(true)
    setProgress(0)
    setError(null)
    setDone(false)

    try {
      const settings: ExportSettings = {
        preset,
        format,
        codec,
        resolution,
        bitrate,
        fps,
        quality,
        hardwareAccel,
        twoPass,
      }
      const data = JSON.stringify({ project, settings })
      const result = await window.cineflow.exportVideo(data)
      if (!result) {
        setError('Export failed or was cancelled')
        setExporting(false)
      } else {
        setQueueId(result.queueId)
      }
    } catch (err) {
      setError(String(err))
      setExporting(false)
    }
  }

  const handleCancel = async () => {
    if (queueId) {
      await window.cineflow.cancelExport(queueId)
      setExporting(false)
      setError('Export cancelled')
    }
  }

  const handleClose = () => {
    if (exporting) return
    onClose()
  }

  const hasClips = project?.tracks.some(t => t.clips.length > 0) ?? false
  const hwLabel = gpuInfo
    ? gpuInfo.type !== 'software' ? `⚡ ${gpuInfo.name}` : '🖥️ Software only'
    : 'Detecting...'
  const isHWCodec = codec === 'h264' || codec === 'h265'
  const is2PassCapable = twoPass && isHWCodec && hardwareAccel === 'software'
  const needsBitrate = codec !== 'prores' && codec !== 'dnxhr'

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: 24, width: 500, maxWidth: '90vw',
          color: 'var(--text-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Export Video</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowQueue(!showQueue)}
              title="Export Queue"
              style={{
                background: showQueue ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none', color: showQueue ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 11, padding: '4px 8px', borderRadius: 4,
              }}
            >
              Queue
            </button>
            <button
              onClick={handleClose}
              disabled={exporting}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: exporting ? 'not-allowed' : 'pointer', fontSize: 18, padding: 0, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Queue view */}
        {showQueue && (
          <ExportQueue onClose={() => setShowQueue(false)} />
        )}

        {!hasClips && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', marginBottom: 16 }}>
            No clips in timeline to export.
          </p>
        )}

        {hasClips && !exporting && !done && !showQueue && (
          <>
            {/* Presets */}
            <Field label="Preset">
              <SelectGroup
                options={Object.keys(EXPORT_PRESETS) as ExportPreset[]}
                value={preset}
                labels={Object.fromEntries(
                  Object.entries(EXPORT_PRESETS).map(([k, v]) => [k, v?.label ?? 'Custom'])
                )}
                onChange={(v) => applyPreset(v as ExportPreset)}
              />
              {EXPORT_PRESETS[preset]?.description && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {EXPORT_PRESETS[preset]!.description}
                </p>
              )}
            </Field>

            {preset === 'custom' && (
              <>
                <Field label="Format">
                  <SelectGroup
                    options={['mp4', 'mov', 'mkv', 'webm']}
                    value={format}
                    onChange={(v) => setFormat(v as ExportSettings['format'])}
                  />
                </Field>

                <Field label="Codec">
                  <SelectGroup
                    options={['h264', 'h265', 'prores', 'vp9', 'av1', 'dnxhr']}
                    value={codec}
                    onChange={(v) => setCodec(v as ExportSettings['codec'])}
                  />
                </Field>
              </>
            )}

            {/* Resolution */}
            <Field label="Resolution">
              <SelectGroup
                options={['source', '4K', '1080p', '720p', '480p']}
                value={resolution}
                onChange={(v) => setResolution(v as ExportSettings['resolution'])}
              />
            </Field>

            {/* Bitrate (if applicable) */}
            {needsBitrate && (
              <Field label={`Bitrate (${bitrate} kbps)`}>
                <input
                  type="range"
                  min={1000}
                  max={80000}
                  step={1000}
                  value={bitrate}
                  onChange={(e) => setBitrate(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>1 Mbps</span>
                  <span>80 Mbps</span>
                </div>
              </Field>
            )}

            {/* Quality / CRF */}
            {!needsBitrate && (
              <Field label="Quality Profile">
                <SelectGroup
                  options={['proxy', 'lt', 'standard', 'hq']}
                  value="standard"
                  labels={{ proxy: 'Proxy', lt: 'LT', standard: 'Standard', hq: 'HQ' }}
                  onChange={() => {}}
                />
              </Field>
            )}

            {isHWCodec && (
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
            )}

            {/* FPS */}
            <Field label="FPS">
              <SelectGroup
                options={['24', '25', '30', '60', '120']}
                value={String(fps)}
                onChange={(v) => setFps(parseInt(v))}
              />
            </Field>

            {/* Hardware Acceleration */}
            <Field label={`Hardware Acceleration (${hwLabel})`}>
              <SelectGroup
                options={['auto', 'software']}
                value={hardwareAccel === 'software' ? 'software' : 'auto'}
                labels={{ auto: 'Auto (GPU)', software: 'Software (CPU)' }}
                onChange={(v) => setHardwareAccel(v as HardwareAccel)}
              />
              {gpuInfo && gpuInfo.type !== 'software' && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  GPU: {gpuInfo.name} ({gpuInfo.type.toUpperCase()})
                </p>
              )}
            </Field>

            {/* 2-Pass encoding */}
            {isHWCodec && hardwareAccel === 'software' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={twoPass}
                  onChange={(e) => setTwoPass(e.target.checked)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  2-Pass Encoding (slower, better quality at same bitrate)
                </span>
              </label>
            )}

            {/* Export button */}
            <button
              onClick={handleExport}
              style={{
                width: '100%', marginTop: 8, padding: '10px 0',
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Export Video
            </button>
          </>
        )}

        {/* Progress */}
        {exporting && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
              Rendering... {Math.round(progress)}%
            </p>
            <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'var(--accent)', borderRadius: 4,
                transition: 'width 0.3s',
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
              {is2PassCapable ? '2-Pass encoding — pass ' + (progress < 50 ? '1' : '2') : 'Encoding...'} Do not close the application
            </p>
            <button
              onClick={handleCancel}
              style={{
                marginTop: 12, padding: '6px 20px',
                background: 'var(--bg-tertiary)', color: '#e74c3c',
                border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel Export
            </button>
          </div>
        )}

        {/* Done */}
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
                padding: '8px 24px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#e74c3c', marginBottom: 8 }}>Export Failed</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                borderRadius: 6, fontSize: 13, cursor: 'pointer',
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
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SelectGroup({
  options, value, onChange, labels,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  labels?: Record<string, string>
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 10px', fontSize: 11,
            background: value === opt ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: value === opt ? '#fff' : 'var(--text-secondary)',
            border: value === opt ? '1px solid var(--accent)' : '1px solid var(--border-color)',
            borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize',
          }}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}
