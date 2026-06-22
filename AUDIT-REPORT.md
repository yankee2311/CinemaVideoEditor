# CineFlow — Informe de Auditoría de Integración End-to-End

> **Auditor:** Subagente de Auditoría Senior
> **Fecha:** 2026-06-22
> **Proyecto:** CineFlow v0.1.0 (CinemaVideoEditor)

---

## Tabla Resumen

| # | Feature | Estado | Preview | Export |
|---|---------|--------|---------|--------|
| 1 | Importar video | ✅ Funciona | ✅ | N/A |
| 2 | Agregar clip al timeline | ✅ Funciona | ✅ | N/A |
| 3 | Reproducir el timeline | ⚠️ Parcial | ⚠️ Solo raw video | N/A |
| 4 | Efecto de color (brightness) | ⚠️ Parcial | ❌ Sin feedback visual | ✅ |
| 5 | Corrección de color primaria | ⚠️ Parcial | ❌ Sin feedback visual | ✅ |
| 6 | Ajustar audio en mixer | ❌ Roto | ❌ AudioEngine nunca se inicia | ✅ |
| 7 | Exportar video | ✅ Funciona | N/A | ✅ Casi todo |
| 8 | Aplicar transición | ⚠️ Parcial | ❌ Sin feedback visual | ✅ |
| 9 | Aplicar LUT | ⚠️ Parcial | ❌ Sin feedback visual | ✅ |
| 10 | Keyframes de transformación | ❌ Roto | ❌ Sin animación | ❌ No incluidos |

**Resumen:** 2 ✅ · 5 ⚠️ · 3 ❌

---

## 1. Importar un Video

**Estado:** ✅ Funciona

**Flujo completo:**
```
MediaPanel.tsx → window.cineflow.importMedia()
  → IPC 'media:import' → dialog.showOpenDialog (multiselect)
    → probeMedia (ffprobe) por cada archivo
    → extractThumbnail (ffmpeg screenshot) para thumbnails
    → Auto proxy generation para 4K/8K
    → Retorna ImportMediaResult[] → addMediaAssets() → Store
```

**Lo que SÍ funciona:**
- El diálogo nativo de Electron abre filtros correctos (mp4, mov, avi, etc.)
- ffprobe extrae metadata precisa: duración, resolución, fps, codec, canales de audio
- Se genera thumbnail vía ffmpeg screenshots (320px width)
- Los assets aparecen en el MediaPanel con iconos por tipo y metadata
- Generación automática de proxies para media 4K/8K (setImmediate, async)

**Posibles riesgos:**
- Archivo: `src/main/ipc/index.ts:60` — `setImmediate` para proxy generation no garantiza que el proxy esté listo cuando se arrastra al timeline; se necesita un mecanismo de fallback si se usa antes.
- Si ffprobe falla para un archivo, ese archivo se pierde silenciosamente (catch en línea 68 solo loguea).
- Los thumbnails se guardan en `/tmp/cineflow/` — podrían acumularse si no se llaman `cleanupTempFiles()`.

**Eslabón más débil:** Ninguno crítico. La feature funciona end-to-end.

---

## 2. Agregar Clip al Timeline

**Estado:** ✅ Funciona

**Flujo completo:**
```
Dos vías de entrada:

Vía 1 — Drag & Drop desde MediaPanel:
  MediaPanel.handleDragStart → dataTransfer.setData('text/plain', asset.id)
  Timeline.handleDrop → getTimeAtX + targetTrack → addClip(mediaId, trackId, dropTime)

Vía 2 — Doble click en MediaPanel:
  MediaPanel.handleDoubleClick → addClip(asset.id, firstTrack.id, timeline.currentTime)

Ambas vías → Store.addClip():
  - Busca el MediaAsset por mediaId
  - Crea un nuevo Clip con sourceStart:0, sourceEnd:duration, transform defaults
  - Inserta en track.clips[]
```

**Lo que SÍ funciona:**
- Timeline renderiza el clip vía Canvas 2D: rectángulo con color, nombre, badget de velocidad
- Waveform visualization para clips de audio (vía useWaveformCache → IPC get-waveform)
- Selección visual (borde highlight + handles de trim)
- Badge de velocidad, indicadores de keyframes (diamantes amarillos), overlay de transition out

**Posibles riesgos:**
- `src/renderer/src/components/MediaPanel/MediaPanel.tsx:55-60` — handleDragStart usa solo `text/plain`, sin `application/x-cineflow-clip` o tipo custom; podría interferir con otros drag sources.
- El drop en MediaPanel mismo (línea 56-64) siempre asigna al `firstTrack` — puede poner audio en track de video y viceversa.

**Eslabón más débil:** Ninguno crítico. Funciona correctamente.

---

## 3. Reproducir el Timeline

**Estado:** ⚠️ Parcial

**Flujo completo:**
```
Toolbar → usePlayback.togglePlay() → setPlaying(true)
  → usePlayback inicia rAF loop (tick)
    → setCurrentTime(time + delta)
    → Llama getMaxTime() para detectar fin de timeline
    → Auto-stop al llegar al final

PreviewPanel reacciona a timeline.playing === true:
  → Encuentra clip activo (getClipAtTime)
  → video.src = window.cineflow.getMediaUrl(asset.filePath)
  → video.currentTime = sourceTime (ajustado por speed)
  → video.playbackRate = clip.speed
  → video.muted = clip.muted
  → video.play()
```

**Lo que SÍ funciona:**
- La reproducción via rAF avanza el playhead correctamente
- Auto-follow del playhead en el Timeline (cuando `autoFollowEnabled`)
- El `<video>` nativo reproduce el video con cambio de velocidad
- Scrubbing vía click en timeline + debounced frame extraction vía ffmpeg (`extractFrameAsBase64`)
- Frame cache (Map, hasta 50 entries) para scrubbing rápido
- Preview muestra png extraído cuando está pausado, video nativo cuando está en play

**⚠️ Dónde se rompe:**
- **El preview NUNCA muestra efectos de color, LUTs, correcciones, ni transformaciones.** El `<video>` element solo reproduce el archivo fuente crudo. No hay pipeline de renderizado WebGL/Canvas que aplique filtros en tiempo real.
- **Archivo:** `src/renderer/src/components/Preview/PreviewPanel.tsx:118-146` — `video.src = mediaUrl` reproduce el archivo original sin modificaciones.
- **El audio del preview viene directamente del elemento `<video>`**, no del `audioEngine`. Por lo tanto, los ajustes del mixer (EQ, compresor, reverb, volumen, paneo) NO se escuchan durante la reproducción.
- **No hay sincronización precisa entre el rAF y el video** — el `currentTime` del store avanza por rAF, mientras el video avanza por su propio clock. Puede desincronizarse.

**Qué falta para que funcione completo:**
1. Pipeline de renderizado WebGL/Canvas 2D que:
   - Decodifique frames del video vía `requestVideoFrameCallback` o ffmpeg
   - Aplique filtros (brightness, contrast, hue, blur, sharpen) vía shaders GLSL
   - Aplique LUTs como lookup textures 3D
   - Aplique correcciones de color (curves, color wheels) vía shaders
   - Renderice transformaciones (scale, rotate, position, opacity)
2. Integrar `audioEngine.init()` + `audioEngine.playSource()` en el PreviewPanel para que el audio pase por la cadena DSP durante playback.
3. Sincronización frame-accurate entre el reloj de playback y el video (usar `video.currentTime` como source of truth en lugar de rAF independiente).

---

## 4. Aplicar un Efecto de Color (ej: brightness)

**Estado:** ⚠️ Parcial (❌ Preview, ✅ Export)

**Flujo UI→Store:**
```
EffectsPanel click en "Brightness / Contrast" → addEffect(clipId, 'brightness-contrast')
  → Store: crea Effect { id, type, enabled:true, params: { brightness, contrast } }
  → Se agrega a clip.effects[]

EffectsPanel slider "brightness" → updateEffectParam(clipId, effectId, 'brightness', value)
  → Store: actualiza effect.params.brightness.value
```

**Export (✅ funciona):**
```
IPC 'export:video' → construye ExportClipInfo[] con clip.effects
  → exportSingleClip / exportMultiClips
    → buildEffectsFilter(effects)
      → brightness-contrast → ffmpeg eq=brightness=X:contrast=Y
      → hue-saturation → ffmpeg hue + eq
      → blur → ffmpeg gblur
      → sharpen → ffmpeg unsharp
```

**Preview (❌ roto):**
- **NO hay conexión entre el store de efectos y el PreviewPanel.** El `<video>` element no lee `clip.effects`.
- **Archivo:** `src/renderer/src/components/Preview/PreviewPanel.tsx` — no hay ninguna referencia a `clip.effects`, `clip.primaryColor`, ni a ningún pipeline de filtros.
- **Archivo:** `src/renderer/src/engine/timelineEngine.ts` — solo tiene funciones de utilidad (timeToString, timeToPixels), no engine de renderizado.

**Qué falta para que funcione:**
- Preview rendering engine (WebGL/Canvas) que lea `clip.effects` y aplique los filtros equivalentes en tiempo real.
- Mapeo completo de efectos: brightness-contrast → shader, hue-saturation → shader, blur → shader, sharpen → shader.

---

## 5. Aplicar Corrección de Color Primaria (exposure, contrast, etc.)

**Estado:** ⚠️ Parcial (❌ Preview, ✅ Export)

**Flujo UI→Store:**
```
ColorPanel PrimaryTab → slider "Exposure" → setPrimaryColor(clipId, { exposure: 0.5 })
  → Store: clip.primaryColor = { exposure: 0.5, contrast: 0, ... }
```

**Export (✅ funciona):**
```
ffmpeg/index.ts → buildPrimaryColorFilter(primaryColor):
  - exposure → eq=brightness (mapeado -5..5 → -1..1)
  - contrast → eq=contrast (1 + contrast)
  - saturation → eq=saturation (1 + saturation * 2)
  - blacks → eq=gamma
  - highlights/shadows/whites → colorbalance (rs, gs, bs, rh, gh, bh, rm, gm, bm)
  - temperature → ajusta red/blue balance
  - tint → ajusta green/red balance
```

**Preview (❌ roto):**
- Mismo problema que #4: no hay pipeline de renderizado.
- **Archivo:** `src/renderer/src/components/Preview/PreviewPanel.tsx` — no lee `clip.primaryColor`.

**Color Wheels (⚠️ ) y Curves (⚠️ ):**
- Color wheels: `setColorWheels(clipId, { shadows: [dy, dx], ... })` → Store → export vía `buildColorWheelsFilter()` → ffmpeg `colorbalance`. Preview: ❌
- RGB Curves: `setRGBCurves(clipId, curves)` → Store → export vía `buildCurvesFilter()` → ffmpeg `curves=`. Preview: ❌

**Qué falta:**
- Shaders GLSL que repliquen: exposure, contrast, saturation, color balance, temperature/tint.
- WebGL implementation de color wheels (lift/gamma/gain con máscaras de luminancia).
- WebGL implementation de curves lookup (usando 1D texture LUT por canal).

---

## 6. Ajustar Audio en el Mixer

**Estado:** ❌ Roto (audio engine nunca se inicia)

**Flujo UI→Store (✅):**
```
MixerPanel → setTrackVolume(trackId, 0.8) → Store: track.volume = 0.8
MixerPanel → setTrackPan(trackId, 0.5) → Store: track.pan = 0.5
MixerPanel → setTrackMuted(trackId, true) → Store: track.muted = true
MixerPanel → setTrackSolo(trackId, true) → Store: track.solo = true
MixerPanel → addTrackEffect(trackId, 'equalizer') → Store: track.effects.push(eq)
MixerPanel → updateTrackEffectParam(trackId, effectId, 'band1', 3) → Store
```

**Export (✅ funciona):**
```
IPC 'export:video' → construye ExportClipInfo
  clip.volume → ffmpeg volume=X
  clip.pan → ffmpeg pan=stereo|FL<c0+...|FR<c0+...
  clip.audioEffects → buildAudioEffectsFilter()
    equalizer → anequalizer (5-band parametric)
    compressor → acompressor (threshold, ratio, attack, release, knee + makeup gain)
    reverb → aecho (delay network)
    noise-gate → agate
    delay → aecho
```

**AudioEngine (❌ pero el código existe):**
- `src/renderer/src/engine/audioEngine.ts` — Implementación completa de:
  - `init()` — crea AudioContext, masterGain, masterPan, analysers, VU meter
  - `playSource()` — carga buffer vía `media://`, conecta source→gain→pan→VU→master, con soporte de speed
  - DSP chains: `buildEqualizer()` (5-band biquad peaking), `buildCompressor()` (DynamicsCompressor + makeup gain), `buildReverb()` (feedback delay network), `buildNoiseGate()` (DynamicsCompressor expander)
  - Ducking system con detector de nivel, attack/release/hold
  - `tickDucking()` — llamado por MixerPanel cada rAF
  - VU meters por source y master
  - Real-time parameter updates (`updateSourceEq`)

**Dónde se rompe exactamente:**
1. **`audioEngine.init()` NUNCA es llamado.** No hay ningún componente que llame `audioEngine.init()`. El AudioContext nunca se crea. Archivo: búsqueda `grep -rn "audioEngine.init"` → 0 resultados.
2. **`audioEngine.playSource()` NUNCA es llamado.** El PreviewPanel usa `<video>` nativo para audio. Archivo: `PreviewPanel.tsx:128` — `video.muted = clip.muted` y `video.play()` usan el audio del elemento HTML, no del audioEngine.
3. Los **VU meters del MixerPanel solo leen datos si `audioEngine.initialized`** (línea 143 y 297 de MixerPanel.tsx), pero como nunca se inicializa, siempre muestran vacío.
4. El **ducking tick corre en un rAF**, pero sin AudioContext inicializado, `tickDucking()` retorna inmediatamente sin hacer nada (línea 397 de audioEngine.ts: `if (!this.ctx) return`).

**Qué falta:**
1. Llamar `audioEngine.init()` al montar el proyecto (App.tsx o PlaybackProvider).
2. En PreviewPanel, cuando `timeline.playing === true`, llamar `audioEngine.playSource()` para cada clip activo con sus parámetros de track (volume, pan, effects).
3. Llamar `audioEngine.stopAll()` al pausar.
4. Sincronizar el tiempo de audio con el playhead (usar `audioEngine.getCurrentTime()` como clock maestro).
5. Silenciar el elemento `<video>` (`video.muted = true`) y usar audioEngine como única fuente de audio.

---

## 7. Exportar Video

**Estado:** ✅ Funciona

**Flujo completo:**
```
Toolbar "Export" → ExportDialog
  → Selección de preset/codec/resolución/FPS/hardware/quality
  → handleExport() → window.cineflow.exportVideo(JSON.stringify({ project, settings }))

IPC 'export:video':
  1. Itera tracks y clips, construye ExportClipInfo[] con:
     - effects (video) → ExportEffectInfo[]
     - audioEffects (track + clip mergeados)
     - transitionIn/Out, volume, pan, primaryColor, colorWheels, rgbCurves, appliedLutPath, transform
  2. dialog.showSaveDialog → output path
  3. exportQueue.add() → processNext()

ffmpeg/index.ts → exportTimeline():
  - 1 clip → exportSingleClip() con todos los filtros
  - Múltiples clips → exportMultiClips():
    1. Exporta cada clip a temp files (libx264 software)
    2. Si hay transitions: concatWithTransitions (xfade + amix)
    3. Si no hay transitions: concatSimple (concat demuxer)
  - 2-pass encoding opcional (solo software H.264/H.265)
```

**Lo que SÍ se incluye en el export:**
- ✅ Efectos de video (brightness, contrast, hue, saturation, blur, sharpen, transform-2d)
- ✅ Corrección de color primaria (exposure, contrast, highlights, shadows, whites, blacks, saturation, temperature, tint)
- ✅ Color wheels → colorbalance
- ✅ RGB Curves → curves filter
- ✅ LUTs → lut3d filter
- ✅ Transiciones (dissolve→xfade fade, fade→xfade fadeblack, wipe→xfade wipeleft, slide→xfade slideright, zoom→xfade zoomin)
- ✅ Audio effects (EQ, compressor, reverb, noise gate, delay)
- ✅ Volumen y paneo de track
- ✅ Cambio de velocidad (setpts + atempo)
- ✅ Transform estática (positionX/Y, scaleX/Y, rotation, opacity) vía overlay+scale+rotate+format filters
- ✅ Hardware acceleration: NVENC, AMF, VideoToolbox (auto-detect), software fallback
- ✅ Múltiples formatos: MP4, MOV, MKV, WebM
- ✅ Codecs: H.264, H.265, ProRes, DNxHR, AV1, VP9
- ✅ Presets: YouTube, TikTok/Reels, ProRes 422, DNxHR
- ✅ Queue management con cancelación
- ✅ 2-pass encoding

**Lo que NO se incluye:**
- ❌ **Keyframes de transformación** — solo se envía el transform estático (`clip.transform`), no los keyframes. Archivo: `src/main/ipc/index.ts` solo pasa `clip.transform`.
- ❌ **Keyframes de primaryColor** — `clip.primaryColorKeyframes` no se envía al export ni se interpola en ffmpeg.
- ❌ **Parametric curves** — `clip.parametricCurves` existe en el tipo pero no hay `buildParametricCurvesFilter()` en ffmpeg/index.ts.
- ❌ **Efectos animados por keyframes** — solo se envía el valor actual de cada param, no los keyframes con interpolación temporal.
- ❌ **Text clips** — clips con `textData` se filtran en `ipc/index.ts` (`if (!asset && !clip.textData) continue` pero luego `filePath: asset?.filePath ?? ''` — un clip de texto no tiene filePath, resultando en un clip vacío que ffmpeg no puede procesar).
- ⚠️ **Transiciones IN** — se pasa `transitionIn` al ExportClipInfo, pero `concatWithTransitions` solo aplica `transitionOut` del clip anterior. No hay soporte para transition-in del primer clip.
- ⚠️ **Export multi-clip** — Los clips se exportan individualmente con codec software (libx264) y luego se concatenan, perdiendo la calidad del codec seleccionado por el usuario en clips individuales. Las transiciones se aplican sobre los temp files ya codificados.

**Eslabón más débil:**
- `src/main/ipc/index.ts:238-240` — `if (!asset && !clip.textData) continue` seguido de `filePath: asset?.filePath ?? ''` deja filePath vacío para text clips, causando error en ffmpeg.

---

## 8. Aplicar Transición

**Estado:** ⚠️ Parcial (❌ Preview, ✅ Export)

**Flujo UI→Store:**
```
TransitionsPanel → selecciona "Dissolve", posición "out", duración 0.5s
  → setTransition(clipId, { type: 'dissolve', duration: 0.5 }, 'out')
  → Store: clip.transitionOut = { type: 'dissolve', duration: 0.5 }
```

**Timeline (✅):**
- `Timeline.tsx` renderiza un overlay amarillo semi-transparente en el extremo del clip con el tipo de transición.
- Archivo: `Timeline.tsx:380-400` — dibuja rectángulo con `rgba(255, 200, 0, 0.15)` y texto del tipo.

**Preview (❌):**
- No hay soporte de preview para transiciones. El `<video>` element no puede mostrar crossfade entre clips.

**Export (✅):**
- `exportMultiClips()` → `concatWithTransitions()` → ffmpeg `xfade` con:
  - `dissolve` → `fade`
  - `fade` → `fadeblack`
  - `wipe` → `wipeleft`
  - `slide` → `slideright`
  - `zoom` → `zoomin`
- Con offset calculado como suma de duraciones previas − transition duration.

**⚠️ Limitaciones:**
- **Transición IN** no se aplica — `concatWithTransitions` solo usa `transitionOut` del clip i-1 para unir con el clip i. El `transitionIn` del primer clip nunca se usa.
- **Audio crossfade** no se aplica — solo se usa `amix=inputs=N` sin crossfade de audio. Los cortes de audio serán abruptos aunque haya transición de video.
- **Preview:** Necesita un compositor de video que pueda hacer blend entre el final de un clip y el inicio del siguiente.

---

## 9. Aplicar LUT

**Estado:** ⚠️ Parcial (❌ Preview, ✅ Export)

**Flujo UI→Store:**
```
ColorPanel LUTTab → "Import LUT" → window.cineflow.importLut()
  → IPC 'media:import-lut' → dialog.showOpenDialog (filtro .cube/.3dl)
    → Lee archivo, parsea LUT_3D_SIZE
    → Retorna { id, name, filePath, size, dataSize }
  → addLut({ id, name, filePath, data: null, size }) → Store: project.luts.push(lut)
  
Click en LUT de la lista → applyLutToClip(clipId, lutId)
  → Store: clip.appliedLutId = lutId
```

**Export (✅):**
- `ipc/index.ts` busca `clip.appliedLutId` en `project.luts` → obtiene `filePath`
- `ffmpeg/index.ts → exportSingleClip()` → `vf lut3d=file='...'`

**Preview (❌):**
- El `<video>` element no puede aplicar LUTs.
- **Archivo:** `src/renderer/src/components/Preview/PreviewPanel.tsx` — no hay referencia a `appliedLutId`.

**⚠️ Limitaciones:**
- La data del LUT nunca se parsea realmente — `data: null` en Store. Solo se guarda la ruta. Esto funciona para export (ffmpeg lee el archivo), pero si se quisiera un preview WebGL se necesitaría parsear la data 3D.
- El blending opacity de LUT (slider en LUTTab) es solo UI — no se persiste en el clip ni se usa en export.
- `src/main/ipc/index.ts:437-455` — `loadLut` solo lee el header (size), no parsea la tabla 3D.

---

## 10. Keyframes de Transformación

**Estado:** ❌ Roto

**Flujo actual:**
```
Propiedades estáticas vía InspectorPanel:
  positionX/Y, scaleX/Y, rotation, opacity
  → setClipTransform(clipId, { positionX: 100 }) → Store

KeyframeEditor:
  - SOLO muestra keyframes de efectos (effect.params[name].keyframes)
  - Los keyframes se agregan desde EffectsPanel (botón ◆ en cada param)
  - NO hay UI para keyframes de transformación
```

**Dónde se rompe exactamente:**

1. **Store:** El tipo `Clip` tiene `transformKeyframes: Record<string, Keyframe[]>` (types.ts:181), y `addPrimaryColorKeyframe` (para primaryColor), pero **NO existe `addTransformKeyframe`** ni `removeTransformKeyframe` en el store. Archivo: `src/renderer/src/store/projectStore.ts` — no hay acciones para manipular `transformKeyframes`.

2. **UI:** No hay panel que permita agregar keyframes de posición, escala, rotación u opacidad. El KeyframeEditor solo muestra keyframes de efectos. Archivo: `src/renderer/src/components/KeyframeEditor/KeyframeEditor.tsx` — solo filtra `selectedClip.effects`, ignora `transformKeyframes`.

3. **Preview:** Sin pipeline de renderizado con interpolación de keyframes, no se podría mostrar aunque existieran en el store.

4. **Export:** `src/main/ipc/index.ts` solo envía `clip.transform` (valores estáticos). No hay interpolación de `transformKeyframes` ni generación de keyframes en ffmpeg (requeriría `zoompan` o `overlay` con expresiones de tiempo). Archivo: `ipc/index.ts:278-285` — solo `clip.transform ? { positionX, positionY, scaleX, scaleY, rotation, opacity } : undefined`.

5. **Timeline render:** El Timeline.tsx (línea 430-450) dibuja diamantes de keyframes incluyendo `clip.transformKeyframes`, pero como nunca se crean, nunca se muestran.

**Qué falta para que funcione:**
1. Store: `addTransformKeyframe(clipId, property, time, value)`, `removeTransformKeyframe(...)`
2. UI: Panel/keyframe editor para propiedades de transform con timeline de keyframes
3. Interpolación: Motor de interpolación (linear, bezier, step) entre keyframes para obtener valores en cualquier tiempo
4. Preview: Pipeline WebGL que aplique transform animada frame a frame
5. Export: Generar ffmpeg filter chain con valores interpolados en el tiempo (requiere `setpts` + expresiones en `overlay`/`scale`/`rotate`)

---

## Problemas Transversales

### 🔴 El Preview Engine No Existe

El problema más grave y recurrente (afecta features #4, #5, #8, #9, #10). No hay una capa de renderizado intermedia entre el store y el PreviewPanel. El `<video>` HTML5 element solo reproduce el archivo fuente crudo. Se necesita:

1. **WebGL Render Pipeline:**
   - Decodificación de frames (vía `requestVideoFrameCallback` o ffmpeg frame extraction)
   - Texture upload a WebGL
   - Shader chain: efectos (brightness/contrast/hue/saturation/blur/sharpen) → color correction (primary/wheels/curves) → LUT (3D texture lookup) → transform (scale/rotate/translate/opacity con keyframe interpolation)
   - Canvas 2D fallback para sistemas sin WebGL

2. **Audio Pipeline:**
   - Conectar `audioEngine.init()` al inicio del proyecto
   - Routear audio de playback por `audioEngine.playSource()` en vez del `<video>` element
   - Sincronizar `audioEngine.getCurrentTime()` con el playhead

### 🟡 transformKeyframes Existe pero Está Huérfano

El tipo `Clip` tiene `transformKeyframes: Record<string, Keyframe[]>` (types.ts:181) y `primaryColorKeyframes: Record<string, Keyframe[]>` (types.ts:191). Ambos existen en el type system pero:
- No hay store actions para transformKeyframes
- No hay UI para crearlos/editarlos
- No se envían al export
- No hay interpolación en preview ni export

### 🟡 Text Clips Rompen el Export

`src/main/ipc/index.ts:238` — `if (!asset && !clip.textData) continue` permite text clips, pero luego `filePath: asset?.filePath ?? ''` deja filePath vacío. No hay generación de texto vía ffmpeg `drawtext` filter. Los text clips existen en la UI (TextPanel.tsx) y se renderizan probablemente vía canvas overlay, pero no tienen ruta de export.

### 🟢 Lo Robusto

- **ffmpeg pipeline:** La generación de filtros para export es sólida y completa. `buildEffectsFilter`, `buildPrimaryColorFilter`, `buildColorWheelsFilter`, `buildCurvesFilter`, `buildAudioEffectsFilter`, `buildTransformFilter` — todos bien mapeados a sus equivalentes ffmpeg.
- **Store architecture:** Zustand con undo/redo, snapshots JSON, tipo seguro.
- **IPC layer:** Bien estructurada con channels tipados, contextIsolation, preload script.
- **Export queue:** Manager con cancelación, progreso, notificaciones.
- **Timeline canvas render:** Robusto, con waveform, keyframe indicators, transition overlays, speed ramp visualization.
- **Hardware acceleration:** Detección de GPU (NVENC/AMF/VideoToolbox) con fallback a software.

---

## Recomendaciones Priorizadas

### Críticas (bloquean features)

1. **Construir Preview Render Pipeline (WebGL)** — desbloquea features #4, #5, #8, #9, #10
2. **Inicializar y conectar AudioEngine al PreviewPanel** — desbloquea feature #6
3. **Implementar store actions + UI para transformKeyframes** — desbloquea feature #10
4. **Arreglar export de text clips (ffmpeg drawtext)** — evita crashes en export

### Altas

5. **Implementar keyframe interpolation engine** (linear, bezier, step) — necesario para preview y export
6. **Soporte de transition-in en export + audio crossfade en transitions**
7. **Preview de LUTs vía WebGL 3D texture**

### Medias

8. **Parse completo de LUT data (.cube) para preview**
9. **Sincronización frame-accurate entre rAF y video playback**
10. **Parametric curves en export (buildParametricCurvesFilter)**

---

## Archivos Clave por Feature

| Feature | Archivos involucrados |
|---------|----------------------|
| Import | `MediaPanel.tsx`, `ipc/index.ts`, `ffmpeg/index.ts` (probeMedia) |
| Timeline | `Timeline.tsx`, `projectStore.ts`, `MediaPanel.tsx` |
| Playback | `usePlayback.tsx`, `PreviewPanel.tsx`, `toolbar/Toolbar.tsx` |
| Efectos | `EffectsPanel.tsx`, `projectStore.ts`, `ffmpeg/index.ts` (buildEffectsFilter) |
| Color | `ColorPanel/ColorPanel.tsx`, `ColorWheel/ColorWheel.tsx`, `ColorPanel/CurvesEditor.tsx`, `ffmpeg/index.ts` (buildPrimaryColorFilter, buildColorWheelsFilter, buildCurvesFilter) |
| Audio | `MixerPanel.tsx`, `audioEngine.ts`, `ffmpeg/index.ts` (buildAudioEffectsFilter) |
| Export | `ExportDialog.tsx`, `ExportQueue.tsx`, `ipc/index.ts`, `ffmpeg/index.ts` (exportTimeline, exportSingleClip, exportMultiClips) |
| Transiciones | `TransitionsPanel.tsx`, `ffmpeg/index.ts` (concatWithTransitions, mapTransitionType) |
| LUTs | `ColorPanel/ColorPanel.tsx` (LUTTab), `ipc/index.ts` (loadLut, importLut), `ffmpeg/index.ts` (lut3d) |
| Keyframes | `KeyframeEditor.tsx`, `EffectsPanel.tsx`, `projectStore.ts` (addKeyframe, addPrimaryColorKeyframe) |
