/**
 * Mambo Pedidos - Validador Regla por Regla de Calidad de Catálogo (CatalogValidator)
 * Audita producto por producto verificando 6 reglas de calidad estrictas.
 */

const CatalogValidator = {
  VALID_CATEGORIES: [
    'TECLADO',
    'MOUSE',
    'HEADSET',
    'AURICULAR',
    'CONTROLLER',
    'MOUSEPAD',
    'SWITCH',
    'CAMARA',
    'CUIDADO_PERSONAL',
    'NUMPAD',
    'ACCESORIO'
  ],

  /**
   * Audita un solo producto contra las 6 reglas estrictas
   * @param {Object} item 
   * @returns {Object} { isValid: boolean, score: number, violations: Array<string>, details: Object }
   */
  validateItem(item) {
    if (!item) return { isValid: false, score: 0, violations: ['Producto nulo o indefinido'], details: {} };

    const violations = [];
    const modelo = (item.modelo || '').trim();
    const variante = (item.variante || '').trim();
    const marca = (item.marca || '').trim();
    const cat = (item.cat || '').trim();
    const fob = parseFloat(item.fob) || 0;
    const img = item.img || '';

    // Regla 1: Modelo Válido y Limpio (sin precios, ruidos corporativos ni caracteres raros)
    const MONEDA_RUIMO = /\b(CNY|RMB|USD|EUR)\s*\$?[\d\.,]+\b/gi;
    const DECIMAL_PRECIO = /\b\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\$?\d+[\.,]\d+\b/g;
    const CORPORATE_NOISE = /\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi;
    const HEADER_NOISE = /^(CNY|RMB|USD|EUR|PRICE|COLOR|MODEL|PICTURE|IMAGE|SPEC|REMARK|MOQ|FOB|\.|\-|\s)+$/i;
    const FALLBACK_NOISE = /^(Producto\s+Item|\.|\-)+$/i;

    let rule1Passed = true;
    if (!modelo) {
      rule1Passed = false;
      violations.push('Regla 1 (Modelo): El modelo está vacío');
    } else if (FALLBACK_NOISE.test(modelo) || modelo.toLowerCase().startsWith('producto item')) {
      rule1Passed = false;
      violations.push(`Regla 1 (Modelo): Nombre genérico prohibido "${modelo}"`);
    } else if (modelo.startsWith('.')) {
      rule1Passed = false;
      violations.push(`Regla 1 (Modelo): Inicia con punto no deseado "${modelo}"`);
    } else if (/^\$?\d+([\.,]\d+)?$/.test(modelo) || /^\s*\.\d+[\s\.\d]*$/.test(modelo)) {
      rule1Passed = false;
      violations.push(`Regla 1 (Modelo): Es un precio numérico en lugar de un nombre "${modelo}"`);
    } else if (HEADER_NOISE.test(modelo)) {
      rule1Passed = false;
      violations.push(`Regla 1 (Modelo): Es una palabra de encabezado "${modelo}"`);
    } else if (CORPORATE_NOISE.test(modelo)) {
      rule1Passed = false;
      violations.push(`Regla 1 (Modelo): Contiene razón social corporativa "${modelo}"`);
    }

    // Regla 2: Variante Coherente (sin números de precio ni monedas)
    let rule2Passed = true;
    if (variante) {
      if (/^\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(variante) || /^\$?\d+([\.,]\d+)?$/.test(variante) || /^[\d\.,\s]+$/.test(variante)) {
        rule2Passed = false;
        violations.push(`Regla 2 (Variante): El color/variante contiene un precio numérico "${variante}"`);
      } else if (HEADER_NOISE.test(variante)) {
        rule2Passed = false;
        violations.push(`Regla 2 (Variante): Es una palabra de encabezado "${variante}"`);
      }
    }

    // Regla 3: Categoría Valida (reconocida en la industria)
    let rule3Passed = true;
    if (!cat) {
      rule3Passed = false;
      violations.push('Regla 3 (Categoría): Categoría no definida');
    } else if (cat === 'OTRO' && (marca !== 'OTRO' || modelo.length > 5)) {
      // Advertencia de categoría no clasificada para productos conocidos
      rule3Passed = false;
      violations.push(`Regla 3 (Categoría): Categoría en "OTRO" para producto específico "${modelo}"`);
    }

    // Regla 4: Marca Especificada
    let rule4Passed = true;
    if (!marca || marca === 'OTRO') {
      rule4Passed = false;
      violations.push('Regla 4 (Marca): Marca no especificada o en "OTRO"');
    }

    // Regla 5: FOB Positivo
    let rule5Passed = true;
    if (fob <= 0 || isNaN(fob)) {
      rule5Passed = false;
      violations.push(`Regla 5 (FOB): Precio FOB inválido ($${fob} USD)`);
    }

    // Regla 6: Foto de Producto Válida (si existe)
    let rule6Passed = true;
    if (img) {
      if (typeof img !== 'string' || img.length < 10) {
        rule6Passed = false;
        violations.push('Regla 6 (Imagen): URL o Data URI de imagen corrupto o demasiado corto');
      } else if (img.includes('undefined') || img.includes('null')) {
        rule6Passed = false;
        violations.push('Regla 6 (Imagen): Referencia a imagen con valor nulo/indefinido');
      }
    }

    const totalRules = 6;
    const passedCount = [rule1Passed, rule2Passed, rule3Passed, rule4Passed, rule5Passed, rule6Passed].filter(Boolean).length;
    const score = Math.round((passedCount / totalRules) * 100);
    const isValid = violations.length === 0;

    return {
      sku: item.sku || '',
      modelo,
      marca,
      cat,
      fob,
      isValid,
      score,
      violations,
      details: {
        rule1Passed,
        rule2Passed,
        rule3Passed,
        rule4Passed,
        rule5Passed,
        rule6Passed
      }
    };
  },

  /**
   * Audita la totalidad del catálogo ítem por ítem
   * @param {Array} catalog 
   * @returns {Object} Reporte consolidado de auditoría
   */
  validateCatalog(catalog = []) {
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return {
        totalItems: 0,
        validItems: 0,
        invalidItems: 0,
        qualityScore: 100,
        results: [],
        summaryByRule: {
          rule1Failed: 0,
          rule2Failed: 0,
          rule3Failed: 0,
          rule4Failed: 0,
          rule5Failed: 0,
          rule6Failed: 0
        }
      };
    }

    const results = catalog.map((item, index) => ({
      index,
      ...this.validateItem(item)
    }));

    const validItems = results.filter(r => r.isValid).length;
    const invalidItems = results.length - validItems;
    const avgScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);

    const summaryByRule = {
      rule1Failed: results.filter(r => !r.details.rule1Passed).length,
      rule2Failed: results.filter(r => !r.details.rule2Passed).length,
      rule3Failed: results.filter(r => !r.details.rule3Passed).length,
      rule4Failed: results.filter(r => !r.details.rule4Passed).length,
      rule5Failed: results.filter(r => !r.details.rule5Passed).length,
      rule6Failed: results.filter(r => !r.details.rule6Passed).length
    };

    return {
      totalItems: results.length,
      validItems,
      invalidItems,
      qualityScore: avgScore,
      results,
      summaryByRule
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatalogValidator;
}
if (typeof window !== 'undefined') {
  window.CatalogValidator = CatalogValidator;
}
