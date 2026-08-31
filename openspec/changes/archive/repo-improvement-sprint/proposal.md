# Sprint de mejora integral del repo (repo-improvement-sprint)

## Problema (medido 31/08/2026)

| Área | Medición | Dato |
|---|---|---|
| Parser — calidad | recall_dirty del snapshot anclado (n=65) | **55% (18/33)** — 15 FN son pérdida de extracción en celdas "nombre+descripción" |
| Parser — velocidad | 13 PDFs completos | **69,5s total** (~30ms/producto; AULA 14s, AJAZZ 9,2s) |
| Monolito | `src/js/pdfParser.js` | **4.003 líneas**; complexity gate baja en warn; refactor pendiente documentado |
| App — boot | ventana mapeada con catálogo real de 1.472 productos | **~5s** |
| App — tabla | render paginado (50/fila) con 1.472 productos | **12ms** — paginación ya existe, NO virtualizar |
| CI | ci / e2e / release | **2:39 / 8:23 / 11:23** — sin cachés de cargo/npm/tauri |
| Errores | telemetría runtime | **ninguna** — los bugs se descubren en vivo (CSP v2.0.3, store null v2.0.4, escala 2x 2026-08) |
| Lint | `npm run lint` | 0 errores, 3 warnings fixables (de 44 totales) |

## Dirección

Unidades ordenadas por ROI (negocio → código → proceso), cada una con gate
medible. El parser es lo que más duele (resultados pésimos según el cliente);
el resto baja el costo de operar y descubrir fallas antes.

### U1-U3 — Parser (iteraciones PIL 5-7)

1. **PIL5 — celdas nombre+descripción**: los 15 FN restantes son un solo
   patrón: la celda trae "CÓDIGO + descripción/color/spec" y el parser la
   deja entera o corta mal ("AK980V2PRO Lychee AK980 Transparent",
   "A87 Plum Pro Sea Salt", "V3 Tri Mode"). Directriz: el modelo = código +
   ≤2 tokens de serie/marketing; el resto → variante. Con tests RED por
   caso real (verifica el diff de extracción), gates PIL y re-medición.
2. **PIL6 — tiempos**: profiler por fase en `fileImporter`/`importFlow`
   (render de página pdfjs / heurísticas / gates / imágenes) con
   `performance.now`; atacar la fase dominante (sospecha: render de
   páginas — probar worker de pdfjs + `disableAutoFetch` + páginas bajo
   demanda). Meta: ≥20% sobre la fase dominante sin regresión de recall.
3. **PIL7 — límite de suciedad**: una pasada de "remedation sweep" sobre los
   YELLOW del catálogo real (341) para validar qué razones dominan y si las
   reglas del gate necesitan calibración (mismo método: snapshot + OCR).

### U4 — App: boot y errores

4. **Boot ≤3,5s**: medir fases de arranque (store load → render → datos);
   el candidato obvio es el load del store con imágenes en base64 y el
   parse del índice al abrir; diferir el render de la tabla hasta
   after-first-paint y cargar el store de forma perezosa si aplica.
5. **Overlay de diagnóstico**: `window.onerror` + `unhandledrejection` →
   panel "Algo falló" con el mensaje + botón copiar, y persisted de última
   caída en el store (para soporte); el e2e debe seguir viendo consola
   LIMPIA en el flujo normal (el overlay solo en errores).

### U5 — Procesos (CI rápido + vigilancia)

6. **Cachés**: cargo target + npm + `~/.cache/tauri` en ci.yml,
   e2e-windows.yml y release.yml (actions/cache, claves por hash del lock).
   Meta: CI ≤1:30, e2e ≤6:00, release ≤9:00.
7. **Cron semanal de auditoría**: workflow `audit-cron` (schedule weekly)
   que corre `audit:full` + `measure-model-quality` + `layout-audit` y
   sube el reporte como artefacto; si el recall cae bajo 40% → falle.

### U6 — Deuda estructural

8. **Descomposición de pdfParser.js**: extraer los módulos cohesivos ya
   identificados (armado de modelo/variante + sanitización + heurísticas de
   celda) a archivos con tests propios, con **golden audit**: el manifest
   de los 13 PDFs y las 1.504 aserciones deben quedar idénticos antes y
   después (SinCambios de salida). Meta: pdfParser ≤3.200 líneas y cada
   módulo extraído con ≥1 test RED específico.

## Criterios de cierre (todos falsables)

- [ ] recall_dirty ≥ **75%** y FP ≤ **3%** en el snapshot anclado (n=65), con
      el diff de extracción re-etiquetado si algún caso cambia de posición.
- [ ] Extracción completa de los 13 PDFs ≤ **55s** (desde 69,5s), sin bajar
      recall.
- [ ] Boot de la app con el catálogo real ≤ **3,5s** (desde ~5s).
- [ ] Overlay de diagnóstico activo en error simulado; consola limpia en el
      flujo normal (e2e).
- [ ] CI ≤ **1:30**; e2e ≤ **6:00**; release ≤ **9:00** (jobs con caché).
- [ ] Workflow `audit-cron` semanal con artefacto y umbral de recall <40%.
- [ ] pdfParser ≤ **3.200 líneas** con golden audit idéntico (manifest +
      1.504 aserciones).
- [ ] `npm run test` + `lint` + `check:version` verdes, master CI verde.
- [ ] Mediciones antes/después registradas en `docs/PIL-baselines.md` y
      nuevo `docs/PERF-baselines.md`.

## No-goals (YAGNI explícito)

- NO virtualización de la tabla (paginación existente: 12ms).
- NO reescritura de pdfjs ni de parse de páginas (la capa de render del PDF).
- NO telemetría externa/analytics (solo diagnóstico local).
- NO migrar de Tauri, ni cambiar de motor web o de CI provider.