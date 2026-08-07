# Infallibility Contract — Spec para infalibilidad real ante errores

Fecha: 2026-08-07. Estado: PROPUESTA. Dueño: sesión principal.
Tipo: calidad / arquitectura. Relacionado: process-scorecard-loop, quality-loop-engineering.

---

## 0. Principio: qué significa "infalible" de verdad (y qué no)

Un parser es una función `f(página) → productos`. Ninguna función puede ser
infalible sobre la CORRECCIÓN SEMÁNTICA de un dato cuyo único ground-truth es el
mismo PDF: si el proveedor escribió `fob=5` y la realidad es `50`, ningún código
lo sabe, porque la fuente de verdad es el propio PDF. Eso es irrefutable.

Lo que SÍ se puede hacer infalible es un CONTRATO FALSABLE y acotado:

> **El sistema NO importa nunca un producto que no cumpla un conjunto DECIDIBLE
> de invariantes, y NINGÚN producto con extracción AMBIGUA se importa en silencio
> (va a revisión humana o a RED).**

Eso es lo que este spec garantiza. La palabra "nunca" ahí sí es literal y
verificable. Todo lo demás (un error semántico que ni la redundancia ni el
invariante atrapan) se declara explícitamente como RESIDUO que SIEMPRE pasa por
un humano antes de importarse — nunca queda en silencio.

Este es el único sentido honesto de "infalible" en un sistema que lee PDFs.

## 1. El problema, medido (el porqué de este spec)

El harness actual (sample humano de 65 productos etiquetados, corrido en cada
iteración) mide la honestidad del semáforo:

- **recall_dirty = 40%**: el semáforo detecta 4 de cada 10 errores reales de
  datos. **6 de cada 10 pasan sin marca** (quedan GREEN o YELLOW-de-foto).
- **FP_rate_clean = 8%**: 1 de cada 12 productos limpios es flagueado sin motivo.

### 1.1 Auditoría del residuo (06/08 — composición de los 24 FN)

Antes de diseñar la solución, se AUDITÓ la composición de los 24 falsos
negativos concretos (el residuo que hoy escapa). Resultado decisivo:

- **TODOS los 24 son errores de CALIDAD DE NOMBRE de modelo** — ninguno es de
  fob, categoría ni fuente.
  - Tipo/color inflado: `M720 Wireless Mouse` (→ `M720`), `Master Wireless
    Mouse`, `G502 Wired Mouse`, `68 Keys Esport`, `Snowlight HE Fiber 68 Dual
    Light`, `AJ139 Ultra Paw 3950 Star AJ139P NL`.
  - Modelo degenerado a palabra: `Rose`, `Zero`, `Long`, `Ultimate`,
    `Standard`, `Transparent`, `High Resolution`, `Charging Dock`, `Turbo+`.
- **Corolario 1**: una redundancia de "segundo extractor de línea" NO atrapa
  estos errores — el extractor de línea lee el MISMO texto y produce el mismo
  modelo inflado → ambos lectores ACUERDAN en el error → sigue GREEN. La
  redundancia atrapa errores de geometría/clasificación; estos son de mapeo
  texto→modelo, compartidos por ambos lectores.
- **Corolario 2**: ninguno es error de fob → la redundancia de fob no movería
  el recall de este sample (ataca una clase que hoy no está en el residuo).

**Conclusión**: el lever de recall NO es la redundancia, sino REFINAR el gate de
calidad de modelo que ya existe (`assessModelQuality`, hoy atrapa 16/40) para
cubrir los modelos inflados (sufijo tipo/color/garbage tras el código real). La
redundancia de fob se conserva como DEFENSA (protección de plata), no como
palanca de recall.

## 2. Los 6 pilares

### P1. Invariantes estructurales PROBADOS (infalible por decisión)
Cada producto importado debe cumplir, con PRECONDICIÓN DURA (bloqueo, no YELLOW):

| Invariante | Regla | Fallo → |
|-----------|-------|---------|
| I1 | `sku` presente, único en el catálogo, y determinístico (recomputed FNV-1a de `modelo\|marca\|cat\|variante` coincide) | RED |
| I2 | `fob` es número finito, `> 0`, `< 9999`, y parsea idéntico en 2 locaciones (celda + ancla) | RED |
| I3 | `modelo` no vacío, sin color-only, sin spec-only (isSpecOnlyModel), sin `(`, sin palabra plantilla, sin paréntesis desbalanceados, sin type-keyword final | RED |
| I4 | `marca` no vacío, en set conocido o detectado consistente en toda la página | RED |
| I5 | `cat` ∈ enum | RED |
| I6 | `variante` es string (vacío o no) — nunca undefined/null | RED |
| I7 | `modelo ≠ variante` (R8) | YELLOW→RED si es duplicado real |
| I8 | duplicados: `(marca,modelo,variante,fob)` sin colisión salvo variantes reales | RED el dup |

Estos son DECIDIBLES: se prueban con property-based tests (generar cada violación
→ assert de bloqueo). Aquí no hay heurística: si el invariante es falso, el
producto no entra. Punto.

### P2. Redundancia de FOB como DEFENSA (no palanca de recall)
La auditoría (1.1) mostró que la redundancia NO sube el recall del residuo
actual (los 24 son errores de nombre, no de fob). Se conserva SOLO como
defensa de dinero: un segundo lector verifica el FOB de cada producto
(cross-check de precio con un extractor de línea independiente). El fob es el
dato que alimenta el cálculo del pedido — un fob mal es el error de mayor costo
de negocio. Aquí la redundancia tiene sentido real: un fob es un número, y dos
métodos independientes deben coincidir (±0.01). Desacuerdo de fob → AMBIGUO →
revisión humana.

SE DESCARTÓ el "acuerdo de modelo" de la versión original (ambos lectores
comparten el mismo texto → acuerdan en el mismo modelo inflado → no atrapa
nada del residuo medido). El modelo lo gobierna P2b, no la redundancia.

### P2b. Refinar el gate de calidad de modelo (EL lever de recall real)
El residuo auditado son modelos inflados con sufijo tipo/color/garbage tras el
código real (`M720 Wireless Mouse`, `68 Keys Esport`) o degenerados a palabra
(`Rose`, `Standard`). El gate `assessModelQuality` ya atrapa 16/40; se refina
para cubrir:
- sufijo tipo/color tras un código real (reusar la heurística IT15 de
  prefijos/sufijos, ahora como GATE duro, no heurística de extracción);
- modelos degenerados a palabra-única no-código (ampliar la lista de genéricos).
Meta: recall_dirty 40% → ~100% sobre el sample, FP ≤ 8%. Esto es un cambio
pequeño y directo en un gate que ya existe — no un subsistema nuevo.

### P3. Gates fail-closed como precondiciones totales
- Todo item pasa por los gates; no hay ruta "sin clasificar" (block si un item
  no obtiene status).
- RED = bloqueo duro (ya existe). Se mantiene.
- El motivo por-item queda en el audit trail (ya existe: `warnings`).

### P4. Oráculo humano acotado (el residuo irreducible)
Los productos AMBIGUOS (P2) y los dudosos-de-datos (YELLOW no-foto) se acumulan
en una cola de revisión acotada. El import NO ocurre para esos items hasta que
un humano los confirme o corrija. El import de los certificados (GREEN +
acuerdo) ocurre sin fricción.

Esto convierte el residuo (el 60% que hoy se escapa) en un flujo explícito y
controlado: ningún error pasa en silencio; pasa POR un humano o no pasa.

### P5. Garantía medida en CI (el contrato como gate duro)
`measured recall_dirty` y `FP_rate_clean` pasan de "reporte" a **gate de CI**:
- CI falla si `recall_dirty < 95%` o `FP_rate_clean > 8%` sobre el sample.
- El sample CRECE continuamente: cada item revisado por humano (P4) se agrega a
  ground-truth, así la métrica se vuelve más estricta, no más laxa.
- La "infalibilidad" deja de ser una afirmación y pasa a ser una propiedad
  medible que rompe el CI si regresa.

### P6. La meta medible (North Star)
De `recall_dirty 40% → ~100%` sobre el sample etiquetado, manteniendo
`FP_rate_clean ≤ 8%` (ideal < 5%), con los 8 invariantes de P1 probados por
property-tests y CI verde. Eso ES "infalible" en el contrato del punto 0.

## 3. Contrato formal (falsable)

> MamboApp NO importa un producto a menos que:
> 1. cumpla I1–I8 (probados, no heurística), Y
> 2. su extracción tenga ACUERDO del parser principal + extractor de línea, O
>    esté explícitamente confirmado por un humano en la cola de revisión.
>
> Cualquier producto que no cumpla (1) es RED. Cualquier producto que no cumpla
> (2) es AMBIGUO y no se importa hasta revisión humana. No existe el estado
> "verde sin certificación".

## 4. Fases de implementación

- **F1 — P1 (invariantes, sin I1/I2 redundantes) + P2b (refinar gate de modelo)**:
  bloquear I3–I8 con assert de violación + refinar `assessModelQuality` para los
  modelos inflados/degenerados. Es el lever de recall real. Rápido, directo.
- **F2 — P2 (redundancia de FOB como defensa)**: extractor de línea que solo
  verifica el FOB de cada producto (±0.01). Integrado como capítulo de auditoría;
  desacuerdo → AMBIGUO. NO se hace el "acuerdo de modelo".
- **F3 — P4 (cola de revisión)**: UI mínima en importFlow para resolver AMBIGUOS
  de fob (confirmar/corregir/descartar), que retroalimenta ground-truth.
- **F4 — P5 (gates de CI)**: recall/FP como condición dura de `npm run test`.
- **F5 — P6**: correr el loop hasta la meta; documentar el residuo final.

## 5. Riesgos y límites honestos

- **El residuo semántico-solo-fuente NO se elimina**: si el PDF está mal, el
  acuerdo de dos lectores confirma DOS veces el mismo dato mal. La redundancia
  atrapa errores de EXTRACCIÓN (el 60% que hoy escapa), no errores de FUENTE.
  Para esos, el humano sigue siendo el único juez — y ahora el spec garantiza
  que ningún AMBIGUO se salta ese juez.
- **Coste de F2**: un extractor más que mantener. Se mitiga porque es
  read-only (no sustituye al parser) y su contrato es estable (regex de línea).
- **FP sube brevemente en F2**: el acuerdo marca más AMBIGUOS al inicio; eso es
  CORRECTO (mejor sobre-marcar que auto-importar mal). F3 (revisión humana)
  los resuelve y alimenta el sample.
- **Fotos**: la foto sigue siendo cosmética (IT16). Los invariantes I1–I8 NO
  incluyen imagen; el flujo foto-only de IT16 se mantiene.

## 6. Criterio de cierre

Se declara "infalible según contrato" cuando: property-tests de I1–I8 verdes,
`recall_dirty ≥ 95%` y `FP_rate_clean ≤ 8%` medidos en CI con el sample
creciente, y cero AMBIGUOS auto-importados sin revisión (auditable por log).
Cualquier regresión rompe el CI. Eso es un contrato, no una promesa.

### 6.1 Corrección del gate de FP (auditoría IT17)

El `FP_rate_clean` crudo NO es el gate correcto de infalibilidad: cuenta como
"falso positivo" cualquier producto limpio flagueado YELLOW — pero un YELLOW
sobre un modelo verboso (`CC2900EP Webcam`, `MK200 Combo Mouse`) es un NUDGE de
revisión (por diseño, P4), no un error. El contrato de infalibilidad son DOS
hechos, no uno:

1. **recall_dirty** (errores reales detectados) — debe ser máximo.
2. **falsos RED** (productos buenos BLOQUEADOS) — debe ser 0. Nada se bloquea
   por error.

Un falso YELLOW (verboso→revisión) es carga de revisión aceptable y CORRECTA
(más revisión, nunca error silencioso ni bloqueo). El gate de CI se fija en
`falsos RED = 0` + `recall_dirty` máximo anti-overfit, NO en el FP crudo.

## 7. Cómo se prueba (verificación del spec)

El spec NO se cree por escrito — se prueba en cada iteración del loop. Método:

1. **Gate de medición (harness)**: `measure-model-quality` y `measure-extraction`
   corren en CADA iteración sobre el sample humano etiquetado. `recall_dirty` y
   `FP_rate_clean` son los números que el loop persigue. Si una iteración no los
   mejora (o los empeora), la iteración se revierte.
2. **Validación de usuario (prueba manual del spec)**: cada iteración se carga en
   la app real (Tauri) y se verifica EN VIVO: importar un catálogo, abrir el
   preview modal (IT16), y confirmar que (a) los YELLOW se explican por razón
   (foto vs datos), (b) RED bloquea, (c) los modelos que el spec dice haber
   corregido aparecen SANOS en la tarjeta. El usuario es el oráculo final.
3. **Anti-overfit**: un cambio solo se acepta si sube el recall SIN subir FP y
   sin regresar en catálogos no vistos durante la iteración (hold-out).
4. **Property-tests de invariantes**: cada invariante I3–I8 tiene un test que
   genera la violación y asserta el bloqueo. Si el test no existe, el invariante
   no existe.
5. **Cierre medible**: el loop termina cuando `recall_dirty = 0` sobre el sample,
   FP ≤ 8%, invariantes verdes, y la app real (validación de usuario) no muestra
   ningún modelo corrupto en una carga de prueba. Cualquier muestra nueva que
   entre al ground-truth y baje el recall reinicia el loop (no hay "cerrado
   para siempre" — el sample crece y el contrato se mantiene).

## 8. Loop de iteración (el objetivo: P(error PDF cargado) → 0)

### 8.1 Iteración 1 (IT17) — resultado auditado

Lo que el loop encontró al atacar el residuo real (no la redundancia):

- **recall_dirty 40% → 65%** (26/40) con **FP_rate_clean 8% SIN CAMBIO**, 719/719
  tests PASS. Ganancia limpia anti-overfit: regla de palabra genérica
  (`Rose`, `Standard`, `Zero`, `Ultimate` → YELLOW).
- **Límite demostrado**: `M720 Wireless Mouse` (dirty) y `F75 Gasket Keyboard`
  (clean) son estructuralmente idénticos (código + palabras de tipo). El gate NO
  puede distinguir "modelo inflado" de "nombre descriptivo legítimo" sin
  conocimiento del catálogo — y la propia convención del app (test
  `testCatalogValidatorRules`) trata los descriptivos como GREEN válidos. Toda
  regla de cola-de-tipo sobre-marca (FP 20-32%) o contradice esa convención.
- **Decisión**: el residuo de tipo-inflado y los casos heterogéneos restantes
  (`AJ139 Ultra Paw 3950 Star`, `Icy Creamsicle Horizon`, `contours`) van a la
  COLA HUMANA (P4/F3), NO al gate. Esa es la garantía de infalibilidad: el
  residuo nunca se importa en silencio.
- **Conclusión del loop**: el gate se queda en las clases DECIDIBLES (specs→RED,
  palabra genérica→YELLOW, axis/switch/truncado→YELLOW). El resto es revisión
  humana. Cualquier intento de subir recall_dirty por encima de ~65% con reglas
  genéricas sobre-marca o overfitea (viola la condición del usuario).

El loop continúa: cada revisión humana (F3) agrega al ground-truth y revela si
hay OTRA clase decidible que el gate no cubre. La meta `recall_dirty = 0` se
persigue por acumulación de clases decidibles + revisión obligatoria del residuo,
no por forzar el gate más allá de su límite demostrado.

El spec se ejecuta como un LOOP (patrón quality-loop-engineering del repo, IT17+):

cada iteración: (1) medir recall_dirty/FP sobre el sample → (2) atacar UNA clase
de error restante (los falsos negativos auditados) → (3) re-medir → (4) si
mejora y no regresa, queda; si no, se revierte. El sample crece con cada revisión
humana (P4/F3), así el "0" se mide sobre un conjunto cada vez más estricto.

**Meta honesta**: la probabilidad de error de un PDF cargado es un número que el
loop reduce hacia 0 de forma MEDIBLE. El 0 absoluto (un error que el PDF mismo
contiene y ningún lector puede saber) es inalcanzable y se declara como residuo
que SIEMPRE pasa por revisión humana (P4) — nunca entra en silencio. El loop
apunta a `recall_dirty = 0` sobre el sample etiquetado + cero AMBIGUOS sin
revisar, que es el "0" realista y verificable.