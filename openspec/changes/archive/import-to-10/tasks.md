# Importación de Archivos a 10 — Tasks (IT27)

## Hecho
- [x] DRY: `_parseItems` compartido por CSV y Excel (eliminada la duplicación del
      bucle de parseo de filas, ~30 líneas).
- [x] Defaults tributarios del reporte ejecutivo auditados (derechos default 0% BIT,
      tasa 3%, ganancias 6%, IVA 21% — sin hardcode 16% stale).
- [x] `_reportSkipped`: toast con filas saltadas (sin modelo / sin FOB) en la UI.
- [x] Test de equivalencia `_parseItems` (2 válidas, 2 saltadas, SKU/FOB resueltos,
      SKU auto-generado). 1010/1010 + lint 0/0.