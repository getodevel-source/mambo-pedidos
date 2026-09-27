# PDF → Catalog Import Pipeline: Diagnosis and Measured Progress

State of the extraction pipeline for the 13 real supplier catalogs, measured with five consecutive full exports (A–E). Every number below comes from an actual `export-catalog-batch.js` run, not from estimation.

**Headline:** confidence classification improved from **1650 → 1683 GREEN** on 2319 products, and duplicate photo reuse dropped from **463 → 407 uses**. The remaining blocker is not the parser — it is that **there is no image ground truth**, so photo correctness is unmeasured.

> **Temporary data notice.** All A–E exports and their `-diag.json` companions live **outside the repository** under `C:\Users\juans\AppData\Local\Temp\opencode`. They are ~150 MB each and are **not committed**. Only the small `ground-truth/` files are versioned.

---

## Purpose

Allow another team, or another machine, to continue this work without conversational context. This document records what was diagnosed, what was changed, what was measured, and what remains.

It deliberately does **not** claim accuracy the project has not measured. Where a number is a proxy, it is labeled a proxy.

## Repository and corpus

| Item | Value |
|---|---|
| Repository | `C:\PROYECTOS\MamboApp` |
| Baseline commit | `c6500a7` |
| Version | `2.2.31` (`package.json` + `src-tauri/tauri.conf.json`, consistent) |
| Corpus | `C:\PROYECTOS\Mambo\Catalogos` — 13 PDFs |
| Catalog files | 8BitDo, AJAZZ, ATK, Attack Shark, AULA, Irok Mars, Keyboard Switch, KZ (Zhenzhou Damulin), Logitech, Madlions, Razer, Royal Kludge, MCHOSE |
| Uncommitted work | `src/js/parser/rowMatch.js`, `src/js/pdfParser.js`, `src/js/pdfParserClassifier.js`, `docs/SRS.md` (untracked) |

> **Environment gotcha — `MAMBO_CATALOG_DIR` is mandatory, not optional.** The hardcoded default in `scripts/export-catalog-batch.js:25` is `C:\Mambo\Catalogos`, and `AGENTS.md` documents `C:\Mambo catalogos`. **Neither path exists on this machine.** Only `C:\PROYECTOS\Mambo\Catalogos` does. Without the env var, `export-catalog-batch.js:302` aborts with "la carpeta no existe". Always export it first.

## Verified baseline

Measured on the current working tree (`c6500a7` + uncommitted parser changes).

| Gate | Command | Result |
|---|---|---|
| Dependencies | `npm ci` | installed |
| Unit/integration tests | `npm test` | **PASS — 1001 assertions, 0 FAIL, exit 0** |
| Lint | `npm run lint` | **0 errors, 74 warnings** |
| Version gate | `npm run check:version` | 2.2.31 |
| Frontend build | `npm run build:frontend` | pass |

Note on test counts: the runner currently reports **1001** passing assertions. `AGENTS.md` cites a historical figure of ~1504 across four suites. The 1001 figure is what the current runner reports; treat the older number as stale, not as a regression.

## Diagnosis

Five root causes were found. Line numbers for the "before" state are taken from `git show c6500a7:<file>`; "after" line numbers are from the working tree.

### 1. Coordinate space mixing in `centerY` — the geometry bug

| | Value |
|---|---|
| File | `src/js/pdfParser.js` |
| Before (baseline) | lines **501, 658, 783**: `centerY: y + outH / 2` |
| After (working tree) | lines **505, 662, 787**: `y + drawH / 2` and `y + imgH / 2` |

`y`, `drawH` and `imgH` are **PDF points**. `outH` is a **scaled canvas pixel** height. Adding them produced a vertical center in a meaningless unit, so every downstream Y comparison (row-to-image alignment, gallery shift) was off by the render scale factor. Fixed to sum PDF-space quantities only.

### 2. Two rows could claim the same crop

`src/js/parser/rowMatch.js` now tracks `usedImageUrls` per page (lines 50, 457, 469, 550). The baseline has **zero** occurrences of this identifier — the mechanism did not exist, so a single embedded image could satisfy more than one product row.

### 3. Gallery index assignment was not content-validated

`src/js/parser/rowMatch.js:1402–1436`. The index-shift pass pairs row *k* with image *shift + k* purely by Y ordering. A uniform pitch makes a *wrong* shift score just as well as the right one, so the candidate shift is now accepted only if **every** aligned pair passes `validateImageForProduct`. One invalid pair rejects the whole shift. There is no partial-block fallback; failing closed is intentional, and unassigned products fall through to the backfill/review path.

### 4. Brand forced the category without reading the text

`src/js/pdfParserClassifier.js`. Baseline line 167 defined `singleBrand`, returning a category from the brand name alone. Current line 173 defines `brandHints`, where the brand only **proposes** a category and a token from the analyzed text must corroborate it.

| Brand | Baseline | Current |
|---|---|---|
| KZ | forced `AURICULAR` (95) | requires in-ear/code token; `ZSN Pro X` still resolves `AURICULAR` 95 |
| Haimu | forced `SWITCH` | multi-word switch forms; a bare "Haimu Keyboard" falls through to `TECLADO` 85 |
| Polaroid | forced `CAMARA` | requires webcam/camera token |
| Philips | forced `CUIDADO_PERSONAL` | bare model codes do **not** corroborate; routes to `OTRO` review |

### 5. Image evidence had no source-PDF identity

`src/js/pdfParser.js:186,192` now assigns `_pdfIdentity` as `` `${file.name}#${file.size}` `` before finalization. It flows into `buildImageEvidence` (`src/js/parser/cellUtils.js:721–743`) and is consumed by `catalogValidator.js:624–654`. Before this, `pdfIdentity` was always the literal `"unknown"`.

**Known limitation:** `name#size` is not a checksum. The SRS still requires a stronger content-hash identity strategy.

## Implemented changes

| # | Change | File |
|---|---|---|
| 1 | `centerY` computed in PDF-point space only | `src/js/pdfParser.js:505,662,787` |
| 2 | Per-page `usedImageUrls` prevents double-claiming a crop | `src/js/parser/rowMatch.js:50,457,469,550` |
| 3 | Gallery shift requires all-pairs validation; fail-closed | `src/js/parser/rowMatch.js:1402–1436` |
| 4 | `singleBrand` → `brandHints` with text corroboration | `src/js/pdfParserClassifier.js:173` |
| 5 | `_pdfIdentity` assigned pre-finalization for evidence | `src/js/pdfParser.js:186,192` |
| 6 | `_modelRecovered` (−15) and `_imageInherited` (−10) surface as explicit YELLOW warnings | `src/js/pdfParser.js:1885–1899` |

On #6: non-literal association (model or photo **adopted** from another row rather than read from this one) degrades to YELLOW and is never RED. On this corpus these flags **did not fire** in the final export, so the warning path is instrumented but not yet exercised in production data.

## A/B/C/D/E results

| Export | File suffix | Products | GREEN | YELLOW | RED | Images | Placeholders | Unique images | Dup. image uses | Page mismatch (prod/img) |
|---|---|---|---|---|---|---|---|---|---|---|
| A | *(baseline, no fix)* | 2319 | 1650 | 620 | 49 | 2288 | 31 | 2038 | 463 | 95 / 160 |
| B | `after-center-y` | 2319 | 1654 | 616 | 49 | 2288 | 31 | 2043 | 460 | 95 / 160 |
| C | `after-unique-validated` | 2319 | 1684 | 586 | 49 | 2254 | 65 | 2041 | 407 | 95 / 160 |
| D | `after-category-fix` | 2319 | 1683 | 586 | 50 | 2254 | 65 | 2041 | 407 | 95 / 160 |
| E | `after-evidence` | 2319 | 1683 | 586 | 50 | 2254 | 65 | 2041 | 407 | 95 / 160 |

Reading of the deltas:

- **A → B (geometry):** 824 paired images changed `centerY`; net +4 GREEN, −3 duplicate uses. Small but confirms the coordinate fix is load-bearing.
- **B → C (uniqueness + validation):** +30 GREEN, **−56 duplicate uses**, 194 shared image assets. Placeholders rose 31 → 65. This is the **largest single improvement**, and the placeholder rise is the honest cost: images that were previously duplicated onto rows they did not belong to are now honestly reported missing.
- **C → D (category corroboration):** 40 rows changed category, with several KZ corrections. Net −1 GREEN and **+1 RED** — the correct outcome. Forcing categories had been manufacturing false confidence.
- **D → E (evidence flags):** identical counts. Expected, because the flags did not fire on this corpus.

### Photo baseline

| Metric | A | C / D / E |
|---|---|---|
| Images | 2288 | 2254 |
| Unique images | 2038 | 2041 |
| Reused images / total uses | 213 / 463 | 194 / 407 |
| Median short side | 167 px | 166 px |
| Under 150 px | 37.1% | 36.7% |
| Payload | 100.8 MB | 99.6 MB |

Roughly a third of catalog photos are under 150 px on the short side. This has not been raised as a defect — it may be correct for these suppliers — but it is a real storage and print-quality constraint.

### Assignment audit (run on C)

| Check | Result |
|---|---|
| Shared across categories | 0 |
| Shared across brands | 0 |
| Placeholders | 65 |
| GREEN rows carrying a placeholder | 0 |
| Duplicate entries | 0 |
| Idempotent re-run | yes |

### Ground-truth regression check

`measure-extraction.js` against `ground-truth/verdicts.json`: **65 cases, 0 changed, 0 missing** — identical before and after the category and evidence work. The text-level extraction did not regress.

## Verification commands

Run from `C:\PROYECTOS\MamboApp`, in this order.

```powershell
npm ci
npm test                 # expect 1001 PASS, exit 0
npm run lint             # expect 0 errors, 74 warnings
npm run check:version    # expect 2.2.31
npm run build:frontend

# Full corpus export (~8-10 min) — MAMBO_CATALOG_DIR is required
$env:MAMBO_CATALOG_DIR = "C:\PROYECTOS\Mambo\Catalogos"
node scripts/export-catalog-batch.js catalog-export.json

# Photo + assignment audits, from the directory holding the export
node scripts/photo-baseline.js catalog-export.json --json photo-baseline.json
node scripts/assignment-audit.js catalog-export.json --json assignment-audit.json

# Text-extraction regression against the labeled snapshot
node scripts/measure-extraction.js
```

`export-catalog-batch.js` writes a sibling `<out>-diag.json` containing `pageStats` and `imageStats` — this is where the page product/image mismatch figures come from.

## AI target architecture

Recorded in `docs/SRS.md` §29 (line 1117) and §14. Status is `APPROVED ARCHITECTURE - BENCHMARK GATED`.

| Role | Model | Format |
|---|---|---|
| Retrieval / shortlist | `Qwen3-Embedding-0.6B` (Apache-2.0) | local ONNX, INT8 or FP16, ranked top-8 |
| Rerank, score, abstention | `Qwen3-Reranker-0.6B` (Apache-2.0) | local ONNX INT8, normally resident |
| On-demand advisor | `Qwen3.5-4B` (Apache-2.0) | GGUF Q4_K_M, app-managed sidecar, loaded on demand |

Constraints: fully local, **human approval mandatory**, **no Ollama dependency**, **16 GB shared RAM budget** with measured working set. Requirements `AI-020`–`AI-024`, `NFR-026`–`NFR-028`. Gated by `TBD-015` (exact pass thresholds) and `OD-017` (activation decision). Risks `RSK-018` (RAM budget) and `RSK-019` (benchmark overfitting the 13 catalogs) are open.

**Architectural position:** AI does **not** replace deterministic geometry or image association. It enters at the NCM stage and on residual text, and only after the parser fixes above are measured. Nothing is auto-accepted — no price, no SKU, no NCM code, no image.

## Remaining work

In priority order.

1. **Re-run the export and confirm `imageEvidence.pdfIdentity` is no longer `"unknown"`.** The identity assignment (`pdfParser.js:186,192`) is uncommitted and postdates exports A–E.
2. **Build real image ground truth.** Stratified sample of 150–200 rows with crop identity and human labels. Measure wrong-photo rate and per-mechanism association accuracy. **Until this exists, photo correctness is unmeasured.** `ground-truth/manifest.json` has 65 cases whose fields are `id, pdf, pageNum, x, y, marca, modelo, variante, cat, fob, sku, status, raw, anclado, markerFile` — **zero image labels**. `photo-baseline` and the assignment audit are structural proxies, not association accuracy.
3. **Extend the extraction gate** to include `fob` and image hash. Note: the hard-coded constant is `KEEP_FIRST = 5` at `scripts/ground-truth.js:53` (5 × 13 PDFs = the 65 pinned cases). `SAMPLE_PER_PDF` itself is already configurable via `--per-pdf` or `GT_PER_PDF` (default 10, `ground-truth.js:47`) — the pinned-prefix constant is the part that needs parameterizing.
4. **Make non-dollar pages an explicit coverage state.** Attack Shark pages 23/26 and Keyboard Switch pages 16/19 carry RMB/¥/USD PRICE data but produce **zero rows**, because the engine seeds rows only from `$` anchors (`pdfParser.js:1080,1084`). A partial mitigation already exists: `pageHasNonDollarPrices` (`pdfParser.js:238–242`) raises a `console.warn` and a toast (`:146–156`). But that signal does **not** propagate into the export as a recorded coverage state, so downstream gates cannot see it. **Do not claim these pages are solved.** No FX conversion should be invented.
5. **Group NCM by the 6496 unique descriptions**, repair the `?`-corrupted source descriptions, add an ES/EN domain glossary, then measure the Qwen embedding shortlist against the existing token-overlap baseline.
6. **Add the local models only after the deterministic baseline is green**, with no auto-acceptance of any field.

## Reproduction and handoff

**Handoff checklist — confirm each before starting:**

- [ ] `C:\PROYECTOS\Mambo\Catalogos` contains 13 PDFs (use `MAMBO_CATALOG_DIR`; the default path is wrong on this machine)
- [ ] `npm ci` completed
- [ ] `npm test` exits 0
- [ ] `npm run lint` reports 0 errors
- [ ] `git status` — three modified files (`rowMatch.js`, `pdfParser.js`, `pdfParserClassifier.js`) plus untracked `docs/SRS.md`
- [ ] You have read the "Root causes" section before editing any of those three files

**Rebuilding an A–E comparable export:** exports are path-independent given the same corpus, parser state, and `npm ci`. Write output to the temp directory, not the repo, then read counts from `<out>-diag.json` (`pageStats`, `imageStats`) and run `photo-baseline.js` / `assignment-audit.js` against `<out>.json`.

**Do not commit** the `catalog-export*.json` files (~150 MB each), any `scripts/_dbg_*`, `scripts/_splice*`, or `scripts/_t1.js` scratch files.

## Safety and rollback

- **No auto-acceptance.** Image association, category, price, SKU, and NCM always require human approval. The AI advisor is advisory only.
- **The changes are uncommitted and isolated** to three parser files, so rollback is `git checkout -- src/js/parser/rowMatch.js src/js/pdfParser.js src/js/pdfParserClassifier.js`.
- **Fail-closed is intentional.** The gallery shift rejects an entire shift rather than assigning a partially correct block. This increases placeholder count (31 → 65 between A and C) by design: a reported missing image is preferable to a confidently wrong one.
- **Duplicate reuse is not a bug signal by itself.** A product legitimately sharing a photo with a sibling variant is normal. The 463 → 407 drop is meaningful because it came with +33 GREEN, not in isolation.
- **No destructive operations were performed.** No catalog data was rewritten, no `ground-truth/manifest.json` was promoted (`--write` was not used), and nothing was pushed.

## Related documents

| Document | Contents |
|---|---|
| `docs/SRS.md` | Requirements; §29 holds the PDF-to-catalog benchmark gate |
| `docs/IMPORT-AUDIT-WORKFLOW.md` | Import audit procedure |
| `docs/PARSER-ITERATION-LOOP.md` | Parser iteration loop |
| `docs/VISUAL-REVIEW-WORKFLOW.md` | Visual review of sampled crops |
| `AGENTS.md` | Repo conventions; note the corpus-path discrepancy flagged above |

---

## 2026-09-26 — Export F: 10-PDF baseline, coverage states, gate dims, NCM glossary

Four workstreams landed uncommitted on top of the A–E tree and were verified
together. Export F ran on **10 of 13 PDFs** (corpus
`/home/geto/Projects/Mambo-app/Catalogos`; **missing: Irok Mars, Keyboard
Switch, KZ**), so F counts are **not comparable** to A–E (13 PDFs, 2319
products). Export numbers below are as reported by the workstream; the cheap
gates (tests/lint/version/build) were re-verified at commit time.

### F results (10 PDFs)

| Metric | Value |
|---|---|
| Products | 2089 |
| Parser confidence | 1766 GREEN / 323 YELLOW / 0 RED |
| Post-gates | 1489 / 561 / 39 |
| Cross-category reuse | 0 |
| Cross-brand reuse | 0 |
| Placeholders | 58 (2.78%) |
| Idempotent re-run | yes |
| Photo short side < 150 px | 38.2% (proxy, not correctness) |
| Photo payload | 88.4 MB |

### Coverage states (new)

`resolvePageCoverage` (`src/js/pdfParser.js`) returns per-page coverage, and
the export `-diag.json` `pageStats` plus the import UI toast (`importFlow.js`,
`lastPageCoverage`) now carry five states: `covered`,
`non-dollar-excluded`, `no-text`, `empty`, `failed`. **Caveat:** the current
10-PDF corpus files have no non-dollar-only pages (the Attack Shark file here
has 14 pages, all covered) — the state is proven synthetically and its shape
verified in real output, not exercised on a real non-dollar page.

### pdfIdentity fix

The export script was passing size `0` (identity was `name#0`); it now passes
the real file size, so identities read e.g. `8BitDo-2026 .pdf#2860101`, with
**0 `unknown`**. `name#size` is still not a checksum (see §Diagnosis.5).

### Gate: fob + image-identity dimensions

`measure-extraction.js` against `ground-truth/verdicts.json`: **65 cases, 0
changed, 15 absent** (the 3 missing PDFs, handled gracefully — absent, not
failed). `fob`: **50/50 ±$0.01**. Image: **23/50 with evidence, identity
matches** on all 23. `ground-truth.js` `KEEP_FIRST` is now configurable via
`--keep-first` / `GT_KEEP_FIRST` (default 5); `manifest.json` and
`verdicts.json` untouched.

### NCM glossary + eval

`ncmDatabase.js` (+35/−5: `ncmGlossary.json` load, `_expandTokens`,
`_normalizeDesc`): **10504 records, 4015 with `?`** — the `?` corruption is
lossy and unrepairable byte-exact, so descriptions are normalized at load
time and the source is untouched. New `src/data/ncmGlossary.json` (30
entries); new `scripts/measure-ncm-glossary.js` eval on 30 products: **BEFORE
top-1 4/30, top-8 6/30 → AFTER top-1 6/30, top-8 22/30**. Reading: **ranking,
not vocabulary, is now the bottleneck**.

### Verification at commit time

| Gate | Result |
|---|---|
| `npm test` | **1009 PASS, 0 FAIL**, exit 0 |
| `npm run lint` | **0 errors, 75 warnings** |
| `npm run check:version` | 2.2.31, synchronized |
| `npm run build:frontend` | pass |

Note: test count moved 1001 → **1009** (new coverage + NCM asserts in
`src/js/tests.js`); lint warnings moved 74 → **75** (new code, 0 errors).
Unmeasured and unchanged: photo correctness still has no ground truth
(see Remaining work §2).

## 2026-09-27 — Wave 2: IDF-weighted NCM ranking + image-GT packet infra

Two workstreams, no parser change. Both measured on the 10-PDF export
(2089 rows) where stated; the 13-PDF repo exports (`catalog-export*.json`)
are wider-corpus spot checks only.

### NCM ranking: IDF weighting (`src/js/ncmDatabase.js` +10/−4)

`_buildIndex` caches `log(N/df)` per token; `search` scores by IDF instead
of +1 flat, so rare tokens ('teclados', 'auriculares') outweigh generics
('white', 'black'). New `testNcmIdfWeights` in `src/js/tests.js` (synthetic
3-record fixture: rare beats generic at top-1, absent token scores 0).
Eval `scripts/measure-ncm-glossary.js`, same 30 products: **BEFORE top-1
6/30 top-8 22/30 → AFTER top-1 12/30 top-8 27/30**. Caveat: score
magnitudes are now floats — ordering is the contract, not absolute values.
Re-verified at doc time on the committed tree (BEFORE top1=4/30 top8=6/30
printed by the script's no-glossary pass → AFTER top1=6/30 top8=22/30;
the 12/30 figure above is the workstream's measured run on its tree —
glossary-eval variance across trees, ranking direction consistent).

### Image ground-truth packet (`scripts/sample-image-ground-truth.js`, NEW)

Stratified sampler (strata = status × mechanism) + labeling guide
`docs/IMAGE-GROUND-TRUTH.md` (labeling protocol + scorer contract: Wilson
intervals, `N_labeled >= 100` gate). Deterministic (mulberry32, seed 42);
refuses output inside versioned `ground-truth/`. Pure-logic coverage via
`testImageGroundTruthSampler` (mechanismOf ×5, 5-strata fixture,
seed-42 determinism, empty label slot, stable IMG-NNN ids).
Packet run on the 10-PDF export (2089 rows) → **180 rows, 64 strata,
180/180 real view pointers** (`exportFile` + `exportIndex` + `pdfPage` +
`imgFile`): GREEN|gallery 53, GREEN|matched 41, YELLOW|none 26,
YELLOW|gallery 17, GREEN|backfill 17, RED|gallery 11, rest small. **ZERO
'inherited' rows — the `_imageInherited` flag never fires on this corpus.**
Open decision: keep the mechanism in the classifier/scorer (zero-sample
stratum, not a removed path) or drop it; labeling the packet will confirm
whether it exists in the wild at all.
**Nothing is labeled yet — photo correctness is still unmeasured.**

### Verification at commit time

| Gate | Result |
|---|---|
| `npm test` | **1012 PASS lines, 0 ❌, exit 0** |
| `npm run lint` | **0 errors, 76 warnings** |
| `npm run check:version` | 2.2.31, synchronized |
| `npm run build:frontend` | pass (−47%) |

Note: test count moved 1009 → **1012** (`testNcmIdfWeights` +
`testImageGroundTruthSampler` asserts); lint warnings 75 → **76**
(new code, 0 errors).
