# Cotizaciones a 10 — Spec auditado

Fecha: 2026-08-07. Estado: PROPUESTA. Área: #7 Cotizaciones (quoteGenerator, nota 6).
Objetivo: llevar las cotizaciones al mejor resultado posible (10) de mi capacidad.

---

## 0. Auditoría actual (qué hay y qué le falta)

`quoteGenerator.js` (209 líneas) = una sola función `generatePrintableQuote`:
abre una ventana HTML imprimible con membrete básico, tabla de ítems y totales.

**Debilidades concretas (por qué es 6):**
1. **Un solo formato**: solo HTML imprimible (depende de `window.print()`), sin PDF real ni CSV.
2. **Marca no configurable**: `companyInfo` hardcodeado (Mambo Pedidos / @geto_dev), sin logo, CUIT, dirección, condiciones.
3. **Precio ítem inconsistente**: usa `item.pvp || item.fob` por ítem, pero los totales usan `t.facturacion` — pueden no coincidir.
4. **Sin desglose costo/PVP/margen**: el usuario no puede ver el margen por ítem al cotizar.
5. **Sin moneda toggle** por ítem (USD/ARS) ni tipo de cambio configurable por cotización.
6. **Sin condiciones comerciales ni vigencia configurables** (hardcodeado "5 días hábiles").
7. **Sin número de cotización secuencial** ni historial de cotizaciones emitidas.
8. **Sin persistencia**: no se guarda copia ni se puede re-editar una cotización previa.

## 1. Propuesta (llevar a 10)

### 1.1 Configuración de marca y cliente (persistente)
- Nuevo modal "Configuración de Cotización": logo (data-URL), razón social, CUIT, dirección, ciudad, condiciones de pago, vigencia (días), mensaje de pie.
- Se guarda en `localStorage` (reutiliza patrón de storage existente).

### 1.2 Número de cotización secuencial
- Contador `NQ-0001` persistente; se incrementa al emitir. Se muestra en el header.

### 1.3 Desglose por ítem consistente
- Cada ítem: Foto, SKU, Marca, Modelo, Variante, Cant, **Costo unit (informativo)**, **PVP unit**, Subtotal.
- El costo se muestra OPCIONAL (toggle "mostrar costos"); por defecto solo PVP (para mandar al cliente).
- Los totales se calculan **del pedido real** (mismos `totals` que la app), no duplicados.

### 1.4 Moneda y tipo de cambio
- Selector USD/ARS + tipo de cambio editable en la cotización (default el de la app).
- Total en la moneda elegida + equivalencia.

### 1.5 Formatos de export
- **Imprimir/PDF** (HTML imprimible, ya existe — mejorado).
- **CSV** (nuevo): exporta los ítems a archivo .csv descargable.
- **HTML** (ya existe).

### 1.6 Historial de cotizaciones
- Al emitir, se guarda en `storage` (reutiliza `AppStorage`). Vista "Cotizaciones" en el historial para re-abrir/re-imprimir.

### 1.7 Coherencia y robustez
- `esc()` ya existe. `formatCurrency` ya existe. Se reutilizan.
- Validación: pedido con ítems requerido; marca incompleta → warning pero emite.

## 2. Criterio de cierre (falsable)

- [ ] `generateQuote(pedido, { formato: 'html'|'csv', config })` emite ambos formatos.
- [ ] Número secuencial `NQ-####` incrementa y persiste.
- [ ] Los totales de la cotización coinciden EXACTAMENTE con `pedido.totals` (test).
- [ ] Configuración de marca/condiciones persistente + aplicada al documento.
- [ ] CSV exportable con todos los ítems.
- [ ] Historial: emitir guarda la cotización; re-abrir la re-imprime.
- [ ] 991+ tests verdes + lint 0/0 + smoke test del nuevo modal.

## 3. Riesgos honestos

- PDF real (no print) requeriría una lib (jsPDF) — para Tauri conviene `window.print()` del HTML (el usuario "guarda como PDF"). El spec asume print-to-PDF (sin lib nueva), salvo que el usuario pida jsPDF.
- El historial reutiliza `AppStorage`; puede crecer — se limita a las últimas N cotizaciones.