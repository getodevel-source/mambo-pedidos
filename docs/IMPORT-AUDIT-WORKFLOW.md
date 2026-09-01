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