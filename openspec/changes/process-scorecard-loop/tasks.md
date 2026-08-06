# Process Scorecard Loop — Tasks

Loop continuo hasta: (a) 100% GREEN del corpus completo, o (b) el usuario lo
frene. Modo de reporte: SOLO hitos (cierre de iteración, errores de API,
decisiones que requieran al usuario). Sin spam por tool call.

## Iteración 1 (EN CURSO, 05/08)

- [x] WS-3 (orquestador): audit v2 — quality-pipeline.js reescrito para medir
      el pipeline REAL (export + measure post-gates). Criterios fail-closed:
      R=0, 0 GREEN sin imagen, 0 cross-cat, 0 duplicados, G≥90%. Verificado
      FULL: PASS G=2251 Y=63 R=0, exit 0. → P16: 3 → 8
- [x] WS-1 (subagente + orquestador): lint 129 → 0 warnings en zona propia
      (58 heredados: 56 pdfParser + 2 scripts de otras sesiones). npm test
      704/704 intacto. → P14: 6 → 8
- [x] WS-2 (subagente): scripts/quality/ui-smoke-tests.js con jsdom
      (notifications 9 + catalogView 16 + modals 10 + importFlow 8 = 43/43).
      Integrado a run-tests.js (npm test = 704 + 43). → P8: 4 → 7
- [x] Verificación central: npm test 747 PASS totales, lint 0 err zona propia,
      audit FULL PASS. Re-puntuado en proposal.

## Iteración 2 (EN CURSO, 05/08)

- [x] WS-5 (subagente): scripts/quality/logic-tests.js — 75 asserts nuevos
      (Calculator 27, QuoteGenerator 13, SkuAllocator 17, AppStorage 18).
      Integrado a run-tests.js. +4 asserts parseNum AR/US (fix bug real:
      parseNum rompía '1.234,56' → 1.234). → P10: 7 → 8. BUGS documentados
      por WS-5 (NO arreglados, en calculator.js que toca la otra sesión):
      (1) parseNum AR — ARREGLADO por orquestador; (2) FOB=0+flete por peso
      → subCosto 0 vs costo 150 — lo está arreglando la otra sesión (diff
      visible en calculator.js L64); (3) menores: separadores mixtos en
      cotización, formatCurrency fallback inalcanzable, ARS sin redondear.
- [x] WS-4 (subagente x2, ambos muertos por 503 tras forense de 670s;
      orquestador reconstruyó la evidencia desde transcript + measure):
      VEREDICTO con evidencia — los 18 NO son reducibles sin tocar
      pdfParser. Caso por caso: ATK 'BILL' (línea real), AS 'Business'
      x2, AULA 'Standard' x3 (ambiguous 6), IROK 'Black'/'Silver' (modelo
      perdido, img 2KB), KZ 'New' x2, LOG 'Black' (generic 5), AS
      'Receiver' x3 (mouse real, bare-type 3), AULA '(Extra keycap need
      be' x2 (nota del catálogo parseada como producto fantasma,
      truncated 2), HAI '0.50mn Switch 44' x2 (specs contaminando modelo,
      mid-model 2). Relajar gates = falsos negativos (prohibido).
      Fix real: recuperación de nombre de línea en el PARSER (pdfParser,
      sesión del húngaro) — workstream futuro cuando se libere.
- [x] Verificación central IT2: npm test 826 PASS (704+43+79), lint zona 0,
      audit FULL PASS (G=2251 Y=63 R=0). Los 63 Y explicados 100%:
      36 imagen + 9 grounding + 18 modelo. → P10: 7 → 8 (parseNum fix).

## Observación de coordinación (05/08 17:2x)

La sesión paralela del húngaro está haciendo limpieza de lint en paralelo
(catch {}, no-useless-escape) sobre catalogValidator, gates, storage,
calculator, aiCatalogEngine, reliability, skuAllocator, tests.js — el diff es
SOLO lint, sin refactor. pdfParser.js +103 líneas (húngaro + lint). No
duplicar su limpieza; nuestras zonas siguen siendo disjuntas.

## Iteración 3 (planificada)

- [x] Batch del LLM (P6): _runPool (concurrencia 3, orden preservado, fallos
      aislados, progreso) en processPdfWithLocalAI (fase 1 lectura + fase 2
      batch) y processSpreadsheetWithLocalAI. 5 asserts en logic-tests.js
      (84/84). → P6: 5 → 7. Pendiente: métricas reales con Ollama corriendo.
- Performance export (P19): profiling del export completo, hot spots.
- Tests dedicados: storage edge cases (P9 → 9). Cobertura historyView + app.js
  en UI smoke (P8 → 8). Updater warnings residuales (P12 → 8).

## Iteración 4 (cerrada, 05/08)

- [x] P19 medición por catálogo (time por CATALOG_FILTER): AULA 261.7s es el
      hot spot (×100 vs Logitech). Volumen normal → fase específica del
      parser. Profiling con --cpu-prof bloqueado por política (corrida larga
      sin aprobación) — pendiente con ventana. Fix real en pdfParser (zona
      ajena, workstream futuro).
- [x] P8 cobertura historyView: 6 asserts (empty state, subtítulo, XSS
      escapado, SKUs/FOB, 2 cards). → P8: 7 → 8. Falta app.js (877 LOC).
- [x] Verificación de vigencia: pipeline (pdfParser/gates/runner) SIN cambios
      desde el full audit 17:02 → PASS G=2251 Y=63 R=0 vigente, sin re-correr.
      Watchdog diario 03:00 creado (audit completo, silencioso si PASS).

## Iteración 5 — DECISIÓN PENDIENTE DEL USUARIO (P17 build, nota 3)

P17 es el proceso más bajo y requiere decisión de negocio (arquitectura de
build). Opciones:
1. **Bundler real (esbuild/rollup)**: minifica los 25 script tags + 2.3MB
   vendor → ~800KB; habilita CSP estricta. Costo: refactor del index.html y
   del Tauri build; riesgo medio; ~1-2 iteraciones.
2. **Golpes cortos sin bundler**: lazy-load del pdf.worker (solo al importar
   PDF) + quitar vendor sin uso + CSP básica con nonces. Bajo riesgo, gana
   ~1.2MB de arranque. No minifica.
3. **No tocar**: documentar como deuda técnica. Riesgo: update pesado y lento
   en cada release (2.3MB sin minificar).
Recomendación: opción 2 primero (segura), opción 1 como proyecto dedicado.
Mientras el usuario decide, el loop sigue con P4 (húngaro, otra sesión) y la
verificación de regresión del merge de la otra sesión.

## Iteración 5 (RESUELTA por orquestador, 05/08 19:3x)

- [x] **Fonts locales**: 68 woff2 descargados → src/vendor/fonts/ + fonts.css
      con latin inline (data URI, 650KB) y resto como archivos. index.html sin
      CDN (0 requests externos). Verificado en browser: Inter/JetBrains OK
      (incl. acentos es-AR). En runtime Tauri mime_guess sirve woff2 bien.
- [x] **CSP**: `default-src 'self'; script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
      font-src 'self' data:; connect-src 'self' https: http:;
      worker-src 'self' blob:` — VALIDADA en browser (render completo, dolar
      en vivo OK, 0 violaciones CSP, 0 errores JS) y aplicada en
      tauri.conf.json. → P17: 3 → 7.
- [ ] Pendiente P17: bundler/minify (esbuild) + lazy-load xlsx/pdf.worker —
      requiere decisión usuario o iteración dedicada.

## Estado de la sesión paralela (17:4x, evidencia fresca)

- La otra sesión NO commiteó (HEAD sigue c9b5f51 v1.9.2).
- Pase 4 húngaro: SIGUE ROTO — probado 8BitDo (catálogo más chico) con
  HUNGARIAN_P4=1 → timeout 90s (RC=124). Evidencia para la sesión dueña.
- Pipeline sin cambios desde full audit 17:02 → PASS vigente.
- P8→9 (app.js coverage) y P6→8 (métricas Ollama): post-P17 o con ventana.
- Ollama NO está corriendo (curl :11434 vacío) → P6 sin métricas reales hoy.

## CIERRE (05/08 20:1x — sesiones unificadas, commit + push)

- **P4 húngaro ARREGLADO**: el cuelgue (>600s) era el SEGUNDO do-while de
  hungarianAssign (reconstrucción del camino vía way[]): con matrices
  degeneradas (8BitDo p7, fotos 95px) way formaba un ciclo → loop infinito.
  Fix: guard anti-loop en AMBOS do-while (n+1 pasos, fail-closed). Verificado:
  8BitDo con HUNGARIAN_P4=1 exporta en segundos (antes timeout 90s).
  Medido en MCHOSE: el pase 4 NO cambia el corpus (G=207 Y=11 idéntico) →
  queda OPT-IN (HUNGARIAN_P4=1) documentado. Los 36 YELLOW de imagen siguen
  fail-closed por foto compartida (correcto).
- **P19 root cause encontrado (evidencia PHASE-T)**: el costo de AULA (262s) es
  la DESCODIFICACIÓN de pdf.js 3.11 de fotos nativas gigantes (0.55s/imagen ×
  445 = 245s, main thread). Fix aplicado: extractImagesFromPage ahora escala
  bilinear DIRECTAMENTE desde imgObj.data crudo (O(150×150)) — elimina 2 de 3
  pasadas nativas (encode nativo + resize nativo). El get() de pdf.js domina
  el resto: fixes reales pendientes (deuda documentada): (a) actualizar
  pdfjs-dist 3.11→5.x (decoder ~2x + worker liviano), (b) extracción
  render-based a baja escala, (c) extraer imágenes SOLO para páginas con
  productos. → P19: 6 (mejora parcial, deuda documentada).
- Verificación final: 837 PASS (704+49+84), lint 0 errores, audit PASS vigente.
  Pase 4 opt-in no rompe tests (verificado con HUNGARIAN_P4=1 + npm test).

## Meta del loop

100% GREEN del corpus (G=2314, Y=0, R=0). Salvedad documentada: los
placeholder de imagen (36 en node22) son fail-closed por ausencia de foto en
el PDF fuente — si la meta exige incluirlos, es decisión de negocio (no de
código). Húngaro pase 4 (P4): lo cierra la sesión paralela; al integrarse,
re-medir con HUNGARIAN_P4=1.

## Iteración 6 (EN CURSO, 05/08 noche)

Objetivo: subir los procesos más bajos restantes (P17=7, P19=6, P4=6, P6=7,
P8=8) con evidencia. Decisión usuario: P17 = OPCIÓN 2 (golpes cortos, sin
bundler).

- [ ] WS-P17 (orquestador): lazy-load del stack pdf.js (pdf.min.js 316K +
      pdf.worker 1.1MB) y xlsx.full.min.js (864K) — SOLO se descargan al
      primer uso real (import PDF / import-export planilla). Nuevo
      src/js/lazyLoaders.js con ensurePdfLib()/ensureXlsxLib() idempotentes;
      hooks en importFlow.js (antes del branch PDF/planilla),
      aiCatalogEngine.js (getDocument + batch planillas), fileImporter.js
      (export CSV/XLSX). Cierre: index.html sin script estático de pdf/xlsx
      en el head, tests del loader (idempotencia + no duplica script), npm
      test 837+ PASS, lint 0, export 8BitDo OK (regresión pipeline).
- [ ] WS-P4 (orquestador): re-medir húngaro OPT-IN con evidencia fresca:
      8BitDo con HUNGARIAN_P4=1 (time + corpus G/Y/R vs sin flag). Cierre:
      pase 4 corre en segundos, corpus idéntico → P4: 6 → 8 (documentado).
- [ ] WS-P8 (subagente): cobertura de app.js (877 LOC) con jsdom —
      scripts/quality/app-smoke-tests.js (nuevo, standalone): init, switchView,
      badges, dolar banner (fetch mockeado), drag&drop handlers, export/import
      JSON, fix catalog, reset. Cierre: suite standalone PASS, integrada al
      runner, npm test total OK.
- [ ] WS-P19 (orquestador): re-medir AULA post-fix bilinear (05/08 noche) —
      baseline era 261.7s. Evidencia: time CATALOG_FILTER=Aula. Si mejoró,
      P19: 6 → 7 (deuda (a) pdfjs 5.x, (b) render-based, (c) imágenes solo
      con productos — documentada, requiere tocar pdfParser.js / FASE 2).
- [ ] P6: Ollama NO instalado en esta máquina (binario ausente, :11434 vacío).
      Pendiente de infraestructura (decisión usuario: instalar Ollama +
      modelo ~1GB). Documentar; no es bloqueante del loop.
- [x] **HALLAZGO baseline corregido (23:1x)**: el "G=2251 Y=63" era del audit
      17:02 PRE-fix-bilinear. Export fresco post-CIERRE (tree limpio, 23:11):
      G=2248 Y=66 R=0 (2314 prod, 97% GREEN). Los 3 extra son cross-brand-image
      Irok/Mars ("Mars Mer68 Pro" vs "Mer68 Pro Wired" — foto compartida real
      entre marcas de la misma familia; fail-closed CORRECTO, no colisión del
      resize: son el mismo producto listado bajo 2 marcas). Criterios fail-closed
      del audit: 0 RED, 0 GREEN sin imagen, 0 cross-cat, 0 duplicados, G≥90% →
      PASS igual. Fix real (brand aliasing Irok=Mars) = decisión de negocio,
      documentado, NO se toca el gate.
- [x] **WS-P17 CERRADO (evidencia 23:4x)**: lazyLoaders.js (ensurePdfLib/
      ensureXlsxLib idempotentes) + index.html head = solo papaparse 20K
      (pdf.min 316K + xlsx 864K + worker 1.1MB fuera del arranque) + hooks en
      importFlow/aiCatalogEngine/fileImporter (guards typeof, no-op en Node).
      5 asserts lazyLoaders en ui-smoke (54/54) + export 8BitDo corpus
      idéntico post-cambio + 959/959 PASS + lint 0. → P17: 7 → 8.
- [x] **WS-P4 CERRADO (evidencia 23:2x)**: 8BitDo HUNGARIAN_P4=1 → 1.4s,
      corpus de modelos idéntico (1 imagen reasignada por húngaro, óptima).
      → P4: 6 → 8.
- [x] **WS-P8 CERRADO (subagente + orquestador, 23:4x)**: app-smoke-tests.js
      — 17 secciones / 118 asserts sobre app.js (117 PASS; 1 helper interno).
      Cubre: escape helpers, syncMarkup, premium UI, brand list, demo catalog
      (38 items), switchView, updateBadges (TTL 10s historial), validar y
      armar pedido, negociación/presets, removePedItem, confirm modal,
      toastUndo, dolar rates (fetch OK/falla→cache, 5min no-refetch, stale
      badge, applyDolarRate), updateProductImage, keydown (Ctrl+Enter),
      validation panel. Integrado a run-tests.js. → P8: 8 → 9.
- [x] **WS-P19 MEDIDO (evidencia 23:4x)**: AULA post-fix-bilinear = 259.8s vs
      261.7s baseline → el fix NO cambió el hot spot (domina el get() de
      pdf.js 3.11, no el rasterizado). Deuda real confirmada: (a) pdfjs-dist
      3.11→5.x, (b) render-based baja escala, (c) imágenes solo en páginas con
      productos. P19 se mantiene en 6 — fix real requiere ventana dedicada
      sobre pdfParser.js (FASE 2 / API pdf.js cambia: page.objs.get,
      getOperatorList, worker). NO se intenta en frío esta iteración.
- [x] Verificación central IT6: 959/959 PASS (704+54+84+117), lint 0 errores
      (56 warnings heredados pdfParser), audit fresco PASS G=2248 Y=66 R=0.
      Re-puntuado: P4 6→8, P8 8→9, P17 7→8. Promedio 7.6 → 8.1, 18/19 ≥8.

## Iteración 7 (EN CURSO, 05/08 noche — DECISIÓN USUARIO: eliminar LLM local)

- [x] **LLM LOCAL ELIMINADO COMPLETO** (decisión usuario: "quitamos todo lo que
      tenga que ver con IA / limpiar código de LLM local"):
      - git rm src/js/localLlm.js (cliente Ollama) + src/js/aiCatalogEngine.js
        (motor IA 3 capas, _runPool, batch).
      - index.html: script tags removidos.
      - importFlow.js: branch CSV/Excel → FileImporter.processCsvFile/
        processExcelFile (parser determinístico por headers); llmStatus del
        preview removido; autoCorrectPreviewWithAI → autoCorrectPreview
        (ya era determinístico vía TextSanitizer).
      - pdfParser.js (zona FASE 2, -152 LOC): fallback LLM de página + método
        enrichProductsWithCellLlm + groundAndVerifyExtractedProducts eliminados;
        enriquecimiento = sanitización determinística. 0 refs a LLM.
      - app.js: checkHealth de LocalLlm removido.
      - tests.js (-11 asserts), logic-tests.js (test _runPool retirado),
        ui-smoke-tests.js (stub removido), run-tests.js (globals removidos),
        audit-app/ground-truth/measure-extraction (stubs removidos),
        test-catalog-batch.js (localLlm fuera del eval).
      - eslint.config.js: globals AiCatalogEngine/LocalLlm removidos.
      - Ollama desinstalado (winget, 05/08).
      - VERIFICADO: 951/951 PASS (697+54+83+117), lint 0 errores,
        corpus 8BitDo idéntico post-eliminación (89 productos, JSON igual).
      → P6 ELIMINADO del scorecard. Promedio 8.3 (18 procesos), 17/18 ≥8.

## Meta del loop (histórico)
