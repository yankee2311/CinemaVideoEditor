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

## Archivos modificados

- `src/main/ffmpeg/index.ts`
- `src/main/ipc/index.ts`
- `src/renderer/src/components/Timeline/Timeline.tsx`
