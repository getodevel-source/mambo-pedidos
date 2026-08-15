# Design: vision-category-extraction

## Technical Approach

Two-phase, honest by construction:

**Phase 1 — Offline vision-assisted labeling (no runtime change).**
A vision step (human-in-the-loop via contact sheets, or an external multimodal model) labels each product image with a category + color over the fixed vocabulary. Output is a **data** artifact (`category-corrections.json`, `aspect-exempt.json`), consumed by the existing fail-closed side channels (`--category-corrections`, `--aspect-exempt`). This is exactly the mechanism proven this session (90.5%→95.3%, 0 FP). It improves the current corpus without touching runtime semantics.

**Phase 2 — On-device image classifier (generalizes to future catalogs).**
A lightweight image classifier (e.g. a small CNN / MobileNet head, or a hosted multimodal endpoint called at import) produces `_imageCategory` + confidence. Fusion with the text classifier (`pdfParserClassifier.detectCategoryWithEvidence`) is fail-closed: agreement raises confidence; strong disagreement sets `_categoryUncertain` and routes to the human-review report instead of hard-assigning.

## Why not a runtime heuristic

Tested and rejected this session: image **edge/key density** does NOT separate portrait keyboards from mice (perforated mice ≈ keyboards, 0.237). Aspect-only rules misclassify portrait renders (MCH-TEC). Brand/SKU rules overfit (anti-overfit audit rejects). Therefore category-from-content requires a learned vision model, not a hand rule.

## Fusion rule (fail-closed)

```
if |textConf - imgConf| small and same cat        -> accept cat, conf = max+boost
elif imgConf >= T_HIGH and textConf <= T_LOW      -> accept img cat (evidence logged)
elif textConf >= T_HIGH and imgConf <= T_LOW      -> accept text cat (evidence logged)
else                                              -> _categoryUncertain, review
```

Thresholds tuned on the labeled set; any FP on hold-out rejects the threshold set.

## Color reconciliation

Interior color (existing `extractInteriorColor`) is the image signal. High-confidence interior overrides placeholder/empty declared color with `colorEvidence`; a high-confidence contradiction (declared vs interior) flags review rather than silently overriding.

## Guards (reuse existing harness)

- `hold-out-catalog.js` (leave-one-catalog-out, 0 new FPs)
- `promotion-audit.js` (0 FP on promoted)
- `calibration-delta.js` (FP↓ without FN↑)
- `anti-overfit-audit.js` (no brand/SKU strings)
- FASE 2: `measure-model-quality.js` (recall ≥85% / FP ≤8%), `measure-extraction.js`

## Rollback

Phase 1: delete the data files / drop the CLI flags (off by default). Phase 2: config-gate the classifier (`vision.enabled:false`) restores text-only behavior; no storage/migration delta.

## Non-goals

- No loosening of existing gates.
- No brand/SKU hardcoding.
- No claim of 100% without the model; uncertain items go to human review.
