# Import Guide Exhaustive — Tasks (Etapa A)

## Iteración A1 — Motor `ImportGuide` (plan de acción por régimen) ✅

- [x] `src/js/importGuide.js` (nuevo, puro, sin DOM): catálogo de pasos por régimen
      (14 marítimo / 8 courier con sus responsables, costos, fuentes, plazos estimados).
- [x] `PESO_UNITARIO_KG` por categoría (teclado ~1, mouse ~0.15, headset ~0.4, controller
      ~0.5, mousepad ~0.1) + `pesoTotalKg()` que respeta `item.weightKg` si existe (d4:
      editable por ítem).
- [x] `proposito` (personal | reventa, d1): courier reventa agrega aviso de régimen fiscal
      (simplificado es de consumidor final) y paso ENACOM si hay inalámbricos; personal usa
      el simplificado tal cual.
- [x] Pasos condicionales: ENACOM (inalámbrico y no uso-personal), litio DG (aéreo),
      arancel courier (> USD 400), invalidez courier (> USD 3.000 o > 50kg) →
      `plan.valido=false` + sugerencia régimen importador.
- [x] `ImportGuide.planFor(pedido, state, doorConfig)` → plan ordenado con `completo`/
      `faltantes` por paso + `avisos`.
- [x] Test de exhaustividad: pedido mixto cable+wireless → afirma el SET COMPLETO de
      pasos esperados (marítimo y courier). Agregar un paso sin tocar el test = rojo.

## Iteración A2 — Validación fail-closed en el wizard ✅

- [x] `ImportWizard.validate()` → `{ faltantes: [{paso, queFalta[], impacto, blocking}], avisos, plan }`
      (blocking: sin pedido, courier fuera de límites, flete en 0%).
- [x] Cada paso del wizard muestra sus faltantes (rojo, nunca silencioso).
- [x] Resumen (paso 6) lista faltantes con impacto sobre el número presentado + aviso de
      defaults activos (peso 0 → flete %, seguro 0%).
- [x] `saveAsImport()` bloqueado con faltantes blocking; mensaje dice QUÉ falta.
- [x] Tests: faltantes exactos para pedido sin flete/seguro; courier inválido bloqueado;
      defaults marcados; checkpoints por paso.

## Iteración A3 — Datos editables por producto (d3/d4: todo editable, todo integrado) ✅

- [x] Paso 2 del wizard: peso unitario por ítem editable (default de categoría si no se
      cargó) + FOB por ítem editable (override del proyecto, sin tocar el catálogo).
- [x] Paso 3 del wizard: selector de propósito del envío (personal / reventa) → el plan y
      los avisos se adaptan en vivo.
- [x] Flete courier por peso real de ítems + chequeo 50kg/3.000 USD en vivo.
- [x] Paso 2: exposición de certificaciones por ítem (wireless → ENACOM titular:
      fabricante o trámite propio → costo + paso del plan).
- [x] Origen (default China) editable en el paso 2 (checklist documental).
- [x] Tests: peso editado vs default, límites courier, certificación por ítem, recálculo
      en vivo al editar FOB/peso.

## Iteración A4 — Vista "Plan + Seguimiento" ✅

- [x] Modal "Ver plan completo" desde el wizard (paso 6): checklist navegable, marcar
      completado, próximo paso pendiente destacado, bloqueantes/avisos visibles.
- [x] Persistencia del plan + estados (AppStorage, patrón existente: state.checks).
- [x] Plan adjunto al registro IMP-xxxx en `saveAsImport()` (snapshot pasos + checks).
- [x] Tracker: vista del plan del registro (botón "📋 Plan · N pendientes" + marcar
      completado persistiendo al registro).
- [x] Tests: guardado bloqueado/plan adjunto/overrides/checkpoints (suite wizard).

## Iteración A5 — Verificación de fuentes y cierre (investigación 2026-09-03: BO)

- [x] **d1 CERRADO con fuente primaria** (texto del Boletín Oficial): Decreto 1065/2024
      (BO 02/12/2024, Art. 1º) — el simplificado PSP/Courier rige "sin finalidad
      comercial", 5 envíos/año por persona, franquicia USD 400 FOB; el excedente "no
      quedará alcanzado por los beneficios". 50kg por paquete: Decreto 1187/93 art. 1º
      bis (citado en su VISTO). Motor ajustado (courier+reventa = matriz completa) con
      regresión pineada. Ver tasks de import-profitability-compare.
- [x] **Citas corregidas**: courier → 1065/2024; BIT/aranceles → 333/2025 (BO
      20/05/2025: Art. 1 modifica 557/23, Art. 2 confirma controllers 9504.50 → AEC
      20%, Art. 3 crea II 9,5% a celulares/monitores — la app lo avisa aunque no lo
      calcula, fuera del scope periféricos).
- [x] **Decreto 334/2025 verificado**: solo Tierra del Fuego (Ley 19.640), 3 unidades/
      año + USD 3.000 FOB por envío — no aplica a periféricos de Asia; documentado en
      el comparador.
- [ ] **Pendiente humano**: base FOB vs CIF del excedente courier (decreto dice FOB;
      la app usa CIF, conservador — FAQ lo explica), costo/plazos ENACOM, excepción
      IATA batería integrada, requisitos SIM, plazos DHL/FedEx, comisiones bancarias
      (pasos ⚠️ en el plan).
- [x] Auditoría de integración (d3/d4): editar cualquier valor editable en cualquier paso →
      motor, resumen y plan recalculan y coinciden (validate + _effectiveItems + planFor
      comparten el mismo doorConfig); wizard→saveAsImport→Tracker→plan→marcar roundtrip
      (tests); script integrity + check dinámico del wizard OK.
- [x] Cierre local (Linux, sin corpus): 1000+ aserciones verdes (1032 PASS · 0 FAIL),
      lint 0 errores, check:version OK, build:frontend OK (−46% dist). Costo validate()
      por render medido: ~0.001ms → gate wizardSteps <1000ms intacto.
- [ ] Gates con corpus/entorno del dueño (Windows): `MAMBO_CATALOG_DIR="C:\Mambo catalogos" npm run audit:full`,
      perf-audit con Playwright, e2e manual con demo: 10 ítems → plan completo → guardar
      → Tracker muestra plan.

## Fuera de alcance (Etapas B/C)

- Ranking de rentabilidad por ítem, peso/origen por SKU en catálogo (B).
- Comparador de regímenes nuevos: postal, zona franca (C).
- Monitores/S-Mark como guía de trámite (hoy solo costo en el motor).