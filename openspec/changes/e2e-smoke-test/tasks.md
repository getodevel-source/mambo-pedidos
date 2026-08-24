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
- [x] `npm run e2e` exit 0 con la app real corriendo.

## U6 — Loop de auditoría hasta 0 bugs
- [ ] Correr `npm run e2e` + `npm run audit:full` sobre la app/catálogo reales.
- [ ] Registrar bugs, arreglar, re-correr hasta 0.