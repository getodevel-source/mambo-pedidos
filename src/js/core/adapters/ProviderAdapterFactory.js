/**
 * Provider Adapter Factory - Fábrica de adaptadores para proveedores
 * 
 * Problema que resuelve:
 * Cada proveedor tiene peculiaridades únicas que el normalizador genérico no puede manejar.
 * Este sistema permite crear adaptadores específicos SIN tocar el core del sistema.
 * 
 * Arquitectura:
 * 1. BaseAdapter: Clase base con métodos hook personalizables
 * 2. Registro central: Todos los adaptadores se registran aquí
 * 3. Auto-detección: El sistema elige el adaptador correcto según el proveedor
 */

class BaseProviderAdapter {
    constructor(providerName) {
        this.providerName = providerName;
        this.version = '1.0';
    }

    /**
     * Hook: Pre-procesamiento antes de la normalización
     * Útil para limpiar datos corruptos, transformar estructuras raras, etc.
     */
    preProcess(rawData) {
        return rawData;
    }

    /**
     * Hook: Transformación de columna específica
     * Se llama durante la detección de columnas para casos especiales
     */
    transformColumn(columnName, value, row) {
        return value;
    }

    /**
     * Hook: Validación personalizada post-normalización
     * Permite reglas de negocio específicas del proveedor
     */
    validate(normalizedProduct, rawProduct) {
        return { valid: true, errors: [] };
    }

    /**
     * Hook: Enriquecimiento de datos
     * Agrega información extra basada en patrones del proveedor
     */
    enrich(normalizedProduct) {
        return normalizedProduct;
    }

    /**
     * Reglas específicas para parsing de precios (sobreescribir si necesario)
     */
    parsePrice(rawValue) {
        return null; // null = usar parser genérico
    }

    /**
     * Reglas específicas para códigos (sobreescribir si necesario)
     */
    parseCode(rawValue) {
        return null; // null = usar parser genérico
    }
}

// ============================================================================
// ADAPTADORES ESPECÍFICOS POR PROVEEDOR
// ============================================================================

/**
 * Ejemplo: Adaptador para proveedor con precios en formato "$ 1.234,56"
 */
class PriceWithSpacesAdapter extends BaseProviderAdapter {
    constructor() {
        super('price_with_spaces');
    }

    parsePrice(rawValue) {
        if (typeof rawValue !== 'string') return null;
        
        // Eliminar espacios entre $ y números: "$ 1.234,56" -> "$1.234,56"
        const cleaned = rawValue.replace(/\$\s+/g, '$');
        
        // Luego aplicar lógica estándar
        const numeric = cleaned
            .replace(/[^0-9,.]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        
        const parsed = parseFloat(numeric);
        return isNaN(parsed) ? null : parsed;
    }
}

/**
 * Ejemplo: Adaptador para proveedor que usa "FAMILIA" en vez de "CATEGORIA"
 */
class FamilyCategoryAdapter extends BaseProviderAdapter {
    constructor() {
        super('family_category');
    }

    preProcess(rawData) {
        return rawData.map(row => {
            const newRow = { ...row };
            
            // Mapear "FAMILIA" a "categoria"
            if (newRow.FAMILIA && !newRow.categoria) {
                newRow.categoria = newRow.FAMILIA;
            }
            
            // Mapear "SUBFAMILIA" como subcategoría
            if (newRow.SUBFAMILIA) {
                newRow.subcategory = newRow.SUBFAMILIA;
            }
            
            return newRow;
        });
    }
}

/**
 * Ejemplo: Adaptador para proveedor con códigos alfanuméricos complejos
 */
class AlphanumericCodeAdapter extends BaseProviderAdapter {
    constructor() {
        super('alphanumeric_code');
    }

    parseCode(rawValue) {
        if (!rawValue) return null;
        
        const code = String(rawValue).trim().toUpperCase();
        
        // Validar que tenga al menos 4 caracteres
        if (code.length < 4) {
            return null;
        }
        
        // Eliminar caracteres especiales pero mantener letras y números
        const cleaned = code.replace(/[^A-Z0-9\-]/g, '');
        
        return cleaned || null;
    }

    validate(normalizedProduct, rawProduct) {
        const errors = [];
        
        // Regla específica: códigos no pueden empezar con 0
        if (normalizedProduct.code && normalizedProduct.code.startsWith('0')) {
            errors.push('Código inválido: no puede comenzar con 0');
        }
        
        // Regla específica: verificar longitud máxima
        if (normalizedProduct.code && normalizedProduct.code.length > 20) {
            errors.push('Código demasiado largo (>20 caracteres)');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * Ejemplo: Adaptador para proveedor que incluye IVA en precio
 */
class PriceWithVATAdapter extends BaseProviderAdapter {
    constructor() {
        super('price_with_vat');
        this.vatRate = 0.21; // 21% IVA
    }

    enrich(normalizedProduct) {
        if (normalizedProduct.price) {
            // Separar precio neto e IVA
            const priceWithVAT = normalizedProduct.price;
            const netPrice = priceWithVAT / (1 + this.vatRate);
            const vatAmount = priceWithVAT - netPrice;
            
            normalizedProduct.priceNet = parseFloat(netPrice.toFixed(2));
            normalizedProduct.priceVAT = parseFloat(vatAmount.toFixed(2));
            normalizedProduct.hasVATIncluded = true;
        }
        
        return normalizedProduct;
    }
}

/**
 * Ejemplo: Adaptador para proveedor con unidades compuestas
 * Ej: "6 x 500ml" -> cantidad: 6, unidad: mililitro, tamaño: 500
 */
class CompositeUnitAdapter extends BaseProviderAdapter {
    constructor() {
        super('composite_unit');
    }

    transformColumn(columnName, value, row) {
        if (columnName !== 'unit' && columnName !== 'presentacion') {
            return value;
        }
        
        if (!value || typeof value !== 'string') {
            return value;
        }
        
        // Detectar patrón "X x Y" (ej: "6 x 500ml")
        const match = value.match(/(\d+)\s*[xX]\s*(\d+)\s*([a-zA-Z]+)/);
        
        if (match) {
            const [, quantity, size, unit] = match;
            
            // Guardar metadata adicional
            row._unitMetadata = {
                packQuantity: parseInt(quantity),
                unitSize: parseInt(size),
                baseUnit: unit.toLowerCase()
            };
            
            // Retornar unidad base estandarizada
            return unit.toLowerCase();
        }
        
        return value;
    }

    enrich(normalizedProduct) {
        if (normalizedProduct._unitMetadata) {
            normalizedProduct.packQuantity = normalizedProduct._unitMetadata.packQuantity;
            normalizedProduct.unitSize = normalizedProduct._unitMetadata.unitSize;
            normalizedProduct.baseUnit = normalizedProduct._unitMetadata.baseUnit;
            delete normalizedProduct._unitMetadata;
        }
        
        return normalizedProduct;
    }
}

// ============================================================================
// REGISTRO CENTRAL DE ADAPTADORES
// ============================================================================

class AdapterRegistry {
    constructor() {
        this.adapters = new Map();
        this.registerDefaults();
    }

    registerDefaults() {
        // Registrar todos los adaptadores built-in
        this.register(new PriceWithSpacesAdapter());
        this.register(new FamilyCategoryAdapter());
        this.register(new AlphanumericCodeAdapter());
        this.register(new PriceWithVATAdapter());
        this.register(new CompositeUnitAdapter());
    }

    register(adapter) {
        if (!(adapter instanceof BaseProviderAdapter)) {
            throw new Error('Adapter must extend BaseProviderAdapter');
        }
        this.adapters.set(adapter.providerName, adapter);
    }

    get(providerName) {
        return this.adapters.get(providerName) || null;
    }

    has(providerName) {
        return this.adapters.has(providerName);
    }

    getAll() {
        return Array.from(this.adapters.values());
    }

    /**
     * Crea un adaptador compuesto para un proveedor específico
     * Permite combinar múltiples adaptadores si es necesario
     */
    createComposite(providerName, adapterNames = []) {
        const baseAdapter = this.get(providerName);
        const extraAdapters = adapterNames.map(name => this.get(name)).filter(Boolean);
        
        if (!baseAdapter && extraAdapters.length === 0) {
            return new BaseProviderAdapter(providerName);
        }
        
        // Crear adaptador compuesto que ejecuta todos en cascada
        return {
            providerName,
            preProcess: (data) => {
                let result = data;
                if (baseAdapter?.preProcess) result = baseAdapter.preProcess(result);
                for (const adapter of extraAdapters) {
                    if (adapter.preProcess) result = adapter.preProcess(result);
                }
                return result;
            },
            transformColumn: (col, val, row) => {
                let result = val;
                if (baseAdapter?.transformColumn) result = baseAdapter.transformColumn(col, result, row);
                for (const adapter of extraAdapters) {
                    if (adapter.transformColumn) result = adapter.transformColumn(col, result, row);
                }
                return result;
            },
            validate: (product, raw) => {
                const results = [];
                if (baseAdapter?.validate) results.push(baseAdapter.validate(product, raw));
                for (const adapter of extraAdapters) {
                    if (adapter.validate) results.push(adapter.validate(product, raw));
                }
                
                const allValid = results.every(r => r.valid);
                const allErrors = results.flatMap(r => r.errors || []);
                
                return { valid: allValid, errors: allErrors };
            },
            enrich: (product) => {
                let result = product;
                if (baseAdapter?.enrich) result = baseAdapter.enrich(result);
                for (const adapter of extraAdapters) {
                    if (adapter.enrich) result = adapter.enrich(result);
                }
                return result;
            },
            parsePrice: (val) => {
                if (baseAdapter?.parsePrice) {
                    const result = baseAdapter.parsePrice(val);
                    if (result !== null) return result;
                }
                for (const adapter of extraAdapters) {
                    if (adapter.parsePrice) {
                        const result = adapter.parsePrice(val);
                        if (result !== null) return result;
                    }
                }
                return null;
            },
            parseCode: (val) => {
                if (baseAdapter?.parseCode) {
                    const result = baseAdapter.parseCode(val);
                    if (result !== null) return result;
                }
                for (const adapter of extraAdapters) {
                    if (adapter.parseCode) {
                        const result = adapter.parseCode(val);
                        if (result !== null) return result;
                    }
                }
                return null;
            }
        };
    }
}

// Singleton global
const adapterRegistry = new AdapterRegistry();

// Export para browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BaseProviderAdapter,
        AdapterRegistry,
        adapterRegistry,
        // Export individual adapters para extensión
        PriceWithSpacesAdapter,
        FamilyCategoryAdapter,
        AlphanumericCodeAdapter,
        PriceWithVATAdapter,
        CompositeUnitAdapter
    };
}
if (typeof window !== 'undefined') {
    window.BaseProviderAdapter = BaseProviderAdapter;
    window.AdapterRegistry = AdapterRegistry;
    window.adapterRegistry = adapterRegistry;
}
