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

- [ ] 1. Test en `src/js/tests.js`: imagen casi-blanca con franja oscura →
      `isMarginalCrop(...) === true`; foto completa → `false`. RED.
- [ ] 2. Implementar `isMarginalCrop` en el módulo de imagen (nuevo
      `src/js/imageQuality.js`): fracción de píxeles no-fondo < umbral → marginal.
- [ ] 3. GREEN + mostrar el caso MCHOSE real como fixture.
- [ ] 4. Commit `feat(import): detect marginal crops`.

## Unidad 3 — Calidad: subir cap (Fase A, stopgap)

- [ ] 1. Test: `extractImagesFromPage` produce lado menor ≥300px para una foto
      nativa ≥400px. RED.
- [ ] 2. `MAX_DIM` 150→300 en `pdfParser.js` (ruta render). GREEN.
- [ ] 3. Presupuesto: medir tamaño de catálogo resultante; si >quota store real,
      documentar y priorizar Unidad 4.
- [ ] 4. Commit `feat(import): raise image cap to 300px`.

## Unidad 4 — Persistencia a archivos (Fase B, la real)

- [ ] 1. Test: `Storage.saveCatalog` escribe imágenes a
      `app-data/images/<cat>/<sku>.png` y guarda ref en el JSON; carga async.
      RED.
- [ ] 2. Implementar en `src/js/storage.js`: al guardar, separar data URLs →
      archivos (fs plugin, permisos ya presentes); al cargar, lazy-load.
- [ ] 3. GC: al sobrescribir catálogo, eliminar PNGs huérfanos. Test RED→GREEN.
- [ ] 4. Contrato del parser intacto: `processPdfFile` sigue devolviendo data URLs.
- [ ] 5. Commit `feat(storage): images to files, decouple quality from JSON quota`.

## Unidad 5 — Migración de catálogos existentes

- [ ] 1. Script `scripts/_dbg_` (o real) que re-extrae los 13 catálogos con
      MAX_DIM=300/400 y persiste a archivos. Correr contra `C:\Mambo\Catalogos`.
- [ ] 2. Validar con `_dbg_real_audit.js`: avg ≥300px, `<150px` ≈ 0, storage medido.
- [ ] 3. Commit `feat(import): re-import catalogs at 300px to image files`.

## Unidad 6 — Verificación final

- [ ] 1. `npm test` + `npm run lint` + `npm run build` 🟢.
- [ ] 2. Gates FASE 2 (ground-truth + measure-model-quality) sin regresión.
- [ ] 3. Auditoría visual: sample de fotos a 300px, nenhua rota.
- [ ] 4. Commit `chore: photo-quality verified`.

## Fuera de alcance (no en esta iteración)

- Mover el parser a Rust (decisión separada, no bloquea calidad).
- Subir calidad de fotos cuyo nativo en el PDF es <300px (no hay ganancia).