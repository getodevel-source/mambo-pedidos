# performance-quality-guard Specification

## Purpose

Guard the pipeline itself while the remediation loop runs: measure per-iteration export time, gate-composition cost, and test/lint gates, with a regression alarm so "improve overall performance/quality" is measured, not asserted. The guard is measurement-only — it raises alarms and blocks "clean pass" claims, but adds no optimization workstream. It also acts as the regression tripwire for FASE 2: the loop must not regress the FASE 2 measurement semantics (recall ≥ 85%, FP ≤ 8%, measure-extraction 46/65 closed baseline). Baselines (FINAL5): full-corpus export ~8–10 min; FASE 2 gates recall_dirty 100% / FP_rate_clean 8% at ceiling; measure-extraction 46/65 closed.

## Requirements

### Requirement: Per-iteration export time guard

Each loop iteration MUST measure the full-corpus export time (FINAL5 baseline ~8–10 min) and MUST raise a regression alarm when the measured time exceeds the baseline tolerance. An iteration with an active regression alarm MUST NOT be reported as a clean pass. The guard is measurement-only: it does not trigger automatic optimization.

#### Scenario: Export regression raises an alarm

- **GIVEN** a loop iteration whose full-corpus export takes 15.0 minutes against an 8–10 min baseline
- **WHEN** the performance guard evaluates the iteration
- **THEN** a regression alarm is raised, the report records elapsed time and the alarm, and the iteration is not reported as clean

#### Scenario: Export within baseline passes

- **GIVEN** a loop iteration whose full-corpus export takes 9.2 minutes
- **WHEN** the performance guard evaluates the iteration
- **THEN** no alarm is raised and the report records the elapsed time

### Requirement: Gate-composition cost guard

The loop MUST measure the added cost of gate composition with remediation: diagnose plus full re-verification. Re-verification MUST be delta-only (only remediated items re-run the full gate stack) so the loop stays within the existing budget. A material regression in per-iteration gate-composition cost MUST raise an alarm and block a clean-pass claim.

#### Scenario: Delta-only re-verification contained

- **GIVEN** an iteration that remediates 100 items out of 2309
- **WHEN** the gate-composition cost is measured
- **THEN** only the 100 remediated items re-run the full gate stack, the per-iteration cost report is produced, and no alarm fires when the cost is within the budget

#### Scenario: Cost regression alarms

- **GIVEN** an iteration whose gate-composition cost exceeds the established budget (for example full re-verification of the whole corpus on every pass)
- **WHEN** the guard evaluates the iteration
- **THEN** a regression alarm is raised and the iteration is not reported as clean

### Requirement: Test and lint gates with regression alarm

Every loop iteration MUST run the existing test suite and lint before its results are accepted: `npm test` 0 failures and lint 0 errors. Any failure MUST block the iteration's promotions and raise the regression alarm.

#### Scenario: Broken test blocks the iteration

- **GIVEN** an iteration whose remediation rule change breaks an existing test
- **WHEN** the test gate runs
- **THEN** the iteration FAILS, no promotions from that iteration are accepted, and the regression alarm is raised

#### Scenario: Clean suite passes the gate

- **GIVEN** an iteration with the full existing test suite passing (0 failures) and lint at 0 errors
- **WHEN** the test gate runs
- **THEN** the iteration passes the test/lint gate and may proceed to report its results

### Requirement: FASE 2 no-regression gates

The loop MUST NOT regress FASE 2 measurement semantics: `ground-truth.js`, `measure-model-quality.js`, and `measure-extraction.js` MUST keep their behavior and their gates — recall ≥ 85%, FP ≤ 8%, measure-extraction 46/65 closed baseline. Each iteration MUST run these gates and fail on any regression. This capability MUST NOT rewrite the parser or the FASE 2 measurement scripts, and MUST NOT introduce OCR, LLM/provider usage, non-deterministic remediation, or storage/migration changes.

#### Scenario: FASE 2 gates hold after remediation

- **GIVEN** a loop run that remediated YELLOW items across the corpus
- **WHEN** `measure-model-quality.js` and `measure-extraction.js` run on the remediated export
- **THEN** recall is ≥ 85%, FP rate is ≤ 8%, and the extraction closed-case count is ≥ 46 of 65, so the FASE 2 gates pass with no regression

#### Scenario: Extraction regression fails the iteration

- **GIVEN** a loop run after which the extraction closed-case count drops below 46 of 65
- **WHEN** `measure-extraction.js` runs
- **THEN** the FASE 2 gate fails, the iteration is reported as a regression, and the offending remediation change is not accepted
