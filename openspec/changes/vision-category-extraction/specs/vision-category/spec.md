# vision-category Specification

## Purpose

Validate product **category** and **color** against the **image content** at extraction time, fusing text-derived and image-derived confidence, so category mis-assignment (mouse↔teclado) and color contradictions stop degrading the catalog — without ever hard-assigning on low confidence (fail-closed) and without brand/SKU overfit.

## ADDED Requirements

### Requirement: Image-derived category signal

The extraction SHALL produce an image-derived category estimate (`_imageCategory`) with a confidence score, independent of the text classifier, for every product that has an image.

#### Scenario: Image model present

- **GIVEN** a product with a decoded image
- **WHEN** the vision classifier runs
- **THEN** `_imageCategory` and `_imageCategoryConfidence` are attached, drawn from a fixed vocabulary (TECLADO, MOUSE, HEADSET, MOUSEPAD, CONTROLLER, ACCESORIO)

#### Scenario: No image

- **GIVEN** a product without an image
- **WHEN** extraction completes
- **THEN** `_imageCategory` is absent and the text category stands (no fabrication)

### Requirement: Text+image fusion, fail-closed

The final category SHALL fuse the text classifier confidence and `_imageCategoryConfidence`. When they agree, confidence rises; when they strongly disagree, the item SHALL be marked `_categoryUncertain` and routed to review, never hard-assigned.

#### Scenario: Agreement

- **GIVEN** text category TECLADO (conf ≥ 80) and `_imageCategory` TECLADO (conf ≥ 80)
- **WHEN** fusion runs
- **THEN** final category TECLADO with raised confidence, no uncertainty flag

#### Scenario: Strong disagreement

- **GIVEN** text category TECLADO but `_imageCategory` MOUSE with high confidence
- **WHEN** fusion runs
- **THEN** the item is `_categoryUncertain:true`, keeps a provisional category, and is surfaced in the human-review report

### Requirement: No overfit

The vision classifier and fusion SHALL NOT reference brand names, SKU prefixes, or catalog strings. Rules must be structural (image content), validated by the anti-overfit audit.

#### Scenario: Anti-overfit audit

- **GIVEN** the remediation/vision source
- **WHEN** `anti-overfit-audit.js` runs
- **THEN** no brand/catalog strings are found (exit 0)

### Requirement: Color from image with reconciliation

The extractor SHALL derive the product color from the image interior and reconcile it with the declared color; a high-confidence interior that contradicts a low-information declared value updates the color with evidence, never silently.

#### Scenario: High-confidence interior overrides placeholder

- **GIVEN** declared color empty/placeholder and interior WHITE confidence ≥ 80
- **WHEN** reconciliation runs
- **THEN** color = WHITE with `colorEvidence` attached

#### Scenario: Contradictory declared vs interior

- **GIVEN** declared PINK and interior GRAY confidence ≥ 80
- **WHEN** reconciliation runs
- **THEN** the item is flagged for review (color contradiction), not silently overridden

### Requirement: Honest measurement

Every vision-driven change SHALL be validated by the existing harness: hold-out leave-one-catalog-out (0 new FPs), promotion-audit (0 FP), calibration-delta (FP↓, FN↮↑), and FASE 2 no-regression gates.

#### Scenario: Gate regression blocks the change

- **GIVEN** a vision rule that introduces a false positive on any held-out catalog
- **WHEN** the harness runs
- **THEN** the rule is rejected (fail-closed) and not shipped
