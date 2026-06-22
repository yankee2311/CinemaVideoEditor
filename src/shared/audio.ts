export interface EqualizerBand {
  freq: number
  gain: number
  q: number
}

export interface CompressorParams {
  threshold: number
  ratio: number
  attack: number
  release: number
  knee: number
}

export interface ReverbParams {
  decay: number
  mix: number
  preDelay: number
}

export interface NoiseGateParams {
  threshold: number
  attack: number
  release: number
  hold: number
}

export interface DelayParams {
  delay: number
  feedback: number
  mix: number
}

export interface AudioEffect {
  id: string
  type: 'equalizer' | 'compressor' | 'reverb' | 'noise-gate' | 'delay'
  enabled: boolean
  params: EqualizerBand[] | CompressorParams | ReverbParams | NoiseGateParams | DelayParams
}

export interface GainPoint {
  time: number
  gain: number
  interpolation: 'linear' | 'bezier' | 'step'
  easing?: [number, number, number, number]
}

export interface AudioMeterData {
  peak: number
  rms: number
}
