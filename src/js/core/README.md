# Mambo Pedidos - Core Modules (v6)

## Arquitectura Refactorizada

Esta carpeta contiene los módulos core refactorizados de Mambo Pedidos, diseñados para eliminar código duplicado, mejorar el manejo de errores y proporcionar una base sólida y mantenible.

## Módulos Disponibles

### 1. ErrorHandler.js
**Propósito:** Manejo centralizado de errores en toda la aplicación.

**Funciones principales:**
- `capture(error, context)` - Registra errores con contexto completo
- `safeExecute(fn, fallback, context)` - Ejecuta funciones con try/catch automático
- `classifyError(error)` - Clasifica tipos de errores
- `getRecentErrors(count)` - Obtiene historial de errores

**Uso:**
```javascript
await ErrorHandler.safeExecute(
  async () => await PdfParser.processFile(file),
  null,
  { module: 'Catalog', action: 'import' }
);
```

### 2. SharedUtils.js
**Propósito:** Funciones utilitarias compartidas entre todos los módulos.

**Funciones principales:**
- `extractUsdPrice(line)` - Extrae precios USD de texto
- `detectBrand(text, customBrands)` - Detecta marca desde texto
- `detectCategory(text, brand)` - Detecta categoría desde texto
- `generateSku(brand, category, index)` - Genera SKUs únicos
- `isHeaderNoise(text)` - Verifica ruido de encabezado
- `isPageNoise(text)` - Verifica ruido de página
- `evaluateItemConfidence(item)` - Evalúa confianza de producto

**Ventaja:** Elimina duplicación de lógica entre pdfParser.js y aiCatalogEngine.js

### 3. ProductSanitizer.js
**Propósito:** Sanitización especializada de productos extraídos.

**Funciones principales:**
- `sanitizeProductNames(rawModelo, rawVariante, brand, existingProducts)` - Limpia nombres
- `cleanProductTitle(rawText, brand)` - Elimina repeticiones y ruido
- `evaluateProduct(item)` - Valida y evalúa confianza
- `verifyPriceGrounding(fob, rawText)` - Verifica grounding de precio
- `processBatch(products, brand, customBrands)` - Procesa lote completo

**Características:**
- Herencia de familia para modelos cortos
- Detección de colores como variante
- Eliminación de ruido corporativo
- Validación de precios FOB

### 4. ModernPdfParser.js
**Propósito:** Parser de PDFs moderno basado en los nuevos componentes core.

**Dependencias:**
- SharedUtils (para detección de marca/categoría)
- ProductSanitizer (para sanitización final)
- ErrorHandler (para manejo de errores)

**Flujo de procesamiento:**
1. Carga y validación del PDF
2. Extracción de imágenes por página
3. Extracción de productos usando grid espacial 2D
4. Detección de marca desde contenido/filename
5. Sanitización y evaluación de confianza
6. Generación de SKUs únicos

### 5. PdfParserClean.js (en progreso)
**Propósito:** Versión limpia y progresiva del parser original.

**Estado:** Parcialmente implementado - sirviendo como puente durante la transición.

## Migración

### De pdfParser.js a ModernPdfParser.js

**Antes:**
```javascript
const result = await PdfParser.processPdfFile(file, catalogLength, customBrands, onProgress);
```

**Después:**
```javascript
const result = await ModernPdfParser.processPdfFile(file, catalogLength, customBrands, onProgress);
```

**Beneficios:**
- Mejor manejo de errores
- Código más legible y mantenible
- Menos código duplicado
- Validaciones más estrictas

## Estructura de Datos

### Producto Estándar
```javascript
{
  sku: "RED-MOU-0001",        // Generado automáticamente
  marca: "Redragon",           // Normalizada
  modelo: "AJ139 Pro",         // Sanitizado
  variante: "White",           // Extraída
  cat: "MOUSE",                // Clasificada
  fob: 25.99,                  // Verificado
  img: "data:image/png...",    // Asignada
  pageNum: 1,                  // Origen
  confidence: 85,              // 0-100
  status: "VALID",             // VALID/WARNING/ERROR
  warnings: []                 // Array de advertencias
}
```

## Testing

Cada módulo puede ser testeado independientemente:

```javascript
// Test SharedUtils
SharedUtils.extractUsdPrice("Price: $25.99"); // → 25.99
SharedUtils.detectBrand("Redragon keyboard");  // → "Redragon"

// Test ProductSanitizer
ProductSanitizer.sanitizeProductNames("Redragon AJ139", "White", "Redragon");
// → { modelo: "AJ139", variante: "White" }

// Test ErrorHandler
ErrorHandler.capture(new Error("Test"), { context: "testing" });
```

## Contribución

1. Mantener funciones puras cuando sea posible
2. Documentar cada función con JSDoc
3. Incluir manejo de errores consistente
4. Evitar efectos secundarios globales
5. Exportar para browser y Node.js

