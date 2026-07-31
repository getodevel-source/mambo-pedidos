# Proposal: Catalog Quality Validation

## Intent

Catalog quality is not an auditable contract: free-text R1–R10 warnings, Node-only PDF checks, mocked spreadsheet I/O, inline-image storage, non-durable SKU repair, and version-only updater checks leave imports, migrations, and release trust unproven. Establish evidence-backed validation without rewriting extraction or runtime boundaries.

## Desired Outcomes

- Stable, machine-verifiable R1–R10 evidence across PDF, spreadsheet, persistence, and UI paths.
- Safe, reversible migrations and trusted signed-update evidence.

## Scope

### In Scope

Seven independently reviewable slices, shared fixtures/contracts, tests, migration receipts, rollback evidence, and dependency coordination.

### Out of Scope

OCR; new LLM/provider or parser rewrite; cloud image sync; pricing/IVA/logistics redesign; manual vendor correction; unsigned updater fallback, signature bypass, secrets, or release publication.

## Capabilities

### New Capabilities

- `catalog-quality-contract`: stable R1–R10 codes, severity, importability, and fixtures.
- `tauri-pdf-image-import`: WebView Canvas and image-association evidence.
- `spreadsheet-physical-roundtrip`: physical CSV/XLSX round-trips for both routes.
- `catalog-image-storage`: SKU-independent references and legacy migration.
- `historical-sku-audit-migration`: catalog/history/selection audit and mapping.
- `signed-updater-release-smoke`: signature, install, restart, and tamper evidence.
- `ui-persistence-e2e`: import, traffic lights, images, reload, and fallback.

### Modified Capabilities

None.

## Approach

Freeze the contract first. Then run PDF, spreadsheet, and updater slices in parallel where possible; follow with image storage, SKU migration, and UI/persistence E2E: `1 → (2,3,6) → 4 → 5 → 7`. Keep tests with behavior and preserve existing frontend/Tauri boundaries.

### Product Decisions for Downstream Specs

Recommended defaults are **assumptions pending product approval**:

- Missing images remain reviewable/importable as YELLOW, never GREEN; they are not hard-blocking.
- Duplicate normalized identities receive globally unique row SKUs while retaining normalized identity for grouping; no automatic merge.
- Check in small sanitized PDF/CSV/XLSX fixtures for local/CI; use a pinned manifest and environment-gated external full-corpus/signed-release assets. No secrets or generated installers in Git.

### Evidence and Rollback Gates

Image/SKU mutation requires a read-only audit, backup, deterministic mapping, idempotent receipt, atomic commit, restore test, and failure rollback; SKU migration waits for stable image references. Updater work requires disposable data, configured-key verification, tamper rejection, restart/data-preservation evidence, external secrets, and opt-in CI.

### Review-Budget Strategy

Forecast 150–380 authored changed lines per slice within the 400-line budget; chain image/E2E sub-slices if needed; never combine image and SKU migrations. Generated installers are excluded from authored-risk count.

## Affected Areas

`src/js/{catalogValidator,pdfParser,aiCatalogEngine,fileImporter,storage,skuAllocator,app}.js`, `src-tauri/`, `src/index.html`, `scripts/`, `.github/workflows/release.yml`.

## Risks

WebView/fixture divergence, persistence loss, updater flakiness, and dirty-baseline attribution; mitigate with deterministic fixtures, disposable data, evidence gates, and clean-worktree verification.

## Rollback Plan

Revert slices independently; restore the pre-migration backup and receipt mapping before re-enabling dependent slices.

## Dependencies

Product decisions above; representative fixtures; stable signed metadata; clean baseline; existing npm, Rust, version, and build checks.

## Success Criteria

- [ ] Every R1–R10 group and slice gate passes mechanically.
- [ ] Import, migration, updater, and reload evidence is reproducible and rollback-documented.
