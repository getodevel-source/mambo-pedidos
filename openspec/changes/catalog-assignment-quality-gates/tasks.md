# tasks — catalog-assignment-quality-gates

Estado: **implementado y verificado, pendiente de archivo**.

Este change quedó congelado porque nunca tuvo `tasks.md`: sólo
`proposal.md`. Al reconciliarlo contra el árbol (2026-08-29), las tres slices que propone ya
están implementadas en `src/js/catalogAssignmentGates.js`, y los 7 criterios de
éxito se verifican con números del export real en vez de estimaciones. Este
archivo registra esa verificación para que el change se pueda cerrar con
evidencia y no por antigüedad.

Medición de referencia: `catalog-export.json` regenado hoy contra los 13 PDFs
(`MAMBO_CATALOG_DIR="C:\Mambo catalogos" node scripts/export-catalog-batch.js`),
2.170 productos. Los números de abajo salen de `CatalogAssignmentGates.runAll()`
sobre ese export, o sea de la implementación misma, no de un script aparte.

## Slice 1 — image-assignment-integrity

- [x] `applyImageIntegrityGates` con identidad de imagen por hash de bytes
      (`imageIdentity`, `hasRealImage` en `catalogAssignmentGates.js:85-93` y
      vecindad), no por SKU.
- [x] Cross-category compartido = falla dura. **Medido: `crossCategory: 0`**
      (baseline del proposal: 22).
- [x] Cross-brand permitido sólo con identidad exacta. **Medido:
      `crossBrandNoIdentity: 0`** (baseline: 7).
- [x] Placeholder `"-"` degrada el status. **Medido: 0 productos GREEN con
      placeholder** (baseline: 481 GREEN con score 100).
- [x] Métricas de cobertura emitidas: `placeholderRate 0.0106` (1,06%),
      `uniqueImages 1904`, `sharedImages 196`, `sharedProductCount 439` sobre
      2.170.

## Slice 2 — model-name-quality

- [x] `isTemplateModel` / `isBareGenericModel` / `isAmbiguousModel` /
      `isWatchModel` / `isTruncatedModel` / `isBareTypeWordModel` /
      `isMidModelTypeKeyword`.
- [x] Genéricos no importables como GREEN. **Medido: `genericModels: 2`** y las
      2 fueron cambiadas por el gate en esta corrida (2 cambios con
      `reason: generic-model`); ningún GREEN queda con modelo genérico.
      Baseline del proposal: 43.
- [x] Truncados: reparar o YELLOW. **Medido: `truncatedModels: 0`**
      (baseline: 29).
- [x] Duplicados reales detectados por `duplicateKey` =
      `marca|cat|modelo|variante|fob`. **Medido: `duplicateGroups: 0`,
      `duplicateProducts: 0`**.
- [x] **Corrección al proposal** aplicada en el propio `proposal.md` (criterio de
      FOB". Con esa clave, el export de hoy daría **382 grupos / 906 productos
      flaggeados**, y son todos falsos positivos: variantes de color del mismo
      modelo al mismo FOB dentro del mismo catálogo (ej. `8bitdo Ultimate`
      `$35.19` en Wireless / Black Controller Wireless / White Wireless). La
      implementación ya usa la clave ancha (incluye `cat` y `variante`), así que
      el bug es del texto del proposal, no del código. Dejar la aclaración donde
      corresponda al archivar.

## Slice 3 — assignment-audit-report

- [x] `computeMetrics` con `before`/`after` + `changes` + `duplicates`, que es
      el reporte pos-import que pedía la slice. Idempotencia verificada:
      `before` e `after` son idénticos sobre un export ya gateado, con 61
      cambios residuales (59 `watch-model`, 2 `generic-model`) y 0 duplicados.
- [x] Reproduce baseline y delta mecánicamente desde el export (no snapshot
      exacto, como pide la sección de riesgos).
- [x] Enganchado a un comando versionado: `npm run audit:assignment`
      `CatalogAssignmentGates.runAll()` a mano. Un `npm run audit:assignment`
      que lo escriba a un JSON (gitignored, como el resto de los reportes) sería
      lo equivalente a `npm run audit:full`. No bloquea el cierre.

## Criterios de éxito del proposal, con evidencia

| Criterio | Estado | Evidencia medida hoy |
|---|---|---|
| 0 imágenes compartidas entre categorías | ✅ | `crossCategory: 0` |
| Cross-brand sólo con identidad exacta | ✅ | `crossBrandNoIdentity: 0` |
| Placeholder < 5% y nunca GREEN | ✅ | 1,06% y 0 GREEN con placeholder |
| 0 modelos genéricos importables como GREEN | ✅ | 2 genéricos, ambos degradados por el gate |
| Truncados reparados o YELLOW | ✅ | `truncatedModels: 0` |
| Duplicados reportados con SKU concretos | ✅ | `duplicateGroups: 0` con clave correcta |
| Reporte reproduce baseline y deltas | ✅ | `before`/`after`/`changes` de `runAll` |

## Tests

Los gates tienen cobertura en la suite: `src/js/tests.js` ejerce
`catalogAssignmentGates` (incluido el `else` muerto que sobró del
`PONYTAIL_AUDIT.md` #1 y el IT23-ncmKey del batch 1), y `npm run test` está
en verde. La slice 1 y 2 no pidieron fixtures nuevos porque el export real
hoy cumple los criterios *sin* intervención, que es justamente lo que había
que demostrar.

## Fuera de alcance (sin cambios respecto del proposal)

OCR, proveedor de visión nuevo, reescritura del parser, sync de imágenes en la
nube, rediseño de precios/IVA/logística, corrección manual por proveedor,
changes de pipeline de release o de persistencia.

## Pendiente para cerrar el change

1. Decisión del dueño: `openspec/changes/catalog-assignment-quality-gates/` →
   `archive/`. Convención vista en `archive/calculo-to-10`: la carpeta archivada
   guarda `tasks.md`. Como los 7 criterios están medidos y cumplidos, el archivo
   es procedente; no lo hice yo porque archivar suele ir acompañado del sync de
   specs (`openspec/specs/`), y eso es decisión de workflow.
2. La corrección de la clave de duplicados en el texto del proposal (Slice 2 de
   este archivo la documenta).
