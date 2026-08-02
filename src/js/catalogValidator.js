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
    MOUSE:            { min: 1,    max: 300,  warn: 200 },
    TECLADO:          { min: 1,    max: 400,  warn: 300 },
    HEADSET:          { min: 2,    max: 500,  warn: 400 },
    AURICULAR:        { min: 1,    max: 200,  warn: 150 },
    CONTROLLER:       { min: 3,    max: 350,  warn: 250 },
    MOUSEPAD:         { min: 1,    max: 250,  warn: 200 },
    SWITCH:           { min: 0.05, max: 15,   warn: 10 },
    CAMARA:           { min: 5,    max: 800,  warn: 500 },
    SPEAKER:          { min: 5,    max: 500,  warn: 400 },
    SILLA_GAMING:     { min: 30,   max: 1000, warn: 800 },
    ACCESORIO:        { min: 0.1,  max: 600,  warn: 450 },
    NUMPAD:           { min: 2,    max: 80,   warn: 60 },
    MONITOR:          { min: 30,   max: 2000, warn: 1500 },
    CUIDADO_PERSONAL: { min: 2,    max: 300,  warn: 200 },
  },

  // ── Marcas de categoría única (si el producto no es de esta categoría → REJECT) ──
  BRAND_LOCK: {
    'KZ':           ['AURICULAR', 'ACCESORIO'],
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
      }
      // "Unusually high" is advisory only — does not block GREEN
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

    // ── R9: Imagen válida. Advisory only — no bloquea GREEN si el resto está perfecto. ──
    const hasImage = typeof item.img === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(item.img.trim());
    // R9 is advisory: missing image does NOT block GREEN when all other fields are clean.
    // It only contributes to YELLOW when combined with other violations.
    const r9Missing = !hasImage;

    // ── R10: Evidencia literal del FOB. ──
    const grounded = item.grounded !== undefined ? item.grounded : item.isGroundedFob;
    if (grounded === false) {
      violations.push(item.groundingReason || 'FOB sin evidencia literal suficiente');
    } else if (grounded !== true) {
      critical.push('Evidencia de grounding insuficiente');
    }

    // ── Semáforo ──
    // R9 (missing image) is advisory: only blocks GREEN when combined with other violations
        // ── R-model: honest model-quality gate ──
        // GREEN only certifies structural completeness; this stops the semaphore from
        // lying when the extracted model is actually dirty (datasheet specs, glued switch,
        // glued product-type, truncated, or lost product code). RED = unusable (not
        // importable), YELLOW = importable but flagged for human review.
        if (typeof TextSanitizer !== 'undefined' && TextSanitizer.assessModelQuality) {
          const _mq = TextSanitizer.assessModelQuality(modelo, variante, cat, item.rawText || item.cellRawText || '');
          if (_mq.level === 'RED') _mq.reasons.forEach(r => critical.push(r));
          else if (_mq.level === 'YELLOW') _mq.reasons.forEach(r => violations.push(r));
        }
    const nonImageViolations = violations.length; // R9 no longer pushes to violations

    let status = 'GREEN';
    if (critical.length > 0) {
      status = 'RED';
    } else if (nonImageViolations >= 1) {
      status = 'YELLOW';
    } else if (r9Missing) {
      // Image missing but all text fields perfect → GREEN with advisory
      status = 'GREEN';
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

    // Flaggear outliers (advisory only — does not block GREEN)
    for (const p of products) {
      const cat = p.cat || 'OTRO';
      const bounds = outlierBounds[cat];
      const fob = parseFloat(p.fob) || 0;
      if (bounds && fob > 0) {
        if (fob < bounds.low || fob > bounds.high) {
          p._statFlag = `Outlier de precio: $${fob} (mediana ${cat}: $${bounds.median.toFixed(2)})`;
          if (!p.warnings) p.warnings = [];
          p.warnings.push(p._statFlag);
          // Advisory only: do NOT change status from GREEN to YELLOW
          // Price outliers are valid products with unusual prices
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
      hasImage ? 'PASS' : 'INFO',
      hasImage ? 'GREEN' : 'GREEN',
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
    // Exception: R9 is advisory — stays GREEN regardless of upstream status
    if (sourceStatus === 'RED' || sourceStatus === 'YELLOW') {
      for (const e of evals) {
        if (e.status === 'GREEN' && e.code !== 'R9') {
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
  },

  // =========================================================================
  //  AUDITOR COMPLETO DE CATÁLOGO — 12 checks de contaminación por producto
  // =========================================================================

  COLOR_AUDIT_RE: /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|matte|glossy|negro|blanco|rosa|azul|rojo|verde|violeta|gris|plateado|dorado|naranja|marron|amarillo)\b/i,

  CATEGORY_AUDIT_RE: /\b(mouse|raton|keyboard|teclado|headset|auricular|earphone|earbuds|controller|gamepad|joystick|mousepad|switch|webcam|camera|camara|numpad|chair|silla|monitor|speaker|parlante|microphone|microfono)\b/i,

  PRICE_AUDIT_RE: /\$?\d{1,4}[.,]\d{2}\b/,

  CONNECTION_AUDIT_RE: /\b(wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\b/i,

  /**
   * Audita un catálogo completo producto por producto.
   * Devuelve reporte con issues por producto, stats, y top issues.
   * @param {Array} products - Array de productos del catálogo
   * @param {Array} [customBrands=[]] - Marcas personalizadas
   * @returns {Object} { total, clean, withIssues, issues[], stats{}, byType{}, exportCSV() }
   */
  auditCatalog(products, customBrands = []) {
    if (!Array.isArray(products)) return { total: 0, clean: 0, withIssues: 0, issues: [], stats: {}, byType: {} };

    const allBrands = ['REDRAGON','LOGITECH','RAZER','HYPERX','CORSAIR','AULA','AJAZZ','MACHENIKE','8BITDO','ATTACK SHARK','VGN','VXE','FLYDIGI','DARMOSHARK','LAMZU','WLMOUSE','KEYCHRON','VSG','KZ','Haimu','Polaroid','GameSir', ...customBrands.map(b => b.toUpperCase())];
    const issues = [];
    const byType = {};

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const sku = (p.sku || '').toString().trim();
      const modelo = (p.modelo || '').trim();
      const variante = (p.variante || '').trim();
      const marca = (p.marca || '').trim();
      const cat = (p.cat || '').trim().toUpperCase();
      const fob = parseFloat(p.fob) || 0;
      const img = p.img || '-';
      const productIssues = [];

      // Check 1: Color en modelo
      if (modelo && this.COLOR_AUDIT_RE.test(modelo)) {
        const colorMatch = modelo.match(this.COLOR_AUDIT_RE);
        productIssues.push({ type: 'COLOR_IN_MODEL', field: 'modelo', value: modelo, detail: `Color "${colorMatch[0]}" debería estar en variante` });
      }

      // Check 2: Marca en modelo
      if (modelo && marca && marca !== 'OTRO') {
        const marcaUpper = marca.toUpperCase();
        if (modelo.toUpperCase().includes(marcaUpper)) {
          productIssues.push({ type: 'BRAND_IN_MODEL', field: 'modelo', value: modelo, detail: `Marca "${marca}" aparece dentro del modelo` });
        }
      }

      // Check 3: Categoría en modelo
      if (modelo && this.CATEGORY_AUDIT_RE.test(modelo)) {
        const catMatch = modelo.match(this.CATEGORY_AUDIT_RE);
        productIssues.push({ type: 'CATEGORY_IN_MODEL', field: 'modelo', value: modelo, detail: `Palabra de categoría "${catMatch[0]}" no debería estar en modelo` });
      }

      // Check 4: Precio en modelo
      if (modelo && this.PRICE_AUDIT_RE.test(modelo)) {
        productIssues.push({ type: 'PRICE_IN_MODEL', field: 'modelo', value: modelo, detail: 'Patrón de precio detectado en modelo' });
      }

      // Check 5: Precio en variante
      if (variante && this.PRICE_AUDIT_RE.test(variante)) {
        productIssues.push({ type: 'PRICE_IN_VARIANT', field: 'variante', value: variante, detail: 'Patrón de precio detectado en variante' });
      }

      // Check 6: Modelo vacío o basura
      if (!modelo || modelo.length < 2 || /^(producto|item|\.|-|n\/a|undefined|null|none)$/i.test(modelo)) {
        productIssues.push({ type: 'EMPTY_MODEL', field: 'modelo', value: modelo, detail: 'Modelo vacío o genérico' });
      }

      // Check 7: Modelo demasiado largo (descripción)
      if (modelo && modelo.length > 60) {
        productIssues.push({ type: 'LONG_MODEL', field: 'modelo', value: modelo, detail: `Modelo tiene ${modelo.length} chars — parece descripción` });
      }

      // Check 8: Marca OTRO o vacía
      if (!marca || marca === 'OTRO') {
        productIssues.push({ type: 'NO_BRAND', field: 'marca', value: marca, detail: 'Marca no detectada' });
      }

      // Check 9: Categoría OTRO o vacía
      if (!cat || cat === 'OTRO') {
        productIssues.push({ type: 'NO_CATEGORY', field: 'cat', value: cat, detail: 'Categoría no clasificada' });
      }

      // Check 10: FOB inválido
      if (!Number.isFinite(fob) || fob <= 0) {
        productIssues.push({ type: 'INVALID_FOB', field: 'fob', value: fob, detail: `FOB inválido: ${fob}` });
      }

      // Check 11: Imagen faltante
      const hasImg = typeof img === 'string' && /^data:image\//i.test(img);
      if (!hasImg) {
        productIssues.push({ type: 'NO_IMAGE', field: 'img', value: '-', detail: 'Sin imagen' });
      }

      // Check 12: Conexión/tipo en modelo (debería ir en variante)
      if (modelo && this.CONNECTION_AUDIT_RE.test(modelo)) {
        const connMatch = modelo.match(this.CONNECTION_AUDIT_RE);
        productIssues.push({ type: 'CONNECTION_IN_MODEL', field: 'modelo', value: modelo, detail: `"${connMatch[0]}" debería ir en variante` });
      }

      // Check 13: Modelo = Variante (duplicado)
      if (modelo && variante && modelo.toLowerCase() === variante.toLowerCase()) {
        productIssues.push({ type: 'MODEL_EQ_VARIANT', field: 'modelo+variante', value: modelo, detail: 'Modelo y variante son idénticos' });
      }

      // Check 14: Variante es solo un precio
      if (variante && /^[\$]?\d+([\.,]\d+)?$/.test(variante)) {
        productIssues.push({ type: 'VARIANT_IS_PRICE', field: 'variante', value: variante, detail: 'Variante es un número/precio' });
      }

      if (productIssues.length > 0) {
        for (const issue of productIssues) {
          byType[issue.type] = (byType[issue.type] || 0) + 1;
          issues.push({
            index: i,
            sku: sku || `row-${i}`,
            marca,
            modelo,
            variante,
            cat,
            fob,
            status: p.status || 'UNKNOWN',
            ...issue
          });
        }
      }
    }

    const withIssuesCount = new Set(issues.map(i => i.index)).size;
    const cleanCount = products.length - withIssuesCount;

    // Top issue types sorted by frequency
    const topIssues = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round((count / products.length) * 100) }));

    const report = {
      total: products.length,
      clean: cleanCount,
      withIssues: withIssuesCount,
      cleanPct: Math.round((cleanCount / Math.max(1, products.length)) * 100),
      issueCount: issues.length,
      issues,
      byType,
      topIssues,
      stats: {
        green: products.filter(p => p.status === 'GREEN').length,
        yellow: products.filter(p => p.status === 'YELLOW').length,
        red: products.filter(p => p.status === 'RED').length
      }
    };

    // CSV export helper
    report.exportCSV = function() {
      const header = 'index,sku,marca,modelo,variante,cat,fob,status,issue_type,field,detail';
      const rows = issues.map(i =>
        `${i.index},"${(i.sku || '').replace(/"/g, '""')}","${(i.marca || '').replace(/"/g, '""')}","${(i.modelo || '').replace(/"/g, '""')}","${(i.variante || '').replace(/"/g, '""')}",${i.cat},${i.fob},${i.status},${i.type},${i.field},"${(i.detail || '').replace(/"/g, '""')}"`
      );
      return header + '\n' + rows.join('\n');
    };

    // Console-friendly summary
    report.printSummary = function() {
      console.log(`\n═══════════════════════════════════════════════════`);
      console.log(`  AUDITORÍA DE CATÁLOGO — ${this.total} productos`);
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`  ✅ Limpios:     ${this.clean} (${this.cleanPct}%)`);
      console.log(`  ⚠️  Con issues:  ${this.withIssues} (${100 - this.cleanPct}%)`);
      console.log(`  📊 Semáforo:    🟢${this.stats.green} 🟡${this.stats.yellow} 🔴${this.stats.red}`);
      console.log(`  📋 Total issues: ${this.issueCount}`);
      console.log(`───────────────────────────────────────────────────`);
      console.log(`  TOP ISSUES:`);
      for (const t of this.topIssues.slice(0, 10)) {
        console.log(`    ${t.type.padEnd(25)} ${String(t.count).padStart(4)} (${t.pct}%)`);
      }
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`  Para ver detalles: auditReport.issues`);
      console.log(`  Para exportar CSV: copy(auditReport.exportCSV())`);
      console.log(`═══════════════════════════════════════════════════\n`);
    };

    return report;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatalogValidator;
}
if (typeof window !== 'undefined') {
  window.CatalogValidator = CatalogValidator;

  // Global console shortcut: auditCatalog() or auditCatalog(catalog)
  window.auditCatalog = function(products) {
    const items = products || (typeof catalog !== 'undefined' ? catalog : null);
    if (!items || !items.length) {
      console.error('No hay catálogo cargado. Pasá el array manualmente: auditCatalog(miArray)');
      return null;
    }
    const brands = (typeof customBrandsList !== 'undefined') ? customBrandsList : [];
    const report = CatalogValidator.auditCatalog(items, brands);
    window.auditReport = report;
    report.printSummary();
    return report;
  };

  // Global console shortcut: fixCatalog() — auto-fix contamination in-place
  window.fixCatalog = function(products) {
    const items = products || (typeof catalog !== 'undefined' ? catalog : null);
    if (!items || !items.length) {
      console.error('No hay catálogo cargado.');
      return null;
    }
    const brands = (typeof customBrandsList !== 'undefined') ? customBrandsList : [];
    const TS = (typeof TextSanitizer !== 'undefined') ? TextSanitizer : null;
    const CV = CatalogValidator;

    // Before stats
    const before = CV.auditCatalog(items, brands);
    console.log(`📊 ANTES: ${before.clean}/${before.total} limpios (${before.cleanPct}%) · ${before.issueCount} issues`);

    // Use shared fix logic (single source of truth)
    const fixed = TS ? TS.fixItemsInPlace(items, brands) : 0;

    // Re-validate
    CV.runFullValidation(items);

    // After stats
    const after = CV.auditCatalog(items, brands);
    console.log(`📊 DESPUÉS: ${after.clean}/${after.total} limpios (${after.cleanPct}%) · ${after.issueCount} issues`);
    console.log(`🔧 Productos corregidos: ${fixed}`);
    console.log(`📈 Mejora: ${before.cleanPct}% → ${after.cleanPct}% limpios`);

    if (after.topIssues.length > 0) {
      console.log('\n  ISSUES RESTANTES:');
      for (const t of after.topIssues.slice(0, 10)) {
        console.log(`    ${t.type.padEnd(25)} ${String(t.count).padStart(4)} (${t.pct}%)`);
      }
    }

    // Save
    if (typeof AppStorage !== 'undefined' && typeof catalog !== 'undefined') {
      const sel = (typeof selection !== 'undefined') ? selection : {};
      AppStorage.saveCatalog(catalog, sel).then(() => {
        console.log('💾 Catálogo guardado con las correcciones.');
      }).catch(e => console.warn('No se pudo guardar:', e));
    }

    window.auditReport = after;
    return { before, after, fixed };
  };

  // Export catalog as downloadable JSON file
  window.exportCatalogJSON = function() {
    const items = (typeof catalog !== 'undefined') ? catalog : null;
    if (!items || !items.length) {
      if (typeof toast === 'function') toast('No hay catálogo para exportar', 'warning');
      return;
    }
    const data = JSON.stringify(items, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mambo-catalogo-${items.length}productos-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast(`📥 Catálogo exportado (${items.length} productos) → carpeta Descargas`, 'success');
  };

  // Run fixCatalog with UI feedback
  window.runFixCatalog = function() {
    if (typeof window.fixCatalog === 'function') {
      const result = window.fixCatalog();
      if (result) {
        const msg = `🔧 Auto-fix: ${result.fixed} productos corregidos · ${result.before.cleanPct}% → ${result.after.cleanPct}% limpios`;
        if (typeof toast === 'function') toast(msg, 'success');
        // Refresh the catalog view
        if (typeof renderCatalog === 'function') renderCatalog();
        if (typeof showCatalogContent === 'function') showCatalogContent();
      }
    } else {
      if (typeof toast === 'function') toast('fixCatalog no disponible', 'error');
    }
  };

  // Run fix on preview items (before import) — uses shared fixItemsInPlace
  window.runFixOnPreview = function() {
    const IF = (typeof ImportFlow !== 'undefined') ? ImportFlow : null;
    if (!IF || !IF.pendingPreviewItems || !IF.pendingPreviewItems.length) {
      if (typeof toast === 'function') toast('No hay productos en preview', 'warning');
      return;
    }
    const items = IF.pendingPreviewItems;
    const TS = (typeof TextSanitizer !== 'undefined') ? TextSanitizer : null;
    const brands = (typeof customBrandsList !== 'undefined') ? customBrandsList : [];

    const fixed = TS ? TS.fixItemsInPlace(items, brands) : 0;

    // Re-validate and re-render
    const validation = CatalogValidator.runFullValidation(items);
    validation.rejected.forEach(p => { p._selected = false; });
    window._previewValidation = validation;
    IF.renderImportPreviewModal(validation);

    const msg = `🔧 Auto-fix: ${fixed} productos corregidos en preview`;
    if (typeof toast === 'function') toast(msg, 'success');
  };
}
