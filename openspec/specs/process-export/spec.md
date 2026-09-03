# Spec: process-export

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Exportaciones: JSON de diagnóstico (opciones scope/imágenes/formato, evidencia del parser, sin artefactos runtime), packing list, ejecutivo, quote CSV.

## Estado actual (2026-09-02, corpus real)

JSON 3-49ms según opciones · packing 23ms · ejecutivo 28ms · CSV 11ms. Nota 9/9.

## Definición de 10 REAL

Todos los exports <100ms gateados en perf-smoke (CI, sin corpus); contrato byte-estable del JSON verificado; gates por tamaño (<20MB con thumbs, <1MB sin imágenes).

## Camino al 10 (pasos)

- [ ] Ampliar perf-smoke con packing/ejecutivo/CSV (hoy mide JSON + quote CSV).
- [ ] Bajar umbral JSON a 300ms tras margen.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:export gates (600ms, sin imgs <1MB).
- npm test: 0 `_imageRef`/`_selected` en el JSON (existe).
- Invalidación: reintroducir artefactos runtime.
