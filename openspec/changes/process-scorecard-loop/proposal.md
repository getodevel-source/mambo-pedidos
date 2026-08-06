# Process Scorecard Loop — Iteración 1

Fecha: 2026-08-05. Estado: ABIERTO. Dueño: sesión principal (Geto).

Objetivo: scorecard honesta 1-10 de CADA proceso de MamboApp, y loop continuo
de mejora hasta llevar todos los procesos a >=8 (criterio de cierre del loop:
todos los procesos puntúan >=8 con evidencia de 2 iteraciones sin regresión).

## Scorecard actual (baseline 05/08, evidencia real)

| # | Proceso | Nota | Evidencia |
|---|---------|------|-----------|
| P1 | Extracción espacial PDF (grilla/filas) | 8 | Tests FASE2-S3/S4 (matrices KZ, celdas fusionadas), 704/704 PASS. Deuda: pdfParser.js 2864 LOC, main thread |
| P2 | Sanitización de nombres/modelos | 8 | textSanitizer + tests (Transparent/High Resolution/SeaSalt), measure-model-quality |
| P3 | Finalización modelo/SKU/dedupe | 8 | finalizeCatalogProducts idempotente; truncados 29→2 post-gates |
| P4 | Asignación de imágenes | 6 | Pases 1-3 + gates: 0 cross-cat post-gates; PASE 4 HÚNGARO ROTO (cuelga >600s, desactivado por guard; export node26 = 2 bytes). Otra sesión lo está reescribiendo |
| P5 | Gates R1-R10 (fail-closed) | 9 | G=2251 Y=63 R=0 post-gates; 0 RED; 0 GREEN sin imagen; 179 cambios automáticos |
| P6 | Motor AI/LLM (fallback escaneados) | 7 | Batch con concurrencia limitada (_runPool, 5 asserts: orden, límite 3, aislamiento de fallos, progreso) en PDF y planillas. Pendiente: métricas reales con Ollama |
| P7 | Grounding literal de modelo | 9 | Calibrado 39→55→17→9 falsos negativos; tolerancia prefijo; herencia de familia |
| P8 | UI (app.js 877 + 5 views) | 8 | 49 smoke asserts (jsdom): notifications, catalogView, modals, importFlow, historyView (empty/XSS/poblado). Pendiente: app.js |
| P9 | Persistencia (storage) | 9 | Suite Fallback + 18 asserts edge cases (JSON corrupto, saneo, quota deep) |
| P10 | Calculator / presupuestos | 8 | 27+4 asserts dedicados (parseNum AR/US fix con TDD); bugs documentados: FOB=0+flete (fix en curso otra sesión), separadores mixtos |
| P11 | SKU allocator | 8 | 17 asserts dedicados (normalize, FNV-1a, colisión, reuso) |
| P12 | Updater | 8 | UpdaterSmoke PASS + release v1.9.2 OK hoy; warnings limpiados (0 en lint) |
| P13 | Suite de tests | 9 | 837 PASS totales (704 + 49 UI + 84 logic), 3 suites en runner oficial |
| P14 | Lint | 8 | 0 errores; 0 warnings en zona propia (limpio 129→58; los 58 restantes son de zonas ajenas: 56 pdfParser en rewrite + 2 scripts paralelos) |
| P15 | Harness de medición | 9 | CATALOG_FILTER, diag por página, measure, debug env-gated |
| P16 | Auditoría (`npm run audit`) | 8 | Audit v2 sobre pipeline real (export+measure post-gates), criterios fail-closed, exit code real. Verificado FULL: PASS G=2251 Y=63 R=0, 0 cross-cat, 0 duplicados |
| P17 | Build/optimización frontend | 7 | Fonts locales (68 woff2, latin inline data-URI — sin CDN, 0 dependencia de red) + CSP validada en browser (0 violaciones, 0 errores JS) aplicada en tauri.conf.json. Pendiente: bundler/minify + lazy-load vendor |
| P18 | Release pipeline | 9 | bump 6 archivos + check:version + GH Actions + gh release; probado hoy |
| P19 | Performance export batch | 6 | Medido 05/08: 8BitDo 2.4s, Logitech 2.4s, Madlions 1.4s, KZ 6.7s, Razer 12.4s, MCHOSE 78.5s, AULA 261.7s (!). Hot spot: AULA/MCHOSE/Attack Shark — volumen normal (25 págs/351 prods/3MB imgs) → fase específica del parser (profiler pendiente; fix en pdfParser, zona ajena) |

Promedio: 7.6 (IT5). Procesos >=8: 16/19. Objetivo del loop: 19/19.

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
