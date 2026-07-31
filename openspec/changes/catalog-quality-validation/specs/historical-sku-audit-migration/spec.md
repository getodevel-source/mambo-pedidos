# historical-sku-audit-migration Specification

## Purpose

Audit and durably repair catalog, history, and selection SKU references after `catalog-image-storage` has a stable reference contract. This is a separate destructive slice; it MUST NOT be combined with image migration.

## Requirements

### Requirement: Read-only SKU audit and deterministic mapping

The system MUST first produce a read-only audit covering missing, duplicate, colliding, and legacy SKUs across the catalog, `mambo_historial_v2`, and selection references. It MUST generate a deterministic old-to-new mapping before mutation. Every catalog row MUST receive a globally unique row SKU; duplicate normalized identities MUST retain their normalized identity for grouping and MUST NOT be automatically merged.

#### Scenario: Duplicate normalized identities

- **GIVEN** two catalog rows with the same normalized identity
- **WHEN** the audit and dry-run mapping execute
- **THEN** each row receives a distinct deterministic SKU, both rows remain present, and the normalized identity remains separately available for grouping

#### Scenario: Ambiguous mapping

- **GIVEN** a history or selection reference cannot be mapped deterministically
- **WHEN** the audit completes
- **THEN** the migration is blocked before mutation and reports the unresolved reference for approval or correction

### Requirement: Atomic durable reference migration

After AP-3b approval, migration MUST update catalog rows, historical order snapshots, and selection references as one atomic operation using the approved mapping. Image references MUST remain unchanged and resolvable. The operation MUST create a backup and receipt containing schema/version, mapping, counts, and input identity.

#### Scenario: Approved migration

- **GIVEN** stable image references, a reviewed audit/mapping, and a restorable backup
- **WHEN** SKU migration commits
- **THEN** all current and historical references resolve, every current row SKU is globally unique, and the receipt proves the before/after counts

### Requirement: Idempotence and rollback

Reapplying the same receipt MUST produce no additional changes. Any partial-write or verification failure MUST restore catalog, history, selection, and receipt state from backup; the failed migration MUST NOT be advertised as successful.

#### Scenario: Failure and retry

- **GIVEN** a failure while updating historical references
- **WHEN** the operation aborts and the same approved receipt is retried
- **THEN** the pre-migration state is restored first, and the retry yields the same mapping without duplicate or orphaned references
