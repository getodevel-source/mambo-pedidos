# Exploration: import-cost-tracking

Date: 2026-08-11. Phase: sdd-explore. Store: hybrid (OpenSpec + Engram).
Scope: (1) full Argentina landed-cost calculator, (2) import-in-progress tracker.

## Exploration: import-cost-tracking

### Current State

The landed-cost engine is **substantially built already** — this change is mostly
gap-filling plus a brand-new tracker, not a green-field calculator.

**Cost engine (exists):**
- `src/js/calculator.js` — `Calculator.calculateOrder`: FOB → freight (% FOB or
  kg×USD/kg) → insurance (% FOB, default 2%) → CIF → DI (`derechos`) + TE (`tasa`
  3%) + percepciones (`perc` 6%) + IVA 21% (shown apart; IVA is recoverable and
  excluded from net cost) + courier per-unit or despachante fixed cost; markup
  (per-category `MARKUP_MATRIX` + overrides); USD→ARS via `tipoCambio`; courier
  regime warnings (USD 3,000 FOB / 50 kg / 3-per-species).
- `Calculator.calculateDoorToDoorExactCost` (calculator.js:282) — exact settlement
  engine used by the wizard and Puerta a Puerta modal: per-item NCM resolution
  (`NCM_MATRIX` + `ncmOverrides`, IT40), courier vs importador regime, tax cascade
  DI/TE/IVA/IVA-adicional 20%/Ganancias 6%/IIBB over (CIF+DI+TE), certifications
  (ENACOM / S-Mark / lithium), fixed destination costs (depósito fiscal,
  despachante, SIM digitalización, flete interno), **caja vs costo neto real**
  with recoverable tax-credit split, ARS conversion.
- Audited 2026 tax matrix (guided-import-wizard proposal, IT19 sources ARCA/AFIP/
  Decreto 333/25): **Impuesto PAIS is ELIMINATED**; IVA 21% + IVA adicional 20%;
  Ganancias 6% inscripto / 11% no inscripto; IIBB 1.5–3.5% per jurisdiction;
  TE 3% CIF; DI per NCM. RG 5807 suspension does NOT apply to peripherals.

**NCM data (exists):**
- `src/js/ncmDatabase.js` + `src/data/ncmDatabase.js` — full ARCA NCM base
  (~15,000 records, 872 KB, lazy-loaded via `ensureNcmDbLib`, cached in
  localStorage `mamboNcmDb`). Record shape: `{ ncm, desc, di }` — **stores the DI
  alicuota only**; IVA/TE/percepciones come from the structural `NCM_MATRIX`, not
  per-record. `byCode`, `search`, `classify` (auto-classification with confidence
  threshold) all exist. The wizard auto-loads authoritative ARCA DI into
  `ncmOverrides` per category.

**Wizard + FX + discount (exists):**
- `src/js/ui/importWizard.js` — 6-step guided wizard (catálogo → pedido →
  flete/seguro → impuestos NCM → gastos destino → resumen), modal
  `importWizardModal` in index.html, state in localStorage
  `mamboImportWizardState`, project in `mamboImportProyecto`, IIBB jurisdiction
  selector, NCM search/override per category.
- Live USD: `fetchLiveDolarRates` (dolarapi.com, 5-min cache, offline fallback
  `mambo_dolar_cache`); chips Mayorista/Oficial/Blue/MEP/Cripto apply to
  `cTasaCambio` via `applyDolarRate` → `recalc()`.
- Negotiated discount: `syncDescuentoNegociado` scales item FOB (`fobOriginal`
  preserved) and shows a savings badge.

**Persistence (exists, pattern to follow):**
- `src/js/storage.js` — `AppStorage` Tauri Store + localStorage fallback.
  `KEYS`: CATALOG `mambo_catalog_v2`, HISTORIAL `mambo_historial_v2`, BRANDS
  `mambo_brands_v1`. Adding a key = entry in `KEYS` + `saveX/loadX` helper pair
  (see `saveHistorial/loadHistorial`).
- Numbering pattern: `QuoteGenerator.nextNumber()` — localStorage counter
  (`mamboQuoteCounter`) + `'NQ-' + padStart(4,'0')`; history capped at 50.

**Tracker (does NOT exist):** no import lifecycle entity anywhere. Views today:
catalogo / pedido / historial (nav-item buttons with `data-view` + `view-{name}`
divs; `switchView` is generic). `src/js/ui/historyView.js` is the closest render
pattern to copy.

### Affected Areas

- `src/js/calculator.js` — add local-price comparison verdict (landed vs local);
  optional Bienes Personales percepción input; PAIS informational line (0%,
  eliminated); insurance preset for the ~1.1% CI formula. Do NOT fork the engine.
- `src/js/ui/importWizard.js` — surface the new inputs (PAIS info row, BP
  percepción, insurance preset) in step 4/3; "save as import" bridge in step 6.
- `src/js/storage.js` — new `KEYS.IMPORTS = 'mambo_imports_v1'` +
  `saveImports/loadImports` helpers.
- `src/js/importsTracker.js` (NEW) — pure logic: record CRUD, status machine
  (ordered → in_transit → in_customs → cleared → delivered, + cancelled),
  IMP-xxxx numbering, per-import profitability + rollups.
- `src/js/ui/importsView.js` (NEW) — dashboard render (status board, dates,
  courier, final cost, ROI vs local price).
- `src/index.html` — 4th nav-item + `view-importaciones` section + `<script>`
  tags for new files (script-integrity gate in run-tests.js requires it).
- `src/js/app.js` — wire view switch/badges; minimal.
- `scripts/quality/logic-tests.js` (or `src/js/tests.js`) — new tests (strict TDD).
- Untouchable: `src/js/pdfParser.js` and table-parser files (other session, FASE 2).

### Approaches

1. **Extend engine + new tracker module (recommended)** — thin verdict layer over
   `calculateDoorToDoorExactCost` (local-price comparison, PAIS info line, BP
   percepción optional, insurance preset) + standalone `importsTracker.js` pure
   module + `importsView.js` UI + `mambo_imports_v1` storage key; wizard step 6
   "Guardar proyecto" creates/updates an import record with a cost snapshot.
   - Pros: reuses the audited IT19 engine and ARCA DI data; pure-logic module is
     fully testable under the Node harness; clean rollback (new key, new files);
     follows every existing convention (KEYS, nextNumber, switchView, historyView).
   - Cons: two features together exceed the 400-line review budget → must be
     delivered as chained slices (auto-chain is the cached strategy).
   - Effort: Medium.

2. **Standalone calculator rewrite inside the tracker** — new module re-implementing
   the tax cascade for imports.
   - Pros: isolated from existing wizard code.
   - Cons: duplicates `calculateDoorToDoorExactCost`; two tax engines will diverge
     when alicuotas change; contradicts the audited-matrix single-source decision.
   - Effort: High. Rejected.

3. **Overload `mambo_historial_v2` with lifecycle fields** — reuse order history
   records for import tracking.
   - Pros: least new code.
   - Cons: mixes quote-history and import-lifecycle lifecycles; endangers existing
   persisted data; rollback-hostile; historial badges/counts would drift.
   - Effort: Low but risky. Rejected.

### Recommendation

Approach 1. Deliver in chained slices under the 400-line budget:
- **Slice A (tracker core)**: `importsTracker.js` + storage key + tests (numbering,
  status transitions, profitability rollup). No UI.
- **Slice B (tracker UI)**: `importsView.js` + index.html nav/view + app.js wiring.
- **Slice C (calculator verdict layer)**: `compareVsLocal` + PAIS info line +
  optional BP percepción + insurance preset + wizard step wiring + tests.
Tests are mandatory in every slice (strict TDD, `npm test`).

### Risks

- **Alicuotas change over time**: the matrix is audited 2026; Impuesto PAIS was
  requested by the user but is eliminated — the UI must show it as an explicit
  informational 0% line (never silently omit) and the matrix needs an expiry notice
  (already pending in guided-import-wizard).
- **Parallel sessions**: other sessions are actively editing `src/js` (observed
  mid-exploration: notifications.js, historyView.js, demoCatalog.js). app.js /
  index.html edits need coordination; pdfParser.js and table-parser files are
  off-limits (FASE 2).
- **Review budget**: both features combined forecast > 400 changed lines — chained
  slices are required, not optional.
- **Test gates**: any new `src/js/**/*.js` file must be loaded in `index.html`
  (script-integrity check) and must not reference `process.` unguarded
  (browser-runtime check), or `npm test` fails.

### Ready for Proposal

Yes. The orchestrator can launch `sdd-propose` for change `import-cost-tracking`
with scope = slices A–C above, non-goals = PDF/CSV export of the tracker and
per-product NCM override (already pending under guided-import-wizard), and the
explicit note that Impuesto PAIS is eliminated (informational line only).
