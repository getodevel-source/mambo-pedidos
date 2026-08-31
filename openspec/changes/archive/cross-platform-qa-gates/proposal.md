# Gates de calidad multiplataforma (cross-platform-qa-gates)

## Problema (medido 31/08/2026)

La app compila y firma para Linux, Windows y macOS, pero **"compila" ≠ "se ve y
funciona bien"**. Evidencia de esta semana:

- **Bug de escala gigante en Linux** (WebKitGTK con monitor de escala
  fraccionaria): builds verdes, tests verdes, E2E windows-only, y la app
  renderizaba a 2.1× con el sidebar oculto durante días. El pipeline actual no
  ejecuta la app en Linux ni en macOS jamás; solo la compila.
- **E2E real solo en Windows**: `e2e-windows.yml` usa CDP (WebView2). WebKitGTK
  y WKWebView no exponen CDP → los otros dos SO no tienen smoke de runtime.
- **Updater sin validar**: `latest.json` firmado se publica, pero nadie verifica
  que las URLs por plataforma respondan 200 y tengan `.sig` (un updater roto se
  descubre en la tienda del cliente).
- **Matriz de distros**: solo se compila en ubuntu-22.04; los usuarios corren
  Arch/omarchy, Debian, Fedora…

## Dirección

Un sistema de gates que ejecuta la app real en cada SO y verifica **cómo se ve**
(no solo que arranca), reutilizando el pipeline de píxeles/OCR del
`docs/VISUAL-REVIEW-WORKFLOW.md` y la auditoría geométrica de Playwright:

1. **layout-audit** (`scripts/layout-audit.mjs`): sirve `dist/`, mide viewports
   621/701/900/1256/1512/1600/1920 con Playwright+chromium: overflow 0, ancho
   del sidebar según el tier esperado, título según tier, sticky bar centrada,
   tablas que caben sin scroll interno. Corre en CI (ubuntu job) y en local.
2. **visual-smoke** (`scripts/visual-smoke.py` + `scripts/visual-smoke.py`):
   lanza la app REAL (binario del release) bajo Xvfb (Linux) o sesión gráfica
   (macOS), captura la ventana, y reutiliza el pipeline de píxeles: sidebar
   presente en el ancho esperado, sin inflado 2×, proceso vivo N segundos.
3. **verify-latest** (`scripts/verify-latest.js`): valida el `latest.json`
   publicado: versión == tag, sin placeholders, cada URL 200 + `.sig` 200.
4. **Matriz de distros** (`smoke-distros.yml`): ubuntu:24.04 / debian:12 /
   fedora:41 con el AppImage del release (`--appimage-extract-and-run`),
   Xvfb-run + smoke de arranque.
5. **docs/RELEASE-QA.md**: checklist humano de 5' para las máquinas reales
   (importar PDF, resize de ventana, updater).

## Criterios de cierre (todos falsables)

- [ ] `npm run layout-audit` exit 0 en local y en CI (ubuntu job de ci.yml).
- [ ] `npm run verify-latest` falla con JSON inválido/placeholders/URL muerta y
      pasa con el v2.2.3 publicado.
- [ ] Job `visual-smoke-linux` en CI (Xvfb + GDK_SCALE=1): binario real lanza,
      captura tiene sidebar detectado en proporción 1:1 → exit 0.
- [ ] Job `visual-smoke-macos` en CI: binario real lanza, proceso vivo 10s →
      exit 0.
- [ ] Workflow `smoke-distros` corre los 3 contenedores tras un release y los
      3 pasan.
- [ ] `docs/RELEASE-QA.md` con el checklist humano.
- [ ] Todos los scripts versionados (sin `_dbg_*`), `npm test` + `lint` + `check:version` OK,
      cambios commiteados, CI del repo en verde.