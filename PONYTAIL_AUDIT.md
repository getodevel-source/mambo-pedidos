# Ponytail Over-Engineering Audit — Mambo Pedidos

Scoped read-only audit applying the ponytail ladder (YAGNI / reuse / stdlib / native /
installed / one line / minimal). FASE-2-owned files were NOT modified or included
(`src/js/pdfParser.js`, `scripts/ground-truth.js`, `scripts/measure-model-quality.js`,
`scripts/measure-extraction.js`, `ground-truth/`, `openspec/`). This is a **proposal** /
delete-list, not yet applied. No test gutting proposed.

## Summary per category

| Category | Findings | Est. lines |
|---|---|---|
| DEAD (unused; several test-only in production) | 14 groups | ~1,100 |
| YAGNI (speculative config / defensive dup) | 3 | ~60 |
| REIMPLEMENTED (JSON-roundtrip clone where shallow fits) | 3 | ~10 |
| DUPLICATED (needs consolidation, incl. 4× esc, 4× color vocab) | 8 | ~350 |
| VERBOSE (one-liner as many lines / misleading structure) | 4 | ~35 |

## Delete-list (priority-ordered)

| # | Location | Current code | Suggested change | Cat | Conf | Risk |
|---|---|---|---|---|---|---|
| 1 | `catalogAssignmentGates.js:392-408` | final `else` of `parenIdx` chain | delete (~15 lines; unreachable) | DEAD | HIGH | none |
| 2 | `ncmDatabase.js:82-115` | `SYNONYMS` + `_expand()` + `classify()` | delete (zero callers incl. tests) | DEAD | HIGH | none |
| 3 | `imageTextGates.js:309-346` | `interiorColorFor()` adapter | delete (no caller) | DEAD | HIGH | none/low |
| 4 | `importGates.js:26-31` | `isGateFlagged()` | delete | DEAD | HIGH | none |
| 5 | `importGates.js:303-319`, `imageTextGates.js:569-584`, `textSanitizer.js:1025-1033` | `setCalibrationFlags()` 3× + getters | delete all 5 (0 callers) | DEAD | HIGH | none |
| 6 | `ui/modals.js:318` | `JSON.parse(JSON.stringify(origCosts))` | `{ ...origCosts }` (primitive inputs) | REIMPL | HIGH | none |
| 7 | `pdfParserClassifier.js:219-221` | `guessCategory()` wrapper | delete + drop test ref | DEAD | HIGH | low |
| 8 | `ui/notifications.js:48-74` | `showFileProgress`/`requestCancel`/`isCancelRequested` | delete + harness cleanup | DEAD | HIGH | med |
| 9 | `updater.js:380-440` | `validateConfig`, `detectPlaceholderSignatures` | delete + test cleanup | DEAD | HIGH | med |
| 10 | `reliability.js:62-79,106-120,253-361` | `safeCall`, `exportErrorLog`, `validateImportSchema`, `detectEncoding`, `buildImportSummary`, `validateProductViability`, `validateFileType` | delete 7 test-only fns | DEAD | HIGH | med |
| 11 | `reliability.js:219-251` | `recoverFromBackup()` | delete (test-only) | DEAD | HIGH | med |
| 12 | `importGates.js:227-240` | `assertAtomicReasons()` | delete + test cleanup (keep comment) | DEAD | HIGH | med |
| 13 | `app.js:39`, `glossary.js:~45`, `quoteGenerator.js:~121`, `ui/importWizard.js:130` | 4× HTML `esc` | single `window.esc` + delegate (keep Node-side for quote gen) | DUP | HIGH | low/med |
| 14 | `calculator.js:350-367` vs `calculator.js:273-278` | inline `ncmKey` chain | `this.ncmKeyFor(item)` (behavior fix) | DUP | HIGH | med |
| 15 | `skuAllocator.js:120-289` | archived Slice 6 `auditSkus`/`buildSkuMapping`/`checkAmbiguityGate` | delete + test cleanup | DEAD | HIGH | med |
| 16 | `storage.js:368-570` | archived Slices 5/7 `*Evidence`, `auditInlineImages`, etc. | delete 6 fns + test cleanup | DEAD | HIGH | med |
| 17 | `catalogValidator.js:421-782` | `evaluateItem` + `_makeEval` + `_defaultEvaluations` + `aggregateViolations` (~370) | delete/move to tests-only | DEAD | HIGH | med |
| 18 | `ui/importFlow.js:~94-100/~122-126/~166-168` | `isPhotoOnly*` 3 copies diverging | single shared method | DUP | HIGH | low |
| 19 | 4 files | color vocabulary ×4 | one list in `ImageTextGates`, others reference | DUP | HIGH | med |
| 20 | `importGates.js:176-186` | `deriveReasonCode` tail scrambled order | reorder + fix comment | VERBOSE | MED | low |
| 21 | `catalogValidator.js:~176-183/~457-481` | `GARBAGE_RE` declared 2× | hoist one | DUP | HIGH | none |
| 22 | `remediation.js:~1248-1272` | duplicate `runFullValidation` re-call | drop second / extract hook | DUP | MED-LOW | low/med |
| 23 | `app.js:241-245` | `ivaPct` triple-lookup | `|| 21` (sibling style) | VERBOSE | HIGH | none |
| 24 | `storage.js:572-578` | stray 3-line migration comment | delete comment | VERBOSE | HIGH | none |
| 25 | `remediation.js:~1121-1158` | `extractSwitchTokenLocal` fallback | keep only `ctx` path | DUP | MED | low |
| 26 | `imageTextGates.js:509-511` | empty `if` block | `if (vio.violation && !calibrated)` | VERBOSE | HIGH | none |
| 27 | 4 calibration consts | always-true knobs | inline `true` branches | YAGNI | MED | low |
| 28 | `remediationConfig.js:15-26` | 4 non-wired calibration keys | remove 4 keys | YAGNI | MED | none |

## Top 10 apply-first wins

1. `catalogAssignmentGates.js:392-408` dead else.
2. `ncmDatabase.js:82-115` SYNONYMS/`_expand`/`classify`.
3. `imageTextGates.js:309-346` `interiorColorFor`.
4. `importGates.js:26-31` `isGateFlagged`.
5. 5 calibration setter/getters (3 files).
6. `ui/modals.js:318` spread clone.
7. `pdfParserClassifier.guessCategory`.
8. `updater.js` `validateConfig`/`detectPlaceholderSignatures`.
9. `notifications` progress/cancel trio.
10. Unify `esc`.

## Used-but-looks-redundant — leave alone

- AppStore pub/sub (genuinely used by catalogView).
- updateBadges TTL caches + invalidation (point of cache).
- `CatalogValidator.auditCatalog` + `window.*` console shortcuts (wired in index.html).
- QuoteGenerator history (write-only but tiny; future surface).
- Remediation fallback vocabularies (keep until #19 lands).
- `quality/gate.js` + `spreadsheet-harness.js` (test harness, out of scope).
- `ImageQuality.isMarginalCrop` — USED by pdfParser (do not delete).
- Misc used helpers + export methods wired in index.html.
- `remediate-catalog.js`/`quality-pipeline.js` single-responsibility (keep).

## Decisions (user) — agreed application policy
- **Defer all edits until FASE 2 closes** (parallel session owns the working tree; final
  commit is one session's job per AGENTS.md). This file is the living debt ledger.
- **#14 is a BUG**: rewrite the inline `ncmKey` chain in `calculator.js:350-367` to use
  `ncmKeyFor` (line 273-278). It changes door-to-door numbers for direct-matrix categories
  (LAVADORA/HELADERA/TV/AIRE). Treat as a fix: **pin a regression test first** that captures
  before/after per-category D2D numbers, then rewrite.

## Batching plan (apply at FASE 2 close)
Each batch = one Conventional commit, one module, tests + eslint cleanup in the same commit.
1. `refactor(calculator)` — #14 bug-fix (+ regression test), #23 app.js verbosity.
2. `refactor(catalog)` — #17 evaluateItem/violations, #21 GARBAGE_RE, #16 storage evidence fns.
3. `refactor(imports)` — #4, #5(importGates), #12, #18 importFlow isPhotoOnly, #20 deriveReasonCode.
4. `refactor(sku)` — #15 skuAllocator archived Slice 6.
5. `refactor(reliability)` — #10, #11, #22 remediation re-call, #25 extractSwitchTokenLocal, #28 config keys.
6. `refactor(parser-helpers)` — #3 interiorColorFor, #7 guessCategory, #26 imageTextGates.
7. `refactor(ui)` — #6 modals spread, #8 notifications trio, #13 unify esc, #24 storage comment.
8. `refactor(ncm)` — #2 SYNONYMS/classify.
9. `refactor(validators)` — #1 dead else, #19 color vocabulary, #27 calibration knobs.
10. `chore(quality)` — #9 updater validation, plus eslint.config.js readonly-global cleanup.
Each batch: `npm run lint` + `npm run test` green before commit. #14 needs the regression
numbers compared against this baseline; all other batches must not change behavior.

## Pre-apply checks / uncertainty

- Symbols possibly invoked dynamically by the FASE-2 `pdfParser.js` (e.g.
  `interiorColorFor`, `guessCategory`): grep-verify with `PdfParser[fnName]`/dynamic
  patterns before deleting #3/#7.
- `eslint.config.js` lists many symbols as readonly **globals** → deleting them needs
  those entries removed, else lint fails.
- #14 (`ncmKeyFor` reuse) changes D2D numbers for direct-matrix categories — deliberate
  correctness decision, pin a regression test first.
- Deletions with MED risk need test cleanup (tests.js, logic-tests.js).
- **Do not apply while FASE 2 is open** (parallel session owns the working tree); the
  final commit is one session's job when FASE 2 closes (AGENTS.md).