# Import Guide Exhaustive — La app guía TODO el proceso de importación

Fecha: 2026-09-03. Estado: PROPUESTA. Dueño: sesión principal.
Tipo: feature / UX / validación / conocimiento. Relacionado: guided-import-wizard (base),
process-wizard, import-tracker, infallibility-contract.

---

## 0. Problema (lo que dijo el dueño)

> "Yo no sé cómo importar. La app calcula bien pero no guía, no es precisa, no se puede
> importar con ella. El proceso fundamental de cada segmento es corroborar que realmente
> exista ese paso Y/O que no nos falte nada. La búsqueda y validación debe ser exhaustiva."

El asistente actual (guided-import-wizard, cerrado) es una **calculadora con stepper**:
termina en el paso 6 con un número (caja vs costo neto) y ahí muere. Lo que falta:

1. **No hay plan de acción.** Después del resumen viene el proceso real (pagar, documentar,
   despachar, tributar, retirar, homologar) y la app no dice qué hacer, en qué orden, con
   qué papeles, cuánto tarda ni cuánto cuesta cada paso.
2. **No valida fail-closed.** Se puede llegar al resumen con datos faltantes (sin flete, sin
   peso, con defaults viejos) y el número se muestra igual, "bien". La spec del wizard lo
   exigía ("nunca silencioso") y no se implementó.
3. **La exhaustividad no se puede verificar.** No hay una lista cerrada de pasos por
   régimen: no hay forma de saber si falta un paso (p. ej. ENACOM antes de vender, o el
   chequeo de los 50kg/3000 USD del courier).

## 1. Alcance confirmado por el dueño (2026-09-03)

- **Regímenes**: los DOS — courier y marítimo (despacho general). El wizard ya tiene la
  elección; el plan de acción debe generarse para ambos.
- **Productos hoy**: SOLO periféricos gamer (teclados, mouses, headsets, controllers,
  mousepads). Monitores/celulares/electrodomésticos quedan en la matriz pero NO bloquean
  esta fase (su S-Mark ya está en el motor, no se toca).
- **Objetivo**: que alguien que NO sabe importar pueda llegar de "cargué el catálogo" a
  "mi importación está despachada y retirada" siguiendo la app, sin que le falte nada.

## 1b. Decisiones resueltas por el dueño (2026-09-03)

- **d1 — Couriers y reventa**: "muchos comerciantes usan el cupo de courier para revender".
  El asistente debe soportar LOS DOS propósitos (`proposito: personal | reventa`) con
  tratamiento distinto y HONESTO: personal = régimen simplificado (hoy en el motor);
  reventa = aviso explícito de que el simplificado es de consumidor final y que la
  reventa paga matriz completa (courier "por cuenta y orden") — el cambio del MOTOR queda
  como tarea ⚠️ con verificación de fuente (AFIP/couriers) y regresión pineada. La guía
  nunca da por válido algo que no verificamos.
- **d2 — Despachante**: courier (DHL/FedEx/UPS) NO necesita despachante de aduana: lo
  despacha el propio courier. Barco SÍ: el despacho ante Aduana lo presenta un despachante
  matriculado (no se puede presentar uno mismo). El plan queda así, y la app lo explica
  en lenguaje simple.
- **d3 — Precios**: los precios del catálogo son SOLO del producto (FOB) y el proveedor
  dijo que "está todo más barato" → los valores deben poder editarse en CUALQUIER momento
  con recálculo en vivo (los inputs del wizard ya recalculan; falta que el wizard permita
  ajustar FOB por ítem y que la auditoría verifique que cada edición recalcula todo).
- **d4 — Editabilidad + auditoría**: TODO editable (pesos por unidad por ítem, gastos,
  alícuotas) y una tarea de auditoría de integración al cierre: editar cualquier valor en
  cualquier paso debe recalcular el motor, el resumen y el plan sin desincroniz

## 2. Diseño: motor de plan de acción + validación fail-closed

### 2.1 `ImportGuide` (nuevo, `src/js/importGuide.js`, motor puro sin DOM)

Genera el plan de acción COMPLETO a partir de (pedido + state del wizard + régimen).
Cada paso del plan:

```
{ id, titulo, descripcion (qué es y por qué existe), responsable
  (vos | proveedor | courier | despachante | aduana),
  costoUsd (0 si el costo ya está en el motor),
  plazo (estimado, marcado como tal), fuente,
  requiere: [campos/o-s]        // validación: qué datos deben existir
  condicion: fn(pedido, state)  // pasos condicionales (ENACOM, litio, arancel...)
}
```

**Plan RÉGIMEN MARÍTIMO (despacho general) — 14 pasos** (guía de trámite, no de cálculo):

| # | Paso | Responsable | Costo | Fuente / estado |
|---|---|---|---|---|
| 1 | Orden de compra / pro forma con proveedor (incoterm, moneda, plazo) | vos | — | práctica comercial ✓ |
| 2 | Pago al proveedor (TT / carta de crédito) | vos | % bancario (config) | bancos ⚠️ verificar |
| 3 | Producción + inspección de calidad (opcional) | proveedor | — | práctica ✓ |
| 4 | Documentación de embarque: factura comercial, packing list, BL/AWB, póliza | proveedor | — | práctica ✓ |
| 5 | Flete internacional (forwarder, por kg o CBM) | forwarder | ya en wizard | ya calculado ✓ |
| 6 | Arribo a puerto/aeropuerto (BUE/EZE) + aviso | forwarder | — | práctica ✓ |
| 7 | Designar despachante de aduana (matrícula) | vos | honorarios (ya en wizard) | práctica ✓ |
| 8 | Registro del despacho en SIM (digitalización) | despachante | simDigitalizacion (ya en wizard) | AFIP ⚠️ requisitos a verificar |
| 9 | Clasificación NCM + aforo/valor (la app ya clasifica; canales verde/rojo) | despachante | — | ARCA/CNCE ✓ (matriz auditada) |
| 10 | Pago de tributos: DI, TE, IVA, IVA adicional, Ganancias, IIBB | vos | ya en wizard | ARCA ✓ (matriz auditada) |
| 11 | Homologaciones ANTES de comercializar: ENACOM si inalámbrico (certificado del fabricante o trámite propio) | vos | ENACOM USD 350 (ya en motor) | ENACOM ⚠️ plazos a verificar |
| 12 | Depósito fiscal / TCA: almacenaje + THC | vos | ya en wizard | práctica ✓ |
| 13 | Levante + retiro con flete interno | vos | ya en wizard | práctica ✓ |
| 14 | Conteo de recepción contra packing list + compensación de crédito fiscal en DDJJ | vos | — | ARCA ✓ |

**Plan RÉGIMEN COURIER — 8 pasos** (el paso 3 y el 6 cambian según `proposito`; si es reventa se agrega ENACOM y un aviso de régimen fiscal):

| # | Paso | Responsable | Costo | Fuente / estado |
|---|---|---|---|---|
| 1 | Compra directa — ¿precio DDP (impuestos+envío incluidos) o DDU (pagás acá)? | vos | — | práctica ⚠️ decisión d3 |
| 2 | El vendedor despacha con courier (DHL/FedEx): dirección, DNI/CUIT, tracking | proveedor | flete (ya en wizard) | couriers ✓ |
| 3 | Chequeo de límites ANTES de comprar: ≤ USD 3.000 y ≤ 50kg por envío; franquicia USD 400 (FOB); >5 envíos/año (personal) | vos | — | Decreto 1065/2024 ✓ (BO 02/12/2024, Art. 1º: "sin finalidad comercial"; el excedente "no quedará alcanzado") |
| 4 | Tránsito aéreo internacional (2-7 días) | courier | — | couriers ⚠️ |
| 5 | Arribo: el courier hace el despacho simplificado (no necesitás despachante) | courier | gastos del courier (ya en wizard) | AFIP ✓ |
| 6 | Tributos si supera USD 400 (FOB; la app usa CIF, conservador): 50% del excedente + IVA 21% — los cobra el courier | courier | ya en wizard | Decreto 1065/2024 + normativa complementaria ARCA ✓ |
| 7 | Entrega en domicilio + verificación contra factura | courier | — | práctica ✓ |
| 8 | Registrar en la app (IMP-xxxx) + contador de envíos del año | vos | — | Decreto 1065/2024 ✓ (5 envíos/año por persona) |

**Pasos condicionales (el "no nos falte nada" por producto)**:

- Cualquier ítem inalámbrico (teclado/mouse/headset/controller wireless) → paso ENACOM
  (paso 11 marítimo; en courier: si es para reventa, aplica igual — decisión d1).
- Ítem con batería de litio embarcado por AÉREO → recargo DG + documentación (ya está el
  costo USD 75 en el motor; falta el paso documental, ⚠️ verificar excepción batería integrada).
- CIF courier > USD 400 → paso de tributos simplificados (ya calculado).
- CIF courier > USD 3.000 o peso > 50kg → **el régimen courier se invalida** (fail-closed):
  el plan muestra "este envío NO entra por courier → pasá a régimen importador" y bloquea
  el guardado con ese régimen.

### 2.2 Validación fail-closed en el wizard (checkpoints)

- Se agrega `ImportWizard.validate()` que devuelve `{ faltantes: [{paso, queFalta[], impacto}] }`.
- Regla "nunca silencioso": cada paso del wizard muestra sus faltantes en rojo; el paso 6
  (resumen) muestra el impacto de cada faltante sobre el número presentado
  (p. ej. "flete: sin peso ni % de flete se usó el default 15% → el CIF no es el real").
- `saveAsImport()` con faltantes de categoría **blocking** (sin flete, sin pedido, régimen
  inválido) falla con aviso explícito de QUÉ falta; faltantes no-blocking (p. ej. precio
  local de referencia) solo se anuncian.
- Los defaults silenciosos pasan a estar marcados: si un valor usa default (peso 0 → flete
  %, seguro 1.5%...) el resumen lo dice.

### 2.3 Datos por producto mínimos (solo periféricos)

- **Peso unitario por categoría** (defaults editables por ítem): teclado ~1.0kg, mouse
  ~0.15kg, headset ~0.4kg, controller ~0.5kg, mousepad ~0.1kg. Sirve para: flete courier
  real (chequeo 50kg), flete aéreo por kg, y marítimo por volumen estimado.
  (d4: el peso de CADA ítem es editable en el paso 2; el default solo se usa si el ítem
  no tiene peso propio. FOB por ítem también editable en el paso 2 — override del
  proyecto, sin tocar el catálogo.)
- **Exposición de certificaciones por ítem** en el paso 2: "este ítem es inalámbrico →
  requiere ENACOM: ¿el fabricante tiene el certificado (transferible) o lo tramitás vos?"
  → afecta costo y el paso 11 del plan.
- **Origen** (default China) como dato del checklist documental: confirma que NO aplican
  preferencias MERCOSUR (los periféricos vienen de Asia).

### 2.4 Conexión wizard → Tracker

- "Guardar como importación" guarda el registro IMP-xxxx **con su plan generado** y el
  estado de cada paso (pendiente/completado). El Tracker muestra el plan del registro:
  próximo paso pendiente destacado + checklist tildable (persistencia AppStorage, mismo
  patrón que el estado del wizard).

## 3. Estructura de implementación

- `src/js/importGuide.js` — motor puro (nuevo): planes por régimen, `proposito`
  (personal/reventa), condicionales (ENACOM/litio/límites), `planFor()` con `completo`/
  `faltantes` por paso + `avisos` de régimen. Testeable sin DOM.
- `src/js/ui/importWizard.js` — checkpoints fail-closed por paso + botón "Ver plan completo"
  (modal checklist) + peso/FOB/propósito editables por ítem.
- `src/js/importsTracker.js` / `app.js` — plan adjunto al registro + vista en Tracker.
- `src/js/calculator.js` — SOLO si la verificación de fuente d1 lo confirma (courier
  reventa = matriz completa por cuenta y orden). Hoy el motor sigue con simplificado y
  la guía avisa el riesgo; si se toca: fuente + regresión pineada.
- Tests: suite de lógica (`src/js/tests.js` patrón existente).

## 4. Criterio de cierre (medible, sin humo)

1. `ImportGuide` genera ≥14 pasos (marítimo) y ≥8 (courier) con datos completos; test que
   afirma el CONJUNTO COMPLETO de pasos para un pedido estándar mixto de periféricos
   (cable + wireless): si alguien agrega un paso al motor sin actualizar el test de
   exhaustividad, el test falla → "no nos falta nada" es verificable.
2. Test de fail-closed: pedido sin flete/seguro → `validate()` devuelve los faltantes
   exactos y `saveAsImport` bloqueado; courier con CIF > 3.000 o peso > 50kg → régimen
   invalidado.
3. Plan guardado en el registro IMP-xxxx y restaurable (tests de persistencia).
4. 1504+ tests verdes (1.028 unitarias + 239 lógica + 101 UI + 129 app), lint 0 errores,
   `npm run audit:full` sin regresión, gates de perf intactos (wizardSteps <1000ms).
5. Verificación manual e2e con demo: pedido de 10 ítems mixtos → plan completo → guardar
   → Tracker muestra plan con próximo paso.

## 5. Riesgos honestos

- **Conocimiento de proceso**: los pasos 2 (pago) y 8 (SIM) y los plazos son los que tienen
  más riesgo de imprecisión. Mitigación: la tabla de pasos marca fuente y estado (✓/⚠️), y
  los plazos se muestran como "estimados". La matriz impositiva YA está auditada y no se
  toca salvo d1.
- **d1 (courier personal vs reventa)**: hoy el motor calcula courier simplificado siempre;
  si revenden, eso es impreciso. La guía expone ambos escenarios y marca el pendiente de
  verificación — nunca valida en silencio un escenario no verificado.
- **Alcance**: NO se agregan regímenes nuevos (postal, zona franca) — eso es Etapa C del
  plan general. NO se hace ranking de rentabilidad (Etapa B).

## 6. Pendientes de verificación (antes de tocar el motor)

- **Courier "por cuenta y orden" (d1)**: confirmar con fuente (AFIP / DHL / FedEx) que un
  envío courier de una empresa con fines de reventa tributa con la matriz NCM completa y
  no con el simplificado. Hoy: la app ofrece ambos propósitos, el motor calcula
  simplificado y la guía lo advierte.
- **Requisitos exactos de SIM y plazos ENACOM/courier** (pasos ⚠️ de la tabla): marcados
  como estimados hasta verificación.

## 7. Roadmap del salto completo (contexto)

- **Etapa A (esta)**: plan exhaustivo + validación fail-closed + dato por producto mínimo.
- **Etapa B**: rentabilidad por ítem (ranking multiplicador vs margen objetivo) + peso/
  origen por SKU en catálogo.
- **Etapa C**: comparador de regímenes (general vs courier vs postal/zona franca).