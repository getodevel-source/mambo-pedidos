# RELEASE-QA — checklist humano de 5 minutos (por SO)

Los CI cubren builds firmados, auditoría geométrica del frontend (todos los
viewports), validador de `latest.json`, smoke visual del binario real en Linux
(Xvfb) y macOS, y la matriz de distros (ubuntu/debian/fedora con el AppImage).
Ningún pipeline reemplaza el hardware real: esto se hace en cada release sobre
**tu** máquina Windows (la tienda) y **tu** Linux (la notebook).

## Windows (máquina real)

1. Descargar `Mambo.Pedidos_<v>_x64-setup.exe` del release e instalar.
2. Abrir la app: **sin errores en consola** (los detecta el e2e, acá solo se
   mira que abra la ventana).
3. Importar un PDF real de proveedor (arrastrar a la ventana) → tabla con
   filas, precios FOB en USD.
4. Redimensionar la ventana a ~800px de ancho: sidebar se achica (180px), NO
   desaparece ni aparece hamburguesa.
5. Marcar 2 productos → la barra flotante inferior "Armar pedido" aparece
   **centrada**, sin cortes.
6. Cerrar y reabrir → los productos siguen (persistencia real en
   `%APPDATA%`, no localStorage).
7. `npm run verify-latest` (o confiar en el job de CI) → cerrar la app y
   disparar "Buscar actualización": si hay un release posterior, actualiza.

## Linux (notebook omarchy)

1. Abrir desde la bóveda de omarchy (usa el `.desktop` local:
   `env GDK_SCALE=1 .../AppRun`).
2. A escala fraccionaria del monitor (1.2-1.9): los elementos se ven
   **proporcionales** al resto del sistema (Chrome de referencia). Si algo se
   ve 2x gigante, es el bug de WebKitGTK → relanzar (el fix GDK_SCALE=1 viene
   en el binario).
3. Igual que Windows: importar PDF, resize (180px), sticky bar centrada,
   persistencia (catálogo queda en `~/.local/share/com.mambo.pedidos`).
4. `npm run layout-audit` desde el repo → todos los viewports ✅.

## macOS (si alguna vez hay máquina)

1. Abrir el `.dmg` (primer lanzamiento: botón derecho → Abrir si Gatekeeper
   bloquea una app sin notarizar).
2. Importar PDF, resize, sticky bar, persistencia en `~/Library/Application
   Support/...`.
3. El CI valida proceso vivo + screenshot; el resto se prueba a mano igual que
   en los otros SO.

## Cómo correr los checks en local (Linux)

```bash
npm run layout-audit        # geometría de los tiers (necesita chromium del sistema)
npm run verify-latest       # valida el latest.json del último release
npm run visual-smoke measure <captura.png>   # pipeline de píxeles sobre una captura
```
## Lecciones del primer release con gates reales (v2.2.10, 2026-08-31)

1. **GITHUB_TOKEN no puede CREAR releases** (org policy): tauri-action falla
   con "Resource not accessible by integration". Workaround: `gh release
   create <tag>` manual ANTES del run (el bot SÍ actualiza/subirá assets).
   El default de Actions puede volver a `read`: restaurar con el PUT de
   actions/permissions/workflow.
2. **visual-smoke en Xvfb del runner pinta en negro** (sin GL): el script
   degrada a "proceso vivo" cuando la captura está vacía; el render real se
   valida en macOS (screencapture) y en local.
3. **Texto con antialias débil en contenedores** (fedora < 300 de tinta):
   el guard real anti-2x es el sidebar (borde 145-335px); el texto solo
   falla si está inflado (>70px), lo débil es warning.
4. **Corrida de publicación**: los distros que se disparan con
   `release: published` pueden descargar ANTES de que el action suba los
   assets → curl con `--retry 6 --retry-delay 30 --retry-all-errors`.
5. Los releases del bot usan el código del TAG: un fix de los scripts de QA
   requiere bump + tag nuevo (no rerun) — por eso 2.2.5→2.2.10.

## Auto-update por release (politica vigente desde v2.2.21)

Cada release debe poder instalarse SOLO, en los tres sistemas:

- **Windows**: latest.json + NSIS firmado -> el plugin ejecuta el instalador /S y relanza.
  Verificado por el job `autoupdate-live` en cada release (runner real de Windows).
- **macOS**: latest.json + .app.tar.gz firmado -> el plugin reemplaza /Applications y relanza.
  Verificado por `autoupdate-live` (runner real de macOS).
- **Linux AppImage (bundle oficial)**: `get_install_kind()` detecta APPIMAGE/magic ->
  self-replace del .AppImage. NOTA: el webkit embebido del bundle es viejo y puede
  fallar bajo Wayland; en esas maquinas usar AppDir (siguiente punto).
- **Linux AppDir (instalacion recomendada, cajon)**: `installBinaryUpdate()`:
  descarga el AppImage firmado via `download_update` (reqwest EN RUST - los 82MB
  JAMAS cruzan el IPC; esa fue la causa del "te manda a GitHub"),
  `apply_appimage_update` extrae con el runtime (`--appimage-extract`), copia SU
  binario sobre el exe del cajon (usa libs del SISTEMA = render nitido), `pkill -x
  mambo-pedidos`, renombra y relanza solo. Probado end-to-end en hw real (md5
  identico al extraido + relanzado).
- **Render Linux**: AppDir en sesion Wayland fuerza `GDK_BACKEND=wayland` +
  `GDK_SCALE=2` (buffer 2x downsampeado por Hyprland = nitido). El bundle AppImage
  conserva x11 (su webkit embebido muere bajo wayland).

Gate: `autoupdate-live.yml` se dispara con CADA release publicado; si falla, el
release no esta listo.
