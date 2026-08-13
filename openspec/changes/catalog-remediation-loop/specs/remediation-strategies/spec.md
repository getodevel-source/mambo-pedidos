# remediation-strategies Specification

## Purpose

Deterministic per-class remediation for the honest gates: repair the flagged FIELD from real source evidence (photo interior pixels, literal text items, row columns) or leave the item flagged. Every promotion carries a mandatory `remediationEvidence` contract referencing real source artifacts; a promoted item with missing or fabricated evidence is a pipeline defect. Items that cannot be honestly fixed stay YELLOW/RED with an atomic reason and are declared bounded-irremediable. All strategies are pure, deterministic, config-gated functions over the extraction result; none mutates stored catalog data. Baseline (FINAL5, n=2309): 656 YELLOW distributed as COLOR_MISMATCH 118, COLOR_AMBIGUOUS 110, OUTLIER_PRICE 106, FOB_NO_LITERAL_EVIDENCE 94, MODEL_GENERIC_WORD 27, MODEL_TRUNCATED 27, SWITCH_IN_MODEL 19, SPEC_FRAGMENT 19, ASPECT_MISMATCH 9, SHARED_IMAGE 5.

## Requirements

### Requirement: color-from-image remediation (COLOR_MISMATCH)

For a COLOR_MISMATCH item, the strategy MAY correct the declared product `color` from the photo's interior sample (center-60% region, background excluded) when the photo is unambiguous: a single dominant color with occupancy ≥ 35% that is in the color vocabulary. On promotion, the strategy MUST move the declared color to `variante` and set `color` from the interior sample. The strategy MUST NOT apply when occupancy < 35%, when the interior color is not in the vocabulary, or when the box-art heuristic fires (interior color is the box, not the product — WATCH, no status change). Promotion evidence MUST be `{remediated:"color-from-image", actual, declared, occupancy, sampleRegion:"center-60%"}` with occupancy ≥ 35 asserted by the strategy.

#### Scenario: Unambiguous interior color promotes

- **GIVEN** a COLOR_MISMATCH item with declared `color="BLACK"` and an interior sample whose dominant color is WHITE at occupancy 87
- **WHEN** the color-from-image strategy runs
- **THEN** the item's `color` becomes "WHITE", "BLACK" moves to `variante`, and evidence is `{remediated:"color-from-image", actual:"WHITE", declared:"BLACK", occupancy:87, sampleRegion:"center-60%"}`

#### Scenario: Low-occupancy photo stays YELLOW

- **GIVEN** a COLOR_MISMATCH item whose interior has no dominant color (occupancy 29 < 35)
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `COLOR_MISMATCH`

#### Scenario: Non-vocabulary interior color stays YELLOW

- **GIVEN** a COLOR_MISMATCH item whose interior dominant color is not in the color vocabulary
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `COLOR_MISMATCH`

#### Scenario: Box-art photo stays YELLOW (WATCH)

- **GIVEN** a COLOR_MISMATCH item whose photo is flagged by the box-detection heuristic (interior color is the box artwork)
- **WHEN** the strategy runs
- **THEN** the strategy does not apply, the item stays YELLOW, and the audit notes the box-art heuristic at WATCH level with no status change

### Requirement: variante-color-adoption remediation (COLOR_AMBIGUOUS)

For a COLOR_AMBIGUOUS item, the strategy MAY promote when `variante` names explicit colors (for example "Pink/White", "Black Blue") that match the photo's top interior colors: the multi-color is an intentional product design, not uncertainty. The match MUST be vocabulary-based (the variante color tokens and the photo top interior colors share at least one compatible color). The strategy MUST NOT apply when `variante` is empty or names colors that contradict the photo. Promotion evidence MUST be `{remediated:"variante-color-adoption", colorsFromVariante, photoTopColors}`.

#### Scenario: Variante colors match the photo

- **GIVEN** a COLOR_AMBIGUOUS item with `variante="Pink/White"` and photo top interior colors [PINK(52), WHITE(48)]
- **WHEN** the variante-color-adoption strategy runs
- **THEN** the strategy applies with evidence `{remediated:"variante-color-adoption", colorsFromVariante:["Pink","White"], photoTopColors:["PINK","WHITE"]}`

#### Scenario: Empty variante stays YELLOW

- **GIVEN** a COLOR_AMBIGUOUS item with empty `variante`
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `COLOR_AMBIGUOUS`

#### Scenario: Contradictory variante stays YELLOW

- **GIVEN** a COLOR_AMBIGUOUS item with `variante="Negro"` and photo top interior colors [PINK, WHITE] (no compatible overlap)
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `COLOR_AMBIGUOUS`

### Requirement: literal-price-regrounding remediation (OUTLIER_PRICE)

For an OUTLIER_PRICE item, the strategy MUST re-run anchor-to-row verification demanding a literal price token (currency symbol / decimal pattern) in the same row band. A verified literal anchor proves the outlier is a real price tier (bimodal category distributions are legitimate). Promotion evidence MUST be `{remediated:"literal-price-regrounding", groundingMode:"literal", text, page, dy}`. The strategy MUST NOT promote on geometric-only evidence, and MUST NOT apply when no literal price token is in the row band or when the nearest anchor belongs to a neighbor (fused/shifted cells).

#### Scenario: Literal price token in the row band

- **GIVEN** an OUTLIER_PRICE item priced at 5× the category IQR upper bound whose row band contains the literal token "$89.00"
- **WHEN** the literal-price-regrounding strategy runs
- **THEN** the strategy applies with evidence `{remediated:"literal-price-regrounding", groundingMode:"literal", text:"$89.00", page, dy}` and the grounding is literal

#### Scenario: No literal token stays YELLOW

- **GIVEN** an OUTLIER_PRICE item whose row band contains no literal price token
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `OUTLIER_PRICE`

#### Scenario: Neighbor anchor stays YELLOW

- **GIVEN** an OUTLIER_PRICE item whose nearest anchor belongs to a neighbor column (fused cell)
- **WHEN** the strategy runs
- **THEN** the strategy does not apply, the item stays YELLOW with reason `OUTLIER_PRICE`, and geometric-only evidence never promotes

### Requirement: literal-anchor-search remediation (FOB_NO_LITERAL_EVIDENCE)

For a FOB_NO_LITERAL_EVIDENCE item, the strategy MUST scan the verified row band's text items for a price-like token the row actually contains (currency symbol, price pattern) and ground the FOB on it. Promotion evidence MUST be `{remediated:"literal-anchor-search", groundingMode:"literal", text, page, alignment}`. `grounded:true` MUST remain derived from the literal token — never hardcoded. The strategy MUST NOT apply when the row contains no literal price token or when the only token belongs to a neighbor (genuinely unverifiable).

#### Scenario: Literal anchor found in the row

- **GIVEN** a FOB_NO_LITERAL_EVIDENCE item whose row band contains the token "$23.90" aligned with the row baseline
- **WHEN** the literal-anchor-search strategy runs
- **THEN** the strategy applies with evidence `{remediated:"literal-anchor-search", groundingMode:"literal", text:"$23.90", page, alignment}` and `grounded` is derived `true`

#### Scenario: No literal token stays YELLOW

- **GIVEN** a FOB_NO_LITERAL_EVIDENCE item whose row band contains no price-like token
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `FOB_NO_LITERAL_EVIDENCE`

#### Scenario: Fused-cell anchor stays YELLOW

- **GIVEN** a FOB_NO_LITERAL_EVIDENCE item in a fused row where the only price token belongs to the neighbor
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `FOB_NO_LITERAL_EVIDENCE`

### Requirement: truncation row-band repair (MODEL_TRUNCATED)

For a MODEL_TRUNCATED item (unclosed parenthesis/brace), the strategy MUST re-scan the page's text items at the row's y band for the missing closing token and repair the model when the token exists (the extractor often drops the closing token as a separate text item). Promotion evidence MUST be `{remediated:"truncation-repaired", before, after}`. The strategy MUST NOT apply when no closing token exists anywhere in the row band (genuinely truncated in the source PDF).

#### Scenario: Closing token exists as a separate text item

- **GIVEN** a MODEL_TRUNCATED item with model "(Magnetic Switch" and a ")" text item in the same row band
- **WHEN** the truncation repair strategy runs
- **THEN** the model is repaired to "(Magnetic Switch)" with evidence `{remediated:"truncation-repaired", before:"(Magnetic Switch", after:"(Magnetic Switch)"}`

#### Scenario: Genuinely truncated stays YELLOW

- **GIVEN** a MODEL_TRUNCATED item whose row band contains no closing token
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `MODEL_TRUNCATED`

### Requirement: switch-to-variante remediation (SWITCH_IN_MODEL)

For a SWITCH_IN_MODEL item, the strategy MUST move the switch/axis token (magnetic, hall effect, red/brown/blue switch, and the like) to `variante`, following the same pattern as the existing `sanitizeColorField` category move. The strategy MAY promote only if the remaining model keeps a real identity (noun, code, or digits). Promotion evidence MUST be `{remediated:"switch-to-variante", moved, to:"variante"}`.

#### Scenario: Model keeps identity after the move

- **GIVEN** a SWITCH_IN_MODEL item with model "Magnetic Switch T9"
- **WHEN** the switch-to-variante strategy runs
- **THEN** "Magnetic Switch" moves to `variante`, the model becomes "T9" (real identity retained), and evidence is `{remediated:"switch-to-variante", moved:["Magnetic Switch"], to:"variante"}`

#### Scenario: Identity-less model stays YELLOW

- **GIVEN** a SWITCH_IN_MODEL item whose model is only the switch token with no remaining identity
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `SWITCH_IN_MODEL`

### Requirement: row-context disambiguation remediation (MODEL_GENERIC_WORD)

For a MODEL_GENERIC_WORD item, the strategy MUST adopt a real product code from the row's other columns (`marca`, category, `variante`) or from a sibling row when such evidence exists. Promotion evidence MUST name the adopted code and its source. The strategy MUST NOT apply when no disambiguating evidence exists in the row context; a generic word has no identity on its own.

#### Scenario: Code adopted from a row column

- **GIVEN** a MODEL_GENERIC_WORD item whose model is a generic word and whose `variante` column contains the code "AJ139"
- **WHEN** the row-context disambiguation strategy runs
- **THEN** the model adopts "AJ139" with evidence `{remediated:"row-context-disambiguation", adopted:"AJ139", source:"variante"}`

#### Scenario: No disambiguating evidence stays YELLOW

- **GIVEN** a MODEL_GENERIC_WORD item with no code in any row column or sibling row
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `MODEL_GENERIC_WORD`

### Requirement: code-adoption remediation (SPEC_FRAGMENT)

For a SPEC_FRAGMENT item (category/spec fragment without a real code), the strategy MUST adopt a real code found in another row column or text item of the same row. The strategy MUST NOT apply when no code exists in the row; the item then has no identity and stays YELLOW.

#### Scenario: Code adopted from a row text item

- **GIVEN** a SPEC_FRAGMENT item with model "68 Keys" and a same-row text item "AJ139 Pro 68 Keys" containing the code "AJ139"
- **WHEN** the code-adoption strategy runs
- **THEN** the model adopts "AJ139" with evidence `{remediated:"code-adoption", adopted:"AJ139", source:"row-text"}`

#### Scenario: No code in the row stays YELLOW

- **GIVEN** a SPEC_FRAGMENT item with no code in any row column or text item
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `SPEC_FRAGMENT`

### Requirement: shared-image reassign remediation (ASPECT_MISMATCH, SHARED_IMAGE)

For ASPECT_MISMATCH and SHARED_IMAGE items, the strategy MUST reassign the image to a sibling whose category aspect matches when the sharing is an assignment artifact, then re-run the image-integrity gates. Verified rebrands (same brand+model+category) MUST pass with identity evidence. Any identity doubt MUST fail closed: the item stays YELLOW unless the sibling resolution proves the sharing is a legitimate rebrand with brand+model+category evidence.

#### Scenario: Image reassigned to matching sibling

- **GIVEN** an ASPECT_MISMATCH MOUSE item carrying a wide image (aspect 2.3) shared with a TECLADO sibling
- **WHEN** the shared-image reassign strategy runs and the image-integrity gates pass after reassignment
- **THEN** the strategy applies with evidence `{remediated:"shared-image-reassign", reassignedToCategory:"TECLADO", siblingSku, imageHash}`

#### Scenario: Cross-brand sharing stays YELLOW

- **GIVEN** a SHARED_IMAGE item whose image is shared across distinct brands without brand+model+category identity
- **WHEN** the strategy runs
- **THEN** the strategy does not apply and the item stays YELLOW with reason `SHARED_IMAGE`

### Requirement: Mandatory remediationEvidence contract

Every promotion produced by any strategy MUST carry a non-empty `remediationEvidence` object whose keys are the stable English names defined in this spec, and whose values reference real source artifacts: the exact text item (with page/coordinates), the pixel region sampled, or the row column adopted. A promoted item with missing or fabricated evidence MUST be treated as a pipeline defect (fail-closed): the promotion MUST be rejected and reported. Evidence fields MUST NEVER be synthesized — no value may appear that does not trace to the artifact it claims.

#### Scenario: Promotion without evidence is a defect

- **GIVEN** a strategy outcome that changes an item's status to GREEN without producing `remediationEvidence`
- **WHEN** the promotion contract check runs
- **THEN** the promotion is rejected, the item is reported as a pipeline defect, and the item does not reach GREEN

#### Scenario: Evidence not traceable to a source artifact is rejected

- **GIVEN** a strategy outcome whose evidence value does not match the artifact the strategy actually read (for example an `actual` color the interior sample did not produce)
- **WHEN** the promotion contract check runs
- **THEN** the evidence is treated as fabricated, the promotion is rejected, and the defect is reported

### Requirement: Bounded-irremediable declaration

An item that cannot be fixed from source data after exhausting every applicable strategy MUST stay YELLOW/RED with its atomic reason, MUST be declared bounded-irremediable with its class and the reason it cannot be remedied, and MUST be emitted in the human-review report (SKU → class → reason → why not remediable). Bounded-irremediable items MUST NEVER be promoted and MUST NEVER be silently accepted as a lower bar.

#### Scenario: Marketing-only name is bounded-irremediable

- **GIVEN** a MODEL_MARKETING item "Ultra Crystalblade Gleam" (puffery stack, no noun, no code, no disambiguating evidence anywhere)
- **WHEN** every applicable strategy runs and none can produce evidence
- **THEN** the item stays YELLOW with reason `MODEL_MARKETING`, is declared bounded-irremediable, and appears in the human-review report with its class, atomic reason, and why it cannot be remedied
