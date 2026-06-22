# CineFlow — Roadmap

> Versión objetivo: **1.0.0**

---

## Fase 1 — Control de Tiempo y Velocidad

- [x] Aceleración/desaceleración lineal (`0.1× – 10×`) vía slider y preset buttons
- [ ] **Curvas de velocidad (Speed Ramping)**: keyframes de velocidad con interpolación lineal/bezier/step. El clip se subdivide en segmentos, cada uno con su propia velocidad.
- [ ] **Remapeo de tiempo con Optical Flow**: integrar `minterpolate` / `framerate` de FFmpeg para generar fotogramas interpolados por IA y mantener fluidez en cámara lenta/acelerada.
- [ ] **Freeze Frame**: al hacer clic en un fotograma, insertar un clip estático de $n$ segundos en la línea de tiempo mientras el audio continúa.

---

## Fase 2 — Edición Esencial y Gestión de Línea de Tiempo

- [x] Línea de tiempo multipista (video, audio, texto)
- [x] Ripple delete
- [x] Split (tecla `S`)
- [x] Trim por arrastre de bordes
- [x] Snap a puntos de edición
- [x] **Slip edit**: mantener duración total pero desplazar contenido interno (punto de entrada/salida)
- [x] **Slide edit**: mover un clip en la línea de tiempo sin cambiar su duración, arrastrando clips adyacentes
- [x] **Sincronización multicámara**: alinear clips por forma de onda de audio en un clic (sincronización manual + automática por cross-correlación)
- [x] Atajos de teclado completos (C para cuchilla, A para selección, etc.)

---

## Fase 3 — Corrección y Gradación de Color

- [ ] **Corrección primaria**: exposición, contraste, altas luces, sombras, blancos, saturación
- [ ] **LUTs**: carga de archivos `.cube` / `.3dl` y aplicación por clip o por pista
- [ ] **Ruedas de color**: sombras, tonos medios, luces con control de luminancia
- [ ] **Curvas RGB**: curvas paramétricas y curvas de tono por canal
- [ ] **Scopes profesionales**: vectorscopio, histograma, parade (implementar vía WebGL o canvas)

---

## Fase 4 — Postproducción de Audio

- [x] Pistas de audio separadas
- [x] Mute por clip (botón en inspector)
- [ ] **Mezclador multicanal**: volumen, paneo (L/R), mute/solo por pista
- [ ] **Efectos de audio**: EQ paramétrico, compresor, limitador, puerta de ruido
- [ ] **Aislamiento de voz por IA**: eliminación de eco, ruido de fondo y viento mediante modelos ONNX/WASM (inference local)
- [ ] **Ducking automático**: detección de voz en pista de locución → atenuación automática de música de fondo

---

## Fase 5 — Efectos Visuales, Gráficos y Composición

- [ ] **Motor de títulos**: textos estáticos y animados con soporte de fuentes personalizadas, sombra, trazo, relleno degradado
- [ ] **Chroma Key**: eliminación de fondo verde/azul con refinamiento de bordes y spill suppression
- [ ] **Máscaras (Rotoscopia)**: máscaras poligonales y trazado Bezier; animables por keyframes; asistencia por IA (segmentación)
- [ ] **Keyframing completo**: animación de cualquier propiedad en el inspector (posición, escala, rotación, opacidad) con easing
- [ ] **Modos de fusión**: Multiply, Screen, Overlay, Add, etc. entre capas

---

## Fase 6 — Funciones de Inteligencia Artificial

- [ ] **Subtitulado automático**: transcripción de voz a texto con Whisper (ONNX runtime local) sincronizada perfectamente
- [ ] **Edición basada en texto**: borrar palabras de la transcripción → corta el clip automáticamente en la línea de tiempo
- [ ] **Auto Reframe**: detección del sujeto principal → reencuadre automático $16:9 \to 9:16$ (TikTok/Reels)
- [ ] **Eliminación de objetos**: seleccionar un objeto en movimiento → relleno por contenido (inpainting con IA)

---

## Fase 7 — Rendimiento y Exportación

- [ ] **Proxies automáticos**: al importar medios $4\text{K}\!/\!8\text{K}$, generar copias en baja resolución ($720\text{p}$) para edición fluida; toggle para alternar entre proxy y original
- [ ] **Aceleración por hardware**: detección de GPU (NVIDIA NVENC, AMD AMF, Apple VideoToolbox) para codificación/descodificación
- [ ] **Exportación multiformato**: presets para YouTube, TikTok, ProRes, DNxHR, H.264, H.265/HEVC, AV1
- [ ] **Guardado automático**: autosave local cada $n$ minutos + control de versiones (historial de `$n$` versiones anteriores por proyecto)
