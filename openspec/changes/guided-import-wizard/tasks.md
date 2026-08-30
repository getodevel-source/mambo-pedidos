# Guided Import Wizard — Tasks (IT20)

## Iteración 20 (06/08) — Wizard guiado MVP

### Hecho
- [x] Spec `guided-import-wizard/proposal.md` — proceso guiado de 6 pasos, matriz
      impositiva auditada (ARCA/AFIP/Decreto 333/25), modelo caja vs costo neto real.
- [x] Motor puerta a puerta: `fletePct`/`seguroPct` configurables (para modo %).
- [x] `importWizard.js` — stepper de 6 pasos (catálogo → pedido → flete/seguro →
      impuestos NCM → gastos destino → resumen), reutiliza
      `Calculator.calculateDoorToDoorExactCost` y `armarPedido`/`currentPedido`.
- [x] Modal `importWizardModal` + botón "Asistente de Importación" en sidebar.
- [x] Resumen: caja vs costo neto real + crédito fiscal a favor + multiplicador,
      con toggle "¿recuperás crédito fiscal?".
- [x] Persistencia de inputs del wizard en localStorage (`mamboImportWizardState`).
- [x] Test IT20: fletePct+seguroPct en el motor (logic-tests).
- [x] Verificado en browser end-to-end (demo 10 items → Paso 6: FOB $703 → Caja
      $2.257 → Costo neto real $1.748 + Crédito $509). 978/978 tests + lint 0/0.

### Pendiente (próximas iteraciones)
- [ ] Export del resumen (PDF/CSV) desde el Paso 6. (PARCIAL: sólo CSV)
- [x] Persistencia del proyecto completo (pedido + inputs) para retomar (paso N de 6).
- [x] Aviso de vencimiento de la matriz de alícuotas (fecha de vigencia).
- [x] Selección de jurisdicción IIBB (CABA/PBA) configurable, no hardcode 2.5%.
- [x] Override de NCM por producto — cerrado 2026-08-29 (ver nota abajo).

## Reconciliación 2026-08-29 (por evidencia de código)

Ítems que figuraban abiertos y ya estaban implementados, verificados en el fuente:

- **Persistencia del proyecto**: `ImportWizard.saveProject()` + `_restoreProject()`
  guardan paso, items y state. Desde `06d083c` viven en `AppStorage.KEYS.PROJECT`
  (`$APPDATA` en desktop) con migración desde la clave vieja `mamboImportProyecto`,
  y un guardado fallido avisa en vez de fingir éxito.
- **Jurisdicción IIBB**: selector CABA/PBA en `src/js/ui/importWizard.js:252-253`,
  consumido por `ImportWizard._iibbPct()`; el 2.5% dejó de estar hardcodeado.

Sigue abierto, con evidencia de que NO está:

- **Export en PDF del resumen**: el botón `Exportar resumen CSV` existe
  (`ImportWizard.exportCsv`), pero no hay generador PDF del resumen del Paso 6.
  `QuoteGenerator` produce PDF de cotización, que no es la misma superficie.
- **Aviso de vencimiento de la matriz de alícuotas**: no hay fecha de vigencia
  ni chequeo; las alícuotas y los decretos (p.ej. "vigente hasta 31/12/2028" en el
  FAQ del propio wizard) son constantes en `calculator.js` sin metadata temporal.
- **Override de NCM por producto**: `state.ncmOverrides` está indexado por
  categoría (`importWizard.js:288`) y el motor lo resuelve por categoría
  (`calculator.js:358`). Un catálogo mixto se calcula con el NCM de la categoría.

## Vigencia de la matriz (cerrado 2026-08-29, `c8ba40f`)

`Calculator.RATES_META` (`vigenciaHasta`, `actualizada`, `fuentes`) +
`Calculator.ratesStatus(today)` devuelven `ok | proxima | vencida |
desconocida` con el mensaje listo para mostrar, y `ImportWizard._ratesBanner()`
lo pinta arriba de **todos** los pasos (un solo punto de inserción en
`render()`, reusando `.alert-banner warning/danger` que estaban en `styles.css`
sin usar). `proxima` also se dispara si la matriz pasó más de un año sin
control humano, porque las alícuotas se mueven por decreto mucho antes de
cualquier fecha de vencimiento. De las dos fechas del régimen de BIENES DE
TECNOLOGÍA DE LA INFORMACIÓN se toma la temprana a propósito.

Sigue abierto y es real: export en PDF del resumen del Paso 6 (hoy sólo CSV)
y override de NCM por producto (el key del motor sigue indexado por categoría:
`importWizard.js` guarda `ncmOverrides[cat]` y `calculator.js:358` lo lee por
`ncmKey`).
### Override de NCM por producto (cerrado 2026-08-29)

`state.ncmBySku[sku] = { ncm?, derechos? }`, resuelto en el motor con prioridad
**SKU > categoría > matriz** (IT41 en `calculator.js`). El paso 4 lista los
productos del pedido con su NCM automático y deja reasignar el código o el DI de
uno solo, marcado `corregido`, con `limpiar` por fila; vaciar el campo elimina la
entrada en vez de dejar un override fantasma. Reusa el camino IT40 (si el NCM
elegido mapea a otra fila de la matriz, trae sus rates), pero por ítem.

Sin override el resultado es idéntico al anterior (regresión pinneada), y solo
cambia el ítem corregido: el otro producto del mismo pedido conserva su base.
22 asserts nuevos en `src/js/tests.js`.

De paso: la nota fija del paso 4 decía "Alícuotas verificadas a **2026**", un año
hardcodeado que se deprecia solo. Ahora lee `Calculator.RATES_META`.
