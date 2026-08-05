# Proposal: Catalog Assignment Quality Gates

## Intent

The real-pipeline export of 2,154 products across 13 vendor catalogs proves that assignment quality is not an auditable contract: 481 products (22%) carry the `"-"` image placeholder yet validate as GREEN with score 100 (`hasImage: False` does not penalize), 22 images are shared across distinct categories (e.g. Razer "Charging Puck" = "Dock Pro" = "Hand Rest Ergonomic"), 7 images are shared across distinct brands (e.g. Atk "Babypink" keyboard = Vgn "Dragonfly VXE Dongle" mouse), 43 models are generic color/header/template text (e.g. "Purple", "released", "Product Picture Model No.#") that still land GREEN, and 29 models are truncated with unbalanced parentheses. Establish mechanical assignment gates with machine-verifiable evidence — without rewriting extraction or runtime boundaries.

## Desired Outcomes

- Zero images shared across distinct categories after matching.
- Images shared across brands only when the full brand + model + category identity matches exactly (verified rebrand, e.g. Irok/Mars same model).
- A product with no real image is never GREEN: `"-"` placeholder must degrade to YELLOW (importable) with a "Sin imagen" warning.
- Generic/color/header models are not importable as GREEN products.
- Truncated models are repaired when the evidence supports it, otherwise YELLOW with a warning.
- Real duplicates (same brand + model + normalized price) are detected and flagged in the audit.
- A post-import assignment audit report exposes metrics and concrete cases for human review.

## Scope

### In Scope

Three independently reviewable slices with shared fixtures, gates, tests, and an audit report:

1. **`image-assignment-integrity`** — post-matching coherence gates: cross-category sharing is a hard failure, cross-brand sharing is allowed only for identical brand+model+category (rebrand allowlist by evidence, not by hardcoded pair list), placeholder `"-"` degrades status, and coverage metrics (unique-image rate, placeholder rate) are emitted.
2. **`model-name-quality`** — generic/color/header/template model detection (moves to variant or fails import), unbalanced-parenthesis repair, and real-duplicate detection (brand + model + normalized FOB).
3. **`assignment-audit-report`** — post-import report with baseline deltas and concrete cases (cross-category, cross-brand, placeholder, generic models, duplicates) derived from the export shape.

### Out of Scope

OCR; new LLM/provider or parser rewrite; cloud image sync; pricing/IVA/logistics redesign; manual vendor correction; signature bypass or release-pipeline changes; persistence/migration changes.

## Capabilities

### New Capabilities

- `catalog-assignment-integrity`: cross-category/cross-brand image gates, placeholder status policy, coverage metrics.
- `catalog-model-name-quality`: generic/truncated/duplicate model gates.
- `catalog-assignment-audit`: post-import audit report.

### Modified Capabilities

None. Consumes the existing `catalog-quality-contract` codes and evidence shape where available.

## Approach

Freeze measurable baselines from the real export first (2,154 items: 481 placeholders, 22 cross-category images, 7 cross-brand images, 43 generic models, 29 truncated, 3 RED). Then run slices in order `1 → 2 → 3`, each with TDD fixtures derived from the export, keeping tests with their implementation. Gates are post-process and additive — no data migration.

### Product Decisions for Downstream Specs

- Product without a real image: YELLOW + importable + "Sin imagen" warning (never GREEN). Confirmed by owner.
- Cross-brand image sharing: allowed only when brand + model + category match exactly (verified rebrand, e.g. Irok/Mars "Mer68 Max"). Any other cross-brand share is an assignment error. Confirmed by owner.
- Generic/color/header model: not importable as GREEN; move to variant when product evidence exists, otherwise RED non-importable.
- Scope: images + models + audit in one change, three slices. Confirmed by owner.

### Evidence and Rollback Gates

- Fixtures derived from the real export as a deterministic baseline; gates assert the baseline deltas (0 cross-category, cross-brand only on exact identity, placeholder < 5% and never GREEN).
- Gates are post-process, additive, and revertible per slice by reverting the slice commit; no storage or migration rollback required.

### Review-Budget Strategy

Forecast 120–220 authored changed lines per slice within the 400-line budget; chain slices as separate review units; never combine image and model slices in one unit.

## Affected Areas

`src/js/{pdfParser,catalogValidator,aiCatalogEngine,fileImporter,app}.js`, `src/js/tests.js`, `scripts/` (audit tooling), and fixture files derived from the export.

## Risks

- False positives on legitimate rebrands (blocking Irok/Mars same-model shares) — mitigate with exact-identity matching, not a hardcoded pair list.
- Placeholder `"-"` may be honest when the source PDF has no photo for a row — the YELLOW policy keeps the product importable while making the gap visible.
- Some color words are real product lines (e.g. "Star", "Lake", "Pearl") — generic-model detection needs brand+category context and conservative thresholds, with every hit surfaced in the audit for human review.
- Fixture noise from the real export — baselines are assertions with bounded deltas, not exact-match snapshots.

## Rollback Plan

Revert each slice independently; gates are post-process and additive, so rollback is a commit revert with no data backfill. The audit report is additive output.

## Dependencies

Confirmed product decisions above; fixtures derived from the real export; existing `catalog-quality-contract` evidence codes; existing npm test and `check:version` gates.

## Success Criteria

- [ ] Zero images shared across distinct categories on the export-derived fixture.
- [ ] Cross-brand image sharing only when brand + model + category are identical; all other cases flagged as assignment errors.
- [ ] Placeholder `"-"` rate below 5% on re-import of the same catalogs, and never GREEN (minimum YELLOW with "Sin imagen").
- [ ] Zero generic/header models importable as GREEN.
- [ ] Truncated models repaired where evidence supports it, otherwise YELLOW with a warning.
- [ ] Duplicates (brand + model + normalized FOB) reported in the audit with counts and concrete SKUs.
- [ ] Audit report reproduces baselines and deltas mechanically from a fixture.
