# Spec: process-modals

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Modales de análisis: proveedores, sensibilidad, break-even, door-to-door, brand manager — cálculos puros en Calculator.

## Estado actual (2026-09-02, corpus real)

Aperturas **0-20ms**. Nota 9/8.

## Definición de 10 REAL

Apertura <50ms gateado; cada cálculo con fixture de contrato en tests (la mayoría ya existe).

## Camino al 10 (pasos)

- [ ] Umbrales check 200→100ms.
- [ ] Fixtures de contrato para los 5 modales (revisar cobertura existente).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check modales <200ms.
- npm test cálculos (existe).
- Invalidación: cálculo con fixture roto.
