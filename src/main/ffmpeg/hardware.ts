import { execSync } from 'child_process'
import os from 'os'
import type { GPUInfo, HardwareAccel } from '../../shared/types'

let cachedGPU: GPUInfo | null = null

function run(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf-8', shell: '/bin/bash' } as any).trim()
  } catch {
    return ''
  }
}

function detectNVIDIA(): GPUInfo | null {
  try {
    let name = run('nvidia-smi --query-gpu=name --format=csv,noheader')
    if (!name) {
      name = run('lspci 2>/dev/null | grep -i nvidia | head -1')
      if (!name) return null
    }
    return { available: true, type: 'nvenc', name }
  } catch {
    return null
  }
}

function detectAMD(): GPUInfo | null {
  try {
    let name = run('rocm-smi --showproductname 2>/dev/null | head -3')
    if (name) {
      const lines = name.split('\n')
      name = lines[1] || 'AMD GPU'
    }
    if (!name || name === 'AMD GPU') {
      name = run('lspci 2>/dev/null | grep -i -E "(radeon|amd.*graphics)" | head -1') || 'AMD GPU'
    }
    return { available: true, type: 'amf', name }
  } catch {
    return null
  }
}

function detectAppleVideoToolbox(): GPUInfo | null {
  if (os.platform() !== 'darwin') return null
  return { available: true, type: 'videotoolbox', name: 'Apple VideoToolbox' }
}

export function detectGPU(): GPUInfo {
  if (cachedGPU) return cachedGPU

  const platform = os.platform()

  if (platform === 'darwin') {
    cachedGPU = detectAppleVideoToolbox()
    if (cachedGPU) return cachedGPU
  }

  const nvidia = detectNVIDIA()
  if (nvidia) {
    cachedGPU = nvidia
    return cachedGPU
  }

  const amd = detectAMD()
  if (amd) {
    cachedGPU = amd
    return cachedGPU
  }

  cachedGPU = { available: false, type: 'software', name: 'CPU (Software)' }
  return cachedGPU
}

// Map hardware acceleration to ffmpeg encoder names
export function getEncoder(
  accel: HardwareAccel,
  codec: 'h264' | 'h265' | 'hevc',
  gpu?: GPUInfo
): { videoCodec: string; options: string[] } {
  const gpuInfo = gpu ?? detectGPU()
  const resolvedAccel: HardwareAccel = accel === 'auto' ? gpuInfo.type : accel

  if (resolvedAccel === 'nvenc') {
    if (codec === 'h265' || codec === 'hevc') {
      return {
        videoCodec: 'hevc_nvenc',
        options: ['-preset p4', '-tune hq', '-rc vbr'],
      }
    }
    return {
      videoCodec: 'h264_nvenc',
      options: ['-preset p4', '-tune hq', '-rc vbr'],
    }
  }

  if (resolvedAccel === 'amf') {
    if (codec === 'h265' || codec === 'hevc') {
      return {
        videoCodec: 'hevc_amf',
        options: ['-usage transcoding', '-quality quality'],
      }
    }
    return {
      videoCodec: 'h264_amf',
      options: ['-usage transcoding', '-quality quality'],
    }
  }

  if (resolvedAccel === 'videotoolbox') {
    if (codec === 'h265' || codec === 'hevc') {
      return {
        videoCodec: 'hevc_videotoolbox',
        options: ['-allow_sw 1', '-realtime 0'],
      }
    }
    return {
      videoCodec: 'h264_videotoolbox',
      options: ['-allow_sw 1', '-realtime 0'],
    }
  }

  // Software fallback
  if (codec === 'h265' || codec === 'hevc') {
    return { videoCodec: 'libx265', options: ['-preset fast'] }
  }
  return { videoCodec: 'libx264', options: ['-preset fast'] }
}

export function supportsHardwareAccel(accel: HardwareAccel, gpu?: GPUInfo): boolean {
  const gpuInfo = gpu ?? detectGPU()
  if (accel === 'auto') return gpuInfo.type !== 'software'
  if (accel === 'software') return true // always supports software
  return gpuInfo.type === accel
}

export function clearGPUCache(): void {
  cachedGPU = null
}
