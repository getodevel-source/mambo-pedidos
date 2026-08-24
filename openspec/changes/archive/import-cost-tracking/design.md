# Design: import-cost-tracking

## Technical Approach

Extend, don't fork (proposal). Slice A: pure `importsTracker.js` + `KEYS.IMPORTS` storage helpers. Slice B: `importsView.js` dashboard wired via `switchView`. Slice C: thin verdict layer (`compareVsLocal`, PAIS 0% line, BP percepción, insurance preset) over the audited `calculateDoorToDoorExactCost`, surfaced in wizard steps 3/4/6. All modules follow the browser-global + CommonJS dual-export convention. Specs: `openspec/specs/import-tracker/spec.md`, `openspec/specs/landed-cost-verdict/spec.md`.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Choice |
|---|----------|---------|----------|--------|
| 1 | Tracker store | Reuse `mambo_historial_v2` vs new key | Reuse violates spec storage isolation | New `KEYS.IMPORTS = 'mambo_imports_v1'` |
| 2 | IMP counter | Separate key (quoteGenerator `nextNumber` style) vs inside IMPORTS payload | Separate key = two round-trips, drift risk | Counter inside payload `{records, counter}` — atomic, no reuse after deletion |
| 3 | BP percepción | Fork tax lines vs additive input | Forking duplicates the audited matrix | Additive `doorConfig.bpPct` (default 0) on `baseImp`, importador branch only; `NCM_MATRIX` untouched; 0 ⇒ byte-identical legacy output |
| 4 | Insurance preset | New engine `seguroUsd` param vs wizard-side helper | Engine change risks audited outputs | `Calculator.suggestInsuranceUsd(fob, freight)` = 1.1%; wizard converts amount → equivalent `seguroPct` (exact: `amount/fobTotal`); explicit amount overrides |
| 5 | Verdict home | New module vs `calculator.js` | Verdict needs engine fluency (summary, TC) | `Calculator.compareVsLocal()` consuming engine summary |
| 6 | Tracker shape | Classes vs object literal of pure functions | Project convention is object literals (Calculator, HistoryView) | Pure literal; storage done by callers → Node-testable |
| 7 | PAIS line | Render ad hoc vs single source | Ad hoc risks silent omission | `Calculator.getPaisLine()` single source, rendered in wizard breakdown; reusable by other breakdowns later |

## Data Flow

```
Wizard steps 3/4 (insurance preset, local price, BP)
      │
      ▼
Calculator.calculateDoorToDoorExactCost(items, doorConfig + bpPct)  [audited engine]
      │ summary
      ▼
Calculator.compareVsLocal(summary, precioLocalUsd) ──→ verdict (step 6)
      │ confirm "save as import"
      ▼
ImportsTracker.createRecord(snapshot) → AppStorage.saveImports → KEYS.IMPORTS
      │                                                          (Tauri store / localStorage fallback)
      ▼
ImportsView.render() ◄── AppStorage.loadImports ◄─────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/js/importsTracker.js` | Create | Pure logic: record factory, IMP numbering, status machine, profitability, rollups |
| `src/js/ui/importsView.js` | Create | Dashboard grouped by status: dates, courier, final cost, ROI, empty state (historyView.js pattern) |
| `src/js/storage.js` | Modify | `KEYS.IMPORTS` + `saveImports`/`loadImports` (saveHistorial pattern) |
| `src/js/calculator.js` | Modify | `compareVsLocal`, `suggestInsuranceUsd`, `getPaisLine`, additive `bpPct` in door-to-door |
| `src/js/ui/importWizard.js` | Modify | Step 3: insurance preset + local price; step 4: BP input; step 6: PAIS line, verdict panel, save-as-import bridge; new state fields persist via existing `mamboImportWizardState` |
| `src/index.html` | Modify | 4th nav-item `importaciones` + badge, `view-importaciones` container, 2 script tags (script-integrity gate) |
| `src/js/app.js` | Modify | `switchView` render hook, `navBadgeImp` in `updateBadges`, keyboard '4' |
| `scripts/run-tests.js` | Modify | `global.ImportsTracker` require |
| `scripts/quality/logic-tests.js` | Modify | RED tests: all pure logic + storage round-trip |

## Interfaces / Contracts

```js
// Storage payload under KEYS.IMPORTS = 'mambo_imports_v1'
{ records: ImportRecord[], counter: number }

// ImportRecord
{ id, number: 'IMP-0001', supplier, description, fobTotalUsd, freightUsd, insuranceUsd,
  courier, status: 'ordered',
  dates: { ordered, in_transit, in_customs, cleared, delivered },
  finalLandedCostUsd, localPriceUsd /* null allowed */, tipoCambio, notes }

// Status machine — terminal: delivered, cancelled; invalid ⇒ {ok:false}, no mutation
{ ordered: ['in_transit','cancelled'], in_transit: ['in_customs','cancelled'],
  in_customs: ['cleared','cancelled'], cleared: ['delivered','cancelled'],
  delivered: [], cancelled: [] }

// Verdict
compareVsLocal(landedUsd, localPriceUsd, tipoCambio) →
  { available: true, verdict: 'cheaper'|'more_expensive'|'break_even',
    diffUsd, diffPct /* vs local price */, diffArs, landedUsd, localPriceUsd, tipoCambio }
  | { available: false }   // missing local price — never zero, never throws

getPaisLine() → { label: 'Impuesto PAIS', ratePct: 0, amountUsd: 0, status: 'eliminated' }
```

BP: per-item `bpUsd = baseImp * bpPct`, added to `totalTributosItemUsd`, `summary.bpUsd`, and totals. Profitability: `profit = localPrice − finalLandedCost`, `roi = profit/finalLandedCost`; missing local price ⇒ `{available:false}`. Rollups: total invested, total profit (records with local price only), active count (non-terminal), by-status counts.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Numbering (no reuse after deletion); status machine (valid/invalid/terminal); profitability + rollups (missing ⇒ unavailable); `compareVsLocal` (3 verdicts + missing); insurance preset; PAIS line; BP 0 = identical totals / non-zero raises total | RED tests in `scripts/quality/logic-tests.js` via `npm test` |
| Integration | `saveImports`/`loadImports` round-trip, reload survival, empty state | Same suite; AppStorage falls back to localStorage stub in Node |
| UI smoke | Nav item + `view-importaciones` registered, wizard `_render_*` intact | Existing gates in `scripts/run-tests.js` (script integrity, dynamic render, ui-smoke) |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Additive key; `mambo_historial_v2` untouched. Slices A→B→C chain independently (auto-chain, 400-line budget). Rollback: delete the 2 new files, revert touched files, drop `mambo_imports_v1`.

## Open Questions

- None blocking. Notes for tasks: (a) bridge snapshots `finalLandedCostUsd = summary.totalPuertaConIvaUsd` (caja) and takes supplier as user input at save time (wizard has no supplier field); (b) PAIS line renders in the wizard breakdown per proposal scope — `getPaisLine()` is the single source if `modals.js` breakdowns need it later.
