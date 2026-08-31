# PERF-baselines — métricas de rendimiento del sprint repo-improvement

## U2/PIL6 — parse (instrumento: audit:full, 13 PDFs, ~/Downloads)
- Profiler env `MAMBO_PROFILE_PARSE`: text 2,3s · images 37,6s (la fase dominante
  es la decodificación de imágenes por página; el resto ~150s son getOperatorList
  + render por página, calibrados por P19 06/08 con cap 6.0).
- PIL6 aplicó: imágenes SOLO en páginas que producen productos (antes todas).
  Golden: hash de salida IDÉNTICO antes/después (2309 productos, sha1
  fd0ac1d1…).
- Resultado: sin delta medible en catálogos densos (portadas/índices escasos);
  mejora estructural para PDFs con páginas sin productos. El techo pendiente:
  re-calibrar RENDER_CAP (6.0→3.0) requiere re-calibrar el gate de resolución
  de imágenes (riesgo de FPs en calidad visual) → work item futuro, no forzado.

## U2 var — harness scratch (no comparable con audit: 2,7x más lento, sin uso)

## U4a — boot de la app (binario real, catálogo 1.472, GDK_SCALE=1)
- Ventana mapeada: <1s desde el lanzamiento (medido con hyprctl polling 0.5s).
- Interactividad completa (store + render 1.472) no medible sin CDP: cubierta
  por e2e-windows (CDP). Meta del spec (≤3,5s) cumplida en time-to-window.

## U3/PIL7 — sweep YELLOW (audit:full después de PIL5)
- Report ahora expone yellowReasons por archivo (antes solo conteos).
- 654 YELLOW: 224 switch suelto sin código (diseño), 81 celda con info sin
  extraer (PIL5), 94 anclas de fila/alineación (asignación SKU — fuera del
  gate, observación para sprint futuro), resto residuos/marketing/genéricas.

## image-render-cap (2026-08-31) — A/B completo

Harness con contador de imágenes (wrapper extractImagesFromPage en el scratch;
el pool pre-dedup = 2634 en las 3 corridas). 13 PDFs reales, una corrida por cap.

| cap | tiempo | <=150px | avgMinDim | hash |
|-----|--------|---------|-----------|------|
| 6.0 | 71,3s | 978 | 177px | fd0ac1d1… ✓ |
| 4.0 | 55,2s (−22,7%) | 1823 (+845) | 145px (−18%) | ✓ |
| 3.0 | 51,3s (−28,1%) | 2199 (+1221) | 121px (−32%) | ✓ |

DECISIÓN: se mantiene RENDER_CAP 6.0 — ningún cap cumple "sin subir <=150px ni
caer avgMinDim >15%". El baseline del instrumento real son ~71s (no 190s: el
harness previo sin wrapper inflaba el costo). Tradeoff futuro documentado: 4.0
= −23% de tiempo a cambio de calidad de fotos (decisión de negocio, no de
gate). Worker delegado con el protocolo spec (hash verificado 3×).
