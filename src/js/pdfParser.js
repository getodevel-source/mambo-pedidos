// ============================================
//  Mambo Pedidos - Módulo de Parser de PDFs con Detección OCR
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

      // Detección de PDF escaneado (sin capa de texto)
      const cleanText = fullText.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (parece ser una imagen escaneada). Se requiere OCR para procesarlo.');
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

  parsePdfProducts(text, brand, baseLength = 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const pricePattern = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/;
    const ignorePatterns = [
      /^(page|pg\.?)\s*\d+/i,
      /zhengzhou/i,
      /damulin/i,
      /^[\d\s\.,]+$/,
      /^(model|product|switch|color|colour|image|picture|photo|cny|cn|usd|price)$/i,
    ];
    const ignoreWords = new Set([
      'switch', 'switches', 'rgb', 'wireless', 'wired', 'tri-mode', 'trimode',
      'magnetic', 'mechanical', 'gaming', 'edition', 'limited', 'mode',
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
      'orange', 'gray', 'grey', 'silver', 'gold', 'pro', 'max', 'mini', 'plus',
      'ultra', 'lite', 'air', 'ii', 'iii', 'he', 'magspeed', 'hall', 'effect',
      'edition', 'le', 'la', 'el', 'los', 'las', 'de', 'con', 'sin', 'para',
    ]);

    const mainCat = this.detectMainCategory(text);
    const products = [];
    const seen = new Set();
    let lastModel = '';

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pricePattern);
      if (!m) continue;
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (isNaN(price) || price < 1 || price > 500) continue;

      const ctx = [];
      for (let j = Math.max(0, i - 8); j < i; j++) {
        const l = lines[j];
        if (pricePattern.test(l)) continue;
        if (l.length < 2 || l.length > 80) continue;
        if (ignorePatterns.some(p => p.test(l))) continue;
        if (/^[\u4e00-\u9fff\s]+$/.test(l)) continue;
        if (ignoreWords.has(l.toLowerCase().trim())) continue;
        ctx.push(l);
      }

      let modelo = '';
      let variante = '';
      if (ctx.length > 0) {
        modelo = ctx[0];
        variante = ctx.slice(1, 4).join(' ').replace(/\s+/g, ' ').trim();
      }
      if (!modelo) {
        modelo = lastModel;
      } else {
        lastModel = modelo;
      }

      const key = (modelo.substring(0, 40) + '|' + variante.substring(0, 40) + '|' + price).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const catCode = (mainCat || 'OTRO').substring(0, 3).toUpperCase();
      const brandCode = brand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, '0')}`;

      products.push({
        sku,
        cat: mainCat || this.guessCategory(modelo, variante),
        marca: brand,
        modelo: modelo,
        variante,
        fob: price,
      });
    }

    return products;
  },

  detectBrandFromContent(text) {
    const t = (text || '').toLowerCase().substring(0, 5000);
    const checks = [
      ['AULA', ['aula']],
      ['ATK', ['atk ', 'atk price']],
      ['Attack Shark', ['attack shark', 'attackshark']],
      ['MCHOSE', ['mchose', 'damulin']],
      ['Razer', ['razer']],
      ['Logitech', ['logitech']],
      ['Madlions', ['madlions', 'mad lions']],
      ['VGN', ['vgn ', 'vgn-damulin']],
      ['AJAZZ', ['ajazz']],
      ['Royal Kludge', ['royal kludge']],
      ['8BitDo', ['8bitdo']],
      ['Irok Mars', ['irok', 'iyx']],
      ['Philips', ['philips']],
      ['Polaroid', ['polaroid']],
    ];
    for (const [brand, patterns] of checks) {
      for (const p of patterns) {
        if (t.includes(p)) return brand;
      }
    }
    return null;
  },

  detectBrandFromFilename(filename) {
    const f = filename.toLowerCase();
    if (f.includes('aula')) return 'AULA';
    if (f.includes('atk')) return 'ATK';
    if (f.includes('attackshark') || f.includes('attack shark')) return 'Attack Shark';
    if (f.includes('mchose') || f.includes('damulin')) return 'MCHOSE';
    if (f.includes('razer')) return 'Razer';
    if (f.includes('logitech')) return 'Logitech';
    if (f.includes('madlions')) return 'Madlions';
    if (f.includes('vgn')) return 'VGN';
    if (f.includes('ajazz')) return 'AJAZZ';
    if (f.includes('rk') || f.includes('royal kludge')) return 'Royal Kludge';
    if (f.includes('8bitdo')) return '8BitDo';
    if (f.includes('irok') || f.includes('mars')) return 'Irok Mars';
    if (f.includes('philips')) return 'Philips';
    if (f.includes('polaroid')) return 'Polaroid';
    return 'OTRO';
  },

  detectMainCategory(text) {
    const t = (text || '').toLowerCase();
    const cats = {
      'TECLADO': ['keyboard', 'f75', 'f99', 'f108', 'rk68', 'rk84', 'rk100', 'ace', 'mad 60', 'mad 68', 'z87', 'titan', 'mix 87', 'rs6', 'atk 68', 'x75', 'jet', 'g98', 'g87', 'g75', 'attack shark'],
      'MOUSE': ['mouse', 'mice', 'pa3950', 'pa3395', '8khz', 'deathadder', 'viper'],
      'MOUSEPAD': ['mouse pad', 'mousepad'],
      'HEADSET': ['headset', 'headphone', 'earphone'],
      'CONTROLLER': ['controller', 'gamepad', 'joystick'],
      'SWITCH': ['switch catalog', 'key switch'],
      'MONITOR': ['monitor', 'display', 'screen', '144hz', '240hz'],
    };
    const scores = {};
    for (const cat in cats) {
      scores[cat] = cats[cat].reduce((s, k) => s + (t.split(k).length - 1), 0);
    }
    let max = 0, best = null;
    for (const cat in scores) {
      if (scores[cat] > max) { max = scores[cat]; best = cat; }
    }
    return best;
  },

  guessCategory(modelo, variante) {
    const m = ((modelo || '') + ' ' + (variante || '')).toLowerCase();
    if (m.includes('mouse pad') || m.includes('mousepad') || m.includes(' mat ')) return 'MOUSEPAD';
    if (m.includes('mouse') && !m.includes('pad')) return 'MOUSE';
    if (m.includes('headset') || m.includes('headphone') || m.includes('earphone')) return 'HEADSET';
    if (/keyboard|k68|k75|k87|f75|f99|f108|rk68|rk84|\bmix\b|\bace\b|\bmad\b|\btitan\b|\bz87\b|v75|rs6|k99|x75|jet|g98|g87|g75|68v3|v100|v87|atk 68/.test(m)) return 'TECLADO';
    if (m.includes('switch')) return 'SWITCH';
    if (m.includes('controller') || m.includes('gamepad')) return 'CONTROLLER';
    if (m.includes('monitor') || m.includes('display')) return 'MONITOR';
    return 'OTRO';
  }
};

window.PdfParser = PdfParser;
