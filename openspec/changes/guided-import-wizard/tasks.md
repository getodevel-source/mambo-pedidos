# Guided Import Wizard — Tasks (IT20)

## Iteración 20 (06/08) — Wizard guiado MVP

### Hecho
- [x] Spec `guided-import-wizard/proposal.md` — proceso guiado de 6 pasos, matriz
      impositiva auditada (ARCA/AFIP/Decreto 333/25), modelo caja vs costo neto real.
- [x] Motor puerta a puerta: `fletePct`/`seguroPct` configurables (para modo %).
- [x] `importWizard.js` — stepper de 6 pasos (catálogo → pedido → flete/seguro →
      impuestos NCM → gastos destino → resumen), reutiliza
      `Calculator.calculateDoorToDoorExactCost` y `armarPedido`/`currentPedido`.
- [x] Modal `importWizardModal` + botón "Asistente de Importación" en sidebar.
- [x] Resumen: caja vs costo neto real + crédito fiscal a favor + multiplicador,
      con toggle "¿recuperás crédito fiscal?".
- [x] Persistencia de inputs del wizard en localStorage (`mamboImportWizardState`).
- [x] Test IT20: fletePct+seguroPct en el motor (logic-tests).
- [x] Verificado en browser end-to-end (demo 10 items → Paso 6: FOB $703 → Caja
      $2.257 → Costo neto real $1.748 + Crédito $509). 978/978 tests + lint 0/0.

### Pendiente (próximas iteraciones)
- [ ] Export del resumen (PDF/CSV) desde el Paso 6.
- [ ] Persistencia del proyecto completo (pedido + inputs) para retomar (paso N de 6).
- [ ] Aviso de vencimiento de la matriz de alícuotas (fecha de vigencia).
- [ ] Selección de jurisdicción IIBB (CABA/PBA) configurable, no hardcode 2.5%.
- [ ] Override de NCM por producto (hoy por categoría).