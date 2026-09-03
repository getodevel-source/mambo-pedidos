# Spec: process-wizard

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Asistente de importación (6 pasos): NCM, régimen, fletes, veredicto; estado autoguardado (WIZARD/PROJECT).

## Estado actual (2026-09-02, corpus real)

open **1ms** · 6 pasos **156ms** · NCM lazy. Nota 9/8.

## Definición de 10 REAL

Pasos <300ms gateados; primer lookup NCM <500ms gateado (lazy load medido); draft nunca se pierde (tests de restauración existen).

## Camino al 10 (pasos)

- [ ] Medir y gatear el primer NCM lookup en perf-audit (hoy solo se mide el paso).
- [ ] Umbral de pasos 1000→400ms.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check wizardSteps <1000ms (hoy 156).
- npm test restauración de draft (existe).
- Invalidación: perder el draft.
