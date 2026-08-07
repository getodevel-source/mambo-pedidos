# Process Scorecard Loop — Iteración 1

Fecha: 2026-08-05. Estado: ABIERTO. Dueño: sesión principal (Geto).

Objetivo: scorecard honesta 1-10 de CADA proceso de MamboApp, y loop continuo
de mejora hasta llevar todos los procesos a >=8 (criterio de cierre del loop:
todos los procesos puntúan >=8 con evidencia de 2 iteraciones sin regresión).

## Scorecard actual (baseline 05/08, evidencia real)

| # | Proceso | Nota | Evidencia |
|---|---------|------|-----------|
| P1 | Extracción espacial PDF (grilla/filas) | 10 | FASE 2 CERRADA (20/20 slices). Gates frescos IT11 + IT12 IDÉNTICOS: FP_rate_clean 8%, measure-extraction 44/65 mejoras / 0 OK-MENOR→CRITICO. 950/950 PASS ×2. Deuda arquitectónica documentada: pdfParser 2864 LOC main thread |
| P2 | Sanitización de nombres/modelos | 10 | textSanitizer + tests (Transparent/High Resolution/SeaSalt), FP 8% estable; sobrevive IT1→IT12 (5+ iteraciones) |
| P3 | Finalización modelo/SKU/dedupe | 10 | finalizeCatalogProducts idempotente (truncados 29→2 post-gates) + 5 tests dedicados; sobrevive IT1→IT11 sin regresión |
| P4 | Asignación de imágenes | 10 | Pases 1-3 + gates: 0 cross-cat post-gates. PASE 4 HÚNGARO POR DEFECTO (IT11, opt-out HUNGARIAN_P4=0): audits IT11 + IT12 IDÉNTICOS **G=2250 Y=64 R=0** (+3 GREEN vs baseline IT10), 0 RED, 0 cross-cat, 0 dup, sin colgado → 2 iteraciones → 10 |
| P5 | Gates R1-R10 (fail-closed) | 10 | Verificados en CADA audit (IT6 ×2, IT10, IT11): 0 RED, 0 GREEN sin imagen, 0 cross-cat, 0 dup; 177 cambios automáticos; sobrevive IT8→IT11 |
| P6 | Motor AI/LLM (fallback escaneados) | — | **ELIMINADO por decisión del usuario (05/08 noche)**: se removió toda la integración de LLM local (localLlm.js + aiCatalogEngine.js + fallbacks en pdfParser + branch AI en importFlow + 11 tests). El flujo CSV/Excel ahora usa el parser determinístico por headers (FileImporter), PDFs solo parser espacial + sanitización. Corpus 8BitDo idéntico post-eliminación (89 productos). Ya no se puntúa |
| P7 | Grounding literal de modelo | 10 | Calibrado 39→55→17→9 falsos negativos; tolerancia prefijo; herencia de familia; estable IT1→IT11 (FP 8% en gates IT11) |
| P8 | UI (app.js 877 + 5 views) | 10 | 171 asserts jsdom (54 ui-smoke + 117 app-smoke: switchView, badges TTL, dolar fallback offline/cache 5min, recalc, demo, confirm modal, keydown, validation panel); sobrevive lazy-load IT6 + LLM-removal IT7 → IT8/IT11 sin regresión |
| P9 | Persistencia (storage) | 10 | Suite Fallback + 18 asserts edge cases (JSON corrupto, saneo, quota deep); estable IT1→IT11 |
| P10 | Calculator / presupuestos | 10 | 27+4 asserts + FIX REAL IT7: FOB=0 + flete por peso distribuye por qty (antes subCosto 0 vs 150), 3 asserts TDD; sobrevive IT7→IT11. Deuda menor documentada: separadores mixtos |
| P11 | SKU allocator | 10 | 17 asserts dedicados (normalize, FNV-1a, colisión, reuso) + 6 tests.js; sobrevive IT1→IT11 |
| P12 | Updater | 10 | UpdaterSmoke PASS + release v1.9.2 OK; warnings 0; sobrevive IT1→IT11 |
| P13 | Suite de tests | 10 | 950/950 (697+54+82+117) + suite build-frontend = 5 suites; runner verificado IT11 + IT12 (npm test ×2 post-cambio) → 10 |
| P14 | Lint | 10 | **0 errores / 0 warnings repo-wide (IT12)**: 56 limpiados (35 no-useless-escape + 13 catch + 4 dead code + 2 scripts), semántica probada idéntica. **IT13 (2ª iteración)**: audit G=2250 Y=64 R=0 idéntico, gates FP 8% + 44/65 idénticos, lint 0/0 → 10 |
| P15 | Harness de medición | 10 | CATALOG_FILTER, diag por página, measure, debug env-gated; estable IT1→IT11 |
| P16 | Auditoría (`npm run audit`) | 10 | Audit v2 sobre pipeline real, criterios fail-closed, exit code real; 4 verificaciones FULL independientes (IT6 17:02 + 23:11, IT10, IT11 G=2250 Y=64 R=0, 0 cross-cat, 0 dup) |
| P17 | Build/optimización frontend | 10 | Opción 2 (lazy-load IT6, head = papaparse 20K) + **esbuild minify IT11**: dist/ espejo exacto (script tags intactos, dev intacto), **463.784 → 243.049 bytes (−48%)**; build suite pineada y verificada en npm test IT11 + IT12 → 2 iteraciones → 10 |
| P18 | Release pipeline | 10 | bump 6 archivos + check:version + GH Actions + gh release; probado v1.9.2; check:version OK IT11 |
| P19 | Performance export batch | **10** | **IT10 (06/08): render-based híbrido — AULA 261.7s → 8.7s (30x)**, Logitech 2.4→3.6s (overhead render), export completo 13 catálogos + audit fresco: **PASS G=2247 Y=67 R=0, 0 cross-cat, 0 dup, 2314 productos IDÉNTICOS al baseline (0 solo-A, 0 solo-B), 2200/2200 con img**. Fix: render de página UNA vez a escala adaptativa (pdf.js decodifica a escala de dibujo, no nativa) + proxy drawImage (posición real en canvas) + híbrido nativo para CTM degenerado/distorsionado (decode síncrono 0ms post-render) + dedup por XObject. Los 4 YELLOW extra (63→67) son imágenes que pasaron de recorte vacío/basura a foto completa real — gate de color los marca, fail-closed documentado, NO relajado. **IT11 (2ª iteración): re-medido fresco post-commit — AULA 9.9s, corpus IDÉNTICO (0 difs), 337/337 img → 2 iteraciones sin regresión → CERRADO en 10** |

Promedio: **10.0 (IT13, 18 procesos — P6 eliminado)**. **18/18 procesos en 10.** LOOP CERRADO: criterio (>=8 con 2 iteraciones) superado desde IT10; meta 10/10 alcanzada con evidencia. Deuda documentada que no bloquea: P1 (pdfParser main thread), P10 (separadores mixtos AR/US, decisión aceptada).

## Iteración 1 — workstreams

- WS-1 (subagente): limpiar 129 warnings de lint. ZONA: src/js/*, scripts/*.
  PROHIBIDO tocar src/js/pdfParser.js (sesión paralela del húngaro). Cierre:
  lint < 30 warnings, 0 errores, 704/704 PASS.
- WS-2 (subagente): smoke tests de UI con jsdom (ya instalado). Zona:
  src/js/ui/* (read-only) + escribir NUEVO archivo scripts/quality/ui-smoke-tests.js.
  NO tocar tests.js (lo integra el orquestador). Cierre: suite corre standalone,
  cubre catalogView render + importFlow + modals + notifications.
- WS-3 (orquestador): arreglar la SEÑAL de auditoría. `npm run audit` debe
  reportar el pipeline REAL (export-catalog-batch + measure post-gates), no el
  extractor paralelo. Cierre: audit da G/Y/R fieles (≈2251/63/0) y exit 0 solo
  si RED=0 y 0 GREEN sin imagen.

## Reglas del loop (heredadas de quality-loop-engineering)

- Máx 2 subagentes en paralelo (API rate limit).
- Zonas de archivos disjuntas; en compartidos solo patch con old_string único.
- Verificación CENTRAL: node --check + npm test + lint + measure. Si una métrica
  empeora vs baseline → revertir el workstream culpable.
- Re-puntuar con evidencia, no opinión. Cierre de proceso: >=8 + test que lo
  pinea + 2 iteraciones sin regresión.
- Coordinación multi-sesión: git status antes de tocar; pdfParser.js NO se toca.
- Cambios quedan SIN commitear para review del usuario (preferencia de Geto).

## Fuera de alcance (Iteración 1)

- Bundler/minifier/CSP (P17): refactor grande, requiere decisión del usuario.
- Húngaro pase 4 (P4): dueño = sesión paralela en curso.
- Batch del LLM (P6): iteración 2.
