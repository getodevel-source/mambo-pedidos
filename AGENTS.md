# AGENTS.md — Mambo Pedidos

## Sesiones paralelas (IMPORTANTE)
Este repo se trabaja con VARIAS sesiones de agente en paralelo sobre el
mismo working tree (misma carpeta en disco). Reglas:

1. **FASE 2 (table-parser): CERRADA.** El feature quedó en `c885081` y el
   change se archivó en `3e8a8f9` (ver `PONYTAIL_AUDIT.md`, sección
   "Decisions (user)"). La regla sigue vigente para cualquier fase que se
   reabra sobre estos archivos: NO tocar `src/js/pdfParser.js`,
   `scripts/ground-truth.js`, `scripts/measure-model-quality.js`,
   `scripts/measure-extraction.js`, `ground-truth/` ni `openspec/` mientras
   otra sesión los tenga activos. Antes de editarlos, confirmar que no hay
   fase abierta (preguntar en la sesión dueña, no asumir).
2. **Archivos scratch de FASE 2**: `scripts/_dbg_*`, `scripts/_splice*`,
   `scripts/_t1.js` son debug (ignorados en git y lint). No commitearlos.
3. **Commit/push final**: cuando cierra una fase, UNA sola sesión hace:
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

Scoped audit: FASE 2 is closed, so those files are no longer owned by another
session — but they are the extraction core: read before touching and keep the
ground-truth gates (`scripts/ground-truth.js` vs `ground-truth/verdicts.json` y
`scripts/measure-model-quality.js`) sin regresión. Never commit `scripts/_dbg_*`,
`scripts/_splice*`, `scripts/_t1.js` (scratch).

## Corpus de catálogos (los PDFs reales)

Los 13 PDFs de proveedores están en `C:\Mambo catalogos` — **con espacio, en la
raíz de C:**, no en `C:\Mambo\Catalogos`, que es el default hardcodeado. Los
scripts que lo leen (`audit-app.js`, `ground-truth.js`, `measure-extraction.js`,
`export-catalog-batch.js`) aceptan `MAMBO_CATALOG_DIR`, así que alcanza con:

```bash
MAMBO_CATALOG_DIR="C:\Mambo catalogos" npm run audit:full
MAMBO_CATALOG_DIR="C:\Mambo catalogos" node scripts/export-catalog-batch.js catalog-export.json
npm run photo:baseline   # mide el export y escribe ground-truth/photo-baseline.json
```

Sin esa variable esos scripts avisan "no existe la carpeta" y la tarea parece
bloqueada por entorno. Dos cosas para no perder tiempo:

- `ground-truth.js` escribe `manifest.candidate.json` y **no toca el
  `manifest.json` versionado** salvo que pases `--write`. La referencia es el par
  `manifest.json` + `verdicts.json`, y están casados por posición de muestreo.
- `measure-model-quality.js` puntúa contra ese snapshot etiquetado, así que su
  recall/FP describe la extracción que se etiquetó, **no el parser actual**. Para
  saber si todavía sirve, `node scripts/ground-truth-diff.js` (hoy: 52,3% de los
  ids coinciden; hace falta re-etiquetar 65 casos con
  `node scripts/ground-truth-diff.js --packet`).

## Verificación estándar- `npm run test` (1.504 aserciones en 4 suites: 1.028 unitarias + 101 de UI
  smoke + 239 de lógica + 129 de `app.js` en jsdom) · `npm run lint`
  (0 errores) · `npm run check:version` · `npm run build:frontend`
- `npm run e2e` es lo único que verifica el runtime real (Tauri + WebView2).
  Local: primero `npm run e2e:build` (compila el binario con
  `src-tauri/tauri.e2e.conf.json`, que es lo único que expone el puerto de CDP
  porque wry pasa sus propios `additionalBrowserArgs`) y necesita Node >= 22
  por el `WebSocket` global. Eso corre solo en el job `e2e-windows` de CI.
  Cubre el puente de plugins, `AppStorage.mode === 'tauri'`, el roundtrip del
  store y el de `images/` en `%APPDATA%`, y la consola limpia al load. Ese
  último ítem ya cazó un `SyntaxError` que Node no puede ver: los `<script>`
  clásicos comparten el scope léxico global, así que un `const` redeclarado
  aborta un módulo entero sin tocar las suites.

## Estilo de commits
Conventional Commits, uno por tema: `feat(ui): ...`, `fix(pipeline): ...`,
`perf(catalog): ...`. Mensajes en inglés.
