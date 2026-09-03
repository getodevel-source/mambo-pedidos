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
    MOUSE: { min: 1, max: 300, warn: 200 },
    TECLADO: { min: 1, max: 400, warn: 300 },
    HEADSET: { min: 2, max: 500, warn: 400 },
    AURICULAR: { min: 1, max: 200, warn: 150 },
    CONTROLLER: { min: 3, max: 350, warn: 250 },
    MOUSEPAD: { min: 1, max: 250, warn: 200 },
    SWITCH: { min: 0.05, max: 15, warn: 10 },
    CAMARA: { min: 5, max: 800, warn: 500 },
    SPEAKER: { min: 5, max: 500, warn: 400 },
    SILLA_GAMING: { min: 30, max: 1000, warn: 800 },
    ACCESORIO: { min: 0.1, max: 600, warn: 450 },
    NUMPAD: { min: 2, max: 80, warn: 60 },
    MONITOR: { min: 30, max: 2000, warn: 1500 },
    CUIDADO_PERSONAL: { min: 2, max: 300, warn: 200 },
  },

  // ── Marcas de categoría única (si el producto no es de esta categoría → REJECT) ──
  BRAND_LOCK: {
    KZ: ["AURICULAR", "ACCESORIO"],
    Haimu: ["SWITCH"],
    Polaroid: ["CAMARA"],
    "8BitDo": ["CONTROLLER", "ACCESORIO", "TECLADO", "NUMPAD"],
    Flydigi: ["CONTROLLER", "ACCESORIO"],
    GameSir: ["CONTROLLER", "ACCESORIO"],
  },

  // ── Reglas críticas → RED (rechazo activo) ──
  CRITICAL_RULES: new Set([
    "precio_absurdo",
    "marca_incompatible",
    "modelo_basura",
    "fob_invalido",
  ]),

  /**
   * Capa 1 + 3: Valida un producto con reglas cruzadas y devuelve semáforo.
   * @returns {{ status: 'GREEN'|'YELLOW'|'RED', score: number, violations: Array, critical: Array }}
   */
  validateItem(item) {
    if (!item)
      return {
        status: "RED",
        score: 0,
        violations: [],
        critical: ["Producto nulo"],
        warnings: ["Producto nulo"],
      };

    const violations = [];
    const critical = [];
    const sku = (item.sku || "").toString().trim();
    const modelo = (item.modelo || "").trim();
    const variante = (item.variante || "").trim();
    const marca = (item.marca || "").trim();
    const cat = (item.cat || "").trim().toUpperCase();
    const fob = Number.parseFloat(item.fob);

    // ── B6: SKU fail-closed. Vacío, '-' o formato inválido (espacios o
    // caracteres no alfanuméricos) → critical (RED). NO se exige el patrón
    // exacto de SkuAllocator (MARCA-CAT-HEX8): los productos manuales y de
    // CSV usan SKUs propios legítimos (ej 'MOU-001') que no deben rechazarse.
    const SKU_VALID_RE = /^[A-Z0-9][A-Z0-9-]{2,49}$/i;

    if (!sku || sku === "-") {
      critical.push("SKU vacío o inválido");
    } else if (!SKU_VALID_RE.test(sku)) {
      critical.push(`SKU inválido ("${sku}" contiene caracteres no válidos)`);
    }

    // ── R1: FOB válido ──
    if (!Number.isFinite(fob) || fob <= 0) {
      critical.push(`FOB inválido ($${Number.isFinite(fob) ? fob : 0})`);
    }

    // ── R2: Modelo no es basura ──
    const GARBAGE_RE =
      /^(producto\s*item|item|\.|-|n\/a|undefined|null|none|list|earphones?)$/i;
    if (!modelo || modelo.length < 2) {
      critical.push(`Modelo vacío o demasiado corto ("${modelo}")`);
    } else if (GARBAGE_RE.test(modelo)) {
      critical.push(`Modelo es ruido genérico ("${modelo}")`);
    } else if (/^\$?\d+([.,]\d+)?$/.test(modelo)) {
      critical.push(`Modelo es un precio numérico ("${modelo}")`);
    } else if (
      /^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo)
    ) {
      critical.push(`Modelo es ruido corporativo ("${modelo}")`);
    }

    // ── R3: Precio sensato por categoría ──
    const range = this.PRICE_RANGES[cat];
    if (range && fob > 0) {
      if (fob < range.min || fob > range.max) {
        critical.push(
          `Precio $${fob} fuera de rango para ${cat} ($${range.min}-$${range.max})`,
        );
      }
      // "Unusually high" is advisory only — does not block GREEN
    }

    // ── R4: Marca-categoría coherente ──
    const lock = this.BRAND_LOCK[marca];
    if (lock && cat !== "OTRO" && !lock.includes(cat)) {
      critical.push(`${marca} no fabrica ${cat} (solo: ${lock.join(", ")})`);
    }

    // ── R5: Categoría válida ──
    if (!cat || cat === "OTRO") {
      critical.push(`Categoría no clasificada ("${cat || "vacía"}")`);
    }

    // ── R6: Marca especificada ──
    if (!marca || marca === "OTRO") {
      critical.push("Marca no detectada");
    }

    // ── R7: Variante no es un precio ──
    if (variante && /^[$]?\d+([.,]\d+)?$/.test(variante)) {
      violations.push(`Variante es un precio ("${variante}")`);
    }

    // ── R8: Modelo ≠ Variante (duplicado probable) ──
    if (modelo && variante && modelo.toLowerCase() === variante.toLowerCase()) {
      violations.push(`Modelo y variante idénticos ("${modelo}")`);
    }

    // ── R9: Imagen válida. Regla DURA (fail-closed, AP-1): sin imagen válida
    // → violation → YELLOW vía runFullValidation. Nunca advisory. ──
    const hasImage =
      typeof item.img === "string" &&
      /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(
        item.img.trim(),
      );
    if (!hasImage) {
      violations.push("Sin imagen de producto");
    }

    // ── R10: Evidencia literal del FOB. ──
    const grounded =
      item.grounded !== undefined ? item.grounded : item.isGroundedFob;
    if (grounded === false) {
      violations.push(
        item.groundingReason || "FOB sin evidencia literal suficiente",
      );
    } else if (grounded !== true) {
      critical.push("Evidencia de grounding insuficiente");
    }

    // ── Semáforo ──
    // R9 (missing image) is hard: it pushes a violation above, so a product
    // with everything OK but no image lands on YELLOW (never RED, never GREEN).
    // ── R-model: honest model-quality gate ──
    // GREEN only certifies structural completeness; this stops the semaphore from
    // lying when the extracted model is actually dirty (datasheet specs, glued switch,
    // glued product-type, truncated, or lost product code). RED = unusable (not
    // importable), YELLOW = importable but flagged for human review.
    if (
      typeof TextSanitizer !== "undefined" &&
      TextSanitizer.assessModelQuality
    ) {
      const _mq = TextSanitizer.assessModelQuality(
        modelo,
        variante,
        cat,
        item.rawText || item.cellRawText || "",
      );
      if (_mq.level === "RED") _mq.reasons.forEach((r) => critical.push(r));
      else if (_mq.level === "YELLOW")
        _mq.reasons.forEach((r) => violations.push(r));
      // Slice 1 (gate-calibration): evidencia estructurada de clasificación
      // de marketing para deriveReasonCode / instrumentReasons (aditivo).
      item._modelQuality = {
        level: _mq.level,
        marketing: _mq.marketing || null,
        marketingEvidence: _mq.marketingEvidence || null,
      };
    }
    let status = "GREEN";
    if (critical.length > 0) {
      status = "RED";
    } else if (violations.length >= 1) {
      status = "YELLOW";
    }

    const totalChecks = 11;
    const failedCount = critical.length + violations.length;
    const score = Math.max(
      0,
      Math.round(((totalChecks - failedCount) / totalChecks) * 100),
    );

    return {
      status,
      score,
      violations,
      critical,
      grounded: grounded === true,
      hasImage,
      warnings: [...critical, ...violations],
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
      const cat = p.cat || "OTRO";
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
        low3: q1 - 3 * iqr,
        high3: q3 + 3 * iqr,
        median: prices[Math.floor(prices.length * 0.5)],
        iqr,
      };
    }

    // Flaggear outliers. La banda 1.5x sigue advisory (_statFlag, sin cambio
    // de status); la banda de alta confianza IQRx3 degrada a YELLOW con
    // evidencia (spec: fob-grounding-integrity). Nunca degrada RED -> YELLOW.
    for (const p of products) {
      const cat = p.cat || "OTRO";
      const bounds = outlierBounds[cat];
      const fob = parseFloat(p.fob) || 0;
      if (bounds && fob > 0) {
        if (fob < bounds.low3 || fob > bounds.high3) {
          const factor =
            (fob - bounds.median) / Math.max(1e-9, bounds.iqr || 1);
          p._outlierEvidence = {
            price: fob,
            median: bounds.median,
            iqr: bounds.iqr,
            cat,
            factor: Math.round(factor * 100) / 100,
          };
          const warn =
            "Outlier de precio: $" +
            fob +
            " (mediana $" +
            bounds.median.toFixed(2) +
            ")";
          if (!p.warnings) p.warnings = [];
          if (!p.warnings.includes(warn)) p.warnings.push(warn);
          const literalGrounded =
            CATALOG_VALIDATOR_CALIBRATION.outlierLiteralCalibration &&
            !!p._priceGroundingLiteral;
          if (literalGrounded) {
            p._outlierEvidence.groundingMode = "literal";
            p._statFlag = warn;
            // Price tier verified against a literal row anchor: advisory only
          } else {
            p.status = this.maxStatus(p.status, "YELLOW");
          }
        } else if (fob < bounds.low || fob > bounds.high) {
          p._statFlag =
            "Outlier de precio: $" +
            fob +
            " (mediana " +
            cat +
            ": $" +
            bounds.median.toFixed(2) +
            ")";
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
      const cat = p.cat || "OTRO";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const total = products.length;
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count / total < 0.02 && count <= 3 && cat !== "OTRO") {
        // Categoría con muy pocos productos → verificar doble
        for (const p of products) {
          if (p.cat === cat && p.status === "GREEN") {
            p.status = "YELLOW";
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
      const sourceWarnings = Array.isArray(p.sourceWarnings)
        ? p.sourceWarnings
        : [];
      const sourceConfidence = Number.isFinite(Number(p.confidence))
        ? Number(p.confidence)
        : null;
      const sourceStatus = this.normalizeStatus(p.sourceStatus || p.status);
      p._validation = result;
      p.sourceStatus = sourceStatus;
      // Preserve upstream evidence: a parser/AI RED or YELLOW result cannot be
      // promoted back to GREEN by the deterministic checks alone.
      p.status = this.maxStatus(result.status, sourceStatus);
      p.warnings = [
        ...new Set([
          ...sourceWarnings,
          ...result.critical,
          ...result.violations,
        ]),
      ];
      p.sourceConfidence = sourceConfidence;
      p.confidence = result.score;
      p.grounded = p.grounded !== undefined ? p.grounded : p.isGroundedFob;
      p.qualityReason = p.warnings[0] || "Sin observaciones";
      p.importable = p.status !== "RED";
    }

    // Capa 4: Estadística del catálogo
    this.validateCatalogStats(products);
    for (const p of products) {
      p.importable = p.status !== "RED";
      p.qualityReason = (p.warnings && p.warnings[0]) || "Sin observaciones";
    }

    // Separar por semáforo
    const accepted = products.filter((p) => p.status === "GREEN");
    const review = products.filter((p) => p.status === "YELLOW");
    const rejected = products.filter((p) => p.status === "RED");

    return {
      accepted,
      review,
      rejected,
      stats: {
        total: products.length,
        green: accepted.length,
        yellow: review.length,
        red: rejected.length,
        greenPct: Math.round(
          (accepted.length / Math.max(1, products.length)) * 100,
        ),
      },
    };
  },

  normalizeStatus(status) {
    const value = String(status || "").toUpperCase();
    if (value === "RED" || value === "ERROR" || value === "INVALID")
      return "RED";
    if (value === "YELLOW" || value === "WARNING") return "YELLOW";
    if (value === "GREEN" || value === "VALID") return "GREEN";
    return "";
  },

  maxStatus(left, right) {
    const rank = { "": 0, GREEN: 1, YELLOW: 2, RED: 3 };
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
      return this._defaultEvaluations("R1", "Producto nulo");
    }

    const evals = [];
    const sku = (item.sku || "").toString().trim();
    const modelo = (item.modelo || "").trim();
    const variante = (item.variante || "").trim();
    const marca = (item.marca || "").trim();
    const cat = (item.cat || "").trim().toUpperCase();
    const fob = Number.parseFloat(item.fob);
    const sourceStatus = this.normalizeStatus(item.sourceStatus || "");
    const hasImage =
      typeof item.img === "string" &&
      /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(
        item.img.trim(),
      );
    const grounded =
      item.grounded !== undefined ? item.grounded : item.isGroundedFob;

    // ── R1: FOB válido ──
    const fobFinite = Number.isFinite(fob) && fob > 0;
    evals.push(
      this._makeEval(
        "R1",
        fobFinite ? "PASS" : "CRITICAL",
        fobFinite ? "GREEN" : "RED",
        fobFinite ? "IMPORTABLE" : "REJECTED",
        {
          observed: Number.isFinite(fob) ? fob : 0,
          expected: ">0 finito",
          source: item.fobRaw || `sku:${sku}`,
        },
        fobFinite
          ? "FOB válido"
          : `FOB inválido ($${Number.isFinite(fob) ? fob : 0})`,
      ),
    );

    // ── R2: Modelo no es basura ──
    const GARBAGE_RE =
      /^(producto\s*item|item|\.|-|n\/a|undefined|null|none|list|earphones?)$/i;
    const modelOk =
      modelo &&
      modelo.length >= 2 &&
      !GARBAGE_RE.test(modelo) &&
      !/^\$?\d+([.,]\d+)?$/.test(modelo) &&
      !/^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo);
    let r2Reason = "Modelo válido";
    if (!modelo || modelo.length < 2)
      r2Reason = `Modelo vacío o demasiado corto ("${modelo}")`;
    else if (GARBAGE_RE.test(modelo))
      r2Reason = `Modelo es ruido genérico ("${modelo}")`;
    else if (/^\$?\d+([.,]\d+)?$/.test(modelo))
      r2Reason = `Modelo es un precio numérico ("${modelo}")`;
    else if (/^(co\.?,?|ltd\.?|electronic|technology|shenzhen)$/i.test(modelo))
      r2Reason = `Modelo es ruido corporativo ("${modelo}")`;
    evals.push(
      this._makeEval(
        "R2",
        modelOk ? "PASS" : "CRITICAL",
        modelOk ? "GREEN" : "RED",
        modelOk ? "IMPORTABLE" : "REJECTED",
        {
          observed: modelo,
          expected: "texto significativo",
          source: `modelo:${sku}`,
        },
        r2Reason,
      ),
    );

    // ── R3: Precio sensato por categoría ──
    const range = this.PRICE_RANGES[cat];
    let r3Severity = "PASS",
      r3Status = "GREEN",
      r3Import = "IMPORTABLE";
    let r3Reason = "Precio dentro de rango";
    if (range && fob > 0) {
      if (fob < range.min || fob > range.max) {
        r3Severity = "CRITICAL";
        r3Status = "RED";
        r3Import = "REJECTED";
        r3Reason = `Precio $${fob} fuera de rango para ${cat} ($${range.min}-$${range.max})`;
      } else if (fob > range.warn) {
        r3Severity = "WARNING";
        r3Status = "YELLOW";
        r3Import = "IMPORTABLE";
        r3Reason = `Precio $${fob} inusualmente alto para ${cat} (>$${range.warn})`;
      }
    }
    evals.push(
      this._makeEval(
        "R3",
        r3Severity,
        r3Status,
        r3Import,
        {
          observed: Number.isFinite(fob) ? fob : 0,
          expected: range ? `$${range.min}-$${range.max}` : "sin rango",
          source: cat,
        },
        r3Reason,
      ),
    );

    // ── R4: Marca-categoría coherente ──
    const lock = this.BRAND_LOCK[marca];
    const brandCatOk = !lock || cat === "OTRO" || lock.includes(cat);
    evals.push(
      this._makeEval(
        "R4",
        brandCatOk ? "PASS" : "CRITICAL",
        brandCatOk ? "GREEN" : "RED",
        brandCatOk ? "IMPORTABLE" : "REJECTED",
        {
          observed: `${marca}→${cat}`,
          expected: lock ? lock.join(",") : "compatible",
          source: "BRAND_LOCK",
        },
        brandCatOk
          ? "Marca-categoría coherente"
          : `${marca} no fabrica ${cat} (solo: ${lock.join(", ")})`,
      ),
    );

    // ── R5: Categoría válida ──
    const catOk = cat && cat !== "OTRO";
    evals.push(
      this._makeEval(
        "R5",
        catOk ? "PASS" : "CRITICAL",
        catOk ? "GREEN" : "RED",
        catOk ? "IMPORTABLE" : "REJECTED",
        {
          observed: cat || "vacía",
          expected: "categoría conocida",
          source: "vocabulario",
        },
        catOk
          ? "Categoría válida"
          : `Categoría no clasificada ("${cat || "vacía"}")`,
      ),
    );

    // ── R6: Marca especificada ──
    const brandOk = marca && marca !== "OTRO";
    evals.push(
      this._makeEval(
        "R6",
        brandOk ? "PASS" : "CRITICAL",
        brandOk ? "GREEN" : "RED",
        brandOk ? "IMPORTABLE" : "REJECTED",
        {
          observed: marca || "vacía",
          expected: "marca conocida",
          source: "vocabulario",
        },
        brandOk ? "Marca especificada" : "Marca no detectada",
      ),
    );

    // ── R7: Variante no es un precio ──
    const variantIsPrice = variante && /^[$]?\d+([.,]\d+)?$/.test(variante);
    evals.push(
      this._makeEval(
        "R7",
        variantIsPrice ? "WARNING" : "PASS",
        variantIsPrice ? "YELLOW" : "GREEN",
        "IMPORTABLE",
        {
          observed: variante,
          expected: "texto descriptivo",
          source: "variante",
        },
        variantIsPrice
          ? `Variante es un precio ("${variante}")`
          : "Variante descriptiva",
      ),
    );

    // ── R8: Modelo ≠ Variante ──
    const modelEqVariant =
      modelo && variante && modelo.toLowerCase() === variante.toLowerCase();
    evals.push(
      this._makeEval(
        "R8",
        modelEqVariant ? "WARNING" : "PASS",
        modelEqVariant ? "YELLOW" : "GREEN",
        "IMPORTABLE",
        {
          observed: `modelo:"${modelo}" variante:"${variante}"`,
          expected: "distintos",
          source: "modelo+variante",
        },
        modelEqVariant
          ? `Modelo y variante idénticos ("${modelo}")`
          : "Modelo y variante distintos",
      ),
    );

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
      r9Observed = hasImage ? "data:image/..." : "faltante/inválida";
      r9Source = "img";
      r9Reason = hasImage
        ? "Imagen válida"
        : "Imagen faltante o inválida: requiere revisión";
    }
    evals.push(
      this._makeEval(
        "R9",
        hasImage ? "PASS" : "WARNING",
        hasImage ? "GREEN" : "YELLOW",
        "IMPORTABLE",
        Object.assign(
          {
            observed: r9Observed,
            expected: "data:image/png|jpeg|webp|gif",
            source: r9Source,
          },
          imgEv
            ? {
                canvasDecode: imgEv.canvasDecode,
                pdfIdentity: imgEv.pdfIdentity,
                page: imgEv.page,
                association: imgEv.association,
              }
            : {},
        ),
        r9Reason,
      ),
    );

    // ── R10: Evidencia de grounding ──
    let r10Sev, r10Sta, r10Imp, r10Reason;
    if (grounded === true) {
      r10Sev = "PASS";
      r10Sta = "GREEN";
      r10Imp = "IMPORTABLE";
      r10Reason = "FOB verificado literalmente";
    } else if (grounded === false) {
      r10Sev = "WARNING";
      r10Sta = "YELLOW";
      r10Imp = "IMPORTABLE";
      r10Reason =
        item.groundingReason || "FOB sin evidencia literal suficiente";
    } else {
      r10Sev = "CRITICAL";
      r10Sta = "RED";
      r10Imp = "REJECTED";
      r10Reason = "Evidencia de grounding insuficiente";
    }
    evals.push(
      this._makeEval(
        "R10",
        r10Sev,
        r10Sta,
        r10Imp,
        {
          observed:
            grounded === true
              ? "verificado"
              : grounded === false
                ? "no verificado"
                : "ausente",
          expected: "presencia literal en fuente",
          source: item.groundingReason || "grounding",
          ...(item.groundingEvidence &&
          typeof item.groundingEvidence === "object"
            ? item.groundingEvidence
            : {}),
        },
        r10Reason,
      ),
    );

    // Apply upstream status: a RED/YELLOW from source cannot be promoted to GREEN.
    // R9 is exempt from upstream demotion: it measures the image field itself,
    // and a valid image stays valid regardless of the row's overall status.
    // (Missing image is already YELLOW via the R9 rule above.)
    if (sourceStatus === "RED" || sourceStatus === "YELLOW") {
      for (const e of evals) {
        if (e.status === "GREEN" && e.code !== "R9") {
          e.status = sourceStatus;
          if (sourceStatus === "RED") {
            e.severity = "WARNING";
            e.importability = "REJECTED";
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
    const codes = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
    for (const code of codes) {
      evals.push({
        code,
        severity: "CRITICAL",
        status: "RED",
        importability: "REJECTED",
        evidence: {
          observed: "nulo",
          expected: "válido",
          source: "producto_nulo",
        },
        reason:
          code === firstCode
            ? firstReason
            : "Producto nulo — validación imposible",
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
    const codes = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
    for (const code of codes) violationsByCode[code] = 0;

    for (const e of evaluations) {
      if (e.status !== "GREEN" && violationsByCode.hasOwnProperty(e.code)) {
        violationsByCode[e.code]++;
      }
    }

    const stats = {
      total: evaluations.length,
      green: evaluations.filter((e) => e.status === "GREEN").length,
      yellow: evaluations.filter((e) => e.status === "YELLOW").length,
      red: evaluations.filter((e) => e.status === "RED").length,
    };

    return { violationsByCode, canonicalGroupCount: 10, stats };
  },

  // =========================================================================
  //  AUDITOR COMPLETO DE CATÁLOGO — 12 checks de contaminación por producto
  // =========================================================================

  COLOR_AUDIT_RE:
    /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|matte|glossy|negro|blanco|rosa|azul|rojo|verde|violeta|gris|plateado|dorado|naranja|marron|amarillo)\b/i,

  CATEGORY_AUDIT_RE:
    /\b(mouse|raton|keyboard|teclado|headset|auricular|earphone|earbuds|controller|gamepad|joystick|mousepad|switch|webcam|camera|camara|numpad|chair|silla|monitor|speaker|parlante|microphone|microfono)\b/i,

  PRICE_AUDIT_RE: /\$?\d{1,4}[.,]\d{2}\b/,

  CONNECTION_AUDIT_RE:
    /\b(wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\b/i,

  /**
   * Audita un catálogo completo producto por producto.
   * Devuelve reporte con issues por producto, stats, y top issues.
   * @param {Array} products - Array de productos del catálogo
   * @param {Array} [customBrands=[]] - Marcas personalizadas
   * @returns {Object} { total, clean, withIssues, issues[], stats{}, byType{}, exportCSV() }
   */
  auditCatalog(products, customBrands = []) {
    if (!Array.isArray(products))
      return {
        total: 0,
        clean: 0,
        withIssues: 0,
        issues: [],
        stats: {},
        byType: {},
      };

    const _allBrands = [
      "REDRAGON",
      "LOGITECH",
      "RAZER",
      "HYPERX",
      "CORSAIR",
      "AULA",
      "AJAZZ",
      "MACHENIKE",
      "8BITDO",
      "ATTACK SHARK",
      "VGN",
      "VXE",
      "FLYDIGI",
      "DARMOSHARK",
      "LAMZU",
      "WLMOUSE",
      "KEYCHRON",
      "VSG",
      "KZ",
      "Haimu",
      "Polaroid",
      "GameSir",
      ...customBrands.map((b) => b.toUpperCase()),
    ];
    const issues = [];
    const byType = {};

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const sku = (p.sku || "").toString().trim();
      const modelo = (p.modelo || "").trim();
      const variante = (p.variante || "").trim();
      const marca = (p.marca || "").trim();
      const cat = (p.cat || "").trim().toUpperCase();
      const fob = parseFloat(p.fob) || 0;
      const img = p.img || "-";
      const productIssues = [];

      // Check 1: Color en modelo
      if (modelo && this.COLOR_AUDIT_RE.test(modelo)) {
        const colorMatch = modelo.match(this.COLOR_AUDIT_RE);
        productIssues.push({
          type: "COLOR_IN_MODEL",
          field: "modelo",
          value: modelo,
          detail: `Color "${colorMatch[0]}" debería estar en variante`,
        });
      }

      // Check 2: Marca en modelo
      if (modelo && marca && marca !== "OTRO") {
        const marcaUpper = marca.toUpperCase();
        if (modelo.toUpperCase().includes(marcaUpper)) {
          productIssues.push({
            type: "BRAND_IN_MODEL",
            field: "modelo",
            value: modelo,
            detail: `Marca "${marca}" aparece dentro del modelo`,
          });
        }
      }

      // Check 3: Categoría en modelo
      if (modelo && this.CATEGORY_AUDIT_RE.test(modelo)) {
        const catMatch = modelo.match(this.CATEGORY_AUDIT_RE);
        productIssues.push({
          type: "CATEGORY_IN_MODEL",
          field: "modelo",
          value: modelo,
          detail: `Palabra de categoría "${catMatch[0]}" no debería estar en modelo`,
        });
      }

      // Check 4: Precio en modelo
      if (modelo && this.PRICE_AUDIT_RE.test(modelo)) {
        productIssues.push({
          type: "PRICE_IN_MODEL",
          field: "modelo",
          value: modelo,
          detail: "Patrón de precio detectado en modelo",
        });
      }

      // Check 5: Precio en variante
      if (variante && this.PRICE_AUDIT_RE.test(variante)) {
        productIssues.push({
          type: "PRICE_IN_VARIANT",
          field: "variante",
          value: variante,
          detail: "Patrón de precio detectado en variante",
        });
      }

      // Check 6: Modelo vacío o basura
      if (
        !modelo ||
        modelo.length < 2 ||
        /^(producto|item|\.|-|n\/a|undefined|null|none)$/i.test(modelo)
      ) {
        productIssues.push({
          type: "EMPTY_MODEL",
          field: "modelo",
          value: modelo,
          detail: "Modelo vacío o genérico",
        });
      }

      // Check 7: Modelo demasiado largo (descripción)
      if (modelo && modelo.length > 60) {
        productIssues.push({
          type: "LONG_MODEL",
          field: "modelo",
          value: modelo,
          detail: `Modelo tiene ${modelo.length} chars — parece descripción`,
        });
      }

      // Check 8: Marca OTRO o vacía
      if (!marca || marca === "OTRO") {
        productIssues.push({
          type: "NO_BRAND",
          field: "marca",
          value: marca,
          detail: "Marca no detectada",
        });
      }

      // Check 9: Categoría OTRO o vacía
      if (!cat || cat === "OTRO") {
        productIssues.push({
          type: "NO_CATEGORY",
          field: "cat",
          value: cat,
          detail: "Categoría no clasificada",
        });
      }

      // Check 10: FOB inválido
      if (!Number.isFinite(fob) || fob <= 0) {
        productIssues.push({
          type: "INVALID_FOB",
          field: "fob",
          value: fob,
          detail: `FOB inválido: ${fob}`,
        });
      }

      // Check 11: Imagen faltante
      const hasImg = typeof img === "string" && /^data:image\//i.test(img);
      if (!hasImg) {
        productIssues.push({
          type: "NO_IMAGE",
          field: "img",
          value: "-",
          detail: "Sin imagen",
        });
      }

      // Check 12: Conexión/tipo en modelo (debería ir en variante)
      if (modelo && this.CONNECTION_AUDIT_RE.test(modelo)) {
        const connMatch = modelo.match(this.CONNECTION_AUDIT_RE);
        productIssues.push({
          type: "CONNECTION_IN_MODEL",
          field: "modelo",
          value: modelo,
          detail: `"${connMatch[0]}" debería ir en variante`,
        });
      }

      // Check 13: Modelo = Variante (duplicado)
      if (
        modelo &&
        variante &&
        modelo.toLowerCase() === variante.toLowerCase()
      ) {
        productIssues.push({
          type: "MODEL_EQ_VARIANT",
          field: "modelo+variante",
          value: modelo,
          detail: "Modelo y variante son idénticos",
        });
      }

      // Check 14: Variante es solo un precio
      if (variante && /^[$]?\d+([.,]\d+)?$/.test(variante)) {
        productIssues.push({
          type: "VARIANT_IS_PRICE",
          field: "variante",
          value: variante,
          detail: "Variante es un número/precio",
        });
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
            status: p.status || "UNKNOWN",
            ...issue,
          });
        }
      }
    }

    const withIssuesCount = new Set(issues.map((i) => i.index)).size;
    const cleanCount = products.length - withIssuesCount;

    // Top issue types sorted by frequency
    const topIssues = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / products.length) * 100),
      }));

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
        green: products.filter((p) => p.status === "GREEN").length,
        yellow: products.filter((p) => p.status === "YELLOW").length,
        red: products.filter((p) => p.status === "RED").length,
      },
    };

    // CSV export helper
    report.exportCSV = function () {
      const header =
        "index,sku,marca,modelo,variante,cat,fob,status,issue_type,field,detail";
      const rows = issues.map(
        (i) =>
          `${i.index},"${(i.sku || "").replace(/"/g, '""')}","${(i.marca || "").replace(/"/g, '""')}","${(i.modelo || "").replace(/"/g, '""')}","${(i.variante || "").replace(/"/g, '""')}",${i.cat},${i.fob},${i.status},${i.type},${i.field},"${(i.detail || "").replace(/"/g, '""')}"`,
      );
      return header + "\n" + rows.join("\n");
    };

    // Console-friendly summary
    report.printSummary = function () {
      console.log(`\n═══════════════════════════════════════════════════`);
      console.log(`  AUDITORÍA DE CATÁLOGO — ${this.total} productos`);
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`  ✅ Limpios:     ${this.clean} (${this.cleanPct}%)`);
      console.log(
        `  ⚠️  Con issues:  ${this.withIssues} (${100 - this.cleanPct}%)`,
      );
      console.log(
        `  📊 Semáforo:    🟢${this.stats.green} 🟡${this.stats.yellow} 🔴${this.stats.red}`,
      );
      console.log(`  📋 Total issues: ${this.issueCount}`);
      console.log(`───────────────────────────────────────────────────`);
      console.log(`  TOP ISSUES:`);
      for (const t of this.topIssues.slice(0, 10)) {
        console.log(
          `    ${t.type.padEnd(25)} ${String(t.count).padStart(4)} (${t.pct}%)`,
        );
      }
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`  Para ver detalles: auditReport.issues`);
      console.log(`  Para exportar CSV: copy(auditReport.exportCSV())`);
      console.log(`═══════════════════════════════════════════════════\n`);
    };

    return report;
  },


  // ── I1 (process-improvement-program): reporte de calidad del catálogo cargado ──
  // Agregador puro por proveedor — las mismas semánticas del semáforo de
  // import (status/warnings/grounding). Determinístico y testeable en Node.
  catalogQualityReport(items) {
    const list = Array.isArray(items) ? items : [];
    const byBrand = new Map();
    const sum = { total: 0, green: 0, yellow: 0, red: 0, grounded: 0, outliers: 0, sinFoto: 0, duplicados: 0, unclassified: 0 };
    const seenIdentity = new Map();
    for (const it of list) {
      if (!it || typeof it !== "object") continue;
      const marca = String(it.marca || "OTRO").trim() || "OTRO";
      if (!byBrand.has(marca)) byBrand.set(marca, { marca, total: 0, green: 0, yellow: 0, red: 0, grounded: 0, outliers: 0, sinFoto: 0 });
      const b = byBrand.get(marca);
      b.total++; sum.total++;
      if (it.status === "GREEN") { b.green++; sum.green++; }
      else if (it.status === "YELLOW") { b.yellow++; sum.yellow++; }
      else { b.red++; sum.red++; }
      if (it.grounded === true) { b.grounded++; sum.grounded++; }
      const warns = Array.isArray(it.warnings) ? it.warnings : [];
      if (warns.some(w => /outlier/i.test(String(w)))) { b.outliers++; sum.outliers++; }
      if (typeof it.img !== "string" || !it.img.startsWith("data:image/")) { b.sinFoto++; sum.sinFoto++; }
      // duplicados: identidad repetida (misma marca/modelo/variante/cat normalizados)
      const ident = [String(it.marca||""), String(it.modelo||""), String(it.variante||""), String(it.cat||"")].map(v => v.trim().toLowerCase()).join("|");
      if (ident.split("|").every(x => x)) {
        const n = (seenIdentity.get(ident) || 0) + 1;
        seenIdentity.set(ident, n);
        if (n === 2) { sum.duplicados += 2; b.duplicados = (b.duplicados || 0) + 2; }
        else if (n > 2) { sum.duplicados++; b.duplicados = (b.duplicados || 0) + 1; }
      }
      // no-GREEN sin razón atómica derivable (defecto de pipeline)
      if (it.status !== "GREEN") {
        let reason = null;
        if (typeof ImportGates !== "undefined" && typeof ImportGates.deriveReasonCode === "function") reason = ImportGates.deriveReasonCode(it);
        if (!reason || reason === "UNCLASSIFIED_YELLOW") { b.unclassified = (b.unclassified || 0) + 1; sum.unclassified++; }
      }
    }
    const brands = Array.from(byBrand.values()).map(b => ({ ...b, groundedPct: b.total ? Math.round((b.grounded / b.total) * 100) : 0, duplicados: b.duplicados || 0, unclassified: b.unclassified || 0 })).sort((a, b2) => b2.total - a.total);
    return { brands, summary: { ...sum, groundedPct: sum.total ? Math.round((sum.grounded / sum.total) * 100) : 0, verifiedPct: sum.total ? Math.round(((sum.green + sum.yellow) / sum.total) * 100) : 0 } };
  },

  // Abre el modal de calidad (catálogo cargado) — app real.
  showCatalogQuality() {
    const items = typeof catalog !== "undefined" ? catalog : [];
    const modal = document.getElementById("catalogQualityModal");
    if (!modal) return;
    const report = CatalogValidator.catalogQualityReport(items);
    const s = report.summary;
    document.getElementById("catalogQualitySummary").textContent =
      `${s.total} productos · ${s.green} verdes · ${s.yellow} en revisión · ${s.red} no importables · ` +
      `${s.groundedPct}% con FOB anclado · ${s.outliers} outliers · ${s.sinFoto} sin foto · ${s.duplicados} duplicados`;
    document.getElementById("catalogQualityPct").textContent = `${s.verifiedPct}% verificados`;
    const body = document.getElementById("catalogQualityBody");
    if (body) {
      body.innerHTML = report.brands.map(b => {
        const pct = b.total ? Math.round(((b.green + b.yellow) / b.total) * 100) : 0;
        const brandSafe = String(b.marca).replace(/</g,'&lt;').replace(/'/g,'&#39;');
        return `<tr>
          <td style="font-weight:600;">${brandSafe}</td>
          <td>${b.total}</td>
          <td style="color:#34d399;">${b.green}</td>
          <td style="color:#facc15;">${b.yellow}</td>
          <td style="color:#f87171;">${b.red}</td>
          <td>${pct}%</td>
          <td>${b.groundedPct}%</td>
          <td>${b.outliers}</td>
          <td>${b.sinFoto}</td>
          <td>${b.duplicados}</td>
          <td>${b.unclassified}</td>
          <td><button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="runCatalogRemediation('${brandSafe}')" title="Remediar solo esta marca (con evidencia)">Remediar</button></td>
        </tr>`;
      }).join("");
    }
    modal.style.display = "flex";
  },

  // Campaña de remediación guiada (I1 + spec process-catalog-quality): corre
  // el pass con evidencia sobre el catálogo vivo (o una marca) y muestra el
  // ledger para confirmación humana.
  runCatalogRemediation(brand) {
    const all = typeof catalog !== "undefined" ? catalog : [];
    const items = brand && brand !== "ALL" ? all.filter(i => String(i.marca || "").trim() === brand) : all;
    if (!items.length) { if (typeof toast === "function") toast("No hay catálogo", "warning"); return; }
    const REM = typeof Remediation !== "undefined" ? Remediation : null;
    if (!REM || typeof REM.runRemediationPass !== "function") {
      if (typeof toast === "function") toast("Remediación no disponible", "error");
      return;
    }
    const cfg = (typeof RemediationConfig !== "undefined" && RemediationConfig.DEFAULT_REMEDIATION_CONFIG)
      ? RemediationConfig.DEFAULT_REMEDIATION_CONFIG
      : { enabled: true, strategies: {} };
    // Vista previa del diff antes de aplicar (spec process-catalog-quality):
    // los campos cambiados por SKU se muestran para confirmación humana.
    const antes = new Map((items || []).map(i => [i.sku, { modelo: i.modelo, variante: i.variante, fob: i.fob }]));
    const result = REM.runRemediationPass(items, {}, cfg);
    const promoted = (result.ledger || []).filter(e => e && e.promoted).length;
    window._qcDiff = (result.ledger || []).map(e => {
      const b = antes.get(e.sku) || {};
      const it = (items || []).find(i => i.sku === e.sku) || {};
      const d = {};
      for (const k of ["modelo", "variante", "fob"]) if (String(b[k] ?? "") !== String(it[k] ?? "")) d[k] = { antes: b[k], ahora: it[k] };
      return { sku: e.sku, reason: e.reason || e.originalReason || "", strategy: e.strategy || "", promoted: !!e.promoted, diff: d };
    });
    const body = document.getElementById("yellowReviewBody");
    if (body) {
      body.innerHTML = (window._qcDiff || []).map(d => {
        const diffs = Object.entries(d.diff || {}).map(([k, v]) => `${k}: ${String(v.antes ?? '')} → <b>${String(v.ahora ?? '')}</b>`).join(' · ');
        return `<tr>
        <td>${String(d.sku || '').replace(/</g,'&lt;')}</td>
        <td>${String(d.reason || '').replace(/</g,'&lt;')}</td>
        <td>${String(d.strategy || '').replace(/</g,'&lt;')}</td>
        <td style="color:${d.promoted ? '#34d399' : '#94a3b8'};">${d.promoted ? '✅ corregido' : 'sin evidencia'}</td>
        <td style="font-size:11px;color:var(--text-3);max-width:260px;">${diffs || '<span style=color:#94a3b8>sin cambios visibles</span>'}</td>
      </tr>`;
      }).join("");
    }
    const cnt = document.getElementById("yellowReviewCount");
    if (cnt) cnt.textContent = `${(result.ledger || []).length} evaluados (${brand === "ALL" ? "todo el catálogo" : brand}) · ${promoted} corregidos con evidencia`;
    // Aplicar: los items ya mutaron en el pass (in-place sobre catalog); persisti.
    const applyBtn = document.getElementById("yellowReviewApply");
    if (applyBtn) {
      applyBtn.style.display = promoted ? "inline-flex" : "none";
      applyBtn.onclick = () => {
        const modal = document.getElementById("yellowReviewModal");
        if (modal) modal.style.display = "none";
        if (typeof AppStorage !== "undefined" && typeof AppStorage.saveCatalog === "function") {
          AppStorage.saveCatalog(items, typeof selection !== "undefined" ? selection : {}).catch(e => {
            if (typeof toast === "function") toast('No se pudo guardar: ' + (e && e.message), 'error');
          });
        }
        if (typeof renderCatalog === "function") renderCatalog();
        if (typeof showCatalogContent === "function") showCatalogContent();
        if (typeof toast === "function") toast(promoted + ' productos corregidos con evidencia y guardados', 'success');
        document.getElementById("catalogQualityModal").style.display = "none";
      };
    }
    const modal = document.getElementById("yellowReviewModal");
    if (modal) modal.style.display = "flex";
  },

  // ── Perf sprint (perf-engineering): export JSON determinístico ──
  // Orden estable de campos (whitelist de extracción) + evidencia opcional;
  // NUNCA emite artefactos runtime (_imageRef/_selected/_previewValidation).
  // Contract en openspec/specs/perf-engineering/spec.md §2.
  buildCatalogExportJSON(items, opts = {}) {
    const scope = opts.scope === "preview" ? "preview" : "catalog";
    const images = opts.images === "none" ? "none" : "thumb";
    const pretty = opts.pretty !== false;
    const source = Array.isArray(items) ? items : [];
    const BASE = ["sku", "cat", "marca", "modelo", "variante", "color", "fob", "img", "status", "warnings", "confidence", "grounded", "sourceFile", "qualityReason"];
    const EXTRA = ["rawText", "cellRawText", "imgWarnings", "sourceWarnings", "_evaluations"];

    const out = [];
    for (const it of source) {
      if (!it || typeof it !== "object") continue;
      const row = {};
      for (const key of BASE) {
        if (key === "img" && images === "none") continue;
        if (key === "color" && it.color === undefined) continue;
        if (it[key] !== undefined) row[key] = it[key];
      }
      if (scope === "preview") {
        for (const key of EXTRA) {
          if (it[key] !== undefined && it[key] !== null) {
            if (Array.isArray(it[key]) && it[key].length === 0) continue;
            if (typeof it[key] === "string" && it[key].length === 0) continue;
            row[key] = it[key];
          }
        }
      }
      out.push(row);
    }
    return pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out);
  },

  // Export catalog as downloadable JSON file (perf-engineering): con opciones
  // si el modal existe (app real); default directo sin UI en harness/tests.
  exportCatalogJSON(opts) {
    if (!opts || typeof opts !== "object") {
      const modal = document && document.getElementById ? document.getElementById("exportJsonModal") : null;
      if (modal) { modal.style.display = "flex"; return; }
      opts = {};
    }
    const items = opts.scope === "preview" && typeof ImportFlow !== "undefined" && ImportFlow.pendingPreviewItems && ImportFlow.pendingPreviewItems.length
      ? ImportFlow.pendingPreviewItems
      : (typeof catalog !== "undefined" ? catalog : null);
    if (!items || !items.length) {
      if (typeof toast === "function") toast("No hay catálogo para exportar", "warning");
      return;
    }
    const data = CatalogValidator.buildCatalogExportJSON(items, opts);
    const scopeName = opts.scope === "preview" ? "preview" : "productos";
    FileImporter.download(data, `mambo-${scopeName}-${items.length}items-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    if (typeof toast === "function") {
      const withImgs = opts.images !== "none" ? " con imágenes" : "";
      toast(`📥 Catálogo exportado (${items.length}${withImgs}) → carpeta Descargas`, "success");
    }
  },

  // Lee el modal de opciones (exportJsonModal) y exporta.
  doExportCatalogJSON() {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    const opts = {
      scope: g("exportJsonScope") || "catalog",
      images: g("exportJsonImages") || "thumb",
      pretty: (g("exportJsonFormat") || "pretty") !== "compact",
    };
    const modal = document.getElementById("exportJsonModal");
    if (modal) modal.style.display = "none";
    CatalogValidator.exportCatalogJSON(opts);
  },



};

const CATALOG_VALIDATOR_CALIBRATION = { outlierLiteralCalibration: true };

if (typeof module !== "undefined" && module.exports) {
  module.exports = CatalogValidator;
}
if (typeof window !== "undefined") {
  window.CatalogValidator = CatalogValidator;
  // Perf sprint: export JSON con opciones (el botón llama exportCatalogJSON()).
  window.exportCatalogJSON = (opts) => CatalogValidator.exportCatalogJSON(opts);
  window.doExportCatalogJSON = () => CatalogValidator.doExportCatalogJSON();
  window.showCatalogQuality = () => CatalogValidator.showCatalogQuality();
  window.runCatalogRemediation = (brand) => CatalogValidator.runCatalogRemediation(brand);

  // Global console shortcut: auditCatalog() or auditCatalog(catalog)
  window.auditCatalog = function (products) {
    const items = products || (typeof catalog !== "undefined" ? catalog : null);
    if (!items || !items.length) {
      console.error(
        "No hay catálogo cargado. Pasá el array manualmente: auditCatalog(miArray)",
      );
      return null;
    }
    const brands =
      typeof customBrandsList !== "undefined" ? customBrandsList : [];
    const report = CatalogValidator.auditCatalog(items, brands);
    window.auditReport = report;
    report.printSummary();
    return report;
  };

  // Global console shortcut: fixCatalog() — auto-fix contamination in-place
  window.fixCatalog = function (products) {
    const items = products || (typeof catalog !== "undefined" ? catalog : null);
    if (!items || !items.length) {
      console.error("No hay catálogo cargado.");
      return null;
    }
    const brands =
      typeof customBrandsList !== "undefined" ? customBrandsList : [];
    const TS = typeof TextSanitizer !== "undefined" ? TextSanitizer : null;
    const CV = CatalogValidator;

    // Before stats
    const before = CV.auditCatalog(items, brands);
    console.log(
      `📊 ANTES: ${before.clean}/${before.total} limpios (${before.cleanPct}%) · ${before.issueCount} issues`,
    );

    // Use shared fix logic (single source of truth)
    const fixed = TS ? TS.fixItemsInPlace(items, brands) : 0;

    // Re-validate
    CV.runFullValidation(items);

    // After stats
    const after = CV.auditCatalog(items, brands);
    console.log(
      `📊 DESPUÉS: ${after.clean}/${after.total} limpios (${after.cleanPct}%) · ${after.issueCount} issues`,
    );
    console.log(`🔧 Productos corregidos: ${fixed}`);
    console.log(`📈 Mejora: ${before.cleanPct}% → ${after.cleanPct}% limpios`);

    if (after.topIssues.length > 0) {
      console.log("\n  ISSUES RESTANTES:");
      for (const t of after.topIssues.slice(0, 10)) {
        console.log(
          `    ${t.type.padEnd(25)} ${String(t.count).padStart(4)} (${t.pct}%)`,
        );
      }
    }

    // Save
    if (typeof AppStorage !== "undefined" && typeof catalog !== "undefined") {
      const sel = typeof selection !== "undefined" ? selection : {};
      AppStorage.saveCatalog(catalog, sel)
        .then(() => {
          console.log("💾 Catálogo guardado con las correcciones.");
        })
        .catch((e) => {
          console.warn("No se pudo guardar:", e);
          // persistence-fix: este comando deja el catalogo corregido en memoria; si el
          // guardado falla la UI muestra algo que no esta persistido. Aviso visible
          // ademas del log de consola.
          if (typeof toast === "function") {
            toast("No se pudo guardar el catálogo corregido: " + ((e && e.message) || e), "error");
          }
        });
    }

    window.auditReport = after;
    return { before, after, fixed };
  };

  // Run fixCatalog with UI feedback
  window.runFixCatalog = function () {
    if (typeof window.fixCatalog === "function") {
      const result = window.fixCatalog();
      if (result) {
        const msg = `🔧 Auto-fix: ${result.fixed} productos corregidos · ${result.before.cleanPct}% → ${result.after.cleanPct}% limpios`;
        if (typeof toast === "function") toast(msg, "success");
        // Refresh the catalog view
        if (typeof renderCatalog === "function") renderCatalog();
        if (typeof showCatalogContent === "function") showCatalogContent();
      }
    } else {
      if (typeof toast === "function")
        toast("fixCatalog no disponible", "error");
    }
  };

  // Run fix on preview items (before import) — uses shared fixItemsInPlace
  window.runFixOnPreview = function () {
    const IF = typeof ImportFlow !== "undefined" ? ImportFlow : null;
    if (!IF || !IF.pendingPreviewItems || !IF.pendingPreviewItems.length) {
      if (typeof toast === "function")
        toast("No hay productos en preview", "warning");
      return;
    }
    const items = IF.pendingPreviewItems;
    const TS = typeof TextSanitizer !== "undefined" ? TextSanitizer : null;
    const brands =
      typeof customBrandsList !== "undefined" ? customBrandsList : [];

    const fixed = TS ? TS.fixItemsInPlace(items, brands) : 0;

    // Re-validate and re-render
    const validation = CatalogValidator.runFullValidation(items);
    validation.rejected.forEach((p) => {
      p._selected = false;
    });
    window._previewValidation = validation;
    IF.renderImportPreviewModal(validation);

    const msg = `🔧 Auto-fix: ${fixed} productos corregidos en preview`;
    if (typeof toast === "function") toast(msg, "success");
  };
}
