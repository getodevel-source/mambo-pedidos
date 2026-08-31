# tasks — cross-platform-qa-gates

## U1 — layout-audit.mjs (Playwright, geometría por tier)

- [ ] `scripts/layout-audit.mjs`: servidor estático de `dist/` + playwright-core
      con chromium del sistema (fallback `PLAYWRIGHT_CHROMIUM` / `/usr/bin/chromium`).
- [ ] Viewports: 621x752, 701x850, 900x700, 1256x800, 1512x910, 1600x900, 1920x1080.
- [ ] Asserts por viewport (según tiers del CSS vigente):
      - overflow horizontal del documento == 0
      - sidebar visible en TODOS (nada de drawer): ancho según tier
        (≤900: 180, 901-1600: 225, >1600: 270) ± 2px
      - `.menu-toggle` nunca visible (display none)
      - título (`.page-title`) con font-size del tier (≤900:17, ≤1100:18,
        ≤1600:20, >1600:26)
      - sticky bar centrada: |left - (vw - width)/2| ≤ 2 cuando visible
      - tabla catálogo (con demo cargada): scrollWidth del `.table-scroll` ==
        clientWidth (sin scroll horizontal)
- [ ] Exit ≠ 0 con el primer fallo; reporte por viewport.
- [ ] `package.json`: `"layout-audit": "node scripts/layout-audit.mjs"`.
- [ ] CI (ci.yml): job `layout-audit` (ubuntu) con chromium del sistema.

## U2 — verify-latest.js (validador del updater publicado)

- [ ] `scripts/verify-latest.js [tag]`: tomando el tag (o env `GH_TAG`),
      descarga `latest.json` del release vía GitHub releases.
- [ ] Valida: `version == tag`; keys `platforms` con `windows-x86_64`,
      `darwin-aarch64`, `linux-x86_64` (y `darwin-x86_64` si existe);
      URLs sin placeholder (`.sig`/`.tar.gz`/`AppImage` reales, no
      `*.placeholder`); cada URL responde HEAD 200; existe URL+`.sig` 200.
- [ ] Salida legible (por plataforma ✓/✗) y exit ≠ 0 si algo falla.
- [ ] `package.json`: `"verify-latest": "node scripts/verify-latest.js"`.
- [ ] CI (release.yml): job `verify-latest` post-publicación (usa el tag del
      evento).

## U3 — visual-smoke Linux (app real bajo Xvfb + pipeline de píxeles)

- [ ] `scripts/visual-smoke.py`: lanza el binario con `GDK_SCALE=1` bajo
      `xvfb-run`, espera N segundos, captura con `import`/`scrot`, y mide:
      - proceso vivo tras el arranque (exit ≠ 0 si muere)
      - borde derecho del sidebar en el tercio izquierdo (90-300px con
        escala 1) → proporción 1:1 (no 1.5-2×)
      - altura de mancha del título entre 18-30px (no 40+)
- [ ] `npm run visual-smoke:linux` (script npm que envuelve xvfb).
- [ ] CI (release.yml o ci.yml job `visual-smoke-linux`): prepara display
      (xvfb), instala la app real (deb o binario no-bundle), corre el script.

## U4 — visual-smoke macOS

- [ ] Mismo pipeline de medición, lanza el binario macOS (`.app`/binario
      crudo) con `open -W`/exec directo; assert: vivo 10s + captura
      (`screencapture -x`) con sidebar en rango correcto (± tolerancia de
      escala normal Retina 2x: borde 180-560px).
- [ ] CI (release.yml job `visual-smoke-macos`).

## U5 — Matriz de distros (smoke-distros.yml)

- [ ] Workflow `smoke-distros.yml` on release: matrix contenedores
      `ubuntu:24.04`, `debian:12`, `fedora:41`.
- [ ] Cada job: descarga AppImage del tag, `--appimage-extract-and-run` bajo
      `xvfb-run`, 10s vivo, exit 0.
- [ ] Dependencias: `libfuse2`-free (extract-and-run no necesita FUSE),
      `xvfb` + `webkit2gtk` deps del distro.

## U6 — docs/RELEASE-QA.md (checklist humano)

- [ ] Checklist de 5': importar PDF real, verificar tabla y scroll, resize de
      ventana (tiers), drawer-ausente, sticky bar, actualización via updater,
      y cómo correr `layout-audit` + `visual-smoke` en local.

## U7 — Cierre

- [ ] `npm run test`, `lint`, `check:version` verdes.
- [ ] Todos los scripts corren local (Linux) con exit 0.
- [ ] CI (ci.yml) verde con el job nuevo; release.yml con los 3 jobs nuevos
      verificados en un dry-run (trigger sobre el último tag si es posible).
- [ ] Cambios commiteados + push; spec archivado en `openspec/changes/archive/`.