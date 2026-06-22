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

export interface ParametricCurves {
  hueVsHue: CurvePoint[]
  hueVsSat: CurvePoint[]
  lumaVsSat: CurvePoint[]
  hueVsLuma: CurvePoint[]
}

export const DEFAULT_MONO_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

export const DEFAULT_RGBA_CURVE: RGBACurve = {
  master: [...DEFAULT_MONO_CURVE],
  red: [...DEFAULT_MONO_CURVE],
  green: [...DEFAULT_MONO_CURVE],
  blue: [...DEFAULT_MONO_CURVE],
  alpha: [...DEFAULT_MONO_CURVE],
}

export const DEFAULT_PARAMETRIC_CURVES: ParametricCurves = {
  hueVsHue: [...DEFAULT_MONO_CURVE],
  hueVsSat: [...DEFAULT_MONO_CURVE],
  lumaVsSat: [...DEFAULT_MONO_CURVE],
  hueVsLuma: [...DEFAULT_MONO_CURVE],
}

export const DEFAULT_COLOR_WHEELS: ColorWheelsParams = {
  shadows: [0, 0],
  midtones: [0, 0],
  highlights: [0, 0],
  intensity: 50,
}

export interface PrimaryColorParams {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  saturation: number
  temperature: number
  tint: number
}

export const DEFAULT_PRIMARY_COLOR: PrimaryColorParams = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
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
