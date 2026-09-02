# Proposal: Performance Sprint — baselines, eliminación de cuellos y gates automáticos

## Intent

La auditoría integral (`docs/PERF-AUDIT.md`, `npm run perf:audit`) dejó la app
en ~95% sano: boot 60ms, restore 165ms, confirm 278ms, imágenes 151→25MB. Los
procesos que siguen dominando el presupuesto de CPU/tiempo y los que no tienen
gate de regresión son el objeto de este sprint: (1) el **export JSON** — la
ventana del usuario a los resultados del parser, hoy sin opciones y con
artefactos runtime en el archivo; (2) la **re-validación por edición** en el
preview de import (hoy re-valida los 2080 items por tecla); (3) la **cotización
HTML** de pedidos grandes (365ms/1200 items); (4) el **jank del parse** (9.8s en
107 longtasks — el único bloqueo real de UI); y (5) **gates de performance
automáticos** (CI) para que ninguna regresión vuelva a pasar.

## Scope

### In Scope
- **Slice A — Export JSON como diagnóstico**: modal de exportación sobre
  `exportCatalogJSON` (catálogo actual o preview con evidencia del parser),
  opciones de imágenes (thumb/ninguna) y formato (pretty/compact), orden
  estable de campos, sin artefactos runtime (`_imageRef`, `_selected`).
  Gate: stringify < 600ms y archivo < 20MB con 2080 items.
- **Slice B — Re-validación del preview sin jank**: las ediciones del modal
  (modelo/variante/cat/fob) coalescen la `runImportVerification` completa en
  idle/debounce; edición individual sigue re-validando ese ítem en vivo.
  Gate: editar 10 ítems seguidos < 2s totales (hoy ~2.3s).
- **Slice C — Cotización de pedidos grandes**: formatters `Intl` cacheados y
  build de HTML por lotes. Gate: 1200 items < 250ms (hoy 365ms).
- **Slice D — Import sin jank (diseño + spike, SIN tocar golden)**: estudio de
  Web Worker + OffscreenCanvas para el parse; artefacto de diseño y spike de
  viabilidad; la implementación va en el proyecto parser (FASE 2 reabierta con
  re-validación de ground-truth) — fuera del sprint salvo el spike.
- **Slice E — Perf gates en CI**: `npm run perf:audit --check` con umbrales
  por proceso (A boot <500ms, B parse <60s por corpus, C confirm <1s,
  E render <50ms, F cotización <500ms, memoria heap <400MB); job nuevo en
  `ci.yml` + `release.yml`; incumplimiento = fail del pipeline.

### Out of Scope
- Cambios al motor de extracción (`pdfParser.js`/`parser/*`) — golden
  `fd0ac1d1`, FASE 2 cerrada; solo el spike de Slice D toca el tema.
- Migración del schema de persistencia (contrato `mambo_catalog_v2`).
- `ground-truth/`, `scripts/measure-*`, `scripts/ground-truth*` (core de FASE 2).
- Features nuevos de export (PDF/Excel) — solo el JSON existente.

## Capabilities

### New Capabilities
- `perf-engineering`: baselines medidos por proceso, umbrales de gate
  (`--check`) y policy de iteración (medir → atacar → gate).

### Modified Capabilities
None — los specs vivos (import-tracker, landed-cost-verdict) no se tocan.

## Approach

1. Medir primero (harness existente `perf-audit` + benchmark nuevo de export);
   cada slice arranca con su baseline registrado en `docs/PERF-AUDIT.md`.
2. TDD estricto por slice (RED → GREEN vía `npm test`), luego gate de perf
   (`perf:audit`/`perf:export`), luego integer con `audit:import`.
3. Slice D produce diseño + spike de viabilidad (un branch, sin merge de
   motor); los demás slices se integran como hoy (browser-global, sin
   dependencias nuevas).
4. Al cerrar cada slice: fetch del changelog de perf en `docs/PERF-AUDIT.md`
   y bump menor (v2.2.2x) con `autoupdate-live` manual (quirk documentado).