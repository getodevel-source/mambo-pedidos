# Cálculo a 10 — Spec + Tasks (IT30)

Área: #5 Cálculo (calculator.js, nota 8).

## Auditoría
El motor ya era fuerte: impuestos auditados (DI 0% BIT, IVA adic 20%, crédito
fiscal, courier/importador), NCM completo (10.504), override por categoría.
Debilidad: el **calculador simplificado (`calculateOrder`)** usaba default de
derechos **16% stale** (`getCostConfig`), sobrecargando BIT (teclados/mouse son 0%).

## Hecho
- [x] `getCostConfig(inputs, items)`: default de derechos NCM-aware — si no se
      fija, deriva del NCM dominante de los ítems (teclado→0%, lavadora→20%).
- [x] `calculateOrder` pasa los items al config.
- [x] Override del usuario mantiene prioridad (test).
- [x] Tests IT30 (teclado 0%, lavadora 20%, override). 1015/1015 + lint 0/0.