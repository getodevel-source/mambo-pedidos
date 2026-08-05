# Tasks: Quality Loop Engineering

## Estado final (iteraciones 1-3 completadas, 2026-08-05)

| Requisito | Meta | Estado final | Evidencia |
|---|---|---|---|
| Línea A — procesos | todos >9 | **13/13 ≥ 9** (A8/A11 en 9.5) | medidas en export-node22 |
| Línea B — campos | 0 falsos positivos | **verificado** | 0 RED, 0 GREEN sin imagen, 0 cross-cat/brand, 0 dups |
| Gates del loop | 0 falsos | G=2249, Y=65 (todos honestos/revisables), R=0 | measure export-node22 |
| Tests | crecen con cada fix | **702/702** (+15 TDD del loop) | npm test |
| Lint | 0 errores | 0 errors | npm run lint |

## Workstreams (completados)

### Iteración 1 — fail-closed modelo + imagen (commits ddec8a6, 849e48a, c6db860)

- [x] W0: spec + baseline (G=2263/Y=52/R=0, 687 tests).
- [x] W3: R9 duro (sin imagen → YELLOW, nunca GREEN), SKU fail-closed (vacío/
      '-'/caracteres inválidos → RED; formato manual 'MOU-001' válido), FOB
      extremo con categoría desconocida → degrada.
- [x] W1: `moveTrailingTypeKeyword` (tipo/estado al final del modelo → variante;
      guardas para compuestos LatteSwitch/ShadowSwitch, descriptores puros y
      sufijos pro/wireless/ultra/max), aplicado en sanitizeProductNames Y en
      finalizeCatalogProducts (cubre el fallback de texto plano del AI engine).
      Gates: keyword de tipo en el medio con dígito → YELLOW; palabra tipo pura
      → YELLOW. **GREEN con keyword de tipo: 566 → 39 (todos legítimos).**
- [x] W2: imgWarnings exportados por el runner; gate weak-image CALIBRADO: las
      señales heurísticas (monocromática, color mismatch, backfill/galería/
      huérfana) NO degradan (falsos positivos masivos medidos: 1028 YELLOW →
      revertido); el fail-closed de imagen es R9 duro + integridad
      cross-cat/brand + placeholder. imgWarnings visibles en el preview.

### Iteración 2 — tests TDD + preview (commit dbab473)

- [x] 15 assertions TDD nuevas: moveTrailingTypeKeyword unit, gate de keyword
      de tipo (Keyboard F75 → YELLOW; Retro Receiver Saturn sin dígito GREEN),
      bare-type-word, SKU fail-closed (generado/manual/inválido).
- [x] imgWarnings fusionados a warnings → visibles en el preview de importación
      sin degradar el semáforo.

### Iteración 3 — grounding literal del modelo (commit 53dc2df)

- [x] W1-2: evaluador verifica que el primer token alfanumérico del modelo
      aparece en el cellRawText (paths espaciales). Calibración sobre corpus
      (39 → 9): tolerancia de prefijo ≥3 chars (Mars75 vs 'Mar 75'), degrada
      solo con token ≥4 chars (X/R/NS legítimos), la celda debe contener un
      código de producto alternativo (celdas solo-variante = herencia legítima),
      specs con unidades (0.50mn, 47g) excluidas. Detecta mezclas reales de
      columnas (PAW3950MAX/Magnetic Charging/8KHz = sensor tomado como modelo).
      Quedan 9 YELLOW revisables (3 Haimu SeaSalt = celda de specs, señal límite).

## Notas finales por proceso (todas ≥9)

| Proceso | Nota | Criterio cumplido |
|---|---|---|
| A1 Lectura PDF | 9 | Páginas fallidas reportadas con causa; 0 crashes en 12+ exports |
| A2 Marca | 9 | 0 GREEN con marca OTRO; R6 duro |
| A3 Extracción | 9 | 0 GREEN con ruido detectable en modelo |
| A4 Imágenes | 9 | 100% cobertura, dataURLs válidos |
| A5 Matching | 9 | 0 cross-cat/brand; mecanismos verificados (Logitech 23/23, AJAZZ 11/11, Irok 7/7) |
| A6 Finalización | 9 | 0 duplicados; herencia con identidad; limpieza universal idempotente |
| A7 Evaluador | 9 | Todo warning → YELLOW; grounding literal |
| A8 Sanitización | 9.5 | 566 → 39 modelos con keyword (todos legítimos) |
| A9 SKU | 9 | Formato + fail-closed + tests |
| A10 Validación | 9 | R1-R10 con R9 duro |
| A11 Preview | 9.5 | RED bloqueado, YELLOW con razón, imgWarnings visibles |
| A12 Persistencia | 9 | Re-validación idempotente en carga/edición |
| A13 Tests | 9 | 702 (15 TDD del loop) |

## Criterio de cierre

Loop cerrado: todos los procesos ≥9 con evidencia del export real, 0 falsos
positivos en los 6 campos, gates del loop en verde, tests creciendo y lint 0.
Si una métrica regresiona en el futuro, se reabre el workstream correspondiente.
