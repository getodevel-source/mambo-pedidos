/**
 * Mambo Pedidos - Motor de Validación Cruzada (CatalogValidator v2)
 * Principio: RECHAZAR por defecto, ACEPTAR con evidencia.
 * Prefiere un producto perdido antes que un dato erróneo.
 *
 * Capas:
 *   1. Validación cruzada por producto (reglas determinísticas)
 *   3. Semáforo de confianza con rechazo activo (GREEN/YELLOW/RED)
 *   4. Validación estadística por catálogo (outliers, ratios)
 *
 * Contract (R1-R10): evaluateItem() produces exactly one Evaluation per code.
 * Each Evaluation = {code,severity,status,evidence,reason,importability}.
 * Aggregate = {violationsByCode:{R1..R10}, canonicalGroupCount:10, stats}.
 *
 * Approval gates (unresolved):
 *   AP-1: Missing/invalid images are YELLOW, never GREEN, not hard-blocking.
 *   AP-2: Sanitized fixtures checked in; full-corpus uses env-gated manifest.
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
    if (!item) return { status: 'RED', score: 0, violations: [], critical: ['Producto nulo'], warnings: ['Producto nulo'] };

    const violations = [];
    const critical = [];
    const sku = (item.sku || '').toString().trim();
    const modelo = (item.modelo || '').trim();
    const variante = (item.variante || '').trim();
    const marca = (item.marca || '').trim();
    const cat = (item.cat || '').trim().toUpperCase();
    const fob = Number.parseFloat(item.fob);

    if (!sku || sku === '-') critical.push('SKU vacío o inválido');

    // ── R1: FOB válido ──
    if (!Number.isFinite(fob) || fob <= 0) {
      critical.push(`FOB inválido ($${Number.isFinite(fob) ? fob : 0})`);
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
      critical.push(`Categoría no clasificada ("${cat || 'vacía'}")`);
    }

    // ── R6: Marca especificada ──
    if (!marca || marca === 'OTRO') {
      critical.push('Marca no detectada');
    }

    // ── R7: Variante no es un precio ──
    if (variante && /^[\$]?\d+([\.,]\d+)?$/.test(variante)) {
      violations.push(`Variante es un precio ("${variante}")`);
    }

    // ── R8: Modelo ≠ Variante (duplicado probable) ──
    if (modelo && variante && modelo.toLowerCase() === variante.toLowerCase()) {
      violations.push(`Modelo y variante idénticos ("${modelo}")`);
    }

    // ── R9: Imagen válida. Falta de imagen requiere revisión y bloquea verde. ──
    const hasImage = typeof item.img === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(item.img.trim());
    if (!hasImage) violations.push('Imagen faltante o inválida: requiere revisión');

    // ── R10: Evidencia literal del FOB. ──
    const grounded = item.grounded !== undefined ? item.grounded : item.isGroundedFob;
    if (grounded === false) {
      violations.push(item.groundingReason || 'FOB sin evidencia literal suficiente');
    } else if (grounded !== true) {
      critical.push('Evidencia de grounding insuficiente');
    }

    // ── Semáforo ──
    let status = 'GREEN';
    if (critical.length > 0) {
      status = 'RED';
    } else if (violations.length >= 2) {
      status = 'YELLOW';
    } else if (violations.length === 1) {
      status = 'YELLOW';
    }

    const totalChecks = 11;
    const failedCount = critical.length + violations.length;
    const score = Math.max(0, Math.round(((totalChecks - failedCount) / totalChecks) * 100));

    return {
      status,
      score,
      violations,
      critical,
      grounded: grounded === true,
      hasImage,
      warnings: [...critical, ...violations]
    };
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
      const sourceWarnings = Array.isArray(p.sourceWarnings) ? p.sourceWarnings : [];
      const sourceConfidence = Number.isFinite(Number(p.confidence)) ? Number(p.confidence) : null;
      const sourceStatus = this.normalizeStatus(p.sourceStatus || p.status);
      p._validation = result;
      p.sourceStatus = sourceStatus;
      // Preserve upstream evidence: a parser/AI RED or YELLOW result cannot be
      // promoted back to GREEN by the deterministic checks alone.
      p.status = this.maxStatus(result.status, sourceStatus);
      p.warnings = [...new Set([...sourceWarnings, ...result.critical, ...result.violations])];
      p.sourceConfidence = sourceConfidence;
      p.confidence = result.score;
      p.grounded = p.grounded !== undefined ? p.grounded : p.isGroundedFob;
      p.qualityReason = p.warnings[0] || 'Sin observaciones';
      p.importable = p.status !== 'RED';
    }

    // Capa 4: Estadística del catálogo
    this.validateCatalogStats(products);
    for (const p of products) {
      p.importable = p.status !== 'RED';
      p.qualityReason = (p.warnings && p.warnings[0]) || 'Sin observaciones';
    }

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
  },

  normalizeStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'RED' || value === 'ERROR' || value === 'INVALID') return 'RED';
    if (value === 'YELLOW' || value === 'WARNING') return 'YELLOW';
    if (value === 'GREEN' || value === 'VALID') return 'GREEN';
    return '';
  },

  maxStatus(left, right) {
    const rank = { '': 0, GREEN: 1, YELLOW: 2, RED: 3 };
    return rank[right] > rank[left] ? right : left;
  },

  /**
   * Emite exactamente una Evaluation por cada código R1-R10.
   * Cada Evaluation contiene: code, severity, status, evidence, reason, importability.
   * @param {Object} item - Producto con sku, marca, modelo, variante, cat, fob, img, grounded, etc.
   * @returns {Array<Evaluation>} Array de 10 evaluaciones en orden R1-R10
   */
  evaluateItem(item) {
    if (!item) {
      return this._defaultEvaluations('R1', 'Producto nulo');
    }

    const evals = [];
    const sku = (item.sku || '').toString().trim();
    const modelo = (item.modelo || '').trim();
    const variante = (item.variante || '').trim();
    const marca = (item.marca || '').trim();
    const cat = (item.cat || '').trim().toUpperCase();
    const fob = Number.parseFloat(item.fob);
    const sourceStatus = this.normalizeStatus(item.sourceStatus || '');
    const hasImage = typeof item.img === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(item.img.trim());
    const grounded = item.grounded !== undefined ? item.grounded : item.isGroundedFob;

    // ── R1: FOB válido ──
    const fobFinite = Number.isFinite(fob) && fob > 0;
    evals.push(this._makeEval('R1',
      fobFinite ? 'PASS' : 'CRITICAL',
      fobFinite ? 'GREEN' : 'RED',
      fobFinite ? 'IMPORTABLE' : 'REJECTED',
      { observed: Number.isFinite(fob) ? fob : 0, expected: '>0 finito', source: (item.fobRaw || `sku:${sku}`) },
      fobFinite ? 'FOB válido' : `FOB inválido ($${Number.isFinite(fob) ? fob : 0})`
    ));

    // ── R2: Modelo no es basura ──
    const GARBAGE_RE = /^(producto\s*item|item|\.|\-|n\/a|undefined|null|none|list|earphones?)$/i;
    const modelOk = modelo && modelo.length >= 2
      && !GARBAGE_RE.test(modelo)
      && !/^\$?\d+([\.,]\d+)?$/.test(modelo)
      && !/^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo);
    let r2Reason = 'Modelo válido';
    if (!modelo || modelo.length < 2) r2Reason = `Modelo vacío o demasiado corto ("${modelo}")`;
    else if (GARBAGE_RE.test(modelo)) r2Reason = `Modelo es ruido genérico ("${modelo}")`;
    else if (/^\$?\d+([\.,]\d+)?$/.test(modelo)) r2Reason = `Modelo es un precio numérico ("${modelo}")`;
    else if (/^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo)) r2Reason = `Modelo es ruido corporativo ("${modelo}")`;
    evals.push(this._makeEval('R2',
      modelOk ? 'PASS' : 'CRITICAL',
      modelOk ? 'GREEN' : 'RED',
      modelOk ? 'IMPORTABLE' : 'REJECTED',
      { observed: modelo, expected: 'texto significativo', source: `modelo:${sku}` },
      r2Reason
    ));

    // ── R3: Precio sensato por categoría ──
    const range = this.PRICE_RANGES[cat];
    let r3Severity = 'PASS', r3Status = 'GREEN', r3Import = 'IMPORTABLE';
    let r3Reason = 'Precio dentro de rango';
    if (range && fob > 0) {
      if (fob < range.min || fob > range.max) {
        r3Severity = 'CRITICAL'; r3Status = 'RED'; r3Import = 'REJECTED';
        r3Reason = `Precio $${fob} fuera de rango para ${cat} ($${range.min}-$${range.max})`;
      } else if (fob > range.warn) {
        r3Severity = 'WARNING'; r3Status = 'YELLOW'; r3Import = 'IMPORTABLE';
        r3Reason = `Precio $${fob} inusualmente alto para ${cat} (>$${range.warn})`;
      }
    }
    evals.push(this._makeEval('R3', r3Severity, r3Status, r3Import,
      { observed: Number.isFinite(fob) ? fob : 0, expected: range ? `$${range.min}-$${range.max}` : 'sin rango', source: cat },
      r3Reason
    ));

    // ── R4: Marca-categoría coherente ──
    const lock = this.BRAND_LOCK[marca];
    const brandCatOk = !lock || cat === 'OTRO' || lock.includes(cat);
    evals.push(this._makeEval('R4',
      brandCatOk ? 'PASS' : 'CRITICAL',
      brandCatOk ? 'GREEN' : 'RED',
      brandCatOk ? 'IMPORTABLE' : 'REJECTED',
      { observed: `${marca}→${cat}`, expected: lock ? lock.join(',') : 'compatible', source: 'BRAND_LOCK' },
      brandCatOk ? 'Marca-categoría coherente' : `${marca} no fabrica ${cat} (solo: ${lock.join(', ')})`
    ));

    // ── R5: Categoría válida ──
    const catOk = cat && cat !== 'OTRO';
    evals.push(this._makeEval('R5',
      catOk ? 'PASS' : 'CRITICAL',
      catOk ? 'GREEN' : 'RED',
      catOk ? 'IMPORTABLE' : 'REJECTED',
      { observed: cat || 'vacía', expected: 'categoría conocida', source: 'vocabulario' },
      catOk ? 'Categoría válida' : `Categoría no clasificada ("${cat || 'vacía'}")`
    ));

    // ── R6: Marca especificada ──
    const brandOk = marca && marca !== 'OTRO';
    evals.push(this._makeEval('R6',
      brandOk ? 'PASS' : 'CRITICAL',
      brandOk ? 'GREEN' : 'RED',
      brandOk ? 'IMPORTABLE' : 'REJECTED',
      { observed: marca || 'vacía', expected: 'marca conocida', source: 'vocabulario' },
      brandOk ? 'Marca especificada' : 'Marca no detectada'
    ));

    // ── R7: Variante no es un precio ──
    const variantIsPrice = variante && /^[\$]?\d+([\.,]\d+)?$/.test(variante);
    evals.push(this._makeEval('R7',
      variantIsPrice ? 'WARNING' : 'PASS',
      variantIsPrice ? 'YELLOW' : 'GREEN',
      'IMPORTABLE',
      { observed: variante, expected: 'texto descriptivo', source: 'variante' },
      variantIsPrice ? `Variante es un precio ("${variante}")` : 'Variante descriptiva'
    ));

    // ── R8: Modelo ≠ Variante ──
    const modelEqVariant = modelo && variante && modelo.toLowerCase() === variante.toLowerCase();
    evals.push(this._makeEval('R8',
      modelEqVariant ? 'WARNING' : 'PASS',
      modelEqVariant ? 'YELLOW' : 'GREEN',
      'IMPORTABLE',
      { observed: `modelo:"${modelo}" variante:"${variante}"`, expected: 'distintos', source: 'modelo+variante' },
      modelEqVariant ? `Modelo y variante idénticos ("${modelo}")` : 'Modelo y variante distintos'
    ));

    // ── R9: Imagen válida ──
    const imgEv = item.imageEvidence || null;
    let r9Observed, r9Source, r9Reason;
    if (imgEv) {
      r9Observed = `pdf:${imgEv.pdfIdentity}|page:${imgEv.page}|decode:${imgEv.canvasDecode}|assoc:${imgEv.association}`;
      r9Source = `pdf-evidence:${imgEv.productRowId}`;
      r9Reason = hasImage
        ? `Imagen verificada en PDF (página ${imgEv.page}, decode ${imgEv.canvasDecode})`
        : `Imagen ausente en PDF (página ${imgEv.page}, decode ${imgEv.canvasDecode}): requiere revisión`;
    } else {
      r9Observed = hasImage ? 'data:image/...' : 'faltante/inválida';
      r9Source = 'img';
      r9Reason = hasImage ? 'Imagen válida' : 'Imagen faltante o inválida: requiere revisión';
    }
    evals.push(this._makeEval('R9',
      hasImage ? 'PASS' : 'WARNING',
      hasImage ? 'GREEN' : 'YELLOW',
      'IMPORTABLE',
      Object.assign({ observed: r9Observed, expected: 'data:image/png|jpeg|webp|gif', source: r9Source },
        imgEv ? { canvasDecode: imgEv.canvasDecode, pdfIdentity: imgEv.pdfIdentity, page: imgEv.page, association: imgEv.association } : {}),
      r9Reason
    ));

    // ── R10: Evidencia de grounding ──
    let r10Sev, r10Sta, r10Imp, r10Reason;
    if (grounded === true) {
      r10Sev = 'PASS'; r10Sta = 'GREEN'; r10Imp = 'IMPORTABLE';
      r10Reason = 'FOB verificado literalmente';
    } else if (grounded === false) {
      r10Sev = 'WARNING'; r10Sta = 'YELLOW'; r10Imp = 'IMPORTABLE';
      r10Reason = item.groundingReason || 'FOB sin evidencia literal suficiente';
    } else {
      r10Sev = 'CRITICAL'; r10Sta = 'RED'; r10Imp = 'REJECTED';
      r10Reason = 'Evidencia de grounding insuficiente';
    }
    evals.push(this._makeEval('R10', r10Sev, r10Sta, r10Imp,
      { observed: grounded === true ? 'verificado' : (grounded === false ? 'no verificado' : 'ausente'),
        expected: 'presencia literal en fuente', source: item.groundingReason || 'grounding' },
      r10Reason
    ));

    // Apply upstream status: a RED/YELLOW from source cannot be promoted to GREEN
    if (sourceStatus === 'RED' || sourceStatus === 'YELLOW') {
      for (const e of evals) {
        if (e.status === 'GREEN') {
          e.status = sourceStatus;
          if (sourceStatus === 'RED') {
            e.severity = 'WARNING';
            e.importability = 'REJECTED';
          }
        }
      }
    }

    return evals;
  },

  /**
   * Helper: crea una Evaluation con los campos requeridos.
   */
  _makeEval(code, severity, status, importability, evidence, reason) {
    return { code, severity, status, importability, evidence, reason };
  },

  /**
   * Devuelve 10 evaluaciones por defecto (todas RED/CRITICAL) para un producto fallido.
   */
  _defaultEvaluations(firstCode, firstReason) {
    const evals = [];
    const codes = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'];
    for (const code of codes) {
      evals.push({
        code, severity: 'CRITICAL', status: 'RED', importability: 'REJECTED',
        evidence: { observed: 'nulo', expected: 'válido', source: 'producto_nulo' },
        reason: code === firstCode ? firstReason : 'Producto nulo — validación imposible'
      });
    }
    return evals;
  },

  /**
   * Agrega violaciones desde evaluaciones R1-R10.
   * @param {Array<Evaluation>} evaluations - Array de evaluaciones (p.ej. de una fila)
   * @returns {{ violationsByCode: Object, canonicalGroupCount: number, stats: Object }}
   */
  aggregateViolations(evaluations) {
    const violationsByCode = {};
    const codes = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'];
    for (const code of codes) violationsByCode[code] = 0;

    for (const e of evaluations) {
      if (e.status !== 'GREEN' && violationsByCode.hasOwnProperty(e.code)) {
        violationsByCode[e.code]++;
      }
    }

    const stats = {
      total: evaluations.length,
      green: evaluations.filter(e => e.status === 'GREEN').length,
      yellow: evaluations.filter(e => e.status === 'YELLOW').length,
      red: evaluations.filter(e => e.status === 'RED').length
    };

    return { violationsByCode, canonicalGroupCount: 10, stats };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatalogValidator;
}
if (typeof window !== 'undefined') {
  window.CatalogValidator = CatalogValidator;
}
