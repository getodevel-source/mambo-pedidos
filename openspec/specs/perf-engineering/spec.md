# Spec: perf-engineering

> Estado: activo (cambio perf-sprint-2026-09).

## 1. Baselines por proceso (contrato)

La app mantiene un conjunto de baselines medidos con el harness real
(`npm run perf:audit`, Chromium + stub fs = camino Tauri, corpus 10 PDFs →
2080 items). Cada proceso tiene una métrica, un valor actual y un umbral de
gate:

| Proceso | Métrica | Baseline (2026-09-02) | Umbral gate |
|---|---|---|---|
| Boot vacío | boot:listeners | 60ms | < 500ms |
| Restore catálogo 1264 | reload → catalog-loaded | 165ms | < 2s |
| Import carpeta | parse + optimización | 43s | < 60s |
| Jank import | longtasks totales | 9.8s (107 tareas) | < 15s |
| Validación | 3 gates | 48ms | < 500ms |
| Confirm import | click → catálogo listo | 278ms | < 1s |
| Save catalog | con refs | 96-138ms | < 500ms |
| Catálogo render | 60 filas | 5ms | < 50ms |
| Catálogo búsqueda | neto tras debounce | ~50ms | < 300ms |
| Pedido 1200 | armar/render/recalc | 35-49ms | < 200ms |
| Cotización 1200 | generatePrintableQuote | 365ms | < 500ms |
| Export JSON 2080 | buildCatalogExportJSON | 41ms (pretty) | < 600ms |
| Memoria imágenes | dataURLs en vivo | 25MB (thumbs) | < 50MB |
| Heap post-confirm | usedJSHeapSize | ~140MB | < 400MB |

`npm run perf:audit --check` falla (exit≠0) si un proceso excede su umbral.
Los umbrales solo se actualizan con evidencia de un baseline nuevo aprobado
(registro en `docs/PERF-AUDIT.md`).

## 2. Export JSON de diagnóstico (contrato)

`window.buildCatalogExportJSON(items, opts)` — exportación determinística de
los resultados del parser/catálogo:

- `opts.scope`: `'catalog'` (default) | `'preview'` — preview usa
  `ImportFlow.pendingPreviewItems` e incluye la evidencia de extracción
  (`rawText`, `cellRawText`, `imgWarnings`, `sourceWarnings`, `_evaluations`)
  cuando el ítem la lleva.
- `opts.images`: `'thumb'` (default, incluye `img` tal cual) | `'none'`
  (omite el campo `img`).
- `opts.pretty`: `true` (JSON indentado) | `false` (compacto).
- Orden de campos estable y explícito: `sku, cat, marca, modelo, variante,
  color, fob, img, status, warnings, confidence, grounded, sourceFile,
  qualityReason` + evidencia opcional al final, en ese orden.
- Invariantes: NUNCA emite estado runtime (`_imageRef`, `_selected`,
  `_previewValidation`, `_imageRef` anidados); `JSON.parse` del output es
  idéntico entre pretty y compact; el output de un mismo estado es
  byte-estable.
- Gates: stringify < 600ms (2080 items); scope `preview` + `images:'none'`
  < 200ms; archivo sin `_imageRef` en ninguna clave.

## 3. Editabilidad del preview (contrato)

Las ediciones del modal de importación (modelo, variante, cat, fob):

- Validación en vivo por ítem editado (semáforo individual inmediato).
- La verificación COMPLETA (runImportVerification sobre todos los items)
  coalesce: trailing 350ms + `requestIdleCallback`; el semáforo final es
  idéntico al de una verificación completa directa.
- Gate: 10 ediciones dictadas seguidas < 2s totales.

## 4. Cotización (contrato)

`QuoteGenerator.generatePrintableQuote` con 1200 ítems < 500ms; formatters
`Intl` cacheados por `locale|currency|decimals`; HTML byte-estable para el
mismo pedido (hash estable).

## 5. Jank de import (contrato de diseño)

El parse del corpus completo no debe exceder 15s de longtasks en el main
thread. El cumplimiento pleno requiere el worker (proyecto parser, golden);
mientras tanto el umbral documenta el estado actual.