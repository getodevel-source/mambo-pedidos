# Spec: process-validation-gates

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Composición del semáforo: CatalogValidator (R1-R10 + outliers) → ImageTextGates → ImportGates con razones atómicas; F3: YELLOW-de-datos deseleccionados.

## Estado actual (2026-09-02, corpus real)

3 gates **48ms** en 2080 items. Nota 9/9. 0 falsos positivos de modelo; invariant: todo no-GREEN lleva razón atómica.

## Definición de 10 REAL

Validación <100ms sostenido gateado; **assertAtomicReasons al 100%** verificado en CI con corpus sintético; decisiones del semáforo auditables en el dashboard (spec process-catalog-quality).

## Camino al 10 (pasos)

- [ ] Bajar umbral del check a 200ms (hoy 48).
- [ ] CI: correr los gates sobre el corpus sintético y exigir 0 UNCLASSIFIED_YELLOW.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check gates <200ms.
- assertAtomicReasons en npm test (existe).
- Invalidación: agregar un gate que degrade sin razón.
