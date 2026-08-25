# AGENTS.md — Mambo Pedidos

## Sesiones paralelas (IMPORTANTE)
Este repo se trabaja con VARIAS sesiones de agente en paralelo sobre el
mismo working tree (misma carpeta en disco). Reglas:

1. **FASE 2 (table-parser)**: `src/js/pdfParser.js` lo está reescribiendo
   otra sesión siguiendo `openspec/changes/table-parser-column-detection/`.
   NO tocar `src/js/pdfParser.js` ni `scripts/ground-truth.js`,
   `scripts/measure-model-quality.js`, `scripts/measure-extraction.js`,
   `ground-truth/` ni `openspec/` salvo que esa fase esté cerrada.
2. **Archivos scratch de FASE 2**: `scripts/_dbg_*`, `scripts/_splice*`,
   `scripts/_t1.js` son debug (ignorados en git y lint). No commitearlos.
3. **Commit/push final**: cuando la FASE 2 cierre, UNA sola sesión hace:
   `git status` (confirmar que no quede trabajo sin guardar de otra
   sesión) → `git add -A` → `git commit` → `git push`. No hace falta
   repetirlo en cada sesión: git es estado del repo, no de la sesión.

## Workflow: ponytail (reduce over-engineering)
ponytail (DietrichGebert/ponytail) is installed project-local in `.pi/settings.json`;
its ruleset is injected into every session automatically (pi extension, default level
`full`) and it ships the `/ponytail [lite|full|ultra|off]`, `/ponytail-review`,
`/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help` commands.

Before writing any code, run the ladder and stop at the first rung that holds:

```
1. Does this need to exist?  -> no: skip it (YAGNI)
2. Already in this codebase? -> reuse it, don't rewrite
3. Stdlib does it?           -> use it
4. Native platform feature?  -> use it
5. Installed dependency?     -> use it
6. One line?                 -> one line
7. Only then: the minimum that works
```

Lazy about the solution, NEVER lazy about reading: read the code the change touches and
trace the real flow before picking a rung. Never cut validation, error handling,
security, or accessibility to shrink code.

Scoped audit: ponytail review/audit covers only non-FASE-2 areas. DO NOT touch
`src/js/pdfParser.js`, `scripts/ground-truth.js`, `scripts/measure-model-quality.js`,
`scripts/measure-extraction.js`, `ground-truth/`, `openspec/` (owned by the parallel
FASE 2 session), and never commit `scripts/_dbg_*`, `scripts/_splice*`, `scripts/_t1.js`.

## Verificación estándar
- `npm run test` (660 tests) · `npm run lint` (0 errores) · `npm run check:version`
- Gates de FASE 2 (antes de cerrar): `scripts/ground-truth.js` + diff contra
  `ground-truth/verdicts.json` y `scripts/measure-model-quality.js` sin
  regresión (ver tasks.md de la FASE 2).

## Estilo de commits
Conventional Commits, uno por tema: `feat(ui): ...`, `fix(pipeline): ...`,
`perf(catalog): ...`. Mensajes en inglés.
