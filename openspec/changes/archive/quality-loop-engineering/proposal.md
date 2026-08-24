# Proposal: Quality Loop Engineering (Líneas A + B)

## Intent

Mambo Pedidos importa catálogos de proveedores (PDF/CSV) y debe producir
productos confiables. Hoy el pipeline es robusto pero tiene huecos de
calidad: 566 productos GREEN (25%) llevan la palabra de su categoría dentro
del modelo, la verificación de imagen no comprueba identidad visual, y el
FOB del path PDF no tiene grounding literal. Este change establece un loop
de mejora continua (measure → diagnose → fix → re-measure) ejecutado con
subagentes en paralelo, con dos líneas de trabajo:

- **Línea A — Procesos**: los 13 procesos del pipeline, cada uno con nota
  1-10, meta >9 y criterio de cierre explícito.
- **Línea B — Verificación por campo**: 6 campos (modelo, variante/color,
  categoría, FOB, imagen, SKU) con meta **0 falsos positivos**.

**Política rectora: fail-closed.** Ante cualquier duda de datos, el producto
debe degradar a YELLOW/RED — nunca pasar como GREEN con información
incorrecta. Preferimos errores (falsos negativos, revisables) a falsos
positivos (producto importado mal que parece correcto). El porcentaje de
GREEN puede bajar temporalmente; es el costo aceptado de la honestidad.

## Estado actual (medido 2026-08-05, export-node12, 2315 productos)

| Métrica | Valor |
|---|---|
| GREEN post-gates | 2263 (97.8%) |
| YELLOW post-gates | 52 (2.2%) — honestos |
| RED | 0 |
| Con imagen (raw) | 100% |
| Cross-categoría / cross-marca | 0 / 0 |
| GREEN falsos sin imagen | 0 |
| **GREEN con ruido detectable en modelo** | **566 (25%)** — falso-positivo de calidad |
| Tests | 687/687 · lint 0 errores |

## Línea A — Procesos del pipeline (nota actual → meta >9)

| # | Proceso | Nota | Gap a cerrar | Criterio de cierre (>9) |
|---|---------|------|--------------|--------------------------|
| A1 | Lectura del PDF (pdf.js) | 8.5 | Sin retry por página; aviso de escaneadas existe | Toda página fallida se reporta con causa; 0 crashes de archivo válido |
| A2 | Detección de marca | 7 | Marcas nuevas caen a OTRO; lista custom existe | Marca detectada o YELLOW explícito; nunca GREEN con marca OTRO |
| A3 | Extracción de productos (celdas/filas) | 7 | Ruido en layouts raros; filas fantasma | Todo producto GREEN tiene modelo parseado sin ruido detectable (ver B1) |
| A4 | Extracción de imágenes | 8 | Shim Node vs canvas real; cobertura 100% lograda | 100% cobertura + dataURLs válidos verificables |
| A5 | Matching de imágenes | 7.5 | Foto de vecino del mismo tipo puede pasar | Duda de identidad → YELLOW (fail-closed); 0 GREEN con foto no verificable |
| A6 | Finalización (dedup/herencia/recovery) | 8 | Herencia cross-página sin evidencia de identidad | 0 duplicados reales; herencia solo con identidad marca+modelo+cat |
| A7 | Evaluador de confianza | 7 | Umbrales ad-hoc; no distingue ruido de error | Score reproducible; todo warning → YELLOW si afecta un campo |
| A8 | Sanitización (TextSanitizer) | 7 | 566 modelos con palabra de categoría | 0 GREEN con categoría dentro del modelo (limpiar o degradar) |
| A9 | Asignación de SKU | 8 | SKU derivado del modelo sucio | SKU estable y único; formato por categoría verificado |
| A10 | Validación R1-R10 | 7.5 | R9 advisory (imagen no bloquea); reglas por campo | R9 duro (sin imagen → YELLOW); regla por cada campo de B |
| A11 | Preview + control humano | 9 | YELLOW no se distingue bien en preview | RED/YELLOW con razón visible y accionable en el preview |
| A12 | Persistencia / re-validación | 8 | Re-validación en carga y edición existe | Validación idempotente: guardar/cargar no cambia semáforo |
| A13 | Tests | 8 | Faltan casos de layout reales y de fail-closed | Cada fix del loop llega con test que pinea el caso |

## Línea B — Verificación por campo (meta: 0 falsos positivos)

| Campo | Riesgo hoy | Medidas actuales | Política fail-closed |
|-------|-----------|------------------|----------------------|
| B1 Modelo/nombre | 5-8% (ruido, división imperfecta) | R2 basura, recovery genéricos/truncados, gates, grounding 1ª palabra (solo CSV) | Modelo con palabra de categoría/combo/estado sin limpiar → YELLOW; grounding literal también en path PDF |
| B2 Variante/color | 3-5% (colores mal separados) | Detección de color, crossAudit, color dominante de imagen | Color en modelo → mover a variante o YELLOW; conflicto color-imagen → YELLOW |
| B3 Categoría | 2-4% | detectCategory + BRAND_LOCK + R5 | Categoría dudosa (sin keyword de tipo) → YELLOW; BRAND_LOCK → RED |
| B4 Precio FOB | 1-2% | R1, R3 rangos por categoría, R10 grounding (CSV) | FOB fuera de rango → RED; sin evidencia literal en PDF → YELLOW |
| B5 Imagen | 3-5% (foto de vecino) | dataURL válido, shape/color/tamaño, gates cross-cat/brand, herencia por modelo | Foto sin verificación de identidad (posición/forma/color) → YELLOW, nunca forzar |
| B6 SKU | bajo | SkuAllocator con dedup | SKU vacío/duplicado/formato inválido → RED |

## Mecánica del loop

1. **Medir** (harness existente): `node scripts/export-catalog-batch.js` →
   `node scripts/measure-catalog-assignment.js` + `npm test` + `npm run lint`.
2. **Diagnosticar**: análisis de fugas por página/campo (scripts `_dbg_*`, python).
3. **Delegar en paralelo** (hasta 3 subagentes por iteración, máx 3 concurrentes):
   - Workstream 1 — Modelos: A2/A3/A7/A8 + B1/B2/B3
   - Workstream 2 — Imágenes: A4/A5/A6 + B5
   - Workstream 3 — Validación y precio: A10/A12 + B4/B6 + A13
   Cada subagente recibe: paths, comandos exactos, criterio de cierre de su
   proceso, y la política fail-closed. Devuelve: diff + tests + medición local.
4. **Verificar central**: aplicar diffs, correr 687+ tests, lint, re-export,
   measure. Si una métrica empeora → revertir el workstream culpable.
5. **Commit de unidad** por workstream cerrado (Conventional Commits).
6. **Re-puntuar** procesos/campos con evidencia del nuevo export.

## Gates del loop (cada iteración)

- `npm test` → 0 fallos (los tests crecen con cada fix).
- `npm run lint` → 0 errores.
- `measure-catalog-assignment` → 0 RED post-gates, 0 GREEN sin imagen,
  0 cross-cat/cross-brand, 0 duplicados.
- Sin regresión en métricas cerradas (las de iteraciones previas).
- Cada fix con su test TDD que pinea el caso (strict_tdd del repo).

## Cierre por proceso (quién decide)

El orquestador (esta sesión) re-puntúa con evidencia del export real después
de cada iteración. Un proceso se da por terminado (>9) cuando: su criterio de
cierre se cumple en el export real, tiene test que lo pinea, y sobrevive 2
iteraciones sin regresión. La nota es honesta: si un proceso vuelve a fallar,
se reabre.

## Fuera de alcance

- OCR (PDFs escaneados siguen reportándose, no procesándose).
- Nuevo modelo LLM o reescritura del parser.
- Datos del proveedor (nombres/categorías correctas que no figuran en el PDF).
- Cambios de persistencia/migración.
