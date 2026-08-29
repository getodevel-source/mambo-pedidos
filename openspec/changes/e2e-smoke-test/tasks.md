# tasks — e2e-smoke-test

## U1 — Promover harness CDP a script versionado
Reutilizar el cableado de `scripts/_dbg_audit_full.js` (conexión WS, `send`,
`rc`, `realClick`, captura de console/exception) a `scripts/e2e-smoke.js`.
- [x] `scripts/e2e-smoke.js` con WS + `send`/`rc`/`realClick` + captura de logs.
- [x] No importa jsdom; requiere `ws` (o WebSocket global de Node ≥22).

## U2 — Verificación de consola y botones
- [x] Al load: `Runtime.exceptionThrown` y `Runtime.consoleAPICalled` (error)
      quedan vacíos → FAIL si hay excepciones al boot.
- [x] Botones de navegación `.nav-item[data-view=...]` con rect > 0.
- [x] Click real en cada nav cambia `.nav-item.active[data-view]` → FAIL si no.

## U3 — Verificación del store real
- [x] `AppStorage.storeInstance` es objeto (no null) → FAIL si null.
- [x] set/get/save/reload roundtrip exitoso (escribir clave, leerla, guardar,
      recargar, releer) → FAIL si no persiste.

## U4 — Catálogo carga
- [x] Tras disparar carga demo, `tbody tr` > 0 → FAIL si 0.

## U5 — Cablear npm
- [x] `package.json` → `"e2e": "node scripts/e2e-smoke.js"`.
- [ ] `npm run e2e` exit 0 con la app real corriendo. (ver nota abajo)

## U6 — Loop de auditoría hasta 0 bugs
- [ ] Correr `npm run e2e` + `npm run audit:full` sobre la app/catálogo reales.
- [ ] Registrar bugs, arreglar, re-correr hasta 0.

## Reconciliación 2026-08-29 (corrección de una claim falsa)

La caja de U5 "**`npm run e2e` exit 0** con la app real corriendo" estaba marcada
como hecha por `3c86bf9`, que razonó sobre el código del harness y no sobre una
ejecución. No se pudo cumplir nunca: `scripts/e2e-smoke.js` lanza
`src-tauri/target/release/mambo-pedidos.exe`, y en el repo no hay build del
binario ni toolchain Rust en esta máquina. Vuelve a estar abierta.

Consecuencia directa: el probe de U3 ("`AppStorage.storeInstance` es objeto, no
null") estaba implementado y **fallaba**. Es exactamente el bug de persistencia
arreglado hoy en `06d083c`: en Tauri v2 `window.__TAURI__.store` no existe (los
plugins se publican sólo como módulos ESM), así que el store caía siempre a
localStorage y el "progressive strip" por cuota borraba imágenes y
`_evaluations` con un toast de 3 segundos. Dejar la caja checked describiendo el
probe del harness tapó que el hecho era falso.

Qué cambió desde entonces:

- `.github/workflows/e2e-windows.yml` compila el binario en `windows-latest` con
  `--no-bundle` y corre `node scripts/e2e-smoke.js`: la ejecución real pasa a ser
  un gate de CI en lugar de una promesa manual.
- El probe de persistencia se extendió: ahora falla si no existe
  `window.MamboTauriBridge`, si `AppStorage.mode !== 'tauri'`, o si una imagen no
  sobrevive al roundtrip por `images/` en disco.
- Falta la otra mitad de U6: `npm run audit:full` no deja artefacto en el repo
  (`audit-app-report.json` no existe), así que su resultado sigue sin registrar.
