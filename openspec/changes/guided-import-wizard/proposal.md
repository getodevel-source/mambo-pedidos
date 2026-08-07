# Guided Import Wizard — Spec auditado (proceso de importación guiado)

Fecha: 2026-08-07. Estado: PROPUESTA. Dueño: sesión principal.
Tipo: feature / UX / financiero. Relacionado: infallibility-contract, process-scorecard-loop.

---

## 0. Problema

Importar periféricos a Argentina es un proceso largo y burocrático con ~6 impuestos
en cascada + logística. Hoy la app tiene las piezas sueltas (catálogo, pedido,
flete, modal Puerta a Puerta con NCM) pero NO acompaña al usuario: hay que saber
qué tocar y en qué orden. Un impuesto mal calculado o un costo olvidado (depósito,
despachante, certificación) se traduce directo en pérdida de ganancia.

## 1. Base auditada (IT19, fuentes: ARCA, AFIP, Decreto PEN 333/2025, CNCE)

Matriz impositiva VALIDADA para periféricos esports, régimen general, SAS/responsable
inscripto:

| Concepto | Alícuota 2026 | Fuente | Estado |
|---|---|---|---|
| Derechos (DI) | Teclado 8471.60.52, Mouse 8471.60.53, Auriculares 8518.30, Controller 9504.50 = 12-20% | ARCA/Decreto 333/25 | ✓ |
| Tasa estadística | 3% CIF (tope USD 150k) | ARCA | ✓ |
| IVA | 21% (10.5% solo bienes capital/Ley 26.539) | ARCA | ✓ |
| IVA adicional | 20% (10% solo alícuota reducida) | ARCA/AFIP | ✓ (app corregida IT19) |
| Ganancias | 6% inscripto / 11% no inscripto | ARCA | ✓ |
| IIBB | 1.5-3.5% según jurisdicción (CABA/PBA) | olmoscomex | ⚠️ configurable |
| Impuesto PAIS | ELIMINADO | EY/gob.ar | ✓ |
| Antidumping | ninguno en periféricos | CNCE medidas vigentes | ✓ |
| Tasa comprobación (TCI) | menor, exenta según régimen | Decreto 483/2026 | ⚠️ menor |

Nota RG 5807: la suspensión de percepciones IVA adicional + Ganancias hasta 30/06/2026
aplica SOLO a canasta básica, medicamentos e insumos MiPyME con Certificado MiPyME.
**No aplica a periféricos → se pagan.**

### Costo: DOS números (caja vs costo neto real)

- **Caja (lo que sale al despachar)**: CIF + DI + TE + IVA + IVA adicional + Ganancias +
  IIBB + gastos operativos. Es el "2x" de las cotizaciones.
- **Costo neto real (costo VERDADERO)**: CIF + DI + TE + gastos operativos. Se resta el
  crédito fiscal a favor (IVA + IVA adicional + Ganancias + IIBB son pagos a cuenta
  recuperables). Define el precio de venta, NO la caja.

El precio de venta se calcula sobre el COSTO NETO REAL, no sobre la caja (si no, el
markup ya incluye impuestos que se devuelven → precio inflado → pierde competitividad).

## 2. Diseño del Wizard guiado

Nuevo flujo "Importación" que guía en orden, con checkpoints (no bloqueante, pero con
orden sugerido y progreso visible). Reutiliza el cálculo Puerta a Puerta (IT19) y el
modelo de crédito fiscal ya implementado.

### Pasos (stepper)

1. **Catálogo** — carga PDFs/Excel (reutiliza el import existente). Estado: catálogo presente.
2. **Pedido** — selección de productos + cantidad (reutiliza `selection` + `armarPedido`).
   Estado: pedido con items.
3. **Flete + Seguro** — modo (marítimo/aéreo/courier), peso o %, costo por kg, seguro
   (1-2% FOB). Calcula CIF. Estado: CIF calculado.
4. **Impuestos + Aduana** — NCM por categoría (matriz validada) con override editable por
   producto; muestra DI + TE + IVA + IVA adicional + Ganancias + IIBB por NCM. Estado:
   tributos por ítem.
5. **Gastos de destino** — depósito fiscal, despachante, digitalización SIM, flete interno,
   certificaciones (ENACOM/S-Mark detectadas). Estado: gastos fijos.
6. **Resumen + Decisión** — desglose por ítem, caja vs costo neto real, crédito fiscal a
   favor, multiplicador. Export (PDF/CSV) + "Guardar proyecto" para retomar.

### Reglas UX (de la auditoría IT18)

- Stepper con progreso visible y estado por paso (✓ hecho / en curso / pendiente).
- Checkpoints: el paso no se bloquea, pero el resumen advierte si faltan datos.
- Validación fail-closed: si un paso tiene datos incompletos, se marca y el paso 6
  muestra el impacto (nunca silencioso).
- Números editables donde corresponda (NCM override, %, gastos) con recálculo en vivo.
- Accesibilidad: focus trap, aria, reduced-motion (ya en la base IT18).

### Persistencia

Proyecto de importación guardado (paso N de 6, inputs, items) para retomar — el flujo
real se hace en días.

## 3. Estructura de la implementación

- `src/js/ui/importWizard.js` — controlador del stepper (nuevo).
- Modal `importWizardModal` en `index.html` (o vista nueva) con los 6 pasos.
- Reutiliza: `Calculator.calculateOrder` (flete/IVA), `Calculator.calculateDoorToDoorExactCost`
  (tributos por NCM + gastos + crédito fiscal), `armarPedido`/`selection`, `CatalogValidator`.
- Persistencia: `storage.js` (mismo patrón que historial).

## 4. Criterio de cierre

- Stepper de 6 pasos navegable con estado persistente.
- Números de cada paso = motor Puerta a Puerta (ya validado IT19).
- Resumen muestra caja vs costo neto real + crédito fiscal a favor.
- Export resumen (PDF/CSV).
- Tests: lógica del stepper (avance/retroceso, validación de checkpoints, persistencia).
- 972+ tests verdes + lint 0/0 + audit fail-closed intacto.

## 5. Riesgos honestos

- Las alícuotas cambian: la matriz debe tener fecha de vigencia y avisar si expira.
- IIBB y valores criterio dependen de jurisdicción/proveedor: se configuran, no se hardcodean.
- El costo neto real asume que el usuario recupera TODOS los anticipos (IVA, IVA adicional,
  Ganancias, IIBB). Si no revende/compensa, la caja es el costo real. El wizard debe dejar
  elegir "¿recupero crédito fiscal? sí/no" y ajustar el costo neto en consecuencia.