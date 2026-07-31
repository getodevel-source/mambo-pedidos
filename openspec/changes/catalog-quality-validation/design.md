# Design: Catalog Quality Validation

## Technical Approach

Preserve the static HTML/vanilla-JS, browser-global/CommonJS, and Tauri 2 boundaries. Add evidence adapters around `app.js`, `PdfParser`, `AiCatalogEngine`, `FileImporter`, `CatalogValidator`, `AppStorage`, `SkuAllocator`, and `AppUpdater`; do not rewrite extraction. Order is `1 → (2,3,6) → 4 → 5 → 7`.

## Contracts and Decisions

`Evaluation` is `{code,severity,status,evidence:{observed,expected,source},reason,importability}`. Each row emits exactly R1–R10 with per-code minimum evidence (FOB/source, model/text, price/category/bounds, brand/category/rule, category/brand vocabulary, variant/parsed-number, model/variant, image reference/decode, grounding state/literal-source or absence reason). Critical failures R1–R6 and R10-absent-grounding are `CRITICAL/RED/REJECTED`; R10-false-grounding, R3(outlier), R7–R9 are `WARNING/YELLOW/IMPORTABLE`; passes are `PASS/GREEN/IMPORTABLE`. GREEN requires ten passes and no worse upstream status. Each `violationsByCode` value equals the count of non-GREEN evaluations for that code; all ten keys are always present (zeroes preserved); `reason` is always a non-empty user-facing string; `canonicalGroupCount:10`; statistical flags stay in `stats`.

`GateOutcome={status:"SKIPPED_ENVIRONMENT_GATED",gate,reason}` is the only result for absent `full-corpus`, `tauri-fixture`, `spreadsheet-external`, or `signed-release` gates; it is never a pass.

Non-goals remain: OCR; a new LLM/provider; parser rewrite; cloud image sync; manual vendor correction; pricing/IVA/logistics redesign; unsigned updater fallback; signature bypass; secrets; release publication. `AppStorage` remains Store→LocalStorage fallback. PDF keeps inline images until the image-storage gate; image and SKU migrations remain separate.

## Evidence Flows and Rationale

**Why adapters, not rewrite.** Existing modules are functionally correct; the gap is verifiability. Typed evidence wrappers make R1–R10 assertable without coupling unrelated risks or exceeding the review budget. **Why separate image/SKU migrations.** Different failure modes (blob orphaning vs. reference dangling); combined rollback would be ambiguous.

**PDF.** `User → app.js:processFiles → PdfParser(File) → PDF.js page.objs/Canvas → extractImages → matcher → CatalogValidator(R1–R10) → preview → saveCatalog`. Record `{pdfIdentity,page,imageFormat,width,height,sourcePosition,canvasDecode,productRowId}`. Canvas/workers/`page.objs` run in WebView, never Node. At-most-one association. Decode failure records evidence, discards preview. Inline images preserved until image-storage gate.

**Spreadsheet.** `Harness → write physical CSV/XLSX → processFiles routes by extension → AiCatalogEngine(catalog)|FileImporter(order) → parse with real PapaParse/SheetJS → compare SKU/category/brand/model/variant/FOB/qty/cost/IVA → clean temp`. Route/field failure names file+field; no mock fallback.

**Updater.** `TAURI_SIGNED_SMOKE=1 → manifest(metadata URL,version,platform,artifact,hash,public key) → check → download → verify(sig+hash) → install → restart → assert version+sentinel → cleanup`. Placeholder keys rejected. Tamper variants produce machine-readable rejection before install. Private keys/credentials/installers/user data stay external. Developer data untouched.

**Image migration.** `audit(inline/missing/duplicate/orphan) → backup → map(source→ImageRef|failure) → restore test → AP-3a → copy/resolve → atomic commit(catalog+files+schema+receipt) → verify`. Identical receipt is no-op. Failure restores all. Orphans visible, never auto-deleted. Missing rows stay R9 YELLOW; never invent images.

**SKU migration.** `audit(missing/duplicate/colliding/legacy × catalog/history/selection) → mapping → ambiguity block → backup → AP-3b → atomic commit → verify image refs unchanged → receipt`. Globally unique SKUs; normalized identity preserved without merge. Idempotent; failure restores backup.

**UI/E2E.** Select fixtures; show traffic lights + code/severity/status/evidence/reason/importability. RED rejects without persistence; YELLOW/R9 reviewable; GREEN has no failure. Tauri Store reload, then Store-failure injection with identical LocalStorage recovery. Intercept startup network/LLM/updater; disposable data; no developer mutation or installation.

## Seven Independently Reviewable Slices

| Slice | Scope/tests | Start → finish | Verification/rollback | Forecast |
|---|---|---|---|---|
| 1 Contract | R1–R10 fixtures, schema, aggregates, gate outcomes | baseline validator → contract JSON | `npm test`; revert adapter/tests | 150–220 |
| 2 PDF | separate Tauri WebView/Canvas/PDF evidence and R9 | slice 1 + approved/tauri fixture → evidence | WebView RED tests; discard preview | 180–320 |
| 3 Spreadsheet | separate physical CSV/XLSX catalog/order routes | slice 1 + approved files → round-trip | real-parser tests/temp cleanup; revert harness | 180–320 |
| 4 Image | refs, four audits, receipt, backup/restore/idempotence | 1–3,6 + AP-3a unresolved → approved commit | resolve/restore tests; restore blobs/catalog | 220–380 |
| 5 SKU | three-domain audit/mapping/commit | 4 + AP-3b unresolved → verified commit | uniqueness/reference tests; restore three domains | 220–360 |
| 6 Updater | signed ordered smoke and tamper recovery | 1 + signed gate → final sentinel | machine-readable rejection; delete disposable install | 160–300 |
| 7 UI/E2E | fixture UI, rejection/review, Store/fallback reload | 1–6 → isolated evidence | startup interception/cleanup; delete disposable data | 220–380 |

## Files, Interfaces, and Threat Matrix

Modify `src/js/{catalogValidator,pdfParser,aiCatalogEngine,fileImporter,storage,skuAllocator,app,updater}.js`, `src/index.html` (fixture file-input wiring and preview evidence display), `.github/workflows/release.yml` (opt-in signed-smoke job, environment-gated), Tauri config/permissions, and `scripts/run-tests.js`/`package.json`; add `scripts/quality/` fixtures/runners. Interfaces are `ImageRef={id,relativePath,mime,sha256,width,height}`, `MigrationReceipt` above, and `SkuMapping={rowIdentity,oldSku,newSku}`.

## Threat Matrix

| Boundary | Behavior |
|---|---|
| VCS/commit/push/PR | Not automated; no repository mutation |
| Tauri/process | Disposable app/data isolation; RED tests reject Node Canvas mocks, tamper, and developer-path mutation |

## Rollout and Open Questions

No product approval is granted. AP-1 (image policy), AP-2 (fixture/full-corpus policy), AP-3a (image apply), and AP-3b (SKU apply) remain unresolved; apply is blocked until their RED evidence passes. `Decision needed before apply: Yes`; `Chained PRs recommended: Yes`; `400-line budget risk: High`.
