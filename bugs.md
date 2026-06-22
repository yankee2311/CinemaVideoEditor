# Bugs encontrados y corregidos

## Merge conflicts mal resueltos en `dev`

Los merges de las ramas `feat/export-engine`, `feat/audio-post` y `feat/color-correction` dejaron conflictos mal resueltos que producían errores de compilación y runtime.

### 1. `src/main/ffmpeg/index.ts` — Interface `ExportOptions` sin cierre

**Error:** `TS1005: ';' expected`
**Causa:** Faltaba `}` de cierre del interface `ExportOptions` antes del bloque de comentario y la constante `RESOLUTION_MAP`.
**Fix:** Agregar `}` en la línea 483.

### 2. `src/main/ffmpeg/index.ts` — Declaración duplicada de `vfFilters`

**Error:** `TS2451: Cannot redeclare block-scoped variable 'vfFilters'`
**Causa:** Dos declaraciones `const vfFilters` consecutivas (líneas 912 y 914), producto de un merge donde una debía reemplazar a la otra.
**Fix:** Eliminar la segunda declaración duplicada.

### 3. `src/main/ipc/index.ts` — Propiedades `transform` fuera del `videoClips.push()`

**Error:** `TS1005: ';' expected`, `TS1109: Expression expected`
**Causa:** Las propiedades `transform` (positionX, positionY, scaleX, scaleY, rotation, opacity) quedaron fuera del objeto pasado a `videoClips.push()`, después del cierre `})`. Posible merge conflict mal resuelto.
**Fix:** Mover el bloque `transform` dentro del `push()`, antes del `})` de cierre.

### 4. `src/main/ipc/index.ts` — Bloque `if (asset...)` huérfano

**Error:** `TS1472: 'catch' or 'finally' expected`, `TS1005: 'try' expected`
**Causa:** Después del cierre del bloque `for (const track...)` / `for (const clip...)` / `videoClips.push()` quedó un bloque `if (asset && asset.width > 0 && asset.height > 0)` duplicado fuera de contexto, sin función contenedora.
**Fix:** Eliminar el bloque duplicado (líneas 286-291).

### 5. `src/renderer/src/components/Timeline/Timeline.tsx` — `tracks` usado antes de inicializarse (TDZ)

**Error:** `ReferenceError: Cannot access 'tracks' before initialization`
**Causa:** `tracks` se usaba en la dependencia de un `useEffect` (línea 78) antes de su declaración `const tracks = project?.tracks ?? []` (línea 139). Esto viola la Temporal Dead Zone (TDZ) de JavaScript.
**Fix:** Mover `const tracks = project?.tracks ?? []` antes del primer `useEffect` que lo referencia.

### 6. `src/main/ffmpeg/index.ts` — `spawn UNKNOWN` al buscar ffmpeg

**Error:** `Error: spawn UNKNOWN` en `fluent-ffmpeg`
**Causa:** `app.getAppPath()` en desarrollo devuelve una ruta distinta a `process.cwd()`, por lo que no encontraba `resources/ffmpeg/ffmpeg.exe`.
**Fix:**
- Agregar búsqueda con fallback: primero prueba `app.getAppPath()`, si no encuentra ffmpeg prueba con `process.cwd()`.
- Instalar ffmpeg 8.1.1 globalmente y agregarlo al PATH de Windows.

### 7. ffmpeg no instalado en el sistema

**Problema:** ffmpeg no estaba disponible en el PATH del sistema.
**Solución:** Descargar e instalar ffmpeg 8.1.1 (essentials build) desde gyan.dev en `%LOCALAPPDATA%\ffmpeg\` y agregarlo al PATH de usuario.

---

## Bugs de runtime (causaban cierre repentino de la app)

### 8. `projectStore.ts` — `undo`/`redo` sin `try/catch` en `JSON.parse`

**Error:** Excepción no capturada al hacer Undo/Redo si un snapshot está corrupto.
**Causa:** `undo()` y `redo()` usaban `JSON.parse(prevSnapshot)` sin `try/catch`. Si algún snapshot previo contenía datos inválidos (ej. `undefined` serializado, referencias circulares, o datos de una versión anterior), `JSON.parse` lanzaba una excepción que derrumbaba toda la app.
**Fix:** Envolver ambos `JSON.parse` en bloques `try/catch`. Si falla, se limpia la pila de undo/redo y se loguea el error, evitando el crash.
**Archivo:** `src/renderer/src/store/projectStore.ts`

### 9. `projectStore.ts` + `Toolbar.tsx` — Split en el borde del clip produce duración cero

**Error:** Segundo clip con `timelineDuration=0` al hacer split exactamente en el final del clip.
**Causa:**
- `Toolbar.tsx:37` usaba `currentTime <= c.timelineStart + c.timelineDuration` (inclusive), permitiendo split en el extremo.
- `splitClip` en `projectStore.ts` no validaba que `localTime > 0` ni que `remaining > 0`.
**Fix:**
- `Toolbar`: cambiar `<=` por `<` para excluir el extremo final.
- `splitClip`: agregar guards `if (localTime <= 0) return s` y `if (remaining <= 0) return s`.
**Archivos:** `src/renderer/src/components/Toolbar/Toolbar.tsx`, `src/renderer/src/store/projectStore.ts`

### 10. `KeyframeEditor.tsx` — Non-null assertions (`!`) peligrosas

**Error:** Posible `TypeError: Cannot read properties of null` al eliminar keyframes.
**Causa:** `removeKeyframe(selectedClip!.id, selectedEffect!.id, selectedParam!, kf.id)` usaba non-null assertions sin verificar que los valores sigan siendo válidos (ej. si el efecto fue eliminado mientras el panel estaba abierto).
**Fix:** Agregar guard condicional: `if (!selectedClip || !selectedEffect || !selectedParam) return` antes de llamar a `removeKeyframe`.
**Archivo:** `src/renderer/src/components/KeyframeEditor/KeyframeEditor.tsx`

### 11. `EffectsPanel.tsx` — Sin protección contra efectos duplicados

**Error:** Se podían agregar múltiples efectos del mismo tipo a un clip.
**Causa:** El panel de efectos no verificaba si el efecto ya existía en el clip, a diferencia del `MixerPanel` que sí lo hacía.
**Fix:** Agregar verificación `selectedClip.effects.some(e => e.type === def.id)` antes de agregar.
**Archivo:** `src/renderer/src/components/EffectsPanel/EffectsPanel.tsx`

### 12. `Timeline.tsx` — `moveClip` siempre asigna track 0

**Error:** Al arrastrar clips en la línea de tiempo, todos se asignaban al primer track.
**Causa:** `moveClip(dragClipIdRef.current, tracks[0]?.id ?? '', newStart)` usaba `tracks[0]` como track destino en lugar de buscar el track real del clip.
**Fix:** Reemplazar `tracks[0]?.id` con búsqueda del track que contiene el clip: `tracks.find(t => t.clips.some(c => c.id === dragClipIdRef.current))?.id`.
**Archivo:** `src/renderer/src/components/Timeline/Timeline.tsx`

### 13. `ipc/index.ts` — Variable `audioEffects` redundante

**Error:** Código muerto que filtraba efectos de audio sin usar el resultado.
**Causa:** Merge conflict mal resuelto dejó una variable `audioEffects` duplicando el filtro de `clipAudioEffects`. La propiedad `audioEffects` del objeto exportado usaba `allAudioEffects`, no esta variable.
**Fix:** Eliminar la variable `audioEffects` no utilizada.
**Archivo:** `src/main/ipc/index.ts`

---

## Archivos modificados

- `src/main/ffmpeg/index.ts`
- `src/main/ipc/index.ts`
- `src/renderer/src/components/Timeline/Timeline.tsx`
- `src/renderer/src/store/projectStore.ts`
- `src/renderer/src/components/Toolbar/Toolbar.tsx`
- `src/renderer/src/components/KeyframeEditor/KeyframeEditor.tsx`
- `src/renderer/src/components/EffectsPanel/EffectsPanel.tsx`
