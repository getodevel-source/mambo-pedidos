# Exploration: ground-truth findings that drive FASE 2

Method: seeded random sample (5/PDF, n=65) extracted by the real pipeline, each
source row rendered to a PNG crop (`ground-truth/crops/`), each crop read against
the source. Classification in `ground-truth/verdicts.json`:
OK=6 · MENOR=19 · CAMPO=11 · CRITICO=29.

## Findings by layout

### Separate switch column (most frequent)
The model column and the switch column are merged. Evidence (crop → extracted):
- #56 `RK-S98 Universe | White | Glacier Axis` → `S98 Glacier Axis Universe`
- #57 `R98 | Green | Misty Axis V2` → `Misty Axis R98`
- #59 `R96 | Cyan-blue | Kaihua Speed Axis` → `R98 Kaihua Speed Axis`
- #60 `RK-S98 Abyss | Green | Biluo Axis` → `S98 Biluo Axis Abyss`
- #11 `ATK A87 | Plum axis Pro | Sea Salt` → `A87 Plum axis Pro Sea Salt`
Fix path: Slice 1 (header/role mapping). Regex separation is NOT viable — the
switch sits between code and a model suffix (`...Axis Universe`), so only
column-role awareness resolves it.

### Vertically merged model cells
The model label appears once for several color/switch rows; color rows lose it.
- #62 model cell `Mchose Ace68GT` fused; row → `Mount Tai GT powder` (the switch)
- #64 model cell `MCHOSE K99 V3` fused; row → `Icy Creamsicle Horizon`
- #65 model cell `MCHOSE G98 PRO` fused; row → `Flame Switch`
- #48 model cell `MAD 68 V2` fused; row → `Snowlight HE Fiber 68 Dual Light`
Fix path: Slice 2 (column-scoped inheritance with code-presence guard).

### Price matrices
Model name lives in a header far from the price anchor.
- KZ #31–#35: grid `Without/With mic × {RMB,USD} × model-columns`; extracted
  model became a column description (`Transparent`, `High Resolution`).
- Haimu #36–#40: switch name column read as specs (`PC SeaSalt PA Silent 47 5g`).
Fix path: Slice 3 (matrix resolver). FASE 1 already REDs the Haimu specs
(unusable), so Slice 3 restores them as real products.

### Anchor/model misalignment
- #43 price `$29.57` (¥201.08 = M750 M) bound to model `M720`.
- #44 price `$43.96` (¥298.92 = G502 X) bound to model `G502 Hero`.
Fix path: Slice 4 (Y-overlap binding for fused model cells).

## What is NOT fixable by rules (why FASE 1 caps at ~40% recall)
Cases like #16 `contours`, #22 `Rose`, #33 `High Resolution` carry no
spec/switch/bracket token and no code in their row text — the error is purely
"the extractor read the wrong cell". Detecting that without structure would
require flagging every code-less model, which false-positives on valid names
(`Cobra`, `Polar`, `Anya`). Hence structural detection (this change) is the only
genuine fix, and the ground-truth harness is its acceptance oracle.
