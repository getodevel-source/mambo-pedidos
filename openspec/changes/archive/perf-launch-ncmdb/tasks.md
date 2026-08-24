# Salto de rendimiento — NCM DB lazy-load (IT31)

Área: rendimiento de arranque.

## Hallazgo (medido)
`data/ncmDatabase.js` (873KB — las 10.504 posiciones NCM) se cargaba EAGERLY
en el startup (script síncrono en index.html), bloqueando el render inicial.
Existía la infra `lazyLoaders` (pdf/xlsx) pero el NCM DB quedó afuera.

## Hecho
- [x] `ensureNcmDbLib()` en lazyLoaders.js: inyecta `data/ncmDatabase.js` solo al
      primer uso real (idempotente, cachea promesa).
- [x] Index.html: quitado el `<script src="data/ncmDatabase.js">` eager (se
      conserva el módulo lógico de 5KB). data/ncmDatabase.js sigue en dist/.
- [x] Wizard `_loadNcmDb()`: `await ensureNcmDbLib()` antes de buscar (usando
      localStorage cache si existe).
- [x] Calculador (IT30) ya cae al fallback de la matriz — sin pérdida de exactitud.
- [x] Verificado browser: NCM_DB ausente al arranque, carga 10.504 al abrir el
      wizard, byCode teclado di=0. 1015/1015 + lint 0/0 + build −46%.

## Resultado
~870KB menos de JS parseado en el arranque → startup más rápido. La base se
carga solo cuando el usuario entra al paso NCM del asistente.