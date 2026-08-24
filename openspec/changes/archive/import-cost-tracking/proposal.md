# Proposal: Full Argentina Landed-Cost Verdict Layer + Personal Import Tracker

## Intent

Landed-cost engine exists (audited 2026 matrix, `calculateDoorToDoorExactCost`, 6-step wizard). Two gaps: nothing answers "is importing cheaper than buying locally?" — eliminated Impuesto PAIS is invisible instead of an explicit 0% line — and nothing tracks an import's lifecycle or profitability.

## Scope

### In Scope
- **Slice A — tracker core (no UI)**: new pure `src/js/importsTracker.js` — CRUD, status machine (ordered→in_transit→in_customs→cleared→delivered, +cancelled), IMP-xxxx numbering (nextNumber pattern), profitability rollups; `KEYS.IMPORTS='mambo_imports_v1'` + save/loadImports in `src/js/storage.js`.
- **Slice B — tracker UI**: new `src/js/ui/importsView.js` dashboard (status board, dates, courier, final cost, ROI vs local); 4th nav-item + `view-importaciones` + script tag in `src/index.html`; minimal `src/js/app.js` wiring; `historyView.js` pattern.
- **Slice C — verdict layer**: `compareVsLocal` on `src/js/calculator.js`; explicit Impuesto PAIS 0% informational line (eliminated — never omit silently); optional Bienes Personales percepción input; ~1.1% CI insurance preset; wizard step 3/4 surfaces + step 6 "save as import" bridge.
- Strict TDD (`npm test`), every slice.

### Out of Scope
- Tracker PDF/CSV export (deferred).
- Per-product NCM override, matrix expiry notice (pending under `guided-import-wizard`).
- `pdfParser.js` / table-parser (FASE 2, other session).
- Forking tax engine; overloading `mambo_historial_v2`.

## Capabilities

### New Capabilities
- `import-tracker`: CRUD, numbering, status machine, persistence, profitability, dashboard, step 6 bridge.
- `landed-cost-verdict`: `compareVsLocal`, PAIS 0% line, BP percepción input, insurance preset, wizard surfaces.

### Modified Capabilities
None — `openspec/specs/` empty.

## Approach

Extend, don't fork: thin verdict layer over the audited engine (IT19/IT40); tracker as pure Node-testable module following conventions (KEYS/saveX-loadX, nextNumber, switchView). Three chained slices under the 400-line budget (auto-chain).

## Affected Areas

- `src/js/importsTracker.js` (New): pure tracker logic
- `src/js/ui/importsView.js` (New): dashboard render
- `src/js/storage.js` (Modified): KEYS.IMPORTS + helpers
- `src/js/calculator.js` (Modified): verdict layer
- `src/js/ui/importWizard.js` (Modified): steps 3/4 + step 6 bridge
- `src/index.html` (Modified): nav-item, view, scripts
- `src/js/app.js` (Modified): view switch/badges

## Risks

- Wizard touchpoints regress flow (Med): isolate slice C; test steps 3/4/6
- Parallel sessions on `app.js`/`index.html` (Med): minimal diffs; AGENTS.md coordination
- Script-integrity gate failure (Low): register scripts; no unguarded `process.`
- Size > 400 lines (High): chained slices A/B/C

## Rollback Plan

Additive: delete new files, revert touched files (`storage.js`, `calculator.js`, `importWizard.js`, `index.html`, `app.js`), drop `mambo_imports_v1`. No migration; existing data untouched. Slice C reverts independently.

## Success Criteria

- `npm test` green: numbering, status, profitability, `compareVsLocal`
- Records persist across reloads (`mambo_imports_v1`)
- Dashboard shows status board + ROI vs local
- PAIS renders as explicit 0% line
- Step 6 saves import record with cost snapshot
- `mambo_historial_v2` unchanged
