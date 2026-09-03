# Spec: process-boot

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Arranque de la app hasta que los botones responden (dom-ready → store → listeners) y el check de update en idle.
Entradas: dist/ + store. Salidas: app interactiva (boot:listeners) sin errores de consola.

## Estado actual (2026-09-02, corpus real)

boot:listeners **60ms** (gate <500ms). Nota 10/9. Error boundary + fallback store con aviso visible.

## Definición de 10 REAL

boot:listeners **<150ms sostenido** en la máquina de referencia (hoy 60ms ≈ 2.5× margen), consola limpia medida por e2e, y el número se re-mide en cada release con `perf:audit --check`.

## Camino al 10 (pasos)

- [ ] Consolidar la medición en `perf:audit --check` (ya existe, umbral 500ms → bajar a 300ms con el margen medido) y en `perf-smoke` CI.
- [ ] Dejar el umbral en 150ms solo cuando 3 releases seguidas midan <100ms sin outliers.

## Gates anti-smoke (qué mantiene el 10 real)

- `perf:audit --check` fail si boot >300ms (hoy 60).
- e2e: consola sin excepciones al load.
- Invalidación: correr el release sin pasar el check.
