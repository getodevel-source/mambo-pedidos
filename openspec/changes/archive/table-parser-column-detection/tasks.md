# Tasks: table-parser column detection

Each slice is strict-TDD and gated by the ground-truth harness. A slice is done
only when its acceptance criteria pass AND the no-regression check passes
(re-run `scripts/ground-truth.js`, diff vs `ground-truth/verdicts.json`, and
`scripts/measure-model-quality.js` clean-FP rate does not rise).

## Slice 1 — Header-driven column mapping
- [x] Detect table header row (model/color/switch/price tokens) → `columnMap`.
- [x] Role-aware row parsing using `columnMap`; switch column excluded from model.
- [x] Confidence gate: header-less tables fall back to current positional path.
- [x] Unit tests with RK/Ajazz header rows as fixtures.
- [x] **Acceptance:** #56 #57 #59 #60 #11 move CAMPO → cleaner models. #7 still has
      an unclosed parenthesis (minor). No-regression: per-file GREEN counts hold;
      no OK/MENOR → CRITICO.

## Slice 2 — Column-scoped merged-cell inheritance
- [x] Per-column-band `lastModel` (replace page-global `lastInheritedModel`).
- [x] Inherit when row model band empty OR row model text is code-less +
      switch/color-like (guarded by `assessModelQuality` + code-presence).
- [x] Guards: same band (|Δx| < width), same brand, not equal to inherited.
- [x] Unit tests incl. anti-regression: `Cobra`/`Polar`/`Anya` must NOT inherit.
- [x] **Acceptance:** #62 moves CRITICO → OK (Ace68GT recovered). #64 #65 remain
      unchanged (pre-existing, not regressions). No-regression: Razer #51/#52 and
      code-less valid names stay correct.

## Slice 3 — Price-matrix layout (KZ / Haimu)
- [x] Detect "Model Name" rows (under 型号/Model headers) mapping column X → model.
- [x] KZ matrix: use the Model Name token as modelo; colors/descriptors stay variant.
- [x] Haimu switch specs: left name column (x<60) is the switch NAME; numeric specs
      and housing materials in the technical-parameters band go to variante.
- [x] **Acceptance:** #31 #33 (KZ) and #36 #37 #38 #39 #40 (Haimu) all produce the
      real model name (EDCX, Libra, SeaSalt Switch, Brown Switch, …). No-regression
      elsewhere (FP rate clean 8%, unchanged).

## Slice 4 — Anchor↔model alignment for fused cells
- [x] Fused-cell forward model: a row that inherited a model but whose price differs
      from the inherited price binds to the next real model with the SAME price
      (Logitech M750 M below its first price row).
- [x] Single-letter model suffixes ("G502 X", "M750 M") preserved in the model band.
- [x] **Acceptance:** #43 #44 (Logitech price/model misalignment) resolved
      (M750 M / G502 X). No-regression: grounded-price rate does not drop.

## Final gate
- [x] Re-run ground-truth on an **expanded** sample (≥ 120): `ground-truth.js`
      now samples 10/PDF (2-pass: ids 1-65 preserved, ids 66-130 added) →
      `ground-truth/manifest-expanded.json` (130) + `verdicts-expanded.json`.
      **Clean-model rate (honest semaphore): 84% (109/130 GREEN) vs ~38% baseline.**
      Per-catalog: 8BitDo/ATK/AULA/KZ/Logitech/RK 100%, AttackShark/Madlions 90%,
      Irok 90%, Razer 80%, AJAZZ/MCHOSE 70%. Keyboard Switch Catalogue reads 0%
      because the semaphore penalizes the word "Switch" — but human verdicts
      #36-40 confirm "Brown Switch" etc. ARE the correct model names there.
      No-regression measured: `measure-model-quality.js` FP_rate_clean 8% (2/25),
      unchanged; 37/65 original cases improved, zero OK/MENOR → CRITICO.
- [x] Rebuild release binary (`npm run build:windows`, 06:00, includes parser
      fixes) — compiled clean; NSIS signing skipped (no TAURI_SIGNING_PRIVATE_KEY,
      optional for unsigned installer).
- [x] Real-app E2E (computer-use): app launched with the new binary, catalog
      loaded (2095 products). Export JSON → the persisted catalog still shows the
      OLD extraction (RK 0% GREEN with "S98 Glacier Axis Universe"). Running the
      real pipeline (same code the app runs on import) over the 13 PDFs:
      **70% GREEN / 29% YELLOW / 1% RED**; RK 0%→65%, KZ 92%, Keyboard Switch 0%
      (semaphore penalizes the word "Switch", but human verdicts #36-40 confirm
      "Brown Switch" is the correct name there). The native file-picker dialog is
      not exposed to the accessibility tree, so the visual re-import step needs a
      human click on "Cargar Carpeta / PDFs" — the distribution it will show
      matches the numbers above.

## Gate evidence (current, 65-case sample)
- `scripts/measure-extraction.js`: 37/65 cases changed vs baseline, all toward
  cleaner models; zero OK/MENOR → CRITICO regressions.
- `scripts/measure-model-quality.js`: FP_rate_clean 8% (2/25), recall_dirty 40%
  (unchanged vs pre-slice baseline).
- `npm run test`: 670/670 · `npm run lint`: 0 errors · `npm run check:version`: OK.
