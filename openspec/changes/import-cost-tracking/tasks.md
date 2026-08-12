# Tasks: Full Argentina Landed-Cost Verdict Layer + Personal Import Tracker

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice A) → PR 2 (Slice B) → PR 3 (Slice C) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Tracker core (pure logic + storage) | PR 1 | `npm test` (logic-tests: tracker + storage) | N/A — pure Node module, no UI/runtime dependency | Delete `src/js/importsTracker.js`; revert `storage.js`, `scripts/run-tests.js`, `scripts/quality/logic-tests.js` |
| 2 | Tracker UI dashboard | PR 2 | `npm test` (script-integrity + ui-smoke) | Open app → nav "Importaciones" → dashboard renders with seeded records | Delete `src/js/ui/importsView.js`; revert `index.html`, `app.js` |
| 3 | Verdict layer + wizard bridge | PR 3 | `npm test` (verdict + BP regression + bridge) | Open wizard → step 3/4 inputs → step 6 verdict + save-as-import | Revert `calculator.js`, `importWizard.js`; drop `compareVsLocal`/`getPaisLine`/`suggestInsuranceUsd` |

## Phase 1: Foundation (Slice A — storage + skeleton)

- [x] 1.1 RED: add storage round-trip tests for `KEYS.IMPORTS` in `scripts/quality/logic-tests.js` (save/loadImports, empty state, reload survival).
- [x] 1.2 GREEN: add `KEYS.IMPORTS = 'mambo_imports_v1'`, `saveImports`, `loadImports` to `src/js/storage.js` (saveHistorial pattern, Tauri + localStorage fallback).
- [x] 1.3 Register `global.ImportsTracker` require in `scripts/run-tests.js`.

## Phase 2: Tracker Core Logic (Slice A)

- [x] 2.1 RED: tests for IMP-xxxx numbering (no reuse after deletion), record creation defaults, status machine (valid/invalid/terminal — cancelled and delivered terminal), profitability (per-record + rollups + missing local → `{available:false}` never zero).
- [x] 2.2 GREEN: create `src/js/importsTracker.js` — pure object literal: `createRecord`, `advanceStatus`, `computeProfitability`, `computeRollups`; counter inside `{records, counter}` payload; invalid transitions rejected without mutation.
- [x] 2.3 Verify: `npm test` green for all tracker + storage tests.

## Phase 3: Tracker UI (Slice B)

- [x] 3.1 Add 4th nav-item `importaciones` + badge, `view-importaciones` container, two script tags in `src/index.html` (script-integrity gate).
- [x] 3.2 Create `src/js/ui/importsView.js` — dashboard grouped by status: dates, courier, final cost, ROI, empty state (follow `historyView.js` render pattern).
- [x] 3.3 Wire `switchView` render hook + `navBadgeImp` in `updateBadges` + keyboard '4' in `src/js/app.js`.
- [x] 3.4 Verify: `npm test` script-integrity + ui-smoke pass; manual open → dashboard renders.

## Phase 4: Verdict Layer (Slice C)

- [x] 4.1 RED: tests for `compareVsLocal` (3 verdicts + missing → `{available:false}`), float tolerance for break-even (epsilon 1e-6), `getPaisLine` (0% eliminated), `suggestInsuranceUsd` (~1.1% of FOB+freight), BP `bpPct=0` byte-identical totals regression, BP non-zero raises total.
- [x] 4.2 GREEN: add `compareVsLocal`, `getPaisLine`, `suggestInsuranceUsd`, additive `bpPct` param (default 0) to `src/js/calculator.js`; `NCM_MATRIX` untouched.
- [x] 4.3 Add wizard step 3 (insurance preset + local price), step 4 (BP input), step 6 (PAIS line, verdict panel, save-as-import bridge) to `src/js/ui/importWizard.js`; bridge snapshot `finalLandedCostUsd = summary.totalPuertaConIvaUsd`; declined → no behavior change.
- [x] 4.4 Verify: `npm test` full suite green; wizard flow intact; bridge declined leaves flow unchanged.

## Phase 5: Verification

- [ ] 5.1 Run `npm test && npm run check:version` — all gates green.
- [ ] 5.2 Confirm `mambo_historial_v2` untouched, `pdfParser.js`/table-parser files untouched (FASE 2 boundary).
