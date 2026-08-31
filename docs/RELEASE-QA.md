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