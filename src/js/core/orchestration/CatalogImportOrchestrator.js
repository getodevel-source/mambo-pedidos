/**
 * Catalog Import Orchestrator - Orquestador de Importación Masiva
 * 
 * Este es el CEREBRO que coordina todo el proceso de importación:
 * 1. Recibe catálogos crudos de 15+ proveedores
 * 2. Aplica adaptadores específicos para cada uno
 * 3. Normaliza TODO a un estándar único
 * 4. Genera reportes detallados de cada paso
 * 5. Maneja errores sin detener el proceso completo
 * 
 * Filosofía "Zero-Error":
 * - Cada producto tiene score de confianza
 * - Nada se descarta sin auditoría
 * - Todo error es registrad y recuperable
 * - Proceso asíncrono para no bloquear UI
 */

class CatalogImportOrchestrator {
    constructor(options = {}) {
        this.normalizer = new window.NormalizerEngine({
            confidenceThreshold: options.confidenceThreshold ?? 0.7,
            strictMode: options.strictMode ?? false
        });
        
        this.adapterRegistry = window.adapterRegistry;
        this.progressCallback = options.onProgress || (() => {});
        this.errorCallback = options.onError || (() => {});
        
        // Estado del proceso
        this.currentImport = null;
        this.isProcessing = false;
    }

    /**
     * IMPORTACIÓN MASIVA - Método principal
     * @param {Array} catalogs - Array de {providerId, data}
     * @returns {Promise<Object>} Resultados consolidados
     */
    async importMultipleCatalogs(catalogs) {
        if (this.isProcessing) {
            throw new Error('Ya hay una importación en progreso');
        }

        this.isProcessing = true;
        const startTime = performance.now();
        
        this.currentImport = {
            id: `import_${Date.now()}`,
            startedAt: new Date().toISOString(),
            totalCatalogs: catalogs.length,
            completedCatalogs: 0,
            results: [],
            globalStats: {
                totalProducts: 0,
                normalized: 0,
                rejected: 0,
                avgConfidence: 0,
                processingTime: 0
            }
        };

        try {
            // Procesar cada catálogo en secuencia (evitar sobrecarga)
            for (let i = 0; i < catalogs.length; i++) {
                const catalog = catalogs[i];
                
                this.progressCallback({
                    type: 'catalog_start',
                    catalogIndex: i + 1,
                    totalCatalogs: catalogs.length,
                    providerId: catalog.providerId
                });

                try {
                    const result = await this.importSingleCatalog(catalog);
                    this.currentImport.results.push(result);
                    this.currentImport.completedCatalogs++;
                    
                    // Actualizar estadísticas globales
                    this.updateGlobalStats(result);
                    
                    this.progressCallback({
                        type: 'catalog_complete',
                        catalogIndex: i + 1,
                        totalCatalogs: catalogs.length,
                        providerId: catalog.providerId,
                        stats: result.stats
                    });
                } catch (error) {
                    this.errorCallback({
                        type: 'catalog_error',
                        catalogIndex: i + 1,
                        providerId: catalog.providerId,
                        error: error.message
                    });
                    
                    this.currentImport.results.push({
                        providerId: catalog.providerId,
                        success: false,
                        error: error.message,
                        stats: { total: catalog.data?.length || 0, normalized: 0, rejected: catalog.data?.length || 0 }
                    });
                }
            }

            // Finalizar
            this.currentImport.globalStats.processingTime = performance.now() - startTime;
            this.currentImport.completedAt = new Date().toISOString();
            
            this.progressCallback({
                type: 'complete',
                importId: this.currentImport.id,
                stats: this.currentImport.globalStats
            });

            return this.getImportSummary();
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Importa un solo catálogo aplicando todo el pipeline
     */
    async importSingleCatalog({ providerId, data }) {
        const config = window.getProviderConfig(providerId);
        
        if (!config) {
            throw new Error(`Proveedor "${providerId}" no configurado`);
        }

        if (!data || !Array.isArray(data)) {
            throw new Error('Datos inválidos: debe ser un array de productos');
        }

        // Paso 1: Obtener adaptador compuesto
        const adapter = this.adapterRegistry.createComposite(
            providerId,
            config.adapters || []
        );

        // Paso 2: Pre-procesamiento con adaptador
        let processedData = data;
        if (adapter.preProcess) {
            processedData = adapter.preProcess(data);
        }

        // Paso 3: Normalización con motor central
        const normalizationResult = this.normalizer.normalizeCatalog(processedData, {
            ...config,
            adapter
        });

        // Paso 4: Post-procesamiento (enriquecimiento, validación extra)
        const enrichedProducts = normalizationResult.products.map(product => {
            if (adapter.enrich) {
                product = adapter.enrich(product);
            }
            
            // Validación final
            if (adapter.validate) {
                const validation = adapter.validate(product, data.find(p => p[config.columnMapping?.code] === product.code));
                if (!validation.valid) {
                    product._validationErrors = validation.errors;
                }
            }
            
            return product;
        });

        // Paso 5: Consolidar resultados
        return {
            providerId,
            providerName: config.name,
            success: true,
            stats: normalizationResult.stats,
            products: enrichedProducts,
            errors: normalizationResult.errors,
            audit: config.debugMode ? normalizationResult.audit : undefined,
            processingTime: normalizationResult.processingTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Actualiza estadísticas globales acumulativas
     */
    updateGlobalStats(catalogResult) {
        const stats = this.currentImport.globalStats;
        
        stats.totalProducts += catalogResult.stats.total;
        stats.normalized += catalogResult.stats.normalized;
        stats.rejected += catalogResult.stats.rejected;
        
        // Recalcular promedio ponderado de confianza
        const totalNormalized = stats.normalized;
        const prevAvg = stats.avgConfidence * (totalNormalized - catalogResult.stats.normalized);
        const newAvg = catalogResult.stats.avgConfidence * catalogResult.stats.normalized;
        stats.avgConfidence = (prevAvg + newAvg) / totalNormalized;
    }

    /**
     * Obtiene resumen ejecutivo de la importación
     */
    getImportSummary() {
        if (!this.currentImport) {
            return null;
        }

        const summary = {
            importId: this.currentImport.id,
            status: this.isProcessing ? 'processing' : 'completed',
            progress: {
                completed: this.currentImport.completedCatalogs,
                total: this.currentImport.totalCatalogs,
                percentage: Math.round((this.currentImport.completedCatalogs / this.currentImport.totalCatalogs) * 100)
            },
            globalStats: this.currentImport.globalStats,
            providers: this.currentImport.results.map(r => ({
                providerId: r.providerId,
                providerName: r.providerName || r.providerId,
                success: r.success !== false,
                productsNormalized: r.stats?.normalized || 0,
                productsRejected: r.stats?.rejected || 0,
                confidence: r.stats?.avgConfidence || 0,
                errors: r.errors?.length || 0
            })),
            recommendations: this.generateRecommendations()
        };

        return summary;
    }

    /**
     * Genera recomendaciones automáticas basadas en los resultados
     */
    generateRecommendations() {
        const recommendations = [];
        const stats = this.currentImport.globalStats;

        // Tasa de rechazo alta
        const rejectionRate = stats.rejected / stats.totalProducts;
        if (rejectionRate > 0.2) {
            recommendations.push({
                severity: 'high',
                message: `Tasa de rechazo alta (${(rejectionRate * 100).toFixed(1)}%). Revisar configuraciones de proveedores.`,
                action: 'Revisar logs de errores por proveedor'
            });
        }

        // Confianza promedio baja
        if (stats.avgConfidence < 0.8) {
            recommendations.push({
                severity: 'medium',
                message: `Confianza promedio baja (${(stats.avgConfidence * 100).toFixed(1)}%). Algunos datos pueden ser incorrectos.`,
                action: 'Revisar productos con baja confianza en auditoría'
            });
        }

        // Proveedores con muchos errores
        const problematicProviders = this.currentImport.results.filter(
            r => (r.stats?.rejected || 0) / (r.stats?.total || 1) > 0.3
        );
        
        if (problematicProviders.length > 0) {
            recommendations.push({
                severity: 'medium',
                message: `${problematicProviders.length} proveedor(es) con tasa de error >30%`,
                action: problematicProviders.map(p => 
                    `Revisar configuración de "${p.providerName || p.providerId}"`
                ).join('; ')
            });
        }

        return recommendations;
    }

    /**
     * Exporta productos normalizados a formato estándar
     */
    exportToStandardFormat(products, format = 'array') {
        // Eliminar metadata interna y campos temporales
        const cleanProducts = products.map(p => {
            const { _meta, _validationErrors, ...clean } = p;
            return clean;
        });

        switch (format) {
            case 'csv':
                return this.convertToCSV(cleanProducts);
            case 'json':
                return JSON.stringify(cleanProducts, null, 2);
            case 'array':
            default:
                return cleanProducts;
        }
    }

    /**
     * Convierte array de productos a CSV
     */
    convertToCSV(products) {
        if (!products || products.length === 0) return '';

        const headers = ['code', 'name', 'price', 'category', 'brand', 'unit', 'stock'];
        const rows = [headers.join(',')];

        for (const product of products) {
            const row = headers.map(h => {
                const value = product[h] ?? '';
                // Escapar comillas y envolver en comillas si contiene comas
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            });
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    /**
     * Cancela importación en curso
     */
    cancelImport() {
        if (!this.isProcessing) {
            return false;
        }
        
        this.isProcessing = false;
        this.progressCallback({
            type: 'cancelled',
            importId: this.currentImport?.id
        });
        
        return true;
    }
}

// Export para browser y Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatalogImportOrchestrator;
}
if (typeof window !== 'undefined') {
    window.CatalogImportOrchestrator = CatalogImportOrchestrator;
}
