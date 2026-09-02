# Proposal: Process Improvement Program — tiempo, eficiencia y fiabilidad en TODOS los procesos

## Intent

Cerrar la brecha entre "la app funciona" y "la app es predeciblemente buena en
todo": cada proceso del `application-blueprint` (spec) tiene un dueño, una
medición, un objetivo (tiempo/eficiencia y/o fiabilidad) y un gate. Dos frentes
concretos que el usuario prioriza: (1) el catálogo YA cargado debe ser más
confiable — los datos pasan por gates de calidad accionables y el reporter
mide la realidad del parser actual; (2) el parser y cada proceso ganan en
eficiencia sin romper el golden (`fd0ac1d1`).

## Scope

### In Scope (por área del blueprint)
- **A/Boot + D/F/G/H/I/J**: procesos ya medidos OK pasan a gate continuo;
  los no medidos (C CSV/XLSX, G2/G3 exports, H2/H3 wizard-modales) reciben
  medición en la iteración 1.
- **B (parser) fiabilidad-eficiencia**: `ground-truth` re-etiquetado de los 65
  casos (packet) → re-baseline de `measure-model-quality` → gate de recall/FP
  del parser ACTUAL. Spike worker (Slice D del perf-sprint) para el jank.
- **E (catálogo cargado) fiabilidad**: dashboard de calidad del catálogo por
  proveedor (G/Y/R, outliers, grounded %, duplicados, sin-foto) + campaña de
  remediación sobre los 523 YELLOW con evidencia + acción manual confirmada.
- **K (photo-baseline)**: resolver las 765 imágenes <150px (mejora de
  extracción) o re-baselinear el gate con justificación de corpus.
- **L (perf)**: gates `--check` en CI para todos los umbrales.

### Out of Scope
- Reescribir el motor de extracción (worker) SIN re-validar golden — el spike
  solo produce diseño + medición.
- Cambiar el schema de persistencia (`mambo_catalog_v2`).
- Features nuevos (export PDF/Excel, OCR) que no sean mejoras de un proceso
  existente.

## Capabilities

### New
- `application-blueprint` — inventario y contrato de todos los procesos
  (esta sesión).
- `perf-engineering` — baselines/umbrales (ya creado).

### Modified
- Ningún spec vivo (import-tracker, landed-cost-verdict) se toca; `perf-engineering`
  absorbe los nuevos umbrales (E dashboard, K re-baseline) como cláusulas.

## Approach

1. **Iteración 0 — medir lo no medido**: CSV/XLSX grande, exports G2/G3,
   wizard steps, modales (H2/H3) → completar tablas del blueprint.
2. **Iteración 1 — fiabilidad del catálogo cargado (E)**: dashboard de
   calidad + campaña remediación; gates de integridad en el load.
3. **Iteración 2 — parser honesto (B/K)**: re-etiquetar 65, re-baseline,
   gate recall/FP; decisión photo-baseline.
4. **Iteración 3 — eficiencia restante (L)**: Slice B (coalescing preview),
   Slice C (cotización), perf gates CI, spike worker.
5. Cada iteración cierra con: mediciones publicadas en `docs/PERF-AUDIT.md`,
   `npm test`+`audit:import`+`audit:full`, y bump de release con
   `autoupdate-live` manual.