# Parser Iteration Loop (PIL) — workflow de mejora continua del extractor

Objetivo: atacar en loop constante los dos dolores reales — **tiempos de carga**
y **calidad de extracción** — con evidencia medible, una iteración a la vez,
sin regresiones.

## Reglas de la casa

- **Una iteración = un patrón de falla.** Nada de refactors broad: se elige el
  patrón dominante del baseline, se ataca, se mide, se cierra.
- **El gate es innegociable** (ver Gates abajo). Si el gate no pasa, la
  iteración no se commitea.
- Los archivos del núcleo (`src/js/pdfParser.js`, `scripts/ground-truth.js`,
  `scripts/measure-model-quality.js`, `scripts/measure-extraction.js`,
  `ground-truth/`, `openspec/`) se tocan SOLO dentro de una iteración abierta
  y con el workflow de abajo. Nada de edits sueltos.
- Cada iteración cierra con commit corto + entrada en `docs/PIL-baselines.md`
  (métricas antes/después).

## El ciclo

```
1. BASELINE      → medir con los PDFs reales (abajo)
2. DIAGNÓSTICO   → top de fallos por patrón (dónde pierde recall / dónde se va el tiempo)
3. FIX DIRIGIDO  → una causa por iteración, con test que falle antes (RED)
4. GATE          → suite completa + ground-truth + extracción batch
5. COMMIT        → corto + métricas antes/después en docs/PIL-baselines.md
6. REPETIR       → siguiente patrón del baseline
```

## Comandos (correr desde la raíz del repo)

```bash
export MAMBO_CATALOG_DIR="$HOME/Downloads"   # los 13 PDFs reales están acá en Linux

# 1. Baseline de calidad de extracción (parser actual vs snapshot etiquetado)
node scripts/ground-truth-diff.js                 # estado del snapshot (ids casados)
node scripts/measure-model-quality.js             # recall/FP del snapshot (NO del parser actual)
node scripts/measure-extraction.js                # extracción actual PDF por PDF

# 2. Auditoría integral (calidad, assignment, fotos)
npm run audit:full                                # escribe audit-app-report.json
npm run photo:baseline                            # baseline de imágenes

# 3. Gates (bloquean cada iteración)
npm run test          # 1.504 aserciones / 4 suites
npm run lint          # 0 errores
npm run check:version
MAMBO_CATALOG_DIR="$HOME/Downloads" npm run audit:quick
```

### Tiempos de carga

Si la queja es "tarda", el primer paso es **profiling, no optimizar a ciegas**:
- El batch de extracción con los 13 PDFs (`measure-extraction.js`) da el tiempo
  por PDF → identificar los PDFs lentos.
- En la app: importar un PDF y medir fases (parse → heurísticas → gates de
  imagen/OCRed) con `performance.now()` alrededor de cada fase.
- Optimizar solo la fase dominante, nunca por intuición.

## Qué reportar por iteración

```
Iteración N: <patrón atacado>
Antes: recall dirty=..% FP=..% | <pdf más lento> = ..s
Después: recall dirty=..% FP=..% | <pdf más lento> = ..s
Gate: test .. / lint .. / ground-truth sin regresión ..
Commit: <hash>
```

## Gates (inalterables)

1. `npm run test` → 0 FAIL (1.504 aserciones)
2. `npm run lint` → 0 errores
3. `ground-truth-diff` → 0 casos NO-regresión sentinel rotos
4. `audit:quick` → sin errores nuevos
5. El cambio toca un patrón, no el extractor entero

## Estado inicial (baseline 2026-08-30)

- Snapshot etiquetado vs parser actual: **52,3% de ids coinciden** — el
  snapshot está desfasado (65 casos a re-etiquetar con
  `node scripts/ground-truth-diff.js --packet`).
- Visual ground truth (n=65): recall dirty **100%** (40/40), FP 2/25 en clean
  (snapshot viejo, no mide el parser de hoy).
- PDFs reales: 13 en `~/Downloads` (8BitDo, AJAZZ, ATK, Attack Shark, AULA,
  Irok, Keychron, KZ, Logitech, Madlions, Razer, RK, MCHOSE).
- El primer paso recomendado es **re-etiquetar el snapshot** para que las
  métricas vuelvan a describir el parser actual; sin eso, el loop mide humo.