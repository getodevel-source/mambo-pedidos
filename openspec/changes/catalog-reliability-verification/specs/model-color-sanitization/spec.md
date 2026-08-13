# model-color-sanitization Specification

## Purpose

Clean the two fields the user sees first. The `color` field carries connection types and category words (`"Wireless"`, `"Black Mouse Wireless"`, `"Black Keyboard Wireless"`, `"Magnetic Switch White"`, `"Black Webcam"`), and the `modelo` field still holds marketing/spec noise (107 of 179 YELLOW come from "marketing words without a real product identifier", 27 from "generic word", 27 from truncated models). The FASE 2 sanitizer recall is 85% (34/40 dirty detected, 6 false negatives — e.g. "M720 Wireless Mouse", "G502 Wired Mouse", "0500 Backpack Tactical"). This capability tightens extraction of `color` and closes the model-quality false negatives the ground truth exposes.

## Requirements

### Requirement: Color holds a color

The `color` field MUST contain a color word (or the empty value) after sanitization. Connection types (`wired`, `wireless`, `bluetooth`, `2.4g`, `tri-mode`, `usb-c`, `rgb`, `magnetic`, `hall effect`, `switch` variants) and category words (`mouse`, `keyboard`, `headset`, `webcam`, `gamepad`, …) MUST be removed from `color` and moved to `variante` when the variant is empty, otherwise dropped. The color vocabulary is the existing `CatalogValidator.COLOR_AUDIT_RE` set plus `switch`-adjacent colors.

#### Scenario: "Black Mouse Wireless" color

- **GIVEN** a product with `color="Black Mouse Wireless"`, `variante=""`
- **WHEN** sanitization runs
- **THEN** `color="Black"` and `variante` contains the connection/category info (e.g. "Wireless Mouse") or the words are dropped when already present

#### Scenario: "Magnetic Switch White" color

- **GIVEN** a product with `color="Magnetic Switch White"`
- **WHEN** sanitization runs
- **THEN** `color="White"` and the switch/connection words are moved to `variante`

### Requirement: Model-quality false negatives closed

`TextSanitizer.assessModelQuality` MUST flag the ground-truth false negatives from the measured set: model containing its own category word ("M720 Wireless Mouse", "G502 Wired Mouse"), model that is only a spec fragment ("68 Keys Esport", "Mount Tai GT powder", "Hall Effect Ace 68 Air"), and model that lost its product code ("0500 Backpack Tactical 15.6", "axis"). Flagged models MUST be YELLOW (importable, reviewable), matching the current generic/marketing-word behavior.

#### Scenario: Category word inside model

- **GIVEN** a model `"M720 Wireless Mouse"`
- **WHEN** `assessModelQuality` runs
- **THEN** the result is YELLOW with reason naming the category word inside the model

#### Scenario: Existing clean model stays GREEN

- **GIVEN** a clean model like `"F75 Glacier"`
- **WHEN** `assessModelQuality` runs
- **THEN** the result is GREEN with no warnings

### Requirement: Regression guard on FASE 2 measurement

The tightening MUST NOT regress the closed FASE 2 gates: `scripts/measure-model-quality.js` recall must stay ≥ 85% and FP rate ≤ 8% on the 65-case ground truth; `scripts/measure-extraction.js` must show no new regressions. New fixtures from the measured false negatives are added to `scripts/quality/contract-fixtures.json` style (env-gated full-corpus, checked-in sanitized cases).

#### Scenario: Ground-truth regression check

- **GIVEN** the FASE 2 measurement scripts on the checked-in ground truth
- **WHEN** the tightened sanitizer runs
- **THEN** recall_dirty ≥ 85%, FP_rate_clean ≤ 8%, and no extraction case regresses from the last closed run

## Requirements

### Requirement: No persistence migration

This capability operates on in-memory product objects during import/extraction. It MUST NOT change stored catalogs, SKUs, or image references (out of scope per proposal). Re-importing applies the new sanitization; existing stored rows are untouched.

#### Scenario: Existing stored catalog unaffected

- **GIVEN** a stored catalog created before this change
- **WHEN** the app loads without re-importing
- **THEN** the stored rows keep their old `color`/`modelo` values (no silent migration)
