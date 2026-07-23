// ============================================
//  Mambo Pedidos - Parser de PDFs v4 (Smart Intelligence Engine)
//  Extracción espacial X/Y, puntuación de confianza, soporte para diccionario
//  dinámico de marcas y detector de anomalías de FOB
//  Desarrollado por @geto_dev
// ============================================

const PdfParser = {

  async processPdfFile(file, catalogLength = 0, customBrands = [], onProgress = null) {
    let pdf = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allProducts = [];
      const allImages = [];
      let fullTextForBrand = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (typeof onProgress === 'function') {
          try { onProgress(pageNum, pdf.numPages); } catch (e) {}
        }
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        if (pageNum <= 3) {
          fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';
        }

        // Extraer imágenes de la página
        const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
        allImages.push(...pageImages);

        // EXTRAER PRODUCTOS POR CELDAS ESPACIALES 2D (GRID CELL ENGINE V5)
        const pageProducts = this.extractPageProductsByCellGrid(content.items, viewport.height, pageNum, pageImages, '', customBrands, allProducts);
        allProducts.push(...pageProducts);
      }

      const cleanText = fullTextForBrand.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.');
      }

      const brand = this.detectBrandFromContent(fullTextForBrand, customBrands) || this.detectBrandFromFilename(file.name, customBrands);

      // Asignar SKU y formatear catálogo final
      const finalProducts = this.finalizeCatalogProducts(allProducts, brand, catalogLength, customBrands);
      return { brand, products: finalProducts };
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

            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              let drewSuccessfully = false;
              if (imgObj.bitmap) {
                try {
                  ctx.drawImage(imgObj.bitmap, 0, 0);
                  drewSuccessfully = true;
                } catch (e) {}
              }

              if (!drewSuccessfully && imgObj.data) {
                const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                const totalPixels = imgObj.width * imgObj.height;
                if (imgObj.data.length === totalPixels * 4) {
                  imgData.data.set(imgObj.data);
                  ctx.putImageData(imgData, 0, 0);
                  drewSuccessfully = true;
                } else if (imgObj.data.length === totalPixels * 3) {
                  let srcIdx = 0;
                  let dstIdx = 0;
                  for (let p = 0; p < totalPixels; p++) {
                    imgData.data[dstIdx] = imgObj.data[srcIdx];
                    imgData.data[dstIdx + 1] = imgObj.data[srcIdx + 1];
                    imgData.data[dstIdx + 2] = imgObj.data[srcIdx + 2];
                    imgData.data[dstIdx + 3] = 255;
                    srcIdx += 3;
                    dstIdx += 4;
                  }
                  ctx.putImageData(imgData, 0, 0);
                  drewSuccessfully = true;
                } else if (imgObj.data.length === totalPixels) {
                  let srcIdx = 0;
                  let dstIdx = 0;
                  for (let p = 0; p < totalPixels; p++) {
                    const val = imgObj.data[srcIdx++];
                    imgData.data[dstIdx] = val;
                    imgData.data[dstIdx + 1] = val;
                    imgData.data[dstIdx + 2] = val;
                    imgData.data[dstIdx + 3] = 255;
                    dstIdx += 4;
                  }
                  ctx.putImageData(imgData, 0, 0);
                  drewSuccessfully = true;
                }
              }

              if (drewSuccessfully) {
                this.cleanImageBackground(ctx, imgObj.width, imgObj.height);

                let visiblePixels = 0;
                const checkBytes = ctx.getImageData(0, 0, imgObj.width, imgObj.height).data;
                for (let p = 0; p < checkBytes.length; p += 16) {
                  if (checkBytes[p + 3] > 20) {
                    const r = checkBytes[p], g = checkBytes[p + 1], b = checkBytes[p + 2];
                    if (r < 240 || g < 240 || b < 240) {
                      visiblePixels++;
                    }
                  }
                }

                if (visiblePixels >= 10) {
                  let finalCanvas = canvas;
                  if (typeof AiDisambiguator !== 'undefined' && AiDisambiguator.cropProductWithVision) {
                    finalCanvas = await AiDisambiguator.cropProductWithVision(canvas, ctx);
                  }
                  const finalCtx = finalCanvas.getContext('2d');
                  let colorProfile = null;
                  if (finalCtx && typeof AiDisambiguator !== 'undefined' && AiDisambiguator.extractCanvasColorProfile) {
                    colorProfile = AiDisambiguator.extractCanvasColorProfile(finalCtx, finalCanvas.width, finalCanvas.height);
                  }
                  const dataUrl = finalCanvas.toDataURL('image/png');
                  pageImages.push({ pageNum, y, x, width: finalCanvas.width, height: finalCanvas.height, dataUrl, colorProfile });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Extracción de imágenes no soportada:', err);
    }
    return pageImages;
  },

  cleanImageBackground(ctx, width, height) {
    try {
      if (!ctx || !width || !height) return;
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const cornerIdxs = [
        0,
        (width - 1) * 4,
        (height - 1) * width * 4,
        ((height - 1) * width + width - 1) * 4
      ];

      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (const idx of cornerIdxs) {
        if (data[idx + 3] > 0) {
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
          count++;
        }
      }

      if (count === 0) return;
      const bgR = sumR / count;
      const bgG = sumG / count;
      const bgB = sumB / count;

      if (bgR < 180 || bgG < 180 || bgB < 180) return;

      const visited = new Uint8Array(width * height);
      const queue = [];

      for (let x = 0; x < width; x++) {
        queue.push(x, 0);
        queue.push(x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        queue.push(0, y);
        queue.push(width - 1, y);
      }

      const isBgColor = (pxR, pxG, pxB) => {
        const dist = Math.abs(pxR - bgR) + Math.abs(pxG - bgG) + Math.abs(pxB - bgB);
        return dist < 32 || (pxR > 240 && pxG > 240 && pxB > 240);
      };

      let head = 0;
      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const idx = cy * width + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        const pIdx = idx * 4;
        const r = data[pIdx];
        const g = data[pIdx + 1];
        const b = data[pIdx + 2];

        if (isBgColor(r, g, b)) {
          data[pIdx + 3] = 0;

          if (cx > 0) queue.push(cx - 1, cy);
          if (cx < width - 1) queue.push(cx + 1, cy);
          if (cy > 0) queue.push(cx, cy - 1);
          if (cy < height - 1) queue.push(cx, cy + 1);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('No se pudo limpiar fondo de imagen:', e);
    }
  },

  // =========================================================================
  //  MOTOR DE EXTRACCIÓN POR CELDAS ESPACIALES 2D (GRID CELL ENGINE V5)
  //  Aísla productos en celdas espaciales puras [X_min, X_max] x [Y_min, Y_max]
  //  evitando contaminación entre columnas y filtrando ruido de tabla.
  // =========================================================================
  extractPageProductsByCellGrid(items, viewportHeight, pageNum, pageImages, brandFallback, customBrands = [], existingProducts = []) {
    if (!items || !items.length) return [];

    // 1. Mapear elementos de texto a coordenadas espaciales
    const rawElements = items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        x: item.transform[4],
        y: viewportHeight - item.transform[5],
        text: item.str.trim(),
        pageNum
      }));

    // 2. Filtro estricto de Ruido de Encabezados de Tabla & Metadatos
    const NOISE_PATTERN = /\b(model|model\s*color|color|price|rmb|usd|picture|image|spec|specification|remark|note|moq|fob|cny|usd\s*price|rmb\s*price)\b/i;
    
    const isHeaderNoiseLine = (str) => {
      if (!str) return false;
      const matches = str.match(new RegExp(NOISE_PATTERN.source, 'gi'));
      return matches && matches.length >= 2;
    };

    const isPageNoise = (str) => {
      if (!str || str.length < 2) return true;
      if (/^[\u4e00-\u9fff\s]+$/.test(str)) return true;
      if (/zhengzhou|damulin|www\.|http|tel:|fax:|page\s*\d+/i.test(str)) return true;
      if (isHeaderNoiseLine(str)) return true;
      return false;
    };

    // 3. Localizar todos los Anclas de Precio USD ($XX.XX)
    const priceAnchors = [];
    for (const el of rawElements) {
      if (isHeaderNoiseLine(el.text)) continue;
      const price = this.extractUsdPrice(el.text);
      if (price !== null) {
        priceAnchors.push({
          x: el.x,
          y: el.y,
          price,
          rawLine: el.text,
          pageNum
        });
      }
    }

    if (!priceAnchors.length) return [];

    priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
    const pageProducts = [];

    // 4. Construir Bounding Box de Celda 2D para cada Ancla de Precio
    for (let i = 0; i < priceAnchors.length; i++) {
      const anchor = priceAnchors[i];

      // Determinar límites horizontales X de la celda (entre anclas vecinas)
      const sameRowAnchors = priceAnchors.filter(a => Math.abs(a.y - anchor.y) <= 30);
      sameRowAnchors.sort((a, b) => a.x - b.x);
      const anchorIdxInRow = sameRowAnchors.indexOf(anchor);

      let cellMinX = 0;
      let cellMaxX = 9999;

      if (anchorIdxInRow > 0) {
        cellMinX = (sameRowAnchors[anchorIdxInRow - 1].x + anchor.x) / 2;
      } else if (sameRowAnchors.length > 1) {
        const colWidth = (sameRowAnchors[1].x - sameRowAnchors[0].x);
        cellMinX = Math.max(0, anchor.x - colWidth / 2);
      } else {
        cellMinX = Math.max(0, anchor.x - 140);
      }

      if (anchorIdxInRow < sameRowAnchors.length - 1) {
        cellMaxX = (sameRowAnchors[anchorIdxInRow + 1].x + anchor.x) / 2;
      } else if (sameRowAnchors.length > 1) {
        const colWidth = (sameRowAnchors[sameRowAnchors.length - 1].x - sameRowAnchors[0].x) / (sameRowAnchors.length - 1);
        cellMaxX = anchor.x + colWidth / 2;
      } else {
        cellMaxX = anchor.x + 140;
      }

      // Determinar límites verticales Y de la celda (desde el precio hacia arriba)
      const cellMinY = anchor.y - 240;
      const cellMaxY = anchor.y + 12;

      // Recolectar elementos de texto STRICTLY dentro del Bounding Box de la Celda
      const cellTextItems = rawElements.filter(el => {
        if (el.y < cellMinY || el.y > cellMaxY) return false;
        if (el.x < cellMinX - 10 || el.x > cellMaxX + 10) return false;
        if (isPageNoise(el.text)) return false;
        if (this.extractUsdPrice(el.text) !== null) return false;
        return true;
      });

      // Agrupar elementos por sub-filas de Y dentro de la celda
      cellTextItems.sort((a, b) => a.y - b.y || a.x - b.x);

      const cellLines = [];
      if (cellTextItems.length) {
        let curLine = [cellTextItems[0]];
        let curY = cellTextItems[0].y;
        for (let j = 1; j < cellTextItems.length; j++) {
          const item = cellTextItems[j];
          if (Math.abs(item.y - curY) <= 6) {
            curLine.push(item);
          } else {
            cellLines.push(curLine.map(it => it.text).join(' '));
            curLine = [item];
            curY = item.y;
          }
        }
        if (curLine.length) {
          cellLines.push(curLine.map(it => it.text).join(' '));
        }
      }

      const inlinePart = anchor.rawLine
        .replace(/[¥￥]\s*[\d,]+\.?\d*/g, '')
        .replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g, '')
        .replace(/[\-\s]+$/g, '')
        .trim();

      let rawModelo = '';
      let rawVariante = '';

      if (cellLines.length > 0) {
        rawModelo = cellLines[0];
        const restLines = cellLines.slice(1);
        const varParts = [...restLines, inlinePart].filter(p => p && !isPageNoise(p));
        rawVariante = varParts.join(' ');
      } else if (inlinePart && !isPageNoise(inlinePart)) {
        rawModelo = inlinePart;
      }

      if (!rawModelo) continue;

      const rawCombined = rawModelo + ' ' + rawVariante;
      const detectedBrand = this.detectBrandFromTextLine(rawCombined, customBrands) || brandFallback || 'OTRO';
      const cat = this.detectCategory(rawCombined, detectedBrand);

      // Sanitización quirúrgica de Nombre y Variante
      const sanitized = this.sanitizeProductNames(rawModelo, rawVariante, detectedBrand, existingProducts);

      // Búsqueda de Imagen STRICTLY dentro del Bounding Box de la Celda
      let matchedImg = '';
      if (pageImages && pageImages.length) {
        const candidateImgs = pageImages.filter(img => {
          if (img.pageNum !== pageNum) return false;
          if (img.y > anchor.y + 10 || img.y < anchor.y - 280) return false;
          if (img.x < cellMinX - 30 || img.x > cellMaxX + 30) return false;
          return true;
        });

        if (candidateImgs.length) {
          const scored = candidateImgs.map(img => {
            const distX = Math.abs(img.x - anchor.x);
            const distY = anchor.y - img.y;
            let penalty = 0;

            if (typeof AiDisambiguator !== 'undefined' && AiDisambiguator.verifyImageAspect) {
              const aspect = AiDisambiguator.verifyImageAspect(img.width, img.height, cat);
              if (!aspect.valid) penalty += 20000;
            }

            if (img.colorProfile && typeof AiDisambiguator !== 'undefined' && AiDisambiguator.verifyImageColorMatch) {
              const colorCheck = AiDisambiguator.verifyImageColorMatch(img.colorProfile, sanitized.modelo + ' ' + sanitized.variante);
              if (!colorCheck.match) penalty += 40000;
            }

            const dist = Math.hypot(distX * 1.5, Math.max(0, distY));
            return { img, score: dist + penalty, penalty };
          });

          scored.sort((a, b) => a.score - b.score);
          if (scored[0] && scored[0].penalty < 5000) {
            matchedImg = scored[0].img.dataUrl;
          }
        }
      }

      pageProducts.push({
        sku: '',
        cat,
        marca: detectedBrand,
        modelo: sanitized.modelo,
        variante: sanitized.variante,
        fob: anchor.price,
        img: matchedImg,
        rawText: rawCombined,
        pageNum,
        x: anchor.x,
        y: anchor.y
      });
    }

    return pageProducts;
  },

  sanitizeProductNames(rawModelo, rawVariante, brand, existingProducts = []) {
    let modelo = (rawModelo || '').trim();
    let variante = (rawVariante || '').trim();

    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      modelo = modelo.replace(reBrand, '').trim();
    }

    modelo = modelo
      .replace(/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\-\s,:]+|[\-\s,:]+$/g, '')
      .trim();

    variante = variante
      .replace(/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi, '')
      .replace(/[\-\s]+$/g, '')
      .replace(/^[\-\s]+/g, '')
      .replace(/\bmode\b/i, '3-Mode')
      .replace(/\s+/g, ' ')
      .trim();

    const varWords = variante.split(/\s+/);
    const uniqueVarWords = [];
    for (const w of varWords) {
      if (!uniqueVarWords.map(x => x.toLowerCase()).includes(w.toLowerCase())) {
        uniqueVarWords.push(w);
      }
    }
    variante = uniqueVarWords.join(' ');

    const COLOR_WORDS = /^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-\.]*$/i;
    if (modelo.length <= 18 && (COLOR_WORDS.test(modelo) || /^[a-z\s\-]+$/i.test(modelo))) {
      const familyBase = existingProducts
        .filter(p => p.marca === brand)
        .slice(-3)
        .reverse()
        .find(p => p.modelo && p.modelo.length > 15 && !COLOR_WORDS.test(p.modelo.trim()));

      if (familyBase) {
        const baseCore = familyBase.modelo
          .replace(COLOR_WORDS, '')
          .replace(/\b(pink|green|purple|orange|coffee|white|black|grey|gray|blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (baseCore.length > 8) {
          variante = (modelo + (variante ? ' ' + variante : '')).trim();
          modelo = baseCore;
        }
      }
    }

    return { modelo: modelo || rawModelo, variante };
  },

  finalizeCatalogProducts(allProducts, brandFallback, baseLength = 0, customBrands = []) {
    const products = [];
    const seen = new Set();

    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      const detectedBrand = p.marca !== 'OTRO' ? p.marca : (brandFallback || 'OTRO');
      const cat = p.cat;

      const key = (detectedBrand + '|' + p.modelo.substring(0, 50) + '|' + p.variante.substring(0, 30) + '|' + p.fob).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const catCode = cat.substring(0, 3).toUpperCase();
      const brandCode = detectedBrand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, '0')}`;

      p.sku = sku;
      p.marca = detectedBrand;

      const evalScore = this.evaluateItemConfidence(p);
      p.confidence = evalScore.confidence;
      p.status = evalScore.status;
      p.warnings = evalScore.warnings;

      products.push(p);
    }

    return products;
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
          x: currentRow[0]?.x || 0,
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
        x: currentRow[0]?.x || 0,
        text: currentRow.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')
      });
    }

    return rows;
  },

  parseRows(rows, brandFallback, baseLength = 0, customBrands = [], allImages = []) {
    const products = [];
    const seen = new Set();

    // 1. Parsear todas las filas candidatas a productos
    for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i].text;
      const usdPrice = this.extractUsdPrice(rowText);
      if (usdPrice === null) continue;

      const ctx = this.buildRowContext(rows, i);
      if (!ctx.modelo) continue;

      const detectedBrand = this.detectBrandFromTextLine(ctx.rawText, customBrands) || brandFallback || 'OTRO';
      const cat = this.detectCategory(ctx.rawText, detectedBrand);

      // Layer 2: Sanitización profunda + Herencia de Familia para títulos truncados
      const rawCombined = ctx.modelo + ' ' + ctx.variante;
      const cleanTitle = this.cleanProductTitle(rawCombined, detectedBrand);
      let finalModel = cleanTitle.modelo || ctx.modelo;
      let finalVariant = cleanTitle.variante || ctx.variante;

      // Limpiar guiones o restos en variante (ej: "Orange -" -> "Orange", "mode" -> "3-Mode")
      if (finalVariant) {
        finalVariant = finalVariant
          .replace(/[\-\s]+$/g, '')
          .replace(/^[\-\s]+/g, '')
          .replace(/\bmode\b/i, '3-Mode')
          .trim();
      }

      // Si el modelo resultante es muy corto (solo color/variante), heredar nombre base de la familia
      const COLOR_WORDS = /^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-\.]*$/i;
      if (finalModel.trim().length <= 18 && (COLOR_WORDS.test(finalModel.trim()) || /^[a-z\s\-]+[\-\s]*$/i.test(finalModel.trim()))) {
        const familyBase = products
          .filter(p => p.marca === detectedBrand && p.cat === cat)
          .slice(-3)
          .reverse()
          .find(p => p.modelo && p.modelo.length > 15 && !COLOR_WORDS.test(p.modelo.trim()));

        if (familyBase) {
          const baseCore = familyBase.modelo
            .replace(COLOR_WORDS, '')
            .replace(/\b(pink|green|purple|orange|coffee|white|black|grey|gray|blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (baseCore.length > 8) {
            finalVariant = (finalModel.trim() + (finalVariant ? ' ' + finalVariant : '')).trim();
            finalModel = baseCore;
          }
        }
      }

      const key = (detectedBrand + '|' + finalModel.substring(0, 50) + '|' + finalVariant.substring(0, 30) + '|' + usdPrice).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const catCode = cat.substring(0, 3).toUpperCase();
      const brandCode = detectedBrand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, '0')}`;

      products.push({
        sku,
        cat,
        marca: detectedBrand,
        modelo: finalModel,
        variante: finalVariant,
        fob: usdPrice,
        img: '',
        rawText: ctx.rawText,
        pageNum: rows[i].pageNum,
        x: rows[i].x || 0,
        y: rows[i].y || 0
      });
    }

    // 2. ASIGNACIÓN GLOBAL BIPARTITA DE IMÁGENES POR PÁGINA (Previene robo de fotos e índices desfasados)
    if (allImages && allImages.length && products.length) {
      const pageNumbers = [...new Set(products.map(p => p.pageNum))];

      for (const pNum of pageNumbers) {
        const pageProds = products.filter(p => p.pageNum === pNum);
        const pageImgs = allImages.filter(img => img.pageNum === pNum);
        if (!pageProds.length || !pageImgs.length) continue;

        // Construir matriz de costos global [N_prods x M_imgs]
        const costMatrix = [];
        for (let i = 0; i < pageProds.length; i++) {
          const p = pageProds[i];
          const fullTitleText = p.modelo + ' ' + p.variante;
          const rowCost = [];

          for (let j = 0; j < pageImgs.length; j++) {
            const img = pageImgs[j];
            const distX = Math.abs(img.x - p.x);
            const distYRaw = p.y - img.y; // Distancia desde la foto hacia la etiqueta abajo

            let penalty = 0;

            // Bloqueos estrictos (Hard Penalties)
            if (img.y > p.y + 10) penalty += 50000;  // Foto por debajo de la etiqueta (Imposible)
            if (distX > 160) penalty += 30000;       // Columna diferente (Imposible)

            // Vision Guard Aspect Ratio
            if (typeof AiDisambiguator !== 'undefined' && AiDisambiguator.verifyImageAspect) {
              const aspectCheck = AiDisambiguator.verifyImageAspect(img.width, img.height, p.cat);
              if (!aspectCheck.valid) penalty += 20000;
            }

            // Color Guard Chromatic Verification
            if (img.colorProfile && typeof AiDisambiguator !== 'undefined' && AiDisambiguator.verifyImageColorMatch) {
              const colorCheck = AiDisambiguator.verifyImageColorMatch(img.colorProfile, fullTitleText);
              if (!colorCheck.match) penalty += 40000; // Penalización masiva por descalce cromático (ej: Pink vs Purple)
            }

            const baseDist = Math.hypot(distX * 1.5, Math.max(0, distYRaw) * 1.0);
            rowCost.push({ imgIdx: j, prodIdx: i, totalScore: baseDist + penalty, distX, distYRaw, penalty });
          }
          costMatrix.push(rowCost);
        }

        // Algoritmo de Asignación Bipartita Mínima Iterativa
        const assignedProds = new Set();
        const assignedImgs = new Set();

        while (assignedProds.size < pageProds.length && assignedImgs.size < pageImgs.length) {
          let minPair = null;

          for (let i = 0; i < pageProds.length; i++) {
            if (assignedProds.has(i)) continue;
            for (let j = 0; j < pageImgs.length; j++) {
              if (assignedImgs.has(j)) continue;
              const pair = costMatrix[i][j];
              if (!minPair || pair.totalScore < minPair.totalScore) {
                minPair = pair;
              }
            }
          }

          if (!minPair || minPair.totalScore >= 5000) break; // Umbral de confianza estricto

          const winnerProd = pageProds[minPair.prodIdx];
          const winnerImg = pageImgs[minPair.imgIdx];

          winnerProd.img = winnerImg.dataUrl;
          assignedProds.add(minPair.prodIdx);
          assignedImgs.add(minPair.imgIdx);
        }
      }
    }

    // 3. Evaluar confianza final para cada producto
    for (const p of products) {
      const evalScore = this.evaluateItemConfidence(p);
      p.confidence = evalScore.confidence;
      p.status = evalScore.status;
      p.warnings = evalScore.warnings;
    }

    return products;
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
      if (!seenWords.has(lower) || w.length <= 2 || /^[\d\.\,\$\/\-]+$/.test(w)) {
        if (w.length > 2) seenWords.add(lower);
        uniqueWords.push(w);
      }
    }
    text = uniqueWords.join(' ');

    if (typeof AiDisambiguator !== 'undefined' && AiDisambiguator.parseModelAndVariant) {
      return AiDisambiguator.parseModelAndVariant(text, brand);
    }

    const parts = text.split(/\s+-\s+|\s*\(\s*/);
    const modelo = parts[0] ? parts[0].trim().substring(0, 60) : text.substring(0, 60);
    const variante = parts.slice(1).join(' ').replace(/[\}\]\)]/g, '').trim().substring(0, 60);

    return { modelo, variante };
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

    const cleanInline = (inlineParts.length > 1 && !isNoise(inlineParts))
      ? inlineParts.replace(/[\-\s]+$/g, '').trim()
      : '';

    if (prevLines.length > 0) {
      // El nombre principal del modelo SIEMPRE proviene del encabezado superior (prevLines)
      modelo = prevLines[0].substring(0, 80).trim();
      const restLines = prevLines.slice(1);
      const varParts = [...restLines, cleanInline].filter(Boolean);
      variante = varParts.join(' ').replace(/\s+/g, ' ').trim().substring(0, 80);
    } else if (cleanInline) {
      modelo = cleanInline.substring(0, 80).trim();
    }

    if (!modelo) return { modelo: '', variante: '', rawText: '' };

    const rawText = (modelo + ' ' + variante).trim();
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
    if (brand === 'Philips') return 'CUIDADO_PERSONAL';

    if (/\b(numpad|numeric keypad|keypad|np20|ak33 numpad)\b/i.test(t)) return 'NUMPAD';
    if (/\b(controller|gamepad|joystick|mando|sn30|ultimate 2c|ultimate c|ultimate 3|vader|g7 se|t4 kaleid|g8 galileo)\b/i.test(t)) return 'CONTROLLER';
    if (/\b(earphone|earbuds|in-ear|iem|zst|zsn|zs10|zax|asx|edx|zex|pr1|eda|zar|zna|dqs)\b/i.test(t)) return 'AURICULAR';
    if (/\b(headset|headphone|gaming headset|v9 turbo|a7v3|k7v2|a5v3|cloud ii|barracuda|kraken|g435|g733)\b/i.test(t)) return 'HEADSET';
    if (/\b(mousepad|mouse pad|deskmat|desk mat|playmat|tablemat|glass pad|poron pad|cordura pad|control pad|speed pad|cloth pad|glide pad|extended pad|rgb pad|custom pad|anti-slip mat)\b|\bmat\b/i.test(t)) return 'MOUSEPAD';
    if (/\b(mouse|mice|raton|paw\d{4}|aj139\w*|aj159\w*|aj199\w*|ax5\w*|a5|l7|g3|sc200|sc580|x3|r1|x11|v989|f1 pro|dragonfly|f2 master|viper|deathadder|basilisk|cobra|orochi|g305|g203|pebble)\b/i.test(t)) return 'MOUSE';
    if (/\b(monitor|display|144hz|240hz|360hz|oled monitor)\b/i.test(t)) return 'MONITOR';
    if (/\b(key switch|mechanical switch|linear switch|tactile switch|clicky switch|seasalt switch|flamingo switch)\b/i.test(t)) return 'SWITCH';
    if (/\b(keyboard|teclado|f75|f99|f108|k87|k68|ak820|ak870|ak980|ak650|mk87|mad 60|mad 68|titan 68|atk 68|atk rs|atk v|rk61|rk87|r65|r75|mars75|mars68|blackwidow|huntsman|ace 68|ace 75|mix 87|jet 75|fizz|kumara)\b/i.test(t)) return 'TECLADO';

    if (brand === '8BitDo' || brand === 'Flydigi' || brand === 'GameSir') return 'CONTROLLER';

    return 'OTRO';
  },

  guessCategory(modelo, variante) {
    return this.detectCategory((modelo || '') + ' ' + (variante || ''), '');
  }
};

window.PdfParser = PdfParser;
