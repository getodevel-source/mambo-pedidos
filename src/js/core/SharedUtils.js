/**
 * Mambo Pedidos - Utilidades Compartidas
 * Funciones utilitarias puras usadas por múltiples módulos
 */

const SharedUtils = {

  /**
   * Extrae precio USD de una línea de texto
   */
  extractUsdPrice(line) {
    if (!line || typeof line !== 'string') return null;
    
    const match = line.match(/(?<![¥￥\d])\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (!match) return null;
    
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(price) || price < 0.10 || price > 500) return null;
    
    return price;
  },

  /**
   * Detecta marca desde texto usando patrones personalizados y nativos
   */
  detectBrand(text, customBrands = []) {
    if (!text) return null;
    
    const t = text.toLowerCase();
    
    // Marcas personalizadas
    for (const b of customBrands) {
      if (b.name && b.pattern) {
        try {
          if (new RegExp(b.pattern, 'i').test(t)) return b.name;
        } catch (e) {}
      }
    }
    
    // Marcas nativas con patrones específicos
    const brandPatterns = [
      ['8BitDo', /8bitdo|8-bitdo|8 bitdo/],
      ['Flydigi', /flydigi/],
      ['GameSir', /gamesir/],
      ['Attack Shark', /attack shark|attackshark/],
      ['Royal Kludge', /royal kludge|rk-s\d|rk61|rk87|r65 |r75 |r87 |rk-s98|rk-s75/],
      ['Irok', /\birok\b/],
      ['Mars', /mars75|mars68|mars mer|iyx|mars mer68|mars mER/],
      ['AJAZZ', /\bajazz\b|ak820|ak870|ak980|ak650|mk87/],
      ['AULA', /\baula\b|f75max|f75|f99|f108|au75/],
      ['ATK', /\batk\b|atk 68|atk rs6|atk rs7|atk v75|atk v100|atk vxe/],
      ['MCHOSE', /mchose|ace 68|ace68|ace 75|mix 87|mchose jet|mchose v9|mchose a7|mchose k7|mount tai|mad light/],
      ['VGN', /\bvgn\b|dragonfly/],
      ['Madlions', /\bmadlions\b|mad 60|mad 68|mad light|titan 68|mad 68 he|mad 68 r|mad 68 pro/],
      ['Razer', /\brazer\b|deathadder|viper v\d|blackwidow|huntsman|basilisk|naga v\d|cobra pro|orochi/],
      ['Logitech', /logitech m\d+|logitech g\d|logitech b\d|logitech pop|logitech mx|logitech lift|logitech ergo|logitech pebble/],
      ['KZ', /\bkz\b|zst|zsn pro|zs10 pro|zax|asx|edx pro|zex pro|pr1 hifi|eda |zar |zna /],
      ['Polaroid', /polaroid go|polaroid color|polaroid b&w|polaroid i-2|polaroid duochrome|polaroid sx-70/],
      ['Philips', /philips electric shaver|philips hairclipper|philips nose|electric toothbrush|sonic toothbrush|s1125|s5366|x5001|s5831|pq888|s8850|s9935|s9642|hc\d{4}|nt\d{4}|hx\d{4}/],
      ['Haimu', /haimu|seasalt switch|midnight blue switch|flamingo switch|ice silve switch|heartbeat switch/],
      ['MACHENIKE', /machenike/],
      ['Akko', /\bakko\b/],
      ['Keychron', /keychron/],
      ['Darmoshark', /darmoshark/]
    ];
    
    for (const [brand, pattern] of brandPatterns) {
      if (pattern.test(t)) return brand;
    }
    
    return null;
  },

  /**
   * Detecta categoría desde texto
   */
  detectCategory(text, brand = '') {
    if (!text) return 'OTRO';
    
    const t = text.toLowerCase();
    
    // Categorías por marca específica
    if (brand === 'Polaroid') return 'CAMARA';
    if (brand === 'KZ') return 'AURICULAR';
    if (brand === 'Haimu') return 'SWITCH';
    if (brand === 'Philips') return 'CUIDADO_PERSONAL';
    if (['8BitDo', 'Flydigi', 'GameSir'].includes(brand)) return 'CONTROLLER';
    
    // Categorías por palabras clave
    const categoryPatterns = [
      ['NUMPAD', /\b(numpad|numeric keypad|keypad|np20|ak33 numpad)\b/i],
      ['CONTROLLER', /\b(controller|gamepad|joystick|mando|sn30|ultimate 2c|ultimate c|ultimate 3|vader|g7 se|t4 kaleid|g8 galileo)\b/i],
      ['AURICULAR', /\b(earphone|earbuds|in-ear|iem|zst|zsn|zs10|zax|asx|edx|zex|pr1|eda|zar|zna|dqs)\b/i],
      ['HEADSET', /\b(headset|headphone|gaming headset|v9 turbo|a7v3|k7v2|a5v3|cloud ii|barracuda|kraken|g435|g733)\b/i],
      ['MOUSEPAD', /\b(mousepad|mouse pad|deskmat|desk mat|playmat|tablemat|glass pad|poron pad|cordura pad|control pad|speed pad|cloth pad|glide pad|extended pad|rgb pad|custom pad|anti-slip mat)\b|\bmat\b/i],
      ['MOUSE', /\b(mouse|mice|raton|paw\d{4}|aj139\w*|aj159\w*|aj199\w*|ax5\w*|a5|l7|g3|sc200|sc580|x3|r1|x11|v989|f1 pro|dragonfly|f2 master|v989|f1 pro|dragonfly|f2 master|viper|deathadder|basilisk|cobra|orochi|g305|g203|pebble)\b/i],
      ['MONITOR', /\b(monitor|display|144hz|240hz|360hz|oled monitor)\b/i],
      ['SWITCH', /\b(key switch|mechanical switch|linear switch|tactile switch|clicky switch|seasalt switch|flamingo switch)\b/i],
      ['TECLADO', /\b(keyboard|teclado|f75|f99|f108|k87|k68|ak820|ak870|ak980|ak650|mk87|mad 60|mad 68|titan 68|atk 68|atk rs|atk v|rk61|rk87|r65|r75|mars75|mars68|blackwidow|huntsman|ace 68|ace 75|mix 87|jet 75|fizz|kumara)\b/i]
    ];
    
    for (const [cat, pattern] of categoryPatterns) {
      if (pattern.test(t)) return cat;
    }
    
    return 'OTRO';
  },

  /**
   * Genera SKU único basado en marca, categoría e índice
   */
  generateSku(brand, category, index, baseLength = 0) {
    const brandCode = (brand || 'OTR').substring(0, 3).toUpperCase();
    const catCode = (category || 'OTR').substring(0, 3).toUpperCase();
    const seqNum = String(baseLength + index + 1).padStart(4, '0');
    return `${brandCode}-${catCode}-${seqNum}`;
  },

  /**
   * Crea clave única para deduplicación
   */
  createDedupeKey(brand, modelo, variante, fob) {
    return `${brand}|${modelo.substring(0, 50)}|${variante.substring(0, 30)}|${fob}`.toLowerCase();
  },

  /**
   * Verifica si un valor es ruido de encabezado
   */
  isHeaderNoise(text) {
    if (!text || text.length < 2) return true;
    
    const NOISE_PATTERN = /\b(model|model\s*color|color|price|rmb|usd|picture|image|spec|specification|remark|note|moq|fob|cny|usd\s*price|rmb\s*price)\b/i;
    const matches = text.match(new RegExp(NOISE_PATTERN.source, 'gi'));
    return matches && matches.length >= 2;
  },

  /**
   * Verifica si un texto es ruido de página (metadatos, footer, etc.)
   */
  isPageNoise(text) {
    if (!text || text.length < 2) return true;
    if (/^[\u4e00-\u9fff\s]+$/.test(text)) return true;
    if (/zhengzhou|damulin|www\.|http|tel:|fax:|page\s*\d+/i.test(text)) return true;
    if (this.isHeaderNoise(text)) return true;
    return false;
  },

  /**
   * Evalúa confianza de un ítem de producto
   */
  evaluateItemConfidence(item) {
    let confidence = 100;
    const warnings = [];

    if (!item.marca || item.marca === 'OTRO') {
      confidence -= 30;
      warnings.push('Marca no identificada automáticamente');
    }

    if (!item.cat || item.cat === 'OTRO') {
      confidence -= 20;
      warnings.push('Categoría no identificada');
    }

    if (!item.modelo || item.modelo.length < 3) {
      confidence -= 25;
      warnings.push('Nombre de modelo inusualmente corto');
    }

    if (item.fob < 0.50 || item.fob > 350.00) {
      confidence -= 15;
      warnings.push(`Precio FOB USD ($${item.fob.toFixed(2)}) fuera de rango habitual`);
    }

    let status = 'VALID';
    if (confidence < 60) status = 'ERROR';
    else if (confidence < 85) status = 'WARNING';

    return { 
      confidence: Math.max(0, confidence), 
      status, 
      warnings 
    };
  }
};

if (typeof window !== 'undefined') window.SharedUtils = SharedUtils;
if (typeof module !== 'undefined') module.exports = SharedUtils;
