import { BrowserWindow } from 'electron'
import crypto from 'crypto'
import type { QueueItem, ExportSettings } from '../shared/types'

class ExportQueueManager {
  private queue: QueueItem[] = []
  private active: string | null = null
  private listeners: Set<(queue: QueueItem[]) => void> = new Set()
  // cancellation tokens map
  private cancelled: Set<string> = new Set()

  add(
    projectName: string,
    outputPath: string,
    settings: ExportSettings,
    runFn: (item: QueueItem, onProgress: (p: number) => void) => Promise<void>,
  ): string {
    const id = crypto.randomUUID()
    const item: QueueItem = {
      id,
      projectName,
      outputPath,
      settings,
      status: 'queued',
      progress: 0,
      addedAt: new Date().toISOString(),
    }
    this.queue.push(item)
    this.notify()

    this.processNext(runFn).catch(() => {})

    return id
  }

  cancel(queueId: string): boolean {
    const item = this.queue.find(i => i.id === queueId)
    if (!item) return false
    if (item.status === 'completed' || item.status === 'failed') return false
    this.cancelled.add(queueId)

    if (item.status === 'queued') {
      item.status = 'cancelled'
      this.notify()
      return true
    }
    return true // rendering - cancellation flagged for the export process
  }

  isCancelled(queueId: string): boolean {
    return this.cancelled.has(queueId)
  }

  getQueue(): QueueItem[] {
    return [...this.queue]
  }

  onUpdate(callback: (queue: QueueItem[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notify(): void {
    const snapshot = this.getQueue()
    for (const cb of this.listeners) {
      try { cb(snapshot) } catch {}
    }

    const win = BrowserWindow.getFocusedWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('export:queue-update', snapshot)
    }
  }

  private async processNext(
    runFn: (item: QueueItem, onProgress: (p: number) => void) => Promise<void>,
  ): Promise<void> {
    if (this.active) return // already processing

    const item = this.queue.find(i => i.status === 'queued')
    if (!item) return

    this.active = item.id
    item.status = 'rendering'
    item.progress = 0
    this.notify()

    try {
      await runFn(item, (progress) => {
        // Check cancellation during rendering
        if (this.cancelled.has(item.id)) {
          throw new Error('CANCELLED')
        }
        item.progress = progress
        this.notify()
      })

      if (this.cancelled.has(item.id)) {
        item.status = 'cancelled'
      } else {
        item.status = 'completed'
        item.progress = 100
      }
    } catch (err) {
      if (this.cancelled.has(item.id)) {
        item.status = 'cancelled'
      } else {
        item.status = 'failed'
        item.error = String(err)
      }
    }

    this.cancelled.delete(item.id)
    this.active = null
    this.notify()

    // Process next in queue
    if (this.queue.some(i => i.status === 'queued')) {
      this.processNext(runFn)
    }
  }
}

export const exportQueue = new ExportQueueManager()
