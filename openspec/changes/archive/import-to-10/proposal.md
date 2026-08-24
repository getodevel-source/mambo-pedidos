# Importación de Archivos a 10 — Spec auditado

Fecha: 2026-08-07. Estado: PROPUESTA. Área: #6 Importación (fileImporter.js, nota 7).
Objetivo: DRY (eliminar duplicación) + defaults tributarios auditados en exports.

---

## 0. Auditoría actual

`fileImporter.js` (413 líneas) ya es fuerte: CSV (mojibake detection), Excel
(multi-sheet + merged cells), export CSV/XLSX, packing list aduanero, reporte ejecutivo.

**Debilidades:**
1. **Duplicación (DRY)**: `processCsvFile` y `processExcelFile` repiten el mismo
   bucle de parseo de filas (resolveField → modelo → fob → skip) ~30 líneas c/u.
   Un cambio en la lógica hay que hacerlo 2 veces.
2. **Defaults tributarios stale**: el reporte ejecutivo usa `c.derechos || 16`,
   `c.perc || 6`, `c.ivaPct || 21` como fallback — contradicen los valores
   auditados (teclados/mouse DI 0% BIT, IVA adicional 20%). Si el usuario no
   configura los costos, el reporte muestra porcentajes viejos.

## 1. Propuesta

### 1.1 DRY — parseo compartido
Extraer `parseItems(jsonRows, catalog)` que hace el bucle (modelo→fob→marca→cat→
variante→sku) y lo usan tanto CSV como Excel. Reduce ~30 líneas de duplicación.

### 1.2 Defaults tributarios auditados
Actualizar los fallbacks del reporte ejecutivo a los valores auditados:
- Derechos: default 0 (teclados/mouse BIT) con fallback genérico por categoría.
- IVA: 21%, IVA adicional no estaba mostrado (agregar fila).
- Sin hardcode de 16/6/21 stale.

### 1.3 Feedback de importación
Elevar los contadores de filas saltadas (sin modelo / sin FOB) a un toast resumido
en la UI (hoy solo console.warn).

## 2. Criterio de cierre (falsable)

- [ ] `parseItems` compartido por CSV y Excel (sin duplicación del bucle).
- [ ] Ambos importadores producen los MISMOS items que antes (test de equivalencia).
- [ ] Reporte ejecutivo con default de derechos auditado (0% para BIT de teclados).
- [ ] Toast con resumen de filas saltadas.
- [ ] 1006+ tests + lint 0/0.