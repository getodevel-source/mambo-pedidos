# image-text-verification Specification

## Purpose

Make "GREEN = the photo matches the product text" true. Today the only visual checks run inside the image matcher (`PdfParser.validateImageForProduct`), where dominant color is computed over the full canvas — the white page background dominates (73% of sampled images), so the color gate rarely fires and never degrades status. `CatalogAssignmentGates` implements the right policies (cross-category/cross-brand sharing, placeholder, generic models) but is not wired into the import pipeline. This capability adds a post-extraction verification layer that degrades incompatible image↔text pairs to YELLOW with concrete evidence.

## Requirements

### Requirement: Background-excluded color verification

Dominant color MUST be computed on the interior of the image (center crop, e.g. central 60% bounding box) so the page background does not dominate. The declared color word (from `color`/`variante`/`modelo`) MUST be compared against that interior color. A contradicting pair (declared color not compatible with actual interior color) MUST degrade the product to YELLOW with evidence `{declared, actual, sampleRegion}`. Compatibility groups: GRAY↔SILVER↔WHITE, PURPLE↔BLUE↔PINK, CYAN↔BLUE↔GREEN, GOLD↔ORANGE. When the interior is multi-colored (low single-color occupancy), the check MUST be WATCH (no status change) with evidence `{ambiguous:true, occupancy}`.

#### Scenario: Declared "Black" but photo interior is white

- **GIVEN** a product with `color="Black"` and an image whose interior dominant color is WHITE with high occupancy
- **WHEN** the image-text gate runs
- **THEN** the product is YELLOW with warning "Color de imagen (WHITE) no coincide con el producto (BLACK)" and evidence `{declared:"BLACK", actual:"WHITE", sampleRegion:"center-60%", occupancy:87}`

#### Scenario: Combo/multi-color photo

- **GIVEN** a product whose interior has no dominant color (occupancy < 35%)
- **WHEN** the image-text gate runs
- **THEN** the product status is unchanged (WATCH) and the audit notes `{ambiguous:true, occupancy:29}`

### Requirement: Category-aspect degradation

A compact-category product (MOUSE, HEADSET, AURICULAR, CONTROLLER, SWITCH) carrying a wide image (aspect > 1.9) MUST be YELLOW with evidence `{cat, aspect, expectedFamily}`. A wide-category product (TECLADO, MOUSEPAD) carrying a tall narrow image (aspect < 0.65) MUST be YELLOW. The matcher's relaxed backfill acceptance (which currently allows wide photos onto MOUSE) MUST NOT clear this gate: the gate is post-matching and independent of matcher penalties.

#### Scenario: Mouse with keyboard photo

- **GIVEN** a MOUSE product whose assigned image has aspect 2.3 (wide, keyboard-like)
- **WHEN** the image-text gate runs
- **THEN** the product is YELLOW with warning "Imagen ancha (ratio 2.30) incompatible con MOUSE" and evidence `{cat:"MOUSE", aspect:2.3}`

#### Scenario: Legitimate wide mousepad photo on TECLADO

- **GIVEN** a TECLADO product with a wide photo (aspect > 1.9, legitimate keyboard photo)
- **WHEN** the image-text gate runs
- **THEN** the product stays GREEN (wide is expected for TECLADO) with no warning

### Requirement: Assignment gates wired into the real pipeline

`CatalogAssignmentGates` MUST run inside the import pipeline (after extraction, before preview) and in the batch export, not only in `measure-catalog-assignment.js`. Its protections become effective status changes:

- An image shared across distinct categories → all sharing products YELLOW with evidence `{sharedBy:[sku...], categories:[...]}`.
- An image shared across distinct brands without matching brand+model+category identity → YELLOW with evidence.
- Placeholder `"-"` or invalid image → YELLOW (already R9 policy) with "Sin imagen" warning.

#### Scenario: One image on two categories

- **GIVEN** two products in different categories (e.g. TECLADO and MOUSE) carrying the identical image data URL
- **WHEN** the assignment gate runs on the imported set
- **THEN** both products are YELLOW with evidence naming the shared image and both categories

#### Scenario: Verified rebrand shares image

- **GIVEN** two products with identical brand+model+category (verified rebrand, e.g. Irok/Mars) sharing one image
- **WHEN** the assignment gate runs
- **THEN** both products keep their status (rebrand allowlist by evidence, no status change)

### Requirement: Gate evidence is preserved for the UI

The gate MUST attach `_imgTextWarnings` (or extend `warnings`) with the evidence objects above, and the export MUST include them so the audit and the import preview show why a product is YELLOW. The UI MUST display the warning reason (existing `pv-reason` path) without new interaction surfaces.

#### Scenario: Preview shows image warning

- **GIVEN** an import whose product was degraded to YELLOW by the image-text gate
- **WHEN** the import preview renders
- **THEN** the product card shows the warning reason as its review reason
