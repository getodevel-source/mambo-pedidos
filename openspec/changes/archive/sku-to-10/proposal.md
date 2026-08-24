# SKU a 10 — Spec auditado

Fecha: 2026-08-07. Estado: PROPUESTA. Área: #4 SKU (skuAllocator.js, nota 7).
Objetivo: SKUs humanos-legibles + deterministas + resilient, sin romper el mapeo durable.

---

## 0. Auditoría actual

`skuAllocator.js` (276 líneas) ya es fuerte: `normalizeSku`, `identityKey`,
`hash` (FNV-1a), `allocateBatch` (colisiones manejadas), `auditSkus`,
`buildSkuMapping` (migración durable), `checkAmbiguityGate`.

**Debilidad (por qué no es 10):**
- El SKU generado es **opaco**: `BRAND3-CAT3-HASH8` → `ATK-TEC-9F4E2B1A`.
  El hash no es legible por humanos: no podés escanear un catálogo y saber qué
  producto es cada SKU sin mirar la fila.

## 1. Propuesta

### 1.1 SKU legible con slug del modelo
Formato nuevo: `BRAND3-CAT3-SLUG-HASH4` → `AUL-TEC-F75-3F2A`
- `SLUG` = primer token alfanumérico significativo del modelo normalizado (≤8 chars).
  Ej: "F75 Reaper"→`F75`, "AJ139 Pro"→`AJ139`, "G502"→`G502`.
- `HASH4` = 4 hex del FNV-1a (mantiene determinismo + colisión con salt).
- Mantiene `BRAND3-CAT3` (marca + categoría) para agrupar.

### 1.2 Seguridad (anti-regresión)
- `allocateBatch` SIGUE preservando el SKU de origen válido — solo los productos
  NUEVOS reciben el formato legible. Catálogos existentes no cambian.
- `buildSkuMapping` migra sin romper referencias (accounting de acción).
- `GENERATED_RE` en `auditSkus` se actualiza al nuevo formato (acepta ambos).

### 1.3 Conferta de identidad
- `slugOf(modelo)` helper: normaliza, extrae el primer token alfanumérico con
  dígitos (prefiere el código del modelo), ≤8 chars, UPPER.
- Si no hay token → `SKU` genérico.

## 2. Criterio de cierre (falsable)

- [ ] `generatedSku({marca:'AULA',cat:'TECLADO',modelo:'F75 Reaper',...})` → coincide `/^AUL-TEC-F75-[0-9A-F]{4}$/`.
- [ ] Determinista: mismo input → mismo SKU.
- [ ] Colisión: dos modelos distintos con mismo slug → hashes distintos (salt).
- [ ] `allocateBatch` preserva SKUs de origen válidos (no rompe existentes).
- [ ] `auditSkus` deja de marcar los nuevos como "legacy" (GENERATED_RE actualizado).
- [ ] Tests existentes (uniqueness, determinismo, mapping) siguen verdes.
- [ ] 1001+ tests + lint 0/0.

## 3. Riesgo honesto

- El formato nuevo solo aplica a SKUs generados NUEVOS (los de origen se preservan).
- El `GENERATED_RE` acepta tanto el formato viejo (hash8) como el nuevo (slug-hash4)
  para no marcar catálogos existentes como legacy.