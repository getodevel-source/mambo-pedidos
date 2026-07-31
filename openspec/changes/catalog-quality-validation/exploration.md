## Exploration: catalog-quality-validation

### Current State

**System shape and data flow**

- The application is a Tauri 2 desktop shell around a static HTML/vanilla-JavaScript frontend. `src/index.html` loads PDF.js, PapaParse, SheetJS, and the project modules directly; `src/js/app.js` is the workflow coordinator.
- PDF catalog imports enter through `app.js:processFiles`, call `PdfParser.processPdfFile`, and then pass through `TextSanitizer`, `SkuAllocator`, and `CatalogValidator` before the import-preview modal. Confirmed rows are written to `AppStorage.saveCatalog`.
- `PdfParser.processPdfFile` reads a browser `File`, extracts text and page geometry, calls `extractImagesFromPage`, associates images with table/grid products, optionally enriches cell text through `LocalLlm`, and finalizes products. The native Rust side is not involved in the PDF path beyond hosting the WebView.
- Catalog images are currently inline data URLs on each product (`img`). `AppStorage` writes the complete catalog object to Tauri Store key `mambo_catalog_v2`, falling back to JSON in LocalStorage. `AppStorage.loadCatalog` normalizes records, remaps selection by the previous SKU list, allocates SKUs, and revalidates, but it does not persist a migration receipt or a repaired catalog automatically.
- CSV/XLSX catalog files use `AiCatalogEngine.processSpreadsheetWithLocalAI` through `processFiles`; the deterministic `FileImporter.processCsvFile`/`processExcelFile` path is used by the separate `fileInputPedido` order-import flow. `FileImporter.exportCSV` and `exportXLSX` export order rows, but no test writes a physical file and reads it back.

**Baseline evidence collected from the current worktree**

- `npm test`: **110/110 passing**. The suite is a custom Node harness (`scripts/run-tests.js`) with mocked DOM, LocalStorage, PapaParse, and SheetJS objects.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **4/4 passing**. Rust coverage is limited to catalog-entry/order command unit tests; there is no native PDF, image-store, updater, or migration test.
- `npm run check:version`: passes. It checks version synchronization and updater URL shape, not cryptographic signatures or a download/install flow.
- `node scripts/test-spatial-import.js`: processes **13 real PDFs**, extracts **2,532 products**, and reports **10 aggregate quality flags**. It uses `pdfjs-dist` in Node and explicitly passes an empty image list because Canvas is unavailable; it is not a Tauri/WebView test.
- `node scripts/test-catalog-batch.js`: processes **13 real PDFs / 2,441 products**, reports **2,441 observations**, and exits non-zero. Its browser mock returns no Canvas context and its module list omits `skuAllocator.js`, so the reported rows have blank SKUs and missing images. This is a harness baseline gap, not evidence that the production Tauri path has been exercised.
- There is no Playwright, Cypress, Selenium, WebDriver, or equivalent project E2E setup. There is no coverage, linter, type checker, or formatter configured.
- The repository was already dirty before this exploration: feature files are modified and `openspec/` plus several test/support files are untracked. The baseline must be treated as a snapshot of the current worktree, not as a clean-branch regression result.

**PDF image import and native boundary**

- `src/js/pdfParser.js:193-357` walks PDF.js operator lists, waits asynchronously for `page.objs.get`, paints RGB/RGBA/gray image buffers to a Canvas, removes light backgrounds, rejects nearly empty images, compresses large images, and emits data URLs with page/position/color metadata.
- The grid and table engines (`pdfParser.js:626-1033`) apply positional gates and visual validation before assigning an image. The global matcher (`pdfParser.js:1626-1713`) de-duplicates images, applies distance/direction gates, and assigns at most one image to a product.
- Tauri registers `tauri-plugin-store`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-updater`, and `tauri-plugin-process` in `src-tauri/src/lib.rs`. The current PDF flow does not call a Rust command. `src-tauri/capabilities/default.json` grants core, filesystem, dialog, and store permissions; updater/process permissions are not listed explicitly and must be verified in a runtime smoke test rather than inferred from plugin registration.
- The existing Node harnesses cannot prove PDF.js image decoding, Canvas behavior, worker loading, or image-to-product association inside the Windows Tauri WebView. A real-PDF Tauri fixture/test boundary is therefore missing.

**The ten warning groups and current verifiability**

The current implementation has ten explicit per-item rule groups (`R1`-`R10`) in `src/js/catalogValidator.js`. The proposed contract should retain these as stable machine-verifiable groups, or explicitly rename/redefine them. The `totalChecks: 11` value and the separate statistical flags currently make the count ambiguous.

| Group | Current handling | Current evidence/gap |
| --- | --- | --- |
| R1 — finite, positive FOB | Critical violation, normally `RED`; Rust also checks non-positive and very high FOB values | Generic field/Rust tests exist, but no exhaustive `CatalogValidator` pass/fail fixture with a stable group identifier |
| R2 — model present and not noise/price/corporate text | Critical violation, `RED`; sanitizer tests cover selected strings | Real-PDF metrics detect short models, but there is no complete warning-group report across all source paths |
| R3 — category-specific price range/outlier | Out-of-range is critical; high-but-in-range and statistical IQR outliers are warnings/`YELLOW` | Batch evidence exposes category misclassification and outliers; direct boundary and statistical tests are incomplete |
| R4 — brand/category compatibility | `BRAND_LOCK` violations are critical, `RED` | Only locked brands are covered; generic brand/category coherence is not an independently reported group |
| R5 — recognized category | Empty/`OTRO` is critical, `RED` | Batch reports `cat=OTRO`; no stable code/count or exhaustive category fixture |
| R6 — recognized brand | Empty/`OTRO` is critical, `RED` | No dedicated group-level test or report |
| R7 — variant is not a numeric price | Warning, `YELLOW` when otherwise valid | Rule exists, but no dedicated negative/positive fixture or round-trip assertion |
| R8 — model and variant are not identical | Warning, `YELLOW` | Rule exists, but no dedicated fixture or persistence/round-trip assertion |
| R9 — valid product image | Missing/invalid image is a warning, blocks `GREEN`, and remains importable by default | Unit coverage proves `YELLOW`, but no real-PDF/Tauri image coverage; policy must decide whether missing image is reviewable or non-importable |
| R10 — literal FOB grounding | `grounded === false` is a warning; missing grounding evidence is critical; upstream status/warnings are preserved by `maxStatus` | Unit coverage exists for false/absent grounding and upstream `RED`; no end-to-end coverage across PDF, spreadsheet, persistence, and UI |

`CatalogValidator.validateCatalogStats` adds price-IQR and minority-category flags outside R1-R10. Warnings are currently free-text strings; `CRITICAL_RULES` is declared but not used as the authoritative classification mechanism. Every future warning group should emit a stable code, severity/status, evidence fields, user-facing reason, importability outcome, and aggregate count so that all ten groups can be mechanically asserted without matching localized prose.

**Persistence and historical data constraints**

- The only explicit schema is the key naming (`mambo_catalog_v2`, `mambo_historial_v2`, `mambo_brands_v1`) plus ad-hoc item fields. There is no schema-version envelope, migration ledger, backup/rollback protocol, or image-reference namespace.
- `SkuAllocator.allocateBatch` is deterministic and handles source-SKU collisions when identities differ. `loadCatalog` calls it with the loaded rows as the batch and an empty `existing` set; it can normalize/generate in memory, but it does not make the migration durable. Repeated identical identities intentionally reuse one identity SKU, which must be reconciled with the requirement that every catalog row have a globally unique SKU.
- `mambo_historial_v2` stores order snapshots that contain SKUs, while `selection` is keyed by SKU. Any historical SKU migration must produce a deterministic old-to-new mapping and update or preserve order/selection references atomically. Image references must not be keyed in a way that makes SKU migration orphan images.
- Inline data URLs make the primary catalog payload large and couple image quota failures to catalog saves. Tauri Store and LocalStorage have different capacity/error behavior. `src-tauri/src/lib.rs:get_app_data_dir` and the filesystem plugin provide a possible app-data image boundary, but no image-file API or garbage-collection policy exists today.

**Updater and release configuration**

- `src/js/updater.js` invokes the official Tauri updater IPC commands for check and download/install, displays plain-text release notes, and has no unsigned-download fallback. `src-tauri/src/lib.rs` registers the updater and process plugins.
- `src-tauri/tauri.conf.json` points to the GitHub `latest.json` endpoint and embeds a public key. `.github/workflows/release.yml` builds Windows, Linux, and macOS artifacts through `tauri-apps/tauri-action@v0`, requires signing secrets, and runs version/JS/Rust checks before building. It does not run an updater smoke test or a negative signature test.
- The checked-in `latest.json` for v1.7.1 has `PLACEHOLDER_*_SIG` values. The live GitHub v1.7.1 release (published 2026-07-30) has a generated `latest.json` with non-placeholder signatures plus `.sig` sidecar assets for AppImage, deb, and Windows artifacts. This proves a real release fixture is available, but no project test has exercised Tauri check → signed download → verification → install → restart against it.
- `scripts/build-signed.bat` requires signing-key environment variables and refuses to build without them, which is correct for local safety. No signing key may be committed or used by a test.

### Affected Areas

- `src/js/pdfParser.js` — PDF text/layout extraction, Canvas image extraction, visual validation, image matching, and product finalization.
- `src/js/app.js` — import routing, preview/status selection, catalog confirmation, image replacement, startup restore, file inputs, and persistence calls.
- `src/js/catalogValidator.js` — the R1-R10 quality contract, traffic-light status, importability, upstream-warning preservation, and catalog-level statistics.
- `src/js/aiCatalogEngine.js` — the active CSV/XLSX catalog-ingestion path and grounding/fallback behavior.
- `src/js/fileImporter.js` — deterministic order CSV/XLSX import and browser download/XLSX export behavior that must be physically round-tripped.
- `src/js/storage.js` — Tauri Store/LocalStorage abstraction, item normalization, selection remapping, and the future schema/image migration boundary.
- `src/js/skuAllocator.js` — global identity/SKU normalization, collision allocation, and deterministic historical mapping behavior.
- `src-tauri/src/lib.rs` — plugin registration, app-data command, updater/process command boundary, and the current Rust unit-test surface.
- `src-tauri/tauri.conf.json` and `src-tauri/capabilities/default.json` — WebView/static-dist configuration, updater public key/endpoint, and native permission coverage.
- `.github/workflows/release.yml`, `latest.json`, `scripts/build-signed.bat`, and `scripts/bump-version.js` — signed release production, metadata, local signing guardrails, and the current version-only validation.
- `scripts/run-tests.js`, `src/js/tests.js`, `scripts/test-spatial-import.js`, and `scripts/test-catalog-batch.js` — current unit/integration harnesses and their browser/Canvas/SKU limitations.
- `src/index.html` — vendor loading order, file inputs, import/export controls, and the UI surface that an E2E harness must drive.
- `openspec/config.yaml` — strict TDD, hybrid artifact persistence, warning-group verifiability, migration/release rollback rules, and the 400-line review budget.

### Approaches

1. **One cross-cutting change** — implement all seven quality scopes, migrations, release validation, and E2E coverage under `catalog-quality-validation`.
   - Pros: one umbrella acceptance gate; fewer inter-change coordination points.
   - Cons: couples unrelated native, persistence, release, and test-harness risks; likely exceeds 400 authored changed lines by several multiples; makes rollback and review attribution difficult; a failed updater or migration test blocks unrelated import work.
   - Effort: High

2. **Subsystem changes with a shared quality contract** — first define stable R1-R10 warning codes and fixtures, then implement PDF/Tauri, spreadsheet, persistence, SKU migration, updater, and E2E as separate changes.
   - Pros: each change has one primary risk and an independently verifiable acceptance gate; image/SKU migrations can carry explicit rollback plans; updater validation can use a real release without touching catalog behavior.
   - Cons: requires dependency sequencing and temporary compatibility contracts; persistence and E2E changes will need coordinated schema fixtures.
   - Effort: Medium/High

3. **Recommended chained delivery: characterization first, then seven bounded slices** — use `catalog-quality-validation` as the exploration/proposal umbrella, deliver the warning contract first, run PDF, spreadsheet, and updater work as parallel slices where possible, then image storage, SKU migration, and finally UI/persistence E2E.
   - Pros: preserves the 400-line review budget, front-loads measurable behavior, limits migration blast radius, and leaves a clean rollback point before destructive persistence changes.
   - Cons: more release coordination and temporary adapters; the final E2E slice depends on stable contracts from the earlier slices.
   - Effort: High overall, Low/Medium per slice

### Recommendation

Use multiple independently reviewable changes, with `catalog-quality-validation` as the umbrella proposal and the following dependency order:

1. **`catalog-quality-contract`** — freeze the ten warning groups, stable machine codes/severity/importability semantics, representative pass/fail fixtures, aggregate reporting, and the distinction between reviewable missing images and hard rejection. Do not redesign extraction in this slice.
2. **`tauri-pdf-image-import`** — add a Tauri/WebView harness that imports representative real PDFs from the catalog corpus, asserts image decoding/Canvas behavior, verifies image-to-product association, and records the no-image/invalid-image outcome. Keep image persistence inline for this characterization slice.
3. **`spreadsheet-physical-roundtrip`** — create physical CSV and XLSX files in a temporary directory, export through the real browser-compatible path or a testable adapter, re-read with the real parsers, and assert SKU, category, brand, model, variant, FOB, quantity, costs, and IVA semantics. Explicitly test both the order `FileImporter` path and the catalog `AiCatalogEngine` routing decision; do not silently test only mocked objects.
4. **`catalog-image-storage`** — introduce an image reference/file-store contract, move images out of catalog records, migrate legacy inline data URLs with a backup and idempotent receipt, define missing/orphan/garbage-collection behavior, and keep rendering/import behavior compatible. Use a stable image identifier independent of SKU.
5. **`historical-sku-audit-migration`** — produce a read-only audit first, then a deterministic, durable migration for legacy/missing/duplicate/colliding SKUs, including `mambo_historial_v2` and selection references. Require a mapping receipt, backup, idempotence, and rollback before mutating persisted data. Run after the image-reference schema is stable so SKU changes cannot orphan images.
6. **`signed-updater-release-smoke`** — pin a real signed GitHub release (v1.7.1 can be the initial fixture), verify the live metadata/artifact/signature relationship with the configured public key, exercise Tauri check/download verification on a disposable install, assert preservation of app data across restart, and prove a tampered signature is rejected. Keep secrets outside the repository and keep this test opt-in or environment-gated for CI.
7. **`ui-persistence-e2e`** — add a Tauri-capable UI harness covering PDF/spreadsheet selection, preview traffic lights, warning details, confirmation/rejection behavior, image rendering, reload persistence through Tauri Store, and the LocalStorage fallback. Run after the contract and persistence migrations are stable.

**Review-budget path**

- Forecast each implementation slice at roughly **150-380 authored changed lines**, excluding binary/generated release assets. Keep tests and the behavior they prove in the same slice.
- If the image-store migration exceeds the budget, chain it as `image-reference-adapter` → `legacy-inline-image-migration` → `orphan-cleanup`, with each slice independently reversible.
- If the E2E bootstrap plus scenarios exceeds the budget, chain `e2e-harness-bootstrap` → `catalog-import-e2e` → `persistence-and-updater-e2e`.
- Do not combine image storage and SKU migration in one review: both touch persistence but have different rollback and data-integrity failure modes.
- Do not include a real signing key, a committed user catalog, or generated installers in authored review lines. Use a fixture manifest and external/CI-provided release assets.

**Explicit non-goals for this quality scope**

- No OCR implementation for scanned/image-only PDFs; the current parser explicitly rejects those and OCR should be a separate change.
- No new LLM provider, vision model, prompt redesign, or wholesale parser rewrite.
- No cloud image CDN, account sync, or remote catalog storage; the image store remains local to the Tauri app.
- No redesign of pricing, IVA, logistics, order calculations, or user-facing Spanish copy beyond the quality evidence needed by the tests.
- No manual correction of every vendor PDF or treating the current Node batch output as a production-quality verdict; the migration must be deterministic and auditable.
- No unsigned updater fallback, signature bypass, committed secrets, or release publication as part of exploration.

**Guard lines for downstream task planning**

Decision needed before apply: Yes

Chained PRs recommended: Yes

400-line budget risk: High

### Risks

- **WebView/PDF.js divergence:** Canvas, `page.objs` timing, worker paths, and image decoding can differ between Node and Windows WebView. A passing Node parser test cannot substitute for a Tauri-hosted real-PDF test.
- **Fixture portability:** `C:\Mambo\Catalogos` is a machine-local corpus and is not currently part of CI. The proposal must define a checked-in small representative fixture, a secure fixture-artifact download, or an explicit environment-gated full-corpus audit.
- **Quality-contract ambiguity:** `R1-R10` is inferred from the current validator, but `totalChecks` says 11 and statistical flags are extra. The proposal must freeze the canonical ten groups and decide whether missing images are reviewable/importable or hard-blocked.
- **Warning stability:** Free-text warning arrays are difficult to assert across Spanish copy, sanitizer passes, persistence reloads, and exports. Without stable codes, “all ten groups verified” will remain a brittle text-matching claim.
- **Persistence migration loss:** Image extraction, SKU remapping, order history, selection, LocalStorage quota, and Tauri Store failures can leave partial state or orphaned data. Backup, atomic commit, idempotence, and rollback are mandatory.
- **SKU identity ambiguity:** `SkuAllocator` reuses a SKU for equal normalized identity while the requirement says global uniqueness. The proposal must define whether equal identities merge, represent one canonical product, or receive distinct row SKUs.
- **Release trust gap:** The live v1.7.1 release has real signatures, while the checked-in metadata has placeholders. Network availability, platform artifact selection, updater permissions, and restart behavior must be tested without exposing signing secrets.
- **E2E flakiness and side effects:** Auto-update and live dollar/LLM checks run during startup. E2E needs deterministic network interception/disablement, disposable app data, and cleanup so tests cannot mutate a developer catalog or install an update unexpectedly.
- **Dirty baseline:** Existing modified/untracked files make attribution and regression review unsafe. Implementation should start from a clean worktree or explicitly preserve the current snapshot as a separate baseline.

### Ready for Proposal

Yes. The codebase, native boundaries, persistence constraints, release configuration, real-PDF harnesses, and baseline gaps are sufficiently mapped for `sdd-propose`. The proposal should preserve the seven-slice dependency order, record the three open policy decisions (missing-image importability, duplicate-identity SKU semantics, and fixture/release environment), and require rollback/evidence gates before any destructive migration or signed-update installation.
