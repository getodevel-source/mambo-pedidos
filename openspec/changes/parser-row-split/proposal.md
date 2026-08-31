# División final del row-matching (parser-row-split)

## Problema (medido 31/08/2026)

U6 del sprint anterior dejó pdfParser.js en **3.385 líneas** (de 4.009): se
extrajeron 20 helpers puros a `src/js/parser/cellUtils.js` con golden
idéntico. La meta del spec era ≤3.200 y quedó documentado como deuda el
row-matching (extractPageProductsByTableRows, ~640 líneas) y
sanitizeProductNames (~215 líneas). Cada iteración del parser es más cara con
este monolito.

## Dirección

1. **U1 — Mapa de dependencias**: identificar qué usa el row-matching y el
   sanitize del scope del módulo (consts module-level, this.*, helpers ya
   extraídos). Con acorn (deps de eslint) listar referencias externas.
2. **U2 — Extracción** (delegado a worker con instrucciones estrictas):
   mover las funciones cohesivas a `src/js/parser/rowMatch.js` /
   `sanitize.js` con el patrón Object.assign + doble exposición
   browser/node (como cellUtils), SIN cambiar una línea de su cuerpo.
3. **U3 — Golden**: hash de extracción de los 13 PDFs IDÉNTICO
   (fd0ac1d1...) + 1.504+ aserciones + integrity gate (index.html con los
   scripts nuevos) + layout-audit.
4. **U4 — Cierre**: pdfParser ≤3.200 líneas (objetivo) o el mínimo real con
   golden; registro y archive.

## Criterios de cierre (todos falsables)

- [ ] pdfParser ≤3.200 líneas O ≤3.200 con golden idéntico y razón del techo.
- [ ] Golden de extracción idéntico al baseline (fd0ac1d1…) — 2309 productos.
- [ ] Integridad browser: los módulos nuevos cargan en index.html antes de
      pdfParser (gate Script integrity del runner).
- [ ] 1.504+ aserciones + lint + layout-audit verdes.
- [ ] Sin cambios de comportamiento (las funciones se mueven, no se editan).

## No-goals

- NO refactorizar la lógica interna del row-matching (solo mudarla).
- NO tocar cellUtils.js ni el classifier.