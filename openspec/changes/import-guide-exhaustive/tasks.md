# Import Guide Exhaustive — Tasks (Etapa A)

## Iteración A1 — Motor `ImportGuide` (plan de acción por régimen)

- [ ] `src/js/importGuide.js` (nuevo, puro, sin DOM): catálogo de pasos por régimen
      (14 marítimo / 8 courier con sus responsables, costos, fuentes, plazos estimados).
- [ ] `PESO_UNITARIO_KG` por categoría (teclado ~1, mouse ~0.15, headset ~0.4, controller
      ~0.5, mousepad ~0.1) + `pesoTotalKg()` que respeta `item.weightKg` si existe (d4:
      editable por ítem).
- [ ] `proposito` (personal | reventa, d1): courier reventa agrega aviso de régimen fiscal
      (simplificado es de consumidor final) y paso ENACOM si hay inalámbricos; personal usa
      el simplificado tal cual.
- [ ] Pasos condicionales: ENACOM (inalámbrico y no uso-personal), litio DG (aéreo),
      arancel courier (> USD 400), invalidez courier (> USD 3.000 o > 50kg) →
      `plan.valido=false` + sugerencia régimen importador.
- [ ] `ImportGuide.planFor(pedido, state, doorConfig)` → plan ordenado con `completo`/
      `faltantes` por paso + `avisos`.
- [ ] Test de exhaustividad: pedido mixto cable+wireless → afirma el SET COMPLETO de
      pasos esperados (marítimo y courier). Agregar un paso sin tocar el test = rojo.

## Iteración A2 — Validación fail-closed en el wizard

- [ ] `ImportWizard.validate()` → `{ faltantes: [{paso, queFalta[], impacto}] }`.
- [ ] Cada paso del wizard muestra sus faltantes (rojo, nunca silencioso).
- [ ] Resumen (paso 6) lista faltantes con impacto sobre el número presentado + aviso de
      defaults activos (peso 0 → flete %, seguro 1.5%).
- [ ] `saveAsImport()` bloqueado con faltantes blocking; mensaje dice QUÉ falta.
- [ ] Tests: faltantes exactos para pedido sin flete/seguro; courier inválido bloqueado;
      defaults marcados.

## Iteración A3 — Datos editables por producto (d3/d4: todo editable, todo integrado)

- [ ] Paso 2 del wizard: peso unitario por ítem editable (default de categoría si no se
      cargó) + FOB por ítem editable (override del proyecto, sin tocar el catálogo).
- [ ] Paso 3 del wizard: selector de propósito del envío (personal / reventa) → el plan y
      los avisos se adaptan en vivo.
- [ ] Flete courier por peso real de ítems + chequeo 50kg/3.000 USD en vivo.
- [ ] Paso 2: exposición de certificaciones por ítem (wireless → ENACOM: ¿certificado del
      fabricante o trámite propio? → costo + paso 11 del plan).
- [ ] Origen (default China) en el checklist documental.
- [ ] Tests: peso editado vs default, límites courier, certificación por ítem, recálculo
      en vivo al editar FOB/peso.

## Iteración A4 — Vista "Plan + Seguimiento"

- [ ] Modal "Ver plan completo" desde el wizard (paso 6): checklist navegable, marcar
      completado, próximo paso pendiente destacado.
- [ ] Persistencia del plan + estados (AppStorage, patrón existente).
- [ ] Plan adjunto al registro IMP-xxxx en `saveAsImport()`.
- [ ] Tracker: vista del plan del registro (próximo paso + checklist tildable).
- [ ] Tests: plan guardado/restaurado, plan en registro IMP.

## Iteración A5 — Verificación de fuentes y cierre

- [ ] Revisar con fuente los pasos ⚠️: pago/LC (bancos), requisitos SIM (AFIP), plazos
      courier (DHL/FedEx), excepción batería integrada (IATA), plazos ENACOM.
- [ ] Decisión d1 verificada: courier reventa "por cuenta y orden" → si la fuente
      confirma matriz completa, ajustar el motor con regresión pineada (patrón del motor);
      si no, la guía queda con el aviso y el motor NO se toca.
- [ ] Auditoría de integración (d3/d4): editar cualquier valor editable en cualquier paso →
      motor, resumen y plan recalculan y coinciden; wizard→saveAsImport→Tracker→plan→
      restaurar roundtrip; script integrity + gates intactos.
- [ ] Cierre: 1504+ tests verdes, lint 0, `audit:full` sin regresión, perf wizardSteps
      gate intacto, verificación e2e manual (demo 10 ítems → plan → guardar → Tracker).

## Fuera de alcance (Etapas B/C)

- Ranking de rentabilidad por ítem, peso/origen por SKU en catálogo (B).
- Comparador de regímenes nuevos: postal, zona franca (C).
- Monitores/S-Mark como guía de trámite (hoy solo costo en el motor).