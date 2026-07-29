# 🚀 Sistema de Importación de Catálogos - Arquitectura Zero-Error

## Visión General

Este sistema resuelve el problema de importar catálogos de **15+ proveedores con formatos completamente distintos** manteniendo calidad de datos del 95%+.

### Problemas que Resuelve

| Problema Antiguo | Solución Nueva |
|-----------------|----------------|
| Código monolítico imposible de mantener | Módulos independientes y testeables |
| Cada proveedor requería código nuevo | Sistema de adaptadores plug-and-play |
| Errores silenciosos y datos corruptos | Auditoría completa + scores de confianza |
| Procesamiento bloqueante | Asíncrono con progreso en tiempo real |
| Sin trazabilidad | Logs detallados de cada transformación |

---

## 📁 Estructura de Archivos

```
src/
├── js/
│   └── core/
│       ├── ErrorHandler.js           # Manejo centralizado de errores
│       ├── SharedUtils.js            # Utilidades compartidas
│       ├── ProductSanitizer.js       # Sanitización de productos
│       ├── ModernPdfParser.js        # Parser PDF modular
│       ├── normalization/
│       │   └── NormalizerEngine.js   # ⭐ Motor de normalización universal
│       ├── adapters/
│       │   └── ProviderAdapterFactory.js  # ⭐ Fábrica de adaptadores
│       └── orchestration/
│           └── CatalogImportOrchestrator.js  # ⭐ Orquestador principal
└── config/
    └── providers/
        └── providerRegistry.js       # ⭐ Configuración de proveedores
```

---

## 🔧 Cómo Funciona el Pipeline

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CATALOGO CRUDO (formato del proveedor)                      │
│     [{ "CODIGO": "123", "DESC": "Producto", ... }]              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ADAPTADOR ESPECÍFICO                                        │
│     - Pre-procesamiento (limpieza, transformaciones)            │
│     - Reglas custom para ese proveedor                          │
│     - Parsing especializado (precios, códigos, unidades)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. NORMALIZER ENGINE                                           │
│     - Detección automática de columnas                          │
│     - Validación en cascada                                     │
│     - Cálculo de confianza por campo                            │
│     - Estandarización de unidades                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. PRODUCTO NORMALIZADO                                        │
│     {                                                           │
│       code: "123",                                              │
│       name: "Producto Limpio",                                  │
│       price: 1250.50,                                           │
│       category: "Categoría Estándar",                           │
│       _meta: { confidence: 0.95, provider: "X", ... }           │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Uso Práctico

### Ejemplo 1: Importar Múltiples Catálogos

```javascript
// Inicializar orquestador
const orchestrator = new CatalogImportOrchestrator({
    confidenceThreshold: 0.7,
    onProgress: (event) => {
        console.log(`Progreso: ${event.type}`, event);
    },
    onError: (error) => {
        console.error('Error:', error);
    }
});

// Preparar catálogos de diferentes proveedores
const catalogs = [
    { 
        providerId: 'distribuidora_mayorista', 
        data: rawProductsFromProvider1 
    },
    { 
        providerId: 'importadora_alimentos', 
        data: rawProductsFromProvider2 
    },
    { 
        providerId: 'farmaceutica', 
        data: rawProductsFromProvider3 
    }
    // ... hasta 15+ proveedores
];

// Ejecutar importación masiva
const summary = await orchestrator.importMultipleCatalogs(catalogs);

console.log('Resumen:', summary);
/*
{
  importId: "import_1234567890",
  status: "completed",
  progress: { completed: 3, total: 3, percentage: 100 },
  globalStats: {
    totalProducts: 15000,
    normalized: 14250,
    rejected: 750,
    avgConfidence: 0.92,
    processingTime: 4523
  },
  providers: [...],
  recommendations: [...]
}
*/
```

### Ejemplo 2: Agregar Nuevo Proveedor

```javascript
// Registrar configuración para un proveedor nuevo
registerProvider('nuevo_proveedor', {
    name: 'Nuevo Proveedor S.A.',
    enabled: true,
    
    // Mapeo de columnas (opcional, auto-detecta si no se especifica)
    columnMapping: {
        code: 'SKU_CODE',
        name: 'PRODUCT_NAME',
        price: 'FINAL_PRICE',
        category: 'CATEGORY_NAME',
        brand: 'BRAND'
    },
    
    // Adaptadores a aplicar
    adapters: ['price_with_vat', 'composite_unit'],
    
    // Reglas personalizadas
    rules: {
        price: (value, row) => {
            if (value < 50) {
                return { value, confidence: 0.5 }; // Sospechoso
            }
            return { value, confidence: 1.0 };
        }
    },
    
    // Configuración de importación
    importSettings: {
        batchSize: 500,
        timeout: 30000
    }
});
```

### Ejemplo 3: Crear Adaptador Custom

```javascript
// Crear adaptador para formato especial de precios
class SpecialPriceAdapter extends BaseProviderAdapter {
    constructor() {
        super('special_price_format');
    }

    parsePrice(rawValue) {
        // Formato especial: "USD 1,234.56 (IVA inc.)"
        const match = String(rawValue).match(/USD\s*([0-9,.]+)/);
        if (!match) return null;
        
        const cleaned = match[1].replace(/,/g, '');
        const parsed = parseFloat(cleaned);
        
        return isNaN(parsed) ? null : parsed;
    }
    
    validate(product, rawProduct) {
        const errors = [];
        
        // Regla: verificar que el precio tenga sentido
        if (product.price > 1000000) {
            errors.push('Precio excesivamente alto, posible error');
        }
        
        return { valid: errors.length === 0, errors };
    }
}

// Registrar el adaptador
adapterRegistry.register(new SpecialPriceAdapter());
```

---

## 📊 Sistema de Confianza

Cada producto recibe un **score de confianza** (0.0 - 1.0) basado en:

| Campo | Peso | Criterios |
|-------|------|-----------|
| `code` | 30% | Formato válido, único, no nulo |
| `name` | 25% | Longitud adecuada, sin caracteres raros |
| `price` | 25% | Valor positivo, formato correcto |
| `category` | 10% | Categoría reconocida |
| `brand` | 5% | Marca válida |
| `unit` | 5% | Unidad estandarizable |

### Interpretación de Scores

- **≥ 0.9**: Datos excelentes, usar directamente
- **0.7 - 0.9**: Datos buenos, revisar casos borderline
- **< 0.7**: Datos sospechosos, requiere revisión manual

---

## 🔍 Auditoría y Debugging

### Habilitar Modo Debug

```javascript
const config = getProviderConfig('mi_proveedor');
config.debugMode = true; // Incluye audit trail completo

const result = await orchestrator.importSingleCatalog({
    providerId: 'mi_proveedor',
    data: products
});

console.log('Audit trail:', result.audit);
/*
[
  {
    original: { ...datos crudos... },
    transformations: [
      { step: 'column_detection', result: {...}, confidence: 1.0 },
      { step: 'price_parse', result: 1250.50, confidence: 0.95 }
    ],
    confidenceScores: { code: 1.0, name: 0.9, price: 0.95, ... },
    finalConfidence: 0.96
  }
]
*/
```

### Reporte de Auditoría

```javascript
const engine = new NormalizerEngine();
const report = engine.generateAuditReport(auditLogs);

console.log(report);
/*
{
  timestamp: "2025-01-15T10:30:00Z",
  totalProducts: 1000,
  lowConfidenceProducts: [...],
  commonIssues: { price: 45, code: 12 },
  recommendations: [
    "Revisar configuración de detección de códigos",
    "Verificar formato de precios"
  ]
}
*/
```

---

## ⚡ Optimización para Grandes Volúmenes

### Configuración Recomendada para 15+ Proveedores

```javascript
const orchestrator = new CatalogImportOrchestrator({
    confidenceThreshold: 0.7,
    strictMode: false, // Permite procesamiento parcial
    
    onProgress: (event) => {
        // Actualizar UI en tiempo real
        updateProgressBar(event);
        
        if (event.type === 'catalog_complete') {
            // Mostrar resultados parciales inmediatamente
            displayPartialResults(event.stats);
        }
    }
});

// Procesar en batches si son muchos proveedores
const batchSize = 5;
for (let i = 0; i < allCatalogs.length; i += batchSize) {
    const batch = allCatalogs.slice(i, i + batchSize);
    await orchestrator.importMultipleCatalogs(batch);
    
    // Pequeña pausa para no saturar
    await new Promise(resolve => setTimeout(resolve, 100));
}
```

---

## 🛠️ Troubleshooting Común

### Problema: Tasa de rechazo alta (>20%)

**Causas posibles:**
1. Columnas mal detectadas → Revisar `columnMapping`
2. Formato de precios incompatible → Crear adaptador custom
3. Códigos con formato especial → Implementar `parseCode` custom

**Solución:**
```javascript
// Ver logs de errores
summary.providers.forEach(p => {
    if (p.productsRejected / p.totalProducts > 0.2) {
        console.log(`Proveedor problemático: ${p.providerName}`);
        console.log('Errores:', p.errors);
    }
});
```

### Problema: Confianza promedio baja (<0.8)

**Causas posibles:**
1. Datos incompletos en origen
2. Unidades no estandarizables
3. Categorías desconocidas

**Solución:**
```javascript
// Ajustar pesos de confianza
const engine = new NormalizerEngine({
    confidenceThreshold: 0.6 // Bajar umbral temporalmente
});

// O mejorar mapeo de unidades
engine.unitMappings['nueva_unidad'] = 'unidad_estandar';
```

---

## 📈 Métricas de Calidad Esperadas

| Métrica | Objetivo | Mínimo Aceptable |
|---------|----------|------------------|
| Tasa de éxito | ≥ 95% | ≥ 85% |
| Confianza promedio | ≥ 0.90 | ≥ 0.75 |
| Tiempo de procesamiento | < 5s/1000 productos | < 10s/1000 |
| Errores no detectados | 0 | < 1% |

---

## 🚀 Próximos Pasos Sugeridos

1. **Migrar proveedores existentes**: Empezar con 2-3 proveedores críticos
2. **Crear adaptadores custom**: Para formatos muy particulares
3. **Configurar monitoreo**: Dashboard de calidad de importación
4. **Automatizar validación**: Tests automáticos por proveedor
5. **Documentar casos edge**: Wiki interna con peculiaridades por proveedor

---

## 📞 Soporte

Para agregar nuevos proveedores o resolver problemas específicos:

1. Revisar logs de auditoría primero
2. Identificar patrón del problema (precios, códigos, unidades)
3. Crear/registrar adaptador específico
4. Testear con muestra pequeña antes de producción
