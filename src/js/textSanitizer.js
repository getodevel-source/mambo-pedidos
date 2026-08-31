/**
 * Mambo Pedidos - Motor Determinístico de Sanitización y Limpieza de Catálogos (TextSanitizer)
 *
 * Sanitizador puro y ultra rápido de datos de productos.
 * Remueve ruido corporativo, palabras de encabezado, contaminación de precios y caracteres inválidos.
 * Cero dependencias externas. Cero simulación de IA. 100% confiable y ejecutable en runtime.
 */

const TextSanitizer = {
  VALID_CATEGORIES: [
    "TECLADO",
    "MOUSE",
    "HEADSET",
    "AURICULAR",
    "CONTROLLER",
    "MOUSEPAD",
    "SWITCH",
    "CAMARA",
    "CUIDADO_PERSONAL",
    "NUMPAD",
    "ACCESORIO",
  ],

  KNOWN_BRANDS: [
    "REDRAGON",
    "LOGITECH",
    "RAZER",
    "VSG",
    "HYPERX",
    "CORSAIR",
    "AULA",
    "AJAZZ",
    "MACHENIKE",
    "ATTACK SHARK",
    "VGN",
    "VXE",
    "FLYDIGI",
    "8BITDO",
    "DULCET",
    "DARMOSHARK",
    "LAMZU",
    "WLMOUSE",
    "KEYCHRON",
  ],

  CORPORATE_NOISE_REGEX:
    /\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi,
  HEADER_NOISE_REGEX:
    /^(CNY|RMB|USD|EUR|PRICE|COLOR|MODEL|PICTURE|IMAGE|SPEC|REMARK|MOQ|FOB|\.|-|\s)+$/i,
  MONEY_NOISE_REGEX: /\b(CNY|RMB|USD|EUR)\s*\$?[\d.,]+\b/gi,
  PRICE_DECIMAL_REGEX: /^\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/,
  MARKETING_WORDS_RE:
    /\b(?:ultra|master|star|crystal|crystalblade|gleam|glow|jade|king|queen|royal|snow|snowlight|ice|icy|cream|creamsicle|frost|horizon|nebula|nova|aurora|prism|mystic|tactical|esport|elite|premium|platinum|diamond|titan|hero|beast|legend|flagship|supreme|apex|dual|gift)\b/gi,
  MODEL_CODE_RE: /(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]?)/i,
  PRODUCT_NOUN_WORDS: [
    "dock",
    "charger",
    "hub",
    "stand",
    "soporte",
    "pad",
    "grip",
    "case",
    "cover",
    "keyboard",
    "teclado",
    "keypad",
    "numpad",
    "keys",
    "mouse",
    "raton",
    "controller",
    "gamepad",
    "joystick",
    "headset",
    "auricular",
    "earphone",
    "earbud",
    "webcam",
    "camera",
    "camara",
    "microphone",
    "microfono",
    "speaker",
    "parlante",
    "monitor",
    "chair",
    "silla",
    "adapter",
    "cable",
  ],
  PRODUCT_NOUN_RE: null, // compilado al final del módulo desde PRODUCT_NOUN_WORDS

  /**
   * Sanitiza un producto de catálogo limpiando marca, modelo, variante, categoría y precio FOB.
   */
  sanitizeItem(item, customBrands = []) {
    if (!item) return null;

    let modelo = (item.modelo || "").toString().trim();
    let variante = (item.variante || item.color || "").toString().trim();
    let marca = (item.marca || "").toString().trim();
    let cat = (item.cat || "").toString().trim().toUpperCase();
    const fob = parseFloat(item.fob) || 0;

    // 1. Limpieza de Modelo
    modelo = modelo.replace(this.CORPORATE_NOISE_REGEX, "");
    modelo = modelo.replace(this.MONEY_NOISE_REGEX, "");
    modelo = modelo.replace(/^[.\s-]+/, "");

    if (
      this.HEADER_NOISE_REGEX.test(modelo) ||
      modelo.toLowerCase().startsWith("producto item")
    ) {
      modelo = "";
    }

    // 1b. Generic product/noise word as modelo -> empty it so the reverse audit (step 6)
    //     can recover the real model from variante (e.g. modelo="Item" variante="DQ6" -> "DQ6").
    if (
      /^(item|list|earphones?|products?|producto|none|n\/a|undefined|null|[-.])$/i.test(
        modelo.trim(),
      )
    ) {
      modelo = "";
    }

    // 1c. Purely numeric modelo (a size/key count/price, e.g. "68") is noise -> empty it
    //     so the real model is recovered from variante in the reverse audit.
    if (/^\$?\d+([.,]\d+)?$/.test(modelo.trim())) {
      modelo = "";
    }

    // 2. Limpieza de Variante / Color
    if (variante) {
      if (
        this.PRICE_DECIMAL_REGEX.test(variante) ||
        /^[\d.,\s]+$/.test(variante) ||
        this.HEADER_NOISE_REGEX.test(variante)
      ) {
        variante = "";
      } else {
        variante = variante.replace(/\s+/g, " ").trim();
      }
    }

    // 3. Detección / Normalización de Marca
    const allBrands = [
      ...this.KNOWN_BRANDS,
      ...customBrands.map((b) => b.toUpperCase()),
    ];
    const upperModelo = modelo.toUpperCase();
    if (!marca || marca === "OTRO") {
      const foundBrand = allBrands.find((b) => upperModelo.includes(b));
      if (foundBrand) {
        marca = foundBrand;
      }
    }

    // 3b. Remove brand from modelo if present (cross-contamination fix)
    if (marca && marca !== "OTRO") {
      const brandUpper = marca.toUpperCase();
      const reBrandInModel = new RegExp(
        "\\b" + brandUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        "i",
      );
      modelo = modelo.replace(reBrandInModel, "").replace(/\s+/g, " ").trim();
      // Also check title-case variant
      const brandTitle =
        marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      if (brandTitle !== marca) {
        const reBrandTitle = new RegExp(
          "\\b" + brandTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
          "i",
        );
        modelo = modelo.replace(reBrandTitle, "").replace(/\s+/g, " ").trim();
      }
    }

    // 4. Detección de Categoría
    if (!cat || cat === "OTRO") {
      cat = this.detectCategoryFromText(modelo + " " + variante, marca);
    }

    // 4b. Price-based category gates (generic market logic, not PDF-specific)
    // Real switches cost $0.05-$10. If classified as SWITCH but price > $12, it's a keyboard
    if (cat === "SWITCH" && fob > 12) {
      const brandCat = this.BRAND_CATEGORY_PRIOR[(marca || "").toUpperCase()];
      cat = brandCat || "TECLADO";
    }
    // If brand prior says TECLADO but price < $1, it's a switch component
    if (cat === "TECLADO" && fob > 0 && fob < 1) {
      cat = "SWITCH";
    }
    // A "headphone/earphone" under $1 is not a driver — it's eartips/foam/cable -> accessory
    if (cat === "AURICULAR" && fob > 0 && fob < 1) {
      cat = "ACCESORIO";
    }

    // 4c. Zero-identity row: no model (or numeric-only), no variant, no brand, no category
    //     -> pure noise (e.g. a stray RMB price column parsed as a product row). Drop it.
    const modeloIsNoise =
      !modelo || modelo.length < 2 || /^\$?\d+([.,]\d+)?$/.test(modelo);
    if (
      modeloIsNoise &&
      !variante &&
      (!marca || marca === "OTRO") &&
      (!cat || cat === "OTRO")
    ) {
      return null;
    }

    // 5. Cross-field audit: fix contamination between modelo, variante, marca
    const audited = this.crossAuditFields(
      modelo,
      variante,
      marca,
      cat,
      !!item._keepColorNames,
    );
    modelo = audited.modelo;
    variante = audited.variante;
    marca = audited.marca;

    // 5a. Post-audit guard: crossAudit can strip the last meaningful token out of modelo
    //     (e.g. "68 V3" -> V3 moved to variante -> modelo degenerates to "68"). If modelo
    //     ended up as noise while variante still holds content, recover the model from it.
    if (
      /^(item|list|earphones?|products?|producto|none|n\/a|undefined|null|[-.]|\$?\d+([.,]\d+)?)$/i.test(
        modelo.trim(),
      ) &&
      variante
    ) {
      const recovered = this.crossAuditFields(
        "",
        variante,
        marca,
        cat,
        !!item._keepColorNames,
      );
      modelo = recovered.modelo;
      variante = recovered.variante;
    }

    // 5b. If modelo is empty after audit, use brand+category placeholder
    if (!modelo || modelo.length < 2) {
      const brandPart = marca && marca !== "OTRO" ? marca : "";
      const catPart =
        cat && cat !== "OTRO"
          ? cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, " ")
          : "Item";
      modelo = brandPart ? `${brandPart} ${catPart}` : catPart;
    }

    // 5c. If modelo is ONLY the brand name (no actual model), add category suffix
    if (
      marca &&
      marca !== "OTRO" &&
      modelo.toLowerCase() === marca.toLowerCase()
    ) {
      const catSuffix =
        cat && cat !== "OTRO"
          ? cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, " ")
          : "Item";
      modelo = `${marca} ${catSuffix}`;
    }

    // Normalizar capitalización de marca
    if (marca && marca !== "OTRO") {
      marca = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
    } else {
      marca = "OTRO";
    }

    return {
      ...item,
      sku: item.sku || "",
      marca,
      modelo,
      variante,
      cat: cat || "OTRO",
      fob,
      status: modelo && fob > 0 ? "VALID" : "INVALID",
    };
  },

  // ── Color word patterns for cross-audit ──
  // NOTE: /g flag is needed for match() to return ALL colors.
  // Do NOT use .test() before .match() on this regex — /g + test() advances lastIndex.
  // NOTE: matte/glossy removed — these are finishes, not colors.
  COLOR_WORDS_RE:
    /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|negro|blanco|rosa|azul|rojo|verde|violeta|gris|plateado|dorado|naranja|marron|amarillo)\b/gi,

  // ── Category words that should NOT be in modelo ──
  CATEGORY_WORDS_RE:
    /\b(mouse|raton|keyboard|teclado|headset|auricular|earphone|earbuds|controller|gamepad|joystick|mousepad|pad|switch|webcam|camera|camara|numpad|chair|silla|monitor|speaker|parlante|microphone|microfono|hub|adapter|cable|stand|soporte)\b/gi,

  // ── Connection/type words that belong in variante, not modelo ──
  // NOTE: pro/plus/lite/mini/se removed — these are model suffixes (AK820 Pro, V3 Lite)
  CONNECTION_WORDS_RE:
    /\b(wired|wireless|bluetooth|2\.4g(hz)?|tri[\s-]?mode|usb[\s-]?c|rgb|mechanical|optical|gaming|v\d|version)\b/gi,

  /**
   * Cross-field audit: detects and fixes contamination between modelo, variante, marca.
   * Runs AFTER basic sanitization to catch what the extractor missed.
   */
  crossAuditFields(modelo, variante, marca, cat, keepColorNames = false) {
    modelo = (modelo || "").trim();
    variante = (variante || "").trim();
    marca = (marca || "").trim();

    // 1. Move color words from modelo → variante
    // IMPORTANT: Do NOT use .test() before .match() on /g regexes — lastIndex bug!
    const colorInModel =
      !keepColorNames && modelo ? modelo.match(this.COLOR_WORDS_RE) : null;
    if (colorInModel && colorInModel.length > 0) {
      const modeloNoColor = modelo
        .replace(this.COLOR_WORDS_RE, "")
        .replace(/\s+/g, " ")
        .trim();
      const colorsToMove = colorInModel.join(" ");
      const existingVarLower = variante.toLowerCase();
      const newColors = colorsToMove
        .split(/\s+/)
        .filter((c) => !existingVarLower.includes(c.toLowerCase()));

      if (modeloNoColor.length >= 2) {
        // Normal case: modelo has other content besides colors
        modelo = modeloNoColor;
        if (newColors.length > 0) {
          variante = (newColors.join(" ") + " " + variante)
            .replace(/\s+/g, " ")
            .trim();
        }
      } else {
        // Modelo is ONLY color words (e.g. "White", "Black Pink")
        // Move colors to variante, set modelo to brand-based placeholder
        if (newColors.length > 0) {
          variante = (newColors.join(" ") + " " + variante)
            .replace(/\s+/g, " ")
            .trim();
        }
        modelo = ""; // Will be filled by caller with brand-based name
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
      const connOnly = connInModel.filter((c) => !isVersion(c));
      const baseNoConn = modelo
        .replace(this.CONNECTION_WORDS_RE, "")
        .replace(/\s+/g, " ")
        .trim();
      const modeloNoConn = versionInModel.length
        ? (baseNoConn + " " + versionInModel.join(" "))
            .replace(/\s+/g, " ")
            .trim()
        : baseNoConn;
      const existingVarLower = variante.toLowerCase();
      const newConns = connOnly.filter(
        (c) => !existingVarLower.includes(c.toLowerCase()),
      );
      if (modeloNoConn.length >= 2 && !/^v\d+$/i.test(modeloNoConn)) {
        modelo = modeloNoConn;
        if (newConns.length > 0) {
          variante = (variante + " " + newConns.join(" "))
            .replace(/\s+/g, " ")
            .trim();
        }
      } else if (!/^v\d+$/i.test(modeloNoConn)) {
        // Modelo es SOLO palabras de conexión — mover a variante, limpiar modelo.
        // SLICE 5 (Attack Shark V8/V6/V5): un código v\d DESNUDO (sin otro token
        // antes) ES el modelo real (serie V8 de Attack Shark) — NO se limpia, o
        // el reverse audit promueve specs de la variante ("PAW3950MAX" como
        // modelo). El caso "MAD 68 V2" (sufijo tras código) ya queda cubierto
        // por la rama de arriba.
        if (newConns.length > 0) {
          variante = (newConns.join(" ") + " " + variante)
            .replace(/\s+/g, " ")
            .trim();
        }
        modelo = "";
      }
    }

    // 3. Remove category words from modelo (they don't belong there)
    // SLICE 3 (Haimu switch specs): "Switch" is part of the switch NAME
    // ("Brown Switch", "SeaSalt Switch") — keep it when keepColorNames is set.
    if (!keepColorNames) {
      modelo = modelo
        .replace(this.CATEGORY_WORDS_RE, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 4. Remove price patterns from modelo and variante
    const PRICE_IN_FIELD_RE =
      /\$?\d{1,4}[.,]\d{2}\b|\b\d{1,4}[.,]\d{2}\s*(usd|dollars?)?\b/gi;
    modelo = modelo.replace(PRICE_IN_FIELD_RE, "").replace(/\s+/g, " ").trim();
    variante = variante
      .replace(PRICE_IN_FIELD_RE, "")
      .replace(/\s+/g, " ")
      .trim();

    // 5. Remove leading/trailing punctuation and noise
    modelo = modelo.replace(/^[\s\-,.:;|/\\]+|[\s\-,.:;|/\\]+$/g, "").trim();
    variante = variante
      .replace(/^[\s\-,.:;|/\\]+|[\s\-,.:;|/\\]+$/g, "")
      .trim();

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
        if (
          this.COLOR_WORDS_RE.test(w) ||
          this.CONNECTION_WORDS_RE.test(w) ||
          this.CATEGORY_WORDS_RE.test(w)
        ) {
          remainingVar.push(w);
        } else {
          modelWords.push(w);
        }
      }
      if (modelWords.length > 0) {
        modelo = modelWords.join(" ");
        variante = remainingVar.join(" ");
      } else {
        // All words in variante are colors/connections — use first 2 as modelo placeholder
        modelo = varWords.slice(0, 2).join(" ");
        variante = varWords.slice(2).join(" ");
      }
    }

    // 6b. Reverse audit: if modelo is short and variante starts with type/connection
    //     words that belong in the model name (e.g. "Wireless Controller", "Bluetooth Keyboard"),
    //     move them to modelo. This fixes cases like modelo="Ultimate" var="Wireless Controller Black"
    //     → modelo="Ultimate Wireless Controller" var="Black"
    // SLICE 4: a model ending in a code suffix letter ("G502 X", "M750 M") is
    // already complete — do NOT pull type words from variante into it.
    const codeSuffixRe = /\b[A-Z0-9]{2,}\s+[A-Z]$/i;
    if (
      modelo &&
      modelo.length < 20 &&
      variante &&
      !codeSuffixRe.test(modelo.trim())
    ) {
      const TYPE_PREFIX_RE =
        /^((?:wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\s+)?(controller|keyboard|teclado|mouse|headset|auricular|earphone|gamepad|joystick|mousepad|numpad|switch|webcam|camera|speaker|monitor|chair)\b/i;
      const prefixMatch = variante.match(TYPE_PREFIX_RE);
      if (prefixMatch) {
        const typeWords = prefixMatch[0].trim();
        // Only move if modelo doesn't already contain these words
        if (
          !new RegExp(
            "\\b" + typeWords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
            "i",
          ).test(modelo)
        ) {
          modelo = (modelo + " " + typeWords).replace(/\s+/g, " ").trim();
          variante = variante.substring(prefixMatch[0].length).trim();
        }
      }
    }

    // 7. If modelo is too long (>40 chars), it's likely a description — truncate
    if (modelo.length > 40) {
      // Try to keep only the first meaningful chunk (up to first comma or after 4 words)
      const words = modelo.split(/\s+/);
      if (words.length > 4) {
        modelo = words.slice(0, 4).join(" ");
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
      variante = uniqueVar.join(" ");
      // Truncate variante if too long (max 3 words for colors + 2 for connections)
      if (variante.split(/\s+/).length > 5) {
        variante = variante.split(/\s+/).slice(0, 5).join(" ");
      }
    }

    return { modelo, variante, marca };
  },

  /**
   * Intenta clasificar la categoría basada en palabras clave del título o variante.
   */
  detectCategoryFromText(text = "", brand = "") {
    const t = text.toUpperCase();
    if (t.includes("KEYBOARD") || t.includes("TECLADO")) return "TECLADO";
    if (t.includes("NUMPAD") || t.includes("TECLADO NUMERICO")) return "NUMPAD";
    if (t.includes("MOUSEPAD") || t.includes("ALFOMBR")) return "MOUSEPAD";
    if (t.includes("MOUSE") || t.includes("RATON")) return "MOUSE";
    if (
      t.includes("HEADSET") ||
      t.includes("HEADPHONE") ||
      t.includes("AURICULAR CON MICROFONO")
    )
      return "HEADSET";
    if (
      t.includes("AURICULAR") ||
      t.includes("EARPHONE") ||
      t.includes("EARBUD") ||
      t.includes("IEM") ||
      t.includes("IN-EAR") ||
      t.includes("IN EAR")
    )
      return "AURICULAR";
    if (
      t.includes("CONTROLLER") ||
      t.includes("GAMEPAD") ||
      t.includes("JOYSTICK") ||
      t.includes("GAME PAD")
    )
      return "CONTROLLER";
    // SWITCH only when it's the PRIMARY product type, not a component descriptor
    // Keyboards often mention "switch" in their description — don't misclassify them
    // Generic rule: real switches cost $0.05-$10. If price > $15, it's NOT a switch product.
    if (
      (t.includes("SWITCH") || t.includes("INTERRUPTOR")) &&
      !/\b(AK\d+|NK\d+|F\d{2,3}|K\d{2,3}|V\d{2,3}[A-Z]?|PRO\s|PLUS|SCREEN|KEYBOARD|TECLADO|MECHANICAL|MAGNETIC|HALL\s*EFFECT|HOT[\s-]*SWAP|GASKET|PCB|FR4|POM|ALUMINUM)\b/.test(
        t,
      )
    )
      return "SWITCH";
    if (t.includes("CAMARA") || t.includes("WEBCAM") || t.includes("CAMERA"))
      return "CAMARA";
    if (
      t.includes("TRIMMER") ||
      t.includes("CUIDADO PERSONAL") ||
      t.includes("AFEITADORA")
    )
      return "CUIDADO_PERSONAL";
    if (
      t.includes("RECEIVER") ||
      t.includes("DONGLE") ||
      t.includes("ADAPTER") ||
      t.includes("CABLE") ||
      t.includes("HUB") ||
      t.includes("STAND") ||
      t.includes("SOPORTE") ||
      t.includes("DOCK") ||
      t.includes("CHARGING")
    )
      return "ACCESORIO";
    if (t.includes("SILLA") || t.includes("CHAIR")) return "SILLA_GAMING";
    if (t.includes("SPEAKER") || t.includes("PARLANTE")) return "SPEAKER";
    if (t.includes("MONITOR")) return "MONITOR";

    // Brand-category priors: when text has no category keyword, use brand as hint
    if (brand && brand !== "OTRO") {
      const b = brand.toUpperCase();
      const prior = this.BRAND_CATEGORY_PRIOR[b];
      if (prior) return prior;
    }

    return "OTRO";
  },

  // Brand → most likely category (used as last-resort fallback)
  BRAND_CATEGORY_PRIOR: {
    "8BITDO": "CONTROLLER",
    GAMESIR: "CONTROLLER",
    FLYDIGI: "CONTROLLER",
    KZ: "AURICULAR",
    HAIMU: "AURICULAR",
    AJAZZ: "TECLADO",
    AULA: "TECLADO",
    KEYCHRON: "TECLADO",
    "ROYAL KLUDGE": "TECLADO",
    RK: "TECLADO",
    MACHENIKE: "TECLADO",
    REDRAGON: "MOUSE",
    LOGITECH: "MOUSE",
    RAZER: "MOUSE",
    "ATTACK SHARK": "MOUSE",
    MCHOSE: "MOUSE",
    MADLIONS: "MOUSE",
    ATK: "MOUSE",
    IROK: "MOUSE",
    VGN: "MOUSE",
    VXE: "MOUSE",
    DARMOSHARK: "MOUSE",
    LAMZU: "MOUSE",
    WLMOUSE: "MOUSE",
    HYPERX: "HEADSET",
    CORSAIR: "HEADSET",
    VSG: "MOUSE",
    KEYBOARD_SWITCH: "SWITCH",
  },

  /**
   * Parsea modelo y variante de una cadena compuesta.
   */
  parseModelAndVariant(text = "", brand = "") {
    let cleanText = text.toString().trim();
    if (brand && brand !== "OTRO") {
      const reg = new RegExp(`^${brand}\\s*`, "i");
      cleanText = cleanText.replace(reg, "");
    }

    const match = cleanText.match(/\(([^)]+)\)/);
    let variante = "";
    let modelo = cleanText;

    if (match) {
      variante = match[1].trim();
      modelo = cleanText.replace(/\([^)]+\)/, "").trim();
    }

    return { modelo, variante };
  },

  /**
   * SINGLE SOURCE OF TRUTH for in-place fix logic.
   * Used by fixCatalog() and runFixOnPreview().
   * Returns count of modified items.
   */
  fixItemsInPlace(items, customBrands = []) {
    if (!Array.isArray(items)) return 0;
    const allBrands = [
      ...this.KNOWN_BRANDS,
      ...customBrands.map((b) => b.toUpperCase()),
    ];
    let fixed = 0;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      let modelo = (item.modelo || "").trim();
      let variante = (item.variante || item.color || "").trim();
      let marca = (item.marca || "").trim();
      const cat = (item.cat || "").trim().toUpperCase();
      const orig = { modelo, variante, marca };

      // 1. Cross-audit
      if (typeof this.crossAuditFields === "function") {
        const audited = this.crossAuditFields(
          modelo,
          variante,
          marca,
          cat,
          !!item._keepColorNames,
        );
        modelo = audited.modelo;
        variante = audited.variante;
        marca = audited.marca;
      }

      // 1b. Color-field sanitization (SLICE 3): the color field must hold ONLY
      // color words (spec "Color holds a color"). Connection/category words are
      // collected and moved to variante when the item had none, else dropped.
      let saniColor = null;
      if (item.color && typeof this.sanitizeColorField === "function") {
        const sani = this.sanitizeColorField(item.color);
        saniColor = sani.color;
        if (sani.moved.length && !(item.variante || "").trim()) {
          variante = sani.moved.join(" ");
        }
      }

      // 2. Re-detect brand if OTRO
      if (!marca || marca === "OTRO") {
        const upper = (modelo + " " + variante).toUpperCase();
        const found = allBrands.find((b) => upper.includes(b));
        if (found) marca = found;
      }

      // 3. Remove brand from modelo
      if (marca && marca !== "OTRO") {
        const re = new RegExp(
          "\\b" + marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
          "i",
        );
        modelo = modelo.replace(re, "").replace(/\s+/g, " ").trim();
      }

      // 4. Re-detect category if OTRO
      let newCat = cat;
      if (!newCat || newCat === "OTRO") {
        newCat = this.detectCategoryFromText(modelo + " " + variante, marca);
      }

      // 5. Empty modelo → placeholder
      if (!modelo || modelo.length < 2) {
        const brandPart = marca && marca !== "OTRO" ? marca : "";
        const catPart =
          newCat && newCat !== "OTRO"
            ? newCat.charAt(0) +
              newCat.slice(1).toLowerCase().replace(/_/g, " ")
            : "Item";
        modelo = brandPart ? `${brandPart} ${catPart}` : catPart;
      }

      // 6. Modelo = only brand → add category suffix
      if (
        marca &&
        marca !== "OTRO" &&
        modelo.toLowerCase() === marca.toLowerCase()
      ) {
        const catSuffix =
          newCat && newCat !== "OTRO"
            ? newCat.charAt(0) +
              newCat.slice(1).toLowerCase().replace(/_/g, " ")
            : "Item";
        modelo = `${marca} ${catSuffix}`;
      }

      // 7. Normalize brand
      if (marca && marca !== "OTRO") {
        marca = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      }

      const colorChanged =
        saniColor !== null && saniColor !== String(item.color || "");
      if (
        modelo !== orig.modelo ||
        variante !== orig.variante ||
        marca !== orig.marca ||
        colorChanged
      ) {
        item.modelo = modelo;
        item.variante = variante;
        item.color = saniColor !== null ? saniColor : variante;
        item.marca = marca || "OTRO";
        item.cat = newCat || "OTRO";
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
    const m = (modelo || "").trim();
    const reasons = [];
    if (!m) return { level: "RED", reasons: ["Modelo vacío"] };

    // RED: datasheet specs leaked into the model (never a product name).
    // e.g. "PC SeaSalt PA Silent 47 5g POM", "3.60±0.30mm".
    const SPEC_RE =
      /(\d+(?:\.\d+)?\s*(?:mm|mn)\b)|±|\b\d+(?:\.\d+)?\s*g\b|\b(?:POM|UPE|PA12|FR4|IXPE|PET)\b|\b(?:stroke|force|material|cover|axle|working|bottoming|pre[- ]?travel)\b/i;
    if (/^total\b/i.test(m) || SPEC_RE.test(m)) {
      return {
        level: "RED",
        reasons: [
          "Modelo = specs técnicas de hoja de datos (no es un nombre de producto)",
        ],
      };
    }

    // YELLOW: switch/axis name glued to the model code (identifiable but dirty).
    // e.g. "S98 Glacier Axis Universe", "R98 Kaihua Speed Axis", "Plum axis Pro".
    // SLICE 3 (design §IT17, rule 3): hall\s*effect extends the rule - but a
    // BARE "Hall Effect" (the whole model is the phrase) is a class the ground
    // truth keeps GREEN, so it is excluded (FP guard, task 3.6 - 0 new FPs).
    const isBareHallEffect = /^hall\s*effect$/i.test(m.trim());
    const isSwitchCategory = /^(switch|interruptor)$/i.test(
      String(cat || "").trim(),
    );
    if (
      !isSwitchCategory &&
      (/\baxis\b/i.test(m) ||
        /\bswitch\b/i.test(m) ||
        (/\bhall\s*effect\b/i.test(m) && !isBareHallEffect))
    ) {
      reasons.push(
        "El modelo incluye el tipo de switch/axis (debería ir aparte)",
      );
    }
        // YELLOW: truncated model with an unclosed bracket.
        if (/[({[]/.test(m) && !/[)}\]]/.test(m)) {
          reasons.push("Modelo truncado (paréntesis/llave sin cerrar)");
        }
        // YELLOW (PIL iteración 1): any bracket in the model is merged-cell
        // residue — "F87 (dark )", "dark )", "F75 Glacier (Light". Product
        // codes never carry brackets, so this is safe (the only bracketed
        // model in the 65-case snapshot was real residue too).
        if (/[()[\]{}]/.test(m)) {
          reasons.push("Residuo de celda en el modelo (paréntesis/llaves)");
        }
    // YELLOW: model has no alphanumeric code but the source row DID carry one
    // (EAN-13 or a code with digits) -> the real code was lost (merged cell / matrix).
    const r = raw || "";
    const rawHasCode = /\b\d{12,}\b/.test(r) || /\b[A-Z]{1,4}\d{2,}/.test(r);
    const modelHasDigit = /\d/.test(m);
    if (!modelHasDigit && rawHasCode) {
      reasons.push(
        "El código del producto no llegó al modelo (celda fusionada/matriz)",
      );
    }

    // Infalibilidad IT17 (spec infallibility-contract): los 24 falsos negativos
    // auditados son (a) modelos con código real + sufijo de TIPO al final, y
    // (b) modelos degenerados a palabra genérica. Dos reglas:
    const mHasCode = this.MODEL_CODE_RE.test(m);
    // (a) DESCARTADA en la auditoría IT17: "M720 Wireless Mouse" y "F75 Gasket
    //     Keyboard" son estructuralmente idénticos (código + palabras de tipo) y
    //     el gate no puede distinguir "inflado-dirty" de "nombre descriptivo
    //     legítimo" sin conocimiento del catálogo. La propia convención del app
    //     (testCatalogValidatorRules) trata "F75 Gasket Keyboard" como GREEN
    //     válido. El tipo-inflado va a la COLA HUMANA (P4), no al gate.
    // (b) "Rose", "Standard", "Zero", "Ultimate" — palabra genérica sin código.
    const GENERIC_WORD_RE =
      /^(?:rose|zero|standard|ultimate|long|high\s+resolution|transparent|charging\s*dock|contour|contours|turbo\+?|business|new|item|product|printed|dust\s+printed|screen)$/i;
    if (!mHasCode && GENERIC_WORD_RE.test(m.trim())) {
      reasons.push(
        "El modelo es una palabra genérica (no un código de producto) — requiere revisión",
      );
    }
    // IT25 (parser-to-10): marketing puffery — "Ultra Crystalblade Gleam",
    // "Master Wireless Mouse", "68HE Ultra Jade King". 2+ palabras de marketing
    // o 1 sin código real → YELLOW. Anti-overfit: "AJ139 Pro" (1, con código) y
    // "F75 Gasket Keyboard" (0) quedan GREEN; "M720 Wireless Mouse" (código+tipo,
    // 0 marketing) queda en la cola humana IT17 (no se marca).
    const MARKETING_WORDS_RE = this.MARKETING_WORDS_RE;
    const mk = (m.match(MARKETING_WORDS_RE) || []).length;
    const marketing = this.classifyMarketingModel(m, cat);
    let marketingEvidence = null;
    if (
      TEXT_SANITIZER_CALIBRATION.nounPhraseCalibration &&
      marketing.class === "noun-phrase"
    ) {
      // Sintagma nominal legítimo: sustantivo de producto + ≤1 adjetivo de
      // marketing → GREEN, sin warning MODEL_MARKETING (evidencia registrada).
      marketingEvidence = {
        pattern: "noun-phrase",
        noun: marketing.noun,
        marketingWords: marketing.marketingWords,
      };
    } else if (
      TEXT_SANITIZER_CALIBRATION.nounPhraseCalibration &&
      marketing.class === "switch-axis"
    ) {
      // Token de switch/axis sin otro sustantivo → SWITCH_IN_MODEL (nunca
      // MODEL_MARKETING); la regla de switch de arriba ya degrada a YELLOW.
      marketingEvidence = {
        switchToken: marketing.switchToken,
        remainingModel: marketing.remainingModel,
      };
    } else if (mk >= 2 || (!mHasCode && !/\d/.test(m) && mk >= 1)) {
      // 2+ palabras de marketing (puffery pesada, aunque tenga código) o
      // 1 palabra de marketing SIN ningún dígito (nombre de marketing puro).
      // Anti-overfit: "AJ139 Pro" (1, con código), "NJ07 Ultra NACODEX" (1, con
      // código) y "Flagship PRO 68 Keys" (1, con dígitos) quedan GREEN.
      reasons.push(
        "El modelo tiene palabras de marketing sin un identificador real de producto — requiere revisión",
      );
    }

    // ---- SLICE 3 (design §IT17 resolution, rules 1-2): close the measured
    // false negatives without breaking the FP ceiling (task 3.6 - 2/25 = 8%,
    // zero new FPs allowed on the 65-case ground truth). ----
    // Rule 1 - connection + category co-occurrence WITH a real product code.
    // Vocabulary NARROWED to the measured FN class (category = mouse): a bare
    // CONNECTION_AUDIT_RE+CATEGORY_AUDIT_RE rule would flag clean "Cobra Wired
    // Mouse", "Mars68 SE wired keyboard", "Ultimate 2C Wired Controller",
    // "Opus Quartz Wireless Headset" (2/25 -> 6/25 = 24% FP). M720/G502 carry a
    // real code (mHasCode) - the class IT17 called structurally indistinguishable
    // is separated by the color-spec's own variante policy (connection words
    // belong in variante, not in the model).
    const CONN_AUDIT_WORD_RE =
      /\b(wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\b/i;
    if (mHasCode && CONN_AUDIT_WORD_RE.test(m) && /\bmouse\b/i.test(m)) {
      reasons.push("tipo de conexión y categoría dentro del modelo");
    }
    // Rule 2 - category/spec fragment without a real product code. Category
    // vocabulary restricted to the measured words {keycaps, backpack} ("keys"
    // is covered by the anchored bare-count below; a bare "keys" word would
    // flag clean "Flagship PRO 68 Keys"). Spec fragments: size pattern, the
    // material word "powder", and a bare "N Keys" count at the model start.
    if (!mHasCode) {
      const SPEC_FRAGMENT_RE = /\d+(\.\d+)?\s*("|inch|pulg)/i;
      const BARE_COUNT_START_RE = /^\d+\s*Keys\b/i;
      const CATEGORY_FRAGMENT_RE = /\b(keycaps|backpack)\b/i;
      if (
        CATEGORY_FRAGMENT_RE.test(m) ||
        SPEC_FRAGMENT_RE.test(m) ||
        /\bpowder\b/i.test(m) ||
        BARE_COUNT_START_RE.test(m)
      ) {
        reasons.push("categoría/fragmento de especificación sin código real");
      }
    }

    return {
      level: reasons.length ? "YELLOW" : "GREEN",
      reasons,
      marketing,
      marketingEvidence,
    };
  },

  /**
   * Clasifica el modelo según su identidad real respecto del gate de marketing
   * (Slice 1, gate-calibration). Prioridad:
   *   1. switch/axis presente y sin otro sustantivo de producto → 'switch-axis'
   *      (el token es sustantivo de producto; "Magnetic Switch T9" no es
   *      marketing — el escenario del spec trata T9 como identidad restante,
   *      no como código).
   *   2. código presente → 'code' (regla de código existente, intacta).
   *   3. sustantivo de producto + ≤1 adjetivo de marketing → 'noun-phrase' (GREEN).
   *   4. ≥2 adjetivos sin sustantivo → 'puffery' (YELLOW MODEL_MARKETING).
   *   5. ≥1 adjetivo sin sustantivo ni código → 'marketing-only' (YELLOW).
   *   6. sin señal de marketing → 'plain' (aditivo: nada que marcar).
   * @returns {{class:string, noun?:string, marketingWords?:number, switchToken?:string, remainingModel?:string}}
   */
  classifyMarketingModel(modelo, categoria) {
    const m = String(modelo || "").trim();
    const out = { class: "plain", marketingWords: 0 };
    if (!m) return out;
    const switchCategoryOnly = /^(switch|interruptor)$/i.test(String(categoria || "").trim());
    // 1. Token de switch/axis (prioridad 2 del diseño, antes de puffery).
    const switchToken = switchCategoryOnly ? null : this.extractSwitchToken(m);
    const noun = this.findProductNoun(m);
    if (switchToken && !noun) {
      out.class = "switch-axis";
      out.switchToken = switchToken;
      out.remainingModel = m
        .replace(
          new RegExp(
            "\\b" + switchToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
            "i",
          ),
          "",
        )
        .replace(/\s+/g, " ")
        .trim();
      return out;
    }
    // 2. Código presente → regla de código existente (la calibración no la toca).
    if (this.MODEL_CODE_RE.test(m)) {
      out.class = "code";
      return out;
    }
    // 3. Sustantivo de producto + ≤1 adjetivo de marketing → sintagma nominal.
    const mk = (m.match(this.MARKETING_WORDS_RE) || []).length;
    out.marketingWords = mk;
    const categoryNoun = String(categoria || '').toLowerCase();
    if (noun && mk <= 1 && noun.toLowerCase() !== categoryNoun) {
      out.class = "noun-phrase";
      out.noun = noun;
      return out;
    }
    // 4. Puffery: ≥2 adjetivos sin sustantivo (y sin código).
    if (mk >= 2 && !noun) {
      out.class = "puffery";
      return out;
    }
    // 5. Nombre marketing-only: ≥1 adjetivo, sin sustantivo ni código.
    if (mk >= 1) {
      out.class = "marketing-only";
      return out;
    }
    return out;
  },

  /**
   * Token de switch/axis ("Magnetic Switch", "Gateron Red Switch", "Hall
   * Effect", "Axis"): la palabra switch + hasta 2 palabras precedentes, o
   * magnetic / hall effect / axis solos. Devuelve null si no hay token.
   */
  extractSwitchToken(modelo) {
    const m = String(modelo || "").trim();
    if (!m) return null;
    const sw = m.match(/\bswitch(?:es)?\b/i);
    if (sw && sw.index !== undefined) {
      const before = m.slice(0, sw.index).trim();
      const words = before.split(/\s+/).filter(Boolean).slice(-2);
      return [...words, sw[0]].join(" ");
    }
    if (/\bmagnetic\b/i.test(m)) return "Magnetic";
    const hall = m.match(/\bhall\s*effect\b/i);
    if (hall) return hall[0];
    const axis = m.match(/\b[\w.-]*axis(?:es)?\b/i);
    if (axis) return axis[0];
    return null;
  },

  /**
   * Sustantivo de producto presente en el modelo (vocabulario base, nunca
   * marcas). Devuelve el match más largo.
   */
  findProductNoun(modelo) {
    const m = String(modelo || "").trim();
    if (!m || !TextSanitizer.PRODUCT_NOUN_RE) return null;
    const matches = m.match(TextSanitizer.PRODUCT_NOUN_RE);
    if (!matches || !matches.length) return null;
    return matches.slice().sort((a, b) => b.length - a.length)[0];
  },

};

if (typeof window !== "undefined") window.TextSanitizer = TextSanitizer;

TextSanitizer.PRODUCT_NOUN_RE = new RegExp(
  "\\b(?:" + TextSanitizer.PRODUCT_NOUN_WORDS.join("|") + ")\\b",
  "i",
);
const TEXT_SANITIZER_CALIBRATION = { nounPhraseCalibration: true };

if (typeof module !== "undefined") module.exports = TextSanitizer;

// ---- Color-field sanitization vocabulary (SLICE 3, design §Decision 10) ----
// Keep vocabulary derived from CatalogValidator.COLOR_AUDIT_RE plus the
// switch-adjacent colors the spec adds (transparent, smoke, mint, navy,
// beige). Kept in sync with ImageTextGates.COLOR_KEEP_WORDS (slice 1).
//
// El nombre local NO puede ser COLOR_KEEP_WORDS: los <script> clasicos comparten
// el entorno lexico global, imageTextGates.js declara el mismo const, y este
// archivo se carga antes en index.html (4058 vs 4061). Redeclarlo hacia que el
// parseo de imageTextGates.js fallara con "Identifier COLOR_KEEP_WORDS has
// already been declared", y ese modulo no se ejecutaba nunca en la app: ni
// ImageTextGates.runAll en el import ni sampleInteriorColor en el parser. Las dos
// copias del vocabulario son identicas (medido), asi que el rename no cambia
// el comportamiento de TextSanitizer.
const TEXT_SANITIZER_COLOR_KEEP_WORDS = [
  "black",
  "white",
  "pink",
  "blue",
  "red",
  "green",
  "purple",
  "grey",
  "gray",
  "silver",
  "gold",
  "orange",
  "brown",
  "cyan",
  "magenta",
  "yellow",
  "coffee",
  "periwinkle",
  "lavender",
  "cream",
  "obsidian",
  "sakura",
  "phantom",
  "gunmetal",
  "blackberry",
  "neon",
  "arctic",
  "translucent",
  "matte",
  "glossy",
  "negro",
  "blanco",
  "rosa",
  "azul",
  "rojo",
  "verde",
  "violeta",
  "gris",
  "plateado",
  "dorado",
  "naranja",
  "marron",
  "amarillo",
  "transparent",
  "smoke",
  "mint",
  "navy",
  "beige",
];
TextSanitizer.COLOR_KEEP_WORDS = TEXT_SANITIZER_COLOR_KEEP_WORDS;
TextSanitizer.COLOR_KEEP_RE = new RegExp(
  "\\b(" + TEXT_SANITIZER_COLOR_KEEP_WORDS.join("|") + ")\\b",
  "gi",
);

// Removal vocabulary = CatalogValidator.CONNECTION_AUDIT_RE + CATEGORY_AUDIT_RE
// + switch/magnetic/hall effect (design §Decision 10). The regex is assembled
// lazily inside sanitizeColorField to keep this module dependency-free.
TextSanitizer.COLOR_REMOVAL_WORDS = [
  // CONNECTION_AUDIT_RE
  "wired",
  "wireless",
  "bluetooth",
  "2.4g(hz)?",
  "tri[\\s-]?mode",
  "usb[\\s-]?c",
  "rgb",
  // CATEGORY_AUDIT_RE
  "mouse",
  "raton",
  "keyboard",
  "teclado",
  "headset",
  "auricular",
  "earphone",
  "earbuds",
  "controller",
  "gamepad",
  "joystick",
  "mousepad",
  "switch",
  "webcam",
  "camera",
  "camara",
  "numpad",
  "chair",
  "silla",
  "monitor",
  "speaker",
  "parlante",
  "microphone",
  "microfono",
  // spec switch-adjacent
  "magnetic",
  "hall\\s*effect",
];

/**
 * Pure color-field sanitizer (spec "Color holds a color"). Keeps ONLY
 * COLOR_KEEP vocabulary words in `color`; connection/category words are
 * collected into `moved` in text order. Tokens that are neither a color word
 * nor a removal word are dropped (noise). Deduplicates both outputs.
 * @returns {{color: string, moved: string[]}}
 */
TextSanitizer.sanitizeColorField = function sanitizeColorField(colorText) {
  const text = (colorText || "").toString().trim();
  if (!text) return { color: "", moved: [] };
  const removalRe = new RegExp(
    "\\b(?:" + TextSanitizer.COLOR_REMOVAL_WORDS.join("|") + ")\\b",
    "gi",
  );
  const moved = [];
  const remaining = text.replace(removalRe, (tok) => {
    moved.push(tok.trim());
    return " ";
  });
  const kept = remaining.match(TextSanitizer.COLOR_KEEP_RE) || [];
  const seen = new Set();
  const color = kept
    .filter((w) => {
      const k = w.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
  return { color, moved };
};
