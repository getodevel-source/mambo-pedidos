# Salto de resultados — Pricing por categoría (IT33)

## Auditoría (los 3 ofrecidos)
- **Master transversal**: YA existe — `confirmImport` (importFlow.js:390-433)
  deduplica entre catálogos vía `SkuAllocator.isEquivalent` (actualiza si cambió
  FOB, salta si igual, agrega si nuevo). No requiere cambio.
- **Virtualización**: YA existe — render paginado (`pageItems`/`pageSize`).
  No requiere cambio.
- **Pricing**: markup PLANO 2.5x (`pvp = costoU * config.markup`) — este era el
  gap real. Todos los productos tenían el mismo margen sin importar la categoría.

## Hecho (IT33)
- [x] `MARKUP_MATRIX` por categoría (accesorios baratos = markup alto, hardware = bajo).
- [x] `getMarkup(cat, defaultMarkup, overrides)`: precedencia override por
      categoría > matriz (si el user usa default 2.5) > markup global.
- [x] `pvp = costoU * getMarkup(item.cat, config.markup, config.markupOverrides)`.
- [x] `markupOverrides` en costConfig (per-categoría configurable).
- [x] Tests IT33 (cable 2.0, teclado 2.5, override 3.0, categoría desconocida default,
      global explícito gana). 1020/1020 + lint 0/0.
- [x] Verificado browser: cable FOB 10 → $20, teclado → $25, override → $30.