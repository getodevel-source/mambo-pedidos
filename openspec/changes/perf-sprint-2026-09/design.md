# Design: Performance Sprint — por proceso (baselines medidos 2026-09-02)

Entorno de medición: `npm run perf:audit` (Chromium + stub fs = camino Tauri,
corpus 10 PDFs → 2080 items). Metodología: medir → atacar → gate.

## 1. Export JSON (Slice A)

**Baseline medido** (catálogo de 2080 items confirmado):

| Métrica | Valor |
|---|---|
| stringify (pretty, indent 2) | 41ms |
| Tamaño del archivo | 13.8MB (pretty) |
| Heap durante el export | +~180MB transitorios |
| Contenido | 14 campos/ítem; **img = thumb 6.5KB**; incluye `_imageRef` (artefacto runtime) |

**Problemas**: (1) no hay opciones — img siempre incluida (13MB de los 13.8MB
son thumbs); (2) `_imageRef`/`_selected` son estado interno, ruido para un
archivo de auditoría; (3) la evidencia del parser (rawText, cellRawText,
evaluaciones, imgWarnings) existe en `ImportFlow.pendingPreviewItems` pero el
export solo mira `catalog` (los campos se pierden en el `catalog.push` de
confirm — whitelist); (4) sin gate de tamaño/tiempo.

**Diseño**:

- `catalogValidator.js`: `buildCatalogExportJSON(items, opts)` puro:
  - `opts.scope`: `catalog` (default) | `preview` (usa `pendingPreviewItems`
    con su evidencia extra);
  - `opts.images`: `thumb` (default — img tal cual) | `none` (omite img);
  - `opts.pretty`: true (indent 2) | false (compacto);
  - Orden de campos estable y explícito (whitelist de extracción):
    `sku, cat, marca, modelo, variante, color, fob, img, status, warnings,
    confidence, grounded, sourceFile, qualityReason` + evidencia opcional si
    presente (`rawText, cellRawText, imgWarnings, sourceWarnings,
    _evaluations`);
  - Nunca emite `_imageRef`, `_selected`, `_previewValidation`.
- `exportCatalogJSON()` → abre modal (patrón `.modal-backdrop`) con los 3
  selects + botón; el download usa el path actual (Blob + `a.click()`).
- Tamaños esperados: pretty+thumb ~13.8MB · compact+thumb ~9MB · sin imágenes
  ~1MB. Gates: stringify < 600ms; sin imágenes < 200ms; sin `_imageRef` en
  ninguna clave del archivo.

## 2. Re-validación del preview (Slice B)

**Baseline**: `updatePreviewItem` = 163-236ms por edición (corre
`runImportVerification` sobre los 2080). 10 ediciones seguidas ≈ 2.3s.

**Diseño**: separar en dos niveles:
- edición de un ítem → re-validar SOLO ese ítem en vivo (gates ligeros:
  CatalogValidator.runFullValidation sobre el array completo es 22ms; el costo
  real es el clonado/spread de los gates) — mantener semáforo por ítem;
- las ediciones rápidas consecutivas (dictado) coalescen: `scheduleTrailing`
  (350ms) re-renderiza el modal y corre la verificación completa en idle
  (`requestIdleCallback`); si el usuario deja de editar, el semáforo final se
  recalcula una vez.
- Gate: 10 ediciones seguidas con dictado < 2s totales; semáforo final igual
  al de la verificación completa (assert de `_previewValidation`).

## 3. Cotización de pedidos grandes (Slice C)

**Baseline**: `generatePrintableQuote` 365ms/1200 items (0.3ms/ítem) —
dominado por `Intl.NumberFormat` por fila (2 formatos/ítem) + concatenación de
strings con 36px thumbs inline.

**Diseño**:
- caché de módulo de los formatters por moneda/locale (`QuoteGenerator._fmt`),
  reutilizados en todas las filas;
- acumular filas en `string[]` + `join('')` (ya es concat simple; el win es el
  Intl);
- `img` thumb ya optimizado (36px — sin cambio);
- Gate: < 250ms/1200 items; hash de HTML estable para el mismo pedido (test).

## 4. Import sin jank (Slice D — diseño + spike)

**Baseline**: parse carpeta 43s, 107 longtasks ≥50ms (9.8s bloqueando el hilo
principal), max 538ms.

**Diseño (spike, sin merge)**: pdf.js puede correr en un worker; el parser usa
canvas + `Image` + DOM para extraer imágenes por página. Viabilidad:
`OffscreenCanvas` + `createImageBitmap` cubren el render sin DOM; el
`onProgress` del worker llega por mensajes. Los gates de imagen (color) y el
salvado de dataURLs se mantienen en el main thread. El spike mide: tiempo
parse-worker vs main (target: < 25s para el corpus), jank del main (< 2s de
longtasks) y estabilidad de hash de extracción contra el golden actual.

**Riesgos**: cambio de runtime del motor → re-validar golden + re-etiquetar los
65 casos pendientes (ground-truth-diff hoy 52,3% de ids); por eso la
implementación vive en el proyecto parser, con su propio change.

## 5. Perf gates en CI (Slice E)

**Diseño**: `perf-audit.mjs --check` gana umbrales por fase:

| Fase | Umbral | Hoy |
|---|---|---|
| boot:listeners | < 500ms | 60ms |
| restore catálogo 1264 | < 2s | 165ms |
| parse carpeta completa | < 60s | 43s |
| longtasks totales | < 15s | 9.8s |
| confirm | < 1s | 278ms |
| render catálogo | < 50ms | 5ms |
| cotización 1200 | < 500ms | 365ms |
| export stringify | < 600ms | 41ms |
| heap post-confirm | < 400MB | ~140MB |

Job `perf-gates` en `ci.yml` (push/PR) y `release.yml` (post-build, necesita el
mismo entorno que visual-smoke: chromium del sistema). Falla del gate → el
pipeline corta con el diff de fases.

## 6. Memoria (transversal)

Ya cerrado en v2.2.26 (thumbs 112px + full-res por archivo, heap post-confirm
602→140MB). El sprint solo agrega el gate de heap a Slice E y el seguimiento
del pico de export (Slice A) en el changelog de `docs/PERF-AUDIT.md`.