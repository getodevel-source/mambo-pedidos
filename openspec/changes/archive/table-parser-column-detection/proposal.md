# Proposal: table-parser column detection (FASE 2 — model accuracy)

## Why
The honest-semaphore work (change `honest-model-quality`, FASE 1) proved that the
`99% GREEN` metric measured *structural completeness*, not *accuracy*: visual
ground-truth over a seeded sample (`ground-truth/verdicts.json`, n=65) showed
**45% of GREEN products carried a wrong or dirty model** (95% CI ±12%). Price is
reliable (~97% when grounded); category ~94%; **model/variant ~38% clean**.

FASE 1 downgrades the *pattern-detectable* dirt (datasheet specs → RED, glued
switch / truncated / lost-code → YELLOW) so the semaphore stops lying. But it
cannot fix the extracted value, and it cannot see *semantic* errors (wrong
column, merged-cell code loss). Those need the extractor itself to understand
table structure. This change is that extractor rewrite.

## Root causes (from ground-truth, not guesswork)
The positional extractor assumes a `model | color | image | price` layout. Real
catalogs use three layouts it does not handle:
1. **Separate switch/axis column** (`model | switch | color | img | RMB | USD`) —
   most keyboards (Ajazz, Aula, ATK, RK, MCHOSE, Madlions, Irok). The switch text
   is merged into the model (`S98 Glacier Axis Universe` instead of `S98 Universe`).
2. **Vertically merged model cells** (one model label spanning N color rows) —
   the model is lost on the color rows, or a price row aligns to the wrong model
   (Logitech `M750 M` price shown under `M720`).
3. **Price matrices** (KZ: RMB/USD rows × model columns; Haimu: switch name in a
   column read as specs) — the real model sits in a header far from the price
   anchor, so a description/spec is associated instead.

## What changes
Rewrite table extraction to detect columns by **header** and **structure**, not
only by relative X. Delivered in 4 independently-verifiable slices (see tasks).
Each slice ships behind the ground-truth harness as its acceptance gate.

## Non-goals
- No per-catalog hard-coding (every fix must be layout-generic).
- No LLM/VLM dependency (stays deterministic; enrichment remains optional).
- Do not touch the R1–R10 contract or the honest semaphore (FASE 1) semantics.

## Risk / why not done blind inline
A blind inline rewrite regresses the catalogs that already extract well
(Logitech mice, Razer, 8BitDo). Therefore every slice is gated by
`scripts/ground-truth.js` + `scripts/measure-model-quality.js`: a slice merges
only if the targeted CRITICO/CAMPO cases improve **and** no prior OK/MENOR case
becomes CRITICO (measured no-regression). This is the only genuine path to 100%.
