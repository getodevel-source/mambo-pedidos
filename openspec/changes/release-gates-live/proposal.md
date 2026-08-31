# Gates de QA en un release real (release-gates-live)

## Problema (medido 31/08/2026)

El spec cross-platform-qa-gates implementó: verify-latest, visual-smoke
Linux (Xvfb), visual-smoke macOS y smoke-distros — pero **ninguno corrió en un
release real** (se disparan en el workflow de release / al publicarse, y el
último release (v2.2.3) fue anterior a esos jobs). Los gates existen en papel;
falta la primera ejecución real que los endurezca (los scripts Python crudos
pueden fallar por entorno — p.ej. imagemagick en el runner, el path del
AppImage, el trigger de distros).

## Dirección

1. **U1 — Release v2.2.4** con bump + tag + push (los procesos habituales ya
   automatizados) → CI de release ejecuta los 3 jobs nuevos.
2. **U2 — Monitorear y arreglar**: verify-latest, visual-smoke-linux,
   visual-smoke-macos y (al publicarse) smoke-distros. Cada fallo se arregla
   en el job/script y se re-corre (`gh run rerun` o nuevo tag si hace falta).
3. **U3 — Verificar assets**: los 10 assets firmados + latest.json válido;
   actualizar la instalación local si el AppImage/deb cambia.
4. **U4 — Cierre**: los 3+1 gates verdes en el release real, registro y
   archive.

## Criterios de cierre (todos falsables)

- [ ] v2.2.4 publicado por CI con success en Build&Release + verify-latest +
      visual-smoke-linux + visual-smoke-macos.
- [ ] smoke-distros (ubuntu:24.04 / debian:12 / fedora:41) completado con
      success al publicarse el release (o, si el entorno lo impide —p.ej.
      FUSE/imagemagick en contenedores—, fix documentado y verde).
- [ ] 10 assets firmados presentes + latest.json validado por verify-latest.
- [ ] Instalación local al día (AppDir + AppImage oficial).
- [ ] Cualquier fix de los scripts/jobs queda commiteado y verde en un run
      posterior.

## No-goals

- NO cambiar los umbrales para que "pasen": los gates deben pasar con
  medidas reales; los ajustes de entorno (instalar deps) sí están
  permitidos.