// ============================================
// Mambo Pedidos - Clasificador puro del Parser (IT35)
// Marca, categoría, precio y limpieza de títulos — extraídos de pdfParser.js
// SIN cambiar comportamiento (mismo código, misma API via Object.assign).
// Métodos usan `this.` para cross-references → funcionan asignados a PdfParser.
// ============================================

const PdfParserClassifier = {
  extractUsdPrice(line) {
    const match = line.match(/(?<![¥￥\d])\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(price) || price < 0.10 || price > 500) return null;
    return price;
  },

  detectBrandFromTextLine(text, customBrands = []) {
    const t = (text || '').toLowerCase();

    // 1. Revisar diccionario personalizado guardado por el usuario
    for (const b of customBrands) {
      if (b.name && b.pattern) {
        try {
          const re = new RegExp(b.pattern, 'i');
          if (re.test(t)) return b.name;
        } catch {}
      }
    }

    // 2. Diccionario nativo
    if (/8bitdo|8-bitdo|8 bitdo/.test(t)) return '8BitDo';
    if (/flydigi/.test(t)) return 'Flydigi';
    if (/gamesir/.test(t)) return 'GameSir';
    if (/attack shark|attackshark/.test(t)) return 'Attack Shark';
    if (/royal kludge|rk-s\d|rk61|rk87|r65 |r75 |r87 |rk-s98|rk-s75/.test(t)) return 'Royal Kludge';
    if (/\birok\b/.test(t)) return 'Irok';
    if (/mars75|mars68|mars mer|iyx|mars mer68|mars mER/.test(t)) return 'Mars';
    if (/\bajazz\b|ak820|ak870|ak980|ak650|mk87/.test(t)) return 'AJAZZ';
    if (/\baula\b|f75max|f75|f99|f108|au75/.test(t)) return 'AULA';
    if (/\batk\b|atk 68|atk rs6|atk rs7|atk v75|atk v100|atk vxe/.test(t)) return 'ATK';
    if (/mchose|ace 68|ace68|ace 75|mix 87|mchose jet|mchose v9|mchose a7|mchose k7|mount tai|mad light/.test(t)) return 'MCHOSE';
    if (/\bvgn\b|dragonfly/.test(t)) return 'VGN';
    if (/\bmadlions\b|mad 60|mad 68|mad light|titan 68|mad 68 he|mad 68 r|mad 68 pro/.test(t)) return 'Madlions';
    if (/\brazer\b|deathadder|viper v\d|blackwidow|huntsman|basilisk|naga v\d|cobra pro|orochi/.test(t)) return 'Razer';
    if (/logitech m\d+|logitech g\d|logitech b\d|logitech pop|logitech mx|logitech lift|logitech ergo|logitech pebble/.test(t)) return 'Logitech';
    if (/\bkz\b|zst|zsn pro|zs10 pro|zax|asx|edx pro|zex pro|pr1 hifi|eda |zar |zna /.test(t)) return 'KZ';
    if (/polaroid go|polaroid color|polaroid b&w|polaroid i-2|polaroid duochrome|polaroid sx-70/.test(t)) return 'Polaroid';
    if (/philips electric shaver|philips hairclipper|philips nose|electric toothbrush|sonic toothbrush|s1125|s5366|x5001|s5831|pq888|s8850|s9935|s9642|hc\d{4}|nt\d{4}|hx\d{4}/.test(t)) return 'Philips';
    if (/haimu|seasalt switch|midnight blue switch|flamingo switch|ice silve switch|heartbeat switch/.test(t)) return 'Haimu';
    if (/machenike/.test(t)) return 'MACHENIKE';
    if (/\bakko\b/.test(t)) return 'Akko';
    if (/keychron/.test(t)) return 'Keychron';
    if (/darmoshark/.test(t)) return 'Darmoshark';
    return null;
  },

  detectBrandFromContent(text, customBrands = []) {
    const t = (text || '').toLowerCase().substring(0, 3000);

    for (const b of customBrands) {
      if (b.name && b.pattern) {
        try {
          const re = new RegExp(b.pattern, 'i');
          if (re.test(t)) return b.name;
        } catch {}
      }
    }

    const checks = [
      ['8BitDo', ['8bitdo']],
      ['Flydigi', ['flydigi']],
      ['GameSir', ['gamesir']],
      ['AJAZZ', ['ajazz']],
      ['AULA', ['damulin -aula', 'aula 75%', 'aula catalogue']],
      ['ATK', ['atk catalog', 'atk price list']],
      ['Attack Shark', ['attack shark']],
      ['MCHOSE', ['mchose', '迈从']],
      ['VGN', ['vgn zhengzhou', 'vgn-damulin']],
      ['Madlions', ['madlions']],
      ['Razer', ['razer zhengzhou']],
      ['Logitech', ['logitech zhengzhou']],
      ['Royal Kludge', ['royal kludge']],
      ['Irok', ['mars&iyx', 'irok mars iyx', 'mars &iyx']],
      ['KZ', ['kz price list', 'kz catalog']],
      ['Polaroid', ['polaroid zhengzhou']],
      ['Philips', ['philips catalogue']],
      ['Haimu', ['haimu switch']],
    ];
    for (const [brand, patterns] of checks) {
      for (const p of patterns) {
        if (t.includes(p)) return brand;
      }
    }
    return null;
  },

  detectBrandFromFilename(filename, customBrands = []) {
    const f = filename.toLowerCase();

    for (const b of customBrands) {
      if (b.name && b.pattern) {
        try {
          const re = new RegExp(b.pattern, 'i');
          if (re.test(f)) return b.name;
        } catch {}
      }
    }

    if (f.includes('8bitdo')) return '8BitDo';
    if (f.includes('ajazz')) return 'AJAZZ';
    if (f.includes('aula')) return 'AULA';
    if (f.includes('atk')) return 'ATK';
    if (f.includes('attack')) return 'Attack Shark';
    if (f.includes('mchose') || f.includes('迈从')) return 'MCHOSE';
    if (f.includes('vgn')) return 'VGN';
    if (f.includes('madlions')) return 'Madlions';
    if (f.includes('razer')) return 'Razer';
    if (f.includes('logitech')) return 'Logitech';
    if (f.includes('royal kludge') || (f.includes('rk') && f.includes('catalog'))) return 'Royal Kludge';
    if (f.includes('irok') || (f.includes('mars') && f.includes('iyx'))) return 'Irok';
    if (f.includes('kz') && (f.includes('catalog') || f.includes('damulin'))) return 'KZ';
    if (f.includes('polaroid')) return 'Polaroid';
    if (f.includes('philips')) return 'Philips';
    if (f.includes('keyboard switch')) return 'Haimu';
    if (f.includes('flydigi')) return 'Flydigi';
    if (f.includes('gamesir')) return 'GameSir';
    return 'OTRO';
  },

  detectCategory(text, brand) {
    const result = this.detectCategoryWithEvidence(text, brand);
    return result.category;
  },

  /**
   * Detect category with structured evidence for diagnostics.
   * @param {string} text - Product text to analyze
   * @param {string} brand - Detected brand (for fallback)
   * @returns {{ category: string, confidence: number, source: string, matchedPattern: string, analyzedText: string }}
   */
  detectCategoryWithEvidence(text, brand) {
    const t = (text || '').toLowerCase();
    const evidence = { category: 'OTRO', confidence: 0, source: 'none', matchedPattern: '', analyzedText: t.substring(0, 100) };

    // 1. Marcas de categoría ÚNICA
    const singleBrand = { 'Polaroid': 'CAMARA', 'KZ': 'AURICULAR', 'Haimu': 'SWITCH', 'Philips': 'CUIDADO_PERSONAL' };
    if (brand && singleBrand[brand]) {
      return Object.assign(evidence, { category: singleBrand[brand], confidence: 95, source: 'brand-exclusive', matchedPattern: brand });
    }

    // 2. Detección por TEXTO (keyword patterns with confidence tiers)
    const patterns = [
      { cat: 'NUMPAD', re: /\b(numpad|numeric keypad|keypad|np20|ak33 numpad)\b/i, conf: 90 },
      { cat: 'CONTROLLER', re: /\b(controller|gamepad|joystick|mando|sn30|ultimate 2c|ultimate c|ultimate 3|vader|g7 se|t4 kaleid|g8 galileo)\b/i, conf: 90 },
      { cat: 'AURICULAR', re: /\b(earphone|earbuds|in-ear|iem|zst|zsn|zs10|zax|asx|edx|zex|pr1|eda|zar|zna|dqs)\b/i, conf: 90 },
      { cat: 'HEADSET', re: /\b(headset|headphone|gaming headset|v9 turbo|a7v3|k7v2|a5v3|cloud ii|barracuda|kraken|blackshark|g435|g733|g335|zone wired|zone wireless)\b/i, conf: 90 },
      { cat: 'MOUSEPAD', re: /\b(mousepad|mouse pad|deskmat|desk mat|playmat|tablemat|glass pad|poron pad|cordura pad|control pad|speed pad|cloth pad|glide pad|extended pad|rgb pad|custom pad|anti-slip mat|goliathus|firefly|sphex|large pad|xl pad)\b/i, conf: 90 },
      { cat: 'MOUSE', re: /\b(mouse|mice|raton|paw\d{4}|aj139\w*|aj159\w*|aj199\w*|ax5\w*|a5|l7|g3|sc200|sc580|x3|r1|x11\w*|v989|f1 pro|dragonfly|f2 master|viper|deathadder|basilisk|cobra|orochi|naga|g305|g203|pebble|m100r|m90|b100|m170|m185|m220|m240|m275|m280|m310|m317|m325|m330|m500|m505|m510|m525|m650|m720|m750|mx\s*master|mx\s*anywhere|g102|g203|g304|g305|g402|g403|g502|g600|g602|g603|g604|g700|g703|g900|g903|gpro)\b/i, conf: 85 },
      { cat: 'MONITOR', re: /\b(monitor|display|144hz|240hz|360hz|oled monitor)\b/i, conf: 85 },
      { cat: 'CAMARA', re: /\b(webcam|camera|streamcam|brio|c920|c922|c930|kiyo|c270|c310)\b/i, conf: 85 },
      { cat: 'TECLADO', re: /\b(keyboard|teclado|f75|f99|f108|k87|k68|ak820|ak870|ak980|ak680|ak650|mk87|mad\s*60|mad\s*68|titan\s*68|atk\s*68|atk\s*rs|atk\s*v|rk61|rk87|r65|r75|mars75|mars68|blackwidow|huntsman|ornata|ace\s*68|ace\s*75|mix\s*87|jet\s*75|fizz|kumara|v75x|v100pro|rs6|68rx|68\s*v3|g915|g815|g713|g613|g512|g413|g213|k845|k840|mx\s*keys|pop\s*keys|mount\s*tai)\b/i, conf: 85 },
      { cat: 'SWITCH', re: /\b(key switch|mechanical switch|linear switch|tactile switch|clicky switch|seasalt switch|flamingo switch|magnetic switch|hall effect|he switch)\b/i, conf: 85 },
      { cat: 'ACCESORIO', re: /\b(microphone|mic|condenser|streaming mic)\b/i, conf: 80 },
      { cat: 'ACCESORIO', re: /\b(keycap|key\s*cap|wrist\s*rest|hand\s*rest|grip\s*tape|dongle|charging\s*puck|base\s*station|coiled\s*cable|digital\s*pencil|crayon|presentation\s*remote|steering\s*wheel|shifter|pedals|mouse\s*feet|skates|glides|bungee|mouse\s*bungee|light\s*strip|phone\s*cooler|cushion|pillow|almohad|backpack|power\s*supply|thunderbolt|finger\s*sleeve|studs?|head\s*cushion|lumbar)\b/i, conf: 80 },
      { cat: 'SPEAKER', re: /\b(speaker|leviathan|nommo|soundbar)\b/i, conf: 85 },
      { cat: 'SILLA_GAMING', re: /\b(chair|enki|iskur|fujin|gaming\s*chair)\b/i, conf: 85 },
      { cat: 'ACCESORIO', re: /\b(fan|kunai|hanbo|computer\s*case|tomahawk|aio\s*cooler|cpu\s*cooler)\b/i, conf: 75 },
      { cat: 'TECLADO', re: /\b(keys?\b.*\baxis|axis\b.*\bkeys?|\d+\s*keys|\baxis\b)\b/i, conf: 60 },
      // IT22: electrodomésticos / electrónica de consumo (generalización)
      { cat: 'CELULAR', re: /\b(smartphone|celular|iphone|galaxy|redmi|poco x|poco f|aparelho)\b/i, conf: 85 },
      { cat: 'IMPRESORA', re: /\b(printer|impresora|multifunction|multifuncional|inkjet|laserjet)\b/i, conf: 88 },
      { cat: 'LAVADORA', re: /\b(washing machine|lavadora|lavarropas|washer|lavasecarropas)\b/i, conf: 88 },
      { cat: 'HELADERA', re: /\b(refrigerator|fridge|heladera|freezer|congelador|refrigerador)\b/i, conf: 88 },
      { cat: 'MICROONDAS', re: /\b(microwave|microondas|micro ondas)\b/i, conf: 88 },
      { cat: 'AIRE', re: /\b(air conditioner|aire acondicionado|split acondicionado|acondicionado de aire)\b/i, conf: 88 },
      { cat: 'ASPIRADORA', re: /\b(vacuum cleaner|aspiradora|robot vacuum|roomba|scooba)\b/i, conf: 88 },
      { cat: 'CAFETERA', re: /\b(coffee maker|cafetera|espresso machine|nespresso|dolce gusto)\b/i, conf: 88 },
      { cat: 'LICUADORA', re: /\b(blender|licuadora|food processor|procesadora)\b/i, conf: 85 },
      { cat: 'PLANCHA', re: /\b(steam iron|plancha|vaporizador)\b/i, conf: 85 },
      { cat: 'TV', re: /\b(television|smart tv|led tv|oled tv|qled tv|curved tv)\b/i, conf: 85 }
    ];

    // #6: Short ambiguous tokens that cause false positives
    const AMBIGUOUS_TOKENS = new Set(['a5', 'l7', 'g3', 'x3', 'r1', 'mat', 'a5v3']);

    for (const p of patterns) {
      const match = t.match(p.re);
      if (match) {
        const matched = match[0].toLowerCase().trim();
        let conf = p.conf;
        let source = 'text-keyword';
        // Short ambiguous tokens get reduced confidence + warning
        if (AMBIGUOUS_TOKENS.has(matched)) {
          conf = Math.min(conf, 40);
          source = 'text-keyword-ambiguous';
        }
        return Object.assign(evidence, { category: p.cat, confidence: conf, source, matchedPattern: match[0] });
      }
    }

    // 3. Brand fallback como ÚLTIMO recurso
    const brandFallback = {
      '8BitDo': 'CONTROLLER', 'Flydigi': 'CONTROLLER', 'GameSir': 'CONTROLLER',
      'Attack Shark': 'MOUSE',
      'Madlions': 'TECLADO', 'MCHOSE': 'TECLADO', 'Royal Kludge': 'TECLADO',
      'ATK': 'TECLADO', 'AULA': 'TECLADO', 'AJAZZ': 'TECLADO',
      'Irok': 'TECLADO', 'Mars': 'TECLADO'
    };
    if (brand && brandFallback[brand]) {
      return Object.assign(evidence, { category: brandFallback[brand], confidence: 50, source: 'brand-fallback', matchedPattern: brand });
    }

    // 4. OTRO with diagnostic
    evidence.source = 'no-match';
    evidence.matchedPattern = '';
    return evidence;
  },

  guessCategory(modelo, variante) {
    return this.detectCategory((modelo || '') + ' ' + (variante || ''), '');
  },

  cleanProductTitle(rawText, brand = '') {
    if (!rawText) return { modelo: '', variante: '' };

    let text = String(rawText).replace(/\s+/g, ' ').trim();

    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      text = text.replace(reBrand, '').trim();
    }

    // Desduplicar fragmentos de texto repetidos (ej: "AJ139 V2 MC ... AJ139 V2 MC")
    const words = text.split(/\s+/);
    const uniqueWords = [];
    const seenWords = new Set();
    for (const w of words) {
      const lower = w.toLowerCase();
      if (!seenWords.has(lower) || w.length <= 2 || /^[\d.,$/-]+$/.test(w)) {
        if (w.length > 2) seenWords.add(lower);
        uniqueWords.push(w);
      }
    }
    text = uniqueWords.join(' ');

    if (typeof TextSanitizer !== 'undefined' && TextSanitizer.parseModelAndVariant) {
      return TextSanitizer.parseModelAndVariant(text, brand);
    }

    const parts = text.split(/\s+-\s+|\s*\(\s*/);
    const modelo = parts[0] ? parts[0].trim().substring(0, 60) : text.substring(0, 60);
    const variante = parts.slice(1).join(' ').replace(/[}\])]/g, '').trim().substring(0, 60);

    return { modelo, variante };
  }
};

if (typeof window !== 'undefined') window.PdfParserClassifier = PdfParserClassifier;
if (typeof module !== 'undefined') module.exports = PdfParserClassifier;
