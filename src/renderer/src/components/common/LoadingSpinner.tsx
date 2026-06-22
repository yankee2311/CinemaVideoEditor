import React from 'react'

export default function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
      <div
        style={{
          width: size, height: size,
          border: '2px solid var(--border-color)',
          borderTop: '2px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {label && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>}
    </div>
  )
}
