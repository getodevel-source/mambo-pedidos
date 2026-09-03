# Spec: process-pedido

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Armado del pedido desde la selección: índice por sku, validaciones (RED bloquea), costos CIF/IVA/flete, render de tabla.

## Estado actual (2026-09-02, corpus real)

armarPedido 1200 **48ms** · recalc **33-36ms**. Nota 9/9.

## Definición de 10 REAL

Armado <100ms con 5000 seleccionados gateado; render de tabla paginado (hoy completo) si >2000 items en el pedido.

## Camino al 10 (pasos)

- [ ] Umbral check 200→150ms tras margen.
- [ ] Paginación de la tabla del pedido solo si la medición lo pide (>2000).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check armar/render/recalc <200ms.
- RED bloquea pedido (test existente).
- Invalidación: romper la validación de RED.
