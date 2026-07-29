/**
 * NormalizerEngine - Motor de normalización universal de catálogos
 * 
 * Problema que resuelve:
 * Cada proveedor tiene formatos distintos (columnas diferentes, nombres variados,
 * estructuras inconsistentes). Este motor unifica TODO a un estándar único.
 * 
 * Estrategia "Zero-Error":
 * 1. Detección automática de columnas por patrones (no por nombre exacto)
 * 2. Validación en cascada con fallbacks inteligentes
 * 3. Score de confianza por producto (sabés qué datos son seguros)
 * 4. Auditoría completa de transformaciones
 */

class NormalizerEngine {
    constructor(options = {}) {
        this.strictMode = options.strictMode ?? false;
        this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
        this.auditLog = [];
        
        // Patrones de detección inteligente de columnas
        this.columnPatterns = {
            code: [/^cod(igo)?\.?$/i, /^art(iculo)?\.?$/i, /^ref(erencia)?\.?$/i, /^sku$/i, /^id$/i],
            name: [/^nombre$/i, /^descripcion$/i, /^producto$/i, /^item$/i, /^detalle$/i],
            price: [/^precio$/i, /^valor$/i, /^costo$/i, /^importe$/i],
            category: [/^categoria$/i, /^rubro$/i, /^familia$/i, /^grupo$/i, /^departamento$/i],
            brand: [/^marca$/i, /^laboratorio$/i, /^proveedor$/i, /^fabricante$/i],
            unit: [/^unidad$/i, /^presentacion$/i, /^formato$/i, /^envase$/i],
            stock: [/^stock$/i, /^cantidad$/i, /^disponibilidad$/i, /^existencia$/i]
        };
        
        // Mapeo de unidades estandarizadas
        this.unitMappings = {
            'unid': 'unidad', 'un': 'unidad', 'u': 'unidad', 'pieza': 'unidad',
            'kg': 'kilogramo', 'kilo': 'kilogramo',
            'gr': 'gramo', 'g': 'gramo',
            'lt': 'litro', 'l': 'litro',
            'ml': 'mililitro',
            'pack': 'paquete', 'pqt': 'paquete', 'caja': 'paquete',
            'docena': 'docena', 'doc': 'docena'
        };
    }

    /**
     * Procesa un catálogo completo independientemente del proveedor
     * @param {Array} rawData - Array de productos crudos
     * @param {Object} providerConfig - Configuración específica del proveedor
     * @returns {Object} Resultado con productos normalizados + auditoría
     */
    normalizeCatalog(rawData, providerConfig = {}) {
        const startTime = performance.now();
        const result = {
            products: [],
            stats: {
                total: rawData.length,
                normalized: 0,
                partial: 0,
                rejected: 0,
                avgConfidence: 0
            },
            audit: [],
            errors: [],
            processingTime: 0
        };

        let confidenceSum = 0;

        for (let i = 0; i < rawData.length; i++) {
            try {
                const rawProduct = rawData[i];
                const normalized = this.normalizeProduct(rawProduct, providerConfig);
                
                if (normalized.confidence >= this.confidenceThreshold) {
                    result.products.push(normalized.product);
                    result.stats.normalized++;
                    confidenceSum += normalized.confidence;
                    
                    if (normalized.confidence < 0.9) {
                        result.stats.partial++;
                    }
                } else {
                    result.stats.rejected++;
                    result.errors.push({
                        index: i,
                        reason: `Baja confianza (${normalized.confidence.toFixed(2)})`,
                        data: rawProduct
                    });
                }
                
                result.audit.push(normalized.audit);
            } catch (error) {
                result.stats.rejected++;
                result.errors.push({
                    index: i,
                    reason: error.message,
                    data: rawData[i]
                });
            }
        }

        result.stats.avgConfidence = result.stats.normalized > 0 
            ? confidenceSum / result.stats.normalized 
            : 0;
        result.processingTime = performance.now() - startTime;

        return result;
    }

    /**
     * Normaliza un solo producto con validación en cascada
     */
    normalizeProduct(rawProduct, providerConfig) {
        const audit = {
            original: { ...rawProduct },
            transformations: [],
            confidenceScores: {},
            finalConfidence: 0
        };

        // Paso 1: Detectar columnas automáticamente
        const detectedColumns = this.detectColumns(rawProduct, providerConfig);
        audit.transformations.push({
            step: 'column_detection',
            result: detectedColumns,
            confidence: 1.0
        });

        // Paso 2: Extraer y validar cada campo crítico
        const product = {};
        const scores = {};

        // Código (CRÍTICO - sin código no hay producto)
        const codeResult = this.extractField(rawProduct, detectedColumns.code, 'code', providerConfig);
        product.code = codeResult.value;
        scores.code = codeResult.confidence;
        if (!product.code) {
            throw new Error('Producto sin código válido');
        }

        // Nombre (CRÍTICO)
        const nameResult = this.extractField(rawProduct, detectedColumns.name, 'name', providerConfig);
        product.name = nameResult.value;
        scores.name = nameResult.confidence;
        if (!product.name || product.name.length < 3) {
            throw new Error('Nombre inválido o demasiado corto');
        }

        // Precio (CRÍTICO)
        const priceResult = this.extractField(rawProduct, detectedColumns.price, 'price', providerConfig, 'currency');
        product.price = priceResult.value;
        scores.price = priceResult.confidence;
        if (!product.price || product.price <= 0) {
            throw new Error('Precio inválido');
        }

        // Categoría (importante pero no crítica)
        const categoryResult = this.extractField(rawProduct, detectedColumns.category, 'category', providerConfig);
        product.category = categoryResult.value || 'Sin categoría';
        scores.category = categoryResult.confidence;

        // Marca
        const brandResult = this.extractField(rawProduct, detectedColumns.brand, 'brand', providerConfig);
        product.brand = brandResult.value || 'Sin marca';
        scores.brand = brandResult.confidence;

        // Unidad
        const unitResult = this.extractField(rawProduct, detectedColumns.unit, 'unit', providerConfig, 'unit');
        product.unit = this.standardizeUnit(unitResult.value);
        scores.unit = unitResult.confidence;

        // Stock (opcional)
        const stockResult = this.extractField(rawProduct, detectedColumns.stock, 'stock', providerConfig, 'number');
        product.stock = stockResult.value;
        scores.stock = stockResult.confidence;

        // Calcular confianza final (ponderada por criticidad)
        const finalConfidence = this.calculateFinalConfidence(scores);
        audit.finalConfidence = finalConfidence;
        audit.confidenceScores = scores;

        // Metadata de trazabilidad
        product._meta = {
            normalizedAt: new Date().toISOString(),
            provider: providerConfig.name || 'unknown',
            confidence: finalConfidence,
            hasPartialData: finalConfidence < 0.9
        };

        return {
            product,
            confidence: finalConfidence,
            audit
        };
    }

    /**
     * Detecta automáticamente qué columna es qué usando patrones regex
     */
    detectColumns(rawProduct, providerConfig) {
        const mapping = {};
        const keys = Object.keys(rawProduct);

        for (const [fieldType, patterns] of Object.entries(this.columnPatterns)) {
            for (const key of keys) {
                const cleanKey = key.trim().toLowerCase();
                for (const pattern of patterns) {
                    if (pattern.test(cleanKey)) {
                        mapping[fieldType] = key;
                        break;
                    }
                }
                if (mapping[fieldType]) break;
            }
        }

        // Si el proveedor tiene mapeo explícito, lo sobreescribe
        if (providerConfig.columnMapping) {
            Object.assign(mapping, providerConfig.columnMapping);
        }

        return mapping;
    }

    /**
     * Extrae un campo específico aplicando transformaciones según el tipo
     */
    extractField(rawProduct, columnKey, fieldType, providerConfig, transformType = 'string') {
        if (!columnKey) {
            return { value: null, confidence: 0 };
        }

        let rawValue = rawProduct[columnKey];
        let confidence = 0.8; // Base confidence si encontramos la columna

        if (rawValue === undefined || rawValue === null || rawValue === '') {
            return { value: null, confidence: 0 };
        }

        // Aplicar transformaciones específicas
        switch (transformType) {
            case 'currency':
                rawValue = this.parseCurrency(rawValue);
                confidence = rawValue > 0 ? 0.95 : 0.3;
                break;
            
            case 'number':
                rawValue = this.parseNumber(rawValue);
                confidence = rawValue !== null ? 0.9 : 0.3;
                break;
            
            case 'unit':
                rawValue = this.standardizeUnit(rawValue);
                confidence = rawValue ? 0.9 : 0.5;
                break;
            
            default: // string
                rawValue = this.sanitizeString(rawValue);
                confidence = rawValue.length > 0 ? 0.9 : 0.2;
        }

        // Aplicar reglas específicas del proveedor si existen
        if (providerConfig.rules && providerConfig.rules[fieldType]) {
            const ruleResult = providerConfig.rules[fieldType](rawValue, rawProduct);
            if (ruleResult.value !== undefined) {
                rawValue = ruleResult.value;
            }
            if (ruleResult.confidence !== undefined) {
                confidence = ruleResult.confidence;
            }
        }

        return { value: rawValue, confidence };
    }

    /**
     * Parsea valores de moneda (maneja $, comas, puntos, símbolos)
     */
    parseCurrency(value) {
        if (typeof value === 'number') return value;
        
        const cleaned = String(value)
            .replace(/[^0-9,.]/g, '')
            .replace(/\./g, '')  // Eliminar puntos de mil
            .replace(',', '.');   // Convertir coma decimal a punto
        
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Parsea números genéricos
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        
        const cleaned = String(value).replace(/[^0-9]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Sanitiza strings (trim, uppercase/lowercase según corresponda)
     */
    sanitizeString(value) {
        return String(value).trim().replace(/\s+/g, ' ');
    }

    /**
     * Estandariza unidades a formato único
     */
    standardizeUnit(value) {
        if (!value) return null;
        
        const normalized = String(value).toLowerCase().trim();
        return this.unitMappings[normalized] || normalized;
    }

    /**
     * Calcula confianza final ponderando campos críticos más alto
     */
    calculateFinalConfidence(scores) {
        const weights = {
            code: 0.30,    // 30% - CRÍTICO
            name: 0.25,    // 25% - CRÍTICO
            price: 0.25,   // 25% - CRÍTICO
            category: 0.10, // 10%
            brand: 0.05,    // 5%
            unit: 0.05      // 5%
        };

        let total = 0;
        for (const [field, score] of Object.entries(scores)) {
            total += (score || 0) * (weights[field] || 0.05);
        }

        return Math.min(1.0, Math.max(0, total));
    }

    /**
     * Genera reporte de auditoría para debugging
     */
    generateAuditReport(auditLogs) {
        const report = {
            timestamp: new Date().toISOString(),
            totalProducts: auditLogs.length,
            lowConfidenceProducts: auditLogs.filter(a => a.finalConfidence < 0.8),
            commonIssues: {},
            recommendations: []
        };

        // Analizar problemas comunes
        for (const audit of auditLogs) {
            for (const [field, score] of Object.entries(audit.confidenceScores)) {
                if (score < 0.7) {
                    report.commonIssues[field] = (report.commonIssues[field] || 0) + 1;
                }
            }
        }

        // Generar recomendaciones automáticas
        if (report.commonIssues.code) {
            report.recommendations.push('Revisar configuración de detección de códigos para este proveedor');
        }
        if (report.commonIssues.price) {
            report.recommendations.push('Verificar formato de precios - posiblemente requiere regla personalizada');
        }

        return report;
    }
}

// Export para browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NormalizerEngine;
}
if (typeof window !== 'undefined') {
    window.NormalizerEngine = NormalizerEngine;
}
