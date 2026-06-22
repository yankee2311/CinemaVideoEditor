export interface ColorWheelsParams {
  shadows: [number, number]
  midtones: [number, number]
  highlights: [number, number]
  intensity: number
}

export interface CurvePoint {
  x: number
  y: number
}

export interface RGBACurve {
  master: CurvePoint[]
  red: CurvePoint[]
  green: CurvePoint[]
  blue: CurvePoint[]
  alpha: CurvePoint[]
}

export interface LUTData {
  id: string
  name: string
  filePath: string
  data: Float32Array | null
  size: number
}

export interface ScopeData {
  histogram: {
    r: number[]
    g: number[]
    b: number[]
    luma: number[]
  }
  waveform: number[][]
  vectorscope: Array<{ u: number; v: number }>
}
