import React, { useEffect } from 'react'
import MainLayout from '@/components/Layout/MainLayout'
import { PlaybackProvider } from '@/hooks/usePlayback'
import { useProjectStore } from '@/store/projectStore'

export default function App() {
  const { newProject, loadProject, project } = useProjectStore()

  useEffect(() => {
    const handler = (action: string) => {
      switch (action) {
        case 'new':
          newProject('Untitled Project')
          break
        case 'open':
          window.cineflow.loadProject().then((data) => {
            if (data) {
              try {
                loadProject(JSON.parse(data))
              } catch (e) {
                console.error('Failed to parse project:', e)
              }
            }
          })
          break
        case 'save': {
          const state = useProjectStore.getState()
          if (state.project) {
            const json = JSON.stringify(state.project, null, 2)
            window.cineflow.saveProject(json)
          }
          break
        }
        case 'import':
          window.cineflow.importMedia().then((results) => {
            if (results.length > 0) {
              useProjectStore.getState().addMediaAssets(results.map(r => r.asset))
            }
          })
          break
      }
    }

    const cleanup = window.cineflow.onMenuAction(handler)
    return () => { cleanup() }
  }, [newProject, loadProject])

  return (
    <PlaybackProvider>
      <MainLayout />
    </PlaybackProvider>
  )
}
