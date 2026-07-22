// ============================================
//  Mambo Pedidos - Parser de PDFs v4 (Smart Intelligence Engine)
//  Extracción espacial X/Y, puntuación de confianza, soporte para diccionario
//  dinámico de marcas y detector de anomalías de FOB
//  Desarrollado por @geto_dev
// ============================================

const PdfParser = {

  async processPdfFile(file, catalogLength = 0, customBrands = []) {
    let pdf = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allRows = [];   // filas espaciales de todas las páginas
      const allImages = []; // imágenes extraídas con coordenadas X/Y
      let fullTextForBrand = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        if (pageNum <= 3) {
          fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';
        }

        const rows = this.groupItemsByRow(content.items, viewport.height, pageNum);
        allRows.push(...rows);

        // Extraer imágenes y aplicar filtro de nitidez por Canvas
        const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
        allImages.push(...pageImages);
      }

      const cleanText = fullTextForBrand.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.');
      }

      const brand = this.detectBrandFromContent(fullTextForBrand, customBrands) || this.detectBrandFromFilename(file.name, customBrands);
      const products = this.parseRows(allRows, brand, catalogLength, customBrands, allImages);
      return { brand, products };
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try { await pdf.destroy(); } catch (e) {}
      }
    }
  },

  async extractImagesFromPage(page, viewport, pageNum) {
    const pageImages = [];
    try {
      const ops = await page.getOperatorList();
      const fnArray = ops.fnArray;
      const argsArray = ops.argsArray;

      for (let i = 0; i < fnArray.length; i++) {
        if (fnArray[i] === pdfjsLib.OPS.paintImageXObject || fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject) {
          const imageName = argsArray[i][0];
          let imgObj = null;
          try {
            imgObj = page.objs.get(imageName);
          } catch (e) {
            continue;
          }
          if (!imgObj || !imgObj.width || !imgObj.height) continue;
          if (imgObj.width < 25 || imgObj.height < 25) continue;

          let ctm = null;
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (fnArray[j] === pdfjsLib.OPS.transform) {
              ctm = argsArray[j];
              break;
            }
          }

          let x = ctm ? ctm[4] : 0;
          let y = ctm ? viewport.height - ctm[5] : 0;

          if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = imgObj.width;
            canvas.height = imgObj.height;
            const ctx = canvas.getContext('2d');

            if (ctx && imgObj.data) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              const imgData = ctx.createImageData(imgObj.width, imgObj.height);
              if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                imgData.data.set(imgObj.data);
              } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
                let srcIdx = 0;
                let dstIdx = 0;
                for (let p = 0; p < imgObj.width * imgObj.height; p++) {
                  imgData.data[dstIdx] = imgObj.data[srcIdx];
                  imgData.data[dstIdx + 1] = imgObj.data[srcIdx + 1];
                  imgData.data[dstIdx + 2] = imgObj.data[srcIdx + 2];
                  imgData.data[dstIdx + 3] = 255;
                  srcIdx += 3;
                  dstIdx += 4;
                }
              }
              ctx.putImageData(imgData, 0, 0);

              const dataUrl = canvas.toDataURL('image/webp', 0.85);
              pageImages.push({ pageNum, y, x, width: imgObj.width, height: imgObj.height, dataUrl });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Extracción de imágenes no soportada:', err);
    }
    return pageImages;
  },

  groupItemsByRow(items, pageHeight, pageNum = 1) {
    if (!items.length) return [];

    const normalized = items
      .filter(item => item.str && item.str.trim())
      .map(item => {
        const x = item.transform[4];
        const y = pageHeight - item.transform[5];
        return { x, y, text: item.str.trim(), pageNum };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const rows = [];
    let currentRow = [normalized[0]];
    let currentY = normalized[0].y;

    for (let i = 1; i < normalized.length; i++) {
      const item = normalized[i];
      if (Math.abs(item.y - currentY) <= 6) {
        currentRow.push(item);
      } else {
        rows.push({
          pageNum,
          y: currentY,
          text: currentRow.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')
        });
        currentRow = [item];
        currentY = item.y;
      }
    }
    if (currentRow.length) {
      rows.push({
        pageNum,
        y: currentY,
        text: currentRow.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')
      });
    }

    return rows;
  },

  parseRows(rows, brandFallback, baseLength = 0, customBrands = [], allImages = []) {
    const products = [];
    const seen = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i].text;

      const usdPrice = this.extractUsdPrice(rowText);
      if (usdPrice === null) continue;

      const ctx = this.buildRowContext(rows, i);
      if (!ctx.modelo) continue;

      const detectedBrand = this.detectBrandFromTextLine(ctx.rawText, customBrands) || brandFallback || 'OTRO';
      const cat = this.detectCategory(ctx.rawText, detectedBrand);

      const key = (detectedBrand + '|' + ctx.modelo.substring(0, 50) + '|' + ctx.variante.substring(0, 30) + '|' + usdPrice).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const catCode = cat.substring(0, 3).toUpperCase();
      const brandCode = detectedBrand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, '0')}`;

      // Asociación espacial de imagen más cercana en la misma página
      let matchedImg = '';
      if (allImages && allImages.length) {
        const pageImgs = allImages.filter(img => img.pageNum === rows[i].pageNum);
        if (pageImgs.length) {
          pageImgs.sort((a, b) => Math.abs(a.y - rows[i].y) - Math.abs(b.y - rows[i].y));
          if (Math.abs(pageImgs[0].y - rows[i].y) <= 140) {
            matchedImg = pageImgs[0].dataUrl;
          }
        }
      }

      const rawItem = {
        sku,
        cat,
        marca: detectedBrand,
        modelo: ctx.modelo,
        variante: ctx.variante,
        fob: usdPrice,
        img: matchedImg,
        rawText: ctx.rawText
      };

      const evalScore = this.evaluateItemConfidence(rawItem);
      rawItem.confidence = evalScore.confidence;
      rawItem.status = evalScore.status;
      rawItem.warnings = evalScore.warnings;

      products.push(rawItem);
    }

    return products;
  },

  evaluateItemConfidence(item) {
    let confidence = 100;
    const warnings = [];

    // Evaluaciones
    if (item.marca === 'OTRO') {
      confidence -= 30;
      warnings.push('Marca no identificada automáticamente (marcada como OTRO)');
    }

    if (item.cat === 'OTRO') {
      confidence -= 20;
      warnings.push('Categoría no identificada');
    }

    if (!item.modelo || item.modelo.length < 3) {
      confidence -= 25;
      warnings.push('Nombre de modelo inusualmente corto');
    }

    if (item.fob < 0.50 || item.fob > 350.00) {
      confidence -= 15;
      warnings.push(`Precio FOB USD ($${item.fob.toFixed(2)}) inusual o fuera de rango habitual`);
    }

    let status = 'VALID'; // 🟢
    if (confidence < 60) {
      status = 'ERROR';   // 🔴
    } else if (confidence < 85) {
      status = 'WARNING'; // 🟡
    }

    return { confidence: Math.max(0, confidence), status, warnings };
  },

  buildRowContext(rows, priceIdx) {
    const rowText = rows[priceIdx].text;

    const inlineParts = rowText
      .replace(/[¥￥]\s*[\d,]+\.?\d*/g, '')
      .replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g, '')
      .trim();

    const isNoise = (t) => {
      if (!t || t.length < 2) return true;
      if (/^[\u4e00-\u9fff\s]+$/.test(t)) return true;
      if (/zhengzhou|damulin/i.test(t)) return true;
      if (/^[\d\s\.,\-]+$/.test(t)) return true;
      if (/^(model|product|picture|image|switch|color|colour|axis|wired|wireless|cny|rmb|usd|price|remark|note|cnyhot)$/i.test(t)) return true;
      if (/^[¥￥]\s*[\d,]/.test(t)) return true;
      if (/^\d{13}$/.test(t)) return true;
      if (/^RZ\d{2}-[\dA-Z-]+$/i.test(t)) return true;
      if (t.length > 120) return true;
      return false;
    };

    const prevLines = [];
    for (let j = priceIdx - 1; j >= Math.max(0, priceIdx - 8) && prevLines.length < 5; j--) {
      const t = rows[j].text;
      if (this.extractUsdPrice(t) !== null) break;
      if (!isNoise(t)) prevLines.unshift(t);
    }

    let modelo = '';
    let variante = '';
    const rawParts = [];

    if (inlineParts.length > 3 && !isNoise(inlineParts)) {
      rawParts.push(inlineParts);
    }
    rawParts.push(...prevLines);

    if (rawParts.length === 0) return { modelo: '', variante: '', rawText: '' };

    modelo = rawParts[0].substring(0, 80).trim();
    variante = rawParts.slice(1, 4).join(' ').replace(/\s+/g, ' ').trim().substring(0, 80);
    const rawText = rawParts.join(' ').replace(/\s+/g, ' ').trim();

    return { modelo, variante, rawText };
  },

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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
    const t = (text || '').toLowerCase();

    if (brand === 'Polaroid') return 'CAMARA';
    if (brand === 'KZ') return 'AURICULAR';
    if (brand === 'Haimu') return 'SWITCH';
    if (brand === '8BitDo' || brand === 'Flydigi' || brand === 'GameSir') return 'CONTROLLER';
    if (brand === 'Philips') return 'CUIDADO_PERSONAL';

    if (/controller|gamepad|joystick|8bitdo|sn30|ultimate 2c|ultimate c |ultimate 3/.test(t)) return 'CONTROLLER';
    if (/earphone|earbuds|in-ear|zst|zsn|zs10|zax|asx|edx|zex|pr1|eda |zar |zna |dqs/.test(t)) return 'AURICULAR';
    if (/headset|gaming headset|v9 turbo|a7v3|k7v2|a5v3/.test(t)) return 'HEADSET';
    if (/mousepad|mouse pad|\bmat\b/.test(t)) return 'MOUSEPAD';
    if (/\bmouse\b|mice|paw\d{4}|wired mouse|wireless mouse|gaming mouse|office mouse/.test(t)) return 'MOUSE';
    if (/\bmonitor\b|\bdisplay\b|144hz|240hz/.test(t)) return 'MONITOR';
    if (/key switch|mechanical switch|linear|tactile|clicky|haimu|seasalt switch|flamingo switch/.test(t)) return 'SWITCH';
    if (/keyboard|wired keyboard|wireless keyboard|f75|f99|f108|ak820|ak870|ak980|ak650|mk87|mad 60|mad 68|titan 68|atk 68|atk rs|atk v|rk61|rk87|r65 |r75 |mars75|mars68|blackwidow|huntsman|ace 68|ace 75|mix 87|jet 75/.test(t)) return 'TECLADO';

    if (['AULA', 'ATK', 'MCHOSE', 'AJAZZ', 'Madlions', 'Royal Kludge'].includes(brand)) return 'TECLADO';
    if (brand === 'VGN') return 'MOUSE';
    if (brand === 'Attack Shark') return 'MOUSE';
    if (brand === 'Logitech') return 'MOUSE';
    if (brand === 'Razer') {
      if (/keyboard|blackwidow|huntsman|blackwidow/.test(t)) return 'TECLADO';
      return 'MOUSE';
    }

    return 'OTRO';
  },

  guessCategory(modelo, variante) {
    return this.detectCategory((modelo || '') + ' ' + (variante || ''), '');
  }
};

window.PdfParser = PdfParser;
