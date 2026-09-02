# Tasks: Process Improvement Program — work units por iteración

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | >1200 en total (4 iteraciones) |
| 400-line budget risk | Alto |
| Chained PRs recommended | Sí (una PR por iteración, como máximo) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

### Work Units

| Unit | Goal | Test command | Runtime harness | Rollback boundary |
|------|------|--------------|-----------------|-------------------|
| I0 | Medir procesos sin baseline (C, G2/G3, H2/H3) | `npm run perf:audit --check` (post-umbrales) | harness con fixtures CSV/export/wizard | revert scripts de benchmark + umbrales |
| I1 | Dashboard calidad + campaña YELLOW | `npm test` + audit:full | app real con catálogo cargado | revert dashboard + remediation UI |
| I2 | Re-etiquetado 65 + re-baseline + photo | `ground-truth-diff` 100% + measure-model-quality | scripts ground-truth | revert manifest/verdicts (git) |
| I2b | Spike worker (branch) | informe de spike | branch | no merge; solo docs |
| I3 | Slice B + Slice C + gates CI | `npm test` + perf:audit --check | harness perf | revert por archivo |

---

## Iteración 0 — medir lo no medido

- [ ] 0.1 CSV/XLSX: fixture de 5000 filas → harness mide FileImporter.processCsvFile/
      processExcelFile (tiempo + memoria); fijar umbral propuesto en design §2.
- [ ] 0.2 Exports del pedido: CSV (exportCsv), packing list, reporte ejecutivo,
      customs → medición con pedido de 1200; fijar umbrales.
- [ ] 0.3 Wizard: tiempo de apertura por paso + primer lookups NCM (lazy load);
      modales: apertura + cálculo (compare/sensibilidad/break-even/d2d/brand).
- [ ] 0.4 Publicar números en `docs/PERF-AUDIT.md` y completar el blueprint
      (tablas C/G/H).

## Iteración 1 — fiabilidad del catálogo cargado

- [ ] 1.1 RED: tests del agregador de calidad (por proveedor: G/Y/R, %grounded,
      outliers, sin-foto, duplicados) con catálogo fixture — debe coincidir con
      audit:full sobre el mismo input.
- [ ] 1.2 GREEN: `CatalogQualityReport` en `catalogValidator.js` (o módulo
      propio) + `window.showCatalogQuality()` con modal + tabla por proveedor
      + botones (remediar, exportar reporte JSON vía buildCatalogExportJSON).
- [ ] 1.3 Campaña YELLOW: UI de revisión por lotes (modelo limpio sugerido /
      corregir / descartar) que ejecuta la remediación con evidencia y persiste;
      assert `ImportGates.assertAtomicReasons` == true post-campaña.
- [ ] 1.4 Integer: `npm run audit:full` con los mismos datos → dashboard ===
      semáforo del reporte; apertura <200ms con 2080 items.

## Iteración 2 — parser honesto (fiabilidad)

- [ ] 2.1 `node scripts/ground-truth-diff.js --packet` → revisar los 65 casos
      (modelo/variante/FOB/marca) con los crops; commit del re-etiquetado
      (manifest + verdicts actualizados, casados por posición).
- [ ] 2.2 `measure-model-quality` sobre el manifest nuevo → registrar recall/FP
      del parser ACTUAL en `docs/PERF-AUDIT.md` (sección parser).
- [ ] 2.3 Job CI `quality-gates`: ground-truth-diff (0 huérfanos) +
      measure-model-quality (recall ≥ baseline−2pp, FP ≤ baseline+2pp) +
      assignment-audit sin regresión.
- [ ] 2.4 Photo-baseline: investigar los PDFs con >40% de imágenes <150px
      (crops por proveedor); decisión: mejorar extracción (si el PDF tiene
      resolución) o re-baselinear con justificación en el commit.
- [ ] 2.5 Spike worker (branch): diseño en `docs/SPIKE-WORKER-PARSE.md` +
      medición worker-vs-main sobre 3 PDFs (tiempo, jank, hash vs golden);
      verdict documentado.

## Iteración 3 — eficiencia restante + gates CI

- [ ] 3.1 Slice B (perf-sprint): edición de preview con validación por ítem +
      trailing 350ms + idle; gate 10 ediciones <2s.
- [ ] 3.2 Slice C: `QuoteGenerator._fmt` cache + join; gate <250ms/1200 + HTML
      byte-estable.
- [ ] 3.3 `perf-audit --check` + `perf-export --check` con umbrales L; jobs en
      ci.yml y release.yml.
- [ ] 3.4 Cerrar changelog en `docs/PERF-AUDIT.md` y blueprint (todo ✅ gateado
      salvo lo diferido con razón).