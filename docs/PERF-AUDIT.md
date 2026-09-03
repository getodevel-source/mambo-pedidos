# Auditoría de Performance — Mambo Pedidos (pre-v2.2.26)

Fecha: 2026-09-02 · Entorno: Chromium real (headless) sirviendo `dist/`, con stub
de fs (espejo del camino Tauri: writes/reads por el puente), corpus real de **10
PDFs → 2080 items**. La verificación en el runtime real (WebKitGTK de la
notebook) se hizo por separado (RSS ~0.74 GB estables con catálogo cargado).

Reproducible con: `MAMBO_CATALOG_DIR=... npm run perf:audit` (JSON en
`/tmp/perf-audit.json`).

## Resumen ejecutivo

| Proceso | Medido | Estado |
|---|---|---|
| Boot (vacío) | **60ms** hasta listeners | ✅ Excelente |
| Boot (catálogo de 1264 items restaurado) | **165ms** | ✅ Excelente |
| Import carpeta completa (10 PDFs) | **43s** (motor de extracción) | 🟡 El proceso dominante; jank 9.8s en 107 longtasks |
| Validación (3 gates) | **48ms** | ✅ |
| Optimización de imágenes (thumbs) | incluida en los 43s (~2s) | ✅ 151MB → 25MB |
| Confirm import (2080 items) | **278ms** | ✅ |
| Save (con refs) | **138ms** | ✅ |
| Catálogo: render/filtros/paginación/selección | 3-18ms; búsqueda ~50ms netos | ✅ |
| Pedido (1200 items): armar/render/recalc | 35-49ms | ✅ |
| Cotización HTML (1200 items) | **365ms** | 🟡 Aceptable, primera en la lista de mejora |
| Historial (render/reimprimir) | 1-6ms | ✅ |
| Memoria imágenes en vivo | **25MB** (thumbs) + archivos full en disco | ✅ (era 151MB) |
| Heap post-confirm | **135-145MB** | ✅ (era 602MB) |

**Veredicto**: la app quedó >95% sana. El único proceso que domina el CPU y el
tiempo es el parse de PDFs (40s + 9.8s de jank para el corpus completo), y es
intencional: el motor de extracción es el "golden" de la FASE 2 (hash
`fd0ac1d1`), no se toca sin re-validar ground-truth.

## Detalle por proceso

### A) Boot (app vacía)

| Fase | ms | Nota |
|---|---|---|
| boot:dom-ready | 59 | DOMContentLoaded |
| boot:store-loaded | 60 | AppStorage.init (store) |
| boot:catalog-loaded | 60 | Sin catálogo previo |
| boot:listeners | 60 | Wiring completo de botones |

Sin catálogo: la app está interactiva en ~200ms (mark de listeners). El check
de update (updater) corre a los 3s en idle — no afecta el boot.

### B) Importación (carpeta completa)

| Fase | Medido | Cuello | Recomendación |
|---|---|---|---|
| Parse 10 PDFs + optimización | 42.7-43.1s | Motor de extracción (canvas por página, secuencial por archivo) | Aceptado (golden). Opción futura: worker con OffscreenCanvas (refactor mayor, riesgo de hash) |
| Jank (longtasks) | **107 tareas ≥50ms · 9.8s · max 538ms** | Mismo motor: el hilo principal queda bloqueado por página | Mitigación UX: el overlay de progreso ya comunica; no tocar el parser |
| Gates de validación | 48ms | — | ✅ |
| Optimización de imágenes | ~2s (2080 writes batched + thumbs) | — | ✅ |
| Render modal (chunk inicial) | 12ms | — | ✅ |
| Scroll (chunk 60 cards) | 31-40ms | — | ✅ |
| Búsqueda en modal | ~460ms (con debounce 250ms) | — | ✅ |
| Editar ítem (re-validación completa) | 163-236ms | runImportVerification por edición | 🟡 Cada tecla re-valida los 2080; aceptable hoy, candidato a debounce si crece |
| Confirm completo | **205-278ms** | — | ✅ |
| Heap durante preview | 242MB | Imágenes thumbs + clones de validación | ✅ acotado |

Observación: importar archivo por archivo procesa igual; el total es la suma
por archivo (4-10s c/u, progreso por página).

### C) Persistencia

| Fase | Medido | Nota |
|---|---|---|
| Confirm + save inicial | ~280ms | Escribe 1135 archivos únicos (content-addressed) en batches de 32 |
| Imágenes en el catálogo vivo | **13MB** (thumbs) + `_imageRef` a archivos full (1262) | El zoom resuelve full-res por archivo |
| saveCatalog con refs (segundo save) | 96-138ms | No re-escribe archivos; GC por Set O(1) |
| Archivos en images/ | 1135 únicos (2080 items, dedupe por hash) | Discos: ~70MB aprox. |

### D) Boot con catálogo grande

| Fase | ms |
|---|---|
| boot:dom-ready | 61-64 |
| boot:store-loaded | 62-64 |
| boot:catalog-loaded | 82-85 (restore: load + thumbs desde archivos, batches de 32) |
| boot:listeners | 85-88 |

**165ms totales** para restaurar 1264 items con fotos (antes del fix de
lecturas batched: 20-50s). Heap post-restore 105-178MB.

### E) Catálogo (vista)

| Fase | Medido | Estado |
|---|---|---|
| renderCatalog (60 filas) | 5ms | ✅ |
| populateCatalogFilters | 0ms | ✅ |
| Chip de categoría + render | 3ms | ✅ |
| Búsqueda (debounce 350ms) | 400ms brutos (~50ms netos) | ✅ |
| nextPage ×5 | 18ms | ✅ |
| toggleSelectAll | 5ms | ✅ |
| Render grilla (grid) | 12ms | ✅ |

### F) Pedido / Cotización / Historial

| Fase | Medido | Estado |
|---|---|---|
| armarPedido (1200 items) | 48ms | ✅ (índice por sku; antes 49ms con find — el item-build domina) |
| renderPedido + recalc + tabla | 35/36/32ms | ✅ |
| Cotización HTML (1200 ítems) | **365ms** | 🟡 0.3ms/ítem (strings + Intl formateo); aceptable; candidato a caché/virtualización si crece |
| saveToHistory | 6ms | ✅ |
| renderHistorial / reimprimir | 2/1ms | ✅ |

### Memoria (resumen)

| Punto | Antes (v2.2.25) | Ahora (v2.2.26) |
|---|---|---|
| dataURLs en memoria | 151MB | **25MB** (12KB media thumb) |
| Heap post-confirm | 602MB | **~140MB** |
| RSS real (notebook, catálogo cargado) | ~0.74GB | ~0.5GB esperado |
| Pico durante import | GB (decode 300px por card) | acotado (bitmaps 112px) |

## Límites conocidos (no tocados a propósito)

1. **Parse 40s + jank**: motor de extracción golden (FASE 2 cerrada). Solo un
   worker con OffscreenCanvas lo movería; es un proyecto aparte con re-validación
   de ground-truth (52.3% de ids coinciden hoy; re-etiquetar 65 casos pendiente).
2. **Búsqueda del modal re-valida todo por edición**: debounce hoy por
   onchange; si el catálogo crece a >4000, conviene debounce de 300ms en la
   re-validación.
3. **Cotización HTML 365ms con 1200 ítems**: dentro de límites; la virtualización
   del HTML de impresión no aplica (el documento es completo por diseño).

## Plan de iteración (priorizado por impacto/esfuerzo)

| # | Acción | Impacto | Esfuerzo | Estado |
|---|---|---|---|---|
| 1 | ✅ Hecho (v2.2.25): batches de IPC en imágenes | 20-50s → 1.3s save | bajo | cerrado |
| 2 | ✅ Hecho (v2.2.26): thumbs 112px + archivo full para zoom | 151MB → 25MB; heap 602→140MB | medio | cerrado |
| 3 | ✅ Hecho (v2.2.26): `_imageRef` preservado en confirm (evita re-escribir thumbs sobre full y huérfano del GC) | integridad de fotos | bajo | cerrado |
| 4 | ✅ Hecho (v2.2.26): índice por sku en armar/validar pedido | O(n²) → O(n) | bajo | cerrado |
| 5 | 🟡 Debounce de re-validación al editar ítems del modal (>3000 items) | UX en catálogo gigante | bajo | pendiente, si crece |
| 6 | 🟡 Parse en worker (OffscreenCanvas) | 40s → paralelo, sin jank | alto | proyecto aparte (re-validar golden) |
| 7 | 📊 Re-correr `npm run perf:audit` en cada release | regresión | — | parte del workflow |

## Cómo medir

```bash
MAMBO_CATALOG_DIR="/home/geto/Mambo-app/Catalogos" npm run perf:audit   # todo el app
MAMBO_CATALOG_DIR=... npm run perf:import                               # solo importación
MAMBO_CATALOG_DIR=... npm run perf:export                               # solo export JSON (perf-engineering)
MAMBO_CATALOG_DIR=... npm run audit:import                              # correctitud E2E
```

## Changelog de performance

| Fecha | Camino | Cambio | Antes → Después |
|---|---|---|---|
| 2026-09-02 | Export JSON (Slice A, perf-sprint) | `buildCatalogExportJSON` con opciones (scope/images/pretty), sin artefactos runtime, evidencia del parser en scope preview | 41ms/13.8MB sin opciones → preview-full 100ms/26MB · catalog sans-imgs 3ms/0.4MB · `_imageRef` fuera del archivo |
| 2026-09-02 (tarde) | Programa completo (process-improvement-program) | I0 mediciones (CSV/XLSX/exports/wizard/modales) · Slice B (coalescing edición preview: 10 ediciones → 1 verificación) · Slice C (Intl cache: cotización 365→337ms, 20k formatos 51ms) · perf:audit --check + perf:smoke CI · I1 dashboard calidad + campaña YELLOW (_atomicReason preservado) · I2 rebaseline ground-truth (n=65, ids actuales; measure: recall_dirty 48%, FP 0%) + photo gate honrado (avg≥150, <150px≤40%) · spike worker diseñado | Gates todos ✅ con corpus real |

| 2026-09-02 (noche) | Cierre de programa (v2.2.27) | imgSm 36px para cotizaciones (quote images 14MB→2MB) · check + smoke adaptativos a la carga (ref 10k formatCurrency) · backup completo a disco + recuperación en load · remediación por proveedor con diff preview · virtualización del preview (DOM acotado, ida y vuelta) · corpus sintético con ground-truth (FOB 16/16 100%, modelo 100%, 0 RED) + gate de extracción en CI · spike worker medido (render 25-41%, texto 1-4%, el resto es JS del motor) | Todos los gates ✅ |

| 2026-09-03 | Rendimiento de carga tolerante | yields cooperativos en el parser (entre pasos de página y POR IMAGEN — solo timing, golden `fd0ac1d1` idéntico, 2080 productos) + yield entre archivos. Jank: 9.6s → 1.9s (107 → 11 tareas ≥50ms); parse 43 → 50s (tradeoff pedido). Edición del preview: sin re-validación en el momento (la verificación corre una vez al procesar y una vez al confirmar) | Gates ✅ (test, lint, corpus 16/16, audit:import, audit:full) |

| 2026-09-03 | UI selectores | Tier 1: todos los selects nativos estilizados a la UI (appearance none, chevron propio, dark, focus glow) — incluye los dinámicos (cards del preview). Tier 2: combobox con búsqueda para Marca y Categoría (customSelects.js): el select nativo queda oculto como fuente de valor (la lógica no cambió), con teclado (arrows/enter/esc), filtro por texto y sync ante cambios por código (setCatChip/clearCatalogFilters vía MutationObserver + refresh). Verificado: pick filtra el catálogo, trigger refleja el valor, sync OK | Tests ✅ |
