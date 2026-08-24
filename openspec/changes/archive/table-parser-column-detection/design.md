# Design: table-parser column detection

## Current extraction (baseline)
- `extractPageProductsByCellGrid` / `extractPageProductsByTableRows` group text
  items by X bands and price anchors, then build `rawModelo`/`rawVariante` from
  the non-price, non-color tokens by relative X. `sanitizeProductNames` cleans
  the result. `lastInheritedModel` handles *empty* model rows but is page-global
  (not column-scoped) and never overrides a non-empty (but wrong) model.
- Consequence: a switch column becomes part of `rawModelo`; a merged-cell color
  row steals the switch text as its model; a matrix header is never joined to its
  price anchor.

## Target architecture
Introduce a **table-structure pass** before row extraction that, per page,
produces a `columnMap` (role → x-range) and a `rowModel` resolver:

1. **Header detection.** Scan the top text band of each table region for header
   tokens: `model|product|item`, `color|colour`, `switch|axis|key switch`,
   `price|usd|rmb|fob`, `picture|image`. Map each detected header to its X band.
   Confidence-gated: if no header is found, fall back to the current positional
   behaviour (zero change for header-less tables → no regression).
2. **Role-aware row parsing.** With a `columnMap`, assign each text item to a
   role by X, so the switch column never pollutes the model column.
3. **Merged-cell resolver.** Track the last model *per column band*. A row whose
   model band is empty inherits from its column band (not page-global). A row
   whose model-band text is *switch/color-only* (no product code, per
   `assessModelQuality` + a code-presence check) is treated as a merged-cell
   continuation and inherits, pushing its text to variant.
4. **Matrix resolver.** Detect the RMB/USD × model-column grid (row labels
   `RMB PRICE|USD PRICE|Without mic|With mic`, column headers = model names) and
   emit one product per (model-column × price-row) with the header as model.

## Guards (regression prevention)
- Every structural decision is **confidence-gated**; low confidence ⇒ current
  positional path (unchanged output).
- Inheritance only when (a) same column band (|Δx| < band width), (b) same brand,
  (c) the row's own model text is code-less AND switch/color-like, (d) not equal
  to the inherited model. This protects code-less-but-valid names (`Cobra`,
  `Polar`, `Anya`) which carry no switch/color token.
- The honest semaphore (FASE 1) stays as a backstop: anything the parser still
  gets wrong is downgraded rather than shown as false green.

## Verification contract (per slice)
Run `scripts/ground-truth.js` (seeded, reproducible) then compare against
`ground-truth/verdicts.json`:
- **Improvement:** targeted case ids move CRITICO/CAMPO → OK/MENOR.
- **No-regression:** no case that was OK/MENOR becomes CRITICO; the
  `measure-model-quality.js` FP rate on clean models does not increase.
- Unit tests (strict TDD) for each new resolver with the exact crop rows as
  fixtures.

## Open questions (resolve during slice work)
- Header vocabulary coverage across the 13 PDFs (measure before/after per file).
- Whether matrix detection should be opt-in per brand-prior (KZ/Haimu) to bound
  blast radius.
