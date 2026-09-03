# Import Precision Pass — Tasks (P1-P4)

## P1 — Validación dura ✅

- [x] FOB ≤ 0 por ítem → blocking (nombra hasta 3 productos).
- [x] Cantidad ≤ 0 por ítem → blocking.
- [x] NCM genérico (OTRO) → aviso visible, no blocking.
- [x] `orden-compra` sale del mapa plan→wizard (el wizard lo bloquea; el plan lo
      sigue mostrando en su checklist).
- [x] Tests: FOB 0, qty 0, OTRO.

## P2 — Flete exacto ✅

- [x] Motor: `doorConfig.fleteUsd > 0` gana (regresión: ausente = idéntico).
- [x] Wizard: modo `usd` (monto forwarder) + `pesoVolKg` + `_chargeableKg()`.
- [x] `_doorConfig`/`_estimateFlete` usan el cobrable; plan valida modo usd.
- [x] Paso 3: selector de modo, inputs, hints.
- [x] Tests: precedencia, cobrable, doorConfig, blocking, paso completo.

## P3 — TC real ✅

- [x] `state.tipoCambio` (0 = automático), `_tc()`, `useAppTc()`.
- [x] Paso 3: input + "usar el de la app" + "volver a automático".
- [x] Fluye al motor (ARS, crédito fiscal, veredicto usan el TC mostrado).
- [x] Tests: manual, auto, flujo, escala ARS ×2.

## P4 — Ganancia explícita ✅

- [x] `Ganancia total estimada + margen real %` siempre visible en el paso 6.
- [x] Test: contiene "Ganancia total estimada" y "margen real".