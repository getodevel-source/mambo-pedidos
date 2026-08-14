# Proposal — vision-category-extraction

## Intent

Hoy la categoría y el color de un producto se derivan **solo del texto** (`pdfParserClassifier.detectCategoryWithEvidence`) y de heurísticas de color/aspect. Un pase de visión humano confirmó un mis-assign sistemático de categoría (mouse↔teclado) que el runtime no puede detectar ni corregir sin fabricar resultados. Este cambio propone validar categoría/color contra el **contenido de la imagen** en la extracción, para llevar el semáforo a su máximo honesto en cualquier catálogo futuro.

## Problema (evidencia)

- Correcciones por visión de 113 SKUs subieron GREEN elegible de 90.5% → 94.8% con **0 falsos positivos**; el resto (~117) es visión-dependiente.
- `MCH-TEC-*` son teclados correctos con render en retrato → el gate de aspect los marca FP. No hay señal runtime segura que los separe de un mouse mis-assigned (la densidad de bordes NO separa: mice perforados ≈ teclados).
- La categoría sale de regex sobre texto; la imagen (fuente de verdad) nunca se consulta.

## Por qué no es un parche de código

Cualquier regla runtime (aspect, marca, densidad) crea falsos positivos o overfit. Validar contenido requiere **visión/ML**. Por eso esto es un proyecto, no un fix.

## Enfoque propuesto

1. **Modelo de visión liviano** (clasificador de categoría por imagen: teclado/mouse/headset/mousepad/controller) ejecutado en la extracción o como paso offline.
2. **Fusión texto+imagen**: la categoría final combina la confianza del texto y la del modelo; si contradicen, se marca `_categoryUncertain` y se enruta a revisión (fail-closed), nunca se asigna duro.
3. **Color desde la imagen** con la misma fusión, reemplazando heurísticas frágiles.
4. **Guardas**: hold-out leave-one-catalog-out + promotion-audit 0 FP + anti-overfit, como hoy.

## Non-goals

- No aflojar gates existentes.
- No hardcodear marcas/SKUs en el runtime.
- No prometer 100% sin el modelo; el techo lo pone la calidad del modelo + revisión humana de inciertos.

## Éxito

- El mis-assign mouse↔teclado deja de producir YELLOW/FP en catálogos nuevos.
- GREEN elegible sube con **0 falsos positivos** medidos por el harness actual.
