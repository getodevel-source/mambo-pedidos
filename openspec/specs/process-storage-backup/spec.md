# Spec: process-storage-backup

> Definición de 10 REAL (sin humo): un número medible, gateado y reproducible.
> Se invalida si el gate se afloja sin evidencia, si la medición deja de
> correrse en cada release, o si el número se obtiene con datos fabricados.

## Proceso

Persistencia Tauri + fallback localStorage con degradación evidenciada; GC de imágenes huérfanas; backup y recover.

## Estado actual (2026-09-02, corpus real)

save **138ms** · GC Set O(1) · backup a localStorage (fallo no fatal). Nota 9/8.

## Definición de 10 REAL

Backup del payload completo a disco (archivo en $APPDATA) en modo tauri, además del localStorage; recover probado con store corrupto en e2e; save <200ms gateado.

## Camino al 10 (pasos)

- [ ] Backup completo a archivo en modo tauri (crearBackup ya registra; falta la variante disco).
- [ ] e2e: store corrupto → recover → aviso (existe base en suites).

## Gates anti-smoke (qué mantiene el 10 real)

- perf:audit --check save <500ms (hoy 138).
- npm test backup/recover + fallo contado (existe).
- Invalidación: degradación silenciosa.
