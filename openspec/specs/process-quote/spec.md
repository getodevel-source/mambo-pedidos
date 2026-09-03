# Spec: process-quote

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Generación de cotización imprimible: Intl cacheados, filas con thumbs, snapshot en historial, CSV export.

## Estado actual (2026-09-02, corpus real)

1200 items **337ms** (era 365); 20k formatos 51ms. Nota 8/9.

## Definición de 10 REAL

Cotización <200ms/1200 items gateado (CI con fixture); HTML byte-estable verificado por test; snapshot siempre guardado (reimprimir nunca en blanco).

## Camino al 10 (pasos)

- [ ] Precompilar filas (join + formatters ya cacheados) para <250ms; bajar a <200ms con medición.
- [ ] Umbral perf:audit 500→300ms tras margen.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check cotización <500ms (hoy 337); meta <300.
- Hash estable del HTML en npm test (existe formato).
- Invalidación: cotización sin snapshot.
