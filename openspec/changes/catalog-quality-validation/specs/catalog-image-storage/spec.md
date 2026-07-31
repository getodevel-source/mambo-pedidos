# catalog-image-storage Specification

## Purpose

Move catalog image payloads behind local, SKU-independent references after the PDF, spreadsheet, and updater slices. This capability is a destructive persistence change and requires AP-3a approval.

## Requirements

### Requirement: Stable local image references

Catalog records MUST store a stable image reference independent of SKU, while rendering/import behavior MUST remain compatible with the R9 contract. References MUST remain valid when a row SKU changes. The local store MUST remain local; cloud sync is out of scope.

#### Scenario: SKU changes after storage migration

- **GIVEN** a product with a stored image reference and a later SKU remap
- **WHEN** the product is loaded and rendered
- **THEN** the same image is resolved without rewriting or looking up the image by SKU

### Requirement: Audited legacy migration

Before mutation, the system MUST produce a read-only audit of inline images, missing/invalid payloads, duplicates, and orphan candidates. A migration MUST create a restorable backup and a deterministic receipt mapping each source payload to its reference or explicit failure; it MUST require AP-3a approval after the audit and restore test.

#### Scenario: Successful legacy migration

- **GIVEN** an approved audit, backup, and valid legacy catalog
- **WHEN** migration runs
- **THEN** all eligible images are referenced externally, the receipt records counts and mappings, and the catalog is committed only after the references are resolvable

#### Scenario: Invalid or missing image

- **GIVEN** a legacy row with no valid image payload
- **WHEN** migration runs
- **THEN** the row remains importable, R9 remains YELLOW/not GREEN, and the receipt records the unresolved reason without inventing an image

### Requirement: Atomic, idempotent rollback and cleanup rules

Migration MUST be atomic across catalog records, image files, schema metadata, and receipt: any failure MUST restore the backup and leave the pre-migration state. Repeating the same migration MUST be a no-op with the same receipt and MUST NOT duplicate files. Orphaned files MUST be audit-visible and MUST NOT be deleted automatically; cleanup requires a separate explicit approval.

#### Scenario: Mid-migration failure and retry

- **GIVEN** a write failure after some images were copied
- **WHEN** migration aborts and is retried
- **THEN** rollback restores the original catalog and files, and a later approved retry produces one deterministic result with no duplicate blobs
