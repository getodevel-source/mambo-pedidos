# fob-grounding-integrity Specification

## Purpose

Make `grounded: true` mean something. Today all three `pdfParser.js` push sites hardcode `grounded: true / groundedFob: true / isGroundedPrice: true` with the reason "FOB extraído de un ancla literal del texto" — the anchor is literally present in the page, but nothing proves it belongs to THIS product's row. Fused cells and shifted columns (FASE 2 measured 46/65 changed cases, several losing or swapping their product code) mean a neighbor's price can land on a product and still validate GREEN with R10 grounded. This capability replaces the hardcoded flag with anchor-to-row geometric verification, and promotes price outliers from advisory to YELLOW.

## Requirements

### Requirement: Geometric anchor verification

A product's `grounded` value MUST be derived, not hardcoded. The FOB anchor used for the product MUST be verified against the product row geometry: same page, horizontal alignment with the row's text baseline (within the column tolerance the grid engine already uses), and vertical distance to the row that is the minimum across candidate anchors. When no anchor satisfies the verification, `grounded` MUST be `false` with `groundingReason` naming the failure mode (e.g. "ancla de fila vecina", "ancla no alineada", "ancla ausente").

#### Scenario: Anchor belongs to the row

- **GIVEN** a product row with a price anchor aligned to its baseline on the same page
- **WHEN** grounding verification runs
- **THEN** `grounded` is `true` with evidence `{page, anchorX, rowX, dx, dy, price}`

#### Scenario: Fused cell — anchor is the neighbor's price

- **GIVEN** a fused-cell row where the nearest price anchor belongs to the neighboring product column
- **WHEN** grounding verification runs
- **THEN** `grounded` is `false` and the product degrades to YELLOW (never RED) with `groundingReason` naming the misalignment

#### Scenario: No anchor found

- **GIVEN** a product whose FOB value exists but no literal anchor is found on the page
- **WHEN** grounding verification runs
- **THEN** `grounded` is `false`, the product is YELLOW, and the reason is "FOB sin ancla literal verificada"

### Requirement: Grounding degrades to YELLOW, never RED

An unverifiable anchor MUST degrade to YELLOW (importable, flagged) — RED remains reserved for missing/invalid/non-positive FOB. R10 evidence MUST record the geometric evidence object instead of the hardcoded string. `CatalogValidator.evaluateItem` MUST consume the new evidence shape without changing the R1–R10 contract (code, severity, status, evidence, reason, importability).

#### Scenario: R10 reflects the evidence

- **GIVEN** a product with a false grounding and new geometric evidence
- **WHEN** `evaluateItem` runs
- **THEN** R10 is WARNING/YELLOW/IMPORTABLE and its `evidence` contains `{groundingMode:"geometric", page, dx, dy}`

### Requirement: Outliers degrade to YELLOW

`validateCatalogStats` outlier detection MUST change from advisory to status-affecting only above a high-confidence threshold (IQR × 3 beyond Q1/Q3). The flag MUST carry the outlier evidence `{price, median, iqr, cat, factor}` and the product becomes YELLOW when above the threshold. Advisory warnings (IQR × 1.5) remain as they are today (WATCH, no status change).

#### Scenario: Extreme outlier

- **GIVEN** a product priced at 5× the category IQR upper bound
- **WHEN** catalog stats validation runs
- **THEN** the product is YELLOW with warning "Outlier de precio: $X (mediana Y)" and evidence `{price, median, iqr, cat, factor}`

#### Scenario: Mild outlier

- **GIVEN** a product between 1.5× and 3× IQR
- **WHEN** catalog stats validation runs
- **THEN** the product keeps its status with the existing advisory `_statFlag` (no YELLOW)

## Requirements

### Requirement: No regression on existing FOB rules

R1 (FOB finite and positive) and R3 (category price range) MUST keep their current behavior. This capability only changes the grounding flag derivation and the outlier severity threshold.

#### Scenario: Existing valid product stays GREEN

- **GIVEN** a well-grounded in-range product with a matching photo
- **WHEN** all validation runs
- **THEN** the product is GREEN with R1, R3, R10 passing and grounding evidence present
