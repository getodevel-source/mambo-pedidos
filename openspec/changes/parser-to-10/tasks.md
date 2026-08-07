# Parser a 10 — Tasks (IT25)

## Hecho (recall_dirty)
- [x] Regla de marketing puffery en `assessModelQuality`: 2+ palabras de marketing
      o 1 sin ningún dígito → YELLOW. Anti-overfit (1 marketing + código/dígitos = GREEN).
- [x] **recall_dirty 65% → 85%** (ground-truth 34/40), FP_rate_clean 8% estable, 0 FPs de marketing.
- [x] Audit: G=2269 Y=40 R=0 (idéntico, sin regresión — net para futuros catálogos).
- [x] Tests INF nuevos (puffery→YELLOW, AJ139 Pro/NJ07 Ultra/Flagship PRO→GREEN,
      M720 code+type→cola humana). 1000+/1000 + lint 0/0.

## Pendiente (para el "10" completo)
- [ ] **Refactor del monolito (3.084 líneas) en módulos** (cellGrid, tableRows,
      imageMatch, sanitize, category, confidence) — mejora de mantenibilidad,
      alto riesgo de regresión, iteración propia.
- [ ] Revisar los 6 FN residuales (Mount Tai, Hall Effect, 0500, 68 Keys) — son
      difíciles de flagar sin conocimiento del catálogo (límite honesto).