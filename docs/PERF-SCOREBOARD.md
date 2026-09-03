# Scoreboard de Procesos — Mambo Pedidos (v2.2.26)

Escala 1–10 anclada por proceso: **piso** = mínimo aceptable (estado roto o
con pérdida), **techo** = estado ideal, **hoy** = medido (baselines
2026-09-02, corpus real 10 PDFs → 2080 items; `npm run perf:audit`).
Dos ejes: **Rend** = tiempo/eficiencia · **Fiab** = fiabilidad/correctitud.

## 1. Ciclo de vida (boot/restauración)

| Proceso | Piso | Techo | Hoy (medido) | Rend | Fiab |
|---|---|---|---|---|---|
| Boot app vacía | 3 · carga >10s o colgada | 10 · <100ms | 60ms a listeners | 10 | 9 — store fallback, error boundary, timeout anti-cuelgue |
| Restauración de catálogo grande | 3 · minutos o pérdida | 10 · <100ms | 165ms (1264 items + fotos) | 10 | 9 — integridad al idle + backup/recover |
| Check de update al boot | 5 · manual solamente | 9 · silencioso+modal | 3s en idle, badge+modal | 9 | 9 — plugin + fallback GitHub |

## 2. Importación y parser (eficiencia + fiabilidad)

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| Import carpeta (10 PDFs → 2080) | 2 · 0 productos (bug 31/8, corregido) | 10 · ~25s sin jank (worker) | 43s · jank 9.8s (107 tareas) | 6 | 7 — golden estable, 0 RED estructurales; recall de modelo 48% conservador |
| Imágenes del parser | 4 · 151MB en RAM | 10 · thumbs + full bajo demanda | 25MB thumbs, full por archivo | 8 | 8 — refs preservados, zoom full-res |
| Import CSV | 5 · manual | 10 · <100ms | 39ms (5000 filas) | 9 | 8 — determinístico, skips reportados |
| Import XLSX | 5 · manual | 10 · <300ms | 207ms (5000 filas) | 8 | 8 — idem CSV, roundtrip físico en CI |
| Validación (3 gates) | 5 · sin semáforo | 10 · <50ms | 48ms | 9 | 9 — semáforo F3, 0 falsos positivos de modelo |
| Preview modal | 5 · sin opciones | 10 · virtualizado total | render 12ms, scroll 31-40ms, edición coalescida | 8 | 9 — semáforo final idéntico a verificación directa |
| Confirm + persistencia | 3 · 20-50s congelado | 10 · <200ms | 278ms · save 138ms | 9 | 9 — fallos contados, nunca silenciosos |

## 3. Catálogo cargado (lectura + fiabilidad)

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| Render/filtros/paginación | 6 · lento con 2k | 10 · <10ms | 3-18ms | 10 | 9 |
| Búsqueda (neta) | 6 · >1s | 10 · <100ms | ~50ms (debounce 350ms intencional) | 9 | 9 |
| Zoom de imagen | 5 · thumb borroso | 10 · full bajo demanda | full por archivo (loadFullImage) | 9 | 9 — fallback al thumb si falta archivo |
| **Calidad del catálogo (nuevo)** | 1 · no existía | 10 · remediación automática con resumen por proveedor | dashboard 2ms + campaña con evidencia y confirmación | 7 | 8 — assertAtomicReasons, ledger por SKU |
| Duplicados/identidad | 5 · O(n²) | 10 · O(n) | Map identityKey, modelo vacío nunca dedup | 9 | 9 |

## 4. Pedido / cotización / historial

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| armarPedido (1200) | 5 · O(n²) >1s | 10 · <30ms | 48ms | 9 | 9 — RED bloquea, validaciones |
| recalc (costos/IVA/flete) | 6 · lento | 10 · <30ms | 33-36ms | 9 | 9 — fuentes auditables (Dolar API + inputs) |
| Cotización HTML (1200) | 4 · >1s | 10 · <200ms | 337ms (Intl cache) | 8 | 9 — snapshot en historial, HTML byte-estable |
| Historial (render/reimprimir) | 6 · lento | 10 · <10ms | 1-6ms | 10 | 9 — reimprime solo con detalle guardado |

## 5. Exportaciones

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| Export JSON (diagnóstico) | 2 · sin opciones, ruido runtime | 10 · opciones + evidencia + gate | 3-49ms según opciones, modal, 0 artefactos runtime | 9 | 9 — determinista, orden estable |
| Packing list / ejecutivo / quote CSV | 5 · manual | 10 · <100ms | 23 / 28 / 11ms | 9 | 8 — heredan snapshot del pedido |

## 6. Wizard / modales / persistencia / updater

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| Wizard (6 pasos) | 5 · lento | 10 · <300ms total | 156ms | 9 | 8 — estado autoguardado (WIZARD/PROJECT) |
| Modales de análisis (5) | 5 · pesados | 10 · <50ms | 0-20ms | 9 | 8 — cálculos puros en Calculator |
| Persistencia/respaldo | 4 · 20-50s o silencioso | 10 · backups completos en disco | save 138ms, GC O(1), fallo COUNTADO | 9 | 8 — backup en localStorage; techo: también payload completo en disco |
| Updater | 4 · loop a GitHub (histórico) | 10 · verificable E2E | verificado 3 SO, binario byte-idéntico | 10 | 10 |

## 7. Calidad del proceso (QA / gates)

| Proceso | Piso | Techo | Hoy | Rend | Fiab |
|---|---|---|---|---|---|
| Ground-truth / measure | 3 · número mentiroso (snapshot viejo) | 10 · re-etiquetado humano completo | rebaseline n=65: recall 48%, FP 0% — 1 ítem humano pendiente (65 crops) | 7 | 7 |
| Perf gates (local + CI) | 1 · sin gates | 10 · corpus real en CI | perf:audit --check ✅ local + perf:smoke en CI | 8 | 8 |
| Auditoría de import E2E | 1 · sin cobertura | 10 · runtime real | audit:import TODO OK (correctitud) | 9 | 9 |

## Resumen

- **Rendimiento promedio: 8.7/10** — nada por debajo de 6; los dos focos son
  el parse (43s/jank → techo worker) y la cotización (337ms → techo <200ms).
- **Fiabilidad promedio: 8.6/10** — cero falsos positivos, fallos nunca
  silenciosos, semáforo conservador; el piso más bajo es el re-etiquetado
  humano pendiente (7).
- **Para llegar al 10:** (1) worker de parse (diseño listo, requiere
  re-validación golden), (2) revisión humana de los 65 crops, (3) gates con
  corpus real en CI, (4) backup completo del payload en disco.
## ¿9-10 REAL para todo? — viabilidad honesta por proceso

"Real" = medido por el harness, gateado (cae la release si regresa), con
margen sobre el umbral. No es un sticker: es un número reproducible.

| Proceso | Nota hoy | ¿9-10 real alcanzable? | Qué falta | Riesgo/Esfuerzo |
|---|---|---|---|---|
| Boot / Restauración | 10/9 | ✅ YA ES 10 real | gates corriendo (perf:audit --check) | ninguno |
| Confirm / Save / GC | 9 | ✅ un paso | nada de código; gates | ninguno |
| Import CSV/XLSX | 9/8 | ✅ un paso | gates de los nuevos umbrales | bajo |
| Render catálogo / historial / modales | 9-10 | ✅ YA ES techo | nada | ninguno |
| Updater | 10/10 | ✅ YA ES 10 real | autoupdate-live en cada release (manual dispatch) | bajo |
| Export JSON | 9 | ✅ un paso | gates en CI (perf-smoke ya lo cubre) | bajo |
| Persistencia/backup | 9/8 | ✅ un paso | backup del payload completo a disco en modo tauri | bajo/medio |
| **Parse 43s → <25s sin jank (worker)** | 6 | 🟡 SÍ, con programa | spike → worker OffscreenCanvas; NO toca el golden sin re-validar; gate de jank <2s | medio/alto; 1-2 sprints; riesgo de coordenadas para gates de imagen — mitigado con la batería ground-truth (rebaselineada) como piso |
| Cotización 337 → <200ms | 8 | 🟡 SÍ, acotado | filas precompiladas + formatters (ya cacheados) + juntar chunks; techo <200ms | bajo; medio sprint |
| Dashboard calidad 7 → 9 | 7 | 🟡 SÍ | remediación por proveedor con resumen + más tests + gates | medio sprint |
| Perf gates 8 → 10 | 8 | 🟡 SÍ, con decisión | corpus SINTÉTICO con ground-truth conocido (PDFs generados con texto/precios conocidos) → recall/FP y perf medibles en CI de verdad (los catálogos reales son del cliente: no van al repo) | medio; alta fiabilidad del gate |
| Ground-truth / calidad del parser (recall 48%, FP 0%) | 7/7 | 🟠 PARCIAL — techo realista 8.5-9 | 65 crops (humano) + ampliar etiquetado a ~150-300 + heurísticas nuevas con FP=0 atado + (para 9-10 pleno) capa LLM de enriquecimiento con verificación determinista — el repo ya la contempla | el recall determinista puro topa ~70-80% sin FP; el 90%+ real sale del LLM verificado: coste de runtime + no-determinismo controlado por gates |
| **Todo 10 realista** | — | ⚪ NO en el corto plazo | hay techo natural de calidad determinista (parser); el 10 pleno requiere la capa LLM + corpus sintético + etiquetado ampliado | programa de semanas-mes, iterativo |

### Lectura corta
- **~10 procesos ya están en 9-10 real o a UN paso** (un gate o un cambio chico).
- **Los 2 únicos "no-triviales" son parse (tiempo) y calidad del modelo (recall)**:
  el parse es alcanzable con el worker (programa acotado, riesgo controlado por la
  batería golden); el recall determinista tiene techo honesto ~70-80% con FP=0 —
  pasar de ahí (9-10 pleno) exige la capa LLM verificada, que es un proyecto.
- **Regla de oro**: nada sube de nota si rompe FP=0, golden o el semáforo honesto.
