# Cotizaciones a 10 — Tasks (IT24)

## Hecho
- [x] Configurable branding (razón social, CUIT, dirección, localidad, cliente,
      condiciones, validez, moneda, costo visible) persistente en localStorage.
- [x] Número de cotización secuencial `NQ-####` persistente.
- [x] Desglose por ítem consistente (subtotal = pvp×qty, fuente única) + costo
      opcional (uso interno).
- [x] Moneda USD/ARS + tipo de cambio (default el de la app).
- [x] Export: HTML imprimible/PDF (mejorado) + CSV nuevo.
- [x] Historial de cotizaciones emitidas (últimas 50).
- [x] Modal de configuración de cotización (abre desde el pedido).
- [x] XSS: todos los campos escapados (test).
- [x] 994/994 tests + lint 0/0.

## Pendiente (opcional)
- [x] Vista de historial de cotizaciones en la UI (re-abrir/re-imprimir).
- [x] Logo configurable (data-URL) en el modal.

## Logo configurable (cerrado por evidencia)

Estaba implementado y la caja seguía desactualizada:
`QuoteGenerator.config.logo` (`quoteGenerator.js:14`) se consume en el
encabezado del documento (`:129`), que usa `<img src="${esc(cfg.logo)}">` con
la data-URL y cae al logo tipográfico cuando está vacío. El editor vive en el
modal de configuración (`saveConfigFromModal`, `:257-266`).

## Historial de cotizaciones (cerrado 2026-08-29)

El historial se escribía y nadie lo leía. Ahora tiene las dos mitades:

- `QuoteGenerator.historySnapshot(pedido)` guarda el detalle mínimo (sku, marca,
  modelo, variante, qty, pvp, fob + totals) en cada entrada, y
  `QuoteGenerator.openFromHistory(i)` reabre/reimprime desde ese snapshot con
  `skipHistory`, para que reabrir no se duplique como emisión nueva.
- `HistoryView.renderQuotes()` pinta el bloque "Cotizaciones emitidas" debajo de
  los pedidos, con el importe en su moneda y un botón por entrada. Las entradas
  del historial anterior (sin snapshot) se muestran marcadas "sin detalle" y sin
  botón: abrir un documento vacío que parece una cotización real sería peor que
  decir que no se puede.

Cobertura: 14 asserts de datos (snapshot, reapertura, no duplicación, entrada
vieja, índice inexistente) en `src/js/tests.js` y 7 del bloque DOM en
`scripts/quality/app-smoke-tests.js`. El `catch (e) {}` vacío de `saveToHistory`
ahora registra el fallo en consola.

Deuda conocida y a propósito afuera de esta caja: el historial de cotizaciones
sigue en `localStorage` crudo, no en `AppStorage` (a diferencia del draft y del
state del wizard, que sí migraron). Con el tope de 50 entradas el riesgo de cuota
es chico, pero en desktop no viaja en el store de `$APPDATA`. Vale un cambio
propio si algún día se convierte en un libro de cotizaciones.
