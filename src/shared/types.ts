import type { GainPoint } from './audio'
import type { ColorWheelsParams, RGBACurve } from './color'

export type EffectType = 'brightness-contrast' | 'hue-saturation' | 'curves' | 'blur' | 'sharpen' | 'crop' | 'transform-2d' | 'equalizer' | 'compressor' | 'reverb' | 'noise-gate' | 'delay';

export interface EffectDefinition {
  id: string;
  type: EffectType;
  name: string;
  category: 'color' | 'blur' | 'transform' | 'audio';
  params: EffectParam[];
}

export const BUILTIN_EFFECTS: EffectDefinition[] = [
  {
    id: 'brightness-contrast',
    type: 'brightness-contrast',
    name: 'Brightness / Contrast',
    category: 'color',
    params: [
      { name: 'brightness', type: 'number', value: 0, animatable: true, min: -1, max: 1, step: 0.01 },
      { name: 'contrast', type: 'number', value: 0, animatable: true, min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'hue-saturation',
    type: 'hue-saturation',
    name: 'Hue / Saturation',
    category: 'color',
    params: [
      { name: 'hue', type: 'number', value: 0, animatable: true, min: -180, max: 180, step: 1 },
      { name: 'saturation', type: 'number', value: 0, animatable: true, min: -1, max: 1, step: 0.01 },
      { name: 'lightness', type: 'number', value: 0, animatable: true, min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'blur',
    type: 'blur',
    name: 'Gaussian Blur',
    category: 'blur',
    params: [
      { name: 'amount', type: 'number', value: 0, animatable: true, min: 0, max: 50, step: 0.1 },
    ],
  },
  {
    id: 'sharpen',
    type: 'sharpen',
    name: 'Sharpen',
    category: 'blur',
    params: [
      { name: 'amount', type: 'number', value: 0, animatable: true, min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'equalizer',
    type: 'equalizer',
    name: 'Equalizer',
    category: 'audio',
    params: [
      { name: 'band1', type: 'number', value: 0, animatable: true, min: -12, max: 12, step: 0.5 },
      { name: 'band2', type: 'number', value: 0, animatable: true, min: -12, max: 12, step: 0.5 },
      { name: 'band3', type: 'number', value: 0, animatable: true, min: -12, max: 12, step: 0.5 },
      { name: 'band4', type: 'number', value: 0, animatable: true, min: -12, max: 12, step: 0.5 },
      { name: 'band5', type: 'number', value: 0, animatable: true, min: -12, max: 12, step: 0.5 },
    ],
  },
  {
    id: 'compressor',
    type: 'compressor',
    name: 'Compressor',
    category: 'audio',
    params: [
      { name: 'threshold', type: 'number', value: -24, animatable: true, min: -60, max: 0, step: 1 },
      { name: 'ratio', type: 'number', value: 4, animatable: true, min: 1, max: 20, step: 0.5 },
      { name: 'attack', type: 'number', value: 3, animatable: true, min: 0.1, max: 100, step: 0.1 },
      { name: 'release', type: 'number', value: 100, animatable: true, min: 10, max: 1000, step: 10 },
      { name: 'knee', type: 'number', value: 3, animatable: true, min: 0, max: 12, step: 1 },
    ],
  },
  {
    id: 'reverb',
    type: 'reverb',
    name: 'Reverb',
    category: 'audio',
    params: [
      { name: 'decay', type: 'number', value: 2, animatable: true, min: 0.1, max: 10, step: 0.1 },
      { name: 'mix', type: 'number', value: 0.3, animatable: true, min: 0, max: 1, step: 0.01 },
      { name: 'preDelay', type: 'number', value: 20, animatable: true, min: 0, max: 200, step: 1 },
    ],
  },
  {
    id: 'noise-gate',
    type: 'noise-gate',
    name: 'Noise Gate',
    category: 'audio',
    params: [
      { name: 'threshold', type: 'number', value: -40, animatable: true, min: -80, max: 0, step: 1 },
      { name: 'attack', type: 'number', value: 1, animatable: true, min: 0.1, max: 50, step: 0.1 },
      { name: 'release', type: 'number', value: 50, animatable: true, min: 10, max: 500, step: 10 },
      { name: 'hold', type: 'number', value: 10, animatable: true, min: 0, max: 200, step: 1 },
    ],
  },
]

export type TrackType = 'video' | 'audio' | 'text' | 'effect';

export interface MediaAsset {
  id: string;
  filePath: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text';
  duration: number;
  width: number;
  height: number;
  fps: number;
  thumbnailPath?: string;
  proxyPath?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  codec?: string;
}

export interface SpeedKeyframe {
  time: number;
  speed: number;
  interpolation: 'linear' | 'bezier' | 'step';
  easing?: [number, number, number, number];
}

export interface Keyframe {
  id: string;
  time: number;
  value: number;
  interpolation: 'linear' | 'bezier' | 'step';
  easing?: [number, number, number, number];
}

export interface TextClipData {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  textVAlign: 'top' | 'middle' | 'bottom'
  color: string
  strokeColor: string
  strokeWidth: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
  letterSpacing: number
  lineHeight: number
  backgroundColor: string
  backgroundOpacity: number
  padding: number
  borderRadius: number
}

export interface Caption {
  id: string
  start: number
  end: number
  text: string
}

export interface EffectParam {
  name: string;
  type: 'number' | 'color' | 'boolean' | 'select' | 'point';
  value: number | [number, number, number] | boolean | string | [number, number];
  animatable: boolean;
  keyframes?: Keyframe[];
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface Effect {
  id: string;
  name: string;
  type: string;
  params: Record<string, EffectParam>;
  enabled: boolean;
}

export interface Transition {
  type: 'dissolve' | 'fade' | 'wipe' | 'slide' | 'zoom';
  duration: number;
}

export interface Clip {
  id: string;
  name: string;
  mediaId: string;
  trackId: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineDuration: number;
  speed: number;
  speedRamps: SpeedKeyframe[];
  effects: Effect[];
  transform: {
    positionX: number;
    positionY: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    opacity: number;
  };
  transformKeyframes: Record<string, Keyframe[]>;
  transitionIn?: Transition;
  transitionOut?: Transition;
  muted: boolean;
  enabled: boolean;
  color?: string;
  gainEnvelope?: GainPoint[];
  colorWheels?: ColorWheelsParams;
  rgbCurves?: RGBACurve;
  textData?: TextClipData;
  captions?: Caption[];
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  clips: Clip[];
  enabled: boolean;
  locked: boolean;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: Effect[];
  height?: number;
}

export interface ProjectSettings {
  fps: number;
  width: number;
  height: number;
  audioSampleRate: number;
  duration: number;
  basePath: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  settings: ProjectSettings;
  tracks: Track[];
  mediaAssets: MediaAsset[];
  version: number;
}

export type ToolMode = 'select' | 'razor' | 'slip' | 'slide';

export interface Marker {
  id: string;
  time: number;
  duration?: number;
  color: string;
  label: string;
  note?: string;
}

export interface TimelineState {
  currentTime: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  playing: boolean;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  snapEnabled: boolean;
  autoFollowEnabled: boolean;
  isDragging: boolean;
  dragType: 'move' | 'trim-start' | 'trim-end' | 'slip' | 'slide' | 'none';
  toolMode: ToolMode;
  undoStack: string[];
  redoStack: string[];
  markers: Marker[];
}

export const IPC_CHANNELS = {
  IMPORT_MEDIA: 'media:import',
  GET_MEDIA_INFO: 'media:get-info',
  GET_THUMBNAIL: 'media:get-thumbnail',
  EXTRACT_FRAME: 'media:extract-frame',
  SAVE_PROJECT: 'project:save',
  LOAD_PROJECT: 'project:load',
  SHOW_SAVE_DIALOG: 'dialog:save',
  SHOW_OPEN_DIALOG: 'dialog:open',
  EXPORT_VIDEO: 'export:video',
  CANCEL_EXPORT: 'export:cancel',
  GET_EXPORT_QUEUE: 'export:get-queue',
  SYNC_MULTICAM: 'media:sync-multicam',
  MENU_ACTION: 'menu:action',
  GET_WAVEFORM: 'media:get-waveform',
  GET_SYSTEM_FONTS: 'media:get-system-fonts',
  LOAD_LUT: 'media:load-lut',
  GET_SCOPE_DATA: 'media:get-scope-data',
  GENERATE_PROXY: 'media:generate-proxy',
  DETECT_GPU: 'gpu:detect',
  SAVE_VERSION: 'version:save',
  LIST_VERSIONS: 'version:list',
  RESTORE_VERSION: 'version:restore',
} as const;

export interface ImportMediaResult {
  asset: MediaAsset;
  thumbnailPath?: string;
}

// ── Expanded Export Settings ──

export type ExportPreset = 'youtube' | 'tiktok' | 'prores422' | 'dnxhr' | 'h265' | 'av1' | 'vp9' | 'custom';
export type ExportFormat = 'mp4' | 'mov' | 'mkv' | 'webm';
export type ExportCodec = 'h264' | 'h265' | 'prores' | 'vp9' | 'av1' | 'dnxhr';
export type ExportResolution = 'source' | '4K' | '1080p' | '720p' | '480p';
export type HardwareAccel = 'auto' | 'nvenc' | 'amf' | 'videotoolbox' | 'software';

export interface ExportPresetConfig {
  label: string;
  format: ExportFormat;
  codec: ExportCodec;
  bitrate: number; // kbps
  description: string;
  aspectH?: number; // 0 means use source
  aspectV?: number;
}

export const EXPORT_PRESETS: Record<ExportPreset, ExportPresetConfig | null> = {
  youtube: {
    label: 'YouTube',
    format: 'mp4',
    codec: 'h264',
    bitrate: 16000,
    description: 'H.264 16 Mbps — optimized for YouTube upload',
  },
  tiktok: {
    label: 'TikTok / Reels',
    format: 'mp4',
    codec: 'h264',
    bitrate: 6000,
    description: 'H.264 6 Mbps — 9:16 vertical for social media',
    aspectH: 9,
    aspectV: 16,
  },
  prores422: {
    label: 'ProRes 422',
    format: 'mov',
    codec: 'prores',
    bitrate: 0,
    description: 'Apple ProRes 422 — high-quality mezzanine',
  },
  dnxhr: {
    label: 'DNxHR',
    format: 'mov',
    codec: 'dnxhr',
    bitrate: 0,
    description: 'Avid DNxHR — professional post-production',
  },
  h265: {
    label: 'H.265 / HEVC',
    format: 'mp4',
    codec: 'h265',
    bitrate: 12000,
    description: 'H.265/HEVC 12 Mbps — high efficiency',
  },
  av1: {
    label: 'AV1',
    format: 'mkv',
    codec: 'av1',
    bitrate: 8000,
    description: 'AV1 8 Mbps — next-gen royalty-free codec',
  },
  vp9: {
    label: 'WebM VP9',
    format: 'webm',
    codec: 'vp9',
    bitrate: 10000,
    description: 'VP9 10 Mbps — web-optimized',
  },
  custom: null, // user-defined
};

export interface ExportSettings {
  preset: ExportPreset;
  format: ExportFormat;
  codec: ExportCodec;
  resolution: ExportResolution;
  bitrate: number; // kbps, 0 for VBR/CRF only
  fps: number;
  quality: number; // CRF value
  hardwareAccel: HardwareAccel;
  twoPass: boolean;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  preset: 'youtube',
  format: 'mp4',
  codec: 'h264',
  resolution: 'source',
  bitrate: 16000,
  fps: 30,
  quality: 23,
  hardwareAccel: 'auto',
  twoPass: false,
};

// ── GPU Info ──

export interface GPUInfo {
  available: boolean;
  type: HardwareAccel;
  name: string;
}

// ── Export Queue ──

export interface QueueItem {
  id: string;
  projectName: string;
  outputPath: string;
  settings: ExportSettings;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  addedAt: string;
  error?: string;
}

// ── Version History ──

export interface VersionInfo {
  id: string;
  timestamp: string;
  label: string;
  fileName: string;
  version: number;
}

// ── API ──

  export interface CineflowAPI {
    importMedia: () => Promise<ImportMediaResult[]>;
    getMediaInfo: (filePath: string) => Promise<MediaAsset>;
    getThumbnail: (filePath: string, time: number) => Promise<string>;
    extractFrame: (filePath: string, time: number) => Promise<string>;
    extractFrameBase64: (filePath: string, time: number) => Promise<string>;
    saveProject: (data: string) => Promise<boolean>;
    loadProject: () => Promise<string | null>;
    showSaveDialog: (defaultName: string) => Promise<string | null>;
    showOpenDialog: () => Promise<string | null>;
    getMediaUrl: (filePath: string) => string;
    exportVideo: (data: string) => Promise<{ queueId: string } | null>;
    cancelExport: (queueId: string) => Promise<boolean>;
    getExportQueue: () => Promise<QueueItem[]>;
    syncMulticam: (clips: { clipId: string; filePath: string; sourceStart: number; sourceEnd: number }[]) => Promise<{ clipId: string; offset: number; confidence: number }[]>;
    onExportProgress: (callback: (progress: number) => void) => (() => void);
    onMenuAction: (callback: (action: string) => void) => (() => void);
    getWaveform: (filePath: string, startTime: number, duration: number, targetSampleRate?: number) => Promise<{ samples: number[]; sampleRate: number; duration: number }>;
    getSystemFonts: () => Promise<string[]>;
    loadLut: (filePath: string) => Promise<{ id: string; name: string; size: number } | null>;
    getScopeData: (filePath: string, time: number) => Promise<import('./color').ScopeData>;
    generateProxy: (filePath: string) => Promise<string | null>;
    detectGPU: () => Promise<GPUInfo>;
    saveVersion: (data: string) => Promise<boolean>;
    listVersions: () => Promise<VersionInfo[]>;
    restoreVersion: (projectId: string, versionId: string) => Promise<string | null>;
    onExportQueueUpdate: (callback: (queue: QueueItem[]) => void) => (() => void);
  }
