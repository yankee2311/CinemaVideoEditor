import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import type { VersionInfo } from '../shared/types'

const MAX_VERSIONS = 10

function getVersionsDir(): string {
  const dir = path.join(app.getPath('userData'), 'versions')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getProjectVersionsDir(projectId: string): string {
  const dir = path.join(getVersionsDir(), projectId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function saveVersion(projectId: string, projectData: string): VersionInfo | null {
  try {
    const versionsDir = getProjectVersionsDir(projectId)
    const project = JSON.parse(projectData)
    const version = project.version ?? 1
    const timestamp = new Date().toISOString()
    const versionId = crypto.randomUUID()
    const fileName = `v${version}_${versionId.substring(0, 8)}.cineflow`

    const filePath = path.join(versionsDir, fileName)
    fs.writeFileSync(filePath, projectData, 'utf-8')

    const info: VersionInfo = {
      id: versionId,
      timestamp,
      label: `Version ${version}`,
      fileName,
      version,
    }

    // Keep index file of versions
    const indexPath = path.join(versionsDir, 'index.json')
    let versions: VersionInfo[] = []
    if (fs.existsSync(indexPath)) {
      try {
        versions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      } catch {}
    }
    versions.push(info)
    versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Prune old versions (keep last MAX_VERSIONS)
    if (versions.length > MAX_VERSIONS) {
      const toRemove = versions.slice(MAX_VERSIONS)
      for (const v of toRemove) {
        const p = path.join(versionsDir, v.fileName)
        try { fs.unlinkSync(p) } catch {}
      }
      versions = versions.slice(0, MAX_VERSIONS)
    }

    fs.writeFileSync(indexPath, JSON.stringify(versions, null, 2), 'utf-8')
    return info
  } catch (err) {
    console.error('Failed to save version:', err)
    return null
  }
}

export function listVersions(projectId: string): VersionInfo[] {
  try {
    const versionsDir = getProjectVersionsDir(projectId)
    const indexPath = path.join(versionsDir, 'index.json')
    if (!fs.existsSync(indexPath)) return []
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  } catch {
    return []
  }
}

export function restoreVersion(projectId: string, versionId: string): string | null {
  try {
    const versionsDir = getProjectVersionsDir(projectId)
    const indexPath = path.join(versionsDir, 'index.json')
    if (!fs.existsSync(indexPath)) return null

    const versions: VersionInfo[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    const version = versions.find(v => v.id === versionId)
    if (!version) return null

    const filePath = path.join(versionsDir, version.fileName)
    if (!fs.existsSync(filePath)) return null

    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    console.error('Failed to restore version:', err)
    return null
  }
}
