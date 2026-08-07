# Integración + loop de parches (IT34)

## Contexto
Se integraron IT24-IT33 y se auditaron los flujos completos en el browser
(demo → pedido → wizard NCM → cálculo → cotización → puerta a puerta). Se
encontraron y parchearon 2 errores de integración.

## Parches (loop de errores)
1. **IT30 anulado por el UI**: `getCostInputs()` (app.js) forzaba `derechos`
   default 16, anulando el default NCM-aware (teclados 0% BIT). Fix raíz:
   - `cDerechos` field default `value="16"` → `value=""` placeholder "auto".
   - `getCostInputs`: pasa `derechos: undefined` cuando el campo está vacío.
   - Verificado browser: teclado → cfgDerechos 0 (antes 16), costoU correcto.
2. **Grid de catálogo usaba markup plano 2.5** para "PVP Est." — inconsistente
   con IT33 (per-categoría). Fix: `Calculator.getMarkup(r.cat, ...)` en el grid.

## Verificación
- Tests: 1020/1020 (735 + 54 + 114 + 117) · lint 0/0 · build −46%.
- Audit PASS (GREEN ≥90%, 0 RED).
- Browser: sin JS errors; todos los flujos integrados (NCM lazy, markup por
  categoría, cotización con config persistente, derechos NCM-aware).