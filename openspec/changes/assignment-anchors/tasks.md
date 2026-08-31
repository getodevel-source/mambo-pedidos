# tasks — assignment-anchors

## U1 — Baseline real (muestreo OCR de los 94)

- [ ] Script scratch (no versionado) que corre processPdfFile sobre los 13
      PDFs y recolecta los productos con warning que matchea
      FOB_NEIGHBOR_ANCHOR / FOB_UNALIGNED (por raw/warnings).
- [ ] Agrupar por PDF + razón; tomar ≥15 casos (cubriendo los PDFs con más
      casos, p.ej. AULA/AJAZZ/MCHOSE).
- [ ] Render + OCR de cada página (pipeline visual): decidir para cada caso
      si el FOB asignado es REALMENTE el de la fila (TP=cruzado real) o es
      correcto (FP=ruido geométrico). Documentar por caso.
- [ ] Guardar el veredicto en el spec (tabla TP/FP) y fijar la dirección de
      U2 según la causa dominante.

## U2 — Fix según causa

- [ ] Si FP dominante: calibrar tolerancias (columnTolerance/rowTolerance)
      con el menor cambio que mate los FPs del muestreo, manteniendo 0 TP
      perdidos; golden audit idéntico obligatorio (solo downgrade de warning,
      no cambia productos).
- [ ] Si TP dominante: ajustar la fila de anclaje (baseline del row-text en
      groupItemsByRow) para el patrón que falla; correr golden: si el hash
      cambia, validar el diff con OCR (re-etiquetar casos del snapshot que
      toque) y registrar el hash nuevo como baseline.
- [ ] Soportar la decisión con el muestreo: cada fix debe eliminar ≥1 caso
      del muestreo sin convertir ningún TP del muestreo.

## U3 — Gate calibrado

- [ ] importGates: si U1 muestra FP alto, los gates FOB_NEIGHBOR_ANCHOR /
      FOB_UNALIGNED se mantienen como YELLOW (no RED) y la razón se ajusta
      para reflejar el riesgo real (texto/matcher) según lo medido.
- [ ] Test de gate por cada caso del muestreo agregado (los cruzados reales
      siguen pasando a YELLOW; los FP del muestreo salen de YELLOW si el fix
      es de gate).

## U4 — Cierre

- [ ] Re-auditoría completa (audit:full): conteo final de anclas por PDF.
- [ ] gates: npm test, lint, check:version, layout-audit.
- [ ] docs/PIL-baselines.md: entrada assignment-anchors con TP/FP del
      muestreo, fix aplicado y conteo final.
- [ ] Spec archivado en openspec/changes/archive/ + push + CI verde.