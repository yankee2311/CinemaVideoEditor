import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'

const AUTOSAVE_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveRef = useRef<string>('')

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const state = useProjectStore.getState()
      const project = state.project
      if (!project) return

      const serialized = state.serializeProject()
      if (serialized === lastSaveRef.current) return
      lastSaveRef.current = serialized

      try {
        const autosaveData = JSON.parse(serialized)
        autosaveData.name = `${autosaveData.name} (autosave)`
        localStorage.setItem('cineflow-autosave', JSON.stringify(autosaveData))
      } catch {}
    }, AUTOSAVE_INTERVAL)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
}

export function checkAutosave(): { project: unknown } | null {
  try {
    const data = localStorage.getItem('cineflow-autosave')
    if (data) {
      const project = JSON.parse(data)
      return { project }
    }
  } catch {}
  return null
}

export function clearAutosave() {
  localStorage.removeItem('cineflow-autosave')
}
