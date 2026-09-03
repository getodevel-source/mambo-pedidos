# Spec: process-catalog-read

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Lectura del catálogo cargado: render (60 filas), filtros, chips, paginación, búsqueda debounce, selección, zoom full-res por archivo.

## Estado actual (2026-09-02, corpus real)

render 3-18ms · búsqueda ~50ms netos · zoom full-res. Nota 9-10/9.

## Definición de 10 REAL

Render <20ms y búsqueda neta <100ms gateados; índice de búsqueda por tokens cuando el catálogo pase de 4000 (hoy la línea completa por ítem es suficiente).

## Camino al 10 (pasos)

- [ ] Umbrales del check bajar a 30ms/200ms tras margen.
- [ ] Índice de tokens SOLO si la medición >150ms netos con >4000 items (decisión por dato, no preventiva).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check render <50ms, búsqueda <700ms brutos.
- Invalidación: render O(n²) con los filtros.
