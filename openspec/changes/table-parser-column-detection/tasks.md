# Tasks: table-parser column detection

Each slice is strict-TDD and gated by the ground-truth harness. A slice is done
only when its acceptance criteria pass AND the no-regression check passes
(re-run `scripts/ground-truth.js`, diff vs `ground-truth/verdicts.json`, and
`scripts/measure-model-quality.js` clean-FP rate does not rise).

## Slice 1 — Header-driven column mapping
- [ ] Detect table header row (model/color/switch/price tokens) → `columnMap`.
- [ ] Role-aware row parsing using `columnMap`; switch column excluded from model.
- [ ] Confidence gate: header-less tables fall back to current positional path.
- [ ] Unit tests with RK/Ajazz header rows as fixtures.
- [ ] **Acceptance:** #56 #57 #59 #60 (and #7 #11 where a header exists) move
      CAMPO → OK/MENOR. No-regression: Logitech/Razer/8BitDo per-file GREEN count
      does not drop; no OK/MENOR → CRITICO.

## Slice 2 — Column-scoped merged-cell inheritance
- [ ] Per-column-band `lastModel` (replace page-global `lastInheritedModel`).
- [ ] Inherit when row model band empty OR row model text is code-less +
      switch/color-like (guarded by `assessModelQuality` + code-presence).
- [ ] Guards: same band (|Δx| < width), same brand, not equal to inherited.
- [ ] Unit tests incl. anti-regression: `Cobra`/`Polar`/`Anya` must NOT inherit.
- [ ] **Acceptance:** #62 #64 #65 move CRITICO → OK/MENOR. No-regression: Razer
      #51/#52 and any code-less valid name stay correct.

## Slice 3 — Price-matrix layout (KZ / Haimu)
- [ ] Detect RMB/USD × model-column grid + `Without mic`/`With mic` row labels.
- [ ] Emit one product per (model-column × price-row); header = model.
- [ ] Brand-prior opt-in (KZ/Haimu) to bound blast radius; measure first.
- [ ] **Acceptance:** #31 #33 (KZ) and #36 #37 #38 #39 #40 (Haimu) move
      CRITICO → OK/MENOR with the real switch/model name. No-regression elsewhere.

## Slice 4 — Anchor↔model alignment for fused cells
- [ ] When a model cell vertically spans multiple price rows, bind each price
      anchor to the correct model by Y-overlap, not nearest-text.
- [ ] **Acceptance:** #43 #44 (Logitech price/model misalignment) resolved.
      No-regression: grounded-price rate does not drop.

## Final gate
- [ ] Re-run ground-truth on an **expanded** sample (≥ 120, same seed strategy)
      and confirm clean-model rate rises from ~38% toward target with measured
      no-regression; update `ground-truth/verdicts.json`.
- [ ] Rebuild release binary and run one real-app E2E import (computer-use) to
      confirm the preview RED/YELLOW/GREEN distribution matches the harness.
