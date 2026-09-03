# Spec: process-preview-import

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Modal de preview: render lazy por chunks (virtualizado), scroll, búsqueda; la EDICIÓN NO re-valida en el momento (decisión usuario 2026-09-03): la verificación completa corre una vez al procesar y una vez al confirmar — el semáforo final sale de esa verificación única.

## Estado actual (2026-09-02, corpus real)

render 12ms · scroll 31-40ms/chunk · búsqueda ~460ms · edición coalescida (10 edits → 1 verify). Nota 8/9.

## Definición de 10 REAL

Scroll <30ms/chunk y 10 ediciones <1s gateados; virtualización del grid (solo los chunks visibles montados) para catálogos >4000; semáforo final idéntico verificado por test en cada release.

## Camino al 10 (pasos)

- [ ] Virtualizar el grid (desmontar chunks lejanos del DOM) — el mayor costo restante es el DOM acumulado.
- [ ] Gate perf:audit ediciones <2s (existe) → <1s tras virtualizar.

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check: búsqueda <700ms (debounce incluido), edición dictada <2s.
- Test de semáforo final === verificación directa (sliceB).
- Invalidación: reintroducir re-validación automática por edición (anti-decisión usuario).
