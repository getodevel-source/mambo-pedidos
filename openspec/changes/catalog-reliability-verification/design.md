# Design: Catalog Reliability Verification

## Technical Approach

Additive post-extraction verification only. No extraction rewrite (FASE 2 closed), no OCR, no new LLM, no storage/migration changes. Three independently reviewable slices run `1 → 2 → 3` under strict TDD (RED→GREEN→REFACTOR per `config.yaml`), each with fixtures derived from the 2026-08-12 export (n=2167). All gates are read-only post-processing on in-memory product objects; rollback = revert the gate files.

Core structural decision: **one composed verification entry point** — `ImportGates.runImportVerification(items)` — that both the browser import flow and the Node batch export call. Today `importFlow.js` calls `CatalogValidator.runFullValidation` at 6 sites and `export-catalog-batch.js` calls nothing; `CatalogAssignmentGates.runAll` runs only in `scripts/measure-catalog-assignment.js`. A single composed function makes the preview semaphore identical to the import-time semaphore and to the batch-export semaphore, which is the whole promise ("GREEN = reliable").

```
runImportVerification(items):
  1. CatalogValidator.runFullValidation(items)     # R1–R10 statuses + _statFlag advisory + IQR×3 outliers (slice 2)
  2. ImageTextGates.runAll(items)                  # interior-color match + category-aspect (slice 1)
  3. CatalogAssignmentGates.runAll(items)          # cross-category/cross-brand/placeholder + model quality (slice 1)
  → { accepted, review, rejected, stats, products }   # split recomputed AFTER gates
```

Gates only degrade (GREEN→YELLOW), never promote; ordering is fixed (validation → image-text → assignment) so evidence attached by earlier layers survives, and warnings appended by gates are not wiped by a later `runFullValidation` rebuild (`runFullValidation` rebuilds `p.warnings`, so it must run first). Callers swap their product array with `result.products` (gates clone products, preserving `_selected` and evidence via spread).

## Architecture Decisions

| # | Decision | Options | Tradeoff | Choice |
| --- | ---------- | --------- | ---------- | -------- |
| 1 | Gate composition | Inline in `importFlow.js` vs new module | Inline = untestable in Node (DOM-dependent) + 6 duplicated call sites | New `src/js/importGates.js`, pure Node-testable, single seam for import + export + preview |
| 2 | Interior color core | Canvas decode everywhere vs pure RGBA core + thin decode adapter | Decode in Node tests impossible (no canvas in `run-tests.js`) | Pure `sampleInteriorColor(pixels,w,h,ratio=0.6)` on RGBA arrays; `interiorColorFor(img)` adapter decodes via ambient canvas (browser `Image`+canvas; Node node-canvas in export) — RED tests hit the pure core |
| 3 | Interior color capture point | Re-decode data URL post-import vs compute at extraction | Re-decode duplicates work and fails on shim | Compute at the existing full-canvas `dominantColor` site in `extractImagesFromPage`; store `interiorColor` on the image object; matcher attaches it to products alongside `imageEvidence` |
| 4 | Category-aspect placement | Inside matcher penalties vs post-matching gate | Matcher relaxed backfill (score−45, accepted) would clear a penalty; spec forbids that | Independent post-matching gate in `ImageTextGates` on the FINAL assigned image — relaxed backfill cannot clear it |
| 5 | Preview reason surfacing | New UI surface vs existing `pv-reason` | New surface violates "no new interaction surfaces" | Reuse `pv-reason`; gate warnings appended to `p.warnings` become `warnings[0]` → `qualityReason` → shown reason. Extend `isPhotoOnly` to exclude gate-flagged items (see Decision 6) |
| 6 | IT16 photo-only split | Leave `isPhotoOnly` as-is vs exclude gate-flagged | Cross-category detach sets `img='-'` + imagen-ish warnings → `isPhotoOnly` true → wrongly "datos OK" and auto-selected | `isPhotoOnly` additionally requires `!(item._imgTextWarnings?.length)`; gate-flagged items fall into `dataReviewCount`, unselected by default, with the review badge |
| 7 | Grounding verification | Trust parser anchor (status quo) vs pure `verifyGrounding` | Hardcoded `grounded:true` is a lie per measured evidence | Pure `PdfParser.verifyGrounding({anchor,rowTextY,pageNum,pageAnchors,...})` called at all 3 push sites; evidence replaces the hardcoded reason string |
| 8 | Outlier threshold | Keep 1.5× advisory vs promote >IQR×3 | Mass flagging if threshold too low; spec mandates IQR×3 high-confidence | `validateCatalogStats` computes `low3/high3 = Q1/Q3 ∓ 3·IQR`; above → YELLOW with `{price,median,iqr,cat,factor}`; 1.5× advisory unchanged; RED never re-promoted (maxStatus) |
| 9 | IT17-vs-new-spec (model FNs) | Keep human-queue decision vs close FNs | IT17: "M720 Wireless Mouse" indistinguishable from "F75 Gasket Keyboard" with old signals; spec requires closing 6 measured FNs | Two new discriminators, see Decision table below and §IT17 Tension Resolution |
| 10 | Color vocabulary | Hardcode list vs derive | Deriving from `COLOR_AUDIT_RE` couples modules; hardcode drifts | `TextSanitizer.COLOR_KEEP_RE` derived from `CatalogValidator.COLOR_AUDIT_RE` vocabulary + switch-adjacent colors (`transparent`, `smoke`, `mint`, `navy`, `beige`); removal vocabulary = `CONNECTION_AUDIT_RE` + `CATEGORY_AUDIT_RE` + `switch`/`magnetic`/`hall effect` |

### IT17-vs-new-spec discriminator decision (Slice 3)

**Tension.** `tests.js:270` locks "F75 Gasket Keyboard" → GREEN (app convention: descriptive model with real code is valid) and `tests.js:281` locks "M720 Wireless Mouse" → GREEN ("cola humana" — IT17 concluded code+type models are structurally identical to legitimate descriptive names and cannot be separated without catalog knowledge). The new spec's measured ground truth (recall 85% = 34/40, 6 FNs) requires the 6 FNs to flag, while `assessModelQuality` runs inside `validateItem` for every product — any overreach burns FP budget (currently 2/25 = 8%, the hard ceiling; **zero new FP headroom**).

**Resolution.** Keep IT17's conclusion for the *indistinguishable* class and add two exact, documented discriminators that separate the FN class from "F75 Gasket Keyboard":

1. **Connection+category co-occurrence** (`CONNECTION_AUDIT_RE` word AND `CATEGORY_AUDIT_RE` word both in model) → YELLOW "tipo de conexión y categoría dentro del modelo". Closes "M720 Wireless Mouse" (Wireless+Mouse) and "G502 Wired Mouse" (Wired+Mouse). "F75 Gasket Keyboard" survives: **Gasket is a material, not a connection word**; the color spec itself argues connection words belong in `variante`, so their presence in `modelo` is dirty by the same convention.
2. **Category/spec word without a real product code** (`hasModelCode` = the existing letter+digit adjacency pattern `/(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]?)/i` fails AND a category word or spec fragment present) → YELLOW "categoría/fragmento de especificación sin código real". Category vocabulary restricted to the measured words `{keys, keycaps, backpack}` (extended from `CATEGORY_AUDIT_RE`) to protect "Retro Receiver Saturn"-class models; spec fragments = size pattern `\d+(\.\d+)?\s*("|inch|pulg)`, material word `powder`, bare count `N Keys`. Closes "68 Keys Esport" (keys, no code), "0500 Backpack Tactical 15.6\"" (backpack + 15.6"), "Mount Tai GT powder" (powder, no code).
3. **Switch/axis extension**: add `hall\s*effect` to the existing `/\b(axis|switch)\b/i` rule. Closes "Hall Effect Ace 68 Air" (also no real code). "axis" (lost-code FN) is already covered by both this rule and the existing lost-code rule.

"F75 Gasket Keyboard" passes all three (material, real code F75, no connection word) → stays GREEN. Consequence: `tests.js:281` is **deliberately flipped** (task 3.3) — the IT17 "cola humana" precedent is superseded for the connection+category class only; `tests.js:270` is preserved (task 3.5). Residual accepted cost: real line names like "MX Master 3S Wireless Mouse" now flag — consistent with the color spec's variante policy and measured by task 3.6 (recall ≥ 85%, FP ≤ 8% on the 65-case ground truth; new FN fixtures added contract-fixtures style, env-gated full-corpus).

## Data Flow

### Import pipeline (browser)

```
processFiles(files)
  → per file: PdfParser.processPdfFile
        push sites now derive grounded via verifyGrounding + attach groundingEvidence (slice 2)
        extractImagesFromPage computes interiorColor over center-60% crop (slice 1)
  → TextSanitizer.sanitizeItem / fixItemsInPlace (color-field cleaning, slice 3)
  → ImportFlow.pendingPreviewItems = all incoming
  → ImportGates.runImportVerification(items)          # the single composed seam
        runFullValidation → ImageTextGates → CatalogAssignmentGates
  → defaults: RED unselected; gate-flagged YELLOW = data-flagged → unselected (review badge);
              photo-only YELLOW stays selected (IT16, extended by Decision 6)
  → renderImportPreviewModal(validation)
        pv-reason shows warnings[0] — gate warnings surface automatically (slice 1, task 1.8)
  → confirmImportPreview → runImportVerification again (same gated result) → save
```

All 6 `runFullValidation` call sites in `importFlow.js` (processFiles, updatePreviewItem, applyBatchBrand, applyBatchCat, autoCorrectPreview, confirmImportPreview) switch to `runImportVerification`; each call swaps `ImportFlow.pendingPreviewItems = result.products` so gate mutations persist across preview edits. Preview `idx`-based handlers stay consistent because the swap precedes re-render.

### Batch export (Node)

```
export-catalog-batch.js: per file processPdfFile → exported mapping (adds imgAspect, imageEvidence,
groundingEvidence, imgTextWarnings) → after the file loop: ImportGates.runImportVerification(allExported)
→ write OUTPUT.json with gate evidence present → measure scripts consume the same shape
```

`imgAspect` is attached at parser assignment time (`winnerProd._imgAspect = winnerImg.width / winnerImg.height`) because the export has no canvas fallback guarantee; browser path decodes via `Image` when `imgAspect` is absent (CSV rows).

### Grounding verification sequence (slice 2)

Per push site, the anchor, the page's `priceAnchors`, and the row's text tokens are in scope:

```
verifyGrounding({ anchor, rowTextY, pageNum, pageAnchors, columnTolerance=40, rowTolerance=30 })
  1. anchor absent (matrix/fallback path, push site 3) → {grounded:false,
     reason:'FOB sin ancla literal verificada', evidence:{groundingMode:'geometric', page, anchorX:null, dx:null, dy:null, price}}
  2. same-column band = anchors with |a.x − anchor.x| ≤ 40 (the grid engine's column tolerance)
  3. nearest = argmin over same-column band of |a.y − rowTextY|
  4. nearest !== anchor  → {grounded:false, reason:'ancla de fila vecina', evidence:{..., dy: minDist}}   # fused cell / shifted column
  5. |anchor.y − rowTextY| > 30  → {grounded:false, reason:'ancla no alineada', evidence:{..., dx, dy}}
  6. else {grounded:true, reason:'FOB verificado por geometría de fila', evidence:{groundingMode:'geometric',
     page, anchorX:anchor.x, rowX:anchor.x, dx:0, dy:anchor.y−rowTextY, price}}
```

`rowTextY` = median y of the text tokens collected into the cell/row band at each site (grilla: `cellTextItems`; tabla: `rowElements`; matrix: `rows[i].y` when no anchor). The 30px row tolerance reuses the engine's same-row epsilon (`Math.abs(left.y − right.y) <= 30` at pdfParser ~903); the 40px column tolerance reuses the grid's column-split epsilon (`uniqueXs` gap check). `evaluateItem` R10 consumes `item.groundingEvidence` (extending, not reshaping, the R1–R10 contract: code/severity/status/evidence/reason/importability unchanged). Unverifiable → `grounded:false` → R10 WARNING/YELLOW/IMPORTABLE (already the mapping — never RED; RED stays reserved for absent/undefined grounding). Matrix-path products (push site 3, `img:'-'`) will degrade en masse — honest delta, measured in task 2.7.

## File Changes

| File | Action | Description |
| ------ | -------- | ------------- |
| `src/js/imageTextGates.js` | Create | Pure `sampleInteriorColor`, `declaredColorOf`, `colorCompatibility`, `categoryAspectViolation`, `runAll` attaching `_imgTextWarnings`/warnings; decode adapter `interiorColorFor` (browser canvas / Node node-canvas) |
| `src/js/importGates.js` | Create | `runImportVerification(items)` composition + `isGateFlagged(item)`; returns final `{accepted,review,rejected,stats,products}` |
| `src/js/catalogAssignmentGates.js` | Modify | Attach structured evidence `{type:'cross-category', sharedBy:[skus], categories:[...]}` and `{type:'cross-brand',...}` to `_imgTextWarnings` at the detach sites (warning strings unchanged); `runAll` unchanged |
| `src/js/pdfParser.js` | Modify | `interiorColor` at extraction; `verifyGrounding` method; 3 push sites (~1131, ~1594, ~2211) replace hardcoded flags with derived `grounded`/`groundingReason`/`groundingEvidence`; `_imgAspect` on assigned products |
| `src/js/catalogValidator.js` | Modify | `validateCatalogStats`: IQR×3 outlier bounds → YELLOW via maxStatus + `_outlierEvidence` + warning; R10 evidence merged with `item.groundingEvidence`; R1–R10 contract untouched |
| `src/js/textSanitizer.js` | Modify | `sanitizeColorField(colorText)` (pure, returns `{color, moved}`) wired into `fixItemsInPlace` (move to `variante` when empty, else drop); `assessModelQuality` rules 1–3 of §IT17 resolution; `COLOR_KEEP_RE` vocabulary |
| `src/js/ui/importFlow.js` | Modify | All 6 `runFullValidation` sites → `runImportVerification` + product-array swap; `isPhotoOnly` excludes gate-flagged (Decision 6); `pv-reason` unchanged (shows gate warnings) |
| `scripts/export-catalog-batch.js` | Modify | After file loop: `runImportVerification(allExported)`; export shape adds `imgTextWarnings`, `imgAspect`, `imageEvidence`, `groundingEvidence` (additive — measure scripts keep working) |
| `src/index.html` | Modify | 2 `<script>` tags for `js/imageTextGates.js` + `js/importGates.js` (script-integrity gate in `run-tests.js` fails without them) |
| `scripts/run-tests.js` | Modify | `global.ImageTextGates`, `global.ImportGates` requires |
| `src/js/tests.js` | Modify | RED tests per slice; flip `tests.js:281` (M720 → YELLOW); keep `tests.js:270` (F75 Gasket Keyboard → GREEN); FASE 2 tests untouched |
| `scripts/quality/` | Add | FN fixtures + color-sanitization fixtures (contract-fixtures style); env-gated full-corpus runners reuse `measure-*.js` |
| `scripts/measure-catalog-assignment.js` | No change | Still valid (runs `GATES.runAll` standalone); corpus measurements use the export which now includes gate evidence |

## Interfaces / Contracts

```js
// ImageTextGates
sampleInteriorColor(pixels /*Uint8ClampedArray RGBA*/, width, height, ratio=0.6)
  → { name:'BLACK'|'WHITE'|..., confidence, occupancy } | { name:'UNKNOWN', confidence:0, occupancy:0 }
declaredColorOf(product) → { word, color } | null        // color/variante/modelo × COLOR_KEEP vocabulary
colorCompatibility(declared, actual) → boolean            // GRAY↔SILVER↔WHITE, PURPLE↔BLUE↔PINK, CYAN↔BLUE↔GREEN, GOLD↔ORANGE
categoryAspectViolation(cat, aspect) → { violation, expectedFamily }  // compact>1.9, wide<0.65
runAll(products) → { products, changes }                  // attaches _imgTextWarnings + warnings, degrades status

// Evidence attached by ImageTextGates (per product, array)
_imgTextWarnings: [
  { type:'color-mismatch', declared:'BLACK', actual:'WHITE', sampleRegion:'center-60%', occupancy:87, reason:'Color de imagen (WHITE) no coincide con el producto (BLACK)' },
  { type:'category-aspect', cat:'MOUSE', aspect:2.3, expectedFamily:'COMPACT', reason:'Imagen ancha (ratio 2.30) incompatible con MOUSE' },
  { type:'color-ambiguous', ambiguous:true, occupancy:29 }      // WATCH only — no status change
]

// ImportGates
runImportVerification(items) → { accepted, review, rejected, stats, products }
isGateFlagged(item) → boolean   // item._imgTextWarnings?.length > 0

// Grounding (slice 2)
PdfParser.verifyGrounding({ anchor|null, rowTextY, pageNum, pageAnchors, columnTolerance=40, rowTolerance=30 })
  → { grounded, reason, evidence:{ groundingMode:'geometric', page, anchorX, rowX, dx, dy, price } }

// Outliers (slice 2) — 3×IQR only
_outlierEvidence: { price, median, iqr, cat, factor }
warning: 'Outlier de precio: $X (mediana $Y)'   // 1.5× stays advisory _statFlag, no status change

// Color sanitization (slice 3)
TextSanitizer.sanitizeColorField(colorText) → { color, moved }  // color ∈ COLOR_KEEP vocabulary ∪ ''
fixItemsInPlace: moved tokens → variante when variante empty, else dropped
```

## Testing Strategy (TDD order per tasks)

| Slice | RED (test) | GREEN (impl) | REFACTOR |
| --- | --- | --- | --- |
| 1 | 1.1 interior color: white-background fixture → interior BLACK vs declared BLACK mismatch → YELLOW + evidence; 1.3 aspect: MOUSE 2.3 → YELLOW, TECLADO 2.3 → GREEN, backfill not clearing; 1.5 sharing: 2 cats/1 img → both YELLOW + `{sharedBy,categories}`, rebrand (Irok/Mars same model+cat) → unchanged; 1.7 export/preview: gate warning reaches export + `pv-reason`, `isPhotoOnly` excludes gate-flagged | 1.2 `sampleInteriorColor` + `interiorColorFor` + color gate; 1.4 `categoryAspectViolation` + `runAll`; 1.6 `importGates.js` + evidence attachment + importFlow/export wiring + index.html tags; 1.8 preview surfacing + `isPhotoOnly` extension | 1.9 full-corpus export, before/after GREEN/YELLOW delta; FASE 2 gates no regression |
| 2 | 2.1 hardcoded `grounded:true` fixture rejected (must derive); 2.3 fused-cell → false + 'ancla de fila vecina', absent anchor → 'FOB sin ancla literal verificada', both YELLOW never RED; 2.5 IQR×5 → YELLOW + evidence, IQR×2 → advisory | 2.2 `verifyGrounding` + 3 push sites; 2.4 R10 consumes `groundingEvidence` (contract shape unchanged); 2.6 outlier IQR×3 in `validateCatalogStats` | 2.7 corpus: 0 products with `grounded:true` lacking geometric evidence; delta report |
| 3 | 3.1 `'Black Mouse Wireless'` → `color:'Black'` + moved; `'Magnetic Switch White'` → `'White'`; 3.3 the 6 measured FNs → YELLOW (flip `tests.js:281`); 3.5 clean stays GREEN (`F75 Glacier`, `F75 Gasket Keyboard`) | 3.2 `sanitizeColorField` + `fixItemsInPlace` seam; 3.4 `assessModelQuality` rules 1–3 | 3.6 FASE 2 gates: recall ≥ 85%, FP ≤ 8% on 65-case ground truth; FN fixtures added; 3.7 corpus delta by reason; stored catalogs untouched |

Runner: `npm test` (`node scripts/run-tests.js`) for unit suites; `scripts/measure-model-quality.js`, `scripts/measure-extraction.js`, `scripts/measure-catalog-assignment.js` for gate regression; full-corpus exports env-gated (contract-fixtures style). Pure cores (RGBA sampling, grounding, aspect, color split) carry the RED tests with synthetic fixtures; canvas decode adapters are exercised by the batch export and browser smoke, not the unit suite.

## Threat Matrix

No routing, shell, subprocess, VCS/PR automation, or process-integration boundary. The Node batch export is the existing local developer script; gates add read-only post-processing. Measurement scripts remain read-only over the exported JSON. No storage keys, no catalog mutation, no executable-file classification.

## Migration / Rollout

No persistence changes. All gates operate on in-memory objects during import/extraction; stored catalogs keep their old `color`/`modelo`/`grounded` values until re-imported (spec: no silent migration). Rollback per slice = revert that slice's file set (gates are additive; `importFlow` falls back to plain `runFullValidation` if `ImportGates` is reverted). Chain: PR 1 (Slice 1) → PR 2 (Slice 2) → PR 3 (Slice 3), stacked-to-main, per tasks forecast (180–320 lines/slice, per-slice within the 400-line budget).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Interior-color check still mis-flags combo/multi-color photos | Occupancy < 35% → WATCH (no status change) with `{ambiguous:true, occupancy}`; interior 60% crop removes the 73%-white background failure; matcher-level full-canvas signals stay non-degrading (existing gates comment documented why) |
| Grounding geometry inconclusive on fused cells / unusual layouts | Fails to YELLOW (never RED); 30px/40px tolerances reuse the engine's own grid epsilons; task 2.7 measures the false-negative rate (0 `grounded:true` without evidence) |
| Wiring gates into the pipeline shifts GREEN→YELLOW measurably (cross-category detach, matrix grounding) | That is the stated outcome (honest semaphore); per-slice delta reports in tasks 1.9/2.7/3.7 gate acceptance; matrix-path mass-degrade expected and documented |
| FP budget is at the ceiling (2/25 = 8%) — new model rules must add 0 FPs | Discriminators keyed to connection+category co-occurrence and code-presence (mHasCode); measured-vocabulary restriction (`keys/keycaps/backpack`) protects "Retro Receiver Saturn" class; task 3.6 enforces the ceiling with the FN fixtures added to the ground truth |
| `runFullValidation` rebuilds `p.warnings` and would wipe gate warnings on re-validate | Composition order fixed (validation → gates); callers swap `result.products`; confirmImportPreview re-runs the same composed function so preview == import semaphore |
| Gate-flagged items misclassified as photo-only (IT16) and auto-imported | `isPhotoOnly` requires no `_imgTextWarnings`; gate-flagged YELLOW land in `dataReviewCount`, unselected, review badge (Decision 6) |
| Script-integrity gate breaks on new modules | `index.html` script tags added in the same task as the new files (1.6) |
| FASE 2 measurement semantics regressed | Only additive fields to the export shape; parser core untouched except the 3 grounding assignments + interior color; `measure-extraction.js`/`measure-model-quality.js` gates run in 1.9/3.6 |

## Open Questions

- Exact `rowTolerance`/`columnTolerance` values validated empirically against the corpus during task 2.7 (defaults 30/40 mirror the engine's own epsilons).
- Magnitude of the matrix-path YELLOW delta (push site 3, `img:'-'`) is unknown until task 2.7 measures it; expected and accepted, but the number should be reported for owner awareness.
- "MX Master 3S Wireless Mouse"-class real line names will now flag (connection+category); accepted per the color-spec variante policy, verified against the 25-case FP set in task 3.6 — if any land there, the vocabulary narrows before merging PR 3.
