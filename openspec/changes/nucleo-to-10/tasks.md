# Núcleo a 10 — Spec + Tasks (IT29)

Área: #1 Núcleo (storage.js + reliability.js, nota 8).

## Auditoría
Reliability ya era fuerte: error boundary global, `safeCall`, validación de
integridad del catálogo, backup/recovery, schema de importación, detección de
encoding, resumen de importación, viabilidad de producto, validación de tipo de
archivo. Debilidad: el **error log era solo en memoria** (se perdía al recargar)
y no se podía **exportar** para soporte/debug.

## Hecho
- [x] Error log persistido en localStorage (`mambo_error_log`, últimas 50) y
      cargado al instalar el boundary (sobrevive recargas).
- [x] `exportErrorLog()`: descarga el log como JSON (app, timestamp, count, errores).
- [x] Tests: `_recordError` persiste, `exportErrorLog` disponible. 1012/1012 + lint 0/0.