# tasks — repo-improvement-sprint

> Regla de oro: cada unidad toca UN área y cierra con gates (npm test 1.504,
> lint 0, check:version, y el gate propio de la unidad). El parser se trabaja
> SOLO dentro de una iteración PIL abierta (workflow docs/PARSER-ITERATION-LOOP.md).

## U1 — PIL5: celdas nombre+descripción (los 15 FN)

- [ ] Benchmark exacto: `measure-model-quality` sobre el snapshot anclado
      (n=65, missing=0) → registrar recall/FP de partida en docs/PIL-baselines.
- [ ] Listar los 15 FN con su `raw` de celda y clasificarlos en: (a) código +
      descripción en la misma celda, (b) código + color/spec, (c) solo spec.
- [ ] Tests RED (uno por patrón real): el armado de modelo deja la
      descripción en variante (p.ej. "A87 Plum Pro Sea Salt" → modelo "A87
      Plum Pro", variante "Sea Salt"? — la convención exacta se decide por
      OCR del PDF en el diff, nunca por intuición).
- [ ] Fix dirigido en el armado de modelo de pdfParser + tests GREEN.
- [ ] Re-medición: recall ≥ 75% o registrar el nuevo techo con razón (si un
      FN es un nombre de producto legítimo, se etiqueta como tal y se sale
      del objetivo — no se fuerza).
- [ ] Gates completos + commit corto.

## U2 — PIL6: tiempos de extracción

- [ ] Profiler por fase en el import (render pdfjs / heurísticas / gates /
      imágenes) con marks `performance.now` y reporte a consola (flag debug
      por env var, no siempre).
- [ ] Medir los 13 PDFs y ubicar la fase dominante (sospecha: render de
      páginas pdfjs).
- [ ] Aplicar el fix de la fase dominante (worker de pdfjs /
      disableAutoFetch / render bajo demanda) con test de humo de tiempos.
- [ ] Total de los 13 PDFs ≤ 55s medido en la misma máquina que el baseline.
- [ ] Sin regresión de recall (measure-model-quality ≥ valor de U1).

## U3 — PIL7: sweep de YELLOW del catálogo real

- [ ] Distribución de razones sobre los 341 YELLOW del audit real
      (audit-app-report.json) → top-3 razones.
- [ ] Calibrar/agregar reglas del gate solo si una razón domina y es
      accionable; con tests y 0 FPs nuevos en el snapshot.
- [ ] Registrar en docs/PIL-baselines.

## U4 — App: boot ≤3,5s + overlay de errores

- [ ] Medir fases de arranque con catálogo real (store load, index parse,
      first paint, tabla).
- [ ] Fix de la fase dominante del boot (candidato: store con imágenes en
      base64 / render diferido). Meta 3,5s.
- [ ] `window.onerror` + `unhandledrejection` → panel overlay "Algo falló"
      (mensaje + copiar + guardar última caída en el store) en un módulo
      nuevo con test propio (disparo simulado).
- [ ] e2e-windows sigue verde: consola limpia en flujo normal.
- [ ] Benchmark de boot antes/después en docs/PERF-baselines.md (nuevo).

## U5 — Procesos: cachés CI + cron de auditoría

- [ ] actions/cache para cargo target + npm + ~/.cache/tauri en los 3
      workflows (claves: hash de Cargo.lock.src-tauri… ojo Cargo.lock no
      está tracked: clave por hash de Cargo.toml + package-lock.json).
- [ ] Medir y registrar duración: CI ≤1:30, e2e ≤6:00, release ≤9:00.
- [ ] `.github/workflows/audit-cron.yml`: semanal (schedule), corre
      `audit:full` + `measure-model-quality` + `layout-audit` (necesita
      MAMBO_CATALOG_DIR: los 13 PDFs se suben como action de semilla o se
      documenta que el job baja un bucket de catálogos — decisiar con lo que
      exista); falla si recall < 40%; sube reporte como artefacto.

## U6 — Deuda: descomposición de pdfParser.js

- [ ] Golden audit: correr extracción 13 PDFs ANTES y guardar hash del
      manifest + hash de salida del batch (flujo oficial, no script suelto).
- [ ] Extraer 1 módulo cohesivo (armado modelo/variante o sanitización de
      celdas) a `src/js/parser/…` con tests RED propios por cada regla
      movida.
- [ ] Golden audit DESPUÉS: hash idéntico al del antes (SinCambios de
      salida) + 1.504 aserciones verdes.
- [ ] pdfParser ≤ 3.200 líneas al cierre.
- [ ] Commit por módulo extraído (work unit: código + test + golden).

## U7 — Cierre

- [ ] Todos los gates del spec (tabla de criterios) medidos y registrados.
- [ ] docs/PERF-baselines.md con el antes/después de cada métrica.
- [ ] master CI verde (incluido layout-audit + e2e).
- [ ] Spec archivado en openspec/changes/archive/.