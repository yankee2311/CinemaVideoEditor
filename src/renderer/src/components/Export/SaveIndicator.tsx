import React, { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'

export default function SaveIndicator() {
  const [lastSaveTime, setLastSaveTime] = useState<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const project = useProjectStore((s) => s.project)
  const prevSerialized = useRef<string>('')

  // Track changes
  useEffect(() => {
    if (!project) return
    const serialized = useProjectStore.getState().serializeProject()
    if (prevSerialized.current && serialized !== prevSerialized.current) {
      setIsDirty(true)
    }
    prevSerialized.current = serialized
  }, [project])

  // Update elapsed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastSaveTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastSaveTime])

  // Listen for project saves to reset timer
  useEffect(() => {
    const handleSave = () => {
      setLastSaveTime(Date.now())
      setIsDirty(false)
    }

    // Intercept via the store subscribe
    const unsub = useProjectStore.subscribe((state, prev) => {
      if (state.project?.modifiedAt !== prev.project?.modifiedAt) {
        handleSave()
      }
    })

    return unsub
  }, [])

  const formatElapsed = (seconds: number): string => {
    if (seconds < 0) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const min = Math.floor(seconds / 60)
    if (min < 60) return `${min}m ago`
    const hours = Math.floor(min / 60)
    return `${hours}h ${min % 60}m ago`
  }

  if (!project) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        fontSize: 10,
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)',
        borderRadius: 4,
        userSelect: 'none',
      }}
      title={`Last saved ${formatElapsed(elapsed)}`}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isDirty ? '#f39c12' : '#2ecc71',
          display: 'inline-block',
        }}
      />
      <span>
        {isDirty
          ? `Unsaved · Last save ${formatElapsed(elapsed)}`
          : `Saved ${formatElapsed(elapsed)}`
        }
      </span>
    </div>
  )
}
