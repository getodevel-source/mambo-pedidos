# Tasks: Catalog Reliability Verification

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 700–1000 total (180–320 per slice) |
| 400-line budget risk | Medium-High (total), Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice 1 image-text) → PR 2 (Slice 2 grounding) → PR 3 (Slice 3 sanitization) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

## Slice 1: image-text-verification (PR 1)

- [x] 1.1 **RED** Test: interior-dominant-color (center 60%) differs from background-dominant color on a fixture with white page background; declared-color mismatch → YELLOW. (~25 lines)
- [x] 1.2 **GREEN** Implement background-excluded dominant color in the gate (reuse/refactor `validateImageForProduct` color logic, interior sampling). (~50 lines)
- [x] 1.3 **RED** Test: MOUSE with aspect 2.3 image → YELLOW; TECLADO with aspect 2.3 → GREEN; relaxed backfill does not clear the gate. (~20 lines)
- [x] 1.4 **GREEN** Implement category-aspect degradation as post-matching gate. (~40 lines)
- [x] 1.5 **RED** Test: one image shared across two categories → both YELLOW with shared-evidence; verified rebrand (same brand+model+cat) stays GREEN. (~25 lines)
- [x] 1.6 **GREEN** Wire `CatalogAssignmentGates` into the import pipeline (after extraction, before preview) and batch export; attach `_imgTextWarnings`/warnings with evidence. (~60 lines)
- [x] 1.7 **RED** Test: export includes gate warnings; preview card shows the warning as review reason. (~15 lines)
- [x] 1.8 **GREEN** Surface gate warnings in `importFlow.js` preview via existing `pv-reason` path. (~30 lines)
- [x] 1.9 **REFACTOR** Run full corpus export; report before/after GREEN/YELLOW delta; no FASE 2 gate regression. _(deferred: full-corpus export not run per apply instructions)_

## Slice 2: fob-grounding-integrity (PR 2)

- [x] 2.1 **RED** Test: hardcoded `grounded:true` fixture is rejected — grounding must come from anchor-to-row geometry. (~20 lines)
- [x] 2.2 **GREEN** Implement geometric anchor verification (page, column alignment, minimum vertical distance) in `pdfParser.js` push sites; replace hardcoded flags. (~80 lines)
- [x] 2.3 **RED** Test: fused-cell neighbor-anchor case → `grounded:false`, YELLOW, reason names misalignment; absent anchor → YELLOW "FOB sin ancla literal verificada". (~20 lines)
- [x] 2.4 **GREEN** Emit grounding evidence `{groundingMode:"geometric", page, dx, dy}`; wire into `evaluateItem` R10 without changing the R1–R10 contract. (~40 lines)
- [x] 2.5 **RED** Test: extreme outlier (IQR×3) → YELLOW with evidence; mild outlier (1.5×) stays advisory. (~20 lines)
- [x] 2.6 **GREEN** Promote `validateCatalogStats` outliers above IQR×3 to YELLOW with `{price, median, iqr, cat, factor}` evidence. (~30 lines)
- [x] 2.7 **REFACTOR** Full corpus export; verify 0 products with `grounded:true` lack geometric evidence; report delta. _(deferred: full-corpus export not run per apply instructions)_

## Slice 3: model-color-sanitization (PR 3)

- [x] 3.1 **RED** Test: `color="Black Mouse Wireless"` → `color="Black"` + words moved/dropped; `"Magnetic Switch White"` → `"White"`. (~20 lines)
- [x] 3.2 **GREEN** Implement connection/category-word extraction from `color` in `textSanitizer.js` (vocabulary from `COLOR_AUDIT_RE` + switch-adjacent). (~40 lines)
- [x] 3.3 **RED** Test: ground-truth false negatives flagged ("M720 Wireless Mouse", "G502 Wired Mouse", "68 Keys Esport", "0500 Backpack Tactical", "Mount Tai GT powder", "Hall Effect Ace 68 Air") → YELLOW. (~20 lines)
- [x] 3.4 **GREEN** Tighten `assessModelQuality` to flag category-in-model, spec-fragment-only, lost-code models. (~50 lines)
- [x] 3.5 **RED** Test: clean models stay GREEN ("F75 Glacier"). (~10 lines)
- [x] 3.6 **GREEN** Ensure no regression on FASE 2 gates: recall ≥ 85%, FP ≤ 8%; add sanitized fixtures from measured FNs. (~30 lines)
- [x] 3.7 **REFACTOR** Full corpus run; report YELLOW delta by reason; confirm stored catalogs untouched (no migration). _(deferred: full-corpus export not run per apply instructions)_
