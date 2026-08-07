# SKU a 10 — Tasks (IT26)

## Hecho
- [x] SKU legible `BRAND-CAT-SLUG-HASH4` (ej `AUL-TEC-F75-3F2A`) con `slugOf(modelo)`
      que prefiere el token del modelo con dígitos.
- [x] Determinista + colisión con salt (sin cambio).
- [x] `allocateBatch` preserva SKUs de origen válidos (catálogos existentes intactos).
- [x] `auditSkus GENERATED_RE` acepta formato viejo (hash8) y nuevo (slug-hash4).
- [x] Tests: formato legible + slugOf + determinismo. 1006/1006 + lint 0/0.
- [x] Verificado browser: demo conserva SKUs, nuevos legibles (`ATK-TEC-RS6-8608`).