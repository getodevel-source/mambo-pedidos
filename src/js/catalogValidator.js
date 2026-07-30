/**
 * Mambo Pedidos - Motor de Validación Cruzada (CatalogValidator v2)
 * Principio: RECHAZAR por defecto, ACEPTAR con evidencia.
 * Prefiere un producto perdido antes que un dato erróneo.
 *
 * Capas:
 *   1. Validación cruzada por producto (reglas determinísticas)
 *   3. Semáforo de confianza con rechazo activo (GREEN/YELLOW/RED)
 *   4. Validación estadística por catálogo (outliers, ratios)
 */

const CatalogValidator = {

  // ── Configuración de rangos de precio por categoría (USD FOB) ──
  PRICE_RANGES: {
    MOUSE:            { min: 1,    max: 200,  warn: 150 },
    TECLADO:          { min: 3,    max: 300,  warn: 250 },
    HEADSET:          { min: 2,    max: 200,  warn: 150 },
    AURICULAR:        { min: 1,    max: 150,  warn: 100 },
    CONTROLLER:       { min: 3,    max: 150,  warn: 120 },
    MOUSEPAD:         { min: 1,    max: 80,   warn: 60 },
    SWITCH:           { min: 0.05, max: 5,    warn: 3 },
    CAMARA:           { min: 5,    max: 300,  warn: 250 },
    SPEAKER:          { min: 5,    max: 400,  warn: 300 },
    SILLA_GAMING:     { min: 30,   max: 800,  warn: 600 },
    ACCESORIO:        { min: 0.5,  max: 200,  warn: 150 },
    NUMPAD:           { min: 2,    max: 60,   warn: 50 },
    MONITOR:          { min: 30,   max: 1500, warn: 1000 },
    CUIDADO_PERSONAL: { min: 2,    max: 200,  warn: 150 },
  },

  // ── Marcas de categoría única (si el producto no es de esta categoría → REJECT) ──
  BRAND_LOCK: {
    'KZ':           ['AURICULAR'],
    'Haimu':        ['SWITCH'],
    'Polaroid':     ['CAMARA'],
    '8BitDo':       ['CONTROLLER', 'ACCESORIO', 'TECLADO', 'NUMPAD'],
    'Flydigi':      ['CONTROLLER', 'ACCESORIO'],
    'GameSir':       ['CONTROLLER', 'ACCESORIO'],
  },

  // ── Reglas críticas → RED (rechazo activo) ──
  CRITICAL_RULES: new Set(['precio_absurdo', 'marca_incompatible', 'modelo_basura', 'fob_invalido']),

  /**
   * Capa 1 + 3: Valida un producto con reglas cruzadas y devuelve semáforo.
   * @returns {{ status: 'GREEN'|'YELLOW'|'RED', score: number, violations: Array, critical: Array }}
   */
  validateItem(item) {
    if (!item) return { status: 'RED', score: 0, violations: ['Producto nulo'], critical: ['Producto nulo'] };

    const violations = [];
    const critical = [];
    const modelo = (item.modelo || '').trim();
    const variante = (item.variante || '').trim();
    const marca = (item.marca || '').trim();
    const cat = (item.cat || '').trim();
    const fob = parseFloat(item.fob) || 0;

    // ── R1: FOB válido ──
    if (fob <= 0 || isNaN(fob)) {
      critical.push(`FOB inválido ($${fob})`);
    }

    // ── R2: Modelo no es basura ──
    const GARBAGE_RE = /^(producto\s*item|item|\.|\-|n\/a|undefined|null|none|list|earphones?)$/i;
    if (!modelo || modelo.length < 2) {
      critical.push(`Modelo vacío o demasiado corto ("${modelo}")`);
    } else if (GARBAGE_RE.test(modelo)) {
      critical.push(`Modelo es ruido genérico ("${modelo}")`);
    } else if (/^\$?\d+([\.,]\d+)?$/.test(modelo)) {
      critical.push(`Modelo es un precio numérico ("${modelo}")`);
    } else if (/^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo)) {
      critical.push(`Modelo es ruido corporativo ("${modelo}")`);
    }

    // ── R3: Precio sensato por categoría ──
    const range = this.PRICE_RANGES[cat];
    if (range && fob > 0) {
      if (fob < range.min || fob > range.max) {
        critical.push(`Precio $${fob} fuera de rango para ${cat} ($${range.min}-$${range.max})`);
      } else if (fob > range.warn) {
        violations.push(`Precio $${fob} inusualmente alto para ${cat} (>$${range.warn})`);
      }
    }

    // ── R4: Marca-categoría coherente ──
    const lock = this.BRAND_LOCK[marca];
    if (lock && cat !== 'OTRO' && !lock.includes(cat)) {
      critical.push(`${marca} no fabrica ${cat} (solo: ${lock.join(', ')})`);
    }

    // ── R5: Categoría válida ──
    if (!cat || cat === 'OTRO') {
      violations.push(`Categoría no clasificada ("${cat || 'vacía'}")`);
    }

    // ── R6: Marca especificada ──
    if (!marca || marca === 'OTRO') {
      violations.push('Marca no detectada');
    }

    // ── R7: Variante no es un precio ──
    if (variante && /^[\$]?\d+([\.,]\d+)?$/.test(variante)) {
      violations.push(`Variante es un precio ("${variante}")`);
    }

    // ── R8: Modelo ≠ Variante (duplicado probable) ──
    if (modelo && variante && modelo.toLowerCase() === variante.toLowerCase()) {
      violations.push(`Modelo y variante idénticos ("${modelo}")`);
    }

    // ── R9: Imagen presente (informativo, NO afecta semáforo) ──
    // La ausencia de imagen es esperable y no indica dato erróneo.

    // ── Semáforo ──
    let status = 'GREEN';
    if (critical.length > 0) {
      status = 'RED';
    } else if (violations.length >= 2) {
      status = 'YELLOW';
    } else if (violations.length === 1) {
      status = 'YELLOW';
    }

    const totalChecks = 9;
    const failedCount = critical.length + violations.length;
    const score = Math.max(0, Math.round(((totalChecks - failedCount) / totalChecks) * 100));

    return { status, score, violations, critical };
  },

  /**
   * Capa 4: Validación estadística del catálogo completo.
   * Detecta outliers de precio por categoría y anomalias de distribución.
   * @param {Array} products - Array de productos ya validados
   * @returns {Array} products con campo _statFlag agregado si son outliers
   */
  validateCatalogStats(products) {
    if (!Array.isArray(products) || products.length < 5) return products;

    // Agrupar precios por categoría
    const byCat = {};
    for (const p of products) {
      const cat = p.cat || 'OTRO';
      if (!byCat[cat]) byCat[cat] = [];
      const fob = parseFloat(p.fob) || 0;
      if (fob > 0) byCat[cat].push(fob);
    }

    // Calcular IQR por categoría para detectar outliers
    const outlierBounds = {};
    for (const [cat, prices] of Object.entries(byCat)) {
      if (prices.length < 4) continue;
      prices.sort((a, b) => a - b);
      const q1 = prices[Math.floor(prices.length * 0.25)];
      const q3 = prices[Math.floor(prices.length * 0.75)];
      const iqr = q3 - q1;
      outlierBounds[cat] = {
        low: q1 - 1.5 * iqr,
        high: q3 + 1.5 * iqr,
        median: prices[Math.floor(prices.length * 0.5)]
      };
    }

    // Flaggear outliers
    for (const p of products) {
      const cat = p.cat || 'OTRO';
      const bounds = outlierBounds[cat];
      const fob = parseFloat(p.fob) || 0;
      if (bounds && fob > 0) {
        if (fob < bounds.low || fob > bounds.high) {
          p._statFlag = `Outlier de precio: $${fob} (mediana ${cat}: $${bounds.median.toFixed(2)})`;
          if (!p.warnings) p.warnings = [];
          p.warnings.push(p._statFlag);
          if (p.status !== 'RED') p.status = 'YELLOW';
        }
      }
    }

    // Detectar anomalía de distribución: si >90% es una categoría, verificar minorías
    const catCounts = {};
    for (const p of products) {
      const cat = p.cat || 'OTRO';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const total = products.length;
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count / total < 0.02 && count <= 3 && cat !== 'OTRO') {
        // Categoría con muy pocos productos → verificar doble
        for (const p of products) {
          if (p.cat === cat && p.status === 'GREEN') {
            p.status = 'YELLOW';
            p._statFlag = `Categoría minoritaria (${count}/${total}) — verificar`;
            if (!p.warnings) p.warnings = [];
            p.warnings.push(p._statFlag);
          }
        }
      }
    }

    return products;
  },

  /**
   * Pipeline completo: valida cada producto + estadística del catálogo.
   * @param {Array} products
   * @returns {{ accepted: Array, rejected: Array, review: Array, stats: Object }}
   */
  runFullValidation(products) {
    // Capa 1+3: Validación por producto
    for (const p of products) {
      const result = this.validateItem(p);
      p._validation = result;
      p.status = result.status;
      p.warnings = [...result.critical, ...result.violations];
      p.confidence = result.score;
    }

    // Capa 4: Estadística del catálogo
    this.validateCatalogStats(products);

    // Separar por semáforo
    const accepted = products.filter(p => p.status === 'GREEN');
    const review = products.filter(p => p.status === 'YELLOW');
    const rejected = products.filter(p => p.status === 'RED');

    return {
      accepted,
      review,
      rejected,
      stats: {
        total: products.length,
        green: accepted.length,
        yellow: review.length,
        red: rejected.length,
        greenPct: Math.round((accepted.length / Math.max(1, products.length)) * 100)
      }
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatalogValidator;
}
if (typeof window !== 'undefined') {
  window.CatalogValidator = CatalogValidator;
}
