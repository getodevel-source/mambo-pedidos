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
- [ ] Vista de historial de cotizaciones en la UI (re-abrir/re-imprimir).
- [ ] Logo configurable (data-URL) en el modal.