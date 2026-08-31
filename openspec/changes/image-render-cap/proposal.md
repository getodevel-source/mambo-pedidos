# Recalibración del render de imágenes (image-render-cap)

## Problema (medido 31/08/2026)

La extracción batch de los 13 PDFs tarda 69-190s según el instrumento (harness
local vs audit). El profiler `MAMBO_PROFILE_PARSE` mostró que la fase dominante
es la decodificación de imágenes: **37,6s de ~190s en el harness**, y el resto
se va en getOperatorList + el render de página por página. El `RENDER_CAP 6.0`
(de P19, 06/08) renderiza cada página hasta 6x para que el switch más chico
(~25pt) quede ≥150px — un render a 6x cuesta ~200ms/página.

La meta del spec anterior (≤55s el batch) no se alcanzó; la deuda quedó
documentada: **bajar RENDER_CAP requiere re-calibrar el gate de resolución de
imágenes** (photo-baseline: `min-avg 300`, `max-under-150 1`).

## Dirección

1. **U1 — A/B empírico** (delegado): medir los 13 PDFs con RENDER_CAP 6.0 /
   4.0 / 3.0: tiempo total, distribución de tamaños de las imágenes extraídas
   (cuántas quedan <150px, promedio por PDF), y el efecto en
   `photo-baseline`. Elegir el cap más bajo que no rompa el gate.
2. **U2 — Fix**: aplicar el cap elegido + ajustar el gate de calidad de imagen
   si el muestreo lo justifica (con 0 regresiones en photo-baseline).
3. **U3 — Golden + gates**: hash de extracción (los productos no cambian —
   solo el tamaño de las fotos, que no participa del hash de productos; se
   verifica el photo-baseline aparte) + tests + re-medición.
4. **U4 — Cierre**: registro en docs/PERF-baselines.md + PIL-baselines.

## Criterios de cierre (todos falsables)

- [ ] A/B documentado con los 3 caps (tiempo total + tamaño promedio + % <150px).
- [ ] RENDER_CAP bajado (4.0 o 3.0) sin romper photo-baseline ni aumentar
      % imágenes <150px vs baseline actual.
- [ ] Tiempo batch reducido ≥20% vs el RENDER_CAP 6.0 actual (mismo
      instrumento).
- [ ] Golden hash de productos IDÉNTICO (fd0ac1d1…) y photo-baseline sin
      regresión.
- [ ] npm test + lint + check:version + layout-audit verdes.

## No-goals

- NO cambiar el matcher de imágenes (solo el render).
- NO tocar photo-baseline.json como salida: solo re-generarlo y comparar.