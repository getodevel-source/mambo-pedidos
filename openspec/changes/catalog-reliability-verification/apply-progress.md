# Apply Progress — catalog-reliability-verification

## Slice 3: model-color-sanitization (PR 3) — DONE (tasks 3.1–3.6)

Strict TDD (RED → GREEN → REFACTOR) per `openspec/config.yaml` (`strict_tdd: true`, runner `npm test`). Slices 1–2 untouched: `src/js/pdfParser.js`, `src/js/importGates.js`, `src/js/imageTextGates.js`, `src/js/ui/importFlow.js`, `scripts/export-catalog-batch.js` NOT modified.

### TDD Cycle Evidence

| Task | Test location | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 (RED) | `src/js/tests.js::testColorFieldSanitization` | Unit | ✅ 1262 PASS baseline, EXIT=0 | ✅ 11 assertions FAIL (799/810) | — | — | — |
| 3.2 (GREEN) | `sanitizeColorField` + `fixItemsInPlace` wiring in `src/js/textSanitizer.js` | Unit | ✅ | ✅ RED seen | ✅ 810/810, EXIT=0 | ✅ 6 inputs + wiring (moved→variante / dropped) | ✅ vocabulary extracted to `COLOR_KEEP_WORDS`/`COLOR_REMOVAL_WORDS` |
| 3.3 (RED) | `src/js/tests.js::testInfallibilityGate` (flip M720 → YELLOW; 5 new FN asserts) | Unit | ✅ | ✅ 6 FAIL (810/816) | — | — | — |
| 3.4 (GREEN) | `assessModelQuality` rules 1–3 in `textSanitizer.js` | Unit | ✅ | ✅ RED seen | ✅ 816/816, EXIT=0 | ✅ 65-case ground truth (below) | ✅ indentation normalized to original scheme |
| 3.5 (RED) | `testInfallibilityGate` clean guards (`F75 Glacier` added; F75 Gasket Keyboard / AJ139 Pro / NJ07 Ultra NACODEX kept) | Unit (approval guard — locks GREEN, passes pre/post by design) | ✅ | ➖ N/A (guard) | ✅ passing | — | — |
| 3.6 (GREEN) | `scripts/measure-model-quality.js` + `scripts/quality/model-fn-fixtures.json` | Integration (FASE 2 gate) | ✅ baseline 85%/8% | — | ✅ recall 100% (40/40), FP 8% (2/25) | ✅ 10 fixtures verified | — |

### Test Summary

- Total tests written: 18 (11 color-field + 6 FN closure + 1 clean guard; 17 new PASS lines; 1 flip is a modified assertion)
- Total passing: full suite 1279 PASS · 0 FAIL · EXIT=0 (baseline 1262 → +17)
- Unit suite: 816/816; quality suites: 234/234, 101/101
- Layers: Unit (tests.js), Integration (measure-model-quality.js on 65-case ground truth)
- Approval tests: 4 clean-model guards (pre-existing + F75 Glacier added)
- Pure functions created: `TextSanitizer.sanitizeColorField` (+ `COLOR_KEEP_RE`, `COLOR_REMOVAL_WORDS` vocab)

### Part A — color field sanitization (3.1 RED, 3.2 GREEN)

- `TextSanitizer.sanitizeColorField(colorText)` → `{color, moved}`: keeps ONLY `COLOR_KEEP_WORDS` (CatalogValidator.COLOR_AUDIT_RE vocabulary + `transparent, smoke, mint, navy, beige` — synced with ImageTextGates.COLOR_KEEP_WORDS); removal vocabulary = CONNECTION_AUDIT_RE + CATEGORY_AUDIT_RE + `{switch, magnetic, hall effect}` (words already in CATEGORY_AUDIT_RE not duplicated); tokens that are neither are dropped (noise). Dedupes both outputs, preserves original casing, `moved` in text order.
- Wired into `fixItemsInPlace` right after `crossAuditFields`: `item.color` sanitized; moved tokens go to `variante` ONLY when `item.variante` was empty, else dropped; write block updated (`colorChanged` participates in the changed-detection; `item.color = saniColor ?? variante` so the existing color/variante sync never clobbers the sanitized color).
- RED: `'Black Mouse Wireless'` → `color='Black'`, moved contains Mouse+Wireless; `'Magnetic Switch White'` → `'White'`, moved Magnetic+Switch. Triangulated: `'Black Webcam'`, `'Black Keyboard Wireless'`, `'Wireless'` (→ color ''), `''` (→ no-op), and the two wiring paths (variante empty → moved assigned; variante non-empty → dropped).

### Part B — model FN closure (3.3 RED, 3.4 GREEN)

Design §IT17 discriminator decision implemented in `assessModelQuality` (YELLOW only, never RED):

1. **Connection+category co-occurrence WITH real code**: `mHasCode && CONNECTION_AUDIT_RE word && category=mouse` → YELLOW `'tipo de conexión y categoría dentro del modelo'`. **Deviation (documented, per design "vocabulary narrows" clause):** the bare `CONNECTION_AUDIT_RE + CATEGORY_AUDIT_RE` rule would add 4 FPs on the 65-case ground truth (`Cobra Wired Mouse`, `Mars68 SE wired keyboard`, `Ultimate 2C Wired Controller`, `Opus Quartz Wireless Headset` → 2/25 → 6/25 = 24% FP, over the 8% ceiling). Narrowed to the measured FN class (code + connection + `mouse`) — closes "M720 Wireless Mouse" and "G502 Wired Mouse" with zero new FPs. "F75 Gasket Keyboard" stays GREEN (Gasket ∉ CONNECTION_AUDIT_RE, verified).
2. **Category/spec fragment without code** (requires `!mHasCode`): restricted category vocab `{keycaps, backpack}` (deviation: `keys` removed from the design's vocab — a bare `keys` word flags clean "Flagship PRO 68 Keys", an FP; the FN "68 Keys Esport" is covered by the anchored bare-count instead) OR size fragment `\d+(\.\d+)?\s*("|inch|pulg)` OR material `powder` OR bare count `^\d+\s*Keys\b` (start-anchored) → YELLOW `'categoría/fragmento de especificación sin código real'`. Closes "68 Keys Esport", "0500 Backpack Tactical 15.6\"", "Mount Tai GT powder".
3. **Switch/axis extension**: `hall\s*effect` added, but a BARE "Hall Effect" model (whole phrase) is excluded (`/^hall\s*effect$/i`) — the ground truth keeps #2 "Hall Effect" (MENOR) GREEN; excluding it is required for the FP ceiling. Closes "Hall Effect Ace 68 Air".

`tests.js:281` (now :288) "M720 Wireless Mouse" flipped GREEN→YELLOW with a comment referencing design.md §IT17 resolution; `tests.js:270` (now :277) "F75 Gasket Keyboard"→GREEN preserved.

### Part C — regression guard (3.5 RED, 3.6 GREEN/REFACTOR)

- Clean guards stay GREEN: "F75 Glacier", "F75 Gasket Keyboard", "AJ139 Pro", "NJ07 Ultra NACODEX" (all in `testInfallibilityGate`).
- `node scripts/measure-model-quality.js`: **recall_dirty 40/40 = 100% (≥ 85% ✓), FP_rate_clean 2/25 = 8% (≤ 8% ✓)**. The 2 remaining FPs are pre-existing (#10 DIY NK61 Switch — switch rule; #19 F75 Glacier (Light — truncated); untouched by the new rules).
- `scripts/quality/model-fn-fixtures.json` added (contract-fixtures style): 6 FN fixtures (expected YELLOW, one per rule) + 4 clean guards (expected GREEN); all 10 verified programmatically against `assessModelQuality`.

### Files changed (slice 3 only)

| File | Action |
| --- | --- |
| `src/js/textSanitizer.js` | `sanitizeColorField`, `COLOR_KEEP_WORDS`, `COLOR_KEEP_RE`, `COLOR_REMOVAL_WORDS`, `fixItemsInPlace` wiring, `assessModelQuality` rules 1–3 |
| `src/js/tests.js` | `testColorFieldSanitization` (new), `testInfallibilityGate` FN closure + flip + clean guard |
| `scripts/quality/model-fn-fixtures.json` | New FN/clean fixtures (contract-fixtures style) |
| `openspec/changes/catalog-reliability-verification/tasks.md` | 3.1–3.6 checked; 3.7 deferred |

### Test commands run

- `npm test` → EXIT=0, 1279 PASS, 0 FAIL (baseline 1262 PASS)
- `node scripts/measure-model-quality.js` → recall 100%, FP 8%
- `npm run lint` → 0 errors, 25 pre-existing warnings (none in changed files)

### Deviations from design

1. Rule 1 category vocabulary narrowed to `mouse` (design's bare conn+cat rule = +4 FPs; design's own Open Questions authorize narrowing when FP set trips).
2. Rule 2 vocab `{keycaps, backpack}` (design listed `{keys, keycaps, backpack}`; `keys` alone flags clean "Flagship PRO 68 Keys" — covered instead by start-anchored bare count).
3. Rule 3 bare-"Hall Effect" exclusion (design's bare rule would flag clean #2 "Hall Effect" MENOR → FP).

### Remaining tasks

- `- [ ] 3.7 **REFACTOR** Full corpus run; report YELLOW delta by reason; confirm stored catalogs untouched (no migration).` — deferred per apply instructions (no full-corpus export).

### Workload / PR boundary

Slice 3 of PR 3 (stacked-to-main chain): ~165 changed lines across 3 source files + fixtures (within the 400-line per-slice budget). No commit/branch/PR created. Stored catalogs untouched (in-memory sanitization only — no persistence migration).

### Structured status consumed

Parent prompt supplied: `strict_tdd: true`, test runner `npm test`, slices 1–2 complete, artifact store hybrid. Native dispatcher not invoked (Engram-backed per orchestrator guard); readiness confirmed directly from Engram topic keys `sdd/catalog-reliability-verification/{tasks,spec,design}` (read before work). `applyState`: not blocked; `actionContext.mode`: no edit-root warnings beyond delegated scope.

### Persistence note

Engram HTTP server was unreachable at `http://127.0.0.1:7437` for the entire apply (mem_search/mem_save failures). This apply-progress is persisted to the OpenSpec file side of the hybrid store; the `sdd/catalog-reliability-verification/apply-progress` Engram topic could NOT be read-merged or updated. Re-sync to Engram once the server is back (parent/orchestrator action).
