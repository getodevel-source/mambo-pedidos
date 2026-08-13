# Proposal: Catalog Remediation Loop

## Intent

The FINAL5 export (2,309 products from the 13 default PDFs) proves the reliability
gates now degrade honestly: **1605 GREEN (69%) / 656 YELLOW (29%) / 48 RED (2%)**.
But YELLOW/RED is a *destination*, not a *strategy*. Today nothing tries to turn a
correct-but-flagged product back into GREEN — a product whose FOB anchor can be
verified literally stays YELLOW `FOB_NO_LITERAL_EVIDENCE` even when the literal text
exists in its row; a legitimate product name such as 8bitdo's "Dual Charging Dock
Xbox" stays YELLOW `MODEL_MARKETING` because the marketing-word gate fires on a real
noun phrase.

This change establishes a **per-item remediation loop**: for each non-GREEN product —
diagnose the exact atomic reason → apply the deterministic remediation strategy for
that failure class → re-run the full gate stack → promote to GREEN **only with
evidence** → move to the next item. The loop iterates until it reaches a fixed point
(a pass where no item changes status). The goal is **total GREEN ≥ 99% HONESTLY**,
bounded by what the source PDF data actually contains, plus an overall
performance/quality guard on the pipeline itself.

**Politica rectora (inherited from quality-loop-engineering): fail-closed.**
Never pass incorrect data as GREEN. Promotion requires verifiable evidence derived
from real source artifacts (PDF text items, image interior pixels, other row
columns). Items that cannot be honestly fixed **stay YELLOW/RED with an atomic
reason**. Remediation is allowed to *fix gate false positives* (calibration) but
never to *relax a true gate*: the 100% target is a ceiling bounded by the source
data, and the loop must declare which items are **bounded-irremediable** instead of
silently accepting a lower bar.

The loop MUST NOT overfit to the current 13 supplier catalogs. Every remediation
rule must derive from structural/generic patterns (noun-phrase grammar, row geometry,
literal text anchors, interior-color sampling) — never from per-brand or per-catalog
hardcoding.

## Measured Baselines (FINAL5 export, 2026-08-XX, n=2309)

| Metric | Value |
| --- | --- |
| GREEN / YELLOW / RED | 1605 (69%) / 656 (29%) / 48 (2%) |
| Target | GREEN ≥ 99% (≥ 2286 of 2309), honest |
| COLOR_MISMATCH gate FP rate | **0 FP on 46-item labeled audit** (gate is honest) |
| Existing loop harness | `scripts/quality-iterate.js` (measure-only: export → analyze → baseline deltas; **no remediation step**) |
| FASE 2 measurement gates | recall_dirty 100% / FP_rate_clean 8% (at ceiling) · measure-extraction 46/65 closed baseline |
| Full-corpus export time | ~8–10 min (render-based hybrid, 30x faster than original AULA 261.7s → 8.7s) |

## Failure-Class Taxonomy with Remediation Strategy (measured FINAL5)

YELLOW+RED breakdown by `qualityReason` (n=704). For each class: remediation
strategy, the evidence that makes an item **honestly GREEN**, and what **stays
YELLOW/RED**. "Promotion evidence" is mandatory on every promoted item
(`remediationEvidence`); without it the promotion is a pipeline defect.

### Honest gates — remediate the DATA, not the gate

These gates measure real product properties (color, price, geometry). They are
correct; the *fields* they flag are wrong or unverifiable. The loop repairs the
field from other real evidence or leaves the item flagged.

**1. COLOR_MISMATCH — 118** (photo color ≠ declared product color; 0 FP on 46-sample)

- Strategy `color-from-image`: re-derive color from the interior sample
  (center-60%, background excluded — the `ImageTextGates.sampleInteriorColor` path)
  when the photo is **unambiguous** (single dominant color, occupancy ≥ 35%). If the
  declared color fails the compatible-group check but the interior color is a
  vocabulary color, move the declared value to `variante` and set `color` from the
  image.
- Promotion evidence: `{remediated:'color-from-image', actual, declared, occupancy≥35, sampleRegion:'center-60%'}`.
- **Stays YELLOW:** multi-color / low-occupancy photos (cannot know the intended
  color), photos where interior color is not in the color vocabulary, box-art photos
  flagged by the box-detection heuristic (see Risks).

**2. COLOR_AMBIGUOUS — 110** (multi-color, low occupancy — WATCH-level, borderline)

- Strategy `variante-color-adoption`: if `variante` names explicit colors
  (e.g., "Pink/White", "Black Blue") matching the photo's top interior colors, the
  multi-color is *intentional product design*, not uncertainty → promote.
- Promotion evidence: `{remediated:'variante-color-adoption', colorsFromVariante, photoTopColors}`.
- **Stays YELLOW:** variante empty or naming colors that contradict the photo.

**3. OUTLIER_PRICE — 106** (IQR×3 price outliers)

- Strategy `literal-price-regrounding`: re-run anchor-to-row verification demanding a
  **literal** price token (currency symbol / decimal pattern) in the same row band.
  A verified literal anchor proves the outlier is a real price tier, not a parse
  error. (Bimodal category price distributions are legitimate.)
- Promotion evidence: `{remediated:'literal-price-regrounding', groundingMode:'literal', text, page, dy}`.
- **Stays YELLOW:** no literal price token in the row; anchor belongs to a neighbor
  (fused/shifted cells). Never promote on geometric-only evidence.

**4. FOB_NO_LITERAL_EVIDENCE — 94** (grounding is geometric only)

- Strategy `literal-anchor-search`: scan the verified row band's text items for a
  price-like token the row actually contains (currency symbol, price pattern). The
  literal text is the evidence the reliability change could not find for this row.
- Promotion evidence: `{remediated:'literal-anchor-search', groundingMode:'literal', text, page, alignment}`.
- **Stays YELLOW:** row contains no literal price token; fused cells whose anchor
  belongs to the neighbor (genuinely unverifiable). `grounded:true` remains derived,
  never hardcoded.

**5. ASPECT_MISMATCH — 9** (image too wide/narrow for category)

- Strategy `shared-image-reassign`: if the image is shared with a sibling whose
  category aspect matches, the mismatch is an assignment artifact → reassign and
  re-run the image-integrity gates. Verified rebrands (same brand+model+cat) already
  pass; extend only with identity evidence.
- **Stays YELLOW:** the image genuinely does not fit the category (source-photo
  problem; cannot be fixed from data).

**6. SHARED_IMAGE — 5** (image shared across categories)

- Same remediation family as ASPECT_MISMATCH (assignment-level). Identity doubt →
  fail-closed: stays YELLOW unless the sibling resolution proves the sharing is a
  legitimate rebrand with brand+model+category evidence.

### Gate false positives — remediate the GATE (calibration pass)

These gates flag legitimate products. The loop carries an explicit
**gate-calibration pass**: for each flagged sample, run a labeled audit, fix the
*rule* (not the item), ship a fixture test, and re-measure FP/FN. A gate is never
weakened to absorb a true positive.

**7. MODEL_MARKETING — 111** (marketing words without real product ID) — **contains
the flagship gate FP**

- Mechanism (verified): `MARKETING_WORDS_RE` contains `dual`; "Dual Charging Dock
  Xbox" (8bitdo) has 1 marketing word, no digit, no code → `MODEL_MARKETING` YELLOW.
  But "Dual Charging Dock Xbox" is a legitimate product name (noun phrase).
- Strategy `noun-phrase-calibration`: distinguish **puffery stacks** ("Ultra
  Crystalblade Gleam" — adjectives only, no category noun) from **legitimate noun
  phrases** (category/product noun — dock, charger, hub, stand, pad, grip, case,
  cover, dock, keyboard, mouse, keypad… — with ≤ 1 marketing adjective). A noun
  phrase with ≤ 1 marketing adjective and no code is a legitimate name; a puffery
  stack of ≥ 2 marketing adjectives without a noun stays YELLOW. The noun-phrase
  vocabulary derives from category keywords + bootstrapped known-good models, never
  from brand names.
- Promotion evidence: `{remediated:'noun-phrase-calibration', pattern:'noun-phrase', noun, marketingWords:1}`.
- **Stays YELLOW:** puffery stacks with no product noun and no code.

**8. SPECS_AS_MODEL — 48 (RED)** — model is a datasheet spec, filtered at import

- This gate is **correct**; a model that is only a spec token has no product
  identity. RED/filter is the honest outcome. The loop's only action: confirm the
  filter catches them and record them as bounded-irremediable (they never reach the
  catalog). A spec token *inside* a real code name ("AJ139 Pro 68 Keys" → code
  present) is already GREEN via the code rule — no change.

**9. MODEL_GENERIC_WORD — 27** (model is a generic word)

- Strategy `row-context-disambiguation`: if the row's other columns (marca,
  category, variante) or a sibling row contain a real product code, adopt it with
  evidence. Otherwise a generic word has no identity.
- **Stays YELLOW:** no disambiguating evidence in the row.

**10. MODEL_TRUNCATED — 27** (unclosed parenthesis/brace)

- Strategy `row-band-repair`: re-scan the page's text items at the row's y band for
  the missing closing token (the extractor often drops the closing paren as a
  separate text item). Repair → re-validate.
- Promotion evidence: `{remediated:'truncation-repaired', before, after}`.
- **Stays YELLOW:** no closing token exists in the row band (genuinely truncated in
  the source PDF).

**11. SWITCH_IN_MODEL — 19** (switch/axis type inside model name)

- Strategy `switch-to-variante`: move the switch/axis token (magnetic, hall effect,
  red/brown/blue switch…) to `variante` (same pattern as the existing
  `sanitizeColorField` connection/category move). Promote only if the remaining
  model keeps a real identity.
- Promotion evidence: `{remediated:'switch-to-variante', moved:['Magnetic','Switch'], to:'variante'}`.
- **Stays YELLOW:** moving leaves an identity-less model.

**12. SPEC_FRAGMENT — 19** (category/spec fragment without real code)

- Strategy `code-adoption`: if a real code exists in another row column / text item
  of the same row, adopt it. Otherwise stays YELLOW (no identity).

### Loop defects — the loop must fix itself

**13. NO_OBSERVATIONS — 7** (YELLOW without reason — investigate)

- This is a **pipeline defect**, not a product problem: a status change without an
  atomic reason violates fail-closed reporting. Strategy `reason-instrumentation`:
  every YELLOW/RED transition MUST carry a reason (extend the gate composition so no
  status degradation is possible without pushing a warning). The 7 existing items are
  re-diagnosed by re-running the gates with instrumentation on; if no reason is
  derivable, they are flagged `UNCLASSIFIED_YELLOW` as a pipeline bug to fix, never
  promoted. **Target: this class goes to 0.**

**14. ~4 misc single items** — per-item investigation; promoted only if a generic
structural rule covers them, otherwise stay YELLOW (bounded-irremediable).

## Scope

### In Scope

1. **`gate-calibration`** — gate FP fixes with labeled audits and fixture tests:
   noun-phrase calibration for MODEL_MARKETING (fixes the "Dual Charging Dock Xbox"
   FP), switch/axis noun classification, reason instrumentation eliminating
   NO_OBSERVATIONS, plus a calibration-delta report (FP/FN per gate, before/after,
   with audit sample sizes).
2. **`remediation-strategies`** — deterministic per-class remediation for the honest
   gates: color-from-image, variante-color-adoption, literal-price-regrounding,
   literal-anchor-search, truncation row-band repair, switch-to-variante,
   row-context disambiguation, code adoption, shared-image reassign. Mandatory
   `remediationEvidence` contract on every promotion.
3. **`loop-orchestration`** — `scripts/remediate-catalog.js`: per-item diagnose →
   remediate → re-verify → promote-or-stay, with a loop ledger (SKU → original
   reason → strategy → outcome → evidence), fixed-point convergence, idempotency
   (re-run on a remediated export is a no-op), bounded-irremediable declaration, and
   the hold-out generalization validation script. Config-gated strategies + rollback
   flip.
4. **`performance-quality-guard`** — the loop also guards the pipeline itself:
   per-iteration export time, gate-composition cost, and test/lint gates with a
   regression alarm, so "improve overall performance/quality" is measured, not
   asserted.

### Out of Scope

- OCR (scanned PDFs keep reporting, not processing).
- New LLM/provider usage; any non-deterministic remediation.
- Parser rewrite (FASE 2 is closed).
- Storage/migration changes: stored catalogs untouched; remediation runs in-memory
  during import/export exactly like the reliability gates.
- **FASE 2 measurement scripts**: `ground-truth.js`, `measure-model-quality.js`,
  `measure-extraction.js` keep their semantics and their gates
  (recall ≥ 85%, FP ≤ 8%, 46/65 closed baseline) — the loop must not regress them.
- Manual vendor data correction (source PDFs stay as delivered).
- Human review queue UI (the IT17 human queue exists; wiring it is out of scope).
- Changing the semaphore thresholds of honest gates (COLOR_MISMATCH, OUTLIER_PRICE,
  grounding, aspect, shared-image) — calibration only fixes gate FPs with labeled
  evidence.

## Generalization Requirement (no overfitting to the 13 catalogs)

Every remediation rule MUST be expressible as a structural/generic pattern:

- **Noun-phrase grammar** (category/product noun + specifier), not brand lists.
- **Row geometry** (y-band, alignment, column ≤ 40px), not page coordinates.
- **Literal text anchors** (price tokens in the row band), not hardcoded prices.
- **Interior-color sampling** (center-60% occupancy), not image hashes.
- **Known-good model lexicon** bootstrapped from data: derive from products that are
  GREEN after gates and survive 2 iterations — never hand-curated per brand.

Validation of generalization (all three, in the loop):

1. **Leave-one-catalog-out hold-out**: derive/tune rules on 12 catalogs, validate on
   the 13th. A rule qualifies only if it resolves its class on the held-out catalog
   without introducing FPs there. Report per-class resolution on the held-out
   catalog every iteration.
2. **Synthetic stress tests**: mutate fixture models (truncation, marketing words,
   switch tokens, generic words) and assert remediation behavior and the
   anti-overfit guardrails ("Dual Charging Dock Xbox" pattern probed with fictional
   brand names).
3. **Hard anti-overfit audits**: `grep`-based audit that no brand/catalog string
   appears in remediation source; every rule ships with a fixture test proving the
   structural pattern, and cross-brand probes (same pattern, different brand) must
   behave identically.

## Honesty Guarantee

- **Promotion requires evidence.** Every GREEN promoted by the loop carries
  `remediationEvidence` derived from real source artifacts — literal FOB text,
  interior-color sampling, variante color tokens, row-band text items, known-good
  lexicon membership, before/after structural repair. A promoted item with missing
  or fabricated evidence is a pipeline defect (fail-closed).
- **No fabricated evidence.** Evidence fields are never synthesized: they reference
  the exact text item, pixel region, or row column they came from.
- **Bound the target honestly.** Items that cannot be fixed from source data stay
  YELLOW/RED with an atomic reason and are declared **bounded-irremediable** with the
  class and why. The loop stops when GREEN ≥ 99% **OR** the remaining non-GREEN
  items are all bounded-irremediable (the honest ceiling; 100% is not promised).
  **Per user decision: GREEN ≥ 99% is a HARD success criterion.** If the honest
  fixed point lands below 99%, the change does not close: the remaining items are
  emitted as a human-review report (SKU → class → reason → why not remediable) for
  manual disposition, and the loop must exhaust every remediation strategy before
  declaring any item bounded-irremediable.
- **FP on promotion = 0.** After each loop run, a labeled audit sample (≥ 46 items,
  matching the COLOR_MISMATCH audit scale) re-verifies promoted items with a fresh
  independent pass. Any FP stops the loop and reverts that strategy's promotions
  until the rule is fixed.
- **Calibration only fixes FPs.** Gate calibration ships labeled-audit evidence
  (sample size, FP/FN counts) and fixture tests; it never weakens a gate to absorb a
  true positive.

## Approach

Freeze the FINAL5 export as the baseline (above). Run slices in order, each with TDD
fixtures derived from the export and a post-slice measurement that must not regress
baselines:

```
1. gate-calibration → 2. remediation-strategies → 3. loop-orchestration → 4. performance-quality-guard
```

The loop mechanics per iteration (extending `quality-iterate.js`):

1. **Measure** — export the 13 catalogs with the same pipeline as the app
   (`export-catalog-batch.js`), analyze status/reasons/gate types.
2. **Diagnose** — group non-GREEN items by atomic reason; assign each to its class
   strategy.
3. **Remediate** — per item: apply the class strategy (pure functions, deterministic,
   config-gated), re-run `runImportVerification` (runFullValidation → ImageTextGates
   → CatalogAssignmentGates) on the remediated item, promote only on full-gate pass
   - evidence.
4. **Verify** — full `npm test`, lint, FASE 2 gates, hold-out catalog, labeled
   promotion audit (0 FP), fixed-point check (two identical passes), performance
   guard.
5. **Ledger** — write the loop ledger (SKU → reason → strategy → outcome → evidence)
   and the metrics report; commit per-slice unit (Conventional Commits).
6. **Repeat** — until fixed point or bounded-irremediable ceiling.

Remediation is in-memory post-extraction, so the import pipeline and the batch
export both see the remediated shape through the same gate composition; no storage
or migration change is involved.

### Product Decisions for Downstream Specs

- Color-from-image promotion is allowed only when the interior sample is
  unambiguous (occupancy ≥ 35%) and in the color vocabulary; box-art photos (interior
  color = box, not product) stay YELLOW via a box-detection heuristic (WATCH-level).
- Literal FOB/price promotion requires the literal token inside the verified row
  band with alignment constraints; geometric-only evidence never promotes.
- Marketing-word calibration promotes noun phrases with ≤ 1 marketing adjective;
  puffery stacks of ≥ 2 adjectives without a noun stay YELLOW.
- NO_OBSERVATIONS must reach 0 (reason instrumentation is a hard success criterion).
- UI strings and reasons stay in Spanish (existing convention); remediation evidence
  keys stay English/stable.

## Metrics

| Metric | Before (FINAL5) | Target | How measured |
| --- | --- | --- | --- |
| GREEN % | 69% (1605/2309) | ≥ 99% honest | `quality-iterate.js` status report |
| YELLOW | 656 | as low as honest | byReason report |
| RED | 48 (specs filtered at import) | 0 in catalog (unchanged) | import filter |
| NO_OBSERVATIONS | 7 | **0** | byReason report |
| FP on promotion | n/a | **0** | labeled audit ≥ 46 items per loop run |
| Per-class resolution rate | n/a | report each iteration | ledger: class → remediated → promoted → stayed |
| Gate calibration delta | n/a | FP↓, FN not up | labeled audits per gate, before/after |
| Fixed point | n/a | loop converges | two identical passes |
| Idempotency | n/a | re-run = no-op | re-run remediated export |
| FASE 2 gates | recall 100% / FP 8% / 46-65 closed | no regression | `measure-model-quality.js`, `measure-extraction.js` |
| Export time | ~8–10 min | no regression | performance guard per iteration |

## Evidence and Rollback Gates

- **Rollback plan**: every remediation strategy is config-gated
  (`config.remediation = { enabled, strategies: { colorFromImage, literalAnchorSearch, nounPhraseCalibration, ... } }`).
  Flipping any strategy off restores prior behavior; no storage/migration changes
  exist to roll back. Reverting the remediation files + config flip is the full
  rollback, exactly like the reliability verification gates.
- **Fail-closed gates per slice**: `npm test` 0 failures · lint 0 errors · FASE 2
  gates no regression · hold-out catalog no new FPs · promotion audit 0 FP · fixed
  point reached · stored catalogs untouched.
- No slice mutates stored catalog data; all remediation is a read-only
  post-processing layer over extraction.

## Review-Budget Strategy

Forecast 150–300 authored changed lines per slice within the 400-line budget; chain
slices (stacked-to-main, delivery auto-chain). Each slice is independently
reviewable and keeps tests with behavior (strict TDD, `npm test`).

## Affected Areas

`src/js/textSanitizer.js` (marketing noun-phrase + switch classification),
`src/js/importGates.js` + `src/js/catalogAssignmentGates.js` + image-text gates
(evidence shape, reason instrumentation, shared-image reassign), `src/js/catalogValidator.js`
(atomic-reason invariant), `scripts/remediate-catalog.js` (new loop orchestrator),
`scripts/quality-iterate.js` (remediation step + ledger + metrics),
`scripts/quality/` fixtures/tests, config gating, ESLint globals for new scripts.

## Risks

- **Color-from-image over-promotion** (box-art photos): mitigated by occupancy ≥ 35%
  - vocabulary + box-detection heuristic; WATCH-level, no status change on doubt.
- **Noun-phrase calibration over-promotes puffery**: mitigated by the ≥ 2-adjective
  stack rule, known-good lexicon bootstrap, held-out validation, and the promotion
  audit.
- **Literal re-grounding finds neighbor prices**: mitigated by row-band + alignment
  constraints; fused cells stay YELLOW.
- **The 99% target may be unreachable honestly**: the source data is bounded
  (marketing-only names with no code, spec-only models, source-photo problems). The
  bounded-irremediable declaration makes the ceiling explicit instead of faking it.
- **Loop cost on the 8–10 min export**: single export pass + in-memory remediation +
  delta-only re-verification keep the loop within the existing budget; the
  performance guard alarms on regression.
- **Scope creep into FASE 2 / parser**: hard non-goal; the FASE 2 gates act as the
  regression tripwire.

## Success Criteria

- [ ] GREEN ≥ 99% on the 13-catalog corpus, honestly: every promoted item carries
      `remediationEvidence` from real source artifacts.
- [ ] 0 FP on promoted items in the labeled audit (≥ 46-item sample, independent
      pass) after the final loop run.
- [ ] NO_OBSERVATIONS = 0 (every non-GREEN item has an atomic reason; no reason →
      pipeline defect, never promotion).
- [ ] Hold-out catalog validation passes: no remediation rule overfits (per-class
      resolution on the held-out catalog without new FPs); `grep` audit confirms no
      brand/catalog strings in remediation source.
- [ ] Loop reaches a fixed point and a re-run on the remediated export is a no-op
      (idempotent).
- [ ] No regression on FASE 2 measurement gates (recall ≥ 85%, FP ≤ 8%,
      measure-extraction 46/65 closed baseline) or the existing test suite
      (1279+ PASS, lint 0 errors).
- [ ] Stored catalogs untouched; rollback = config flip + file revert (no
      storage/migration delta).

## Proposal Question Round — User Decisions (2026-08-13)

Two product decisions were asked and answered explicitly; the other two are adopted
as written in this proposal.

1. **Color-from-image promotion: CONFIRMED — correct with evidence.**
   When the photo is unambiguous (single dominant color, occupancy ≥ 35%, color in
   the vocabulary), the loop MAY update the declared product `color` from the
   photo's interior sample and promote to GREEN with `remediationEvidence`.
   Doubts (multi-color, low occupancy, box-art, non-vocabulary) stay YELLOW.
   This is the largest remediable class (118 mismatch + 110 borderline).
2. **The 99% ceiling: CONFIRMED — hard success criterion.**
   GREEN ≥ 99% on the corpus is a hard gate: if the honest fixed point lands below
   99%, the change does not close and the remaining items are emitted as a
   human-review report (SKU → class → reason → why not remediable) for manual
   disposition. `bounded-irremediable` items therefore feed a **review report**,
   never silent acceptance of a lower bar.
3. **Gate calibration depth: adopted as written** — noun phrase with ≤ 1 marketing
   adjective + product noun = GREEN; puffery stack of ≥ 2 adjectives without a noun
   stays YELLOW.
4. **Performance/quality guard scope: adopted as written** — measurement-only
   per-iteration guard (export time, gate cost, test/lint gates); no new
   optimization workstream.
