# Import Precision Pass — P1-P4 (sin errores, todo calculado, muy precisa)

Fecha: 2026-09-03. Estado: IMPLEMENTADO. Dueño: sesión principal.
Tipo: feature / validación / precisión. Relacionado: import-guide-exhaustive,
import-profitability-compare.

## 0. Qué resuelve

Dirección del dueño: la app guía desde los catálogos hasta el fin de la
importación, calcula todos los costos y ganancias, y "no puede haber errores".
Esta pasada cierra los agujeros reales que quedaban en ese camino:

- **P1 — Validación dura**: FOB en 0 o cantidad en 0 por ítem eran guardables
  (el plan los marcaba pero `saveAsImport` no bloqueaba). Ahora son blocking con
  el producto nombrado. Ítems sin clasificar (NCM genérico OTRO) avisan sin
  bloquear: el DI puede estar mal y eso se muestra.
- **P2 — Flete exacto**: el forwarder cotiza un total en USD (LCL por CBM, aéreo,
  courier) y la app solo aceptaba kg o %. Nuevo modo `usd` (monto explícito que
  gana en el motor, con regresión pineada: ausente = idéntico). Nuevo peso
  volumétrico: en modo peso se cobra el mayor entre real y volumétrico (práctica
  del courier/aéreo). El plan valida el modo usd.
- **P3 — TC real**: el wizard tenía 1400 hardcodeado. Ahora `state.tipoCambio`
  (0 = automático: usa `cTasaCambio` de la app con dólar en vivo, si no 1400),
  editable en el paso 3 con botón "usar el de la app". Fluye al motor: los ARS,
  el crédito fiscal y el veredicto escalan con el TC mostrado.
- **P4 — Ganancia explícita**: el resumen muestra "Ganancia total estimada
  (precio sugerido − costo neto) · margen real %" siempre, no solo contra precio
  local.

## 1. Criterio de cierre (cumplido)

- 13 aserciones nuevas (`testPrecisionNoErrors`): FOB 0 / qty 0 blocking, OTRO
  avisa, fleteUsd gana (500 vs 120) e idéntico sin él, cobrable = máx,
  doorConfig lleva el cobrable, usd sin monto blocking / con monto completo,
  TC manual/auto/flujo/escala ARS, ganancia visible.
- Una aserción vieja actualizada al diseño mejorado: sin peso manual ya no hay
  default ciego (se usa el peso de los productos y se avisa).
- Gates: 1071 PASS / 0 FAIL, lint 0 errores (74 baseline), check:version OK,
  build:frontend OK.