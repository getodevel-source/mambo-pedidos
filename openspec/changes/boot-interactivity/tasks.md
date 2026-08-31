# tasks — boot-interactivity

## U1 — Instrumentar el boot (yo)

- [ ] En app.js (o el bootstrap que exista): performance.mark('boot:dom-ready')
      al DOMContentLoaded, 'boot:store-loaded' tras AppStorage.init/load
      resuelto, 'boot:first-render' tras el primer render de la vista activa,
      'boot:interactive' al primer evento de usuario… o al finish del init.
- [ ] Guarda por env (MAMBO_PROFILE_APP=1) para no loguear en producción normal.

## U2 — Métrica en e2e-windows (CDP)

- [ ] e2e-smoke.js: tras el load, Runtime.evaluate con
      performance.getEntriesByType('mark') → imprimir los tiempos y asertar
      umbrales iniciales (store ≤3s, first-render ≤3,5s, interactive ≤4s);
      calibrar con la primera medición real (los umbrales del spec).

## U3 — Fix del cuello (según medición)

- [ ] Si store-load domina: diferir el decode de imágenes de la tabla
      (after-first-paint) y/o carga de store en segundo plano con el esqueleto
      renderizado antes; medir mejora ≥15%.

## U4 — Cierre

- [ ] Umbrales finales en el código y en docs/PERF-baselines.md.
- [ ] npm test + lint + check:version + layout-audit + CI (2 corridas del e2e
      verdes).
- [ ] Commit + push + archive del spec.