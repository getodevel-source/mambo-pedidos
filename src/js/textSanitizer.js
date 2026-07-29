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
  HEADER_NOISE_REGEX: /^(CNY|RMB|USD|EUR|PRICE|COLOR|MODEL|PICTURE|IMAGE|SPEC|REMARK|MOQ|FOB|\.|\-|\s)+$/i,
  MONEY_NOISE_REGEX: /\b(CNY|RMB|USD|EUR)\s*\$?[\d\.,]+\b/gi,
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
    let fob = parseFloat(item.fob) || 0;

    // 1. Limpieza de Modelo
    modelo = this.removeCorporateNoise(modelo);
    modelo = this.removeMoneyNoise(modelo);
    modelo = modelo.replace(/^[\.\s-]+/, '');

    if (this.isHeaderNoise(modelo) || modelo.toLowerCase().startsWith('producto item')) {
      modelo = '';
    }

    // 2. Limpieza de Variante / Color
    if (variante) {
      if (this.PRICE_DECIMAL_REGEX.test(variante) || /^[\d\.,\s]+$/.test(variante) || this.isHeaderNoise(variante)) {
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

    // 4. Detección de Categoría
    if (!cat || cat === 'OTRO') {
      cat = this.detectCategoryFromText(modelo + ' ' + variante);
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

  /**
   * Remueve ruido corporativo de un texto
   */
  removeCorporateNoise(text) {
    return text.replace(this.CORPORATE_NOISE_REGEX, '');
  },

  /**
   * Remueve referencias de dinero de un texto
   */
  removeMoneyNoise(text) {
    return text.replace(this.MONEY_NOISE_REGEX, '');
  },

  /**
   * Verifica si un texto es ruido de encabezado
   */
  isHeaderNoise(text) {
    return this.HEADER_NOISE_REGEX.test(text);
  },

  /**
   * Intenta clasificar la categoría basada en palabras clave del título o variante.
   */
  detectCategoryFromText(text = '') {
    const t = text.toUpperCase();
    if (t.includes('KEYBOARD') || t.includes('TECLADO')) return 'TECLADO';
    if (t.includes('NUMPAD') || t.includes('TECLADO NUMERICO')) return 'NUMPAD';
    if (t.includes('MOUSEPAD') || t.includes('PAD')) return 'MOUSEPAD';
    if (t.includes('MOUSE') || t.includes('RATON')) return 'MOUSE';
    if (t.includes('HEADSET') || t.includes('AURICULAR CON MICROFONO')) return 'HEADSET';
    if (t.includes('AURICULAR') || t.includes('EARPHONE') || t.includes('EARBUD')) return 'AURICULAR';
    if (t.includes('CONTROLLER') || t.includes('GAMEPAD') || t.includes('JOYSTICK')) return 'CONTROLLER';
    if (t.includes('SWITCH') || t.includes('INTERRUPTOR')) return 'SWITCH';
    if (t.includes('CAMARA') || t.includes('WEBCAM') || t.includes('CAMERA')) return 'CAMARA';
    if (t.includes('TRIMMER') || t.includes('CUIDADO PERSONAL') || t.includes('AFEITADORA')) return 'CUIDADO_PERSONAL';
    return 'OTRO';
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
  }
};

if (typeof window !== 'undefined') window.TextSanitizer = TextSanitizer;
if (typeof module !== 'undefined') module.exports = TextSanitizer;
