# Spec: process-qa-groundtruth

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Calidad del parser como proceso: ground-truth etiquetado, measure-model-quality (recall/FP), photo-baseline, audit:full/assignment. Rebaseline 2026-09-02 (n=65).

## Estado actual (2026-09-02, corpus real)

rebaseline n=65: **recall_dirty 48% · FP 0/25** · photo avg 178.8px (35.6% <150px — nativos del PDF) · 65 crops pendientes de revisión humana.

## Definición de 10 REAL

Recall ≥90% con FP ≤2% **medido sobre un corpus etiquetado de ≥300 muestras** (65 + ampliar + revisión humana o visión) y gateado en CI con corpus sintético de ground-truth conocido. El recall alto sale del enriquecimiento LLM verificado; las reglas puras mantienen FP=0 como invariane.

## Camino al 10 (pasos)

- [ ] 1. Revisión humana de los 65 crops (packet listo) — desbloquea etiquetas finas.
- [ ] 2. Ampliar etiquetado a ~150-300 muestras (mismo procedimiento por posición).
- [ ] 3. Generador de corpus sintético con ground-truth conocido → recall/FP medibles en CI.
- [ ] 4. Proyecto LLM de enriquecimiento: sugestiones verificadas por los gates (nunca promoción directa), fallback determinista.
- [ ] 5. Gates: recall ≥90%, FP ≤2%, FP determinista = 0.

## Gates anti-smoke (qué mantiene el 10 real)

- ground-truth-diff: 0 huérfanos.
- measure-model-quality en cada release (local) + corpus sintético en CI.
- FP=0 de las reglas puras como invariante de seguridad.
- Invalidación: etiquetas fabricadas o gates aflojados sin evidencia.
