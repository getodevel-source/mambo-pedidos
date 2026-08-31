# Interactividad de boot completa (boot-interactivity)

## Problema (medido 31/08/2026)

U4 del sprint anterior: la ventana mapea <1s, pero la INTERACTIVIDAD completa
(store load con 1.472 productos + imágenes base64 + render de la tabla) no
está medida en Linux — sin CDP no hay profiler del runtime real ahí. El e2e de
Windows (CDP) existe pero no mide tiempos de arranque. El usuario percibe
"tarda en cargar" sin que tengamos el número.

## Dirección

1. **U1 — Instrumentar el boot**: performance marks en app.js
   (boot:dom-ready, boot:store-loaded, boot:first-render, boot:interactive)
   con reporte a consola (ya hay patrón env-flag).
2. **U2 — Métrica en el e2e real**: e2e-smoke.js (CDP Windows) lee
   performance.getEntriesByType('mark') tras el load → asertos con umbral:
   store-loaded ≤3s, first-render ≤3,5s, interactive ≤4s (estimación inicial;
   los umbrales se calibran con la primera medición real).
3. **U3 — Fix del cuello**: si el store load domina (imágenes base64 en el
   JSON), diferir el decode/render de imágenes de la tabla hasta
   after-first-paint y/o cargar el store en segundo plano con skeleton;
   medir antes/después con la misma métrica.
4. **U4 — Cierre**: umbrales fijados, registro en docs/PERF-baselines.md,
   gates y archive.

## Criterios de cierre (todos falsables)

- [ ] Marks de boot presentes en app.js y leídos por el e2e (CDP).
- [ ] e2e-windows reporta los 4 tiempos (no solo "consola limpia").
- [ ] Umbrales finales documentados y en verde en CI (2 corridas seguidas).
- [ ] Si U3 aplica: mejora medible ≥15% en store-loaded o first-render.
- [ ] npm test + lint + layout-audit + CI verde.

## No-goals

- NO tocar la persistencia (store) como formato.
- NO bloquear la ventana con un splash: la meta es que pinte rápido y cargue
  en segundo plano.