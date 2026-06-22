import React from 'react'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastItem['type'], duration?: number) => void
}

const ToastContext = React.createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return React.useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const showToast = React.useCallback((message: string, type: ToastItem['type'] = 'info', duration: number = 3000) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type, duration }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const colors: Record<ToastItem['type'], string> = {
    success: '#2ecc71',
    error: '#e74c3c',
    info: '#3498db',
    warning: '#f39c12',
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 500,
              background: colors[toast.type], color: '#fff',
              borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              cursor: 'pointer', pointerEvents: 'auto',
              maxWidth: 280, animation: 'slideIn 0.2s ease',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
