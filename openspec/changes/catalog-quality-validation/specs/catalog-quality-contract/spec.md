# catalog-quality-contract Specification

## Purpose

Freeze the auditable R1–R10 contract before any dependent slice. This capability changes evidence and testability, not extraction, OCR, LLM providers, pricing, IVA, logistics, or parser boundaries.

## Provisional assumptions and approval gates

- **AP-1 (product approval before contract apply):** missing/invalid images are reviewable and importable as **YELLOW**, never **GREEN**, and are not hard-blocking.
- **AP-2 (fixture policy approval):** small sanitized PDF/CSV/XLSX fixtures are checked in; full-corpus and signed-release assets use a pinned, environment-gated manifest.
- **AP-3a (image destructive apply approval):** image migration requires approval only after its read-only audit, backup, deterministic receipt, restore test, and rollback evidence pass.
- **AP-3b (SKU destructive apply approval):** SKU migration requires separate approval only after image references are stable and its read-only audit, mapping review, backup, restore test, and rollback evidence pass.

## Requirements

### Requirement: Chained delivery order and non-goals

The work MUST preserve the dependency order `catalog-quality-contract → (tauri-pdf-image-import, spreadsheet-physical-roundtrip, signed-updater-release-smoke) → catalog-image-storage → historical-sku-audit-migration → ui-persistence-e2e`. It MUST NOT add OCR, a new LLM/provider, a parser rewrite, cloud image sync, manual vendor correction, pricing/IVA/logistics redesign, unsigned updater fallback, signature bypass, secrets, or release publication.

#### Scenario: Dependent slice is requested early

- **GIVEN** a dependent migration or UI slice is proposed before its predecessor gate passes
- **WHEN** the change plan is evaluated
- **THEN** apply is blocked and the missing predecessor evidence is identified

### Requirement: Stable warning evaluations and aggregates

Each product MUST emit exactly one evaluation for each stable code `R1`–`R10`. Every evaluation MUST contain `code`, `severity` (`CRITICAL`, `WARNING`, or `PASS`), `status` (`RED`, `YELLOW`, or `GREEN`), structured `evidence` (observed value, expected predicate, and source reference), a non-empty user-facing `reason`, and `importability` (`REJECTED` or `IMPORTABLE`).

| Code | Violation and outcome | Minimum evidence | Aggregate key |
|---|---|---|---|
| R1 | Non-finite/non-positive FOB → CRITICAL/RED/REJECTED | observed FOB, source | `violationsByCode.R1` |
| R2 | Missing/noise model → CRITICAL/RED/REJECTED | model text, source | `violationsByCode.R2` |
| R3 | Price outside bounds → CRITICAL/RED/REJECTED; outlier warning → WARNING/YELLOW/IMPORTABLE | price, category, bounds | `violationsByCode.R3` |
| R4 | Brand/category incompatibility → CRITICAL/RED/REJECTED | brand, category, rule | `violationsByCode.R4` |
| R5 | Unrecognized category → CRITICAL/RED/REJECTED | category, vocabulary | `violationsByCode.R5` |
| R6 | Unrecognized brand → CRITICAL/RED/REJECTED | brand, vocabulary | `violationsByCode.R6` |
| R7 | Numeric price used as variant → WARNING/YELLOW/IMPORTABLE | variant, parsed number | `violationsByCode.R7` |
| R8 | Model equals variant → WARNING/YELLOW/IMPORTABLE | model and variant | `violationsByCode.R8` |
| R9 | Missing/invalid image → WARNING/YELLOW/IMPORTABLE | image reference/evidence | `violationsByCode.R9` |
| R10 | False grounding → WARNING/YELLOW/IMPORTABLE; absent grounding evidence → CRITICAL/RED/REJECTED | grounding state/source | `violationsByCode.R10` |

Passing evaluations MUST use `PASS/GREEN/IMPORTABLE` and still include evidence and reason. An aggregate MUST expose `violationsByCode` with exactly ten keys (`R1`–`R10`), each count equal to the number of non-GREEN evaluations for that code, plus `canonicalGroupCount: 10`. Statistical flags MUST be separate and MUST NOT change that count.

#### Scenario: One fixture exercises every warning group

- **GIVEN** sanitized rows containing one known violation for each R1–R10 rule
- **WHEN** the contract validator evaluates the fixture
- **THEN** every row has the required fields, every code is present, `violationsByCode.R1` through `violationsByCode.R10` each equal one, and `canonicalGroupCount` equals ten

#### Scenario: Clean and mixed-status rows

- **GIVEN** one clean row and one row with a reviewable R9 issue plus an upstream RED result
- **WHEN** validation runs
- **THEN** the clean row has ten GREEN evaluations, R9 remains YELLOW/importable, the upstream RED is preserved, and zero-count codes remain present

### Requirement: Reproducible fixtures and scope boundary

The contract test suite MUST run from checked-in sanitized fixtures without secrets or user catalogs. Full-corpus audits MAY run only when the pinned manifest and required environment gate are present; a skipped gate MUST be reported explicitly, never treated as a pass.

#### Scenario: Missing external corpus

- **GIVEN** the full-corpus environment gate is absent
- **WHEN** the quality suite runs
- **THEN** checked-in fixture tests execute and the full-corpus check reports `SKIPPED_ENVIRONMENT_GATED` without changing product behavior
