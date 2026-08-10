# Calidad de imágenes de catálogo al importar (photo-quality)

## Problema (medido 10/08/2026)

Todas las fotos importadas se guardan con el lado **mayor ≤ 150px**. La causa es
el cap de `pdfParser.js` (línea ~260, ruta render P19):

```js
const scaleUp = Math.min(1, MAX_DIM / Math.max(sw, sh)); // MAX_DIM = 150
```

Esto REDUCE cada recorte para que su lado más largo quede en 150px, no "mínimo
150px de calidad". Auditoría real (pipeline `processPdfFile` sobre los 13
catálogos de `C:\Mambo\Catalogos`, setup idéntico a `ground-truth.js`):

- **2.359 productos, 100% con imagen asignada, 0 en blanco** en la muestra de 104
  imágenes. El matcher imagen→producto funciona: las fotos SALEN.
- **84% de las fotos tiene lado menor < 150px** (avg 67–148px por catálogo).
- Verdict visual (4 muestras con modelo de visión): se identifica el producto
  (mando, switch, mouse Razer) pero "muy pixelada y borrosa".
- **Recortes malos**: el crop puede agarrar el borde de la página (MCHOSE: casi
  todo blanco + franja oscura). El gate actual `stdev < 15` NO lo detecta.

Raíz del cap: es un tradeoff de storage. Las fotos viven como data URLs dentro
del JSON del catálogo (Tauri Store + fallback LocalStorage). Medido a MAX_DIM=300:
el tamaño medio sube 3–4x (17→52KB, 30→90KB, 45→145KB) y el catálogo total pasa de
~35MB a ~139MB (AULA, el más grande, ~32MB solo). Mientras las fotos estén en el
JSON, hay techo de calidad de facto.

## Dirección

Separar las imágenes del JSON (guardarlas como archivos en el app-data) desacopla
calidad de quota → "mejor calidad posible" sin pared. Evidencia de que el camino
ya está habilitado:

- `capabilities/default.json` ya incluye `fs:allow-app-read-recursive` y
  `fs:allow-app-write-recursive`.
- `openspec/config.yaml` ya lista **"image storage separation"** en el alcance
  inicial de calidad.

## Objetivo de calidad (falsable)

- Lado menor **≥ 300px** de objetivo, **ideal 400px**, para fotos sanas (cuando la
  resolución nativa en el PDF lo permite; nunca upscale).
- **0%** de recortes en blanco/rotos en una muestra auditada.
- Presupuesto de storage: filesystem por catálogo, sin límite de quota de JSON.

## No-goals

- NO tocar textExtraction / table-columns (FASE 2 `table-parser-column-detection`
  en curso por otra sesión; no mergear sobre ella).
- NO mover el parser a Rust (el parser JS ya es correcto; el problema es el cap,
  no el lenguaje).
- NO upscale: la calidad máxima es la resolución nativa embebida en el PDF.

## Fases

### Fase B (la real): imágenes a archivos
1. **Persistencia**: cuando se guarda un catálogo, escribir cada data URL → a
   `app-data/images/<catalog>/<sku>.png`; el JSON guarda solo la referencia.
2. **Carga**: leer refs y cargar imágenes lazy (async) al renderizar.
3. **GC**: eliminar archivos huérfanos al sobrescribir un catálogo.
4. **Migración**: re-importar catálogos existentes o re-extraer con la nueva
   calidad (script contra `C:\Mambo\Catalogos`).
5. **Import flow**: `processPdfFile` sigue devolviendo data URLs; quien persiste
   (storage.js) decide archivo vs JSON — no cambia el contrato del parser.

### Gate de calidad/crop
Extender `stdev < 15` con detección de "crop marginal" (borde sólido, contenido
en % pequeño de la imagen) + muestreo visual. El veredicto pasa de "sale algo" a
"sale el producto entero".

## Re-auditoría (10/08/2026, previa a implementación)

El working tree estaba limpio y la medición se re-confirmó (84% <150px, avg
67–148px, 0 blanks). Pero el alcance estimado era MENOR de lo pensado:

- storage.js YA tiene scaffolding de separación de imágenes: `buildImageRef`,
  `auditInlineImages`, `buildMigrationReceipt`, `checkIdempotence` — testeados
  (tests.js 1885–1946). El ref lleva `relativePath: images/<id>.<ext>`.
- Pero la ESCRITURA a archivo NO está implementada: cero llamadas al plugin fs.
  El stub de migración (línea ~454) es solo un doc-comment seguido de `};` — sin
  método. El config ya anticipa el campo `_imageRef` (storage.js:129).
- Permisos `fs:allow-app-read-recursive` + `write-recursive` ya presentes en
  capabilities/default.json.
- FASE 2 (`table-parser-column-detection`) sigue abierta y posee pdfParser.js
  (donde vive el cap MAX_DIM). El bump de calidad toca ese archivo.

## Decisión de diseño (implementada)

Mantener el contrato de runtime `item.img` = dataURL (la UI — catalogView,
app.js, zoomImage — lo usa inline). Mover SOLO la persistencia:

- **saveCatalog**: clonar items; escribir cada dataURL a `images/<id>.<ext>`
  (content-addressed por sha256); en el JSON persistido `item.img=''` +
  `item._imageRef={relativePath,mime}`; GC de huérfanos.
- **loadCatalog**: resolver `_imageRef` → `item.img` (dataURL) leyendo archivo.
- Si el plugin fs no está (tests / no-Tauri), fallback a dataURL inline (comportamiento actual).
- El detector `isMarginalCrop` se implementa y testea como primitiva pura
  (`src/js/imageQuality.js`); su cableado en el loop de import es un follow-up
  para no acumular churn en el archivo de FASE 2.

## Verificación

- Auditoría `scripts/_dbg_real_audit.js` con el nuevo MAX_DIM y el nuevo layout:
  avg lado menor ≥ 300px, `<150px` = 0 en catálogos con nativo suficiente.
- Storage: tamaño total en filesystem por catálogo, medido.
- Tests: gate de crop nuevo (unit), round-trip storage a archivos (unit + e2e).
- `npm test` + `npm run lint` + `npm run build` + gates FASE 2 intactas.

## Riesgos / rollback

- Fase B: rollback = volver a data URLs (storage.js ya tiene el fallback
  `_stripForQuota`). Migración requiere re-import o script de re-encodificación.
- Coordenar con la sesión `table-parser-column-detection`: NO mergear sobre la
  FASE 2 abierta.
- `ponytail:` el gate de crop marginal es heurístico (umbral de % de contenido);
  si el catálogo tiene variantes raras (logos, fondos), calibrar con la muestra
  real antes de fijar el umbral.