# 🔧 CineFlow — Documento Maestro de Correcciones

> **Auditado por:** 4 agentes especializados (Store/Engines, UI, Backend, Integración)
> **Compilado por:** Clowsito Chino 🐲 (PM)
> **Fecha:** 2026-06-22
> **Total hallazgos:** 37 bugs + 30 issues

---

## 🩸 PROBLEMA RAÍZ #1: No existe Preview Render Pipeline

**Impacto:** 6 de 10 features aparecen como "rotas" para el usuario. Todos los sliders de color, efectos, LUTs, curvas, transformaciones guardan datos en el store pero **nunca se reflejan en el preview**. El PreviewPanel usa un `<video>` HTML5 nativo que reproduce el archivo crudo.

**Solución:** Canvas 2D / WebGL pipeline que aplique filtros en tiempo real.

---

## 🔴 CORRECCIONES CRÍTICAS (bloquean features — 20 bugs)

### Audio (4 bugs)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | **Reverb silencia el audio** — cadena wet desconectada, no hay ruta de input→output | `audioEngine.ts:buildReverb` | Reconectar: `inputGain→dryGain→output` + `inputGain→preDelay→delays→wetGain→output` |
| 2 | **AudioEngine nunca se inicializa** — `audioEngine.init()` no es llamado por nadie | `PreviewPanel.tsx` | Llamar `init()` al montar proyecto. Routear playback por el engine en vez del `<video>` |
| 3 | **Ducking mide todas las fuentes** — `AudioSource` no tiene `trackId` | `audioEngine.ts:tickDucking` | Agregar `trackId` a AudioSource, filtrar por voice track |
| 4 | **getTrackVUData retorna en primera iteración** — el loop es código muerto | `audioEngine.ts:getTrackVUData` | Agregar `trackId` a AudioSource, filtrar y calcular agregado |

### FFmpeg / Export (5 bugs)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 5 | **Pan nunca funciona** — usa `<` que normaliza coeficientes | `ffmpeg/index.ts:pan filter` | Cambiar `<` por `=` y eliminar `c0+` base |
| 6 | **Transform: overlay crashea ffmpeg** — requiere 2 streams, solo recibe 1 | `ffmpeg/index.ts:buildTransformFilter` | Reemplazar overlay por `crop+pad` |
| 7 | **Transform borra TODOS los filtros de color** — al aplicar transform, `vfFilters.length=0` | `ffmpeg/index.ts:exportSingleClip` | Re-aplicar primaryColor/wheels/curves/LUT después de transform |
| 8 | **Xfade aplicado a TODOS los clips** — si un clip tiene transition, TODOS reciben fade | `ffmpeg/index.ts:concatWithTransitions` | Validar `transitionOut` por clip; si no tiene, usar concat sin xfade |
| 9 | **restoreVersion parámetros intercambiados** — preload invoca (versionId, projectId) pero handler recibe (projectId, versionId) | `preload.ts` + `ipc/index.ts` | Alinear orden: `invoke('version:restore', versionId, projectId)` y handler `(_e, versionId, projectId)` |

### Store (5 bugs)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 10 | **trimClip ignora speed** — `timelineDuration = newEnd - newStart` sin dividir por speed | `projectStore.ts:trimClip` | `timelineDuration = (newEnd-newStart) / Math.max(0.1, c.speed)` |
| 11 | **splitClip calcula mal sourceOffset** — usa división en vez de multiplicación por speed | `projectStore.ts:splitClip` | `sourceOffset = sourceStart + localTime * speed` |
| 12 | **setClipSpeed inconsistente** — clamp del valor guardado ≠ clamp del cálculo de duración | `projectStore.ts:setClipSpeed` | Usar misma variable clamped para ambos |
| 13 | **_useProxy no existe en tipo Clip** — `as any` bypass del type system | `projectStore.ts` | Agregar `_useProxy?: boolean` a la interfaz `Clip` |
| 14 | **undo/redo no limpian selección** — selectedClipId apunta a clip que ya no existe | `projectStore.ts:undo/redo` | Agregar `selectedClipId: null, selectedTrackId: null` en undo/redo |

### Feature Gaps (6 bugs)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 15 | **Text clips rompen export** — filePath vacío, no hay generación drawtext | `ipc/index.ts` | Generar clip de texto vía ffmpeg `drawtext` filter o excluirlos |
| 16 | **Keyframes de transformación huérfanos** — `transformKeyframes` en el tipo pero sin store actions, UI ni export | `projectStore.ts` + UI | Crear `addTransformKeyframe`, panel UI, interpolación en export |
| 17 | **KeyframeEditor no puede crear keyframes** — creation delegada al EffectsPanel | `KeyframeEditor.tsx` | Agregar botón "Add Keyframe" + input de tiempo/valor |
| 18 | **buildEqualizer: condición tautológica** — `gain !== 0 \|\| true` siempre crea nodos | `audioEngine.ts` | `if (gain !== 0)` |
| 19 | **usePlayback stale closure** — `tick` usa `getMaxTime` obsoleto si el proyecto cambia | `usePlayback.tsx` | Usar `useRef` para `getMaxTime` |
| 20 | **Audio crossfade no aplicado** — transiciones de video sin crossfade de audio | `ffmpeg/index.ts:concatWithTransitions` | Agregar `acrossfade` para audio durante transiciones |

---

## 🟡 CORRECCIONES MEDIAS (mejoran calidad — 15 issues)

| # | Bug | Archivo |
|---|-----|---------|
| 21 | Efectos `crop`, `transform-2d`, `delay` en tipos pero sin implementación | `types.ts` |
| 22 | `TimelineState.isDragging`/`dragType` estado muerto — nunca leído ni escrito desde store | `types.ts` + `projectStore.ts` |
| 23 | `useProxyForPreview` código muerto — implementado pero ningún componente lo llama | `projectStore.ts` |
| 24 | Efectos de track (`addTrackEffect`, etc.) sin caller — definidos en store pero sin UI | `projectStore.ts` |
| 25 | `removeTrack`, `removeClip` (directo) sin caller | `projectStore.ts` |
| 26 | `textEngine.renderTextOnCanvas` nunca invocada — código completamente muerto | `textEngine.ts` |
| 27 | Noise gate: `DynamicsCompressor.ratio=0.05` inválido según spec (mínimo nominal 1) | `audioEngine.ts:buildNoiseGate` |
| 28 | LUT blend opacity es estado local — no persiste en store ni se exporta | `ColorPanel.tsx` |
| 29 | ColorWheel luminance/onLuminanceChange props nunca usadas por el padre | `ColorWheel.tsx` |
| 30 | `getSnapPoints` no deduplica — mismo punto aparece N veces | `timelineEngine.ts` |
| 31 | `AudioEffect.params` union no discriminado — no hay narrowing de tipos | `audio.ts` |
| 32 | `slideClip`: variable `adjustedDuration` redundante (nunca se modifica) | `projectStore.ts` |
| 33 | `addClip` no valida que `trackId` exista — clip se pierde silenciosamente | `projectStore.ts` |
| 34 | Transición IN no se aplica en export — `concatWithTransitions` solo usa `transitionOut` | `ffmpeg/index.ts` |
| 35 | Export multi-clip: clips individuales se codifican con libx264 (pierden codec elegido) | `ffmpeg/index.ts:exportMultiClips` |

---

## ⚪ CORRECCIONES BAJAS (cosméticas — 5 issues)

| # | Bug | Archivo |
|---|-----|---------|
| 36 | `serializeProject` no actualiza `modifiedAt` en el store (solo en el JSON) | `projectStore.ts` |
| 37 | `shortcutStore.matchEvent`: sin garantía de orden con bindings duplicados | `shortcutStore.ts` |
| 38 | Import `Track` y `EqualizerBand` no usados en `audioEngine.ts` | `audioEngine.ts` |
| 39 | `DEFAULT_COLOR_WHEELS.intensity: 50` sin rango documentado | `color.ts` |
| 40 | Drag handler en MediaPanel usa `firstTrack` sin validar tipo (audio en video track) | `MediaPanel.tsx` |

---

## 🎯 PLAN DE ATAQUE (orden de ejecución)

### Ola 1 — Preview Pipeline (desbloquea TODO lo visual)
- Construir Canvas 2D render pipeline que aplique CSS filters + transform al `<video>` en PreviewPanel
- Mapear: brightness→CSS brightness, contrast→CSS contrast, hue→CSS hue-rotate, saturation→CSS saturate, blur→CSS blur, opacity→CSS opacity

### Ola 2 — Audio Engine (desbloquea mixer)
- Inicializar AudioEngine en App.tsx
- Routear playback de audio por el engine (mutear `<video>`)
- Fix buildReverb routing
- Fix ducking trackId
- Fix buildEqualizer tautología
- Fix getTrackVUData loop

### Ola 3 — Store Math (corrige bugs de datos)
- Fix trimClip speed bug
- Fix splitClip sourceOffset
- Fix setClipSpeed inconsistencia
- Limpiar selección en undo/redo
- Agregar `_useProxy` al tipo Clip

### Ola 4 — FFmpeg Pipeline (corrige export)
- Fix pan filter (`=` en vez de `<`)
- Fix buildTransformFilter (crop+pad en vez de overlay)
- Fix transform borra color filters
- Fix xfade aplicado a todos los clips
- Fix restoreVersion params
- Fix text clips en export
- Agregar audio crossfade en transiciones

### Ola 5 — Keyframes + Edge Cases
- Store actions para transformKeyframes
- KeyframeEditor: crear + editar keyframes
- Engine de interpolación (linear, bezier, step)
- Export con keyframes interpolados
- Código muerto y cleanup
