# tasks — image-render-cap

## U1 — A/B empírico (delegado a subagente con bash)

- [ ] Harness scratch (scripts/_profile-parse.js ya usado; regenerar) que
      corre los 13 PDFs y reporta: tiempo total, tiempo por PDF, cantidad de
      imágenes ≤150px y media de dimensión menor por PDF.
- [ ] Correr con RENDER_CAP 6.0 (baseline), 4.0 y 3.0 (editar la constante en
      pdfParser.js y revertir entre corridas; no committear cambios parciales).
- [ ] Reporte con tabla comparativa y recomendación del cap (el más bajo sin
      % <150px significativo y sin cambio en el promedio).

## U2 — Fix

- [ ] Aplicar el RENDER_CAP elegido.
- [ ] Si alguna clase de imagen baja del umbral del gate (photo-baseline):
      ajustar el gate de calidad SOLO en lo medido (0 regresiones).

## U3 — Golden + gates

- [ ] Hash de productos idéntico (el harness golden).
- [ ] npm run photo:baseline y comparación contra el anterior (sin regresión
      de promedio ni de % <150).
- [ ] npm test + lint + check:version + layout-audit.
- [ ] Re-medición de tiempos (mismo instrumento que U1) ≥20% más rápido.

## U4 — Cierre

- [ ] docs/PERF-baselines.md + docs/PIL-baselines.md con la tabla A/B y el
      delta final.
- [ ] Commit + push + archivar spec en openspec/changes/archive/.