/**
 * CatalogAssignmentGates — post-processing assignment quality gates.
 *
 * Operates on the exported catalog shape (sku, cat, marca, modelo, variante,
 * fob, img, status, warnings, ...) without rewriting the parser. Three duties:
 *
 *   1. Image assignment integrity: an image shared across distinct categories
 *      is always an assignment error; an image shared across distinct brands
 *      is allowed only when brand + model + category match exactly (verified
 *      rebrand); a placeholder ("-" or invalid) must never validate GREEN.
 *   2. Model name quality: template/header text is never a valid model; bare
 *      color/status words are suspect; truncated models (unbalanced
 *      parentheses) are flagged; real duplicates (brand+model+cat+FOB) are
 *      reported.
 *   3. Assignment metrics: machine-verifiable counts and rates for the audit.
 *
 * Browser-global + CommonJS compatible (same convention as other modules).
 */

const PLACEHOLDER_IMAGE = '-';

const TEMPLATE_MODEL_PATTERNS = [
  /product picture/i,
  /model\s*no\.?\s*#?/i,
  /technical\s+parameters?/i,
  /specification/i,
  /specs?\b/i,
  /^image/i,
];

const BARE_COLOR_WORDS = [
  'black', 'white', 'grey', 'gray', 'purple', 'violet', 'red', 'pink', 'blue',
  'green', 'silver', 'gold', 'orange', 'cyan', 'teal', 'lavender', 'rose',
  'yellow', 'brown', 'cream', 'beige', 'navy',
];

const BARE_STATUS_WORDS = ['released', 'new', 'upcoming', 'coming soon', 'sold out'];

// Words that are real product-line names for some brands (ATK Air/Pearl/Lake,
// Attack Shark Star/Starlight, 8bitdo Retro 87/108) but meaningless as a
// standalone model. Contextual: most are only WATCH-listed (audit, no status
// change); only the truly generic ones degrade to YELLOW.
const AMBIGUOUS_MODEL_WORDS = ['standard', 'bill', 'business'];

// Real-looking product-line words: reported in the audit but never change
// status (a one-word model like "Air" or "Lake" is a valid ATK product line).
const WATCH_MODEL_WORDS = [
  'magnetic', 'star', 'starry', 'ultra', 'max', 'extreme', 'starlight', 'lake',
  'pearl', 'lemon', 'lilac', 'air', 'pro', 'plus', 'lite', 'mini',
  'classic', 'retro', 'ultra',
];

// Keywords de tipo/categoría que pertenecen a la variante, nunca al modelo.
// Misma lista que el sanitizer (PdfParser.moveTrailingTypeKeyword): si una
// aparece ADENTRO del modelo (no como última palabra — esa ya la mueve el
// sanitizer) la extracción mezcló el tipo en el modelo → fail-closed YELLOW.
// Con \b para no matchear compuestos ('ShadowSwitch', 'LatteSwitch',
// 'Standard', 'Keyboards').
const TYPE_KEYWORDS_RE = /\b(mouse|keyboard|controller|headset|earphone|earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|adapter|cable|stand|gamepad|dock|receiver)\b/i;

const CatalogAssignmentGates = {
  PLACEHOLDER_IMAGE,
  TEMPLATE_MODEL_PATTERNS,
  BARE_COLOR_WORDS,
  BARE_STATUS_WORDS,
  AMBIGUOUS_MODEL_WORDS,
  WATCH_MODEL_WORDS,
  TYPE_KEYWORDS_RE,

  /** Normalized image identity: only real data URLs participate in sharing checks. */
  imageIdentity(img) {
    if (typeof img !== 'string') return null;
    if (img === PLACEHOLDER_IMAGE || img === '') return null;
    if (/^data:image\//i.test(img)) return img;
    return null;
  },

  hasRealImage(product) {
    return this.imageIdentity(product && product.img) !== null;
  },

  /** Normalized duplicate key: brand + category + model + variant + FOB.
   * Variant is included so color variants of the same model+price are NOT
   * reported as duplicates — only truly repeated rows (same everything). */
  duplicateKey(product) {
    return [
      String(product.marca || '').trim().toLowerCase(),
      String(product.cat || '').trim().toUpperCase(),
      String(product.modelo || '').trim().toLowerCase().replace(/\s+/g, ' '),
      String(product.variante || '').trim().toLowerCase().replace(/\s+/g, ' '),
      typeof product.fob === 'number' ? product.fob : null,
    ].join('|');
  },

  /** True when the model is template/header text copied from the PDF. */
  isTemplateModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const text = modelo.trim();
    for (const pattern of this.TEMPLATE_MODEL_PATTERNS) {
      if (pattern.test(text)) return true;
    }
    return false;
  },

  /** True when the model is a bare color or status word (no product name). */
  isBareGenericModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const text = modelo.trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /\s/.test(text)) return false; // more than one word: not a bare word
    return this.BARE_COLOR_WORDS.includes(text) || this.BARE_STATUS_WORDS.includes(text);
  },

  /** True when the model is an ambiguous single word (flagged, not rejected). */
  isAmbiguousModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const text = modelo.trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /\s/.test(text)) return false;
    return this.AMBIGUOUS_MODEL_WORDS.includes(text);
  },

  /** True when the model is a plausible product-line word (audit only). */
  isWatchModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const text = modelo.trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /\s/.test(text)) return false;
    return this.WATCH_MODEL_WORDS.includes(text);
  },

  /** True when the model has unbalanced parentheses (truncated). */
  isTruncatedModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const open = (modelo.match(/\(/g) || []).length;
    const close = (modelo.match(/\)/g) || []).length;
    return open > close;
  },

  /** True when the model is a single bare type/category word (e.g. 'Receiver', 'Keyboard'). */
  isBareTypeWordModel(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const text = modelo.trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /\s/.test(text)) return false;
    return this.TYPE_KEYWORDS_RE.test(text);
  },

  /**
   * True when a standalone type keyword appears INSIDE the model (not as the
   * last word — the sanitizer moves trailing keywords to the variant). Uses
   * word boundaries so compounds ('ShadowSwitch', 'LatteSwitch', 'Standard',
   * 'Keyboards') never match.
   */
  isMidModelTypeKeyword(modelo) {
    if (typeof modelo !== 'string' || !modelo.trim()) return false;
    const words = modelo.trim().split(/\s+/);
    if (words.length < 2) return false;
    return this.TYPE_KEYWORDS_RE.test(words.slice(0, -1).join(' '));
  },

  /**
   * Slice 1 — image assignment integrity.
   * Mutates a copy of products. Returns { products, changes }.
   */
  applyImageIntegrityGates(products) {
    const result = products.map(p => ({ ...p, warnings: Array.isArray(p.warnings) ? [...p.warnings] : [] }));
    const changes = [];

    // --- cross-category sharing: always an error ---
    const byImage = new Map();
    for (const p of result) {
      const identity = this.imageIdentity(p.img);
      if (!identity) continue;
      if (!byImage.has(identity)) byImage.set(identity, []);
      byImage.get(identity).push(p);
    }

    for (const [identity, group] of byImage) {
      const cats = new Set(group.map(p => String(p.cat || '').toUpperCase()));
      if (cats.size <= 1) continue;

      // Keep the image on the product whose category matches the aspect-ratio
      // convention when derivable from the image itself; otherwise keep the
      // first in order and detach the rest. Without pixel evidence we cannot
      // score deeper — every detach is surfaced in the audit.
      const [keeper, ...others] = group;
      for (const p of others) {
        p.img = PLACEHOLDER_IMAGE;
        if (!p.warnings.includes('Imagen compartida entre categorías (asignación inválida)')) {
          p.warnings.push('Imagen compartida entre categorías (asignación inválida)');
        }
        changes.push({ sku: p.sku, type: 'cross-category-image', detail: `img compartida entre ${[...cats].join(', ')}` });
      }
      if (others.length > 0) {
        keeper._crossCategoryKeeper = true;
      }
    }

    // --- cross-brand sharing: allowed only when model+category match exactly ---
    // (verified rebrand, e.g. Irok/Mars "Mer68 Max" — same factory, same photo).
    // Brand is deliberately NOT part of the identity key: a rebrand is exactly
    // when the brand differs and the model is identical.
    for (const [identity, group] of byImage) {
      const brands = new Set(group.map(p => String(p.marca || '').trim().toLowerCase()));
      if (brands.size <= 1) continue;

      // Group by model+cat (no brand): one group = verified rebrand, keep all.
      const identityGroups = new Map();
      for (const p of group) {
        const key = [
          String(p.modelo || '').trim().toLowerCase().replace(/\s+/g, ' '),
          String(p.cat || '').toUpperCase(),
        ].join('|');
        if (!identityGroups.has(key)) identityGroups.set(key, []);
        identityGroups.get(key).push(p);
      }

      const keys = [...identityGroups.keys()];
      if (keys.length === 1) continue; // same model+cat across brand aliases: fine

      // Different models share the image across brands: detach all but the
      // largest group (assumed origin brand), keep the rest flagged.
      let bestKey = null;
      let bestSize = -1;
      for (const key of keys) {
        if (identityGroups.get(key).length > bestSize) { bestSize = identityGroups.get(key).length; bestKey = key; }
      }
      for (const key of keys) {
        if (key === bestKey) continue;
        for (const p of identityGroups.get(key)) {
          p.img = PLACEHOLDER_IMAGE;
          if (!p.warnings.includes('Imagen compartida entre marcas sin identidad de modelo (asignación inválida)')) {
            p.warnings.push('Imagen compartida entre marcas sin identidad de modelo (asignación inválida)');
          }
          changes.push({ sku: p.sku, type: 'cross-brand-image', detail: `marca ${p.marca} comparte img con otra marca sin mismo modelo` });
        }
      }
    }

    // --- placeholder policy: never GREEN ---
    for (const p of result) {
      if (this.hasRealImage(p)) continue;
      if (p.status === 'GREEN') {
        p.status = 'YELLOW';
        if (!p.warnings.includes('Sin imagen')) p.warnings.push('Sin imagen');
        changes.push({ sku: p.sku, type: 'placeholder-image', detail: 'status GREEN → YELLOW (sin imagen real)' });
      }
    }

    // --- weak image match policy: fail-closed, never GREEN on weak evidence ---
    // Los imgWarnings de VALIDACIÓN VISUAL (monocromática, color mismatch,
    // shape aceptada en backfill) se conservan VISIBLES en el preview, pero NO
    // degradan el semáforo: medidos sobre el corpus, generan falsos positivos
    // masivos (fotos de producto reales sobre fondo liso disparan el detector
    // de monocromática; fotos combo mouse+teclado SILVER/GRAY disparan el de
    // color). El fail-closed FIABLE de imagen es el que ya cubren las otras
    // gates: R9 duro (sin imagen → YELLOW vía catalogValidator), integridad
    // cross-categoría/cross-marca (foto compartida → YELLOW), placeholder.
    // Degradar por señales heurísticas volvería el semáforo inutilizable
    // (1072 YELLOW medidos en la iteración 1 — recalibrado acá).

    return { products: result, changes };
  },

  /**
   * Slice 2 — model name quality.
   * Template/header text must not validate GREEN; bare generic words degrade to
   * YELLOW; truncated models stay YELLOW; duplicates are flagged in the audit.
   */
  applyModelQualityGates(products) {
    const result = products.map(p => ({ ...p, warnings: Array.isArray(p.warnings) ? [...p.warnings] : [] }));
    const changes = [];

    for (const p of result) {
      const modelo = p.modelo || '';

      if (this.isTemplateModel(modelo)) {
        if (p.status === 'GREEN' || p.status === 'YELLOW') {
          p.status = 'RED';
          p.importable = false;
        }
        if (!p.warnings.includes('Modelo es texto de plantilla/encabezado del PDF')) {
          p.warnings.push('Modelo es texto de plantilla/encabezado del PDF');
        }
        changes.push({ sku: p.sku, type: 'template-model', detail: `modelo "${modelo}"` });
        continue;
      }

      if (this.isBareGenericModel(modelo)) {
        if (p.status === 'GREEN') {
          p.status = 'YELLOW';
        }
        if (!p.warnings.includes('Modelo genérico sin nombre de producto')) {
          p.warnings.push('Modelo genérico sin nombre de producto');
        }
        changes.push({ sku: p.sku, type: 'generic-model', detail: `modelo "${modelo}"` });
        continue;
      }

      if (this.isAmbiguousModel(modelo)) {
        if (p.status === 'GREEN') {
          p.status = 'YELLOW';
        }
        if (!p.warnings.includes('Modelo ambiguo (palabra única sin contexto)')) {
          p.warnings.push('Modelo ambiguo (palabra única sin contexto)');
        }
        changes.push({ sku: p.sku, type: 'ambiguous-model', detail: `modelo "${modelo}"` });
        continue;
      }

      // Fail-closed (WS1): keyword de tipo ADENTRO del modelo (no al final — esa
      // la mueve el sanitizer a variante) Y el modelo lleva un código (dígito)
      // → la extracción mezcló el tipo en el modelo ('Keyboard F75', 'Mouse
      // G102', 'Ice Silve Switch PA12'). Sin dígito NO se degrada: 'Retro
      // Receiver Saturn', 'Charging Dock Xbox' y los nombres de switch Haimu
      // son líneas de producto reales (0 falsos positivos).
      if (this.isMidModelTypeKeyword(modelo) && /\d/.test(modelo)) {
        // Excepción: para cat SWITCH, 'Switch' en el modelo es el nombre de
        // línea (Haimu 'Ice Silver Switch PA12') — solo degrada si el modelo
        // EMPIEZA con specs numéricas ('3.0 0.50mn Switch 44 55' = basura).
        const isSwitchLine = /switch/i.test(modelo) && String(p.cat || '').toUpperCase() === 'SWITCH' && !/^\s*\d/.test(modelo);
        if (isSwitchLine) {
          changes.push({ sku: p.sku, type: 'watch-model', detail: `modelo "${modelo}" (línea de switch con Switch en el nombre)` });
          continue;
        }
        if (p.status === 'GREEN') {
          p.status = 'YELLOW';
        }
        if (!p.warnings.includes('Keyword de categoría dentro del modelo (contaminación)')) {
          p.warnings.push('Keyword de categoría dentro del modelo (contaminación)');
        }
        changes.push({ sku: p.sku, type: 'mid-model-type-keyword', detail: `modelo "${modelo}"` });
        continue;
      }

      // Fail-closed (WS1): modelo es SOLO una palabra de tipo/categoría
      // ('Receiver', 'Keyboard', 'Switch') — no es un nombre de producto.
      if (this.isBareTypeWordModel(modelo)) {
        if (p.status === 'GREEN') {
          p.status = 'YELLOW';
        }
        if (!p.warnings.includes('Modelo es solo una palabra de tipo/categoría')) {
          p.warnings.push('Modelo es solo una palabra de tipo/categoría');
        }
        changes.push({ sku: p.sku, type: 'bare-type-word-model', detail: `modelo "${modelo}"` });
        continue;
      }

      if (this.isWatchModel(modelo)) {
        // No cambia status: solo se reporta en el audit (puede ser una línea real).
        changes.push({ sku: p.sku, type: 'watch-model', detail: `modelo "${modelo}"` });
        continue;
      }

      if (this.isTruncatedModel(modelo)) {
        // Repair: split "F87 (light" into model "F87" + variant "light" — the
        // truncated parenthesis belongs to the variant, not the model.
        const parenIdx = modelo.indexOf('(');
        if (parenIdx > 0) {
          const baseModel = modelo.slice(0, parenIdx).trim();
          const tail = modelo.slice(parenIdx).trim();
          p.modelo = baseModel;
          p.variante = (tail + ' ' + String(p.variante || '')).replace(/\s+/g, ' ').trim();
          changes.push({ sku: p.sku, type: 'truncated-model-repaired', detail: `"${modelo}" -> modelo "${baseModel}", variante "${tail}"` });
        } else if (parenIdx === 0) {
          // '(' AL INICIO: todo el contenido es variante; el modelo real es el
          // token con formato de código adentro ('(Light AF82 screen' -> modelo
          // 'AF82', variante 'Light screen'). Sin token con dígitos -> YELLOW
          // (es una nota, no un modelo: '(Extra keycap need be purchased').
          const inner = modelo.slice(1).trim();
          const codeMatch = inner.match(/\b[A-Za-z][A-Za-z0-9]*\s?\d{1,4}[A-Za-z0-9-]*\b/);
          if (codeMatch) {
            const baseModel = codeMatch[0].trim();
            p.modelo = baseModel;
            const rest = inner.replace(codeMatch[0], '').replace(/\s+/g, ' ').trim();
            p.variante = (rest + ' ' + String(p.variante || '')).replace(/\s+/g, ' ').trim();
            changes.push({ sku: p.sku, type: 'truncated-model-repaired', detail: `"${modelo}" -> modelo "${baseModel}", variante "${p.variante}"` });
          } else {
            if (p.status === 'GREEN') {
              p.status = 'YELLOW';
            }
            if (!p.warnings.includes('Modelo truncado (paréntesis sin cerrar)')) {
              p.warnings.push('Modelo truncado (paréntesis sin cerrar)');
            }
            changes.push({ sku: p.sku, type: 'truncated-model', detail: `modelo "${modelo}"` });
          }
        } else {
          if (p.status === 'GREEN') {
            p.status = 'YELLOW';
          }
          if (!p.warnings.includes('Modelo truncado (paréntesis sin cerrar)')) {
            p.warnings.push('Modelo truncado (paréntesis sin cerrar)');
          }
          changes.push({ sku: p.sku, type: 'truncated-model', detail: `modelo "${modelo}"` });
        }
      }

      // Fail-closed (B3): categoría dudosa — GREEN con cat OTRO no tiene
      // evidencia de tipo en absoluto. (Una regla literal "sin keyword de tipo
      // en modelo+variante" fue evaluada y descartada: degradaría 1141/2315
      // productos reales cuya categoría viene de patrones de código — AK820
      // Pro, AJ139 Pro, 8BitDo Ultimate — violando la política de 0 falsos
      // positivos.)
      if (p.status === 'GREEN' && String(p.cat || '').toUpperCase() === 'OTRO') {
        p.status = 'YELLOW';
        if (!p.warnings.includes('Categoría dudosa: OTRO sin evidencia de tipo')) {
          p.warnings.push('Categoría dudosa: OTRO sin evidencia de tipo');
        }
        changes.push({ sku: p.sku, type: 'doubtful-category', detail: 'cat OTRO sin keyword de tipo' });
      }
    }

    return { products: result, changes };
  },

  /** Slice 2b — duplicate detection (report only, no merge). */
  detectDuplicates(products) {
    const groups = new Map();
    for (const p of products) {
      const key = this.duplicateKey(p);
      if (key === '|||') continue; // empty identity
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const duplicates = [];
    for (const [key, group] of groups) {
      if (group.length > 1) {
        duplicates.push({ key, count: group.length, skus: group.map(p => p.sku), fob: group[0].fob });
      }
    }
    return duplicates;
  },

  /** Slice 3 — assignment metrics over the (already gated) catalog. */
  computeMetrics(products) {
    const total = products.length;
    const withImage = products.filter(p => this.hasRealImage(p)).length;
    const placeholder = total - withImage;

    const byImage = new Map();
    for (const p of products) {
      const identity = this.imageIdentity(p.img);
      if (!identity) continue;
      if (!byImage.has(identity)) byImage.set(identity, []);
      byImage.get(identity).push(p);
    }

    let crossCategory = 0;
    let crossBrandNoIdentity = 0;
    let sharedImages = 0;
    let sharedProductCount = 0;
    for (const [identity, group] of byImage) {
      const cats = new Set(group.map(p => String(p.cat || '').toUpperCase()));
      const brands = new Set(group.map(p => String(p.marca || '').trim().toLowerCase()));
      if (group.length > 1) { sharedImages += 1; sharedProductCount += group.length; }
      if (cats.size > 1) crossCategory += 1;
      if (brands.size > 1) {
        const keys = new Set(group.map(p => [
          String(p.modelo || '').toLowerCase().replace(/\s+/g, ' '),
          String(p.cat || '').toUpperCase(),
        ].join('|')));
        if (keys.size > 1) crossBrandNoIdentity += 1;
      }
    }

    const generic = products.filter(p => this.isTemplateModel(p.modelo) || this.isBareGenericModel(p.modelo)).length;
    const ambiguous = products.filter(p => this.isAmbiguousModel(p.modelo)).length;
    const watch = products.filter(p => this.isWatchModel(p.modelo)).length;
    const truncated = products.filter(p => this.isTruncatedModel(p.modelo)).length;
    const duplicates = this.detectDuplicates(products);

    const status = { GREEN: 0, YELLOW: 0, RED: 0 };
    for (const p of products) {
      const s = p.status || 'YELLOW';
      if (status[s] !== undefined) status[s] += 1; else status.YELLOW += 1;
    }

    return {
      total,
      withImage,
      placeholder,
      placeholderRate: total ? placeholder / total : 0,
      uniqueImages: byImage.size,
      sharedImages,
      sharedProductCount,
      crossCategory,
      crossBrandNoIdentity,
      genericModels: generic,
      ambiguousModels: ambiguous,
      watchModels: watch,
      truncatedModels: truncated,
      duplicateGroups: duplicates.length,
      duplicateProducts: duplicates.reduce((acc, d) => acc + d.count, 0),
      status,
    };
  },

  /** Convenience: run everything over a catalog (metrics + gates + metrics). */
  runAll(products) {
    const before = this.computeMetrics(products);
    const afterImages = this.applyImageIntegrityGates(products);
    const afterModels = this.applyModelQualityGates(afterImages.products);
    const after = this.computeMetrics(afterModels.products);
    return {
      before,
      after,
      changes: [...afterImages.changes, ...afterModels.changes],
      products: afterModels.products,
      duplicates: afterModels.products ? this.detectDuplicates(afterModels.products) : [],
    };
  },
};

if (typeof window !== 'undefined') window.CatalogAssignmentGates = CatalogAssignmentGates;
if (typeof module !== 'undefined') module.exports = CatalogAssignmentGates;
