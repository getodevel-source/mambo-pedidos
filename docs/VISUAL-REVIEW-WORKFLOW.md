# Visual Review Workflow (VRW) — revisión visual antes de entregar

El modelo de esta sesión NO ve imágenes. Para no entregar a ciegas (lección de
2026-08-31: "la app se ve más gigante que nunca" y no se detectó), toda entrega
de UI pasa por este pipeline. **Regla: nada de "listo" sin verificación visual
con números.**

## Fuentes de "visión" (en orden)

1. **Capturas pegadas por el usuario** (la mejor fuente: muestran SU pantalla
   real). El usuario pega el PNG (como hace con Orca) o deja la ruta.
2. **Capturas propias**: solos en un workspace dedicado (nunca el del usuario).
   Secuencia: `window.move` al ws nuevo → `focus` → grim → volver al ws del
   usuario. Con el usuario trabajando: pedir permiso o esperar.
3. **DOM del frontend** (Playwright/headless contra dist/): geometría y estilos
   computados en cualquier viewport — es la "visión" más precisa para layout.

## Pipeline de análisis de una captura (captura -> diagnóstico)

```
1. DIMENSIÓN   : PIL → tamaño px físicos, factor vs lógicos del monitor
2. ESCALA      : hyprctl monitors → scale actual; DPR del WebView =
                 ancho_físico / ancho_lógico_de_la_ventana
3. PÍXELES     : borde del sidebar (columna más brillante en la franja),
                 contenido pegado a bordes (cortes), zona del drawer
4. OCR TSV     : tesseract --psm 6 tsv → textos con bbox (x,y,w,h):
                 - posición del título vs esperado (sidebar+padding)
                 - altura del título (20px compacto vs 26px base)
                 - palabras tocando bordes (cortes)
5. CONTRASTAR  : los valores MEDIDOS vs los ESPERADOS por viewport:
                 viewport 1256-1600 → sidebar 225, título 20, main 22/24
                 viewport <=1100     → sidebar 225, título 18, main 16/18
                 viewport >1600      → sidebar 270, título 26, main 36/48
6. DIAGNÓSTICO : si 5 no coincide → causa (CSS viejo por caché WebKit,
                 DPR viejo por ventana abierta antes del cambio de escala,
                 ventana en tile chico, etc.) → fix → re-captura → 5 otra vez
```

## Checklist pre-entrega (NADA se entrega sin esto)

- [ ] Captura REAL de la app en el entorno actual (o DOM con el viewport real)
- [ ] DPR del WebView medido == scale del monitor (si no: relanzar app)
- [ ] Sidebar medido ∈ [220..235] CSS según el viewport activo
- [ ] Título medido == tamaño esperado del rango (18/20/26)
- [ ] 0 píxeles de contenido pegados al borde derecho (cortes)
- [ ] Overflow horizontal 0 (DOM) en el viewport real
- [ ] La captura se guarda en /tmp/mambo-shots/ con fecha (evidencia)
- [ ] El usuario confirma VISUALMENTE (una línea) antes del "listo"

## Cómo pedir / recibir capturas

- El usuario pega la imagen (ruta /tmp/orca-paste-*.png) → correr el pipeline.
- Si hace falta una vista específica (drawer abierto, tabla con datos): pedirla
  con instrucción concreta ("abrí el menú con ☰ y pegá la captura").
- Nunca pedir más de 1-2 capturas por turno.

## Evidencia de la lección 2026-08-31

La app quedó "más gigante que nunca" a escala 1.333: causas posibles (a)
ventana abierta con DPR viejo de otra escala, (b) layout base (no compacto) por
viewport >1600, (c) caché WebKit con CSS anterior. El pipeline de arriba lo
detecta midiendo el borde del sidebar y el tamaño del título, sin adivinar.