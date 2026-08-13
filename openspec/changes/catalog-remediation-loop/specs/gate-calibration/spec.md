# gate-calibration Specification

## Purpose

Fix gate false positives with labeled audits and fixture tests, without ever weakening a gate to absorb a true positive. The MODEL_MARKETING gate currently fires on legitimate noun phrases: the verified mechanism is that `MARKETING_WORDS_RE` contains `dual`, so 8bitdo's "Dual Charging Dock Xbox" (1 marketing word, no digit, no code) is flagged YELLOW even though it is a legitimate product name. This capability distinguishes puffery stacks from legitimate noun phrases, classifies switch/axis tokens as product nouns, makes every status degradation carry an atomic reason (NO_OBSERVATIONS → 0), and reports calibration deltas per gate. Baseline (FINAL5, n=2309): 1605 GREEN / 656 YELLOW / 48 RED; MODEL_MARKETING = 111 items, SWITCH_IN_MODEL = 19 items, NO_OBSERVATIONS = 7 items.

## Requirements

### Requirement: Noun-phrase calibration for MODEL_MARKETING

The MODEL_MARKETING gate MUST NOT flag a model that is a legitimate noun phrase: a product/category noun (dock, charger, hub, stand, pad, grip, case, cover, keyboard, mouse, keypad, and the like) with ≤ 1 marketing adjective and no product code. The noun-phrase vocabulary MUST derive from category keywords plus a known-good model lexicon bootstrapped from data — products that are GREEN after gates and survive 2 iterations; the vocabulary MUST NOT be built from brand names. A puffery stack (≥ 2 marketing adjectives, no product noun, no code) MUST stay YELLOW with `MODEL_MARKETING`.

#### Scenario: Legitimate noun phrase with one marketing word

- **GIVEN** the FINAL5 item "Dual Charging Dock Xbox" (8bitdo) with 1 marketing word ("Dual"), product noun "Dock", and no code
- **WHEN** the calibrated MODEL_MARKETING gate runs
- **THEN** the item is GREEN, has no MODEL_MARKETING warning, and the gate records classification evidence `{pattern:"noun-phrase", noun:"Dock", marketingWords:1}`

#### Scenario: Puffery stack stays YELLOW

- **GIVEN** a model "Ultra Crystalblade Gleam" with ≥ 2 marketing adjectives, no product noun, and no code
- **WHEN** the calibrated MODEL_MARKETING gate runs
- **THEN** the item stays YELLOW with reason `MODEL_MARKETING` and warning naming the puffery stack

#### Scenario: Code rule is untouched by calibration

- **GIVEN** a model "AJ139 Pro 68 Keys" that is already GREEN via the code rule
- **WHEN** the calibrated gate runs
- **THEN** the classification is unchanged (GREEN) and calibration introduces no new warning

### Requirement: Switch/axis noun classification

Switch/axis type tokens (magnetic, hall effect, red/brown/blue switch, and the like) MUST be recognized as product-relevant nouns for MODEL_MARKETING classification; a model carrying a switch/axis token MUST NOT be treated as marketing puffery. When such a model has no code, the gate MUST classify it as `SWITCH_IN_MODEL` (actionable by the switch-to-variante remediation strategy) with evidence naming the switch token, never as `MODEL_MARKETING`.

#### Scenario: Switch token classifies as SWITCH_IN_MODEL

- **GIVEN** a model "Magnetic Switch T9" with switch token "Magnetic Switch", no code
- **WHEN** the calibrated marketing gate runs
- **THEN** the item is YELLOW with reason `SWITCH_IN_MODEL` and classification evidence `{switchToken:"Magnetic Switch", remainingModel:"T9"}`, and no MODEL_MARKETING warning

#### Scenario: Switch token is not puffery

- **GIVEN** a model "Gateron Red Switch 87 Keys" with switch/axis tokens and a product noun
- **WHEN** the calibrated gate runs
- **THEN** the item is classified by its real identity (noun phrase, not puffery) and never gets the puffery treatment

### Requirement: Reason instrumentation (NO_OBSERVATIONS = 0)

Every YELLOW/RED transition MUST carry an atomic `qualityReason`; the gate composition MUST be extended so that no status degradation is possible without pushing a warning/reason. A degradation attempt without a reason MUST be treated as a pipeline invariant failure: the item is flagged `UNCLASSIFIED_YELLOW` as a pipeline defect and MUST NOT be promoted. The 7 FINAL5 `NO_OBSERVATIONS` items MUST be re-diagnosed by re-running the gates with instrumentation on; any item for which no reason is derivable MUST be flagged `UNCLASSIFIED_YELLOW`. After calibration, the byReason report MUST show `NO_OBSERVATIONS = 0`.

#### Scenario: Re-diagnosis of legacy NO_OBSERVATIONS items

- **GIVEN** the 7 FINAL5 items previously reported with reason `NO_OBSERVATIONS`
- **WHEN** the gates are re-run with reason instrumentation enabled
- **THEN** every item carries an atomic reason and the byReason report shows `NO_OBSERVATIONS: 0`; items without a derivable reason appear as `UNCLASSIFIED_YELLOW`

#### Scenario: Degradation without a reason is a defect

- **GIVEN** a gate composition attempting to degrade an item to YELLOW without attaching a reason
- **WHEN** the instrumented composition runs
- **THEN** the invariant fails, the item is flagged `UNCLASSIFIED_YELLOW` with reason "Degradación sin razón atómica", the failure is reported as a pipeline defect, and the item is never promoted

### Requirement: Calibration-delta report

The calibration pass MUST produce a per-gate report with FP and FN counts before and after calibration, and the labeled audit sample size used for each gate. Every rule change MUST ship its labeled-audit evidence and a fixture test in `src/js/tests.js`.

#### Scenario: MODEL_MARKETING calibration delta is reported

- **GIVEN** a labeled audit of the 111 FINAL5 MODEL_MARKETING items (sample size recorded)
- **WHEN** the calibration pass runs and the report is generated
- **THEN** the report contains a MODEL_MARKETING row with before/after FP and FN counts, the audit sample size, and after-calibration FP lower than before while FN does not increase

#### Scenario: Fixture test ships with each rule change

- **GIVEN** a rule change accepted by the calibration pass
- **WHEN** `npm test` runs
- **THEN** a fixture test in `src/js/tests.js` exercises the new rule on both the fixed item and a same-pattern variant, and passes

### Requirement: Fail-closed calibration

Calibration MUST NEVER weaken a gate to absorb a true positive. A candidate rule change that reduces FP by increasing FN on the labeled audit MUST be rejected, as must any change that removes a gate check without labeled evidence. After calibration, on the labeled audit, FP MUST NOT increase and FN MUST NOT increase relative to the before state.

#### Scenario: Rule that absorbs a true positive is rejected

- **GIVEN** a candidate change that suppresses MODEL_MARKETING for all marketing-word models regardless of noun presence
- **WHEN** the labeled audit evaluates the candidate
- **THEN** FN increases (puffery stacks with no noun are absorbed), the change is rejected, and the gate keeps its prior behavior with no fixture test shipped
