# loop-orchestration Specification

## Purpose

The per-item remediation loop over the catalog: diagnose the exact atomic reason, apply the deterministic remediation strategy for that failure class, re-run the full gate stack, and promote to GREEN only with evidence — iterating to a fixed point. The loop is implemented in `scripts/remediate-catalog.js`, keeps a per-run ledger, converges to a fixed point, is idempotent, emits a human-review report when the honest GREEN ceiling lands below 99%, gates every strategy behind `config.remediation`, and proves generalization with leave-one-catalog-out hold-out validation, synthetic stress tests, and hard anti-overfit audits. Baseline (FINAL5, n=2309): 1605 GREEN (69%) / 656 YELLOW / 48 RED (filtered at import); hard success criterion GREEN ≥ 99% (≥ 2286 of 2309), honest.

## Requirements

### Requirement: Per-item diagnose → remediate → re-verify → promote-or-stay

The loop MUST process every non-GREEN catalog item: diagnose its atomic `qualityReason`, apply the remediation strategy mapped to that reason (config-gated), re-run the full gate stack (`runFullValidation` → `ImageTextGates` → `CatalogAssignmentGates`) on the remediated item, and promote to GREEN ONLY on a full-gate pass AND valid `remediationEvidence`. An item whose remediation still fails a gate MUST stay YELLOW/RED with its atomic reason and MUST NOT be promoted.

#### Scenario: Item promoted with evidence

- **GIVEN** a FOB_NO_LITERAL_EVIDENCE item whose row band contains a literal price token
- **WHEN** the loop diagnoses, applies literal-anchor-search, and re-verifies with the full gate stack
- **THEN** the item is GREEN, carries `remediationEvidence` with `groundingMode:"literal"`, and the full gate stack passes

#### Scenario: Failed re-verification stays flagged

- **GIVEN** a COLOR_MISMATCH item whose remediation still fails a gate after re-verification
- **WHEN** the loop re-verifies the remediated item
- **THEN** the item stays YELLOW with its atomic reason and the ledger records outcome `stayed`

### Requirement: Loop ledger

The loop MUST write a ledger entry for every non-GREEN item on every run with exactly these fields: SKU, original reason, strategy applied, outcome (promoted / stayed / bounded-irremediable), and evidence (the `remediationEvidence` or the atomic reason when not promoted). The ledger MUST be part of the metrics report each iteration.

#### Scenario: Ledger covers the corpus

- **GIVEN** a full loop run over FINAL5
- **WHEN** the ledger is written
- **THEN** every non-GREEN item (656 YELLOW baseline) has one entry with SKU, original reason, strategy, outcome, and evidence, and per-class resolution (class → remediated → promoted → stayed) is reported

### Requirement: Fixed-point convergence

The loop MUST iterate until a pass changes no item's status, and MUST confirm the fixed point with two identical passes before terminating. If a pass still changes statuses, the loop MUST continue.

#### Scenario: Two identical passes converge

- **GIVEN** a loop run where pass N and pass N+1 produce identical per-status and per-reason counts
- **WHEN** the loop checks convergence
- **THEN** the loop terminates and reports the fixed point with the final GREEN/YELLOW/RED counts

#### Scenario: Status changes continue the loop

- **GIVEN** a pass that promoted at least one item or changed any status
- **WHEN** the loop checks convergence
- **THEN** the loop runs another pass instead of terminating

### Requirement: Idempotency on a remediated export

Re-running the loop on an already-remediated export MUST be a no-op: no item changes status and no strategy re-applies. Every strategy MUST detect already-remediated state (for example evidence already present, `variante` already carrying the moved color/token, or the code already adopted) before applying.

#### Scenario: Re-run changes nothing

- **GIVEN** an export already remediated by a previous loop run
- **WHEN** the loop runs again
- **THEN** the status counts are identical, the ledger records zero remediations, and no item's evidence changes

### Requirement: Human-review report when GREEN < 99%

GREEN ≥ 99% (≥ 2286 of 2309 on FINAL5) is a HARD success criterion. If the honest fixed point lands below 99%, the loop MUST emit a human-review report listing every remaining non-GREEN item as SKU → class → reason → why not remediable, and the change MUST NOT be reported as closed. Every applicable remediation strategy MUST be exhausted before any item is declared bounded-irremediable. When the fixed point meets 99%, bounded-irremediable remainder items MUST still be declared with class and reason.

#### Scenario: Fixed point below 99% blocks closure

- **GIVEN** a fixed point at 98.5% GREEN with 34 remaining non-GREEN items all bounded-irremediable
- **WHEN** the loop finishes
- **THEN** a human-review report is emitted with all 34 items (SKU, class, reason, why not remediable) and the loop result is not a closed change

#### Scenario: Fixed point at or above 99% with declared remainder

- **GIVEN** a fixed point at 99.2% GREEN with bounded-irremediable remainder items
- **WHEN** the loop finishes
- **THEN** the 99% criterion is met and every bounded-irremediable remainder item is still declared with class and reason in the ledger

### Requirement: Config-gated strategies and rollback

The loop MUST read `config.remediation = { enabled, strategies: { colorFromImage, literalAnchorSearch, nounPhraseCalibration, ... } }`. A disabled strategy MUST NOT run; with `enabled:false` the loop MUST perform no remediation at all (measure-only, like the current `quality-iterate.js`). Flipping a strategy or the whole loop off MUST restore prior behavior; the complete rollback is a config flip plus reverting the remediation files, with no storage or migration delta.

#### Scenario: Disabled strategy does not run

- **GIVEN** `config.remediation.strategies.colorFromImage = false`
- **WHEN** the loop runs over COLOR_MISMATCH items
- **THEN** no COLOR_MISMATCH item is remediated and their statuses match the pre-change baseline for that strategy

#### Scenario: Loop disabled is measure-only

- **GIVEN** `config.remediation.enabled = false`
- **WHEN** the loop runs
- **THEN** the loop performs diagnosis and measurement only, no item changes status, and the report matches the current `quality-iterate.js` measure-only behavior

### Requirement: Generalization validation (hold-out, stress, anti-overfit)

The loop MUST run all three generalization validations every iteration and report their results. (1) Leave-one-catalog-out hold-out: rules are derived/tuned on 12 catalogs and validated on the 13th; a rule qualifies only if it resolves its class on the held-out catalog without introducing FPs there, and per-class resolution on the held-out catalog MUST be reported every iteration. (2) Synthetic stress tests: mutated fixture models (truncation, marketing words, switch tokens, generic words) MUST assert remediation behavior and the anti-overfit guardrails, including the "Dual Charging Dock Xbox" noun-phrase pattern probed with fictional brand names. (3) Hard anti-overfit audits: a grep-based audit MUST find no brand or catalog strings in remediation source, every rule MUST ship a fixture test proving its structural pattern, and cross-brand probes (same pattern, different brand) MUST behave identically.

#### Scenario: Held-out rule qualifies

- **GIVEN** a rule derived on 12 catalogs
- **WHEN** it is validated on the held-out 13th catalog
- **THEN** the rule resolves its class on the held-out catalog with 0 new FPs and qualifies, and the per-class held-out resolution is reported

#### Scenario: Held-out rule introducing FPs does not qualify

- **GIVEN** a rule that introduces a new FP on the held-out catalog
- **WHEN** it is validated
- **THEN** the rule does not qualify and its promotions are not accepted

#### Scenario: Brand string in remediation source fails the audit

- **GIVEN** remediation source containing a brand or catalog name string
- **WHEN** the grep anti-overfit audit runs
- **THEN** the audit fails and the offending string must be removed before the rule ships

#### Scenario: Cross-brand probe behaves identically

- **GIVEN** the "Dual Charging Dock Xbox" noun-phrase pattern probed with a fictional brand name (for example "Novo Charging Dock Xbox")
- **WHEN** the calibrated gate and remediation run
- **THEN** the outcome is identical to the original pattern (same classification and evidence shape), proving the rule is structural, not brand-keyed
