# Tasks: vision-category-extraction

Strict TDD: fixtures in `src/js/tests.js` FIRST (RED), then implementation (GREEN), then harness validation (REFACTOR). Every vision-driven rule is fail-closed and validated by the existing harness before shipping.

## Slice 1: offline vision-assisted labeling (Phase 1, data-only)

- [x] 1.1 Contact-sheet generator (`scripts/_dbg_contact_sheet.js`, scratch) to label images by SKU at fixed vocabulary. Verify: sheets render with SKU/cat/aspect labels.
- [x] 1.2 `--category-corrections` side channel in `scripts/remediate-catalog.js` + `Remediation.categoryCorrection` (aspect-consistent, fail-closed). Verify: `npm test` (testCategoryCorrectionStrategy), promotion-audit 0 FP.
- [x] 1.3 `--aspect-exempt` side channel + `aspect-calibrated` evidence contract for portrait renders of correct category. Verify: `npm test` (testAspectCalibratedStrategy), 0 FP.
- [x] 1.4 Populate `scripts/quality/category-corrections.json` (114) + `aspect-exempt.json` (10) from vision. Verify: GREEN eligible 90.5%→95.3%, hold-out/anti-overfit/calibration-delta pass.

## Slice 2: image category signal (Phase 2, runtime)

- [ ] 2.1 RED fixture: `_imageCategory` attached when image present, absent when not. Verify: `npm test` fails first.
- [ ] 2.2 GREEN: integrate a lightweight image classifier producing `_imageCategory`+confidence over the fixed vocabulary (on-device head or hosted endpoint behind `vision.enabled`). Verify: `npm test` passes; `npm run lint`.
- [ ] 2.3 RED fixture: fusion agreement raises confidence; strong disagreement sets `_categoryUncertain`. Verify: fails first.
- [ ] 2.4 GREEN: implement fail-closed fusion in extraction; uncertain items routed to human-review report. Verify: `npm test`; hold-out 0 new FPs.

## Slice 3: color reconciliation

- [ ] 3.1 RED fixture: high-confidence interior overrides placeholder declared color with `colorEvidence`. Verify: fails first.
- [ ] 3.2 GREEN: implement color reconciliation; contradictory declared-vs-interior flags review, never silent override. Verify: `npm test`; calibration-delta FP↓/FN↮↑.

## Slice 4: validation & rollback

- [ ] 4.1 Wire vision rules into `hold-out-catalog.js`, `promotion-audit.js`, `calibration-delta.js`, `anti-overfit-audit.js`; any FP rejects the rule. Verify: all exit 0 on the labeled set.
- [ ] 4.2 Config-gate `vision.enabled:false` restores text-only behavior; no storage/migration delta. Verify: measure-only output matches pre-vision baseline.
- [ ] 4.3 FASE 2 no-regression: `measure-model-quality.js` recall ≥85%/FP ≤8%, `measure-extraction.js` baseline holds. Verify: exit 0.

## Acceptance

- [ ] A.1 Category mis-assignment (mouse↔teclado) no longer produces YELLOW/FP on held-out catalogs.
- [ ] A.2 GREEN eligible rises with 0 false positives (promotion-audit).
- [ ] A.3 Uncertain items appear in the human-review report with class + reason.
