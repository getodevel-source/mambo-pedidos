# Spec: process-history

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Historial de cotizaciones: guardado con snapshot, render, reimpresión condicional (solo con detalle).

## Estado actual (2026-09-02, corpus real)

render **2ms** · reimprimir **1ms** · saveToHistory 6ms. Nota 10/9.

## Definición de 10 REAL

Ya medido en techo; gate en perf-audit (<50ms) y test de reimpresión sin detalle → aviso (existe).

## Camino al 10 (pasos)

- [ ] Ninguno (techo alcanzado); solo mantener los gates.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check <50ms.
- npm test renderQuotes/inyección (existe).
- Invalidación: reimprimir documento vacío.
