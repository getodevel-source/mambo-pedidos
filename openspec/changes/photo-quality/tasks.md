# Tasks — photo-quality (imágenes de catálogo a archivos + calidad ≥300px)

Coordinación: NO mergear sobre la FASE 2 (`table-parser-column-detection`) abierta.
Verificación por unidad: `npm test` (unit en `src/js/tests.js`) + gates FASE 2 intactas.

## Unidad 1 — Medición base (cero código de app)

- [ ] 1. Correr `node scripts/_dbg_real_audit.js` y guardar el baseline (avg lado
      menor, % <150px, tamaño total) como referencia de regresión.
- [ ] 2. Correr la variante a 300px (`_dbg_real_audit300.js`) y anotar el tamaño
      total en filesystem equivalente. Confirmar el número de ~139MB vs 35MB.
- [ ] 3. Commit `chore: photo-quality baseline audit`.

## Unidad 2 — Gate de crop marginal (unit, TDD)

Problema: `stdev < 15` no detecta recorte que agarra el borde (MCHOSE).

- [x] 1. Test en `src/js/tests.js`: imagen casi-blanca con franja oscura →
      `isMarginalCrop(...) === true`; foto completa → `false`. RED.
- [x] 2. Implementar `isMarginalCrop` en el módulo de imagen (nuevo
      `src/js/imageQuality.js`): fracción de píxeles no-fondo < umbral → marginal.
- [x] 3. GREEN + mostrar el caso MCHOSE real como fixture.
- [x] 4. Commit `feat(import): detect marginal crops`.

## Unidad 3 — Calidad: subir cap (Fase A, stopgap)

- [x] 1. Test: `extractImagesFromPage` produce lado menor ≥300px para una foto
      nativa ≥400px. RED.
- [x] 2. `MAX_DIM` 150→300 en `pdfParser.js` (ruta render). GREEN.
- [x] 3. Presupuesto: medir tamaño de catálogo resultante; si >quota store real,
      documentar y priorizar Unidad 4.
- [x] 4. Commit `feat(import): raise image cap to 300px`.

## Unidad 4 — Persistencia a archivos (Fase B, la real)

- [x] 1. Test: `Storage.saveCatalog` escribe imágenes a
      `app-data/images/<cat>/<sku>.png` y guarda ref en el JSON; carga async.
      RED.
- [x] 2. Implementar en `src/js/storage.js`: al guardar, separar data URLs →
      archivos (fs plugin, permisos ya presentes); al cargar, lazy-load.
- [x] 3. GC: al sobrescribir catálogo, eliminar PNGs huérfanos. Test RED→GREEN.
- [x] 4. Contrato del parser intacto: `processPdfFile` sigue devolviendo data URLs.
- [x] 5. Commit `feat(storage): images to files, decouple quality from JSON quota`.

## Unidad 5 — Migración de catálogos existentes

- [ ] 1. Script `scripts/_dbg_` (o real) que re-extrae los 13 catálogos con
      MAX_DIM=300/400 y persiste a archivos. Correr contra `C:\Mambo\Catalogos`.
- [ ] 2. Validar con `_dbg_real_audit.js`: avg ≥300px, `<150px` ≈ 0, storage medido.
- [ ] 3. Commit `feat(import): re-import catalogs at 300px to image files`.

## Unidad 6 — Verificación final

- [x] 1. `npm test` + `npm run lint` + `npm run build` 🟢.
- [ ] 2. Gates FASE 2 (ground-truth + measure-model-quality) sin regresión.
- [ ] 3. Auditoría visual: sample de fotos a 300px, nenhua rota.
- [ ] 4. Commit `chore: photo-quality verified`.

## Fuera de alcance (no en esta iteración)

- Mover el parser a Rust (decisión separada, no bloquea calidad).
- Subir calidad de fotos cuyo nativo en el PDF es <300px (no hay ganancia).

## Reconciliación 2026-08-29 (por evidencia de código y ejecución)

- **Unidad 6.1 CERRADA** con corrida fresca sobre `840d479`: `npm run test` 1.472
  aserciones en 4 suites (1.003 unitarias + 101 UI smoke + 239 lógica + 129 app
  jsdom), 0 fallos; `npm run lint` 0 errores; `npm run build:frontend` OK.
  `npm run build` (tauri) NO corre en esta máquina: no hay toolchain Rust.
- **Unidad 6.2 PARCIAL**: `scripts/measure-model-quality.js` ejecuta y está en
  verde contra la meta archivada (`archive/parser-to-10`: recall ≥85%, FP ≤8%) —
  recall_dirty 100% (40/40, 0 FN), FP_rate_clean 8% (2/25). En cambio
  `scripts/ground-truth.js` no es ejecutable acá: `ENOENT scandir
  C:\Mambo\Catalogos`. Ese gate necesita los 13 PDFs originales.
- **Unidades 1 y 2 BLOQUEADAS, no pendientes a secas**: piden correr
  `scripts/_dbg_real_audit.js` / `_dbg_real_audit300.js`, que son scratch nunca
  versionados (hoy no existen) y dependen del mismo `C:\Mambo\Catalogos`
  ausente. El techo de 300px sí landed (`449bc5f`), y
  `scripts/export-catalog-batch.js` ya dibuja a 300 (líneas 73 y 214) pero
  hardcodea `CATALOG_DIR = "C:\Mambo\Catalogos"` (línea 17).
- **La persistencia de imágenes a archivos estaba rota y se arregló hoy
  (`06d083c`)**: el Slice 5b llamaba la API v1 del plugin fs y no pasaba
  `baseDir`, además de un `window.__TAURI__.fs` inexistente en v2. Es decir:
  "images a archivos" nunca había escrito un solo archivo. Los audits de
  tamaño/storage de esta unidad se miden sobre un camino que recién ahora
  funciona, así que el baseline viejo no sirve como referencia de regresión.
