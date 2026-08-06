# Process Scorecard Loop — Iteración 1

Fecha: 2026-08-05. Estado: ABIERTO. Dueño: sesión principal (Geto).

Objetivo: scorecard honesta 1-10 de CADA proceso de MamboApp, y loop continuo
de mejora hasta llevar todos los procesos a >=8 (criterio de cierre del loop:
todos los procesos puntúan >=8 con evidencia de 2 iteraciones sin regresión).

## Scorecard actual (baseline 05/08, evidencia real)

| # | Proceso | Nota | Evidencia |
|---|---------|------|-----------|
| P1 | Extracción espacial PDF (grilla/filas) | 8 | Tests FASE2-S3/S4 (matrices KZ, celdas fusionadas), 704/704 PASS. Deuda: pdfParser.js 2864 LOC, main thread |
| P2 | Sanitización de nombres/modelos | 9 | textSanitizer + tests (Transparent/High Resolution/SeaSalt), measure-model-quality FP 8%; sobrevive IT1→IT7 sin regresión (2+ iteraciones) → 9 | textSanitizer + tests (Transparent/High Resolution/SeaSalt), measure-model-quality |
| P3 | Finalización modelo/SKU/dedupe | 9 | finalizeCatalogProducts idempotente (truncados 29→2 post-gates) + 5 tests dedicados; sobrevive IT1→IT7 → 9 | finalizeCatalogProducts idempotente; truncados 29→2 post-gates |
| P4 | Asignación de imágenes | 8 | Pases 1-3 + gates: 0 cross-cat post-gates. PASE 4 HÚNGARO ARREGLADO (guard anti-loop en ambos do-while, CIERRE 05/08) + verificado IT6: 8BitDo con HUNGARIAN_P4=1 exporta en 1.4s (antes timeout 90s+), corpus de modelos idéntico, 1 imagen reasignada (reasignación óptima). Opt-in documentado. → P4: 6 → 8 |
| P5 | Gates R1-R10 (fail-closed) | 9 | G=2248 Y=66 R=0 post-gates; 0 RED; 0 GREEN sin imagen; 179 cambios automáticos |
| P6 | Motor AI/LLM (fallback escaneados) | — | **ELIMINADO por decisión del usuario (05/08 noche)**: se removió toda la integración de LLM local (localLlm.js + aiCatalogEngine.js + fallbacks en pdfParser + branch AI en importFlow + 11 tests). El flujo CSV/Excel ahora usa el parser determinístico por headers (FileImporter), PDFs solo parser espacial + sanitización. Corpus 8BitDo idéntico post-eliminación (89 productos). Ya no se puntúa |
| P7 | Grounding literal de modelo | 9 | Calibrado 39→55→17→9 falsos negativos; tolerancia prefijo; herencia de familia |
| P8 | UI (app.js 877 + 5 views) | 9 | 54 smoke (ui/*) + 117 app-smoke (app.js: switchView, badges TTL, dolar fallback offline/cache 5min, recalc, demo, confirm modal, keydown, validation panel) = 171 asserts jsdom. → P8: 8 → 9 |
| P9 | Persistencia (storage) | 9 | Suite Fallback + 18 asserts edge cases (JSON corrupto, saneo, quota deep) |
| P10 | Calculator / presupuestos | 9 | 27+4 asserts + FIX REAL IT7: FOB=0 + flete por peso ya no pierde el costo fijo (antes subCosto 0 vs 150; ahora distribuye por qty, 3 asserts TDD nuevos). Separadores mixtos documentados como deuda menor | 27+4 asserts dedicados (parseNum AR/US fix con TDD); bugs documentados: FOB=0+flete (fix en curso otra sesión), separadores mixtos |
| P11 | SKU allocator | 9 | 17 asserts dedicados (normalize, FNV-1a, colisión, reuso) + 6 tests.js; sobrevive IT1→IT7 → 9 | 17 asserts dedicados (normalize, FNV-1a, colisión, reuso) |
| P12 | Updater | 9 | UpdaterSmoke PASS + release v1.9.2 OK; warnings 0; sobrevive IT1→IT7 → 9 | UpdaterSmoke PASS + release v1.9.2 OK hoy; warnings limpiados (0 en lint) |
| P13 | Suite de tests | 9 | 837 PASS totales (704 + 49 UI + 84 logic), 3 suites en runner oficial |
| P14 | Lint | 9 | 0 errores + 0 warnings zona propia re-verificado IT6/IT7 (56 warnings restantes = pdfParser zona ajena en rewrite). Zona nueva (lazyLoaders, app-smoke, importFlow) 0 warnings → 9 | 0 errores; 0 warnings en zona propia (limpio 129→58; los 58 restantes son de zonas ajenas: 56 pdfParser en rewrite + 2 scripts paralelos) |
| P15 | Harness de medición | 9 | CATALOG_FILTER, diag por página, measure, debug env-gated |
| P16 | Auditoría (`npm run audit`) | 9 | Audit v2 sobre pipeline real, criterios fail-closed, exit code real; re-corrido FRESCO IT6 (23:11): PASS G=2248 Y=66 R=0, 0 cross-cat, 0 dup. 2 verificaciones FULL independientes (17:02 + 23:11) → 9 | Audit v2 sobre pipeline real (export+measure post-gates), criterios fail-closed, exit code real. Verificado IT6 fresco (23:11, tree limpio): PASS G=2248 Y=66 R=0 (baseline corregido — 3 cross-brand Irok/Mars post-fix-bilinear, fail-closed legítimo), 0 cross-cat, 0 duplicados |
| P17 | Build/optimización frontend | 8 | Opción 2 aplicada (decisión usuario): lazy-load de pdf.js (316K+worker 1.1MB) y xlsx (864K) → head estático = solo papaparse 20K. 5 asserts lazyLoaders (idempotencia, workerSrc, vendor local). Ahorro ~1.18MB parseo inicial + worker bajo demanda. Pendiente (deuda): bundler/minify (opción 1), nonces CSP |
| P18 | Release pipeline | 9 | bump 6 archivos + check:version + GH Actions + gh release; probado hoy |
| P19 | Performance export batch | **9** | **IT10 (06/08): render-based híbrido — AULA 261.7s → 8.7s (30x)**, Logitech 2.4→3.6s (overhead render), export completo 13 catálogos + audit fresco: **PASS G=2247 Y=67 R=0, 0 cross-cat, 0 dup, 2314 productos IDÉNTICOS al baseline (0 solo-A, 0 solo-B), 2200/2200 con img**. Fix: render de página UNA vez a escala adaptativa (pdf.js decodifica a escala de dibujo, no nativa) + proxy drawImage (posición real en canvas) + híbrido nativo para CTM degenerado/distorsionado (decode síncrono 0ms post-render) + dedup por XObject. Los 4 YELLOW extra (63→67) son imágenes que pasaron de recorte vacío/basura a foto completa real — gate de color los marca, fail-closed documentado, NO relajado. Falta: 2 iteraciones sin regresión para cerrar en 10 |

Promedio: **8.8 (IT10, 18 procesos — P6 eliminado)**. Procesos >=8: **18/18** (P19 subió a 9). Objetivo del loop: 18/18 con 9-10.

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
