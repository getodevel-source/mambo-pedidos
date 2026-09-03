# Spec: process-catalog-quality

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Dashboard de calidad por proveedor (G/Y/R, %FOB anclado, outliers, sin foto, duplicados, sin razón) + campaña de remediación con evidencia y confirmación humana.

## Estado actual (2026-09-02, corpus real)

Dashboard abre en **2ms**; campaña con ledger SKU→razón→estrategia→evidencia; `_atomicReason` preservado. Nota 7/8. En el corpus vivo: 1262G/2Y/0R, 60 outliers, 70 duplicados.

## Definición de 10 REAL

Dashboard <50ms con 5000 items gateado; remediación **por proveedor** (una fila → previsualizar cambios → aplicar) con resumen agregado; 0 UNCLASSIFIED_YELLOW tras campaña verificado por test; export del reporte idéntico al browser (mismo JSON).

## Camino al 10 (pasos)

- [ ] Remediación por proveedor con vista previa de diffs (antes/después por SKU) — la campaña por lotes global ya existe.
- [ ] Test: reporte del dashboard === audit:full sobre el mismo input (fixture).
- [ ] Gate perf:audit: apertura del modal <200ms (hoy 2ms).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check apertura calidad <200ms.
- assertAtomicReasons post-campaña (npm test).
- Invalidación: guardar correcciones sin confirmación humana.
