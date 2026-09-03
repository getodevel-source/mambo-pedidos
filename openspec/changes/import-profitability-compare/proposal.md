# Import Profitability + Compare — Etapa B y C

Fecha: 2026-09-03. Estado: IMPLEMENTADO. Dueño: sesión principal.
Tipo: feature / UX / financiero. Relacionado: import-guide-exhaustive,
guided-import-wizard, landed-cost-verdict.

## 0. Qué resuelve

La Etapa A terminó con el proceso guiado y validado. Faltaban las dos preguntas
que definen si conviene importar:

- **B — "¿Qué producto me deja plata?"**: ranking de rentabilidad por ítem con
  margen objetivo configurable (el precio de venta se calcula sobre el costo neto
  real, no sobre la caja — modelo ya auditado IT19).
- **C — "¿Por dónde lo traigo?"**: comparador barco vs courier para el MISMO
  pedido, con el mismo motor (una sola fuente de verdad), explicando qué
  regímenes NO aplican y por qué.

Decisión de alcance: el peso/origen por SKU en el catálogo (previsto en B) quedó
cubierto por los overrides editables de la A3 (`itemEdits`: FOB y peso por ítem
sin tocar el catálogo). Tocar el parser del catálogo para persistir peso era
riesgo sin ganancia: se descarta a propósito.

## 1. Implementación

- `ImportWizard.state.margenObjetivo` (default 40%, editable en el paso 6).
- `ImportWizard._profitRows(res)`: por ítem — multiplicador (caja unit / FOB unit),
  costo neto unit (neto + gastos fijos prorrateados por CIF) y precio sugerido
  (neto × (1 + margen)). Ordenado por multiplicador desc. Deriva de `res.items`,
  no toca el motor.
- `ImportWizard._profitHtml(res)`: sección "Rentabilidad por producto" en el paso 6
  + línea de total sugerido vs precio local de referencia (margen real).
- `ImportWizard._compareHtml(items)`: tarjetas despacho general vs courier-personal
  (caja, neto, multiplicador) + recomendación + nota honesta de regímenes que no
  aplican (postal, zona franca, Decreto 334/2025 solo Tierra del Fuego, Ley 19.640).
  courier+reventa no se compara dos veces: calcula igual que el general (d1).

## 2. Criterio de cierre (cumplido)

- Tests: orden por multiplicador (DI 20% antes que DI 0%), sugerido = neto ×
  (1+margen), margen editable recalcula, total = suma por cantidad, comparador
  con ambas tarjetas + nota de no-aplican, pedido fuera de límites → "No entra" +
  recomienda barco.
- Gates: suite verde, lint 0 errores (ver cierre de fase en tasks de
  import-guide-exhaustive).