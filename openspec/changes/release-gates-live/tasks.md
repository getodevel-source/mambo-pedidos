# tasks — release-gates-live

## U1 — Release v2.2.4

- [ ] npm run bump 2.2.4 + check:version.
- [ ] Commit release + tag v2.2.4 + push (master + tag) → CI de release.

## U2 — Monitorear y arreglar los gates (delegable a subagente con gh)

- [ ] verify-latest en el run (DEBE pasar: validamos el latest.json).
- [ ] visual-smoke-linux (xvfb + binario real con GDK_SCALE=1).
- [ ] visual-smoke-macos (proceso vivo + screenshot best-effort).
- [ ] smoke-distros al publicarse el release (3 contenedores).
- [ ] Cada fallo: arreglar script/job (deps del contenedor, paths, umbrales
      legítimos) y re-correr hasta verde.
- [ ] Gh logs como evidencia por gate.

## U3 — Verificar assets

- [ ] gh release view v2.2.4: 10 assets firmados.
- [ ] verify-latest local sobre v2.2.4 (exit 0).
- [ ] Descargar AppImage oficial → ~/Applications (reemplazar el esqueleto
      si hizo falta en el smoke), AppDir actualizado.

## U4 — Cierre

- [ ] Reporte gates: éxito por job con tiempos.
- [ ] Registro en docs/RELEASE-QA.md (lecciones del entorno).
- [ ] Commit de los fixes + push + CI verde + archive del spec.