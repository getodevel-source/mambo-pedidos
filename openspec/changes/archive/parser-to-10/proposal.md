# Parser a 10 — Spec auditado (recall_dirty)

Fecha: 2026-08-07. Estado: PROPUESTA. Área: #2 Parser PDF (pdfParser.js + textSanitizer.js).
Objetivo: subir recall_dirty de 65%→90%+ sin subir FP (anti-overfit), manteniendo fail-closed.

---

## 0. Auditoría actual (datos)

`measure-model-quality.js`: **recall_dirty 65% (26/40)**. Los 14 FN auditados:

| Clase | Ejemplos | Flagable? |
|---|---|---|
| **Marketing puffery** (2+ palabras o 1 sin código) | "Ultra Crystalblade Gleam", "Icy Creamsicle Horizon", "Master Wireless Mouse", "68HE Ultra Jade King", "X820Ultra Star +Gift" | **SÍ** — no es un nombre descriptivo real |
| **Código + tipo** | "M720 Wireless Mouse", "G502 Wired Mouse" | **NO** — estructuralmente idéntico a "F75 Gasket Keyboard" legítimo (IT17) → cola humana |
| **Genérico/general** | "contours", "Mount Tai GT powder", "Hall Effect Ace 68 Air" | Parcial (add "contour") |

El lever real = **palabras de marketing**. ~10 de 14 FN son flagables con una regla general.

## 1. Regla propuesta (en `assessModelQuality`, textSanitizer.js)

```
MARKETING_WORDS = ultra, master, star, crystal, crystalblade, gleam, glow, jade,
  king, queen, royal, snow, snowlight, ice, icy, cream, creamsicle, frost,
  horizon, nebula, nova, aurora, prism, mystic, tactical, esport, elite,
  premium, platinum, diamond, titan, hero, beast, legend, flagship, supreme, apex

count = # palabras de marketing distintas en el modelo (word-boundary)
if (!mHasCode && count >= 1) → YELLOW  // nombre de marketing sin código real
if (count >= 2) → YELLOW               // puffery pesada aunque tenga código
```

**Anti-overfit (verificado a mano sobre el sample):**
- "AJ139 Pro" (legítimo): mHasCode ✓, count=1 (Pro no está en la lista) → GREEN ✓
- "F75 Gasket Keyboard" (legítimo): count=0 → GREEN ✓
- "M720 Wireless Mouse" (dirty-code+type): count=0 → NO flag ✓ (queda cola humana, IT17)
- "G502 Wired Mouse": count=0 → NO flag ✓

## 2. Criterio de cierre (falsable)

- [ ] recall_dirty ≥ **85%** sin subir FP_rate_clean (≤8%, ideal estable).
- [ ] 0 regresiones en el audit (G/Y/R invariantes o mejor).
- [ ] "M720 Wireless Mouse" y "G502 Wired Mouse" siguen SIN marcar (cola humana, no regresión).
- [ ] 994+ tests + lint 0/0 + ground-truth sin regresión.

## 3. Riesgo honesto

- Algunos marketing-words (Ultra, Pro, Max) aparecen en modelos legítimos. La regla exige **2+** palabras o **1 sin código** para no sobre-marcar. FPs de YELLOW son nudges (van a revisión), no errores silenciosos — aceptable y coherente con infallibility-contract (mide falsos RED, no falsos YELLOW).