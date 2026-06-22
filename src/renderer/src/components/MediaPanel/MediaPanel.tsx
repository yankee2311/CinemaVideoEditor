import React, { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { MediaAsset } from '@shared/types'

export default function MediaPanel() {
  const { project, addMediaAssets, addClip, timeline, syncMulticam } = useProjectStore()
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const assets = project?.mediaAssets ?? []

  const filteredAssets = searchTerm
    ? assets.filter((a) =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : assets

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const results = await window.cineflow.importMedia()
      if (results.length > 0) {
        addMediaAssets(results.map((r) => r.asset))
      }
    } catch (err) {
      console.error('Import failed:', err)
    }
    setIsImporting(false)
  }

  const handleSyncMulticam = async () => {
    if (!project) return
    const allClips = project.tracks.flatMap(t => t.clips)
    if (allClips.length < 2) return

    setIsSyncing(true)
    try {
      await syncMulticam(allClips.map(c => c.id))
    } catch (err) {
      console.error('Sync failed:', err)
    }
    setIsSyncing(false)
  }

  const handleDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData('text/plain', asset.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const mediaId = e.dataTransfer.getData('text/plain')
    if (mediaId && project) {
      const firstTrack = project.tracks.find((t) => t.type === 'video' || t.type === 'audio')
      if (firstTrack) {
        addClip(mediaId, firstTrack.id, timeline.currentTime)
      }
    }
  }

  const handleDoubleClick = (asset: MediaAsset) => {
    if (project) {
      const firstTrack = project.tracks.find((t) => t.type === 'video' || t.type === 'audio')
      if (firstTrack) {
        addClip(asset.id, firstTrack.id, timeline.currentTime)
      }
    }
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'video':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )
      case 'audio':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )
      case 'image':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f39c12" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Media
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {assets.length} files
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px' }}>
        <input
          type="text"
          placeholder="Search media..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
        />
      </div>

      {/* Import button */}
      <div style={{ padding: '0 8px 6px', display: 'flex', gap: 4 }}>
        <button
          onClick={handleImport}
          disabled={isImporting}
          style={{
            flex: 1,
            padding: '7px 0',
            background: isImporting ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: isImporting ? 'wait' : 'pointer',
            opacity: isImporting ? 0.6 : 1,
            transition: 'background 0.15s ease',
          }}
        >
          {isImporting ? 'Importing...' : 'Import'}
        </button>
        <button
          onClick={handleSyncMulticam}
          disabled={isSyncing || !project || project.tracks.flatMap(t => t.clips).length < 2}
          title="Sync clips by audio waveform"
          style={{
            padding: '7px 12px',
            background: isSyncing ? 'var(--bg-tertiary)' : 'var(--bg-hover)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            fontWeight: 500,
            border: '1px solid #555',
            cursor: isSyncing || !project ? 'not-allowed' : 'pointer',
            opacity: isSyncing || !project ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Assets list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        {filteredAssets.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            {searchTerm
              ? 'No matching files'
              : 'Click "Import Media" to add video, audio, or image files'}
          </div>
        )}

        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            draggable
            onDragStart={(e) => handleDragStart(e, asset)}
            onDoubleClick={() => handleDoubleClick(asset)}
            onMouseEnter={() => setHoveredAsset(asset.id)}
            onMouseLeave={() => setHoveredAsset(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'grab',
              background: hoveredAsset === asset.id ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            {iconForType(asset.type)}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {asset.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                {asset.type === 'video' && (
                  <>
                    <span>{Math.round(asset.duration * 10) / 10}s</span>
                    <span>{asset.width}x{asset.height}</span>
                    <span>{Math.round(asset.fps)}fps</span>
                  </>
                )}
                {asset.type === 'audio' && (
                  <span>{Math.round(asset.duration * 10) / 10}s</span>
                )}
                {asset.type === 'image' && (
                  <span>{asset.width}x{asset.height}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
