import React, { useState, useEffect } from 'react'
import type { QueueItem } from '@shared/types'

interface Props {
  onClose: () => void
}

export default function ExportQueue({ onClose }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([])

  useEffect(() => {
    // Load existing queue
    window.cineflow.getExportQueue().then(setQueue).catch(() => {})

    // Subscribe to updates
    const cleanup = window.cineflow.onExportQueueUpdate((updatedQueue) => {
      setQueue(updatedQueue)
    })

    return () => { cleanup() }
  }, [])

  const handleCancel = async (itemId: string) => {
    await window.cineflow.cancelExport(itemId)
  }

  const getStatusIcon = (status: QueueItem['status']): string => {
    switch (status) {
      case 'queued': return '⏳'
      case 'rendering': return '🔄'
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'cancelled': return '🚫'
    }
  }

  const getStatusColor = (status: QueueItem['status']): string => {
    switch (status) {
      case 'queued': return '#f39c12'
      case 'rendering': return '#3498db'
      case 'completed': return '#2ecc71'
      case 'failed': return '#e74c3c'
      case 'cancelled': return '#95a5a6'
    }
  }

  if (queue.length === 0) {
    return (
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600 }}>Export Queue</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
            ×
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          Queue is empty
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600 }}>
          Export Queue ({queue.length})
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
          ×
        </button>
      </div>

      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {queue.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 10px',
              marginBottom: 6,
              background: 'var(--bg-secondary)',
              borderRadius: 4,
              border: `1px solid ${getStatusColor(item.status)}33`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{getStatusIcon(item.status)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.projectName}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {item.settings.preset !== 'custom' ? item.settings.preset.toUpperCase() : item.settings.codec.toUpperCase()}
                  {' · '}{item.settings.resolution !== 'source' ? item.settings.resolution : 'Source'}
                  {item.settings.bitrate > 0 && ` · ${item.settings.bitrate / 1000} Mbps`}
                  {item.settings.twoPass && ' · 2-Pass'}
                  {item.settings.hardwareAccel !== 'software' && ` · HW`}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                {item.status === 'rendering' && (
                  <div style={{ width: 60 }}>
                    <div style={{ width: '100%', height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${item.progress}%`, height: '100%',
                        background: 'var(--accent)', borderRadius: 2,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                      {Math.round(item.progress)}%
                    </div>
                  </div>
                )}
                {(item.status === 'queued' || item.status === 'rendering') && (
                  <button
                    onClick={() => handleCancel(item.id)}
                    style={{
                      padding: '2px 8px', fontSize: 10,
                      background: 'none', color: '#e74c3c',
                      border: '1px solid #e74c3c33', borderRadius: 3, cursor: 'pointer',
                    }}
                    title="Cancel"
                  >
                    ✕
                  </button>
                )}
                {item.status === 'failed' && item.error && (
                  <span title={item.error} style={{ fontSize: 10, color: '#e74c3c', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.error}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
