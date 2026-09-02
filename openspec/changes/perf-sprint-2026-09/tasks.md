# Tasks: Performance Sprint — por slice con gates

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600–800 (Slice A+C~150, B~120, E~150, D diseño~80) |
| 400-line budget risk | Medio |
| Chained PRs recommended | Sí |
| Suggested split | PR A → PR B → PR C → PR E (D queda en branch de spike) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Export JSON diagnóstico (Slice A) | PR A | `npm test` + `npm run perf:export` | Open app → exportar con opciones → JSON sin `_imageRef` | Revert catalogValidator.js export + modal en index.html |
| 2 | Re-validación preview coalescida (Slice B) | PR B | `npm test` (flow tests) | import → editar 10 ítems → semáforo estable | Revert importFlow.js updatePreviewItem |
| 3 | Cotización con Intl cacheado (Slice C) | PR C | `npm test` (quote hash stable) | pedido 1200 → imprimir → <250ms | Revert quoteGenerator.js |
| 4 | Perf gates CI (Slice E) | PR E | `npm run perf:audit --check` | CI job perf-gates | Revert workflow + umbrales |
| 5 | Worker spike (Slice D) | branch solo | spike report | branch | no merge; solo diseño + medición |

## Phase 1: Export JSON diagnóstico (Slice A)

- [ ] 1.1 RED: `buildCatalogExportJSON` tests en `tests.js` — (a) nunca emite
  `_imageRef`/`_selected`; (b) `images:'none'` omite `img`; (c) orden de campos
  estable (whitelist); (d) scope `preview` conserva `rawText`/`cellRawText`/
  `_evaluations` cuando existen; (e) pretty vs compact difieren solo en
  whitespace (mismo `JSON.parse`).
- [ ] 1.2 GREEN: implementar `buildCatalogExportJSON(items, opts)` en
  `catalogValidator.js` (puro, browser-global + module.exports).
- [ ] 1.3 UI: `exportCatalogJSON` abre modal con `scope`/`images`/`pretty` +
  botón descarga (Blob + `a.click()`); mantener fallback directo si el modal
  no existe (tests Node).
- [ ] 1.4 Perf baseline: `scripts/perf-export.mjs` mide stringify/bytes/
  heap para las 4 combinaciones; gate: stringify < 600ms; sin imágenes
  < 200ms; escribir `/tmp/perf-export.json`.
- [ ] 1.5 Integer: `npm run audit:import` verde; export manual en Chromium:
  archivo descargado sin `_imageRef`, con `warnings`/`qualityReason`.
- [ ] 1.6 Changelog en `docs/PERF-AUDIT.md` (tabla export).

## Phase 2: Re-validación del preview sin jank (Slice B)

- [ ] 2.1 RED: tests de flujo — dictado de 5 ediciones rápidas dispara ≤1
  verificación completa; semáforo final idéntico al full verify; edición
  individual aún re-validada en vivo.
- [ ] 2.2 GREEN: `updatePreviewItem` → validación ligera por ítem +
  `scheduleTrailing` (350ms) + `requestIdleCallback` para el full verify +
  re-render.
- [ ] 2.3 Perf: 10 ediciones seguidas < 2s (hoy ~2.3s); gate en
  `perf-audit --check` (ediciones:add).
- [ ] 2.4 Integer: `npm run audit:import` + `api de semáforo` estable.

## Phase 3: Cotización con Intl cacheado (Slice C)

- [ ] 3.1 RED: quote hash estable para mismo pedido; test de formatter cache
  (mismo objeto/función para la misma moneda).
- [ ] 3.2 GREEN: caché `QuoteGenerator._fmt` por `locale|currency|decimals`;
  filas con `join('')`.
- [ ] 3.3 Perf: 1200 items < 250ms (hoy 365ms); gate en `perf:audit --check`.
- [ ] 3.4 Integer: `npm test` completo + print de cotización en harness.

## Phase 4: Perf gates en CI (Slice E)

- [ ] 4.1 `perf-audit.mjs --check` con umbrales del design (tabla sección 5);
  exit≠0 con diff de fases.
- [ ] 4.2 Job `perf-gates` en `ci.yml` (node 22 + chromium del sistema +
  `MAMBO_CATALOG_DIR` del runner — subir corpus al runner o usar corpus de
  fixture generado).
- [ ] 4.3 Job en `release.yml` post-build (misma receta que visual-smoke).
- [ ] 4.4 Docs: procedimiento de actualización de umbrales (solo con evidencia
  de baseline nuevo aprobado).

## Phase 5: Import sin jank (Slice D — spike)

- [ ] 5.1 Diseño detallado en `docs/SPIKE-WORKER-PARSE.md`: arquitectura
  worker/OffscreenCanvas, contrato de mensajes, manejo de `onProgress` y de
  imágenes (dataURLs vía `createImageBitmap`), riesgos golden.
- [ ] 5.2 Spike en branch: script headless que corre el parse en worker vs
  main sobre 3 PDFs; mide tiempo, longtasks del main, hash de extracción
  contra golden.
- [ ] 5.3 Verdict: merge del diseño al repo (doc), el código va al proyecto
  parser (FASE 2 reabierta con su propio change).