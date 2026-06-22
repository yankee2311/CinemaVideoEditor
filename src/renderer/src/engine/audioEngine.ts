import type { Effect, Track } from '@shared/types'
import type { EqualizerBand } from '@shared/audio'

// ─── Types ──────────────────────────────────────────────

interface VuMeter {
  analyser: AnalyserNode
  data: Float32Array
  peak: number
  rms: number
}

interface DspChain {
  nodes: AudioNode[]
  inputEndpoint: AudioNode
  outputEndpoint: AudioNode
}

interface AudioSource {
  clipId: string
  trackId: string
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode
  panNode: StereoPannerNode
  buffer: AudioBuffer | null
  startOffset: number
  startTime: number
  muted: boolean
  vuMeter: VuMeter
  dspNodes: AudioNode[]
}

interface DuckingState {
  voiceTrackId: string | null
  threshold: number       // dB level that triggers ducking, default -30
  attenuation: number     // dB to reduce other tracks, default -12
  attack: number          // ms, default 20
  release: number         // ms, default 150
  hold: number            // ms, default 50
  enabled: boolean
  detectorGain: GainNode | null
  detectorAnalyser: AnalyserNode | null
  duckGainNodes: Map<string, GainNode>  // per-track ducking gain nodes
  duckTargets: number      // 0 = no ducking, 1 = full attenuation
  releaseTimer: ReturnType<typeof setTimeout> | null
}

// ─── Audio Engine Class ────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private masterPan: StereoPannerNode | null = null
  private masterAnalyser: AnalyserNode | null = null
  private masterVu: VuMeter | null = null
  private sources: Map<string, AudioSource> = new Map()
  private _initialized = false

  // Track-level DSP chains stored between play calls
  private trackDspChains: Map<string, DspChain> = new Map()

  // Ducking
  private ducking: DuckingState = {
    voiceTrackId: null,
    threshold: -30,
    attenuation: -12,
    attack: 20,
    release: 150,
    hold: 50,
    enabled: false,
    detectorGain: null,
    detectorAnalyser: null,
    duckGainNodes: new Map(),
    duckTargets: 0,
    releaseTimer: null,
  }

  get initialized(): boolean {
    return this._initialized
  }

  // ─── Init / Destroy ──────────────────────────────────

  async init(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext({ sampleRate: 48000 })
    this.masterGain = this.ctx.createGain()
    this.masterPan = this.ctx.createStereoPanner()
    this.masterAnalyser = this.ctx.createAnalyser()
    this.masterAnalyser.fftSize = 2048

    const vuAnalyser = this.ctx.createAnalyser()
    vuAnalyser.fftSize = 512
    this.masterVu = {
      analyser: vuAnalyser,
      data: new Float32Array(vuAnalyser.frequencyBinCount),
      peak: 0,
      rms: 0,
    }

    this.masterGain.connect(this.masterPan)
    this.masterPan.connect(this.masterAnalyser)
    this.masterAnalyser.connect(vuAnalyser)
    vuAnalyser.connect(this.ctx.destination)
    this._initialized = true
  }

  destroy(): void {
    this.stopAll()
    if (this.ducking.releaseTimer) {
      clearTimeout(this.ducking.releaseTimer)
    }
    this.trackDspChains.clear()
    this.ducking.duckGainNodes.clear()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
    this._initialized = false
  }

  // ─── Buffer Loading ──────────────────────────────────

  async loadBuffer(mediaUrl: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null
    try {
      const response = await fetch(mediaUrl)
      const arrayBuffer = await response.arrayBuffer()
      return await this.ctx.decodeAudioData(arrayBuffer)
    } catch {
      return null
    }
  }

  // ─── DSP Effect Builders ─────────────────────────────

  private buildEqualizer(ctx: AudioContext, effects: Effect[]): DspChain | null {
    const eqEffects = effects.filter(e => e.enabled && e.type === 'equalizer')
    if (eqEffects.length === 0) return null
    const eq = eqEffects[0]

    // 5-band parametric-style EQ using peaking filters
    const frequencies = [80, 250, 800, 2500, 8000]
    const qFactors = [0.7, 1.0, 1.0, 1.0, 0.7] // wider Q at extremes

    const bands: BiquadFilterNode[] = []
    let prev: AudioNode | null = null

    for (let i = 0; i < 5; i++) {
      const bandName = `band${i + 1}`
      const gain = (eq.params[bandName]?.value as number) ?? 0

      if (gain !== 0) {
        // Only create band if gain is non-zero
        const filter = ctx.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = frequencies[i]
        filter.Q.value = qFactors[i]
        filter.gain.value = gain
        bands.push(filter)
      }
    }

    if (bands.length === 0) return null

    // Chain them
    for (let i = 0; i < bands.length - 1; i++) {
      bands[i].connect(bands[i + 1])
    }

    return {
      nodes: bands as AudioNode[],
      inputEndpoint: bands[0],
      outputEndpoint: bands[bands.length - 1],
    }
  }

  private buildCompressor(ctx: AudioContext, effects: Effect[]): DspChain | null {
    const compEffects = effects.filter(e => e.enabled && e.type === 'compressor')
    if (compEffects.length === 0) return null
    const comp = compEffects[0]

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = (comp.params.threshold?.value as number) ?? -24
    compressor.ratio.value = (comp.params.ratio?.value as number) ?? 4
    compressor.attack.value = ((comp.params.attack?.value as number) ?? 3) / 1000
    compressor.release.value = ((comp.params.release?.value as number) ?? 100) / 1000
    compressor.knee.value = ((comp.params.knee?.value as number) ?? 3)

    // Makeup gain
    const makeup = ctx.createGain()
    const threshold = (comp.params.threshold?.value as number) ?? -24
    const ratio = (comp.params.ratio?.value as number) ?? 4
    const makeupGainDb = Math.max(0, (-threshold * (1 - 1 / ratio)) / 2)
    makeup.gain.value = Math.pow(10, makeupGainDb / 20)

    compressor.connect(makeup)

    return {
      nodes: [compressor, makeup],
      inputEndpoint: compressor,
      outputEndpoint: makeup,
    }
  }

  private buildReverb(ctx: AudioContext, effects: Effect[]): DspChain | null {
    const revEffects = effects.filter(e => e.enabled && e.type === 'reverb')
    if (revEffects.length === 0) return null
    const rev = revEffects[0]

    const dryGain = ctx.createGain()
    const wetGain = ctx.createGain()
    const mixValue = (rev.params.mix?.value as number) ?? 0.3
    dryGain.gain.value = Math.sqrt(Math.max(0, 1 - mixValue))
    wetGain.gain.value = Math.sqrt(Math.max(0, mixValue))

    // Feedback-delay network to simulate reverb
    const preDelay = ctx.createDelay((rev.params.preDelay?.value as number) ?? 20 / 1000 + 0.1)
    const decay = (rev.params.decay?.value as number) ?? 2
    const decayGain = ctx.createGain()
    decayGain.gain.value = Math.max(0, Math.min(0.95, decay / 10))

    // Create 4 parallel delay lines for richer reverb
    const delays: DelayNode[] = []
    const delayTimes = [0.036, 0.042, 0.053, 0.061]
    for (const dt of delayTimes) {
      const d = ctx.createDelay(0.1)
      d.delayTime.value = dt
      delays.push(d)
    }

    // Create LP filters for each delay line
    const lowpassFilters: BiquadFilterNode[] = []
    for (const d of delays) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 4000
      lp.Q.value = 0.5
      d.connect(lp)
      lowpassFilters.push(lp)
    }

    // Feedback path: mix delays -> decayGain -> back to delays
    const feedbackMix = ctx.createGain()
    feedbackMix.gain.value = 0.25

    // Connect feedback
    for (const lp of lowpassFilters) {
      lp.connect(feedbackMix)
    }
    for (const d of delays) {
      feedbackMix.connect(decayGain).connect(d)
    }

    // Create the input tee node
    const inputGain = ctx.createGain()
    inputGain.gain.value = 1

    // ── Routing ──
    // Dry path: inputGain → dryGain (output endpoint)
    inputGain.connect(dryGain)

    // Wet path: inputGain → preDelay → delays[0] → delay network
    inputGain.connect(preDelay)
    preDelay.connect(delays[0])

    // Each delay line: delay → LP filter → (wetGain + feedbackMix)
    // Note: each delay is already connected to its LP filter above
    for (const lp of lowpassFilters) {
      lp.connect(wetGain)
    }

    // Feedback loop: feedbackMix → decayGain → delays[0]
    // Clear the previous for-loop connections and rewire cleanly
    feedbackMix.disconnect()
    feedbackMix.connect(decayGain)
    decayGain.connect(delays[0])

    // Mix wet into dry output
    wetGain.connect(dryGain)

    return {
      nodes: [inputGain, dryGain, wetGain, preDelay, ...delays, ...lowpassFilters, feedbackMix, decayGain],
      inputEndpoint: inputGain,
      outputEndpoint: dryGain,
    }
  }

  private buildNoiseGate(ctx: AudioContext, effects: Effect[]): DspChain | null {
    const gateEffects = effects.filter(e => e.enabled && e.type === 'noise-gate')
    if (gateEffects.length === 0) return null
    const gate = gateEffects[0]

    // Use DynamicsCompressor as a poor man's noise gate
    // In a real app we'd use AudioWorklet, but DynamicsCompressor can act as expander
    const expander = ctx.createDynamicsCompressor()
    expander.threshold.value = (gate.params.threshold?.value as number) ?? -40
    expander.ratio.value = 0.05 // high expansion ratio = near gate
    expander.attack.value = ((gate.params.attack?.value as number) ?? 1) / 1000
    expander.release.value = ((gate.params.release?.value as number) ?? 50) / 1000
    expander.knee.value = 0

    // Add a gain node to simulate the gate cutoff
    const gateGain = ctx.createGain()
    gateGain.gain.value = 1

    return {
      nodes: [expander, gateGain],
      inputEndpoint: expander,
      outputEndpoint: gateGain,
    }
  }

  /**
   * Build full DSP chain for a track (combining EQ, compressor, reverb, noise gate)
   */
  private buildDspChain(trackId: string, effects: Effect[]): DspChain | null {
    if (!this.ctx) return null

    // Tear down any existing chain for this track
    const existing = this.trackDspChains.get(trackId)
    if (existing) {
      try { existing.inputEndpoint.disconnect() } catch {}
      try { existing.outputEndpoint.disconnect() } catch {}
      this.trackDspChains.delete(trackId)
    }

    if (effects.length === 0) return null

    const ctx = this.ctx
    const allChains: DspChain[] = []

    const eq = this.buildEqualizer(ctx, effects)
    if (eq) allChains.push(eq)

    const comp = this.buildCompressor(ctx, effects)
    if (comp) allChains.push(comp)

    const reverb = this.buildReverb(ctx, effects)
    if (reverb) allChains.push(reverb)

    const gate = this.buildNoiseGate(ctx, effects)
    if (gate) allChains.push(gate)

    if (allChains.length === 0) return null

    // Chain all DSP blocks together
    for (let i = 0; i < allChains.length - 1; i++) {
      allChains[i].outputEndpoint.connect(allChains[i + 1].inputEndpoint)
    }

    const chain: DspChain = {
      nodes: allChains.flatMap(c => c.nodes),
      inputEndpoint: allChains[0].inputEndpoint,
      outputEndpoint: allChains[allChains.length - 1].outputEndpoint,
    }

    this.trackDspChains.set(trackId, chain)
    return chain
  }

  // ─── Ducking System ──────────────────────────────────

  configureDucking(params: {
    voiceTrackId?: string | null
    threshold?: number
    attenuation?: number
    attack?: number
    release?: number
    hold?: number
    enabled?: boolean
  }): void {
    if (params.voiceTrackId !== undefined) this.ducking.voiceTrackId = params.voiceTrackId
    if (params.threshold !== undefined) this.ducking.threshold = params.threshold
    if (params.attenuation !== undefined) this.ducking.attenuation = params.attenuation
    if (params.attack !== undefined) this.ducking.attack = params.attack
    if (params.release !== undefined) this.ducking.release = params.release
    if (params.hold !== undefined) this.ducking.hold = params.hold
    if (params.enabled !== undefined) this.ducking.enabled = params.enabled
  }

  /**
   * Run ducking analysis: reads the voice track's level and adjusts duck gain nodes.
   * Call this on each animation frame.
   */
  tickDucking(): void {
    if (!this.ducking.enabled || !this.ctx) return
    if (!this.ducking.voiceTrackId) return
    if (this.ducking.duckGainNodes.size === 0) return

    // Find the voice track source to read its level
    let voiceLevel = 0
    for (const [, src] of this.sources) {
      if (src.trackId === this.ducking.voiceTrackId) {
        const vu = src.vuMeter
        if (vu) {
          src.vuMeter.analyser.getFloatTimeDomainData(vu.data)
          let sumSq = 0
          for (let i = 0; i < vu.data.length; i++) {
            sumSq += vu.data[i] * vu.data[i]
          }
          const rms = Math.sqrt(sumSq / vu.data.length)
          voiceLevel = Math.max(voiceLevel, rms)
        }
      }
    }

    // Convert to dB
    const levelDb = voiceLevel > 0.000001 ? 20 * Math.log10(voiceLevel) : -120

    if (levelDb > this.ducking.threshold) {
      // Voice detected — duck
      const targetLinear = Math.pow(10, this.ducking.attenuation / 20)
      const attackSec = this.ducking.attack / 1000

      for (const [, duckGain] of this.ducking.duckGainNodes) {
        duckGain.gain.setTargetAtTime(targetLinear, this.ctx.currentTime, attackSec)
      }
      this.ducking.duckTargets = targetLinear

      // Reset hold timer
      if (this.ducking.releaseTimer) {
        clearTimeout(this.ducking.releaseTimer)
        this.ducking.releaseTimer = null
      }
    } else if (this.ducking.duckTargets < 1 && !this.ducking.releaseTimer) {
      // Below threshold — schedule release after hold
      this.ducking.releaseTimer = setTimeout(() => {
        this.ducking.releaseTimer = null
        const releaseSec = this.ducking.release / 1000
        for (const [, duckGain] of this.ducking.duckGainNodes) {
          if (this.ctx) {
            duckGain.gain.setTargetAtTime(1, this.ctx.currentTime, releaseSec)
          }
        }
        this.ducking.duckTargets = 1
      }, this.ducking.hold)
    }
  }

  /**
   * Register a ducking gain node for a non-voice track
   */
  private registerDuckNode(trackId: string, gainNode: GainNode): void {
    if (this.ducking.voiceTrackId && trackId !== this.ducking.voiceTrackId) {
      this.ducking.duckGainNodes.set(trackId, gainNode)
    }
  }

  // ─── Playback ────────────────────────────────────────

  playSource(
    clipId: string,
    filePath: string,
    sourceStart: number,
    sourceEnd: number,
    speed: number,
    trackId: string,
    options?: {
      volume?: number
      pan?: number
      muted?: boolean
      solo?: boolean
      hasAnySolo?: boolean
      effects?: Effect[]
    },
  ): void {
    if (!this.ctx || !this.masterGain) return
    this.stopSource(clipId)

    const opts = options ?? {}
    const trackVolume = opts.volume ?? 1
    const trackPan = opts.pan ?? 0
    const isMuted = opts.muted ?? false
    const trackEffects = opts.effects ?? []

    // Solo logic: if any track has solo, non-solo tracks are silenced
    let effectiveMuted = isMuted
    if (opts.hasAnySolo && !opts.solo) {
      effectiveMuted = true
    }

    const sourceNode = this.ctx.createBufferSource()
    const gainNode = this.ctx.createGain()
    const panNode = this.ctx.createStereoPanner()

    gainNode.gain.value = effectiveMuted ? 0 : trackVolume
    panNode.pan.value = trackPan

    // Create per-source VU meter
    const vuAnalyser = this.ctx.createAnalyser()
    vuAnalyser.fftSize = 512
    const vu: VuMeter = {
      analyser: vuAnalyser,
      data: new Float32Array(vuAnalyser.frequencyBinCount),
      peak: 0,
      rms: 0,
    }

    // Build DSP chain from track effects
    const dspChain = this.buildDspChain(trackId, trackEffects)
    const dspNodes: AudioNode[] = dspChain ? [...dspChain.nodes] : []

    // Wire audio graph: source -> dsp chain -> gain -> duck gain -> pan -> vu -> master
    let lastNode: AudioNode = sourceNode

    if (dspChain) {
      lastNode.connect(dspChain.inputEndpoint)
      lastNode = dspChain.outputEndpoint
    }

    // Ducking gain node (inserted between dsp output and main gain)
    const duckGain = this.ctx.createGain()
    duckGain.gain.value = 1
    this.registerDuckNode(trackId, duckGain)
    dspNodes.push(duckGain)

    lastNode.connect(duckGain)
    duckGain.connect(gainNode)
    gainNode.connect(panNode)
    panNode.connect(vuAnalyser)
    vuAnalyser.connect(this.masterGain)

    const duration = sourceEnd - sourceStart
    this.loadBuffer(filePath).then(buffer => {
      if (buffer && this.ctx) {
        sourceNode.buffer = buffer
        sourceNode.playbackRate.value = speed
        const offset = Math.min(sourceStart, buffer.duration)
        const dur = Math.min(duration, buffer.duration - offset)
        sourceNode.start(0, offset, dur)
      }
    })

    this.sources.set(clipId, {
      clipId,
      trackId,
      sourceNode,
      gainNode,
      panNode,
      buffer: null,
      startOffset: sourceStart,
      startTime: this.ctx.currentTime,
      muted: effectiveMuted,
      vuMeter: vu,
      dspNodes,
    })
  }

  stopSource(clipId: string): void {
    const src = this.sources.get(clipId)
    if (src) {
      if (src.sourceNode) {
        try { src.sourceNode.stop() } catch {}
      }
      // Clean up DSP nodes
      for (const node of src.dspNodes) {
        try { node.disconnect() } catch {}
      }
      this.sources.delete(clipId)
    }
  }

  stopAll(): void {
    for (const [id] of this.sources) {
      this.stopSource(id)
    }
    this.trackDspChains.clear()
    this.ducking.duckGainNodes.clear()
  }

  // ─── Master Controls ─────────────────────────────────

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

  // ─── Source Controls ─────────────────────────────────

  setSourceVolume(clipId: string, volume: number): void {
    const src = this.sources.get(clipId)
    if (src) {
      src.gainNode.gain.value = Math.max(0, Math.min(2, volume))
    }
  }

  setSourcePan(clipId: string, pan: number): void {
    const src = this.sources.get(clipId)
    if (src) {
      src.panNode.pan.value = Math.max(-1, Math.min(1, pan))
    }
  }

  // ─── Meters ──────────────────────────────────────────

  getVUData(): { peak: number; rms: number } {
    if (!this.masterVu) return { peak: 0, rms: 0 }
    this.masterVu.analyser.getFloatTimeDomainData(this.masterVu.data)
    let sumSq = 0
    let peak = 0
    for (let i = 0; i < this.masterVu.data.length; i++) {
      const sample = Math.abs(this.masterVu.data[i])
      if (sample > peak) peak = sample
      sumSq += sample * sample
    }
    const rms = Math.sqrt(sumSq / this.masterVu.data.length)
    this.masterVu.peak = peak
    this.masterVu.rms = rms
    return { peak, rms }
  }

  /**
   * Get VU data for a specific source's output (post-dsp, pre-master)
   */
  getSourceVUData(clipId: string): { peak: number; rms: number } {
    const src = this.sources.get(clipId)
    if (!src) return { peak: 0, rms: 0 }
    const vu = src.vuMeter
    vu.analyser.getFloatTimeDomainData(vu.data)
    let sumSq = 0
    let peak = 0
    for (let i = 0; i < vu.data.length; i++) {
      const sample = Math.abs(vu.data[i])
      if (sample > peak) peak = sample
      sumSq += sample * sample
    }
    const rms = Math.sqrt(sumSq / vu.data.length)
    vu.peak = peak
    vu.rms = rms
    return { peak, rms }
  }

  /**
   * Get VU data for a track by aggregating its active sources
   */
  getTrackVUData(trackId: string): { peak: number; rms: number } {
    let totalPeak = 0
    let totalRms = 0
    let count = 0
    for (const [, src] of this.sources) {
      if (src.trackId !== trackId) continue
      const data = this.getSourceVUData(src.clipId)
      totalPeak = Math.max(totalPeak, data.peak)
      totalRms += data.rms
      count++
    }
    return { peak: totalPeak, rms: count > 0 ? totalRms / count : 0 }
  }

  getFrequencyData(): Uint8Array {
    if (!this.masterAnalyser) return new Uint8Array(128)
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount)
    this.masterAnalyser.getByteFrequencyData(data)
    return data
  }

  getCurrentTime(): number {
    if (!this.ctx) return 0
    return this.ctx.currentTime
  }

  // ─── Real-time parameter update ──────────────────────

  /**
   * Update EQ band gain in real-time (for per-source DSP chains)
   */
  updateSourceEq(clipId: string, effects: Effect[]): void {
    const src = this.sources.get(clipId)
    if (!src || !this.ctx) return

    const eq = effects.find(e => e.enabled && e.type === 'equalizer')
    if (!eq) return

    // Find biquad filters in dspNodes
    const biquads = src.dspNodes.filter(n => n instanceof BiquadFilterNode) as BiquadFilterNode[]
    if (biquads.length === 0) return

    for (let i = 0; i < Math.min(5, biquads.length); i++) {
      const gain = (eq.params[`band${i + 1}`]?.value as number) ?? 0
      biquads[i].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01)
    }
  }
}

export const audioEngine = new AudioEngine()
