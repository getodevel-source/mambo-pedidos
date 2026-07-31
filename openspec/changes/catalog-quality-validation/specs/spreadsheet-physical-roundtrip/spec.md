# spreadsheet-physical-roundtrip Specification

## Purpose

Prove that real CSV and XLSX bytes preserve catalog and order data through both existing spreadsheet routes, after `catalog-quality-contract` and parallel with PDF/updater work. Mocks alone are insufficient evidence.

## Requirements

### Requirement: Physical CSV/XLSX round-trip

The test capability MUST create physical CSV and XLSX files in a disposable directory, process them with the real parser/export path, read the resulting bytes back with the real PapaParse/SheetJS-compatible parsers, and compare the semantic record. The round-trip MUST assert SKU, category, brand, model, variant, FOB, quantity, costs, and IVA visibility/meaning without introducing new pricing or IVA behavior.

#### Scenario: Catalog route

- **GIVEN** a sanitized catalog fixture with representative text, numeric, SKU, and IVA fields
- **WHEN** the catalog file is routed through `AiCatalogEngine`
- **THEN** the physical CSV and XLSX paths preserve the asserted fields and emit the R1–R10 contract without relying on mocked file objects

#### Scenario: Order route

- **GIVEN** a sanitized order fixture with the same applicable fields
- **WHEN** the order file is imported/exported through `FileImporter`
- **THEN** the physical CSV and XLSX round-trips preserve field values, numeric meaning, and existing IVA semantics

### Requirement: Explicit routing and failure evidence

Tests MUST assert that catalog files use the catalog route and order files use the order route. A parser, extension, encoding, or numeric-conversion failure MUST identify the physical file and field and MUST NOT be hidden by a mock fallback.

#### Scenario: Route regression

- **GIVEN** a valid file for each route
- **WHEN** both imports run
- **THEN** each result records its route and a wrong or silent route selection fails the test

### Requirement: Fixture policy

Sanitized small CSV/XLSX fixtures MUST be checked in. Large vendor files MAY be tested only through the approved environment-gated manifest and MUST NOT be committed as user data.

#### Scenario: No external data

- **GIVEN** the full-corpus gate is absent
- **WHEN** round-trip tests run
- **THEN** local fixtures execute and the external audit is reported as `SKIPPED_ENVIRONMENT_GATED`
