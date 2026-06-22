import React from 'react'

export interface ContextMenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  x: number
  y: number
  onClose: () => void
}

export default function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32)

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: adjustedX, top: adjustedY,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: '4px 0', zIndex: 10000, minWidth: 180,
      }}
    >
      {items.map((item, i) => (
        item.divider ? (
          <div key={i} style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
        ) : (
          <button
            key={i}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
            disabled={item.disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 12px', fontSize: 12,
              background: 'transparent', color: item.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
              border: 'none', cursor: item.disabled ? 'default' : 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        )
      ))}
    </div>
  )
}
