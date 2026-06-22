import type { Effect, Track } from '@shared/types'

interface AudioSource {
  clipId: string
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode
  panNode: StereoPannerNode
  buffer: AudioBuffer | null
  startOffset: number
  startTime: number
  muted: boolean
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private masterPan: StereoPannerNode | null = null
  private sources: Map<string, AudioSource> = new Map()
  private analyserNode: AnalyserNode | null = null
  private vuAnalyser: AnalyserNode | null = null
  private vuData: Float32Array | null = null
  private _initialized = false

  get initialized(): boolean {
    return this._initialized
  }

  async init(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterPan = this.ctx.createStereoPanner()
    this.analyserNode = this.ctx.createAnalyser()
    this.analyserNode.fftSize = 256
    this.vuAnalyser = this.ctx.createAnalyser()
    this.vuAnalyser.fftSize = 512
    this.vuData = new Float32Array(this.vuAnalyser.frequencyBinCount)
    this.masterGain.connect(this.masterPan)
    this.masterPan.connect(this.analyserNode)
    this.analyserNode.connect(this.vuAnalyser)
    this.vuAnalyser.connect(this.ctx.destination)
    this._initialized = true
  }

  async loadBuffer(filePath: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null
    try {
      const response = await fetch(`media:///${encodeURI(filePath.replace(/\\/g, '/'))}`)
      const arrayBuffer = await response.arrayBuffer()
      return await this.ctx.decodeAudioData(arrayBuffer)
    } catch {
      return null
    }
  }

  playSource(
    clipId: string,
    filePath: string,
    startOffset: number,
    duration: number,
    speed: number,
    muted: boolean,
    trackVolume: number,
    trackPan: number,
    clipEffects: Effect[],
    trackEffects: Effect[],
  ): void {
    if (!this.ctx || !this.masterGain) return
    this.stopSource(clipId)

    const sourceNode = this.ctx.createBufferSource()
    const gainNode = this.ctx.createGain()
    const panNode = this.ctx.createStereoPanner()

    gainNode.gain.value = muted ? 0 : trackVolume
    panNode.pan.value = trackPan

    let currentInput: AudioNode = sourceNode
    currentInput.connect(gainNode)
    currentInput = gainNode
    currentInput.connect(panNode)
    currentInput = panNode
    currentInput.connect(this.masterGain)

    this.loadBuffer(filePath).then(buffer => {
      if (buffer && this.ctx) {
        sourceNode.buffer = buffer
        sourceNode.playbackRate.value = speed
        const offset = Math.min(startOffset, buffer.duration)
        const dur = Math.min(duration, buffer.duration - offset)
        sourceNode.start(0, offset, dur)
      }
    })

    this.sources.set(clipId, {
      clipId,
      sourceNode,
      gainNode,
      panNode,
      buffer: null,
      startOffset,
      startTime: this.ctx.currentTime,
      muted,
    })
  }

  stopSource(clipId: string): void {
    const src = this.sources.get(clipId)
    if (src?.sourceNode) {
      try { src.sourceNode.stop() } catch { }
    }
    this.sources.delete(clipId)
  }

  stopAll(): void {
    for (const [id] of this.sources) {
      this.stopSource(id)
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  setMasterPan(pan: number): void {
    if (this.masterPan) {
      this.masterPan.pan.value = Math.max(-1, Math.min(1, pan))
    }
  }

  setSourceVolume(clipId: string, volume: number): void {
    const src = this.sources.get(clipId)
    if (src) {
      src.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  setSourcePan(clipId: string, pan: number): void {
    const src = this.sources.get(clipId)
    if (src) {
      src.panNode.pan.value = Math.max(-1, Math.min(1, pan))
    }
  }

  getVUData(): { peak: number; rms: number } {
    if (!this.vuAnalyser || !this.vuData) {
      return { peak: 0, rms: 0 }
    }
    this.vuAnalyser.getFloatTimeDomainData(this.vuData as Float32Array<ArrayBuffer>)
    let sumSq = 0
    let peak = 0
    for (let i = 0; i < this.vuData.length; i++) {
      const sample = Math.abs(this.vuData[i])
      if (sample > peak) peak = sample
      sumSq += sample * sample
    }
    const rms = Math.sqrt(sumSq / this.vuData.length)
    return { peak, rms }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(128)
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(data)
    return data
  }

  getCurrentTime(): number {
    if (!this.ctx) return 0
    return this.ctx.currentTime
  }

  destroy(): void {
    this.stopAll()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
    this._initialized = false
  }
}

export const audioEngine = new AudioEngine()
