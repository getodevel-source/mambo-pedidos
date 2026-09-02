# Spec: application-blueprint — mapa completo de procesos

> Contrato de referencia: TODOS los procesos de Mambo Pedidos, su estado
> medido (baselines del 2026-09-02, harness `perf:audit`) y su fiabilidad
> conocida. El programa de mejora vive en
> `openspec/changes/process-improvement-program/`.

## Convenciones

- Eje **T** = tiempo/eficiencia · Eje **R** = fiabilidad/correctitud.
- Baselines: corpus 10 PDFs → 2080 items; harness Chromium + stub fs (camino
  Tauri); runtime real (WebKitGTK) donde se indica.
- Gates existentes: `npm test` (1585), lint, audit:import, audit:full,
  perf:audit, perf:export, layout-audit, verify-latest, visual-smoke.

---

## A. Boot y ciclo de vida

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| A1 Init del store (AppStorage.init) | boot:store-loaded 60-64ms | Timeout 3s anti-colgado; persistenceError visible | gate T: <500ms ✅ |
| A2 Wiring de listeners | boot:listeners 60-88ms | Script-integrity + browser-runtime checks en runner | ✅ monitoreado |
| A3 Restauración del catálogo | 165ms (1264 items + fotos, batches) | Integridad (validateCatalogIntegrity) y selección huérfana al idle; backup/recover | ✅ |
| A4 Check de update al boot | 3s en idle | Fallback GitHub API + modal manual | ✅ |
| A5 Error boundary | — | Reliability.installErrorBoundary | ✅ |

## B. Import de catálogos (PDF)

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| B1 Parse por archivo (extracción espacial) | 43s corpus (4-10s/archivo), jank 9.8s (107 longtasks ≥50ms) | Golden `fd0ac1d1` (FASE 2 cerrada); 2080 productos, 0 RED estructurales, 39 RED de modelo por diseño | T: worker/OffscreenCanvas (spike D) · R: re-etiquetar ground-truth (65 casos) |
| B2 Detección de tabla vs grilla | dentro de B1 | 13→10 YELLOW de FOB por anclaje matricial (histórico) | R: validar contra re-etiquetado |
| B3 Extracción de imágenes (2079/2080) | thumbs 112px al import | shortSide avg 179px; **765 imágenes (35.6%) < 150px** (baja calidad) · payload export 99.2MB | R: mejorar resolución de extracción; gate photo-baseline |
| B4 Asignación imagen-producto | — | 2034 únicas / 210 compartidas / 455 usos; gate aplica 61 cambios (watch-model 59, generic-model 2); semáforo {GREEN 1631, YELLOW 630, RED 48} | R: re-medir con baseline nuevo |
| B5 ASignación SKU (colisiones) | incluida en gates | colisiones marcadas sin sobrescribir | ✅ |
| B6 Optimización de imágenes (batch+thumbs) | ~2s (2080 writes batches) | refs preservados en confirm (fix v2.2.26) | ✅ |
| B7 Validación de import (3 gates) | 48ms | semáforo F3 (YELLOW-datos deseleccionados) | T: Slice B (coalescing) |
| B8 Preview modal | render 12ms, scroll 31-40ms/chunk, búsqueda ~460ms, edición 163-236ms | visual semaforizado | T: Slice B |

## C. Import CSV/Excel (FileImporter)

| Proceso | Estado | Fiabilidad | Plan |
|---|---|---|---|
| C1 Parse CSV (PapaParse) | no medido | headers determinísticos; skipped sin FOB/modelo reportados | T: medir con fixture grande; gate |
| C2 Parse XLSX (SheetJS lazy) | no medido | mismo camino CSV | T: medir; R: roundtrip físico ya cubierto en CI |

## D. Catálogo cargado — lectura

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| D1 renderCatalog (60 filas) | 5ms | paginado | ✅ |
| D2 Filtros/búsqueda/debounce | ~50ms netos | filtros combinables | gate T <300ms |
| D3 Chips/nextPage/selectAll/grid | 3-18ms | — | ✅ |
| D4 Zoom de imagen | loadFullImage async (archivo) | fallback a thumb si falta archivo | ✅ |
| D5 Edición de imagen/clean-bg | full-res por archivo | updateProductImage invalida ref | ✅ |

## E. Catálogo cargado — fiabilidad

| Proceso | Estado | Fiabilidad conocida | Plan |
|---|---|---|---|
| E1 Validación al load (R1-R10) | 21ms | re-corre en cada restore | ✅ |
| E2 Integridad + selección huérfana | idle post-boot | limpieza automática con warning | ✅ |
| E3 Auto-fix (fixCatalog/runFixOnPreview) | — | TextSanitizer compartido | R: probar contra re-etiquetado |
| E4 Remediación (remediate-catalog) | — | loop con evidencia, promoción solo con grounding | R: campaña sobre 523 YELLOW |
| E5 Duplicados/identidad | dedup O(n) al confirm | #11: modelo vacío nunca dedup | ✅ |
| E6 Calidad global del catálogo | semáforo honesto audit:full {1518 G, 523 Y, 39 R} | 174 shape-advisories | **Nuevo: dashboard de calidad por proveedor** |

## F. Pedido y cotización

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| F1 armarPedido (1200 items) | 48ms | índice por sku (v2.2.26) | ✅ |
| F2 recalc (costos/IVA/flete) | 36ms | fuentes: getCostInputs + Dolar API | ✅ |
| F3 Cotización HTML (1200 items) | 365ms | snapshot en historial; reimprimir solo con detalle | T: Slice C (<250ms) |
| F4 renderPedido/renderHistorial | 32/2ms | — | ✅ |
| F5 validarYOarmarPedido | warnings con confirm | RED bloquea pedido | ✅ |

## G. Exportaciones

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| G1 Export JSON (diagnóstico) | 49ms/13.7MB pretty; 3ms/0.4MB sin imgs | sin artefactos runtime; evidencia en scope preview | ✅ Slice A cerrado; gate perf:export |
| G2 Export CSV (pedido) | no medido | — | T: medir |
| G3 Packing list / ejecutivo / customs | no medido | heredan snapshot del pedido | T: medir; gate |

## H. Wizard y modales

| Proceso | Estado | Fiabilidad | Plan |
|---|---|---|---|
| H1 ImportWizard (6 pasos, NCM/régimen) | render dinámico chequeado (runner) | state autoguardado (WIZARD/PROJECT keys) | T: medir pasos pesados (NCM lookup) |
| H2 NCM database (lazy) | — | ensureNcmDbLib lazy | T: medir first-hit |
| H3 Modales: compare/sensibilidad/break-even/d2d/brand | — | cálculos puros en Calculator | T: medir aperturas; R: fixtures en tests |
| H4 Glossary | — | — | ✅ |

## I. Persistencia y respaldo

| Proceso | Estado medido | Fiabilidad | Plan |
|---|---|---|---|
| I1 SaveCatalog (tauri, refs) | 96-138ms | batch 32; fallo COUNTADO nunca silencioso; GC por Set | ✅ |
| I2 LoadCatalog (thumbs desde archivos) | 165ms total restore | _imageRef conservado para zoom | ✅ |
| I3 Backup (Reliability.createBackup) | ~0ms medido (stub) | localStorage; fallo no fatal | R: backup también del payload completo en modo tauri |
| I4 RecoverFromBackup | — | validación del primary primero | ✅ |
| I5 Store fallback localStorage | degradación con evidencia + toast | nunca silenciosa | ✅ |

## J. Updater

| Proceso | Estado | Fiabilidad | Plan |
|---|---|---|---|
| J1 checkUpdate (plugin + GitHub fallback) | 3s idle | endpoints verificados (verify-latest); autoupdate-live E2E win/mac | ✅ |
| J2 Descarga (Rust reqwest → temp 82MB) | — | nunca por IPC | ✅ |
| J3 Aplicación (extract → reemplazo → relanzado) | verificado byte-idéntico (md5) en Linux real | chmod 755 + strip webkit embebido | ✅ |

## K. QA / ground-truth (fiabilidad del parser como proceso)

| Proceso | Estado | Fiabilidad conocida | Plan |
|---|---|---|---|
| K1 ground-truth diff | 65 casos candidate; **52.3% ids coinciden**; misma posición 93.8% (61/65); ids huérfanos 4 | el número de measure-model-quality describe el snapshot viejo, no el parser actual | **R: re-etiquetar los 65 (packet) y re-baselinear** |
| K2 measure-model-quality | — | recall/FP del parser ACTUAL recién tras re-etiquetado | R: gate de regresión de calidad con baseline nuevo |
| K3 photo-baseline | shortSide avg 178.8 · lt150 35.6% | gate min-avg 300 y max-under-150 1 NO se cumple hoy | **R: mejorar resolución de imágenes o re-baselinear con justificación** |
| K4 audit:full / assignment | 2080 · {1518,523,39} · imágenes 2034/210 | semáforo honesto | ✅ gates CI |

## L. Perf inventory (cross-cutting)

| Proceso | Baseline | Gate |
|---|---|---|
| L1 boot | 60ms | <500ms |
| L2 restore 1264 | 165ms | <2s |
| L3 parse corpus | 43s | <60s (hoy), worker → <25s (meta) |
| L4 jank | 9.8s | <15s hoy; worker → <2s (meta) |
| L5 confirm | 278ms | <1s |
| L6 save | 138ms | <500ms |
| L7 cotización 1200 | 365ms | <500ms (meta <250ms) |
| L8 export | 49ms | <600ms |
| L9 imágenes vivo | 25MB | <50MB |
| L10 heap post-confirm | ~140MB | <400MB |
| L11 pedido/render | 35-49ms | <200ms |