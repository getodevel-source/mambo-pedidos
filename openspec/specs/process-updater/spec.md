# Spec: process-updater

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Auto-update: check plugin + fallback GitHub, descarga en Rust (nunca por IPC), extracción y reemplazo con relanzado; verificado E2E en 3 SO.

## Estado actual (2026-09-02, corpus real)

10/10 — verificado Windows/macOS (autoupdate-live) y Linux (md5 byte-idéntico).

## Definición de 10 REAL

Ya es 10 real; mantener: autoupdate-live disparado en CADA release (recordatorio del quirk draft→published), verify-latest en el pipe, y el md5-check documentado para Linux.

## Camino al 10 (pasos)

- [ ] Automatizar el dispatch de autoupdate-live (hoy manual por el quirk del evento) — script o job de recordatorio.
- [ ] Ningún cambio funcional.

## Gates anti-smoke (qué mantiene el 10 real)

- verify-latest job.
- autoupdate-live success por release.
- Invalidación: release sin validar update.
