# Smoke test E2E de integración Tauri/WebView2 (e2e-smoke-test)

## Problema (medido 10-11/08/2026)

La app "Mambo Pedidos" reiteradamente pasa los gates unitarios (171 tests de
lógica pura en Node, lint 0) y aun así llega a producción con bugs de
**integración con el runtime real** que los unit tests jamás tocan:

- **CSP / botones muertos** (v2.0.3): 217 elementos con `onclick` inline
  bloqueados por la CSP de WebView2 (Tauri agrega ~30 hashes sha256 que anulan
  `'unsafe-inline'`). Los `b.onclick` quedaban tipo "object" no-callable →
  "b.onclick is not a function". Se rompía TODA la navegación por botón, y
  ninguno de los 171 unit tests lo ve (el browser normal tampoco, sólo el
  runtime Tauri). Fix: `dangerousDisableAssetCspModification`.
- **Store null** (v2.0.4): `AppStorage.init()` buscaba `createStore`, que el
  plugin de Tauri v2 no expone (`getStore`/`Store.load` es la API). `storeInstance`
  quedaba `null` y la app degradaba en silencio a localStorage — persistencia
  rota y feature de fotos-a-archivo inoperante. Fix: fallback `Store.load`.
- **Botón "Cargar Demo"** persistente en rect 0x0 (empty-state oculto).

Patrón: los bugs reales viven en la capa de integración (CSP, IPC, store del
plugin, dimensiones del DOM real), fuera del alcance de `npm test` y del
browser headless. El costo de cada uno fue alto (release + debug en vivo).

## Dirección

Un **smoke test E2E determinístico** que arrranca la app real (Tauri +
WebView2) con `--remote-debugging-port`, y por CDP verifica las exactas cosas
que se rompen en la integración:

1. **Consola sin errores** al load (excepciones + console.error).
2. **Botones vivos**: los de navegación tienen tamaño > 0 y un click real
   cambia la vista activa (caza el bug de CSP).
3. **Store real**: `AppStorage` resuelve a una instancia de store del plugin
   (no null / no fallback silencioso) y hace set/get/save/reload exitoso
   (caza el bug de store).
4. **Catálogo carga**: N filas en `tbody` tras cargar demo.

Sale con exit≠0 si algo falla. Corre en pre-push y en el flujo de release.
Sin Playwright ni frameworks: CDP crudo sobre el WebView2 real (ya existe el
cableado en `scripts/_dbg_*` que se promueve a script versionado).

## Criterios de cierre (todos falsables)

- [ ] `npm run e2e` sobre la app real (build no-bundle) devuelve exit 0.
- [ ] Caza al menos 1 bug de integración que los unit tests no ven (regresión
      guard). Si no caza ninguno nuevo, al menos verifica los 2 ya arreglados
      (CSP botones + store) como regresión.
- [ ] `npm run test` (171) + `npm run lint` (0) + `npm run check:version` OK.
- [ ] Script versionado (no `_dbg_*`), reutilizable y sin estado acumulado.

## Archivos

- `scripts/e2e-smoke.js` — el smoke test (versionado, no `_dbg_*`).
- `package.json` — script `npm run e2e`.
- `openspec/changes/e2e-smoke-test/tasks.md` — unidades.