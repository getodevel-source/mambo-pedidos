# ui-persistence-e2e Specification

## Purpose

Verify the user-visible import, quality, image, persistence, and fallback contract in a Tauri-capable UI harness after the six preceding slices. Tests MUST use disposable data and deterministic fixtures.

## Requirements

### Requirement: Import preview and decision behavior

The UI MUST allow a user to select the approved PDF/CSV/XLSX fixtures, show each product’s traffic-light status, and expose warning code, severity/status, evidence, reason, and importability. RED/rejected rows MUST NOT enter the catalog; YELLOW/importable rows, including missing-image R9 rows, MUST remain reviewable and confirmable; GREEN rows MUST show no failed R1–R10 evaluation.

#### Scenario: Reviewable missing image

- **GIVEN** a fixture row with valid fields and no image
- **WHEN** the preview opens
- **THEN** the row is YELLOW, R9 details are visible, confirmation imports it, and it is not displayed as GREEN

#### Scenario: Rejected critical warning

- **GIVEN** a fixture row with a critical R1–R6 or R10 violation
- **WHEN** the user attempts confirmation
- **THEN** the UI identifies the RED reason and the row is not persisted to the catalog

### Requirement: Image rendering and reload persistence

After the image-reference migration, imported images MUST render from their SKU-independent references. A confirmed catalog and its selected row MUST survive application reload through Tauri Store with the R1–R10 evidence still available.

#### Scenario: Tauri Store reload

- **GIVEN** a confirmed fixture catalog with an image and a selected SKU
- **WHEN** the application closes and reloads
- **THEN** the catalog, selection, image, and warning details are restored without orphaning the image

### Requirement: LocalStorage fallback and deterministic harness

The harness MUST simulate Tauri Store failure and verify the documented LocalStorage fallback, reload, and cleanup path without silent data loss. Startup network, LLM, and updater side effects MUST be disabled or intercepted; tests MUST not update a developer catalog or install software.

#### Scenario: Store unavailable

- **GIVEN** Tauri Store persistence fails during a confirmed import
- **WHEN** the application falls back and reloads
- **THEN** the same catalog, selection, image outcome, and quality evidence are recoverable from LocalStorage and the failure is observable in test evidence
