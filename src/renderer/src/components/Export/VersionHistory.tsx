import React, { useState, useEffect } from 'react'
import type { VersionInfo, Project } from '@shared/types'
import { useProjectStore } from '@/store/projectStore'

interface Props {
  projectId: string
  onClose: () => void
}

export default function VersionHistory({ projectId, onClose }: Props) {
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadProject = useProjectStore((s) => s.loadProject)

  useEffect(() => {
    window.cineflow.listVersions(projectId)
      .then((v) => {
        setVersions(v)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load version history')
        setLoading(false)
      })
  }, [projectId])

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId)
    setError(null)
    try {
      const data = await window.cineflow.restoreVersion(projectId, versionId)
      if (data) {
        const project: Project = JSON.parse(data)
        loadProject(project)
        onClose()
      } else {
        setError('Version not found')
      }
    } catch {
      setError('Failed to restore version')
    }
    setRestoring(null)
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading version history...
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: 24, width: 420, maxWidth: '90vw',
          color: 'var(--text-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Version History</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>{error}</p>
        )}

        {versions.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No saved versions yet. Save your project to create versions.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {versions.map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{v.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(v.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(v.id)}
                  disabled={restoring === v.id}
                  style={{
                    padding: '5px 14px', fontSize: 12,
                    background: restoring === v.id ? 'var(--bg-secondary)' : 'var(--accent)',
                    color: '#fff', border: 'none', borderRadius: 4,
                    cursor: restoring === v.id ? 'default' : 'pointer',
                  }}
                >
                  {restoring === v.id ? '...' : 'Restore'}
                </button>
              </div>
            ))}
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
              Last {versions.length} versions are kept. Older versions are automatically pruned.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
