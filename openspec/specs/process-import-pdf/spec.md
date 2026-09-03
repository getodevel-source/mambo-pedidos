# Spec: process-import-pdf

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Importación de catálogos PDF: extracción espacial por página (texto, tabla/grilla, imágenes, FOB anclado), progreso por página, sin romper golden `fd0ac1d1`.

## Estado actual (2026-09-02, corpus real)

Corpus 10 PDFs → 2080 items en **43s** con 9.8s de jank (107 longtasks). Nota Rend 6 / Fiab 7. 0 RED estructurales; recall de modelo 48% con FP 0%.

## Definición de 10 REAL

**Parse <25s y jank <2s** en el corpus completo (worker + OffscreenCanvas), con **hash de extracción idéntico** sobre las muestras etiquetadas (65 hoy → 150+ al crecer el corpus). Fiabilidad en el techo: recall ≥90% con FP ≤2% vía capa LLM verificada (ver spec process-qa-groundtruth). Nota=10 solo cuando el worker esté gateado en CI con corpus sintético de ground-truth conocido.

## Camino al 10 (pasos)

- [ ] 1. Spike medido (docs/SPIKE-WORKER-PARSE.md ya existe): perfil por fase, hash worker-vs-main en 3 PDFs.
- [ ] 2. Worker de parse con OffscreenCanvas; fallback feature-detect si no hay soporte.
- [ ] 3. Re-validar golden completo: audit:full + ground-truth (65) sin regresión antes del merge.
- [ ] 4. Gate CI: jank <2s y tiempo <25s sobre corpus sintético; umbral <35s en local con corpus real.
- [ ] 5. Capa de enriquecimiento LLM verificada (proyecto aparte) para el recall 90%+.

## Gates anti-smoke (qué mantiene el 10 real)

- `perf:audit --check`: parse corpus <60s hoy; jank <15s; tras worker: <35s / <2s.
- Golden: hash de productos idéntico en las muestras etiquetadas.
- Semáforo honesto: 0 RED estructurales; FP=0 de modelo como invariante.
- Invalidación: merge del worker sin la batería ground-truth.
