/**
 * Mambo Pedidos - Motor Determinístico de Sanitización y Limpieza de Catálogos (TextSanitizer)
 *
 * Sanitizador puro y ultra rápido de datos de productos.
 * Remueve ruido corporativo, palabras de encabezado, contaminación de precios y caracteres inválidos.
 * Cero dependencias externas. Cero simulación de IA. 100% confiable y ejecutable en runtime.
 */

const TextSanitizer = {
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

  KNOWN_BRANDS: [
    'REDRAGON',
    'LOGITECH',
    'RAZER',
    'VSG',
    'HYPERX',
    'CORSAIR',
    'AULA',
    'AJAZZ',
    'MACHENIKE',
    'ATTACK SHARK',
    'VGN',
    'VXE',
    'FLYDIGI',
    '8BITDO',
    'DULCET',
    'DARMOSHARK',
    'LAMZU',
    'WLMOUSE',
    'KEYCHRON'
  ],

  CORPORATE_NOISE_REGEX: /\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi,
  HEADER_NOISE_REGEX: /^(CNY|RMB|USD|EUR|PRICE|COLOR|MODEL|PICTURE|IMAGE|SPEC|REMARK|MOQ|FOB|\.|-|\s)+$/i,
  MONEY_NOISE_REGEX: /\b(CNY|RMB|USD|EUR)\s*\$?[\d.,]+\b/gi,
  PRICE_DECIMAL_REGEX: /^\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/,

  /**
   * Sanitiza un producto de catálogo limpiando marca, modelo, variante, categoría y precio FOB.
   */
  sanitizeItem(item, customBrands = []) {
    if (!item) return null;

    let modelo = (item.modelo || '').toString().trim();
    let variante = (item.variante || item.color || '').toString().trim();
    let marca = (item.marca || '').toString().trim();
    let cat = (item.cat || '').toString().trim().toUpperCase();
    const fob = parseFloat(item.fob) || 0;

    // 1. Limpieza de Modelo
    modelo = modelo.replace(this.CORPORATE_NOISE_REGEX, '');
    modelo = modelo.replace(this.MONEY_NOISE_REGEX, '');
    modelo = modelo.replace(/^[.\s-]+/, '');

    if (this.HEADER_NOISE_REGEX.test(modelo) || modelo.toLowerCase().startsWith('producto item')) {
      modelo = '';
    }

    // 1b. Generic product/noise word as modelo -> empty it so the reverse audit (step 6)
    //     can recover the real model from variante (e.g. modelo="Item" variante="DQ6" -> "DQ6").
    if (/^(item|list|earphones?|products?|producto|none|n\/a|undefined|null|[-.])$/i.test(modelo.trim())) {
      modelo = '';
    }

    // 1c. Purely numeric modelo (a size/key count/price, e.g. "68") is noise -> empty it
    //     so the real model is recovered from variante in the reverse audit.
    if (/^\$?\d+([.,]\d+)?$/.test(modelo.trim())) {
      modelo = '';
    }

    // 2. Limpieza de Variante / Color
    if (variante) {
      if (this.PRICE_DECIMAL_REGEX.test(variante) || /^[\d.,\s]+$/.test(variante) || this.HEADER_NOISE_REGEX.test(variante)) {
        variante = '';
      } else {
        variante = variante.replace(/\s+/g, ' ').trim();
      }
    }

    // 3. Detección / Normalización de Marca
    const allBrands = [...this.KNOWN_BRANDS, ...customBrands.map(b => b.toUpperCase())];
    const upperModelo = modelo.toUpperCase();
    if (!marca || marca === 'OTRO') {
      const foundBrand = allBrands.find(b => upperModelo.includes(b));
      if (foundBrand) {
        marca = foundBrand;
      }
    }

    // 3b. Remove brand from modelo if present (cross-contamination fix)
    if (marca && marca !== 'OTRO') {
      const brandUpper = marca.toUpperCase();
      const reBrandInModel = new RegExp('\\b' + brandUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      modelo = modelo.replace(reBrandInModel, '').replace(/\s+/g, ' ').trim();
      // Also check title-case variant
      const brandTitle = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      if (brandTitle !== marca) {
        const reBrandTitle = new RegExp('\\b' + brandTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        modelo = modelo.replace(reBrandTitle, '').replace(/\s+/g, ' ').trim();
      }
    }

    // 4. Detección de Categoría
    if (!cat || cat === 'OTRO') {
      cat = this.detectCategoryFromText(modelo + ' ' + variante, marca);
    }

    // 4b. Price-based category gates (generic market logic, not PDF-specific)
    // Real switches cost $0.05-$10. If classified as SWITCH but price > $12, it's a keyboard
    if (cat === 'SWITCH' && fob > 12) {
      const brandCat = this.BRAND_CATEGORY_PRIOR[(marca || '').toUpperCase()];
      cat = brandCat || 'TECLADO';
    }
    // If brand prior says TECLADO but price < $1, it's a switch component
    if (cat === 'TECLADO' && fob > 0 && fob < 1) {
      cat = 'SWITCH';
    }
    // A "headphone/earphone" under $1 is not a driver — it's eartips/foam/cable -> accessory
    if (cat === 'AURICULAR' && fob > 0 && fob < 1) {
      cat = 'ACCESORIO';
    }

    // 4c. Zero-identity row: no model (or numeric-only), no variant, no brand, no category
    //     -> pure noise (e.g. a stray RMB price column parsed as a product row). Drop it.
    const modeloIsNoise = (!modelo || modelo.length < 2 || /^\$?\d+([.,]\d+)?$/.test(modelo));
    if (modeloIsNoise && !variante && (!marca || marca === 'OTRO') && (!cat || cat === 'OTRO')) {
      return null;
    }

    // 5. Cross-field audit: fix contamination between modelo, variante, marca
    const audited = this.crossAuditFields(modelo, variante, marca, cat, !!item._keepColorNames);
    modelo = audited.modelo;
    variante = audited.variante;
    marca = audited.marca;

    // 5a. Post-audit guard: crossAudit can strip the last meaningful token out of modelo
    //     (e.g. "68 V3" -> V3 moved to variante -> modelo degenerates to "68"). If modelo
    //     ended up as noise while variante still holds content, recover the model from it.
    if (/^(item|list|earphones?|products?|producto|none|n\/a|undefined|null|[-.]|\$?\d+([.,]\d+)?)$/i.test(modelo.trim()) && variante) {
      const recovered = this.crossAuditFields('', variante, marca, cat, !!item._keepColorNames);
      modelo = recovered.modelo;
      variante = recovered.variante;
    }

    // 5b. If modelo is empty after audit, use brand+category placeholder
    if (!modelo || modelo.length < 2) {
      const brandPart = (marca && marca !== 'OTRO') ? marca : '';
      const catPart = (cat && cat !== 'OTRO') ? cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ') : 'Item';
      modelo = brandPart ? `${brandPart} ${catPart}` : catPart;
    }

    // 5c. If modelo is ONLY the brand name (no actual model), add category suffix
    if (marca && marca !== 'OTRO' && modelo.toLowerCase() === marca.toLowerCase()) {
      const catSuffix = (cat && cat !== 'OTRO') ? cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ') : 'Item';
      modelo = `${marca} ${catSuffix}`;
    }

    // Normalizar capitalización de marca
    if (marca && marca !== 'OTRO') {
      marca = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
    } else {
      marca = 'OTRO';
    }

    return {
      ...item,
      sku: item.sku || '',
      marca,
      modelo,
      variante,
      cat: cat || 'OTRO',
      fob,
      status: (modelo && fob > 0) ? 'VALID' : 'INVALID'
    };
  },

  // ── Color word patterns for cross-audit ──
  // NOTE: /g flag is needed for match() to return ALL colors.
  // Do NOT use .test() before .match() on this regex — /g + test() advances lastIndex.
  // NOTE: matte/glossy removed — these are finishes, not colors.
  COLOR_WORDS_RE: /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|negro|blanco|rosa|azul|rojo|verde|violeta|gris|plateado|dorado|naranja|marron|amarillo)\b/gi,

  // ── Category words that should NOT be in modelo ──
  CATEGORY_WORDS_RE: /\b(mouse|raton|keyboard|teclado|headset|auricular|earphone|earbuds|controller|gamepad|joystick|mousepad|pad|switch|webcam|camera|camara|numpad|chair|silla|monitor|speaker|parlante|microphone|microfono|hub|adapter|cable|stand|soporte)\b/gi,

  // ── Connection/type words that belong in variante, not modelo ──
  // NOTE: pro/plus/lite/mini/se removed — these are model suffixes (AK820 Pro, V3 Lite)
  CONNECTION_WORDS_RE: /\b(wired|wireless|bluetooth|2\.4g(hz)?|tri[\s-]?mode|usb[\s-]?c|rgb|mechanical|optical|gaming|v\d|version)\b/gi,

  /**
   * Cross-field audit: detects and fixes contamination between modelo, variante, marca.
   * Runs AFTER basic sanitization to catch what the extractor missed.
   */
  crossAuditFields(modelo, variante, marca, cat, keepColorNames = false) {
    modelo = (modelo || '').trim();
    variante = (variante || '').trim();
    marca = (marca || '').trim();

    // 1. Move color words from modelo → variante
    // IMPORTANT: Do NOT use .test() before .match() on /g regexes — lastIndex bug!
    const colorInModel = (!keepColorNames && modelo) ? modelo.match(this.COLOR_WORDS_RE) : null;
    if (colorInModel && colorInModel.length > 0) {
      const modeloNoColor = modelo.replace(this.COLOR_WORDS_RE, '').replace(/\s+/g, ' ').trim();
      const colorsToMove = colorInModel.join(' ');
      const existingVarLower = variante.toLowerCase();
      const newColors = colorsToMove.split(/\s+/).filter(c => !existingVarLower.includes(c.toLowerCase()));

      if (modeloNoColor.length >= 2) {
        // Normal case: modelo has other content besides colors
        modelo = modeloNoColor;
        if (newColors.length > 0) {
          variante = (newColors.join(' ') + ' ' + variante).replace(/\s+/g, ' ').trim();
        }
      } else {
        // Modelo is ONLY color words (e.g. "White", "Black Pink")
        // Move colors to variante, set modelo to brand-based placeholder
        if (newColors.length > 0) {
          variante = (newColors.join(' ') + ' ' + variante).replace(/\s+/g, ' ').trim();
        }
        modelo = '';  // Will be filled by caller with brand-based name
      }
    }

    // 2. Move connection/type words from modelo → variante
    // ALWAYS move — even if modelo becomes empty (same fix as colors).
    // Version tokens (V2/V3/V6/V9) are part of the product CODE (MAD 68 V2,
    // RS7 V2, K99 V3, FE87 V2) — ground truth requires them in modelo.
    const connInModel = modelo ? modelo.match(this.CONNECTION_WORDS_RE) : null;
    if (connInModel && connInModel.length > 0) {
      const isVersion = (c) => /^v\d+$/i.test(c.trim());
      const versionInModel = connInModel.filter(isVersion);
      const connOnly = connInModel.filter(c => !isVersion(c));
      const baseNoConn = modelo.replace(this.CONNECTION_WORDS_RE, '').replace(/\s+/g, ' ').trim();
      const modeloNoConn = versionInModel.length
        ? (baseNoConn + ' ' + versionInModel.join(' ')).replace(/\s+/g, ' ').trim()
        : baseNoConn;
      const existingVarLower = variante.toLowerCase();
      const newConns = connOnly.filter(c => !existingVarLower.includes(c.toLowerCase()));
      if (modeloNoConn.length >= 2 && !/^v\d+$/i.test(modeloNoConn)) {
        modelo = modeloNoConn;
        if (newConns.length > 0) {
          variante = (variante + ' ' + newConns.join(' ')).replace(/\s+/g, ' ').trim();
        }
      } else if (!/^v\d+$/i.test(modeloNoConn)) {
        // Modelo es SOLO palabras de conexión — mover a variante, limpiar modelo.
        // SLICE 5 (Attack Shark V8/V6/V5): un código v\d DESNUDO (sin otro token
        // antes) ES el modelo real (serie V8 de Attack Shark) — NO se limpia, o
        // el reverse audit promueve specs de la variante ("PAW3950MAX" como
        // modelo). El caso "MAD 68 V2" (sufijo tras código) ya queda cubierto
        // por la rama de arriba.
        if (newConns.length > 0) {
          variante = (newConns.join(' ') + ' ' + variante).replace(/\s+/g, ' ').trim();
        }
        modelo = '';
      }
    }

    // 3. Remove category words from modelo (they don't belong there)
        // SLICE 3 (Haimu switch specs): "Switch" is part of the switch NAME
        // ("Brown Switch", "SeaSalt Switch") — keep it when keepColorNames is set.
        if (!keepColorNames) {
          modelo = modelo.replace(this.CATEGORY_WORDS_RE, '').replace(/\s+/g, ' ').trim();
        }

    // 4. Remove price patterns from modelo and variante
    const PRICE_IN_FIELD_RE = /\$?\d{1,4}[.,]\d{2}\b|\b\d{1,4}[.,]\d{2}\s*(usd|dollars?)?\b/gi;
    modelo = modelo.replace(PRICE_IN_FIELD_RE, '').replace(/\s+/g, ' ').trim();
    variante = variante.replace(PRICE_IN_FIELD_RE, '').replace(/\s+/g, ' ').trim();

    // 5. Remove leading/trailing punctuation and noise
    modelo = modelo.replace(/^[\s\-,.:;|/\\]+|[\s\-,.:;|/\\]+$/g, '').trim();
    variante = variante.replace(/^[\s\-,.:;|/\\]+|[\s\-,.:;|/\\]+$/g, '').trim();

    // 6. Reverse audit: if modelo is empty/brand-only but variante has content,
    //    extract model-like words from variante
    if ((!modelo || modelo.length < 2) && variante) {
      // Split variante into words and classify each
      const varWords = variante.split(/\s+/);
      const modelWords = [];
      const remainingVar = [];
      for (const w of varWords) {
        // Reset lastIndex before each test — /g regex state bug prevention
        this.COLOR_WORDS_RE.lastIndex = 0;
        this.CONNECTION_WORDS_RE.lastIndex = 0;
        this.CATEGORY_WORDS_RE.lastIndex = 0;
        // Skip colors, connections, and category words — they stay in variante
        if (this.COLOR_WORDS_RE.test(w) || this.CONNECTION_WORDS_RE.test(w) || this.CATEGORY_WORDS_RE.test(w)) {
          remainingVar.push(w);
        } else {
          modelWords.push(w);
        }
      }
      if (modelWords.length > 0) {
        modelo = modelWords.join(' ');
        variante = remainingVar.join(' ');
      } else {
        // All words in variante are colors/connections — use first 2 as modelo placeholder
        modelo = varWords.slice(0, 2).join(' ');
        variante = varWords.slice(2).join(' ');
      }
    }

    // 6b. Reverse audit: if modelo is short and variante starts with type/connection
    //     words that belong in the model name (e.g. "Wireless Controller", "Bluetooth Keyboard"),
    //     move them to modelo. This fixes cases like modelo="Ultimate" var="Wireless Controller Black"
    //     → modelo="Ultimate Wireless Controller" var="Black"
        // SLICE 4: a model ending in a code suffix letter ("G502 X", "M750 M") is
        // already complete — do NOT pull type words from variante into it.
        const codeSuffixRe = /\b[A-Z0-9]{2,}\s+[A-Z]$/i;
        if (modelo && modelo.length < 20 && variante && !codeSuffixRe.test(modelo.trim())) {
      const TYPE_PREFIX_RE = /^((?:wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\s+)?(controller|keyboard|teclado|mouse|headset|auricular|earphone|gamepad|joystick|mousepad|numpad|switch|webcam|camera|speaker|monitor|chair)\b/i;
      const prefixMatch = variante.match(TYPE_PREFIX_RE);
      if (prefixMatch) {
        const typeWords = prefixMatch[0].trim();
        // Only move if modelo doesn't already contain these words
        if (!new RegExp('\\b' + typeWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(modelo)) {
          modelo = (modelo + ' ' + typeWords).replace(/\s+/g, ' ').trim();
          variante = variante.substring(prefixMatch[0].length).trim();
        }
      }
    }

    // 7. If modelo is too long (>40 chars), it's likely a description — truncate
    if (modelo.length > 40) {
      // Try to keep only the first meaningful chunk (up to first comma or after 4 words)
      const words = modelo.split(/\s+/);
      if (words.length > 4) {
        modelo = words.slice(0, 4).join(' ');
      } else {
        modelo = modelo.substring(0, 40).trim();
      }
    }

    // 8. Deduplicate words in variante
    if (variante) {
      const varWords = variante.split(/\s+/);
      const seen = new Set();
      const uniqueVar = [];
      for (const w of varWords) {
        const lower = w.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueVar.push(w);
        }
      }
      variante = uniqueVar.join(' ');
      // Truncate variante if too long (max 3 words for colors + 2 for connections)
      if (variante.split(/\s+/).length > 5) {
        variante = variante.split(/\s+/).slice(0, 5).join(' ');
      }
    }

    return { modelo, variante, marca };
  },

  /**
   * Intenta clasificar la categoría basada en palabras clave del título o variante.
   */
  detectCategoryFromText(text = '', brand = '') {
    const t = text.toUpperCase();
    if (t.includes('KEYBOARD') || t.includes('TECLADO')) return 'TECLADO';
    if (t.includes('NUMPAD') || t.includes('TECLADO NUMERICO')) return 'NUMPAD';
    if (t.includes('MOUSEPAD') || t.includes('ALFOMBR')) return 'MOUSEPAD';
    if (t.includes('MOUSE') || t.includes('RATON')) return 'MOUSE';
    if (t.includes('HEADSET') || t.includes('HEADPHONE') || t.includes('AURICULAR CON MICROFONO')) return 'HEADSET';
    if (t.includes('AURICULAR') || t.includes('EARPHONE') || t.includes('EARBUD') || t.includes('IEM') || t.includes('IN-EAR') || t.includes('IN EAR')) return 'AURICULAR';
    if (t.includes('CONTROLLER') || t.includes('GAMEPAD') || t.includes('JOYSTICK') || t.includes('GAME PAD')) return 'CONTROLLER';
    // SWITCH only when it's the PRIMARY product type, not a component descriptor
    // Keyboards often mention "switch" in their description — don't misclassify them
    // Generic rule: real switches cost $0.05-$10. If price > $15, it's NOT a switch product.
    if ((t.includes('SWITCH') || t.includes('INTERRUPTOR')) && !/\b(AK\d+|NK\d+|F\d{2,3}|K\d{2,3}|V\d{2,3}[A-Z]?|PRO\s|PLUS|SCREEN|KEYBOARD|TECLADO|MECHANICAL|MAGNETIC|HALL\s*EFFECT|HOT[\s-]*SWAP|GASKET|PCB|FR4|POM|ALUMINUM)\b/.test(t)) return 'SWITCH';
    if (t.includes('CAMARA') || t.includes('WEBCAM') || t.includes('CAMERA')) return 'CAMARA';
    if (t.includes('TRIMMER') || t.includes('CUIDADO PERSONAL') || t.includes('AFEITADORA')) return 'CUIDADO_PERSONAL';
    if (t.includes('RECEIVER') || t.includes('DONGLE') || t.includes('ADAPTER') || t.includes('CABLE') || t.includes('HUB') || t.includes('STAND') || t.includes('SOPORTE') || t.includes('DOCK') || t.includes('CHARGING')) return 'ACCESORIO';
    if (t.includes('SILLA') || t.includes('CHAIR')) return 'SILLA_GAMING';
    if (t.includes('SPEAKER') || t.includes('PARLANTE')) return 'SPEAKER';
    if (t.includes('MONITOR')) return 'MONITOR';

    // Brand-category priors: when text has no category keyword, use brand as hint
    if (brand && brand !== 'OTRO') {
      const b = brand.toUpperCase();
      const prior = this.BRAND_CATEGORY_PRIOR[b];
      if (prior) return prior;
    }

    return 'OTRO';
  },

  // Brand → most likely category (used as last-resort fallback)
  BRAND_CATEGORY_PRIOR: {
    '8BITDO': 'CONTROLLER',
    'GAMESIR': 'CONTROLLER',
    'FLYDIGI': 'CONTROLLER',
    'KZ': 'AURICULAR',
    'HAIMU': 'AURICULAR',
    'AJAZZ': 'TECLADO',
    'AULA': 'TECLADO',
    'KEYCHRON': 'TECLADO',
    'ROYAL KLUDGE': 'TECLADO',
    'RK': 'TECLADO',
    'MACHENIKE': 'TECLADO',
    'REDRAGON': 'MOUSE',
    'LOGITECH': 'MOUSE',
    'RAZER': 'MOUSE',
    'ATTACK SHARK': 'MOUSE',
    'MCHOSE': 'MOUSE',
    'MADLIONS': 'MOUSE',
    'ATK': 'MOUSE',
    'IROK': 'MOUSE',
    'VGN': 'MOUSE',
    'VXE': 'MOUSE',
    'DARMOSHARK': 'MOUSE',
    'LAMZU': 'MOUSE',
    'WLMOUSE': 'MOUSE',
    'HYPERX': 'HEADSET',
    'CORSAIR': 'HEADSET',
    'VSG': 'MOUSE',
    'KEYBOARD_SWITCH': 'SWITCH',
  },

  /**
   * Parsea modelo y variante de una cadena compuesta.
   */
  parseModelAndVariant(text = '', brand = '') {
    let cleanText = text.toString().trim();
    if (brand && brand !== 'OTRO') {
      const reg = new RegExp(`^${brand}\\s*`, 'i');
      cleanText = cleanText.replace(reg, '');
    }

    const match = cleanText.match(/\(([^)]+)\)/);
    let variante = '';
    let modelo = cleanText;

    if (match) {
      variante = match[1].trim();
      modelo = cleanText.replace(/\([^)]+\)/, '').trim();
    }

    return { modelo, variante };
  },

  /**
   * Repara un ítem de catálogo formateando sus atributos al estándar esperado.
   */
  repairCatalogItem(item) {
    return this.sanitizeItem(item);
  },

  /**
   * Procesa en lote una lista de ítems de catálogo.
   */
  autoCorrectItems(items = [], customBrands = []) {
    if (!Array.isArray(items)) return [];
    return items.map(item => this.sanitizeItem(item, customBrands)).filter(Boolean);
  },

  /**
   * SINGLE SOURCE OF TRUTH for in-place fix logic.
   * Used by fixCatalog() and runFixOnPreview().
   * Returns count of modified items.
   */
  fixItemsInPlace(items, customBrands = []) {
    if (!Array.isArray(items)) return 0;
    const allBrands = [...this.KNOWN_BRANDS, ...customBrands.map(b => b.toUpperCase())];
    let fixed = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      let modelo = (item.modelo || '').trim();
      let variante = (item.variante || item.color || '').trim();
      let marca = (item.marca || '').trim();
      const cat = (item.cat || '').trim().toUpperCase();
      const orig = { modelo, variante, marca };

      // 1. Cross-audit
      if (typeof this.crossAuditFields === 'function') {
        const audited = this.crossAuditFields(modelo, variante, marca, cat, !!item._keepColorNames);
        modelo = audited.modelo;
        variante = audited.variante;
        marca = audited.marca;
      }

      // 2. Re-detect brand if OTRO
      if ((!marca || marca === 'OTRO')) {
        const upper = (modelo + ' ' + variante).toUpperCase();
        const found = allBrands.find(b => upper.includes(b));
        if (found) marca = found;
      }

      // 3. Remove brand from modelo
      if (marca && marca !== 'OTRO') {
        const re = new RegExp('\\b' + marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        modelo = modelo.replace(re, '').replace(/\s+/g, ' ').trim();
      }

      // 4. Re-detect category if OTRO
      let newCat = cat;
      if ((!newCat || newCat === 'OTRO')) {
        newCat = this.detectCategoryFromText(modelo + ' ' + variante, marca);
      }

      // 5. Empty modelo → placeholder
      if (!modelo || modelo.length < 2) {
        const brandPart = (marca && marca !== 'OTRO') ? marca : '';
        const catPart = (newCat && newCat !== 'OTRO') ? newCat.charAt(0) + newCat.slice(1).toLowerCase().replace(/_/g, ' ') : 'Item';
        modelo = brandPart ? `${brandPart} ${catPart}` : catPart;
      }

      // 6. Modelo = only brand → add category suffix
      if (marca && marca !== 'OTRO' && modelo.toLowerCase() === marca.toLowerCase()) {
        const catSuffix = (newCat && newCat !== 'OTRO') ? newCat.charAt(0) + newCat.slice(1).toLowerCase().replace(/_/g, ' ') : 'Item';
        modelo = `${marca} ${catSuffix}`;
      }

      // 7. Normalize brand
      if (marca && marca !== 'OTRO') {
        marca = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      }

      if (modelo !== orig.modelo || variante !== orig.variante || marca !== orig.marca) {
        item.modelo = modelo;
        item.variante = variante;
        item.color = variante;
        item.marca = marca || 'OTRO';
        item.cat = newCat || 'OTRO';
        fixed++;
      }
    }
    return fixed;
  },

  /**
   * Honest model-quality assessment. GREEN only means "structurally complete";
   * this detects when the extracted model is actually DIRTY so the semaphore can
   * stop lying (downgrade to YELLOW/RED) without changing the extracted value.
   * Rules derived from visual ground-truth (ground-truth/verdicts.json, n=65).
   * @returns {{ level: 'GREEN'|'YELLOW'|'RED', reasons: string[] }}
   */
  assessModelQuality(modelo, variante, cat, raw) {
    const m = (modelo || '').trim();
    const reasons = [];
    if (!m) return { level: 'RED', reasons: ['Modelo vacío'] };

    // RED: datasheet specs leaked into the model (never a product name).
    // e.g. "PC SeaSalt PA Silent 47 5g POM", "3.60±0.30mm".
    const SPEC_RE = /(\d+(?:\.\d+)?\s*(?:mm|mn)\b)|±|\b\d+(?:\.\d+)?\s*g\b|\b(?:POM|UPE|PA12|FR4|IXPE|PET)\b|\b(?:stroke|force|material|cover|axle|working|bottoming|pre[- ]?travel)\b/i;
    if (/^total\b/i.test(m) || SPEC_RE.test(m)) {
      return { level: 'RED', reasons: ['Modelo = specs técnicas de hoja de datos (no es un nombre de producto)'] };
    }

    // YELLOW: switch/axis name glued to the model code (identifiable but dirty).
    // e.g. "S98 Glacier Axis Universe", "R98 Kaihua Speed Axis", "Plum axis Pro".
    if (/\baxis\b/i.test(m) || /\bswitch\b/i.test(m)) {
      reasons.push('El modelo incluye el tipo de switch/axis (debería ir aparte)');
    }
    // YELLOW: truncated model with an unclosed bracket.
    if (/[({[]/.test(m) && !/[)}\]]/.test(m)) {
      reasons.push('Modelo truncado (paréntesis/llave sin cerrar)');
    }
    // YELLOW: model has no alphanumeric code but the source row DID carry one
    // (EAN-13 or a code with digits) -> the real code was lost (merged cell / matrix).
    const r = (raw || '');
    const rawHasCode = /\b\d{12,}\b/.test(r) || /\b[A-Z]{1,4}\d{2,}/.test(r);
    const modelHasDigit = /\d/.test(m);
    if (!modelHasDigit && rawHasCode) {
      reasons.push('El código del producto no llegó al modelo (celda fusionada/matriz)');
    }

    return { level: reasons.length ? 'YELLOW' : 'GREEN', reasons };
  }
};

if (typeof window !== 'undefined') window.TextSanitizer = TextSanitizer;
if (typeof module !== 'undefined') module.exports = TextSanitizer;
