# Calidad de anclaje FOB/SKU (assignment-anchors)

## Problema (medido 31/08/2026)

En el auditoría de calidad del catálogo real (2.309 productos, 13 PDFs):

- **60** productos marcados `ancla de fila vecina` (FOB_NEIGHBOR_ANCHOR) y
  **34** `ancla no alineada` (FOB_UNALIGNED) = **94 YELLOW** de anclaje sobre
  654 totales (14%). Son la segunda clase de "semáforo" más grande después de
  los switches sueltos (224, cuyo diseño es correcto).

Qué significa (src/js/pdfParser.js, verifyGrounding): el precio FOB extraído
para un producto no está verticalmente alineado con la fila de ese producto
(`dy > rowTolerance`) o el ancla más cercana pertenece a la fila vecina. Un
FOB cruzado es un error de TIENDA: calcula rentabilidad, pvp y márgenes con
el precio del producto de al lado.

Pregunta abierta del spec (se responde en U1 con muestreo OCR): ¿cuántos de
los 94 son **falsos positivos** del gate (FOB correcto a pesar del warning) y
cuántos son **errores reales de asignación**? Hoy el gate solo avisa; nadie
midió la proporción.

## Dirección

1. **U1 — Baseline real (muestreo)**: recolectar los 94 productos con sus
   razones + raw; muestrear ~15 con OCR de la página (pipeline
   VISUAL-REVIEW-WORKFLOW): clasificar TP (FOB realmente cruzado) vs FP (FOB
   correcto, ancla geométricamente ruidosa). Esto decide TODO lo demás.
2. **U2 — Fix de la asignación** según la causa dominante del muestreo:
   - si dominan los FP: calibrar `columnTolerance`/`rowTolerance` y/o la banda
     de columna → menos YELLOW sin perder detección de cruzados reales;
   - si dominan TP: mejorar la elección de la fila (baseline del
     row-text y agrupación por filas, `groupItemsByRow`) para que un precio no
     se asigne a la fila equivocada; golden audit idéntico si no cambia salida,
     o diff acotado y re-etiquetado si la salida mejora (medible y falso).
3. **U3 — Gate**: ajustar FOB_NEIGHBOR_ANCHOR/FOB_UNALIGNED al nivel de FP
   real medido (el YELLOW debe indicar riesgo real, no ruido).
4. **U4 — Cierre**: gates completos + re-auditoría + registro en
   docs/PIL-baselines.md.

## Criterios de cierre (todos falsables)

- [ ] U1: muestreo OCR de ≥15 casos con TP/FP por caso documentado.
- [ ] Los 94 bajan a ≤47 (meta: mínimo 2x) SIN que el muestreo muestre
      pérdida de detección de cruzados reales (0 TP perdidos del muestreo).
- [ ] O, si el muestreo muestra que la tasa de FP es abrumadora: la
      calibración es la dirección y el criterio se ajusta a "≤ 60% de los
      YELLOW de anclaje actuales, con 0 TP de cruzado perdidos".
- [ ] `npm test` + `lint` + `check:version` verdes; layout-audit OK.
- [ ] Golden hash de extracción: idéntico SI la salida no cambia; si cambia
      (fix de fila), diff acotado + re-etiquetado con OCR y el hash nuevo
      registrado como baseline.
- [ ] Re-auditoría: conteo final de anclas en el report, registro en
      docs/PIL-baselines.md.

## No-goals

- NO tocar el modelo de precios en sí (solo su asignación a filas).
- NO reescribir verifyGrounding: calibrar y, si hace falta, ajustar la fila
  que se le pasa, no el verificador.
- NO perseguir 0 YELLOW (el semáforo es útil); se persigue que los que quedan
  sean reales.