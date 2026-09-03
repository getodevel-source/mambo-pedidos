# Spec: process-import-csv-xlsx

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Importación determinística por headers de CSV (PapaParse) y XLSX (SheetJS lazy). Entradas: archivo + catálogo actual. Salidas: items con skips reportados.

## Estado actual (2026-09-02, corpus real)

CSV 5000 filas **39ms** · XLSX **207ms**. Nota 9/8. Skips sin modelo/FOB reportados; roundtrip físico en CI.

## Definición de 10 REAL

CSV <100ms y XLSX <300ms gateados en `perf-smoke` (CI) con fixture de 5000 filas; control de skips explícito en la vista (contador + razón) y test de regresión por formato.

## Camino al 10 (pasos)

- [ ] Agregar la fase CSV/XLSX a `perf-smoke` con umbrales (ya mide; falta pin con 3 releases).
- [ ] UI: aviso de 'N filas salteadas (sin FOB/modelo)' post-import (hoy solo toast).

## Gates anti-smoke (qué mantiene el 10 real)

- perf-smoke: csv<300ms/xlsx<500ms en CI.
- npm test: roundtrip físico + skips.
- Invalidación: silenciar los skips.
