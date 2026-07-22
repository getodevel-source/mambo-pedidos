// ============================================
//  Mambo Pedidos - Parser de PDFs v2
//  Extracción precisa basada en análisis real de los 16 PDFs del catálogo
//  Desarrollado por @geto_dev
// ============================================

const PdfParser = {

  async processPdfFile(file, catalogLength = 0) {
    let pdf = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join('\n') + '\n';
      }

      const cleanText = fullText.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.');
      }

      const brand = this.detectBrandFromContent(fullText) || this.detectBrandFromFilename(file.name);
      const products = this.parsePdfProducts(fullText, brand, catalogLength);
      return { brand, products };
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try { await pdf.destroy(); } catch (e) {}
      }
    }
  },

  // ─── Punto de entrada del parser ────────────────────────────────────────────
  parsePdfProducts(text, brandFallback, baseLength = 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const products = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extraer precio USD de la línea actual
      const usdPrice = this.extractUsdPrice(line);
      if (usdPrice === null) continue;

      // Extraer marca y modelo del contexto alrededor de esta línea
      const ctx = this.buildContext(lines, i);
      if (!ctx.modelo) continue;

      // Determinar marca
      const detectedBrand = this.detectBrandFromTextLine(ctx.rawText) || brandFallback || 'OTRO';

      // Determinar categoría
      const cat = this.detectCategory(ctx.rawText, detectedBrand);

      // Clave de deduplicación
      const key = (detectedBrand + '|' + ctx.modelo.substring(0, 50) + '|' + ctx.variante.substring(0, 30) + '|' + usdPrice).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const catCode = cat.substring(0, 3).toUpperCase();
      const brandCode = detectedBrand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, '0')}`;

      products.push({
        sku,
        cat,
        marca: detectedBrand,
        modelo: ctx.modelo,
        variante: ctx.variante,
        fob: usdPrice,
      });
    }

    return products;
  },

  // ─── Extracción de precio USD ────────────────────────────────────────────────
  extractUsdPrice(line) {
    // Precio en USD con símbolo $ (no ¥ ni ￥)
    // Formatos encontrados: "$35.19", "$ 49.09", "$1,170.21"
    // El precio debe estar entre $0.10 y $500 para ser un producto válido de catálogo
    const match = line.match(/(?<![¥￥])\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(price) || price < 0.10 || price > 500) return null;
    return price;
  },

  // ─── Construcción de contexto alrededor del precio ──────────────────────────
  buildContext(lines, priceIdx) {
    const ignoreLine = (l) => {
      if (!l || l.length < 2) return true;
      if (/^[\u4e00-\u9fff\s]+$/.test(l)) return true;  // Solo chino
      if (/zhengzhou|damulin/i.test(l)) return true;
      if (/^(page|pg\.?)\s*\d+$/i.test(l)) return true;
      if (/^[\d\s\.,\-]+$/.test(l)) return true;  // Solo números
      if (/^(model|product|picture|photo|image|switch|color|colour|axis|wired|wireless)$/i.test(l)) return true;
      if (/^(cny|rmb|usd|price|remark|note)$/i.test(l)) return true;
      if (/^\$\s*\d/.test(l)) return true;  // Es una línea de precio
      if (/^[¥￥]\s*[\d,]+/.test(l)) return true;  // Es precio en RMB
      if (/^[A-Z]{2}\d{2}-[\dA-Z-]+$/.test(l)) return true;  // Código Razer RZ01-xxx
      if (/^\d{13}$/.test(l)) return true;  // EAN barcode
      if (l.length > 100) return true;
      return false;
    };

    // Recopilar hasta 8 líneas previas NO ignoradas
    const prev = [];
    for (let j = priceIdx - 1; j >= Math.max(0, priceIdx - 12) && prev.length < 8; j--) {
      const l = lines[j];
      // Parar si hay otro precio USD en el camino
      if (this.extractUsdPrice(l) !== null) break;
      if (!ignoreLine(l)) prev.unshift(l);
    }

    // También incluir texto de la línea del precio (puede tener modelo)
    const priceLine = lines[priceIdx];
    const priceLineModel = priceLine.replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g, '').trim();

    const rawText = [...prev, priceLineModel].join(' ').replace(/\s+/g, ' ').trim();

    if (!rawText || rawText.length < 2) return { modelo: '', variante: '', rawText: '' };

    // El primer token significativo es el modelo, el resto variante
    const parts = prev.length > 0 ? prev : [priceLineModel];
    const modelo = parts[0] ? parts[0].substring(0, 80).trim() : '';
    const variante = parts.slice(1, 4).join(' ').replace(/\s+/g, ' ').trim().substring(0, 80);

    return { modelo, variante, rawText };
  },

  // ─── Detección de marca desde una línea de texto ────────────────────────────
  detectBrandFromTextLine(text) {
    const t = (text || '').toLowerCase();
    // Orden importante: marcas más específicas primero
    if (/8bitdo|8-bitdo|8 bitdo/.test(t)) return '8BitDo';
    if (/flydigi/.test(t)) return 'Flydigi';
    if (/gamesir/.test(t)) return 'GameSir';
    if (/attack shark|attackshark/.test(t)) return 'Attack Shark';
    if (/royal kludge|rk-s\d|rk\d{2}(?:\s|$)|rk61|rk87|r65|r75|r87/.test(t)) return 'Royal Kludge';
    if (/\birok\b/.test(t)) return 'Irok';
    if (/mars75|mars68|mars mer|iyx/.test(t)) return 'Mars';
    if (/\bajazz\b|ak820|ak870|ak980|ak650|mk87/.test(t)) return 'AJAZZ';
    if (/\baula\b|f75|f75max|f99|f108|au75/.test(t)) return 'AULA';
    if (/\batk\b|atk 68|atk rs6|atk rs7|atk v75|atk v100/.test(t)) return 'ATK';
    if (/mchose|mchose ace|ace 68|ace 75|mix 87|mchose jet|mchose v9|mchose a7|mchose k7/.test(t)) return 'MCHOSE';
    if (/\bvgn\b|dragonfly/.test(t)) return 'VGN';
    if (/\bmadlions\b|mad 60|mad 68|mad light|mad 60 he|titan 68|mad 68 he|mad 68 r|mad 68 pro/.test(t)) return 'Madlions';
    if (/\brazer\b|deathadder|viper v|blackwidow|huntsman|basilisk|naga v|cobra pro|orochi|razer/.test(t)) return 'Razer';
    if (/\blogitech\b|logitech m\d|logitech g\d|logitech pop|logitech mx|logitech lift/.test(t)) return 'Logitech';
    if (/\bkz\b|zst|zsn|zs10|zax|asx|edx|zex|das|eda|zar/.test(t)) return 'KZ';
    if (/\bpolaroid\b|polaroid go|polaroid i-2/.test(t)) return 'Polaroid';
    if (/\bphilips\b|philips electric|philips hairclipper|hx\d{4}/.test(t)) return 'Philips';
    if (/haimu switch/.test(t)) return 'Haimu';
    if (/machenike/.test(t)) return 'MACHENIKE';
    if (/\bakko\b/.test(t)) return 'Akko';
    if (/keychron/.test(t)) return 'Keychron';
    if (/darmoshark/.test(t)) return 'Darmoshark';
    return null;
  },

  // ─── Detección de marca desde el texto completo del PDF ─────────────────────
  detectBrandFromContent(text) {
    const t = (text || '').toLowerCase().substring(0, 3000);
    const checks = [
      ['8BitDo', ['8bitdo']],
      ['Flydigi', ['flydigi']],
      ['GameSir', ['gamesir']],
      ['AJAZZ', ['ajazz']],
      ['AULA', ['zhengzhou damulin -aula', 'aula 75%', 'aula catalogue']],
      ['ATK', ['atk catalog', 'atk price list']],
      ['Attack Shark', ['attack shark']],
      ['MCHOSE', ['mchose', '迈从']],
      ['VGN', ['vgn\nzhengzhou', 'vgn-damulin']],
      ['Madlions', ['madlions']],
      ['Razer', ['razer\nzhengzhou']],
      ['Logitech', ['logitech\nzhengzhou']],
      ['Royal Kludge', ['royal kludge']],
      ['Irok', ['mars&iyx &irok', 'irok mars iyx']],
      ['KZ', ['kz price list']],
      ['Polaroid', ['polaroid\nzhengzhou']],
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

  // ─── Detección de marca desde el nombre de archivo ──────────────────────────
  detectBrandFromFilename(filename) {
    const f = filename.toLowerCase();
    if (f.includes('8bitdo')) return '8BitDo';
    if (f.includes('ajazz')) return 'AJAZZ';
    if (f.includes('aula')) return 'AULA';
    if (f.includes('atk')) return 'ATK';
    if (f.includes('attack') || f.includes('attackshark')) return 'Attack Shark';
    if (f.includes('mchose') || f.includes('迈从')) return 'MCHOSE';
    if (f.includes('vgn')) return 'VGN';
    if (f.includes('madlions')) return 'Madlions';
    if (f.includes('razer')) return 'Razer';
    if (f.includes('logitech')) return 'Logitech';
    if (f.includes('royal kludge') || f.includes('rk ')) return 'Royal Kludge';
    if (f.includes('irok') || f.includes('mars') || f.includes('iyx')) return 'Irok';
    if (f.includes('kz')) return 'KZ';
    if (f.includes('polaroid')) return 'Polaroid';
    if (f.includes('philips')) return 'Philips';
    if (f.includes('keyboard switch')) return 'Haimu';
    if (f.includes('flydigi')) return 'Flydigi';
    if (f.includes('gamesir')) return 'GameSir';
    return 'OTRO';
  },

  // ─── Categorización ─────────────────────────────────────────────────────────
  detectCategory(text, brand) {
    const t = (text || '').toLowerCase();

    // Categorías por marca que no tienen ambigüedad
    if (brand === 'Polaroid') return 'CAMARA';
    if (brand === 'KZ') return 'AURICULAR';
    if (brand === 'Haimu') return 'SWITCH';
    if (brand === '8BitDo' || brand === 'Flydigi' || brand === 'GameSir') return 'CONTROLLER';

    // Detectar categoría por contenido del texto del producto
    if (/controller|gamepad|joystick|sn30|ultimate 2|ultimate c|8bitdo/.test(t)) return 'CONTROLLER';
    if (/electric shaver|electric shave|nose trimmer|hairclipper|toothbrush|boothbrush|s1125|s5366|x5001|s5831|pq888|s8850|s9935|s9642|hc\d{4}|nt\d{4}|hx\d{4}/.test(t)) return 'CUIDADO_PERSONAL';
    if (/earphone|earbuds|\bkz\b|zst|zsn|zs10|zax|asx|edx|zex|pr1|eda|zar|zna|dqs/.test(t)) return 'AURICULAR';
    if (/headset|headphone|gaming headset|v9 turbo/.test(t)) return 'HEADSET';
    if (/mousepad|mouse pad|\bmat\b/.test(t)) return 'MOUSEPAD';
    if (/\bmouse\b|mice|paw\d{4}|wired mouse|wireless mouse|gaming mouse/.test(t)) return 'MOUSE';
    if (/\bmonitor\b|display|screen|144hz|240hz/.test(t)) return 'MONITOR';
    if (/\bswitch\b catalog|key switch|haimu|mechanical switch|linear|tactile|clicky/.test(t)) return 'SWITCH';
    if (/keyboard|wired keyboard|wireless keyboard|teclado|f75|f99|f108|ak820|ak870|ak980|ak650|mk87|mad 60|mad 68|titan 68|atk 68|atk rs|atk v|rk61|rk87|r65|r75|mars75|mars68|blackwidow|huntsman|ace 68|ace 75|mix 87|jet 75|v75|v100/.test(t)) return 'TECLADO';
    // Inferir por marca cuando no hay texto de categoría
    if (['AULA', 'ATK', 'MCHOSE', 'AJAZZ', 'Madlions', 'Royal Kludge'].includes(brand)) return 'TECLADO';
    if (['VGN', 'Attack Shark', 'Logitech', 'Razer'].includes(brand)) {
      if (/mouse|paw|wired|wireless/.test(t)) return 'MOUSE';
      if (/keyboard|blackwidow|huntsman/.test(t)) return 'TECLADO';
    }
    return 'OTRO';
  },

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  guessCategory(modelo, variante) {
    return this.detectCategory((modelo || '') + ' ' + (variante || ''), '');
  }
};

window.PdfParser = PdfParser;
