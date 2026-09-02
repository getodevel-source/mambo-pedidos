# Design: Process Improvement Program — por proceso (baselines 2026-09-02)

Ejes: **T** (tiempo/eficiencia) · **R** (fiabilidad). Cada fila: estado, acción
concreta, gate verificable. Referencia de medición: `npm run perf:audit` /
`perf:export` / harness por proceso.

## 1. Procesos ya verdes (A, D, I, J) → solo gates continuos

| Proc | Acción | Gate |
|---|---|---|
| A boot/restore | nada de código; umbrales en perf:audit --check | <500ms / <2s |
| D catálogo lectura | nada de código | render <50ms, búsqueda neta <300ms |
| I persistencia | nada de código (batches/refs/GC ya optimizados) | save <500ms, heap post-confirm <400MB |
| J updater | nada de código (cadena verificada byte-idéntica) | verify-latest + autoupdate-live verdes |

## 2. Sin medición aún (C, G2/G3, H2/H3) → iteración 0

| Proc | Acción | Gate |
|---|---|---|
| C1/C2 CSV/XLSX | benchmark con fixture de 5000 filas (harness) | parse <2s; gate en perf:audit --check (csv)* |
| G2 export CSV pedido | medir con pedido de 1200 | <500ms |
| G3 packing list / ejecutivo / customs | medir cada export con pedido 1200 | <1s c/u* |
| H2 NCM first-hit (lazy) | medir ensureNcmDbLib + lookup | first-hit <500ms* |
| H3 modales (5) | medir apertura + cálculo | apertura <200ms* |

(*) umbrales propuestos; se fijan con la medición de iteración 0 (nunca un gate
sin baseline).

## 3. Catálogo cargado — fiabilidad (E) → iteración 1

| Proc | Estado | Acción | Gate |
|---|---|---|---|
| E6 calidad global | audit:full {1518 G, 523 Y, 39 R}; 174 advisories | **Dashboard "Calidad del catálogo"**: por proveedor (G/Y/R, %grounded, outliers IQR, sin-foto, duplicados); botón remediar (ejecuta remediación con evidencia) y exportar el reporte | datos del dashboard === audit:full (test); apertura <200ms |
| E3/E4 remediación | loop existe con evidencia | campaña guiada sobre los 523 YELLOW: revisión por lotes (aceptar modelo limpiado / corregir / descartar), persistencia inmediata | 0 UNCLASSIFIED_YELLOW tras campaña (assertAtomicReasons) |
| E1 validación al load | 21ms | nada de código | gate existente |
| E2 integridad | idle | nada de código | ✅ |

## 4. Parser — fiabilidad honesta (B/K) → iteración 2

| Proc | Estado real | Acción | Gate |
|---|---|---|---|
| K1 ground-truth | 65 candidatos; ids 52.3%; misma posición 93.8% | **Re-etiquetar los 65 (packet)**: revisar modelo/variante/FOB/marca por posición con los crops; commit del nuevo manifest | `ground-truth-diff` 100% de ids casados y 0 huérfanos |
| K2 measure-model-quality | describe snapshot viejo | **Re-baseline**: correr measure sobre el manifest re-etiquetado; registrar recall/FP del parser ACTUAL | gate CI: recall ≥ baseline nuevo −2pp; FP ≤ +2pp (job quality en ci.yml) |
| B1 parse jank | 9.8s/107 tareas | **Spike worker (Slice D)**: diseño + medición en branch; sin merge al motor | informe de spike; decisión documentada |
| B3 imagen <150px | 765 (35.6%) | **Mejora de extracción**: investigar por PDF culpable (crops) y subir resolución donde el PDF la tiene (no tocar golden sin re-validar) | photo-baseline: lt150 < 25% O re-baseline justificado |
| B4 asignación | 61 cambios por gate | re-medir tras re-etiquetado | sin regresión en assignment-audit |

## 5. Eficiencia restante (L) → iteración 3

| Proc | Hoy | Acción | Gate |
|---|---|---|---|
| B8 edición preview | 163-236ms/edición | Slice B: validación por ítem + trailing 350ms + idle para el full | 10 ediciones dictadas <2s; semáforo final idéntico |
| F3 cotización | 365ms/1200 | Slice C: Intl cacheados + join | <250ms; HTML byte-estable |
| L4 jank | 9.8s | worker (iteración 2) | <15s hoy; meta <2s con worker |
| L2 restore | 165ms | nada de código | <2s |
| L7 cotización | 365ms | Slice C | <500ms gate, <250ms meta |

## 6. Gates en CI (transversal)

- `perf-audit --check` (umbrales L) y `perf-export --check` en ci.yml + release.yml.
- Job `quality-gates` (K2, B4, K3 photo-baseline) en ci.yml.
- Todo fallo con diff de fases legible en el summary del run.

## 7. Changelog

Cada iteración actualiza `docs/PERF-AUDIT.md` (tabla changelog) y el blueprint
marca el proceso como `✅ gateado`.