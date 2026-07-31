# tauri-pdf-image-import Specification

## Purpose

Prove PDF image decoding and product association in the Tauri-hosted WebView, after `catalog-quality-contract` and before image storage migration. Node-only PDF results are not production image evidence.

## Requirements

### Requirement: Real-PDF WebView evidence

The test capability MUST import a representative real PDF inside a Tauri WebView and record PDF identity, page, Canvas decode result, image dimensions/format, and the associated product row. It MUST exercise the existing PDF.js/browser boundary and MUST NOT substitute a Node mock for Canvas, workers, or `page.objs`.

#### Scenario: Image-bearing PDF

- **GIVEN** a checked-in sanitized PDF with a verifiable product image
- **WHEN** Tauri imports it through the normal catalog flow
- **THEN** Canvas decoding succeeds, the image is associated with at most one intended product, and the evidence links page/position/image to that row

#### Scenario: WebView-only failure

- **GIVEN** the same PDF cannot decode or associate an image in the Tauri WebView
- **WHEN** the import test completes
- **THEN** it fails with the captured environment/evidence reason and cannot be satisfied by a passing Node-only harness

### Requirement: Contract-compatible image outcomes

The import result MUST feed the R1–R10 contract. A missing or invalid image MUST produce R9 `WARNING/YELLOW/IMPORTABLE`, MUST NOT produce GREEN, and MUST remain distinguishable from a matched image. No OCR, parser rewrite, or automatic vendor correction is introduced.

#### Scenario: Image absent from a valid product

- **GIVEN** a product whose text and price checks pass but no valid image is associated
- **WHEN** the preview is generated
- **THEN** R9 is present with evidence and a user-facing reason, the row is YELLOW/importable, and the aggregate R9 count increases by one

### Requirement: Fixture and dependency gate

Small sanitized PDFs MUST be local/CI fixtures. Full-corpus PDF evidence MUST use the approved pinned manifest and environment gate. This characterization slice MUST preserve the current inline-image behavior until `catalog-image-storage` is approved.

#### Scenario: Unavailable full corpus

- **GIVEN** the local catalog corpus is unavailable
- **WHEN** the PDF evidence suite runs
- **THEN** the sanitized fixture runs and the full-corpus result is explicitly environment-gated rather than silently omitted
