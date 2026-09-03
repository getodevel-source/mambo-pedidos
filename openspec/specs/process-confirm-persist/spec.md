# Spec: process-confirm-persist

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Confirm: dedup por identidad (O(n)), push con refs y razones atómicas, saveCatalog con batches de 32 y GC por Set; fallos contados, nunca silenciosos.

## Estado actual (2026-09-02, corpus real)

Confirm 2080 items **278ms** · save con refs **138ms**. Nota 9/9. Fallo → toast error + evidencia; payload sin dataURLs inline (refs).

## Definición de 10 REAL

Confirm <200ms y save <200ms gateados; **ledger de persistencia** visible en el dashboard (backend usado, imágenes escritas/fallidas, strip si lo hay); test de que un fallo de disco nunca es silencioso (existe).

## Camino al 10 (pasos)

- [ ] Umbral check confirm 1000→400ms (hoy 278) tras 3 releases verdes.
- [ ] Dashboard: fila 'última persistencia' con lastPersistence (ya se registra).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check confirm <400ms, save <500ms.
- testStorageImageWriteFailure (fallo contado).
- Invalidación: reintroducir fallo silencioso.
