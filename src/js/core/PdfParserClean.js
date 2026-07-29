/**
 * Mambo Pedidos - Parser de PDFs Refactorizado (v5 Clean)
 * Arquitectura modular sin código duplicado, con manejo robusto de errores
 */

const PdfParserClean = {

  /**
   * Punto de entrada principal para procesar archivos PDF
   */
  async processPdfFile(file, catalogLength = 0, customBrands = [], onProgress = null) {
    let pdf = null;
    
    try {
      if (!file || !file.arrayBuffer) {
        throw new Error('Archivo PDF inválido o no proporcionado');
      }

      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allProducts = [];
      const allImages = [];
      let fullTextForBrand = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (typeof onProgress === 'function') {
          onProgress(pageNum, pdf.numPages);
        }

        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // Acumular texto para detección de marca (primeras 3 páginas)
        if (pageNum <= 3) {
          fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';
        }

        // Extraer imágenes de la página
        const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
        allImages.push(...pageImages);

        // Extraer productos usando grid espacial 2D
        const pageProducts = this.extractPageProductsByCellGrid(
          content.items, 
          viewport.height, 
          pageNum, 
          pageImages, 
          '', 
          customBrands, 
          allProducts
        );
        allProducts.push(...pageProducts);
      }

      // Validar que el PDF tenga capa de texto
      const cleanText = fullTextForBrand.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.');
      }

      // Detectar marca
      const brand = this.detectBrandFromContent(fullTextForBrand, customBrands) 
        || this.detectBrandFromFilename(file.name, customBrands);

      // Finalizar catálogo con SKUs únicos
      const finalProducts = this.finalizeCatalogProducts(allProducts, brand, catalogLength, customBrands);

      return { brand, products: finalProducts };

    } catch (error) {
      console.error('Error procesando PDF:', error);
      throw error;
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try { pdf.destroy(); } catch (e) {}
      }
    }
  },

  /**
   * Extrae imágenes de una página PDF
   */
  async extractImagesFromPage(page, viewport, pageNum) {
    const pageImages = [];
    
    try {
      const ops = await page.getOperatorList();
      const fnArray = ops.fnArray;
      const argsArray = ops.argsArray;

      for (let i = 0; i < fnArray.length; i++) {
        const isImageOp = fnArray[i] === pdfjsLib.OPS.paintImageXObject 
          || fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject;
        
        if (!isImageOp) continue;

        const imageName = argsArray[i][0];
        let imgObj = null;
        
        try {
          imgObj = page.objs.get(imageName);
        } catch (e) {
          continue;
        }

        // Filtrar imágenes demasiado pequeñas
        if (!imgObj || !imgObj.width || !imgObj.height 
            || imgObj.width < 25 || imgObj.height < 25) {
          continue;
        }

        // Obtener transformación para coordenadas
        let ctm = null;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (fnArray[j] === pdfjsLib.OPS.transform) {
            ctm = argsArray[j];
            break;
          }
        }

        const x = ctm ? ctm[4] : 0;
        const y = ctm ? viewport.height - ctm[5] : 0;

        // Renderizar imagen en canvas
        if (typeof document !== 'undefined') {
          const dataUrl = this.renderImageToCanvas(imgObj);
          if (dataUrl) {
            pageImages.push({ pageNum, y, x, width: imgObj.width, height: imgObj.height, dataUrl });
          }
        }
      }
    } catch (err) {
      console.warn('Extracción de imágenes falló:', err);
    }
    
    return pageImages;
  },

  /**
   * Renderiza una imagen PDF a DataURL
   */
  renderImageToCanvas(imgObj) {
    if (!imgObj || !imgObj.width || !imgObj.height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let drewSuccessfully = false;

    // Intentar con bitmap
    if (imgObj.bitmap) {
      try {
        ctx.drawImage(imgObj.bitmap, 0, 0);
        drewSuccessfully = true;
      } catch (e) {}
    }

    // Fallback: dibujar datos raw
    if (!drewSuccessfully && imgObj.data) {
      const imgData = ctx.createImageData(imgObj.width, imgObj.height);
      const totalPixels = imgObj.width * imgObj.height;
      
      if (imgObj.data.length === totalPixels * 4) {
        imgData.data.set(imgObj.data);
        ctx.putImageData(imgData, 0, 0);
        drewSuccessfully = true;
      } else if (imgObj.data.length === totalPixels * 3) {
        let srcIdx = 0, dstIdx = 0;
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
        let srcIdx = 0, dstIdx = 0;
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

    if (!drewSuccessfully) return null;

    // Limpiar fondo blanco
    this.cleanImageBackground(ctx, imgObj.width, imgObj.height);

    // Verificar que haya contenido visible
    const checkBytes = ctx.getImageData(0, 0, imgObj.width, imgObj.height).data;
    let visiblePixels = 0;
    for (let p = 0; p < checkBytes.length; p += 16) {
      if (checkBytes[p + 3] > 20) {
        const r = checkBytes[p], g = checkBytes[p + 1], b = checkBytes[p + 2];
        if (r < 240 || g < 240 || b < 240) {
          visiblePixels++;
        }
      }
    }

    if (visiblePixels < 10) return null;

    return canvas.toDataURL('image/png');
  },

  /**
   * Limpia fondos blancos de imágenes
   */
  cleanImageBackground(ctx, width, height) {
    if (!ctx || !width || !height) return;
    
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Calcular color de fondo desde esquinas
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

      // Solo limpiar si es fondo claro
      if (bgR < 180 || bgG < 180 || bgB < 180) return;

      // Flood fill desde bordes
      const visited = new Uint8Array(width * height);
      const queue = [];

      // Agregar bordes a la cola
      for (let x = 0; x < width; x++) {
        queue.push(x, 0, x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        queue.push(0, y, width - 1, y);
      }

      const isBgColor = (pxR, pxG, pxB) => {
        const dist = Math.abs(pxR - bgR) + Math.abs(pxG - bgG) + Math.abs(pxB - bgB);
        return dist < 28;
      };

      let head = 0;
      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const idx = cy * width + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        const pIdx = idx * 4;
        const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];

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

  // ... más métodos refactorizados continuarán aquí
};

if (typeof window !== 'undefined') window.PdfParserClean = PdfParserClean;
if (typeof module !== 'undefined') module.exports = PdfParserClean;
