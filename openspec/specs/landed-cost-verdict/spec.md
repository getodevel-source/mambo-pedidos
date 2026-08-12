# landed-cost-verdict Specification

## Purpose

Verdict layer that answers "is importing cheaper than buying locally?" on top of the existing audited landed-cost engine, with an explicit eliminated Impuesto PAIS line, optional Bienes Personales percepción, an insurance preset, and wizard surfaces for the new inputs.

## Requirements

### Requirement: Local Price Comparison Verdict

The system MUST compare a product's landed cost (produced by the existing door-to-door cost engine) against a local reference price and return a verdict of `cheaper`, `more_expensive`, or `break_even`, with the absolute and percentage difference expressed in both USD and ARS.

#### Scenario: Import cheaper

- GIVEN landed cost 100 USD and local price 150 USD
- WHEN the comparison runs
- THEN the verdict is `cheaper` with absolute difference 50 USD and percentage 33.3%
- AND both differences are also reported in ARS

#### Scenario: Break-even

- GIVEN landed cost equals local price
- WHEN the comparison runs
- THEN the verdict is `break_even` with zero differences

#### Scenario: Import more expensive

- GIVEN landed cost 200 USD and local price 150 USD
- WHEN the comparison runs
- THEN the verdict is `more_expensive` with absolute difference 50 USD

#### Scenario: Missing local price

- GIVEN no local reference price is provided
- WHEN the comparison runs
- THEN the system reports that no verdict is available instead of assuming a price or failing

### Requirement: Reuse Existing Tax Engine

The verdict layer MUST consume the existing door-to-door cost calculation and MUST NOT fork, duplicate, or modify the audited tax matrix.

#### Scenario: Engine reuse

- GIVEN a completed wizard cost calculation
- WHEN the verdict layer needs the landed cost
- THEN it uses the existing engine's output without recalculating taxes independently

### Requirement: Explicit Impuesto PAIS Line

The cost breakdown MUST render Impuesto PAIS as an explicit informational line at 0%, marked as eliminated, and MUST NOT omit it silently.

#### Scenario: PAIS visible at zero

- GIVEN any cost breakdown rendered to the user
- WHEN the tax lines are displayed
- THEN an Impuesto PAIS line appears with rate 0% and an eliminated-status note

#### Scenario: Never omitted

- GIVEN a breakdown with all other taxes at zero
- WHEN the tax lines are displayed
- THEN the Impuesto PAIS 0% line is still present

### Requirement: Bienes Personales Percepción Input

The system MUST offer an optional Bienes Personales percepción input defaulting to 0%, with a configurable rate that MUST be reflected in the total landed cost when non-zero.

#### Scenario: Default zero

- GIVEN the user provides no BP rate
- WHEN the cost is calculated
- THEN BP percepción contributes 0 and the total matches the pre-BP result

#### Scenario: Non-zero rate applied

- GIVEN a BP rate of 1% set by the user
- WHEN the cost is calculated
- THEN the BP percepción amount appears in the breakdown and raises the total accordingly

### Requirement: Insurance Preset

The system SHOULD offer an insurance preset of approximately 1.1% of FOB plus freight as the default suggested value, and MUST allow the user to override it with an explicit amount.

#### Scenario: Preset default

- GIVEN FOB 1000 and freight 200 with no manual insurance
- WHEN the preset is applied
- THEN insurance is suggested as ~13.2 (1.1% of 1200)

#### Scenario: Manual override

- GIVEN the user enters an explicit insurance amount
- WHEN the cost is calculated
- THEN the explicit amount is used and the preset is not applied

### Requirement: Wizard Surfaces

The import wizard MUST expose the local price, BP percepción, and insurance inputs at the cost-input steps, and the final step MUST surface the comparison verdict when a local price exists.

#### Scenario: Inputs surfaced

- GIVEN the wizard at its cost-input steps
- WHEN the user reaches them
- THEN local price, BP percepción, and insurance inputs are available

#### Scenario: Verdict shown at summary

- GIVEN a completed calculation with a local price
- WHEN the final step renders
- THEN the verdict with differences in USD and ARS is displayed

#### Scenario: No local price at summary

- GIVEN a completed calculation without a local price
- WHEN the final step renders
- THEN the summary shows no verdict and no error
