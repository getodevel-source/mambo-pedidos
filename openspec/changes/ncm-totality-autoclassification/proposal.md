# NCM Totalidad + Autoclasificación — Spec auditado

Fecha: 2026-08-07. Estado: PROPUESTA. Dueño: sesión principal.
Tipo: data / clasificación / feature. Relacionado: guided-import-wizard, infallibility-contract.

---

## 0. Problema

La app importa "cualquier producto" (el parser es general), pero la clasificación NCM
y los aranceles solo cubren las categorías de periféricos + electrodomésticos comunes.
Un producto fuera de eso cae en "OTRO" con NCM y arancel incorrectos. Para que la app
sea una herramienta de importación general hay que:

1. Incorporar la **totalidad del NCM** (~15.000 códigos de 8 dígitos con su arancel).
2. **Autoclasificar producto por producto** su NCM correcto a partir del texto del PDF.

## 1. Fuente de datos — ruta auditada

La base oficial del NCM con aranceles existe en dos formas:

| Fuente | Contenido | Accesibilidad | Veredicto |
|---|---|---|---|
| **MERCOSUR** (polcom.mercosur.int) | NCM + descripción + AEC + BK/BIT, 15.159 registros, al 01/02/2026 | Cloudflare (no scrapeable) | ✗ bloqueado |
| **ARCA / AFIP** (Nomenclatura NCM + Arancel de Importación) | NCM + descripción + DI (derecho de importación extrazona) — el dato que Argentina realmente cobra | Consulta web con paginación; menos protegida que MERCOSUR | ✓ vía pipeline |
| **pcram.net** | NCM + AEC + DIE + TE + RE, por búsqueda | Consulta por código/descripción | ✓ cross-check |

**Decisión de adquisición**: la fuente PRIMARIA es ARCA/AFIP (tiene el DI real, que es lo
que se cobra). El pipeline jala la Nomenclatura completa (paginada) y extrae
`{ ncm: '8471.60.52', desc: '...', di: 0.12 }` por registro. pcram.net se usa como
cross-check de una muestra (~200 códigos) para validar que el DI de ARCA coincide.

**Riesgo clave (auditado)**:
- El scrape de ARCA puede tener paginación pesada (~15k registros) y captcha eventual.
  Mitigación: se hace UNA vez como pipeline de datos (subagente dedicado), se guarda como
  archivo de datos en el repo, y la app lo consume estático (no scrapea en runtime).
- Frescura: los aranceles cambian. El archivo lleva fecha de vigencia y el wizard avisa
  si expira (ya existe el banner de vigencia IT20).

## 2. Estructura de datos

Archivo `src/data/ncmDatabase.json` (~1-2MB, 15k registros):
```json
{ "vigencia": "2026-08-01", "fuente": "ARCA/AFIP", "registros": [
  { "ncm": "8471.60.52", "desc": "Teclados", "di": 0.12, "bk": false, "bit": false, "te": 0.03 },
  ...
]}
```
- Se carga una vez al iniciar (lazy, como pdf.js) y se indexa en memoria.
- Índices: (a) por código NCM → registro (lookup exacto), (b) inverted-index token→NCM
  (para autoclasificación por texto).

## 3. Autoclasificación por producto (diseño)

1. **Detección de categoría** (ya existe, `detectCategory`): da una categoría de alto
   nivel (MOUSE, LAVADORA, OTRO...).
2. **Búsqueda por texto**: dado el texto del producto (modelo + variante + marca), se
   tokeniza y se puntúa cada descripción NCM por superposición de tokens (scoring IDF).
3. **Match por categoría**: si `detectCategory` dio una categoría distinta de OTRO, se
   restringe la búsqueda a los NCM de familia BK/BIT o a la sub-partida esperada.
4. **Confianza**: se calcula un score. Si el mejor match supera un umbral → se asigna
   ese NCM. Si no → el producto queda **pendiente de clasificación** (manual).
5. **Manual (fallback)**: el wizard muestra el producto sin clasificar + un buscador
   sobre la base completa NCM; el usuario elige el NCM y el arancel se aplica.

**Métrica de cierre**: sobre una muestra etiquetada de productos, la autoclasificación
debe acertar el NCM correcto en ≥80% (recall@1) con FP-manual bajo; el resto va a
confirmación manual (nunca silencioso — coherente con infallibility-contract).

## 4. Integración con la app

- El motor de tributos (`calculateDoorToDoorExactCost`) usa el `di` del registro NCM
  en vez de la matriz hardcodeada cuando el NCM viene de la base completa.
- El wizard (Paso 4) muestra el NCM autoclasificado por producto + permite override.
- El motor de categorías (`detectCategory`) alimenta la búsqueda NCM.
- La matriz NCM hardcodeada actual (periféricos + electrodomésticos) queda como fallback
  rápido y para los casos ya validados; la base completa es la fuente general.

## 5. Fases

- **F1 — Adquisición de datos**: pipeline que jala la base ARCA completa → `ncmDatabase.json`.
  Validación con pcram.net (muestra). Commit del archivo de datos.
- **F2 — Carga + índice**: módulo `ncmDatabase.js` (lazy load, lookup por código, inverted index).
- **F3 — Autoclasificador**: `ncmClassifier.js` (detectCategory → búsqueda por texto → score → asignación).
- **F4 — UI**: wizard Paso 4 muestra NCM por producto + buscador manual + pendientes.
- **F5 — Validación**: métrica recall@1 sobre muestra etiquetada; tests; audit.

## 6. Criterio de cierre

- `ncmDatabase.json` con la totalidad (≈15k) y vigencia.
- Autoclasificación recall@1 ≥ 80% en la muestra; resto a manual (nunca silencioso).
- Motor de tributos usa el DI del registro NCM.
- 982+ tests verdes + lint 0/0 + audit fail-closed intacto.

## 7. Riesgos honestos

- La adquisición de 15k registros es un pipeline de datos frágil (paginación, captcha).
  Se hace una vez, se commitea el archivo; no se scrapea en runtime.
- El autoclasificador tiene un techo: NCM de 8 dígitos son muy específicos; el recall@1
  realista es ~80%, el resto requiere confirmación humana (diseño fail-safe).
- La matriz hardcodeada actual no se borra: es el fallback validado y rápido.
  El `di` de la base completa es la fuente general; la frescura se controla con vigencia.