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
- [x] UI de búsqueda NCM manual + override por producto en el wizard (F4 avanzado).
- [ ] Medir recall@1 del autoclasificador sobre muestra etiquetada (métrica de cierre).
- [ ] Actualización automática de la base (re-descargar arancel.zip en update).
      Estado 2026-08-29: **bloqueada por falta de fuente y de política, no por
      código.** En el repo no hay ninguna URL de descarga, ni script de
      bootstrap del arancel, ni mención a qué archivo/URL consumir (`grep` de
      "arancel" + "http" en src/ y scripts/ = 0 candidatos; la base dice
      "ARCA/AFIP" como procedencia, punto). Implementar el mecanismo de update
      es lo fácil; lo que no existe es la decisión de qué descargar, de dónde y
      con qué política (red desde la app + verificación).

## Reconciliación 2026-08-29

Las 3 cajas abiertas siguen abiertas: verificado por código, no están.

- Override por producto: `state.ncmOverrides` se indexa por categoría
  (`importWizard.js:288`) y el motor lo lee por categoría (`calculator.js:358`).
- recall@1 del autoclasificador: ningún número en el repo (`grep recall@1` sólo
  toca este tasks.md). Medirlo pide muestra etiquetada; `ground-truth/` tiene
  65 casos de calidad de modelo, no de clasificación NCM.
- Re-descarga de `arancel.zip`: no existe en `src/js/` ni en `scripts/`; la base
  es un snapshot congelado de 856 KB en `src/data/ncmDatabase.json`.
## F4 avanzado (cerrado 2026-08-29)

La búsqueda sobre la base ARCA completa ya estaba (`_ncmSearch` +
`NcmDatabase.search`, aplicada a categoría con `_setNcmOverride`). Faltaba la
mitad "por producto": ahora existe `ncmBySku` con prioridad SKU > categoría >
matriz y su UI en el paso 4. Detalle y evidencia en
`openspec/changes/guided-import-wizard/tasks.md`.
