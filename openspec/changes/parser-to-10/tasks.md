# Parser a 10 — Tasks (IT25 + IT35 + IT35b)

## Hecho (recall_dirty)
- [x] IT25: regla marketing puffery → **recall 65% → 85%**, FP 8% estable, 0 FPs de marketing.
- [x] Tests INF nuevos; audit G=2269 Y=40 R=0 (idéntico).

## Hecho (refactor — IT35)
- [x] **Monolito 3.084 → 2.838 líneas** (−246): extraído `pdfParserClassifier.js` con
      extractUsdPrice, detectBrand{FromTextLine,FromContent,FromFilename},
      detectCategory[WithEvidence], guessCategory, cleanProductTitle.
- [x] API preservada vía `Object.assign(PdfParser, PdfParserClassifier)`:
      browser (script antes de pdfParser.js) + node (require fallback para
      ground-truth/measure-extraction).
- [x] **Comportamiento 100% neutro**: recall 85%/FP 8% SIN CAMBIOS;
      measure-extraction "Sin cambios: 19 casos"; tests 1020/1020 + lint 0/0.

## Conclusión honesta (IT35b) — 6 FN residuales = techo real
Los 6 falsos negativos que quedan NO son flaggeables sin violar el anti-overfit:
- `M720 Wireless Mouse` / `G502 Wired Mouse` (CRITICO): código+tipo — estructuralmente
  idénticos a "F75 Gasket Keyboard" (legítimo). Cola humana por diseño (IT17).
- `68 Keys Esport` / `0500 Backpack Tactical 15.6`: marketing + tamaño. Probado:
  refinando la regla a "1 marketing sin código" → recall 90% PERO FP 8→12%
  (aparece "Flagship PRO 68 Keys"). Viola la condición FP no sube → revertido.
- `Mount Tai GT powder` / `Hall Effect Ace 68 Air`: nombres que parecen reales
  (tecnología/línea real). Flaggearlos = falsos positivos seguros.

**Decisión**: la regla IT25 (85%/8%) es el balance calibrado correcto. Forzar los
6 restantes requiere conocimiento por catálogo (overfit) o aceptar FP (viola spec).