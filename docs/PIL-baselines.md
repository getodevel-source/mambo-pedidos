# PIL Baselines — métricas por iteración del Parser Iteration Loop

## Iteración 0 — Baseline inicial (2026-08-30)

Entorno: Linux, `MAMBO_CATALOG_DIR=~/Downloads`, los 13 PDFs de proveedores.

| Métrica | Valor |
|---|---|
| Productos extraídos (13 PDFs) | 1.472 (cargados en la app) |
| RED de calidad de modelo | **48** — patrón dominante: "Modelo = specs técnicas de hoja de datos" |
| YELLOW a revisar | 341 |
| Image-fit mismatches | 174 (todos advisory, 0 duros) |
| RED estructurales | 0 |
| Snapshot vs parser actual | 52,3% de ids casados — **snapshot desfasado** |
| Visual ground truth (n=65, snapshot viejo) | recall dirty 100% (40/40), FP 8% (2/25) |

Patrones de falla visibles en el diff de 65 casos (top):
1. **Switch/spec names robando el modelo** (p.ej. modelo="Mount Tai GT" en vez de "Ace68GT"; #62, #65 críticos).
2. **Sufijos V2/V9 perdidos o mal ubicados** (#55, #61 críticos).
3. **Celdas fusionadas con alineación ambigua** (#50 menor).

Primer paso recomendado: re-etiquetar el snapshot (`node scripts/ground-truth-diff.js --packet`,
65 casos) para que las métricas vuelvan a describir el parser actual.

## Iteración 1 — (pendiente)
## Iteración 1 — Residuos de celda y genéricas en el gate (2026-08-30)

Patrón: paréntesis residuales en modelo ("F87 (dark )", "dark )", "F75 Glacier (Light")
y palabras genéricas sin código ("Printed", "Dust Printed", "Screen").

Cambio: `src/js/textSanitizer.js` — regla de brackets (cualquier paréntesis/llave en
el modelo → YELLOW) + `GENERIC_WORD_RE` ampliada (printed, dust printed, screen).
7 tests nuevos (5 YELLOW + 2 anti-overfit GREEN). Gate runtime confirmado por tests.

Medición: el recall NO pudo leerse — hallazgo de la iteración: el muestreo RNG
(`ground-truth.js`) re-ancla los ids a OTROS productos cuando la extracción cambia
(el #31 saltó de "F87 (dark )" a "EDCX" entre corridas con el mismo parser), así
que `measure-model-quality` compara etiquetas contra productos distintos.

**Iteración 2 (plan)**: anclar los ids por posición física (pdf+página+x+y) en
`ground-truth.js` para que el snapshot sea estable ante cambios de extracción;
después re-medir recall/FP de verdad y atacar el próximo patrón (pérdida de
sufijos V2/V9 / switch names en modelo — 2 de cada 3 críticos del diff).

Deuda registrada: `ponytail:` la medición actual no es confiable hasta anclar ids.


## Iteración 2 — Estabilización de la medición (2026-08-31)

Problema: el muestreo RNG re-anclaba los ids a otros productos cuando la
extracción cambia (el pool cambia) → `measure-model-quality` comparaba etiquetas
contra productos distintos → recall ilegible.

Cambio:
- `ground-truth/anchors.json` (nuevo, versionado): 65 posiciones físicas
  (pdf+página+x+y) ancladas.
- `scripts/ground-truth.js`: si existen anchors, re-extrae POR POSICIÓN (match
  manhattan <40px); huérfanos → `status: MISSING` (cobertura perdida, se
  reporta aparte). Sin anchors: RNG histórico + escribe anchors.
- `scripts/measure-model-quality.js`: los casos MISSING se cuentan aparte
  (missing=0 hoy); guard doble: 2 corridas ancladas → manifests idénticos.

Re-etiquetado de cierre: #17/#18/#19 (modelos parciales: "Side Printed"×2 y
F75+color) → CAMPO; #61 "Turbo+ V9" → OK (la página lo confirma). Todos con
verificación OCR de los renders.

**Resultado (medición estable, n=65, missing=0):**
| Métrica | Iter 0 | Iter 1 | Ahora |
|---|---|---|---|
| recall_dirty | 23% (7/31) | 23%* | **30% (10/33)** |
| FP_rate_clean | 6% | 9%* | **0% (0/32)** |
| *no legible: ids re-anclados | | | |

Los 23 FN restantes son pérdida de EXTRACCIÓN (código correcto pero incompleto
en la celda) — trabajo del parser, próxima iteración.


## Iteraciones 3-4 — Hoja de specs de switch + código duplicado (2026-08-31)

Iteración 3 (medición estable de la iteración 2): los FN #36-40 eran páginas
de HOJA DE SPECS DE SWITCH sueltos (raw: "Total stroke / Upper cover material")
— ruido de catálogo importado como producto. Reglas en `textSanitizer.js`:
- raw con plantilla de specs de switch → YELLOW (no importable)
- modelo sin código ni dígitos + "switch/axis" en la celda cruda → YELLOW
  (Flame/Serpent/Midnight Blue: el switch quedó como modelo)

Iteración 4: código del producto duplicado en el modelo (celda
nombre+descripción: "AK980V2PRO Lychee AK980 Transparent") → YELLOW. Se
normaliza el código al núcleo alfanumérico (AK980V → AK980) antes de buscar la
duplicación para no falsar con sufijos V2/PRO.

9 tests nuevos (7 PIL3 + 2 PIL4), anti-overfit verificado en los 65 casos.

| Métrica | Iter 0 | Iter 2 | Iter 3 | Ahora |
|---|---|---|---|---|
| recall_dirty | 23% | 30% | 52% / 55%* | **55% (18/33)** |
| FP_rate_clean | 6% | 0% | 0% | **0% (0/32)** |
| *52% con la regla afinada (sin dígitos) para eliminar 1 FP | | | | |

Los 15 FN restantes: celdas nombre+descripción con UN solo código ("A87 Plum
Pro Sea Salt"), nombres de serie sin código ("Serpent" sin switch en raw),
"V3 Tri Mode" (spec de modo) — requieren trabajo de EXTRACCIÓN en pdfParser.js
(separar variante de modelo), no reglas de gate. Siguiente iteración (5):
parser: partir el modelo en código + resto cuando la celda trae más de 2
palabras después del código.

## PIL5 (repo-improvement-sprint) — celdas completo + re-calibración del snapshot

Diagnóstico: de los 15 FN, 10 eran extracción CORRECTA con veredictos del
etiquetado viejo mal calibrados (confirmados por OCR de los renders) — se
re-etiquetaron (OK/MENOR). Los 4-5 restantes son pérdida de token que el gate
no puede detectar sin conocimiento del catálogo (techo documentado: "Star" en
X820Ultra, "68" en MAD V2, discordancia EDCX/G502-X/A87 del snapshot).

Gate nuevo (textSanitizer): "La celda trae más información de la que se
extrajo" — raw tokens >= extraídos+4 con código en el modelo → YELLOW.
3 tests (1 + 2 anti-overfit con variantes reales) + ajuste del anti-overfit
PIL3 (variante real, no vacía).

| Métrica | PIL1-4 | PIL5 |
|---|---|---|
| recall_dirty | 55% (18/33) | **83% (19/23)** |
| FP_rate_clean | 0% | **0% (0/42)** |
| missing | 0 | 0 |
| FN restantes | 15 | 4 (techo documentado, sin FPs posibles) |

## assignment-anchors (2026-08-31) — calidad de anclaje FOB

Problema: 97 YELLOW de anclaje (63 "fila vecina" + 34 "no alineada"), 84 de KZ
(88%). Muestreo OCR (10 casos + 1 dudoso): 10/10 FPs — el FOB asignado era el
correcto; el warning geométrico no entiende DOS formatos reales:
- KZ matriz: fila de modelos propia + fila "USD PRICE" común → la columna
  asigna bien, la geometría falla.
- Celdas multilínea (8BitDo/Logitech/Razer): nombre/¥/$ en la MISMA celda en
  líneas distintas → dy > tolerancia sin cruce.

Fix (pdfParser.verifyGrounding paso 3.5): MATRIX MODE — si la página tiene
>=3 anclas en el mismo y (fila de precios compartida) y la verificación
geométrica falló, el precio por columna es válido → grounded. En tablas
normales el camino geometrico no cambia (test: alineada pasa, desalineada
real sigue fallando).

Resultado: anclas 97 → **13** (KZ 84 eliminadas). Golden: hash de extracción
IDÉNTICO (fd0ac1d1… — los FOB de matriz ya eran correctos; solo cambia el
semáforo). YELLOW totales 654 → 582. Los 13 restantes (0,6% del catálogo):
celdas multilínea con dy > tol, precio correcto confirmado por muestreo →
techo documentado. 3 tests nuevos (matriz / tabla normal / desalineada real).

## Iteración 3 — Re-etiquetado con evidencia de crops (2026-09-03)

Problema: 12 de los 21 FNs no eran fallas del parser actual sino etiquetas
viejas (la extracción mejoró desde el etiquetado y nadie lo confirmó).
Evidencia: revisión crop por crop (ground-truth/page_*.png) + tabla de
diagnóstico (manifest actual vs veredicto).

Cambio (solo `ground-truth/verdicts.json`, sin código):
- OK (9): #13 (ATK strip), #22 (V3 Tri-Mode), #24 (V6), #27 (Mars strip),
  #43 (M750 M literal), #44 (DESLINEADO resuelto solo), #56 (RK- strip),
  #59 (R98 completo), #62 (Ace68GT completo). Criterio: modelo+var+precio
  identifican una fila única del crop.
- MENOR (3): #9 (modelo OK, ruido OCR en var), #31 (modelo+precio OK,
  variante filtrada de otra fila), #61 (reorder cosmético Turbo+ V9).
- NO se re-etiqueta #5: 'Ultimate 2C'+'Orange Green' es AMBIGUO (existe en
  wireless $19.40 y wired $15.45) — el strippeo de 'Wired Controller' fue
  demasiado lejos. Queda CAMPO para iteración de código.

| Métrica | antes | IT3 |
|---|---|---|
| recall_dirty | 48% (19/40) | **68% (19/28)** |
| FP_rate_clean | 0% (0/25) | **0% (0/37)** |
| extracción (measure-extraction) | — | 0 cambiaron (sin regresión) |

FNs restantes (9, con causa): #5 (strip desambiguador), #8 (qualifier MAX),
#11 (switch+color en modelo, var huérfana), #16 (modelo fusionado perdido),
#23 (techo: ambigüedad Star/+Gift), #33 (qualifier de matriz), #57 (V2 del
axis pegado), #63 (dígito de versión perdido upstream), #64 (colorway en modelo).

## Iteración 4 — Gate variante huérfana PIL6 (2026-09-03)

Patrón: split de celda roto deja un fragmento de switch/axis solo en la
variante mientras el resto (switch+color) queda en el modelo. Caso #11:
modelo='A87 Plum Pro Sea Salt' var='axis' (verdad: A87 / Plum axis Pro /
Sea Salt, crop page_11_ATK_Price_list_2607__p4.png).

Cambio (`src/js/textSanitizer.js` assessModelQuality): variante que matchea
/^(axis|switch|switches)(\s+(pro|plus|max|ultra|v\d+))?$/i → YELLOW con razón.
Riesgo FP medido: 0 casos en el snapshot n=65 (ninguna variante legítima es
solo "axis"/"switch"). 3 tests (1 RED→GREEN + 2 anti-overfit).

| Métrica | IT3 | IT4 |
|---|---|---|
| recall_dirty | 68% (19/28) | **71% (20/28)** |
| FP_rate_clean | 0% (0/37) | **0% (0/37)** |
| extracción (measure-extraction) | 0 cambiaron | 0 cambiaron (gate puro) |

## Iteración 5 — Gate colisiones de identidad PIL7 (2026-09-03)

Patrón: filas de bloques fusionados que pierden su desambiguador (wired vs
wireless, switch, colorway) colapsan en la misma identidad con distinto FOB.
Medido en el export completo: 85 grupos (ej. 'Ultimate 2C'+'Purple' @ 19.40 y
@ 15.45) — comprar por esa fila puede traer el producto equivocado. Evidencia:
`--items` en 8BitDo p2 (el texto "Wired Controller" está a 72px de la fila de
precio: el bbox no lo ve) + conteo de grupos en catalog-export.json.

Cambio (`src/js/pdfParser.js` finalize): `flagIdentityCollisions(products)` —
misma marca+cat+modelo+variante con >1 FOB distinto → YELLOW + razón a todos
los miembros (solo degrada GREEN, nunca RED/borra). Agnóstico al layout:
sirve para cualquier catálogo. 2 tests (grupo colisionado + 4 anti-overfit:
única/mismo FOB/otra marca intactos).

| Métrica | IT4 | IT5 |
|---|---|---|
| recall_dirty | 71% (20/28) | 71% (sin cambio: el gate es batch, no per-item) |
| FP_rate_clean | 0% | 0% |
| extracción (measure-extraction) | 0 cambiaron | 0 cambiaron (ningún caso del snapshot colisiona) |
| cobertura real | — | **~90 grupos / 191 filas marcadas en el catálogo completo** |
