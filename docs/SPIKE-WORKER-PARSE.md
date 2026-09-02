# SPIKE: Import de PDFs sin jank — Web Worker + OffscreenCanvas (Slice D)

Estado: DISEÑO + MEDICIÓN DE VIABILIDAD (sin merge al motor de extracción).
La implementación vive en el proyecto parser (FASE 2 reabierta, golden
`fd0ac1d1` + re-validación de ground-truth obligatoria).

## Problema (medido)

| Métrica | Valor |
|---|---|
| Parse del corpus completo (10 PDFs) | 43s |
| Longtasks en el main thread | 107 tareas ≥50ms · 9.8s acumulados · max 538ms |
| Consecuencia | UI congelada durante la importación (la barra de progreso no pinta entre páginas) |

## Por qué el main thread se bloquea

`pdfParser.processPdfFile` ejecuta por página, en el hilo principal:
1. `pdfjsLib.getDocument(...)` → parse del PDF (sin render, rápido).
2. `page.getTextContent()` → texto con posiciones (X/Y/transform) — asíncrono
   pero en el hilo principal (pdf.js con worker propio hace TRANFERENCIA de
   datos por mensajes; el armado de items del texto es JS puro).
3. `page.render({ canvasContext })` → rasteriza la página en un `<canvas>`
   (el paso más caro por página).
4. Descodificación de imágenes embebidas → `canvas.toDataURL()` (el costo de
   las 2080 imágenes del corpus; ya mitigado a thumbs aguas abajo).
5. Clasificación espacial (cellUtils/rowMatch) — JS puro pesado por página.

## Diseño objetivo

```
┌─ MAIN THREAD ──────────────┐      ┌─ WORKER (motor) ──────────────────┐
│ ImportFlow.processFiles    │      │ PdfParserCore (worker-scope)      │
│  results → preview/gates   │◄────►│  pdfjsLib.getDocument()           │
│  UI NUNCA bloqueada        │ MSG  │  textContent + items espaciales   │
│  onProgress por página     │      │  OffscreenCanvas render + toData  │
└────────────────────────────┘      └───────────────────────────────────┘
```

- El worker recibe `{file: ArrayBuffer, pageRange}`, devuelve
  `{pageItems, pageImages(dataURLs), diagnostics}` por mensaje (postMessage
  transfiere el buffer — los dataURLs grandes viajan como strings, igual que
  hoy pero SIN bloquear el main).
- `createImageBitmap(bytes)` reemplaza `new Image()` + canvas para las
  imágenes embebidas (async, sin DOM).
- `OffscreenCanvas` + `transferToImageBitmap` para la extracción de imágenes
  de página; el main solo recibe los `dataURL` finales.
- Los gates de calidad (color/texto) y `batchImportImages` siguen en el main
  (operan sobre los items ya extraídos).

## Mediciones de viabilidad (spike en branch)

| Pregunta | Método | Criterio |
|---|---|---|
| ¿Cuánto del parse es CPU pura (trabajable en worker)? | profile del parser actual por página (texto vs render vs imagen) | render+decode > 50% del tiempo → worker gana; si es texto puro, un worker JS basta sin OffscreenCanvas |
| ¿El hash de extracción se conserva? | correr el motor en worker vs main sobre 3 PDFs y comparar hash `fd0ac1d1`-style de productos | idéntico (la lógica de clasificación no cambia; solo el runtime de render) |
| Jank del main con el motor en worker | longtasks en el hilo principal durante el import | < 2s en el corpus de 3 PDFs (hoy ~3s por PDF en main) |
| Tiempo total | worker vs main sobre los mismos 3 PDFs | ≤ main o +20% máximo (el paralelismo compensa la serialización de mensajes) |

## Riesgos y mitigaciones

1. **Golden**: cualquier cambio de runtime de render puede alterar coordenadas
   de píxeles usadas por gates de imagen (color/aspecto). Mitigación: correr
   la batería ground-truth (rebaselineada 2026-09-02, n=65) + audit:full
   completo antes de tocarperse el merge; los 21 FN y 0 FP actuales son el
   piso de referencia.
2. **pdf.js worker dentro de worker**: pdf.js ya usa workers propios (legacy
   build, `disableWorker`=false); dentro de un worker dedicado se puede
   configurar `workerPort` o correr el build legacy sin worker interno.
3. **Memoria**: el worker duplica los buffers de página mientras extrae;
   acotar con liberación explícita (`page.cleanup()`) por página, como hoy.
4. **Fallback**: si OffscreenCanvas no está disponible (WebKitGTK viejo),
   degradar a render en main con el flujo actual (feature-detect).

## Verdict (a completar con la medición del spike)

- [ ] Pendiente: corrida de perfil por fase + hash + jank en branch
      (`spike/worker-parse`), sin merge.
- [ ] Pendiente: decisión documentada: habilitar worker / mantener main.

Mientras tanto: el jank actual (9.8s) está bajo el umbral del gate
(`perf:audit --check` <15s) y el overlay de progreso comunica el estado.