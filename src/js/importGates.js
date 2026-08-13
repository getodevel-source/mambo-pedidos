/**
 * ImportGates — the single composed verification seam for the import pipeline
 * and the batch export (Slice 1, catalog-reliability-verification).
 *
 * Today `importFlow.js` calls `CatalogValidator.runFullValidation` at 6 sites
 * and `export-catalog-batch.js` calls nothing; `CatalogAssignmentGates.runAll`
 * runs only in `scripts/measure-catalog-assignment.js`. This module makes the
 * preview semaphore identical to the import-time semaphore and to the
 * batch-export semaphore ("GREEN = reliable").
 *
 * Composition order is FIXED (validation → image-text → assignment):
 *  1. CatalogValidator.runFullValidation(items)   # R1-R10 + _statFlag advisory + IQR×3 outliers
 *  2. ImageTextGates.runAll(items)                # interior color + category-aspect
 *  3. CatalogAssignmentGates.runAll(items)        # cross-cat/cross-brand/placeholder + model quality
 *
 * Gates only degrade (GREEN→YELLOW), never promote. `runFullValidation` runs
 * FIRST because it rebuilds `p.warnings`; later gate warnings therefore survive.
 * Products are cloned by the gates (spread preserves `_selected` and evidence);
 * callers swap their array with `result.products` and the split (accepted /
 * review / rejected) is recomputed AFTER the gates.
 *
 * Browser-global + CommonJS compatible (same convention as the other modules).
 */
const ImportGates = {
  /** True when any image-text/assignment gate flagged the product. */
  isGateFlagged(item) {
    return (
      Array.isArray(item && item._imgTextWarnings) &&
      item._imgTextWarnings.length > 0
    );
  },

  /**
   * Runs the full verification chain over the items and returns the final
   * split over the gated product clones.
   * @param {Array} items
   * @returns {{accepted:Array, review:Array, rejected:Array, stats:Object, products:Array}}
   */
  runImportVerification(items) {
    const products = (Array.isArray(items) ? items : []).slice();

    // 1. Deterministic cross-validation + catalog stats. Rebuilds p.warnings,
    //    so it MUST run before the gates append theirs.
    if (typeof CatalogValidator !== "undefined") {
      CatalogValidator.runFullValidation(products);
    }

    // 2. Image-text gates (interior color, category-aspect).
    if (typeof ImageTextGates !== "undefined") {
      const afterImages = ImageTextGates.runAll(products);
      products.length = 0;
      products.push(...afterImages.products);
    }

    // 3. Assignment gates (cross-category/cross-brand sharing, placeholder,
    //    model quality).
    if (typeof CatalogAssignmentGates !== "undefined") {
      const afterAssignment = CatalogAssignmentGates.runAll(products);
      products.length = 0;
      products.push(...afterAssignment.products);
    }

    // 4. Reason instrumentation (Slice 1, config-gated reasonInstrumentation):
    //    every YELLOW/RED transition must carry an atomic reason; a degradation
    //    without one is a pipeline defect (UNCLASSIFIED_YELLOW), never promoted.
    //    Re-diagnosis: NO_OBSERVATIONS -> 0.
    if (IMPORT_GATES_CALIBRATION.reasonInstrumentation) {
      ImportGates.instrumentReasons(products);
    }

    // Split recomputed AFTER the gates: accepted/review/rejected reference the
    // final clones so a gate-flagged product never stays in `accepted`.
    const accepted = products.filter((p) => p.status === "GREEN");
    const review = products.filter((p) => p.status === "YELLOW");
    const rejected = products.filter((p) => p.status === "RED");
    for (const p of products) {
      p.importable = p.status !== "RED";
      p.qualityReason = (p.warnings && p.warnings[0]) || "Sin observaciones";
    }

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
      products,
    };
  },

  /**
   * Deriva el código de razón ATÓMICO de un ítem no-GREEN (Slice 1,
   * gate-calibration). Evidencia estructurada PRIMERO (_modelQuality.marketing,
   * _imgTextWarnings.type, _outlierEvidence, grounding), fallback de cadena en
   * español para razones legacy. Sin razón derivable → "UNCLASSIFIED_YELLOW"
   * (defecto de pipeline). Slice 2 (remediation.js deriveReasonCode) reusa
   * esta misma fuente.
   * @param {Object} item
   * @returns {string}
   */
  deriveReasonCode(item) {
    if (!item) return "UNCLASSIFIED_YELLOW";

    // 1. Clasificación de marketing calibrada (evidencia estructurada).
    const mq = item._modelQuality;
    if (mq && mq.marketing) {
      if (mq.marketing.class === "switch-axis") return "SWITCH_IN_MODEL";
      if (
        mq.marketing.class === "puffery" ||
        mq.marketing.class === "marketing-only"
      )
        return "MODEL_MARKETING";
    }

    // 2. Evidencia de gates de imagen/texto.
    const itw = Array.isArray(item._imgTextWarnings)
      ? item._imgTextWarnings
      : [];
    for (const w of itw) {
      const t = w && w.type;
      if (t === "color-mismatch") return "COLOR_MISMATCH";
      if (t === "category-aspect") return "ASPECT_MISMATCH";
      if (t === "cross-category" || t === "cross-brand") return "SHARED_IMAGE";
      if (t === "generic-model" || t === "ambiguous-model")
        return "MODEL_GENERIC_WORD";
      if (t === "template-model") return "MODEL_TEMPLATE";
      if (t === "truncated-model") return "MODEL_TRUNCATED";
      if (t === "mid-model-type-keyword" || t === "bare-type-word-model")
        return "MODEL_TYPE_GLUED";
      if (t === "doubtful-category") return "CATEGORY_DOUBTFUL";
      if (t === "placeholder-image") return "IMAGE_MISSING";
    }

    // 3. Evidencia de outlier de precio.
    if (item._outlierEvidence) return "OUTLIER_PRICE";

    // 4. Evidencia de grounding del FOB (falso grounding = vecino/fusionado).
    if (item.grounded === false) {
      const reason = String(item.groundingReason || "");
      if (/vecina|neighbor/i.test(reason)) return "FOB_NEIGHBOR_ANCHOR";
      if (/alinead|misalign/i.test(reason)) return "FOB_UNALIGNED";
      return "FOB_NO_LITERAL_EVIDENCE";
    }

    // 5. Fallback de cadena en español (razones legacy de los 3 layers).
    const warnings = Array.isArray(item.warnings) ? item.warnings : [];
    for (const w of warnings) {
      const code = ImportGates._warningToReasonCode(String(w));
      if (code === "MODEL_TRUNCATED") {
        // The legacy warning may persist after a parse fix: only treat
        // the model as truncated if a bracket is REALLY unclosed now.
        const m = String((item && item.modelo) || "");
        if (/[({[]/.test(m) && !/[)}\]]/.test(m)) return "MODEL_TRUNCATED";
        continue;
      }
      if (code) return code;
    }

    // COLOR_AMBIGUOUS is WATCH-level (no status change by itself): last
    // priority so a real degradation reason (model, FOB, outlier) wins.
    const itw2 = Array.isArray(item._imgTextWarnings) ? item._imgTextWarnings : [];
    for (const w of itw2) {
      if (w && w.type === "color-ambiguous") return "COLOR_AMBIGUOUS";
    }

    return "UNCLASSIFIED_YELLOW";
  },

  /**
   * Instrumenta las razones atómicas sobre los productos ya compuestos (los 3
   * layers corrieron). Todo ítem no-GREEN queda con `_atomicReason`; un ítem
   * sin razón derivable es un DEFECTO de pipeline → UNCLASSIFIED_YELLOW con la
   * razón en español 'Degradación sin razón atómica' (nunca promovido).
   * @param {Array} products
   * @returns {{unclassified:number}}
   */
  instrumentReasons(products) {
    let unclassified = 0;
    for (const p of Array.isArray(products) ? products : []) {
      if (!p || p.status === "GREEN") continue;
      const code = ImportGates.deriveReasonCode(p);
      if (code === "UNCLASSIFIED_YELLOW") {
        unclassified++;
        p._atomicReason = "UNCLASSIFIED_YELLOW";
        p.status = "YELLOW"; // defecto de pipeline: nunca promovido
        if (!Array.isArray(p.warnings)) p.warnings = [];
        if (!p.warnings.includes("Degradación sin razón atómica")) {
          p.warnings.unshift("Degradación sin razón atómica");
        }
      } else {
        p._atomicReason = code;
      }
      if (!Array.isArray(p.warnings)) p.warnings = [];
      p.qualityReason = p.warnings[0] || "Sin observaciones";
    }
    return { unclassified };
  },

  /**
   * Invariante de instrumentación: todo ítem no-GREEN lleva `_atomicReason` y
   * su qualityReason nunca es "Sin observaciones" (NO_OBSERVATIONS = 0).
   * @param {Array} products
   * @returns {boolean}
   */
  assertAtomicReasons(products) {
    for (const p of Array.isArray(products) ? products : []) {
      if (!p || p.status === "GREEN") continue;
      if (!p._atomicReason) return false;
      if (/sin observaciones/i.test(String(p.qualityReason || "")))
        return false;
    }
    return true;
  },

  /**
   * Mapa de cadenas de warning en español → código de razón atómico estable
   * (claves de evidencia en inglés). Las reglas van de la más específica a la
   * más general.
   */
  _warningToReasonCode(w) {
    const t = String(w || "");
    const RULES = [
      [/sin razón atómica/i, "UNCLASSIFIED_YELLOW"],
      [/el modelo incluye el tipo de switch\/axis/i, "SWITCH_IN_MODEL"],
      [/palabras de marketing/i, "MODEL_MARKETING"],
      [/tipo de conexión y categoría/i, "MODEL_TYPE_GLUED"],
      [/keyword de categoría dentro del modelo/i, "MODEL_TYPE_GLUED"],
      [
        /modelo es solo una palabra de tipo\/categoría/i,
        "MODEL_TYPE_WORD_ONLY",
      ],
      [/modelo es texto de plantilla/i, "MODEL_TEMPLATE"],
      [/palabra genérica/i, "MODEL_GENERIC_WORD"],
      [/modelo genérico sin nombre de producto/i, "MODEL_GENERIC_WORD"],
      [/modelo ambiguo/i, "MODEL_GENERIC_WORD"],
      [/modelo truncado/i, "MODEL_TRUNCATED"],
      [
        /categoría\/fragmento de especificación sin código real/i,
        "SPEC_FRAGMENT",
      ],
      [/el código del producto no llegó al modelo/i, "MODEL_LOST_CODE"],
      [/color de imagen ambiguo/i, "COLOR_AMBIGUOUS"],
      [/no coincide con el producto/i, "COLOR_MISMATCH"],
      [/imagen ancha|imagen angosta/i, "ASPECT_MISMATCH"],
      [/imagen compartida entre categorías/i, "SHARED_IMAGE"],
      [/imagen compartida entre marcas/i, "SHARED_IMAGE"],
      [/sin imagen de producto/i, "IMAGE_MISSING"],
      [/outlier de precio/i, "OUTLIER_PRICE"],
      [/categoría minoritaria/i, "MINORITY_CATEGORY"],
      [/categoría dudosa/i, "CATEGORY_DOUBTFUL"],
      [/precio \$\d+ fuera de rango/i, "PRICE_RANGE"],
      [/fob sin evidencia literal/i, "FOB_NO_LITERAL_EVIDENCE"],
      [/ancla de fila vecina/i, "FOB_NEIGHBOR_ANCHOR"],
      [/ancla no alineada/i, "FOB_UNALIGNED"],
      [/evidencia de grounding insuficiente/i, "FOB_UNGROUNDED"],
      [/modelo = specs técnicas/i, "MODEL_SPECS"],
      [/modelo vacío/i, "MODEL_EMPTY"],
      [/modelo es ruido/i, "MODEL_GARBAGE"],
      [/modelo es un precio numérico/i, "MODEL_PRICE_TOKEN"],
      [/modelo es ruido corporativo/i, "MODEL_CORPORATE_NOISE"],
      [/sku vacío|sku inválido/i, "SKU_INVALID"],
      [/fob inválido/i, "FOB_INVALID"],
      [/no fabrica/i, "BRAND_CATEGORY_MISMATCH"],
      [/categoría no clasificada/i, "CATEGORY_UNCLASSIFIED"],
      [/marca no detectada/i, "BRAND_MISSING"],
      [/modelo y variante idénticos/i, "MODEL_VARIANT_DUPLICATE"],
      [/variante es un precio/i, "VARIANT_PRICE"],
    ];
    for (const [re, code] of RULES) {
      if (re.test(t)) return code;
    }
    return null;
  },

  /**
   * Actualiza los flags de calibración (Slice 1). Slice 2 los consolida en
   * remediationConfig.js; apagar reasonInstrumentation restaura la composición
   * pre-calibración (qualityReason fallback "Sin observaciones").
   * @returns {{reasonInstrumentation:boolean}}
   */
  setCalibrationFlags(flags) {
    if (flags && typeof flags === "object") {
      for (const key of Object.keys(IMPORT_GATES_CALIBRATION)) {
        if (typeof flags[key] === "boolean")
          IMPORT_GATES_CALIBRATION[key] = flags[key];
      }
    }
    return { ...IMPORT_GATES_CALIBRATION };
  },

  reasonInstrumentationEnabled() {
    return IMPORT_GATES_CALIBRATION.reasonInstrumentation;
  },
};

// Slice 1 (gate-calibration): flag de instrumentación de razones (default ON;
// Slice 2 lo consolida en remediationConfig.js).
const IMPORT_GATES_CALIBRATION = { reasonInstrumentation: true };

if (typeof window !== "undefined") window.ImportGates = ImportGates;
if (typeof module !== "undefined") module.exports = ImportGates;
