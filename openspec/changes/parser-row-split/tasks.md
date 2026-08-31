# tasks — parser-row-split

## U1 — Mapa de dependencias (yo, quick)

- [ ] Con acorn: listar para extractPageProductsByTableRows y
      sanitizeProductNames las referencias a consts module-level y a this.*
      (para saber qué funciones del módulo tocan).
- [ ] Decidir el conjunto movible: row-matching (extractPageProductsByTableRows +
      sus helpers directos no movidos) y/o sanitizeProductNames.

## U2 — Extracción (delegada a subagente)

- [ ] Crear src/js/parser/rowMatch.js (o sanitize.js) con el patrón cellUtils
      (module.exports + window.RowMatch + Object.assign en pdfParser).
- [ ] Mover las funciones SIN editar su cuerpo; ajustar solo los accesos a
      consts module-level si existen (copiarlas al módulo nuevo con
      ponytail comment si son estáticas).
- [ ] index.html: script de cada módulo nuevo ANTES de pdfParser.
- [ ] node --check + require smoke (interfaz PdfParser intacta).

## U3 — Golden + gates

- [ ] Harness golden: hash idéntico (fd0ac1d1…) sobre los 13 PDFs.
- [ ] npm test (1.504+) + lint + check:version + layout-audit.
- [ ] Script integrity del runner en verde.

## U4 — Cierre

- [ ] wc -l pdfParser (meta ≤3.200 o techo documentado).
- [ ] Registro en docs/PERF-baselines.md.
- [ ] Commit + push + archive del spec.