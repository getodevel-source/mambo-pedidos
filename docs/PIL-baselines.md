# PIL Baselines — métricas por iteración del Parser Iteration Loop

## Iteración 0 — Baseline inicial (2026-08-30)

Entorno: Linux, `MAMBO_CATALOG_DIR=~/Downloads`, los 13 PDFs de proveedores.

| Métrica | Valor |
|---|---|
| Productos extraídos (13 PDFs) | 1.472 (cargados en la app) |
| RED de calidad de modelo | **48** — patrón dominante: "Modelo = specs técnicas de hoja de datos" |
| YELLOW a revisar | 341 |
| Image-fit mismatches | 174 (todos advisory, 0 duros) |
| RED estructurales | 0 |
| Snapshot vs parser actual | 52,3% de ids casados — **snapshot desfasado** |
| Visual ground truth (n=65, snapshot viejo) | recall dirty 100% (40/40), FP 8% (2/25) |

Patrones de falla visibles en el diff de 65 casos (top):
1. **Switch/spec names robando el modelo** (p.ej. modelo="Mount Tai GT" en vez de "Ace68GT"; #62, #65 críticos).
2. **Sufijos V2/V9 perdidos o mal ubicados** (#55, #61 críticos).
3. **Celdas fusionadas con alineación ambigua** (#50 menor).

Primer paso recomendado: re-etiquetar el snapshot (`node scripts/ground-truth-diff.js --packet`,
65 casos) para que las métricas vuelvan a describir el parser actual.

## Iteración 1 — (pendiente)