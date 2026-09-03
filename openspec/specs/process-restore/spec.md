# Spec: process-restore

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Restauración del catálogo guardado al arrancar: load → thumbnails desde archivos (batches) → render sin bloquear el primer paint; integridad al idle.

## Estado actual (2026-09-02, corpus real)

Reload con 1264 items + fotos: **165ms** (gate <2s). Nota 10/9. Integridad y selección huérfana en idle; backup/recover.

## Definición de 10 REAL

Restore **<500ms** con catálogo completo (hoy 165ms ≈ 3× margen), primer render del catálogo <300ms, integridad verificada post-restore con warning accionable; gate en cada release.

## Camino al 10 (pasos)

- [ ] Ajustar el umbral del check de 2000ms → 800ms con el margen medido (3 releases verdes).
- [ ] Test e2e: corrupt store → recover de backup → banner de aviso (ya cubierto en suites; formalizar en perf-smoke).

## Gates anti-smoke (qué mantiene el 10 real)

- `perf:audit --check` restore <800ms (hoy 165).
- Integridad + backup/recover en `npm test`.
- Invalidación: restore que toca el primer render.
