# Tasks: Catalog Quality Validation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1330-2280 total (150-380 per slice) |
| 400-line budget risk | High (total), Low-Medium per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice 1) -> PR 2 (Slice 2) -> PR 3 (Slice 3) -> PR 4 (Slice 6) -> PR 5 (Slice 4) -> PR 6 (Slice 5) -> PR 7 (Slice 7) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Approval Gates (unresolved)

- **AP-1**: Missing/invalid images reviewable as YELLOW, never GREEN, not hard-blocking.
- **AP-2**: Small sanitized fixtures checked in; full-corpus uses env-gated manifest.
- **AP-3a**: Image migration blocked until audit, backup, receipt, restore test pass.
- **AP-3b**: SKU migration blocked until image refs stable, audit, mapping, restore test pass.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary | Est. lines |
|------|------|----|---------------------|-----------------|-------------------|------------|
| 1 | R1-R10 contract + fixtures | PR 1 | `npm test` (contract subset) | N/A - pure JS unit tests | `catalogValidator.js` adapter + `scripts/quality/contract-fixtures.json` | 150-220 |
| 2 | PDF WebView Canvas evidence | PR 2 | `npm test` (pdf-image subset) | Tauri WebView + sanitized PDF | `pdfParser.js` evidence adapter | 180-320 |
| 3 | Physical CSV/XLSX round-trip | PR 3 | `npm test` (spreadsheet subset) | N/A - physical file I/O in temp dir | `aiCatalogEngine.js` + `fileImporter.js` harness | 180-320 |
| 4 | Signed updater smoke + tamper | PR 4 | `npm test` (updater subset) | `TAURI_SIGNED_SMOKE=1` + manifest | `scripts/quality/updater-smoke.js` | 160-300 |
| 5 | Image refs + migration (AP-3a) | PR 5 | `npm test` (image subset) | AP-3a gated; backup/restore test | `storage.js` ImageRef + migration script | 220-380 |
| 6 | SKU audit + durable mapping (AP-3b) | PR 6 | `npm test` (sku subset) | AP-3b gated; 3-domain restore | `skuAllocator.js` mapping + receipt | 220-360 |
| 7 | UI/E2E persistence + fallback | PR 7 | `npm test` (ui-e2e subset) | Tauri WebView + Store-failure injection | `index.html` wiring + `app.js` | 220-380 |

## Slice 1: catalog-quality-contract (PR 1)

- [x] 1.1 **RED** Test: each row emits exactly R1-R10 `Evaluation{code,severity,status,evidence,reason,importability}`. Verify `npm test` fails. (~20 lines)
- [x] 1.2 **GREEN** Implement `Evaluation` adapter in `src/js/catalogValidator.js` wrapping existing rules with typed evidence per R1-R10 table. (~60 lines)
- [x] 1.3 **RED** Test: `violationsByCode` has exactly 10 keys, counts = non-GREEN per code, `canonicalGroupCount:10`, stats separate. (~15 lines)
- [x] 1.4 **GREEN** Implement aggregate in `catalogValidator.js`. (~30 lines)
- [x] 1.5 **RED** Test: absent full-corpus env gate -> `SKIPPED_ENVIRONMENT_GATED`, never pass. (~10 lines)
- [x] 1.6 **GREEN** Implement gate in `scripts/quality/gate.js`. (~20 lines)
- [x] 1.7 Add `scripts/quality/contract-fixtures.json` with one violation per R1-R10. (~25 lines)
- [x] 1.8 **REFACTOR** Verify all contract tests pass. Document AP-1/AP-2 unresolved.

## Slice 2: tauri-pdf-image-import (PR 2)

- [x] 2.1 **RED** Test: WebView imports sanitized PDF, asserts `{pdfIdentity,page,imageFormat,width,height,sourcePosition,canvasDecode,productRowId}`. (~25 lines)
- [x] 2.2 **GREEN** Add evidence adapter in `src/js/pdfParser.js`; no Node Canvas mocks. (~70 lines)
- [x] 2.3 **RED** Test: missing image -> R9 YELLOW/IMPORTABLE, R9 count +1, row not GREEN. (~15 lines)
- [x] 2.4 **GREEN** Wire R9 feed from PDF evidence into `catalogValidator.js`. (~30 lines)
- [x] 2.5 Add `scripts/quality/pdf-fixture.pdf` (sanitized) + env-gated manifest.

## Slice 3: spreadsheet-physical-roundtrip (PR 3)

- [x] 3.1 **RED** Test: physical CSV/XLSX catalog via `AiCatalogEngine` preserves SKU/category/brand/model/variant/FOB/qty/cost/IVA. (~25 lines)
- [x] 3.2 **GREEN** Add physical-file harness in `scripts/quality/spreadsheet-harness.js` with real parsers. (~80 lines)
- [x] 3.3 **RED** Test: physical order route via `FileImporter` preserves fields + IVA semantics. (~20 lines)
- [x] 3.4 **GREEN** Extend harness for order route; assert route identity per file. (~50 lines)
- [x] 3.5 **RED** Test: wrong/silent route fails; parser error names file + field. (~15 lines)
- [x] 3.6 **GREEN** Add route-assertion and error-naming in harness. (~30 lines)

## Slice 4: signed-updater-release-smoke (PR 4)

- [x] 4.1 **RED** Test: without `TAURI_SIGNED_SMOKE=1` + manifest -> `SKIPPED_ENVIRONMENT_GATED`. (~10 lines)
- [x] 4.2 **GREEN** Implement gate in `scripts/quality/updater-smoke.js`. (~25 lines)
- [x] 4.3 **RED** Test: configured public key verification, placeholder rejection, metadata+sig+hash agreement. (~20 lines)
- [x] 4.4 **GREEN** Implement ordered check->download->verify->install->restart->sentinel flow. (~100 lines)
- [x] 4.5 **RED** Test: tampered artifact -> machine-readable rejection, old version active, sentinel unchanged. (~25 lines)
- [x] 4.6 **GREEN** Implement tamper-rejection path. (~50 lines)

## Slice 5: catalog-image-storage (PR 5, AP-3a gated)

- [x] 5.1 **RED** Test: read-only audit of inline images (missing/invalid/duplicate/orphan). (~25 lines)
- [x] 5.2 **GREEN** Implement audit in `src/js/storage.js` producing `ImageRef{id,relativePath,mime,sha256,width,height}`. (~70 lines)
- [x] 5.3 **RED** Test: migration creates backup + deterministic receipt; SKU change preserves image. (~20 lines)
- [x] 5.4 **GREEN** Implement atomic migration: copy->resolve->commit(catalog+files+schema+receipt). Rollback on failure. (~100 lines)
- [x] 5.5 **RED** Test: idempotent retry = no-op; orphans audit-visible, never auto-deleted. (~15 lines)
- [x] 5.6 **GREEN** Implement idempotence + orphan audit. (~50 lines)
- [x] 5.7 **GATE** AP-3a approval required before merge. ✅ Approved by maintainer 2026-07-31.

## Slice 6: historical-sku-audit-migration (PR 6, AP-3b gated)

- [x] 6.1 **RED** Test: audit across catalog + `mambo_historial_v2` + selection; duplicate normalized identities get distinct SKUs. (~25 lines)
- [x] 6.2 **GREEN** Implement audit + `SkuMapping{rowIdentity,oldSku,newSku}` in `src/js/skuAllocator.js`. (~80 lines)
- [x] 6.3 **RED** Test: ambiguous mapping blocks migration before mutation. (~15 lines)
- [x] 6.4 **GREEN** Implement ambiguity gate. (~25 lines)
- [x] 6.5 **RED** Test: atomic commit updates 3 domains; image refs unchanged; receipt proves counts. (~20 lines)
- [x] 6.6 **GREEN** Implement atomic commit + idempotent receipt + rollback. (~90 lines)
- [x] 6.7 **GATE** AP-3b approval required before merge. ✅ Approved by maintainer 2026-07-31.

## Slice 7: ui-persistence-e2e (PR 7)

- [x] 7.1 **RED** Test: fixture import shows traffic lights + R1-R10 details; RED not persisted; YELLOW/R9 reviewable. (~25 lines)
- [x] 7.2 **GREEN** Wire fixture file-input + preview in `src/index.html` and `src/js/app.js`. (~80 lines)
- [x] 7.3 **RED** Test: Tauri Store reload preserves catalog, selection, image, warnings. (~20 lines)
- [x] 7.4 **GREEN** Verify Store persistence with disposable data. (~40 lines)
- [x] 7.5 **RED** Test: Store-failure -> LocalStorage fallback -> identical recovery. (~20 lines)
- [x] 7.6 **GREEN** Implement Store-failure detection + fallback in `src/js/storage.js`. (~60 lines)
