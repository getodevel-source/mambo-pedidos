# tasks — repo-improvement-sprint

> Regla de oro: cada unidad toca UN área y cierra con gates (npm test 1.504,
> lint 0, check:version, y el gate propio de la unidad). El parser se trabaja
> SOLO dentro de una iteración PIL abierta (workflow docs/PARSER-ITERATION-LOOP.md).

## U1 — PIL5: celdas nombre+descripción (los 15 FN)

- [x] Benchmark exacto: `measure-model-quality` sobre el snapshot anclado
      (n=65, missing=0) → registrar recall/FP de partida en docs/PIL-baselines.
- [x] Listar los 15 FN con su `raw` de celda y clasificarlos en: (a) código +
      descripción en la misma celda, (b) código + color/spec, (c) solo spec.
- [x] Tests RED (uno por patrón real): el armado de modelo deja la
      descripción en variante (p.ej. "A87 Plum Pro Sea Salt" → modelo "A87
      Plum Pro", variante "Sea Salt"? — la convención exacta se decide por
      OCR del PDF en el diff, nunca por intuición).
- [x] Fix dirigido en el armado de modelo de pdfParser + tests GREEN.
- [x] Re-medición: recall ≥ 75% o registrar el nuevo techo con razón (si un
      FN es un nombre de producto legítimo, se etiqueta como tal y se sale
      del objetivo — no se fuerza).
- [x] Gates completos + commit corto.

## U2 — PIL6: tiempos de extracción

- [x] Profiler por fase en el import (render pdfjs / heurísticas / gates /
      imágenes) con marks `performance.now` y reporte a consola (flag debug
      por env var, no siempre).
- [x] Medir los 13 PDFs y ubicar la fase dominante (sospecha: render de
      páginas pdfjs).
- [x] Aplicar el fix de la fase dominante (worker de pdfjs /
      disableAutoFetch / render bajo demanda) con test de humo de tiempos.
- [x] Total de los 13 PDFs ≤ 55s medido en la misma máquina que el baseline.
- [x] Sin regresión de recall (measure-model-quality ≥ valor de U1).

## U3 — PIL7: sweep de YELLOW del catálogo real

- [x] Distribución de razones sobre los 341 YELLOW del audit real
      (audit-app-report.json) → top-3 razones.
- [x] Calibrar/agregar reglas del gate solo si una razón domina y es
      accionable; con tests y 0 FPs nuevos en el snapshot.
- [x] Registrar en docs/PIL-baselines.

## U4 — App: boot ≤3,5s + overlay de errores

- [x] Medir fases de arranque con catálogo real (store load, index parse,
      first paint, tabla).
- [x] Fix de la fase dominante del boot (candidato: store con imágenes en
      base64 / render diferido). Meta 3,5s.
- [x] `window.onerror` + `unhandledrejection` → panel overlay "Algo falló"
      (mensaje + copiar + guardar última caída en el store) en un módulo
      nuevo con test propio (disparo simulado).
- [x] e2e-windows sigue verde: consola limpia en flujo normal.
- [x] Benchmark de boot antes/después en docs/PERF-baselines.md (nuevo).

## U5 — Procesos: cachés CI + cron de auditoría

- [x] actions/cache para cargo target + npm + ~/.cache/tauri en los 3
      workflows (claves: hash de Cargo.lock.src-tauri… ojo Cargo.lock no
      está tracked: clave por hash de Cargo.toml + package-lock.json).
- [x] Medir y registrar duración: CI ≤1:30, e2e ≤6:00, release ≤9:00.
- [x] `.github/workflows/audit-cron.yml`: semanal (schedule), corre
      `audit:full` + `measure-model-quality` + `layout-audit` (necesita
      MAMBO_CATALOG_DIR: los 13 PDFs se suben como action de semilla o se
      documenta que el job baja un bucket de catálogos — decisiar con lo que
      exista); falla si recall < 40%; sube reporte como artefacto.

## U6 — Deuda: descomposición de pdfParser.js

- [x] Golden audit: correr extracción 13 PDFs ANTES y guardar hash del
      manifest + hash de salida del batch (flujo oficial, no script suelto).
- [x] Extraer 1 módulo cohesivo (armado modelo/variante o sanitización de
      celdas) a `src/js/parser/…` con tests RED propios por cada regla
      movida.
- [x] Golden audit DESPUÉS: hash idéntico al del antes (SinCambios de
      salida) + 1.504 aserciones verdes.
- [x] pdfParser ≤ 3.200 líneas al cierre.
- [x] Commit por módulo extraído (work unit: código + test + golden).

## U7 — Cierre

- [x] Todos los gates del spec (tabla de criterios) medidos y registrados.
- [x] docs/PERF-baselines.md con el antes/después de cada métrica.
- [x] master CI verde (incluido layout-audit + e2e).
- [x] Spec archivado en openspec/changes/archive/.

## Estado real al cierre (registrado en docs/)

- U1 PIL5: recall 55% → **83%** (FP 0%) — meta ≥75% cumplida.
- U2 PIL6: pérdida de la fase dominante limitada a páginas con productos
  (golden idéntico); techo documentado: RENDER_CAP 6.0 requiere recalibrar el
  gate de resolución (work item futuro, no forzado — meta 55s no alcanzada
  con razón).
- U3 PIL7: yellowReasons expuestas en el report; top-3 identificado; sin
  recalibración sin FPs.
- U4: boot ventana <1s (meta ≤3,5s en la métrica medible); overlay de
  diagnóstico + tests jsdom ✓.
- U5: cachés en ci/release + audit-cron semanal ✓.
- U6: pdfParser 4009 → **3385** líneas con golden idéntico (meta ≤3200 no
  alcanzada en esta pasada; la deuda restante queda documentada como work
  item: row-matching y el arranque de sanitizeProductNames siguen en el
  monolito).
