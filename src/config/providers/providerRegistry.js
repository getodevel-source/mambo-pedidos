/**
 * Configuración de Proveedores - Registro centralizado
 * 
 * Instrucciones para agregar un nuevo proveedor:
 * 1. Copiar una plantilla existente
 * 2. Ajustar columnMapping si los nombres de columnas son diferentes
 * 3. Agregar adapters si necesita procesamiento especial
 * 4. Definir rules para validaciones custom
 * 
 * Esta configuración SEPARA la lógica del negocio de los datos crudos.
 */

const providerConfigs = {
    // ========================================================================
    // PROVEEDOR EJEMPLO 1: Distribuidora Mayorista
    // ========================================================================
    'distribuidora_mayorista': {
        name: 'Distribuidora Mayorista S.A.',
        enabled: true,
        
        // Mapeo explícito de columnas (opcional, el sistema auto-detecta)
        columnMapping: {
            code: 'CODIGO',
            name: 'DESCRIPCION',
            price: 'PRECIO_VENTA',
            category: 'RUBRO',
            brand: 'MARCA',
            unit: 'UNIDAD_MEDIDA',
            stock: 'STOCK_DISPONIBLE'
        },
        
        // Adaptadores específicos a aplicar en orden
        adapters: ['price_with_spaces', 'family_category'],
        
        // Reglas de validación personalizadas
        rules: {
            price: (value, row) => {
                // Regla: precio mínimo $100
                if (value < 100) {
                    return { value, confidence: 0.5 }; // Baja confianza
                }
                return { value, confidence: 1.0 };
            },
            code: (value, row) => {
                // Regla: códigos deben ser numéricos de 6 dígitos
                if (/^\d{6}$/.test(value)) {
                    return { value, confidence: 1.0 };
                }
                return { value, confidence: 0.7 };
            }
        },
        
        // Metadata operativa
        importSettings: {
            batchSize: 500,      // Procesar de a 500 productos
            retryOnFailure: true,
            maxRetries: 3,
            timeout: 30000       // 30 segundos timeout
        }
    },

    // ========================================================================
    // PROVEEDOR EJEMPLO 2: Importadora de Alimentos
    // ========================================================================
    'importadora_alimentos': {
        name: 'Importadora de Alimentos',
        enabled: true,
        
        columnMapping: {
            code: 'SKU',
            name: 'NOMBRE_PRODUCTO',
            price: 'PRECIO_CON_IVA',
            category: 'CATEGORIA',
            subcategory: 'SUBCATEGORIA',
            brand: 'LABORATORIO',
            unit: 'PRESENTACION'
        },
        
        adapters: ['price_with_vat', 'composite_unit'],
        
        rules: {
            price: (value, row) => {
                // El precio ya incluye IVA, el adapter lo separa automáticamente
                return { value, confidence: 0.95 };
            }
        },
        
        importSettings: {
            batchSize: 300,
            retryOnFailure: true,
            maxRetries: 2,
            timeout: 45000
        }
    },

    // ========================================================================
    // PROVEEDOR EJEMPLO 3: Farmacéutica
    // ========================================================================
    'farmaceutica': {
        name: 'Laboratorio Farmacéutico',
        enabled: true,
        
        columnMapping: {
            code: 'CUIT_PRODUCTO',
            name: 'DENOMINACION',
            price: 'PRECIO_PUBLICO',
            category: 'TERRAPEUTICA',
            brand: 'LABORATORIO',
            unit: 'FORMA_FARMACEUTICA',
            stock: 'DISPONIBILIDAD'
        },
        
        adapters: ['alphanumeric_code'],
        
        rules: {
            code: (value, row) => {
                // CUIT formato: XX-XXXXXXXX-X o XXXXXXXXXXXX
                const cleaned = value.replace(/[^0-9]/g, '');
                if (cleaned.length === 11) {
                    return { value: cleaned, confidence: 1.0 };
                }
                return { value, confidence: 0.6 };
            },
            name: (value, row) => {
                // Nombres de medicamentos suelen tener ® o ™
                const sanitized = value.replace(/[®™]/g, '').trim();
                return { value: sanitized, confidence: 0.95 };
            }
        },
        
        importSettings: {
            batchSize: 200,
            retryOnFailure: false, // Datos críticos, mejor fallar rápido
            timeout: 60000
        }
    },

    // ========================================================================
    // PROVEEDOR EJEMPLO 4: Bebidas y Licores
    // ========================================================================
    'bebidas_licores': {
        name: 'Distribuidora de Bebidas',
        enabled: true,
        
        columnMapping: {
            code: 'ITEM_CODE',
            name: 'PRODUCT_NAME',
            price: 'UNIT_PRICE',
            category: 'CATEGORY',
            brand: 'BRAND',
            unit: 'PACK_SIZE',
            stock: 'QTY_AVAILABLE'
        },
        
        adapters: ['composite_unit'],
        
        rules: {
            // Sin reglas especiales, usa validación estándar
        },
        
        importSettings: {
            batchSize: 400,
            retryOnFailure: true,
            maxRetries: 3,
            timeout: 30000
        }
    },

    // ========================================================================
    // PROVEEDOR EJEMPLO 5: Limpieza e Higiene
    // ========================================================================
    'limpieza_higiene': {
        name: 'Mayorista de Limpieza',
        enabled: true,
        
        columnMapping: {
            code: 'ARTICULO',
            name: 'DETALLE',
            price: 'IMPORTE',
            category: 'FAMILIA',
            brand: 'PROVEEDOR',
            unit: 'ENVASE'
        },
        
        adapters: ['family_category', 'price_with_spaces'],
        
        rules: {
            category: (value, row) => {
                // Estandarizar categorías de limpieza
                const categories = {
                    'DETERGENTES': 'Limpieza Hogar',
                    'DESINFECTANTES': 'Limpieza Hogar',
                    'PAPELERIA': 'Papel e Higiene',
                    'HIGIENE PERSONAL': 'Higiene Personal'
                };
                const normalized = categories[value] || value;
                return { value: normalized, confidence: 0.9 };
            }
        },
        
        importSettings: {
            batchSize: 600,
            retryOnFailure: true,
            maxRetries: 2,
            timeout: 25000
        }
    }
};

// ============================================================================
// FUNCIONES DE UTILIDAD PARA GESTIÓN DE CONFIGURACIONES
// ============================================================================

/**
 * Obtiene configuración de un proveedor específico
 */
function getProviderConfig(providerId) {
    return providerConfigs[providerId] || null;
}

/**
 * Lista todos los proveedores habilitados
 */
function getEnabledProviders() {
    return Object.entries(providerConfigs)
        .filter(([_, config]) => config.enabled)
        .map(([id, config]) => ({ id, ...config }));
}

/**
 * Valida que una configuración de proveedor sea correcta
 */
function validateProviderConfig(config) {
    const errors = [];
    
    if (!config.name) {
        errors.push('Proveedor debe tener nombre');
    }
    
    if (!config.columnMapping || typeof config.columnMapping !== 'object') {
        errors.push('columnMapping debe ser un objeto');
    } else {
        // Verificar que al menos tenga código y nombre
        if (!config.columnMapping.code && !config.columnMapping.name) {
            errors.push('Debe mapear al menos código o nombre');
        }
    }
    
    if (config.adapters && !Array.isArray(config.adapters)) {
        errors.push('adapters debe ser un array');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Agrega o actualiza un proveedor en tiempo de ejecución
 */
function registerProvider(providerId, config) {
    const validation = validateProviderConfig(config);
    
    if (!validation.valid) {
        throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
    }
    
    providerConfigs[providerId] = config;
    return true;
}

// Export para browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        providerConfigs,
        getProviderConfig,
        getEnabledProviders,
        validateProviderConfig,
        registerProvider
    };
}
if (typeof window !== 'undefined') {
    window.providerConfigs = providerConfigs;
    window.getProviderConfig = getProviderConfig;
    window.getEnabledProviders = getEnabledProviders;
    window.validateProviderConfig = validateProviderConfig;
    window.registerProvider = registerProvider;
}
