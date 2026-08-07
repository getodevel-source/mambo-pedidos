# NCM Totalidad + Autoclasificación — Tasks (IT23)

## IT23 — Totalidad NCM + autoclasificación (F1-F4 ejecutadas)

### Hecho
- [x] **F1 Adquisición**: descargado `arancel.zip` de ARCA (Arancel Integrado) →
      parseado el nomenclador (`@`-delimitado, campo4=DI) → `src/data/ncmDatabase.json`
      (+`.js` para carga vía script sin CORS) con **10.600 posiciones NCM de 8 dígitos**.
      Pipeline reproducible: `scripts/_build-ncm-db.js`.
- [x] **F2 Carga+índice**: `src/js/ncmDatabase.js` — lazy load (localStorage → window.NCM_DB),
      `byCode()` lookup, `search()` por texto sobre descripciones, `classify()`.
- [x] **F3 Autoclasificador**: compuesto `detectCategory` → `Calculator.ncmKeyFor()` →
      matriz → `byCode()` DI autoritativo ARCA. Fallback por texto con umbral
      (lo incierto → PENDIENTE/manual, nunca silencioso).
- [x] **F4 Integración**: wizard carga la base al abrir y construye `ncmOverrides`
      con el DI real de ARCA por categoría (teclados/mouse/monitores/celulares → **0% BIT**).
- [x] **Corrección de plata**: la app SOBREcobraba 12% en teclados/mouse/mousepads y
      18% en monitores; ahora usa **0%** (BIT, Decreto 557/23) — validado contra ARCA.
- [x] **F5 Validación**: tests IT23 (total ≥9000, DI mouse 0%, lavadora 20%, celular 0%,
      clasificación compuesta). 989/989 + lint 0/0, verificado browser.

### Pendiente (próxima iteración)
- [ ] UI de búsqueda NCM manual + override por producto en el wizard (F4 avanzado).
- [ ] Medir recall@1 del autoclasificador sobre muestra etiquetada (métrica de cierre).
- [ ] Actualización automática de la base (re-descargar arancel.zip en update).