# Import-Audit Workflow — "que nada vuelva a romperse sin que lo veamos"

Workflow de auditoría **repetible** del flujo de importación de catálogos y de
todas las funcionalidades de la app. Nació del bug real `d3e17d2` (los helpers
del parser se asignaban solo en la ruta Node): todos los unit tests pasaban
verde y en la app real la animación corría pero **no se agregaba ni un
producto**. Este workflow corre el browser de verdad con los PDFs reales, para
que esa clase de bug no pueda volver a escapar.

## 1) La carga de catálogos (lo que te rompía)

```bash
MAMBO_CATALOG_DIR="/home/geto/Mambo-app/Catalogos" npm run audit:import
# Windows:  MAMBO_CATALOG_DIR="C:\Mambo catalogos" npm run audit:import
```

Verifica, contra `dist/` servido localmente y Chromium real
(`PLAYWRIGHT_CHROMIUM`, default `/usr/bin/chromium`):

| Check | Qué verifica |
|---|---|
| A1–A10 | Cada PDF individual abre el modal de preview con sus productos (los 10 del corpus) |
| B-semáforo | GREEN/YELLOW/RED calculados y botón de confirmar visible |
| B-catálogo creció | Confirmar importa de verdad: filas y catálogo crecen |
| C-persistencia | Reload restaura el catálogo guardado (roundtrip del storage) |
| D-carpeta | El input `webkitdirectory` carga los ~2080 productos de una |
| F-nav | Navegación por catálogo / pedido / historial / importaciones |
| G-consola | Cero requests fallidos y cero errores de la app (excluye el updater: en el harness http golpea GitHub por CORS; en Tauri no mezcla orígenes) |

Exit `0` = todo OK. Exit `1` = bugs. Exit `2` = problema del harness.

## 2) La batería completa (todas las funcionalidades)

```bash
MAMBO_CATALOG_DIR="/home/geto/Mambo-app/Catalogos" npm run test        # 1504+ aserciones en 4 suites
npm run lint                                                           # 0 errores
npm run check:version                                                  # coherencia de versiones
npm run build:frontend                                                 # dist/ minificado espeja src/
npm run layout-audit                                                   # geometría en 7 viewports
MAMBO_CATALOG_DIR=... npm run audit:full                               # pipeline de calidad sobre el corpus
MAMBO_CATALOG_DIR=... npm run audit:assignment                         # asignación de imágenes/marcas
npm run photo:baseline                                                 # baseline de fotos
npm run verify-latest                                                  # release actualizable
python3 scripts/visual-smoke.py measure <png>                          # render 1:1 del binario real
```

## 3) El runtime real (Tauri + WebKitGTK/WebView2)

- **Linux**: `npm run e2e:build` y lanzar el binario (`src-tauri/target/release/mambo-pedidos`)
  en el display real; chequear que la ventana `Mambo Pedidos` aparezca
  (`hyprctl clients`), capturar con `grim -g "x,y WxH"` y medir con
  `visual-smoke.py measure` (borde sidebar 145–335px = 1:1 sin pixelado).
- **Windows (CI job `e2e-windows`)**: `npm run e2e:build && npm run e2e` — puente
  de plugins, `AppStorage.mode === 'tauri'`, roundtrip del store y de `images/`
  en `%APPDATA%`, consola limpia.
- **Datos reales en disco** (Linux): el store vive en
  `~/.local/share/com.mambo.pedidos/.mambo-store.json` y las imágenes en
  `~/.local/share/com.mambo.pedidos/images/`. Si el store está `{}` pero
  `images/` tiene archivos, algo no persistió el catálogo.

## 4) La red de seguridad de tests (por qué no volvió a pasar)

- **Unit test `testBrowserParserWiring`** (`src/js/tests.js`): ejecuta
  `pdfParser.js` en un sandbox `vm` SIN `module`/`require` (browser de verdad)
  con los globales de script clásico, y exige la misma superficie de métodos
  que la ruta Node. Con el código roto: 18 vs 42 métodos y falla. (El viejo
  patrón — re-require con `global.window = global` — no detectaba el bug
  porque la ruta Node rescataba la superficie.)
- **Regla general**: todo split que exponga helpers debe asignarlos en AMBAS
  rutas (browser via `window.*`, Node via `require`). El check estático del
  runner (`checkNoUnguardedProcessRefs`) cubre la clase `process.`; el
  `testBrowserParserWiring` cubre la clase "ruta Node sana, ruta browser rota".

## Historial del bug (para no repetirlo)

| Commit | Fecha | Efecto |
|---|---|---|
| `4103277` | 31/08 15:40 | Extracción de cellUtils.js: helpers solo por `require` (ruta Node) |
| `d3e17d2` | 31/08 16:31 | Extracción de rowMatch.js: idem; además try anidado frágil |
| `dcb0b74` | 01/09 07:33 | Release v2.2.23 con el bug — import da 0 productos en browser |
| fix local | 01/09 | Assign simétrico `window.CellUtils`/`window.RowMatch` + test vm + `audit:import` |

Síntoma exacto en consola del runtime: `this.extractPageProductsByTableRows is
not a function` por página + toast "No se detectaron productos válidos en los
archivos".

## 5) Release + auto-update probado (v2.2.24, verificado E2E)

Secuencia real ejecutada y verificada en los TRES sistemas:

1. `git commit` del fix → `git push origin master`.
2. `npm run bump -- 2.2.24` (propaga version a package/Cargo/tauri.conf/updater/
   index.html/latest.json/tests) → commit `chore(release):` → push.
3. `git tag v2.2.24 && git push origin v2.2.24` → release.yml (3 OS) +
   visual-smokes + verify-latest. **Leccion**: el GITHUB_TOKEN del runner no
   puede CREAR releases en esta org → pre-crear con
   `gh release create v2.2.24 --draft` (tauri-action la publica al actualizar).
4. `latest.json`: **lo genera y sube tauri-action con las firmas reales**.
   `scripts/gen-latest.mjs` quedo como respaldo reproducible si algun dia no.
5. **Leccion nueva**: pasar draft→publish via API NO dispara el evento
   `release: published` → `autoupdate-live.yml` no arranca solo; dispararlo con
   `gh workflow run autoupdate-live.yml` (resuelve N-1 solo).
6. Resultados: `AUTO-UPDATE OK on Windows: v2.2.23 -> v2.2.24`,
   `AUTO-UPDATE OK on macOS: v2.2.23 -> v2.2.24`, y en la notebook Linux el
   AppDir `~/Applications/MamboPedidos/usr/bin/mambo-pedidos` quedo
   **byte-identico** (`md5sum`) al binario oficial extraido del AppImage v2.2.24
   del release, proceso relanzado solo y ventana renderizando 1:1 (sidebar
   en rango, texto 12px).

Verificacion local del update sin UI: comparar `md5sum` del binario del AppDir
contra el extraido del AppImage oficial:

```bash
gh release download v2.2.24 -p "*.AppImage" --dir /tmp/ref && cd /tmp/ref
./Mambo.Pedidos_2.2.24_amd64.AppImage --appimage-extract
md5sum squashfs-root/usr/bin/mambo-pedidos ~/Applications/MamboPedidos/usr/bin/mambo-pedidos
```

## 6) Baseline de performance (import de corpus completo, v2.2.25)

`MAMBO_CATALOG_DIR=... npm run perf:import` — mide cada fase del flujo real con
los 10 PDFs (2080 items) y falla si algo se desvía de este orden de magnitud.

| Fase | Medido | Nota |
|---|---|---|
| Parse carpeta completa | ~40s | Secuencial por archivo (motor de extracción, golden-intacto) — el progreso avanza por página |
| Validación (3 gates) | ~165ms | No es cuello de botella |
| Render modal inicial | ~27ms | Lazy por chunks de 60 |
| Scroll (chunk de 60 cards) | ~41ms | Decodifica las dataURLs del chunk |
| Búsqueda con debounce | ~520ms | Incluye el debounce de 250ms |
| Editar un ítem (re-validación) | ~230ms | |
| **Confirm import completo** | **~1.3s** | v2.2.24: 20-50s+ (writes IPC secuenciales). Fix: batches de 32 → 1.3s; con refs pre-escritos (v2.2.26) → ~200ms |
| Memoria imágenes en vivo | ~151MB → **25MB** | v2.2.26: thumbs de 112px en memoria + archivo full para zoom (almacenado por `_imageRef`); heap post-confirm 602 → 201MB |

Regla de oro del import performance (v2.2.25): **nunca más una operación IPC por
imagen** — todo acceso a `images/` en batches de 32. El dedup del confirm usa
índice `identityKey` (O(n)), no `catalog.find` (O(n²)).
