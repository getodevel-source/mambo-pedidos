# Proposal: Catalog Reliability Verification

## Intent

The exported catalog (2,167 products from the 13 default PDFs, `mambo-catalogo-2167productos-2026-08-12.json`) proves the current validators certify structurally complete products that are semantically wrong: photos assigned to the wrong product, numbers accepted without real grounding evidence, and a `color` field polluted with connection types. The user-facing promise is "GREEN = reliable" and that promise is false today.

Establish **post-extraction verification gates that degrade to YELLOW** (importable but flagged) whenever image↔text or number↔row evidence is weak — without rewriting extraction or OCR.

## Measured Baselines (2026-08-12 export, n=2167)

| Metric | Value |
| --- | --- |
| GREEN / YELLOW / RED | 1988 (92%) / 179 (8%) / 0 (RED filtered at import) |
| MOUSE with wide image (aspect > 1.9, likely keyboard/photo-combo) | 92 |
| TECLADO with narrow image (aspect < 0.65) | 23 |
| Sampled decoded images with WHITE dominant color (background dominates) | 299/407 (73%) |
| Declared-color vs actual-image color mismatches (sample, incl. background noise) | 191/407 |
| Price outliers flagged (`_statFlag`) — advisory only, do not degrade | 197 |
| Products where `grounded: true` is hardcoded by the parser | ~all (3 push sites) |
| Suspect cross-brand rows (ATK list → marca "Vgn") | 8 |
| Suspect cross-brand rows (Irok catalog → marca "Royal Kludge") | 4 |
| Sanitizer model-quality recall vs ground truth | 85% (34/40) |
| Sanitizer FP rate on clean models | 8% (2/25) |

## Root Causes (evidence-backed)

1. **No image↔text verification exists.** `CatalogValidator.R9` only checks that `img` is a valid `data:image` URI — it never checks the photo shows the product in `modelo`. The only visual checks live in `PdfParser.validateImageForProduct` (aspect ratio, dominant color, size), and dominant color is computed over the whole canvas, so the white page background wins (73% of samples) and the check either never fires or fires on the background.
2. **`catalogAssignmentGates.js` (512 lines, tested) is not wired into the import pipeline.** Cross-category/cross-brand image sharing, placeholder policy, and generic-model detection are implemented and measured only by `scripts/measure-catalog-assignment.js`; `app.js` / `importFlow.js` never run them, so their protections never reach production.
3. **`grounded: true` is hardcoded.** All three `pdfParser.js` push sites set `grounded: true / groundedFob: true / isGroundedPrice: true` with a literal-anchor reason. Nothing verifies the price anchor belongs to the product's row (fused cells, shifted columns, price-of-neighbor), yet R10 treats it as verified → numbers with error pass as GREEN.
4. **Price outliers are advisory-only.** `validateCatalogStats` flags `_statFlag` but explicitly does not change GREEN → YELLOW, so `$481.23` ACCESORIO and `$436` HEADSET stay GREEN.
5. **`color` field is contaminated.** Samples: `"Wireless"`, `"Black Mouse Wireless"`, `"Black Keyboard Wireless"`, `"Magnetic Switch White"`, `"Black Webcam"` — connection type and category leak into color.

## Desired Outcomes

- A product whose photo is incompatible with its category/brand (or whose declared color contradicts the photo, background excluded) is never GREEN.
- `grounded` means the FOB anchor was verified against the product's row geometry; unverifiable numbers degrade to YELLOW with a reason.
- Outliers and cross-brand/cross-category image sharing surface as YELLOW with concrete evidence.
- The `color` field holds a color, not a connection type.
- Gates run in the real import pipeline (and batch export), with the same evidence shape available to the UI.

## Scope

### In Scope

Three independently reviewable slices:

1. **`image-text-verification`** — background-excluded dominant-color check, category-aspect gates degrading to YELLOW (not just penalizing the matcher), and wiring `CatalogAssignmentGates` into the real pipeline so cross-category/cross-brand sharing and placeholder policy are enforced post-import.
2. **`fob-grounding-integrity`** — replace hardcoded `grounded: true` with anchor-to-row geometric verification (same row, column alignment, price-format context); unverifiable → YELLOW. Outliers move from advisory to YELLOW with the outlier evidence attached.
3. **`model-color-sanitization`** — connection-type and category-word removal from `color` (move to variante or drop), plus tightening the generic/marketing model detection that drives 107+107 of the 179 YELLOW.

### Out of Scope

OCR; new LLM/provider; parser rewrite (FASE 2 is closed); cloud image sync; pricing/IVA/logistics redesign; manual vendor correction; storage/migration changes; any change to `ground-truth/` or the FASE 2 measurement scripts' semantics.

## Approach

Freeze baselines from the real export first (above), then run slices `1 → 2 → 3`, each with TDD fixtures derived from the export. Gates are additive post-processing — no data migration, no extraction rewrite. Keep tests with behavior.

### Product Decisions for Downstream Specs

- Image incompatible with category/brand → YELLOW, importable, with warning. Confirmed by owner (missing/invalid image already YELLOW policy, AP-1).
- Color check must exclude the page background (sample interior, not full canvas) to avoid the 73%-white failure mode.
- `grounded` degrades to YELLOW, never RED, when the anchor cannot be verified geometrically; RED remains for missing/invalid FOB.
- Price outliers degrade to YELLOW only above a high-confidence threshold (IQR x3) to avoid mass flagging.

## Evidence and Rollback Gates

- Each slice: TDD fixtures from the real export + a post-gate measurement that must not regress baselines.
- The export used for measurements is the same shape as `mambo-catalogo-2167productos-2026-08-12.json` (inline `img`, status/warnings/_validation fields).
- No slice mutates stored catalog data; all are read-only verification layers (rollback = revert the gate file).

## Review-Budget Strategy

Forecast 180–320 authored changed lines per slice within the 400-line budget; chain slices; keep UI strings in Spanish (existing convention).

## Affected Areas

`src/js/catalogValidator.js`, `src/js/catalogAssignmentGates.js` (wire into pipeline), `src/js/pdfParser.js` (grounding evidence), `src/js/textSanitizer.js` (color/model), `src/js/ui/importFlow.js` (surface evidence), `scripts/measure-catalog-assignment.js`, `scripts/quality/` fixtures/tests.

## Risks

Background-dependent color checks may still mis-flag combo photos (accepted as WATCH, no status change); geometric grounding may be inconclusive on fused cells (falls back to YELLOW, not RED — acceptable); wiring assignment gates into the pipeline may shift GREEN→YELLOW counts measurably (that is the point: honest semaphore).

## Success Criteria

- [ ] 0 GREEN products with cross-category or unverified cross-brand shared images in the real pipeline.
- [ ] 0 GREEN products whose declared color contradicts the photo (background excluded) in fixtures.
- [ ] Every exported product with `grounded: true` carries anchor-to-row evidence; unverifiable anchors are YELLOW.
- [ ] `color` field contains no connection-type or category words in fixtures.
- [ ] Full-corpus run reports the before/after GREEN/YELLOW/RED delta with no regressions on the FASE 2 measurement gates.
