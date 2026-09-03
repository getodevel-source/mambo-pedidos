# Spec: process-perf-gates

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Los gates que vigilan todos los demás: perf:audit --check (corpus real, local), perf:smoke (CI mecánica), perf:export, y en el futuro corpus sintético en CI.

## Estado actual (2026-09-02, corpus real)

--check ✅ con corpus real · perf-smoke ✅ en CI · umbrales por fase. Nota 8/8.

## Definición de 10 REAL

Corpus sintético con ground-truth conocido en CI → tiempos, jank, recall/FP y persistencia se miden en CADA PR sin depender de los PDFs del cliente; umbrales con 2× margen sobre el baseline; toda release que salte un gate se bloquea.

## Camino al 10 (pasos)

- [ ] 1. Generador de corpus sintético (PDFs con texto/precios conocidos, ~10 archivos).
- [ ] 2. perf:audit modo `--corpus sintético` + baselines commit.
- [ ] 3. Job CI perf-gates completo (sustituye/adiciona perf-smoke).
- [ ] 4. Degradar umbrales solo con evidencia de 3 runs.

## Gates anti-smoke (qué mantiene el 10 real)

- Exit ≠0 con diff de fases (existe en --check).
- Cada workflow de release corre los gates.
- Invalidación: correr la release con gates en verde que estaban 'skipped'.
