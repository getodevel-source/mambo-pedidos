// ============================================
//  Mambo Pedidos - Parser de PDFs v4 (Smart Intelligence Engine)
//  Extracción espacial X/Y, puntuación de confianza, soporte para diccionario
//  dinámico de marcas y detector de anomalías de FOB
//  Desarrollado por @geto_dev
// ============================================

// Switches de debug por env-var. Safe en runtime de la app (WebView2) donde
// `process` NO existe (a diferencia de Node, donde corren las auditorías).
// Sin este guard, cada PDF lanzaba "process is not defined" y el import real
// no producía ni un producto (los tests/auditorías en Node nunca lo veían).
const envFlag = (name) => {
  try { return (typeof process !== 'undefined' && process.env) ? process.env[name] : undefined; }
  catch { return undefined; }
};

const PdfParser = {

  async processPdfFile(file, catalogLength = 0, customBrands = [], onProgress = null) {
    let pdf = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allProducts = [];
      const allImages = [];
      let fullTextForBrand = '';

      // Pre-detectar marca desde el filename para usar como fallback durante la extracción
      const filenameBrand = this.detectBrandFromFilename(file.name, customBrands) || '';
      const failedPages = [];
      let imageOnlyPages = 0;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (typeof onProgress === 'function') {
          try { onProgress(pageNum, pdf.numPages); } catch {}
        }
        try {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // #9: Track per-page text density for scanned PDF detection
        const pageTextLen = content.items.reduce((sum, item) => sum + (item.str || '').length, 0);

        if (pageNum <= 3) {
          fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';
        }

        // Refinar marca con contenido de las primeras 3 páginas
        const currentBrand = (pageNum <= 3)
          ? (this.detectBrandFromContent(fullTextForBrand, customBrands) || filenameBrand)
          : (this.detectBrandFromContent(fullTextForBrand, customBrands) || filenameBrand);

        // Extraer imágenes de la página
        const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
        allImages.push(...pageImages);

        // EXTRAER PRODUCTOS (detecta automáticamente TABLA vs GRILLA)
        const pageProducts = this.extractPageProductsByCellGrid(content.items, viewport.height, pageNum, pageImages, currentBrand, customBrands, allProducts);

        if (pageProducts.length > 0) {
          allProducts.push(...pageProducts);
        }
        // #9: Flag pages with almost no text and no products as likely scanned
        if (pageTextLen < 10 && pageProducts.length === 0) {
          imageOnlyPages++;
        }
        } catch (pageErr) {
          failedPages.push({ page: pageNum, error: (pageErr.message || String(pageErr)).substring(0, 100) });
          console.warn(`PDF página ${pageNum} falló: ${pageErr.message || pageErr}. Continuando con las demás.`);
        }
      }

      if (failedPages.length > 0) {
        console.warn(`PDF: ${failedPages.length} de ${pdf.numPages} páginas fallaron: ${failedPages.map(p => p.page).join(', ')}. ${allProducts.length} productos extraídos de las páginas OK.`);
      }
      // #9: Warn if many pages appear to be scanned images
      if (imageOnlyPages > 0 && pdf.numPages > 3 && imageOnlyPages / pdf.numPages > 0.5) {
        console.warn(`PDF: ${imageOnlyPages} de ${pdf.numPages} páginas parecen escaneadas (sin texto seleccionable). OCR requerido para extracción completa.`);
        if (typeof toast === 'function') {
          toast(`⚠️ ${imageOnlyPages}/${pdf.numPages} páginas sin texto (escaneadas). OCR necesario para el catálogo completo.`, 'error');
        }
      }

      const cleanText = fullTextForBrand.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.');
      }

      const brand = this.detectBrandFromContent(fullTextForBrand, customBrands) || this.detectBrandFromFilename(file.name, customBrands);

      // Sanitización determinística (sin LLM local — limpieza 05/08)
      const enrichedProducts = allProducts.map(item =>
        (typeof TextSanitizer !== 'undefined' ? TextSanitizer.sanitizeItem(item, customBrands) : item));

      // Asignar SKU y formatear catálogo final
      const finalProducts = this.finalizeCatalogProducts(enrichedProducts, brand, catalogLength, customBrands, allImages);
      return { brand, products: finalProducts };
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try { await pdf.destroy(); } catch {}
      }
    }
  },



    async extractImagesFromPage(page, viewport, pageNum) {
      const pageImages = [];
      try {
        const ops = await page.getOperatorList();
        const fnArray = ops.fnArray;
        const argsArray = ops.argsArray;

        // P19 RENDER-BASED (06/08): el decode individual (objs.get) decodifica
        // cada foto a su resolución NATIVA (4000px+ = 0.55s×445 → AULA 262s).
        // Ahora: render de la página UNA vez a escala adaptativa — pdf.js
        // decodifica las imágenes a la escala de dibujo durante el render.
        // Las coordenadas x/y/centerY se calculan IGUAL que antes (del CTM),
        // así el matcher imagen→producto no cambia (cero riesgo de cruzado).
        const MAX_DIM = 300;
        // Escala adaptativa por la imagen MÁS CHICA válida (para que hasta los
        // switches de ~25pt queden ≥150px — calidad ≥ baseline). El render a
        // escala alta cuesta ~igual que a escala baja (pdf.js decodifica a la
        // escala de dibujo, no a la nativa): 200ms/página a 6.0x.
        const RENDER_CAP = 6.0;

        // Pre-pase: recolectar imágenes paintImageXObject + su CTM + nativo.
        // Clasificación HÍBRIDA (fix 06/08):
        //  - CTM SANO (drawW≥20, drawH≥20, aspect≤10): recorte del render de
        //    página (rápido — el render decodifica a escala de dibujo, no nativa).
        //  - CTM DEGENERADO (draw chico/deformado pero nativo≥20): decode nativo
        //    con objs.get (camino original). El baseline los incluía (el gate
        //    era sobre el NATIVO) y el pase 3 (galería desfasada) depende de
        //    ese pool exacto — descartarlos cambiaba la asignación (imagen
        //    cruzada). Son POCOS (34 XObjects únicos en AULA) y chicos → costo
        //    despreciable vs. el decode nativo de TODAS las fotos (245s).
        const imageOps = [];
        let minDrawDim = Infinity;
        for (let i = 0; i < fnArray.length; i++) {
          if (fnArray[i] !== pdfjsLib.OPS.paintImageXObject) continue;
          const opArgs = argsArray[i];
          if (!opArgs || opArgs.length === 0) continue;
          const nativeW = Number(opArgs[1]) || 0;
          const nativeH = Number(opArgs[2]) || 0;
          if (nativeW < 20 || nativeH < 20) continue; // gate nativo (como el baseline)
          let ctm = null;
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (fnArray[j] === pdfjsLib.OPS.transform) {
              ctm = argsArray[j];
              break;
            }
          }
          let drawW = 0, drawH = 0, sane = false;
          if (ctm) {
            drawW = Math.abs(Number(ctm[0]) || 0);
            drawH = Math.abs(Number(ctm[3]) || 0);
            sane = drawW >= 20 && drawH >= 20 &&
                   Math.max(drawW, drawH) / Math.max(1, Math.min(drawW, drawH)) <= 10;
            if (sane) minDrawDim = Math.min(minDrawDim, drawW, drawH);
          }
          imageOps.push({ idx: i, name: opArgs[0], ctm, nativeW, nativeH, drawW, drawH, sane });
        }
        if (imageOps.length === 0) return pageImages;

        // Escala del render: que la imagen sana más chica quede ≥ MAX_DIM.
        let renderScale = 1;
        if (Number.isFinite(minDrawDim) && minDrawDim > 0) {
          renderScale = Math.min(RENDER_CAP, MAX_DIM / minDrawDim);
        }
        renderScale = Math.max(0.5, renderScale);
        const renderViewport = page.getViewport({ scale: renderScale });
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = Math.max(1, Math.floor(renderViewport.width));
        renderCanvas.height = Math.max(1, Math.floor(renderViewport.height));
        const renderCtx = renderCanvas.getContext('2d');
        if (!renderCtx) return pageImages;

        // Cache de decodes nativos (mismo XObject pintado muchas veces)
        const nativeCache = new Map();
        // Cache de dataUrls del render por XObject: el baseline deduplica por
        // dataUrl (mismo XObject → mismo PNG → 1 imagen en el pool del matcher).
        // El recorte del render del MISMO XObject puede diferir en subpíxeles →
        // dataUrls distintos → sin dedup → pool más grande → pase 3 desalineado
        // (imagen cruzada, verificado: Reaper recibía la letra A del header).
        // Reusar el primer dataUrl por nombre reproduce el dedup del baseline.
        const renderUrlCache = new Map();

        // PASO 1: render de página UNA vez (solo si hay imágenes sanas).
        // Con proxy drawImage: captura la posición REAL de cada imagen en el
        // canvas. El CTM del operatorList tiene un offset de cropBox variable
        // (verificado: recortar por CTM daba la letra A del header para el
        // switch Reaper — imagen cruzada). El render dibuja en el MISMO sistema
        // que getTextContent (productos) → coordenadas reales alinean el matcher.
        let renderDone = false;
        const drawInfo = []; // {px, py, pw, ph} en escala 1.0, orden del operatorList
        const hasSane = imageOps.some(io => io.sane);
        if (hasSane) {
          const origDrawImage = renderCtx.drawImage && renderCtx.drawImage.bind(renderCtx);
          if (typeof renderCtx.drawImage === 'function') {
            renderCtx.drawImage = function (...args) {
              let t = null;
              try { t = renderCtx.getTransform(); } catch {}
              if (t && args.length >= 9) {
                const dx = args[5], dy = args[6], dw = args[7], dh = args[8];
                const px = (t.a * dx + t.c * dy + t.e) / renderScale;
                const py = (t.b * dx + t.d * dy + t.f) / renderScale;
                const pw = Math.abs(t.a * dw) / renderScale;
                const ph = Math.abs(t.d * dh) / renderScale;
                drawInfo.push({ px, py, pw, ph });
              }
              return origDrawImage(...args);
            };
          }
          await page.render({ canvasContext: renderCtx, viewport: renderViewport }).promise;
          renderDone = true;
          if (origDrawImage && typeof renderCtx.drawImage === 'function') {
            renderCtx.drawImage = origDrawImage;
          }
        }

        // Índice de drawInfo por paint en orden: el render procesa los operadores
        // en el MISMO orden que el operatorList → drawInfo[k] corresponde al
        // k-ésimo paintImageXObject (con nativo≥20) de la página.
        let drawIdx = 0;

        for (const io of imageOps) {
          const { ctm, nativeW, nativeH, drawW, drawH, sane } = io;
          const x = ctm ? Number(ctm[4]) || 0 : 0;
          const y = ctm ? viewport.height - (Number(ctm[5]) || 0) : 0;

          // Posición REAL desde el proxy (si está disponible)
          let realPos = null;
          if (drawIdx < drawInfo.length) {
            const d = drawInfo[drawIdx];
            // sanity: la X real debe estar cerca de la X del CTM (mismo paint)
            if (Math.abs(d.px - x) < 80) realPos = d;
          }
          drawIdx++;

          // ¿Distorsión? El PDF dibuja algunos XObjects con rect de aspecto
          // DISTINTO al nativo (ej. switch nativo 144x109 dibujado en rect
          // portrait). El recorte del render reproduce la distorsión (blur);
          // el baseline usaba el nativo limpio → calidad superior. Umbral 15%.
          let distorted = false;
          if (ctm && nativeW > 0 && nativeH > 0) {
            const drawAspect = drawW / Math.max(1, drawH);
            const nativeAspect = nativeW / Math.max(1, nativeH);
            const diff = Math.abs(drawAspect - nativeAspect) / Math.max(0.01, nativeAspect);
            distorted = diff > 0.15;
          }

          if (sane && !distorted && renderDone && realPos) {
            // --- RUTA RENDER (rápida): recorte en la posición REAL ---
            const sx = Math.max(0, Math.floor(realPos.px * renderScale));
            const sy = Math.max(0, Math.floor(realPos.py * renderScale));
            const sw = Math.max(1, Math.min(renderCanvas.width - sx, Math.floor(realPos.pw * renderScale)));
            const sh = Math.max(1, Math.min(renderCanvas.height - sy, Math.floor(realPos.ph * renderScale)));
            if (sx >= renderCanvas.width || sy >= renderCanvas.height || sw < 1 || sh < 1) continue;

            let finalDataUrl = '';
            let colorCtx = null;
            let outW = sw;
            let outH = sh;
            try {
              const imgData = renderCtx.getImageData(sx, sy, sw, sh);
              // photo-quality: descartar crops marginales (caso: borde de página
              // tipo MCHOSE — casi blanco con franja). Opt-in si ImageQuality no
              // está cargado (harness Node).
              if (typeof ImageQuality !== 'undefined' && ImageQuality.isMarginalCrop(imgData)) {
                continue;
              }
              const cropCanvas = document.createElement('canvas');
              const scaleUp = Math.min(1, MAX_DIM / Math.max(sw, sh));
              outW = Math.max(1, Math.round(sw * scaleUp));
              outH = Math.max(1, Math.round(sh * scaleUp));
              cropCanvas.width = outW;
              cropCanvas.height = outH;
              const ctx = cropCanvas.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                const tmp = document.createElement('canvas');
                tmp.width = sw;
                tmp.height = sh;
                const tmpCtx = tmp.getContext('2d');
                tmpCtx.putImageData(imgData, 0, 0);
                ctx.drawImage(tmp, 0, 0, outW, outH);
                // PNG lossless (igual que el baseline con imgObj.data) — el
                // JPEG 0.85 pixelaba los bordes (nitidez menor, verificado).
                finalDataUrl = cropCanvas.toDataURL('image/png');
                colorCtx = ctx;
              }
            } catch {
              finalDataUrl = '';
            }

            // Dedup por XObject (reproduce el del baseline): mismo XObject →
            // mismo dataUrl → el matcher los colapsa a 1 en el pool.
            if (renderUrlCache.has(io.name)) {
              finalDataUrl = renderUrlCache.get(io.name).url;
            } else if (this.isValidImageDataUrl(finalDataUrl)) {
              renderUrlCache.set(io.name, { url: finalDataUrl });
            }

            if (this.isValidImageDataUrl(finalDataUrl)) {
              const dominantColor = this.extractDominantColor(colorCtx, outW, outH);
              const interiorColor = this.extractInteriorColor(colorCtx, outW, outH);
              pageImages.push({
                pageNum, y, x,
                width: outW, height: outH,
                pdfWidth: drawW, pdfHeight: drawH,
                centerY: y + (outH / 2),
                dataUrl: finalDataUrl,
                dominantColor,
                interiorColor
              });
            }
          } else {
            // --- RUTA NATIVA (CTM degenerado o distorsionado): decode nativo ---
            // Tras el render de la página, pdf.js ya decodificó TODOS los
            // XObjects → page.objs.get(name) SIN callback devuelve el objeto
            // al instante (0ms, verificado). El callback con timeout de 2.5s
            // multiplicaba el tiempo (117s en AULA — los timeouts se acumulaban).
            let imgObj = null;
            if (nativeCache.has(io.name)) {
              imgObj = nativeCache.get(io.name);
            } else {
              try {
                if (page.objs && typeof page.objs.get === 'function') {
                  imgObj = page.objs.get(io.name);
                }
                if (!imgObj) {
                  // Fallback: esperar el callback (raro post-render)
                  imgObj = await new Promise((resolve) => {
                    let settled = false;
                    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 500);
                    try {
                      page.objs.get(io.name, (obj) => {
                        if (!settled) { settled = true; clearTimeout(timer); resolve(obj); }
                      });
                    } catch {
                      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
                    }
                  });
                }
              } catch {
                continue;
              }
              nativeCache.set(io.name, imgObj);
            }

            if (!imgObj || !imgObj.width || !imgObj.height) continue;
            if (imgObj.width < 20 || imgObj.height < 20) continue;
            const aspectRatio = Math.max(imgObj.width, imgObj.height) / Math.max(1, Math.min(imgObj.width, imgObj.height));
            if (aspectRatio > 10) continue;

            const imgW = Number(imgObj.width);
            const imgH = Number(imgObj.height);
            const scalePre = Math.min(1, MAX_DIM / Math.max(imgObj.width, imgObj.height));
            const outW = Math.max(1, Math.round(imgObj.width * scalePre));
            const outH = Math.max(1, Math.round(imgObj.height * scalePre));
            let finalDataUrl = '';
            let colorCtx = null;

            if (typeof document !== 'undefined') {
              if (imgObj.bitmap) {
                const canvas = document.createElement('canvas');
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  try {
                    ctx.drawImage(imgObj.bitmap, 0, 0, outW, outH);
                    finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    colorCtx = ctx;
                  } catch { finalDataUrl = ''; }
                }
              } else if (imgObj.data) {
                const totalPixels = imgObj.width * imgObj.height;
                const channels = imgObj.data.length / totalPixels;
                if (channels === 4 || channels === 3 || channels === 1) {
                  const srcW = imgObj.width;
                  const srcH = imgObj.height;
                  const scaled = new Uint8ClampedArray(outW * outH * 4);
                  const d = imgObj.data;
                  const ch = channels;
                  for (let yy = 0; yy < outH; yy++) {
                    const syf = (yy / outH) * (srcH - 1);
                    const sy = Math.min(srcH - 2, Math.floor(syf));
                    const fy = syf - sy;
                    for (let xx = 0; xx < outW; xx++) {
                      const sxf = (xx / outW) * (srcW - 1);
                      const sx = Math.min(srcW - 2, Math.floor(sxf));
                      const fx = sxf - sx;
                      const i00 = (sy * srcW + sx) * ch;
                      const i10 = i00 + ch;
                      const i01 = i00 + srcW * ch;
                      const i11 = i01 + ch;
                      const dd = (yy * outW + xx) * 4;
                      for (let c = 0; c < 3; c++) {
                        const v = (d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) +
                                  (d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy;
                        scaled[dd + c] = v;
                      }
                      scaled[dd + 3] = ch === 4 ? d[i00 + 3] : 255;
                    }
                  }
                  const canvas = document.createElement('canvas');
                  canvas.width = outW;
                  canvas.height = outH;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imgData = ctx.createImageData(outW, outH);
                    imgData.data.set(scaled);
                    ctx.putImageData(imgData, 0, 0);
                    try { finalDataUrl = canvas.toDataURL('image/png'); } catch { finalDataUrl = ''; }
                    colorCtx = ctx;
                  }
                }
              }
            }

            if (this.isValidImageDataUrl(finalDataUrl)) {
              const dominantColor = this.extractDominantColor(colorCtx, outW, outH);
              const interiorColor = this.extractInteriorColor(colorCtx, outW, outH);
              pageImages.push({
                pageNum, y, x,
                width: outW, height: outH,
                pdfWidth: imgW, pdfHeight: imgH,
                centerY: y + (outH / 2),
                dataUrl: finalDataUrl,
                dominantColor,
                interiorColor
              });
            }
          }
        }

        // Imágenes INLINE (iconos chicos, baratas): camino original intacto
        for (let i = 0; i < fnArray.length; i++) {
          if (fnArray[i] !== pdfjsLib.OPS.paintInlineImageXObject) continue;
          const opArgs = argsArray[i];
          if (!opArgs || opArgs.length === 0) continue;
          const imgObj = opArgs[0];
          if (!imgObj || !imgObj.width || !imgObj.height) continue;
          if (imgObj.width < 20 || imgObj.height < 20) continue;
          const aspectRatio = Math.max(imgObj.width, imgObj.height) / Math.max(1, Math.min(imgObj.width, imgObj.height));
          if (aspectRatio > 10) continue;

          let ctm = null;
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (fnArray[j] === pdfjsLib.OPS.transform) {
              ctm = argsArray[j];
              break;
            }
          }
          const imgW = Number(imgObj.width);
          const imgH = Number(imgObj.height);
          const x = ctm ? Number(ctm[4]) || 0 : 0;
          const y = ctm ? viewport.height - (Number(ctm[5]) || 0) : 0;

          const scalePre = Math.min(1, MAX_DIM / Math.max(imgObj.width, imgObj.height));
          const outW = Math.max(1, Math.round(imgObj.width * scalePre));
          const outH = Math.max(1, Math.round(imgObj.height * scalePre));
          let finalDataUrl = '';
          let colorCtx = null;

          if (typeof document !== 'undefined') {
            if (imgObj.bitmap) {
              const canvas = document.createElement('canvas');
              canvas.width = outW;
              canvas.height = outH;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                try {
                  ctx.drawImage(imgObj.bitmap, 0, 0, outW, outH);
                  finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  colorCtx = ctx;
                } catch { finalDataUrl = ''; }
              }
            } else if (imgObj.data) {
              const totalPixels = imgObj.width * imgObj.height;
              const channels = imgObj.data.length / totalPixels;
              if (channels === 4 || channels === 3 || channels === 1) {
                const srcW = imgObj.width;
                const srcH = imgObj.height;
                const scaled = new Uint8ClampedArray(outW * outH * 4);
                const d = imgObj.data;
                const ch = channels;
                for (let yy = 0; yy < outH; yy++) {
                  const syf = (yy / outH) * (srcH - 1);
                  const sy = Math.min(srcH - 2, Math.floor(syf));
                  const fy = syf - sy;
                  for (let xx = 0; xx < outW; xx++) {
                    const sxf = (xx / outW) * (srcW - 1);
                    const sx = Math.min(srcW - 2, Math.floor(sxf));
                    const fx = sxf - sx;
                    const i00 = (sy * srcW + sx) * ch;
                    const i10 = i00 + ch;
                    const i01 = i00 + srcW * ch;
                    const i11 = i01 + ch;
                    const dd = (yy * outW + xx) * 4;
                    for (let c = 0; c < 3; c++) {
                      const v = (d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) +
                                (d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy;
                      scaled[dd + c] = v;
                    }
                    scaled[dd + 3] = ch === 4 ? d[i00 + 3] : 255;
                  }
                }
                const canvas = document.createElement('canvas');
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const imgData = ctx.createImageData(outW, outH);
                  imgData.data.set(scaled);
                  ctx.putImageData(imgData, 0, 0);
                  try { finalDataUrl = canvas.toDataURL('image/png'); } catch { finalDataUrl = ''; }
                  colorCtx = ctx;
                }
              }
            }
          }

          if (this.isValidImageDataUrl(finalDataUrl)) {
            const dominantColor = this.extractDominantColor(colorCtx, outW, outH);
              const interiorColor = this.extractInteriorColor(colorCtx, outW, outH);
            pageImages.push({
              pageNum, y, x,
              width: outW, height: outH,
              pdfWidth: imgW, pdfHeight: imgH,
              centerY: y + (outH / 2),
              dataUrl: finalDataUrl,
              dominantColor,
              interiorColor
            });
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
        return dist < 20;
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
  //  VALIDACIÓN VISUAL DE IMÁGENES (Color Dominante + Aspect Ratio)
  // =========================================================================

  /**
   * Extrae el color dominante de una imagen (ignorando fondo transparente/blanco).
   * Retorna { name, r, g, b, confidence } donde confidence es el % de píxeles que coinciden.
   */
  extractDominantColor(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const buckets = {};
      let totalVisible = 0;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 30) continue; // transparente (fondo removido)

        const r = data[i], g = data[i + 1], b = data[i + 2];

        // Ignorar píxeles casi blancos (fondo residual)
        if (r > 235 && g > 235 && b > 235) continue;

        const name = this.classifyColorName(r, g, b);
        if (!buckets[name]) buckets[name] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
        buckets[name].count++;
        buckets[name].rSum += r;
        buckets[name].gSum += g;
        buckets[name].bSum += b;
        totalVisible++;
      }

      if (totalVisible < 5) return { name: 'UNKNOWN', r: 128, g: 128, b: 128, confidence: 0 };

      let best = null;
      for (const [name, b] of Object.entries(buckets)) {
        if (!best || b.count > best.count) {
          best = { name, count: b.count, r: Math.round(b.rSum / b.count), g: Math.round(b.gSum / b.count), b: Math.round(b.bSum / b.count) };
        }
      }

      return { ...best, confidence: Math.round((best.count / totalVisible) * 100) };
    } catch {
      return { name: 'UNKNOWN', r: 128, g: 128, b: 128, confidence: 0 };
    }
  },

  /**
   * Interior-dominant color over the CENTER-60% crop, background-excluded.
   * Delegates to ImageTextGates.sampleInteriorColor (Slice 1): the page
   * background and the photo's own background (corners of the crop) are
   * excluded, so the result is the PRODUCT color, not the backdrop. Returns
   * null when the sampler is unavailable.
   */
  extractInteriorColor(ctx, width, height) {
    try {
      if (!ctx || !width || !height) return null;
      if (typeof ImageTextGates === 'undefined' || !ImageTextGates.sampleInteriorColor) return null;
      const imgData = ctx.getImageData(0, 0, width, height);
      return ImageTextGates.sampleInteriorColor(imgData.data, width, height, 0.6);
    } catch {
      return null;
    }
  },

  /**
   * Clasifica un RGB a un nombre de color amplio.
   */
  classifyColorName(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max > 0 ? (max - min) / max : 0;
    const brightness = max / 255;

    // Acromáticos
    if (brightness < 0.22) return 'BLACK';
    if (saturation < 0.12 && brightness > 0.85) return 'WHITE';
    if (saturation < 0.12) return brightness > 0.55 ? 'SILVER' : 'GRAY';

    // Cromáticos
    if (r > g + 40 && r > b + 40) {
      if (g > 100 && b < 80) return 'GOLD';
      if (g < 80) return 'RED';
      return 'ORANGE';
    }
    if (g > r + 25 && g > b + 25) return 'GREEN';
    if (b > r + 30 && b > g + 15) {
      if (r > 80 && g < 100) return 'PURPLE';
      if (g > 150) return 'CYAN';
      return 'BLUE';
    }
    if (r > 140 && g < 130 && b > 120) return 'PINK';
    if (r > 120 && g > 100 && b < 80) return 'GOLD';

    return 'MULTICOLOR';
  },

  /**
   * Valida si una imagen es coherente con un producto.
   * Capa B: Canvas puro (siempre disponible). Capa A: LLM visión (si Ollama corre).
   * Retorna { valid, score, warnings } donde score 0-100.
   */
  isValidImageDataUrl(value) {
    if (typeof value !== 'string') return false;
    return /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(value.trim());
  },

  validateImageForProduct(img, product, relaxed = false) {
    const warnings = [];
    let score = 100;

    if (!img || !this.isValidImageDataUrl(img.dataUrl)) return { valid: false, score: 0, warnings: ['No image'] };

    // 1. Validación de aspect ratio por categoría
    const aspect = img.width / Math.max(1, img.height);
    const cat = (product.cat || '').toUpperCase();
    const imgMaxDim = Math.max(img.width || 0, img.height || 0);

    // 1a. HARD shape gate: reject images whose silhouette is incompatible with the
    //     product family. Compact products (mouse/headset/controller) cannot have a
    //     wide keyboard/mousepad photo; wide products (keyboard/mousepad) cannot have
    //     a tall narrow photo. Kills cross-family mismatches at the source.
    const COMPACT_CATS = ['MOUSE', 'AURICULAR', 'HEADSET', 'CONTROLLER', 'SWITCH'];
    const WIDE_CATS = ['TECLADO', 'MOUSEPAD'];
    if (COMPACT_CATS.includes(cat) && aspect > 1.9) {
      if (relaxed) {
        score -= 45;
        warnings.push(`⚠️ Imagen ancha (ratio ${aspect.toFixed(2)}) — aceptada en backfill`);
      } else {
        return { valid: false, score: 0, warnings: [`🚫 Imagen ancha (ratio ${aspect.toFixed(2)}) incompatible con ${cat}`] };
      }
    }
    if (WIDE_CATS.includes(cat) && aspect < 0.65) {
      if (relaxed) {
        score -= 45;
        warnings.push(`⚠️ Imagen estrecha (ratio ${aspect.toFixed(2)}) — aceptada en backfill`);
      } else {
        return { valid: false, score: 0, warnings: [`🚫 Imagen estrecha (ratio ${aspect.toFixed(2)}) incompatible con ${cat}`] };
      }
    }

    // 1b. Low-resolution thumbnail: content/color unreliable at tiny sizes (e.g. Razer
    //     ~50x31pts). Deprioritize (not reject) so a thumbnail only wins if nothing better.
    if (imgMaxDim < 55) {
      score -= 15;
      warnings.push('⚠️ Thumbnail de baja resolución — coincidencia menos confiable');
    }

    if (cat === 'TECLADO' && aspect < 0.8) {
      // En relaxed el shape gate ya penalizó (45): no apilar otra penalización
      // dura — las fotos retrato de teclados (ATK, aspect ~0.5) son legítimas.
      score -= relaxed ? 10 : 30;
      warnings.push(`⚠️ Imagen muy estrecha (ratio ${aspect.toFixed(2)}) para un teclado`);
    }

    // 2. Validación de color dominante vs variante del producto
    //    Skip en imágenes muy chicas (< 60px) — el color dominante no es confiable
    if (img.dominantColor && img.dominantColor.name !== 'UNKNOWN' && img.dominantColor.confidence > 25 && imgMaxDim >= 60) {
      const imgColor = img.dominantColor.name;
      const variantText = ((product.variante || '') + ' ' + (product.modelo || '')).toLowerCase();

      const COLOR_MAP = {
        'black': 'BLACK', 'negro': 'BLACK',
        'white': 'WHITE', 'blanco': 'WHITE',
        'pink': 'PINK', 'rosa': 'PINK',
        'blue': 'BLUE', 'azul': 'BLUE',
        'red': 'RED', 'rojo': 'RED',
        'green': 'GREEN', 'verde': 'GREEN',
        'purple': 'PURPLE', 'violeta': 'PURPLE', 'lavender': 'PURPLE',
        'silver': 'SILVER', 'gris': 'GRAY', 'gray': 'GRAY', 'grey': 'GRAY',
        'gold': 'GOLD', 'dorado': 'GOLD',
        'orange': 'ORANGE', 'naranja': 'ORANGE',
        'cyan': 'CYAN', 'teal': 'CYAN',
      };

      let expectedColor = null;
      for (const [word, colorName] of Object.entries(COLOR_MAP)) {
        if (variantText.includes(word)) {
          expectedColor = colorName;
          break;
        }
      }

      if (expectedColor && expectedColor !== imgColor) {
        const COMPATIBLE = {
          'GRAY': ['SILVER', 'WHITE'],
          'SILVER': ['GRAY', 'WHITE'],
          'PURPLE': ['BLUE', 'PINK'],
          'CYAN': ['BLUE', 'GREEN'],
          'GOLD': ['ORANGE'],
        };

        const isCompatible = (COMPATIBLE[expectedColor] || []).includes(imgColor);
        if (!isCompatible) {
          // En backfill (relaxed) el mismatch de color es solo una señal débil:
          // las fotos combo/producto traen el color dominante del fondo (SILVER/
          // GRAY) mientras el texto dice "Black". Penalizar duro aquí + el penalty
          // de shape (45) hundia el score a 15 y rechazaba la única foto real.
          score -= relaxed ? 10 : 40;
          warnings.push(`⚠️ Color de imagen (${imgColor}) no coincide con el producto (${expectedColor})`);
        }
      }
    }

    // 3. Validación de tamaño mínimo
    if (img.width < 30 || img.height < 30) {
      score -= 50;
      warnings.push('⚠️ Imagen demasiado pequeña para ser un producto');
    }

    // 4. Validación de resolución mínima para catálogos
    if (img.width < 50 && img.height < 50) {
      score -= 30;
      warnings.push('⚠️ Resolución muy baja para identificar producto');
    }

    // 5. Ratio de ocupación: el producto debe ocupar una porción razonable del canvas
    //    (evita imágenes que son 95% fondo o 5% ruido)
    if (img.dominantColor && img.dominantColor.confidence > 0) {
      const occupancy = img.dominantColor.confidence; // % de píxeles del color dominante
      if (occupancy > 95) {
        score -= 25;
        warnings.push('⚠️ Imagen casi monocromática — probablemente fondo sin producto');
      }
    }

    return { valid: score >= 35, score, warnings };
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
      // Ruido de headers de página y nombres corporativos
      if (/^(electronic|technology|shenzhen|guangdong|co\.?,?|ltd\.?|inc\.?|corp\.?)$/i.test(str)) return true;
      if (/electronic\s+technology|co\.\s*,?\s*ltd/i.test(str)) return true;
      if (/^(product\s+name|prodcut|unit\s+photo|ean\s*barcode|classification|technical\s+parameters|description|office|gaming|series|items?\s+in|those\s+that|ceased\s+production|only\s+small|switches|the\s+items)\b/i.test(str)) return true;
      if (/^(name|code|type|category|brand|status|date|version|sku|item|photo|barcode|picture)\s*$/i.test(str)) return true;
      // Stop words en inglés que no son info de producto
      if (/^(the|in|are|those|that|have|has|and|only|small|is|it|of|to|for|with|from|by|an|a|or|no|not|all|any|each|more|most|other|some|such|than|too|very|can|will|just|should|now|also|into|over|after|before|between|under|about|up|out|off|down|on|at|as|but|if|then|so|like|when|where|which|who|whom|why|how|what)\s*$/i.test(str)) return true;
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

    // 4. Detectar layout: TABLA (1 columna de precios) vs GRILLA (múltiples columnas)
    const uniqueXs = [];
    for (const a of priceAnchors) {
      if (!uniqueXs.some(ux => Math.abs(ux - a.x) < 40)) {
        uniqueXs.push(a.x);
      }
    }

    const hasSameRowColumns = priceAnchors.some((left, index) => priceAnchors.some((right, rightIndex) =>
      rightIndex > index && Math.abs(left.y - right.y) <= 30 && Math.abs(left.x - right.x) >= 40));
    if (uniqueXs.length === 1 || (uniqueXs.length <= 2 && !hasSameRowColumns)) {
      // TABLE
      return this.extractPageProductsByTableRows(rawElements, priceAnchors, viewportHeight, pageNum, pageImages, brandFallback, customBrands, existingProducts, isPageNoise, isHeaderNoiseLine);
    }

    // --- GRILLA multi-columna (path original) ---
    priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
    const pageProducts = [];

        // SLICE 3 (KZ matrix): detect "Model Name" rows — horizontal bands of
        // code-like tokens (EDCX/ZNA/DQS/ZAR/ZVX) under a "型号 / Model Name"
        // header. Each band maps column X -> real model.
        const modelNameRows = this.detectModelNameRows(rawElements, isPageNoise);

    // 4. Construir Bounding Box de Celda 2D determinística para cada Ancla de Precio
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

      // Determinar límites verticales Y de la celda de forma DINÁMICA (Ponytail: sin magic numbers)
      const prevYAnchors = priceAnchors.filter(a => a.y < anchor.y - 10);
      const prevRowY = prevYAnchors.length > 0 ? Math.max(...prevYAnchors.map(a => a.y)) : null;
      const rowHeight = prevRowY !== null ? Math.min(240, Math.max(40, anchor.y - prevRowY)) : 160;

      const cellMinY = anchor.y - rowHeight + 5;
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
        .replace(/[-\s]+$/g, '')
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

      

          // SLICE 3 (KZ matrix): if the first line is a pure color (a bleed from
          // the PREVIOUS block's color row) and a Model Name row exists above in
          // the same column, the real model is the Model Name token.
          if (modelNameRows.length > 0) {
            const pureColorRe = /^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy)$/i;
            const firstLineIsColor = pureColorRe.test((rawModelo || '').trim());
            const codeLess = /\b[A-Za-z]+\b/.test(rawModelo || '') && !/\d/.test(rawModelo || '');
            const mnr = this.findModelNameRowAbove(modelNameRows, anchor.y);
            if (mnr && (firstLineIsColor || !rawModelo || codeLess)) {
              const colTok = this.findModelNameTokenAt(mnr, anchor.x);
              if (colTok) {
                // Only override when the current model does NOT already contain a
                // token of the model-name row (keep ZVX PRO, AM16).
                const curTokens = (rawModelo || '').split(/\s+/).map(w => w.toLowerCase());
                const mnrHasToken = curTokens.some(w => mnr.tokens.some(t => t.text.toLowerCase().split(/\s+/).includes(w)));
                if (firstLineIsColor || !rawModelo || !mnrHasToken) {
                  // Keep the color as variant instead of model.
                  if (firstLineIsColor) {
                    rawVariante = (rawModelo + ' ' + rawVariante).replace(/\s+/g, ' ').trim();
                  }
                  rawModelo = colTok;
                  // The Model Name token may also appear inside the cell text — drop
                  // it from the variant to avoid duplication (KZ matrix).
                  const tokLower = colTok.toLowerCase();
                  rawVariante = rawVariante.split(/\s+/).filter(w => w.toLowerCase() !== tokLower).join(' ');
                }
              }
            }
            }
            // SLICE 5: bloque multi-línea — si la primera línea es spec pura
            // (sensor, unidad, feature) y hay una línea código arriba en la misma
            // banda X, el modelo es ese código ("V8 / PAW3950MAX / Black ¥...").
            if (rawModelo && this.isSpecOnlyModel(rawModelo) && cellTextItems.length) {
            const xRef = cellTextItems[0].x;
            const blockCode = this.findBlockCodeAbove(rawElements, isPageNoise, cellMinY, xRef - 60, xRef + 60);
            if (blockCode && !rawModelo.toLowerCase().includes(blockCode.split(/\s+/)[0].toLowerCase())) {
              rawModelo = blockCode;
            }
            }
            if (!rawModelo) continue;

      const rawCombined = rawModelo + ' ' + rawVariante;
      const detectedBrand = this.detectBrandFromTextLine(rawCombined, customBrands) || brandFallback || 'OTRO';
      const cat = this.detectCategory(rawCombined, detectedBrand);

      // Sanitización quirúrgica de Nombre y Variante
      const sanitized = this.sanitizeProductNames(rawModelo, rawVariante, detectedBrand, existingProducts);
      // Skip phantom rows: raw content is only a price/header token with no variant
      // (the RMB price column parsed as a row, or a "PRICE PRICE" header) — not a product.
      if (!(rawVariante || '').trim() && (/^\$?\d+([.,]\d+)?$/.test((rawModelo || '').trim()) || /^(price|modelo|model|color|picture|image|spec|remark|moq|fob|cny|rmb|usd|eur|\s)+$/i.test((rawModelo || '').trim()))) {
        continue;
      }

      // Búsqueda de Imagen STRICTLY dentro del Bounding Box de la Celda
      let matchedImg = '-';
      let matchedInterior = null;
      let matchedAspect = null;
      if (pageImages && pageImages.length) {
        const candidateImgs = pageImages.filter(img => {
          if (img.pageNum !== pageNum) return false;
          if (img.y > anchor.y + 10 || img.y < anchor.y - 280) return false;
          if (img.x < cellMinX - 30 || img.x > cellMaxX + 30) return false;
          if (!this.isValidImageDataUrl(img.dataUrl)) return false;
          return true;
        });
            // Fallback por página: si la celda X no contiene ninguna imagen
            // (páginas con foto a la izquierda y texto a la derecha, e.g. Logitech),
            // buscar las imágenes de la página cercanas en Y con gates relajadas.
            if (!candidateImgs.length) {
              const pageImgsForRow = pageImages.filter(img => {
                if (img.pageNum !== pageNum) return false;
                const distX = Math.abs(img.x - anchor.x);
                const distY = anchor.y - img.y;
                if (distX > 420 || distY > 460 || distY < -160) return false;
                return true;
              });
              if (pageImgsForRow.length) {
                const productForImage = { cat, modelo: sanitized.modelo, variante: sanitized.variante };
                const scored = pageImgsForRow.map(img => {
                  const distX = Math.abs(img.x - anchor.x);
                  const distY = anchor.y - img.y;
                  const validation = this.validateImageForProduct(img, productForImage, true);
                  if (!validation.valid) return null;
                  const dist = Math.hypot(distX * 1.5, Math.max(0, distY));
                  return { img, score: dist + (100 - validation.score) * 150 };
                }).filter(Boolean).sort((a, b) => a.score - b.score);
                if (scored[0]) {
                  matchedImg = scored[0].img.dataUrl;
                  matchedInterior = scored[0].img.interiorColor || null;
                  matchedAspect = scored[0].img.width && scored[0].img.height
                    ? scored[0].img.width / scored[0].img.height
                    : null;
                }
              }
            }


        if (candidateImgs.length) {
          const productForImage = { cat, modelo: sanitized.modelo, variante: sanitized.variante };
          const scoreCandidates = (relaxed) => candidateImgs.map(img => {
            const distX = Math.abs(img.x - anchor.x);
            const distY = anchor.y - img.y;
            const validation = this.validateImageForProduct(img, productForImage, relaxed);
            if (!validation.valid) return null;

            const dist = Math.hypot(distX * 1.5, Math.max(0, distY));
            return { img, score: dist + (100 - validation.score) * 150 };
          }).filter(Boolean);

          let scored = scoreCandidates(false).sort((a, b) => a.score - b.score);
          // Fallback relajado: si el shape gate rechazó todas las fotos de la celda
          // (páginas con fotos anchas tipo Logitech), aceptar la mejor con penalty.
          if (!scored.length) {
            scored = scoreCandidates(true).sort((a, b) => a.score - b.score);
          }
          if (scored[0]) {
            matchedImg = scored[0].img.dataUrl;
          }
          }
      }

      
        const grounding = this.verifyGrounding({
          anchor,
          rowTextY: this.medianY(cellTextItems),
          pageNum,
          pageAnchors: priceAnchors,
        });

pageProducts.push({
        sku: '',
        cat,
        marca: detectedBrand,
        modelo: sanitized.modelo,
        variante: sanitized.variante,
        fob: anchor.price,
        img: matchedImg,
        _interiorColor: matchedInterior,
        _imgAspect: matchedAspect,
        grounded: grounding.grounded,
        groundedFob: grounding.grounded,
        isGroundedPrice: grounding.grounded,
        groundingReason: grounding.reason,
        groundingEvidence: grounding.evidence,
      _rowEvidence: this._buildRowEvidence(
        pageNum,
        this.medianY(cellTextItems),
        cellTextItems,
        priceAnchors,
        grounding.evidence,
      ),
        rawText: rawCombined,
        cellRawText: rawCombined,
        pageNum,
        x: anchor.x,
        y: anchor.y
      });
    }

    return pageProducts;
  },

  // =========================================================================
  //  MOTOR DE EXTRACCIÓN POR FILAS DE TABLA (TABLE ROW ENGINE)
  //  Para catálogos con una sola columna de precios (layout tabular).
  //  Cada fila Y con ancla de precio $ = un producto.
  // =========================================================================

      // =========================================================================
      //  DETECCIÓN DE CABECERA DE TABLA (SLICE 1: HEADER-DRIVEN COLUMN MAPPING)
      //  Detecta la fila de cabecera (Model | Color | Axis/Switch | Image | CNY | USD)
      //  y devuelve las columnas por rol y posición X. Si no hay cabecera confiable
      //  devuelve [] -> el engine cae al path posicional actual (sin regresión).
      // =========================================================================
      HEADER_TOKEN_RE: /^(model|product|item|color|colour|axis|switch(es)?|key\s*switch(es)?|image|picture|photo|cny|rmb|price|usd|fob)$/i,
      HEADER_ROLE_RE: {
        model: /^(model|product|item)$/i,
        color: /^(color|colour)$/i,
        switch: /^(axis|switch(es)?|key\s*switch(es)?)$/i,
        image: /^(image|picture|photo)$/i,
        cny: /^(cny|rmb|price)$/i,
        usd: /^(usd|fob)$/i
      },

      detectTableHeaders(rawElements, priceColX) {
        const candidates = [];
        // Agrupar por fila Y (tolerancia 6px, como el resto del engine)
        const rows = new Map();
        for (const el of rawElements) {
          if (el.x >= priceColX - 10) continue; // zona de precios
          if (!this.HEADER_TOKEN_RE.test(el.text.trim())) continue;
          const key = Math.round(el.y / 6);
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key).push(el);
        }
        for (const els of rows.values()) {
          if (els.length < 2) continue;
          const xs = els.map(e => e.x).sort((a, b) => a - b);
          if (xs[xs.length - 1] - xs[0] < 40) continue; // sin dispersión horizontal
          const columns = [];
          for (const el of els) {
            for (const [role, re] of Object.entries(this.HEADER_ROLE_RE)) {
              if (re.test(el.text.trim()) && !columns.some(c => c.role === role)) {
                columns.push({ role, x: el.x });
                break;
              }
            }
          }
          if (columns.length < 2) continue;
          const hasProductRole = columns.some(c => c.role === 'model' || c.role === 'color' || c.role === 'switch');
          if (!hasProductRole) continue;
          columns.sort((a, b) => a.x - b.x);
          candidates.push({ y: els[0].y, columns });
        }
        return candidates;
      },

      // Devuelve la cabecera más cercana por encima de una fila dada.
      findHeaderAbove(headers, y) {
        let best = null;
        for (const h of headers) {
          if (h.y < y && (!best || h.y > best.y)) best = h;
        }
        return best;
      },

      // Clasifica un item por su X dentro de las bandas de la cabecera.
      // Devuelve 'model' | 'color' | 'switch' | 'skip' | null (null = fuera de bandas).
      classifyByHeader(header, x) {
        const cols = header.columns;
        if (x >= cols[cols.length - 1].x + 60) return 'skip';
        for (let i = 0; i < cols.length; i++) {
          const left = i === 0 ? -Infinity : (cols[i - 1].x + cols[i].x) / 2;
          const right = i === cols.length - 1 ? Infinity : (cols[i].x + cols[i + 1].x) / 2;
          if (x >= left && x < right) {
            if (cols[i].role === 'model') return 'model';
            if (cols[i].role === 'color') return 'color';
            if (cols[i].role === 'switch') return 'switch';
            return 'skip'; // image / cny / usd / price
          }
        }
        return null;
      },

  extractPageProductsByTableRows(rawElements, priceAnchors, viewportHeight, pageNum, pageImages, brandFallback, customBrands, existingProducts, isPageNoise, isHeaderNoiseLine) {
    priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
    const pageProducts = [];

    // Model inheritance: track last valid model name for color-only rows
    let lastInheritedModel = '';
    let lastInheritedPrice = 0;

    // Determinar la X de la columna de precios USD (promedio de anclas)
    const priceColX = priceAnchors.reduce((s, a) => s + a.x, 0) / priceAnchors.length;

        // SLICE 3 (Haimu switch specs): a technical-parameters column sits between
        // the name column and the price (tokens like "stroke:", "material:",
        // "force:", "axle"). When present, numeric/material tokens in that band
        // belong to specs (variante), never to the model name.
        const specKwCount = rawElements.filter(el => {
          if (el.x < 180 || el.x > priceColX - 60) return false;
          return /(stroke:|material:|force:|cover|axle|bottoming|total\s*stroke|working\s*(stroke|force))/i.test(el.text);
        }).length;
        const hasSpecsColumn = specKwCount >= 4;

        // SLICE 1: cabeceras de tabla detectadas (Model | Color | Axis | Image | CNY | USD)
        const tableHeaders = this.detectTableHeaders(rawElements, priceColX);

        // SLICE 1c: logos de marca repetidos por fila. Un token de 2-4 letras
        // mayúsculas puras que aparece en >=50% de las filas es un logo de marca
        // (ej: "RK" en cada fila del catálogo RK) — no es parte del modelo.
        // Códigos de modelo sin dígitos (ej: "MAD" en "MAD 60 V2") aparecen una
        // vez por bloque y sobreviven. Solo se activa con tablas grandes (>=8 filas).
        const logoKill = new Set();
        if (priceAnchors.length >= 8) {
          const counts = {};
          for (const el of rawElements) {
            if (el.x < 100 && /^[A-Z]{2,4}$/.test(el.text)) {
              counts[el.text] = (counts[el.text] || 0) + 1;
            }
          }
          for (const [tok, n] of Object.entries(counts)) {
            if (n >= priceAnchors.length * 0.35) logoKill.add(tok);
          }
        }

    // Calcular altura de fila promedio para límites dinámicos
    let avgRowHeight = 60;
    if (priceAnchors.length > 1) {
      const gaps = [];
      for (let j = 1; j < priceAnchors.length; j++) {
        const gap = priceAnchors[j].y - priceAnchors[j - 1].y;
        if (gap > 5 && gap < 300) gaps.push(gap);
      }
      if (gaps.length) avgRowHeight = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    // Regex para detectar códigos de producto (ej: RZ01-03850100-R3C1)
    const CODE_RE = /^[A-Z]{2,4}\d{0,2}\s*-\s*\d{6,}\s*-\s*[A-Z0-9]+$/i;
    // Regex para ¥/￥ CNY
    const CNY_SYMBOL_RE = /^[¥￥]$/;
    // Regex para números CNY bare (ej: 235.75, 1,170.21)
    const CNY_BARE_RE = /^[\d,]+\.\d{1,2}$/;
    // Keywords de tipo de producto
    const TYPE_KEYWORDS = /\b(wired|wireless|bluetooth|mechanical|optical|gaming|mouse|keyboard|headset|controller|earphone|earbuds|switch|numpad|mousepad|webcam|camera|microphone|chair|desk|hub|adapter|cable|stand|receiver)\b/i;

    for (let i = 0; i < priceAnchors.length; i++) {
      const anchor = priceAnchors[i];

      // Calcular límites Y dinámicos: punto medio entre anclas consecutivas
      const prevAnchor = i > 0 ? priceAnchors[i - 1] : null;
      const nextAnchor = i < priceAnchors.length - 1 ? priceAnchors[i + 1] : null;
      let topBound = prevAnchor ? (prevAnchor.y + anchor.y) / 2 : Math.max(0, anchor.y - avgRowHeight * 1.3);
      const bottomBound = nextAnchor ? (anchor.y + nextAnchor.y) / 2 : Math.min(viewportHeight, anchor.y + 30);

      // SLICE 1b: la primera fila de datos no debe incluir la fila de cabecera
      // (sus tokens caerian dentro de los bounds y contaminarian el modelo).
      const rowHeader = this.findHeaderAbove(tableHeaders, anchor.y);
      if (rowHeader && topBound < rowHeader.y + 6) topBound = rowHeader.y + 6;

      // Recolectar TODOS los elementos dentro de los límites Y, a la izquierda de la columna de precios
      const cellItems = rawElements.filter(el => {
        if (el.y < topBound || el.y > bottomBound) return false;
        if (el.x > priceColX - 15) return false; // excluir zona de precios
        return true;
      });

      // Clasificar elementos de la celda
      const nameParts = [];
      let firstCodeY = null;
      const typeParts = [];
      const colorParts = [];
      let productCode = '';

      const allItems = cellItems.sort((a, b) => a.y - b.y || a.x - b.x);

      
          for (const el of allItems) {
        const txt = el.text;

        // Filtrar ruido
        // SLICE 4: preserve single-letter model suffixes ("G502 X", "M750 M") in
        // the model band — they are part of the code, not noise.
        if (isPageNoise(txt) && !(el.x < 150 && /^[A-Z]$/.test(txt))) continue;
        if (isHeaderNoiseLine(txt)) continue;
        // IT15: palabras de plantilla (labels de sección/estado del catálogo)
        // como modelo — "Standard", "Business", "BILL" — nunca son un modelo.
        if (/^(standard|business|bill|special)$/i.test(txt.trim()) && el.x < priceColX * 0.5) continue;

        // Filtrar CNY: símbolo ¥ y números bare cerca de la columna de precios
        if (CNY_SYMBOL_RE.test(txt)) continue;
        if (CNY_BARE_RE.test(txt) && el.x > priceColX - 80) continue;

        // Filtrar precios USD inline (ya tenemos el ancla)
        if (this.extractUsdPrice(txt) !== null) continue;

        // Detectar código de producto
        if (CODE_RE.test(txt.replace(/\s/g, ''))) {
          productCode = txt;
          continue;
        }
            // SLICE 1: si hay cabecera por encima, clasificar por banda de columna.
            // (Layout Model|Color|Axis|Image|CNY|USD: el switch NO contamina el modelo.)
            const header = this.findHeaderAbove(tableHeaders, anchor.y);
            let headerRole;

        // Código parcial (ej: "RZ01" "-" "03850100" "-" "R3C1" como items separados).
        // Con cabecera, la banda modelo ES el código — el filtro solo aplica sin cabecera.
        if (header === null) {
          // Sin cabecera: fragmentos de SKU partida ("RZ01" "-" "03850100" "-" "R3C1").
          if (/^[A-Z]{2,4}\d{0,2}$/.test(txt) && el.x < 100) continue;
          if (/^\d{6,}$/.test(txt)) continue;
          if (/^[A-Z]\d[A-Z]\d$/.test(txt) && el.x < 100) continue;
          if (txt === '-' && el.x < 100) continue;
        } else if (logoKill.has(txt) && el.x < 100) {
          // Con cabecera: logo de marca repetido por fila ("RK" en el catálogo RK).
          continue;
        }

            if (header) {
              headerRole = this.classifyByHeader(header, el.x);
              if (headerRole === 'model') {
                // SLICE 1b: residuo de cabecera/sub-cabecera en la banda modelo
                // (ej: el label "Color" de las filas RK61) — nunca es un modelo.
                if (this.HEADER_TOKEN_RE.test(txt)) continue;
                // IT15: en la banda modelo, los valores numéricos puros de specs
                // (Haimu "3.0"/"0.50mn"/"44") son parámetros técnicos, no modelo.
                if (/^[\d.]+(\s*(mm|mn|g|kg))?$/i.test(txt.trim())) continue;
                nameParts.push(txt);
                if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
                continue;
              }
              if (headerRole === 'color') { colorParts.push(txt); continue; }
              if (headerRole === 'switch') { typeParts.push(txt); continue; }
              if (headerRole === 'skip') continue;
              // role null -> cae a las heurísticas posicionales de abajo
            }

            // Clasificar por posición X relativa a la columna de precios
            const relX = el.x / priceColX; // 0..1 (izquierda..precio)

            // Keywords que siempre van a variante (sin importar posición)
            const isSwitchType = /\b(magnetic|hall\s*effect|linear|tactile|clicky|optical|mechanical|hot[\s-]?swap|pcb|gasket|foam|silicone|poron|ixpe|pet|fr4|aluminum|brass|carbon|axis|speed|kailh|kaihua|misty|biluo|gateron|outemu|ttc|hmx)\b/i.test(txt);
            const isSensorSpec = /\b(paw\d{4}\w*|8k|4k|2\.4g|tri[\s-]?mode|25k|30k|35k|26000|dpi)\b/i.test(txt);
            const isConnectionType = /\b(bluetooth|wired|wireless|usb[\s-]?c|rgb|nfc)\b/i.test(txt);
            const isDescriptor = /\b(print|side|limited|edition|engraving|release|new|matte|glossy|translucent|gradient|aurora|ice|cream|vein|axle|stroke|force|working|lower|upper|core|cover|material|total|bottoming)\b/i.test(txt);
            const isColor = /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|faker|wukong|myth|gunmetal|blackberry|berry|periwinkle|neon|flash|shadow|warrior|hunter|night|zenith|iceblade|primordial|wolf|arctic|fox|dream|whimsy|perilla|obsidian|any|tea)\b/i.test(txt);

                if (isSwitchType || isSensorSpec || isConnectionType || isDescriptor) {
                  // SLICE 3 (Haimu): in a switch-specs layout the left band
                  // (x<180) holds the switch NAME (SeaSalt, Brown, Voice Actor),
                  // while "Switch"/"Mechanical" there are part of that name.
                  if (hasSpecsColumn && el.x < 60) {
                    // IT15: una línea de specs EMPIEZA con dígito ("3.0 0.50mn
                    // Switch 44 55 Pink Blue") — es parámetro técnico, no nombre.
                    if (/^\d/.test(txt.trim())) {
                      typeParts.push(txt);
                    } else {
                      nameParts.push(txt);
                      if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
                    }
                  } else {
                    typeParts.push(txt);
                  }
                } else if (isColor && !(hasSpecsColumn && el.x < 60)) {
                  // Colors ALWAYS go to variante, regardless of X position.
                  // SLICE 3 (Haimu): in the switch-name column (x<60) "Brown"/
                  // "Blue"/"Red" are switch NAMES, not colors — handled below.
                  colorParts.push(txt);
                } else if (relX < 0.45) {
                  if (hasSpecsColumn && el.x < 60) {
                    // IT15: en la banda de specs (Haimu), los VALORES numéricos
                    // puros ("3.0", "0.50mn", "44", "55") son parámetros técnicos,
                    // no parte del nombre — van a typeParts, no al modelo.
                    if (/^[\d.]+(\s*(mm|mn|g|kg))?$/i.test(txt.trim())) {
                      typeParts.push(txt);
                    } else {
                      nameParts.push(txt);
                      if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
                    }
                  } else if (TYPE_KEYWORDS.test(txt) && txt.split(' ').length <= 3) {
                    typeParts.push(txt);
                  } else if (/^[A-Za-z]+$/.test(txt) && nameParts.some(p => /\d/.test(p)) && firstCodeY !== null && relX > 0.15 && el.y > firstCodeY + 5) {
                    // Ya hay un código en el modelo y este token está a la derecha
                    // y debajo del código — es el detalle/switch de la celda (ej:
                    // "Jade King" debajo de "68HE Ultra").
                    typeParts.push(txt);
                  } else {
                    nameParts.push(txt);
                    if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
                  }
            } else if (relX < 0.85) {
              if (isColor) {
                colorParts.push(txt);
              } else if (hasSpecsColumn && /^[\d.]+(\s*(mm|mn|g|kg))?$|^[±±]$|^(pom|pa|pc|upe|pe|pet|fr4|ixpe|poron|brass|steel|silver)$/i.test(txt.trim())) {
                // SLICE 3 (Haimu): numeric spec values and housing materials in
                // the technical-parameters band go to variante, not the model.
                typeParts.push(txt);
              } else if (TYPE_KEYWORDS.test(txt) && txt.split(' ').length <= 3) {
                typeParts.push(txt);
              } else if (/^[A-Za-z]+$/.test(txt) && nameParts.some(p => /\d/.test(p)) && firstCodeY !== null && relX > 0.15 && el.y > firstCodeY + 5) {
                typeParts.push(txt);
              } else {
                nameParts.push(txt);
                if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
              }
            }
            // relX >= 0.85: zona de precios, ya filtrado
          }

      // Construir modelo y variante
      let rawModelo = nameParts.join(' ').replace(/\s+/g, ' ').trim();
      const rawVariante = [...typeParts, ...colorParts].join(' ').replace(/\s+/g, ' ').trim();

      // SLICE 5: bloque multi-línea — modelo spec puro con código arriba
      // (layout "V8 / PAW3950MAX / Black ¥...") → el modelo es ese código.
      if (rawModelo && this.isSpecOnlyModel(rawModelo)) {
        const blockCode = this.findBlockCodeAbove(rawElements, isPageNoise, topBound, 0, priceColX * 0.35);
        if (envFlag('P5_DEBUG')) console.error(`[SLICE5] y=${topBound.toFixed(0)} | raw="${rawModelo}" | found="${blockCode}" | band=0..${(priceColX*0.35).toFixed(0)}`);
        if (blockCode && !rawModelo.toLowerCase().includes(blockCode.split(/\s+/)[0].toLowerCase())) {
          rawModelo = blockCode;
        }
      }

      // SLICE 2: celdas fusionadas. Una fila sin texto de modelo es
      // continuación de un producto cuya celda de modelo está fusionada
      // (el texto suele estar centrado verticalmente en el bloque).
      const rowModelEmpty = !rawModelo;
      let modelFromSwap = false;
      let swapOriginalVariante = '';
      let inheritedModelFlag = false;
      let inheritedFromPrice = 0;
      // SLICE 5: una fila con modelo spec-only/color-only (sin código real)
      // también hereda — es la 2ª/3ª fila de color de un bloque multi-línea
      // ("Tri mode Berry" bajo un bloque G3). Sin esto, el modelo queda como
      // la spec y el reverse audit promueve basura desde la variante.
      const PURE_COLOR_RE = /^(transparent|black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|cream|berry|mint|navy|teal|beige|ivory|charcoal|rose|slate|olive|maroon|aqua|violet|indigo|peach|sky|jade|amber|coral|mocha|latte)$/i;
      // IT15: un modelo que empieza con "(" es una nota del PDF ("(Extra keycap
      // need be ordered...") — nunca un modelo real → tratar como fila bare.
      const noteAsModel = /^\s*\(/.test(rawModelo);
      const modelIsBare = noteAsModel || !rawModelo || this.isSpecOnlyModel(rawModelo) || PURE_COLOR_RE.test(rawModelo.trim());
      if (noteAsModel) rawModelo = '';
      // Guarda anti-basura: no heredar modelos ruidosos (líneas de estado de
      // producción, "items Mount Tai ... ceased") como modelo de familia.
      const MODEL_NOISE_RE = /\b(items?|ceased|released|production|those|small|only|new|upcoming|total|the)\b/i;
      const inheritOk = lastInheritedModel && !MODEL_NOISE_RE.test(lastInheritedModel);
      if (modelIsBare && inheritOk) {
        rawModelo = lastInheritedModel;
        // Don't swap — the color stays in variante
        // SLICE 4: remember we inherited (the model may belong to the fused
        // cell BELOW whose text is centered — price disambiguates later).
        inheritedModelFlag = true;
        inheritedFromPrice = lastInheritedPrice;
      } else if (modelIsBare && rawVariante) {
        // Sin herencia disponible — swap como último recurso: se marca para
        // backfill (la siguiente fila con modelo real corrige el modelo).
        swapOriginalVariante = rawVariante;
        rawModelo = rawVariante;
        modelFromSwap = true;
      }

      
if (!rawModelo) continue;

      const rawCombined = rawModelo + ' ' + rawVariante;
      const detectedBrand = this.detectBrandFromTextLine(rawCombined, customBrands) || brandFallback || 'OTRO';
      const cat = this.detectCategory(rawCombined, detectedBrand);

          const sanitized = this.sanitizeProductNames(rawModelo, rawVariante, detectedBrand, existingProducts, hasSpecsColumn);
      // Skip phantom rows: raw content is only a price/header token with no variant
      // (the RMB price column parsed as a row, or a "PRICE PRICE" header) — not a product.
      if (!(rawVariante || '').trim() && (/^\$?\d+([.,]\d+)?$/.test((rawModelo || '').trim()) || /^(price|modelo|model|color|picture|image|spec|remark|moq|fob|cny|rmb|usd|eur|\s)+$/i.test((rawModelo || '').trim()))) {
        continue;
      }

      // Buscar imagen dentro de los mismos límites Y de la celda CON validación visual
      // Image bounds are wider than text bounds (+25px padding) to catch images
      // positioned slightly outside the midpoint boundaries
      let matchedImg = '-';
      let matchedInterior = null;
      let matchedAspect = null;
      if (pageImages && pageImages.length) {
        const imgTopBound = topBound - 25;
        const imgBottomBound = bottomBound + 25;
        const candidateImgs = pageImages.filter(img => {
          if (img.pageNum !== pageNum) return false;
          const imgCenterY = img.centerY || img.y;
          if (imgCenterY < imgTopBound || imgCenterY > imgBottomBound) return false;
          return true;
        });

        // Fallback por página: si la celda Y no contiene imágenes (fotos desplazadas
        // fuera del rango de la fila), buscar las de la página con rango amplio.
        if (!candidateImgs.length) {
          const pageImgsForRow = pageImages.filter(img => {
            if (img.pageNum !== pageNum) return false;
            const imgCenterY = img.centerY || img.y;
            const distY = anchor.y - imgCenterY;
            if (distY > 460 || distY < -160) return false;
            return true;
          });
          if (pageImgsForRow.length) {
            const productForRow = { cat, modelo: sanitized.modelo, variante: sanitized.variante };
            const scored = pageImgsForRow.map(img => {
              const imgCenterY = img.centerY || img.y;
              const distY = anchor.y - imgCenterY;
              const validation = this.validateImageForProduct(img, productForRow, true);
              if (!validation.valid) return null;
              const dist = Math.hypot(distY * 1.5, Math.max(0, distY));
              return { img, score: dist + (100 - validation.score) * 150 };
            }).filter(Boolean).sort((a, b) => a.score - b.score);
            if (scored[0]) {
              matchedImg = scored[0].img.dataUrl;
            }
          }
        }

        if (candidateImgs.length) {
          // Validar cada candidata y elegir la mejor (score + distancia)
          const product = { cat, modelo: sanitized.modelo, variante: sanitized.variante };
          const pickBest = (relaxed) => {
            let best = null;
            let bestScore = -1;
            for (const img of candidateImgs) {
              const validation = this.validateImageForProduct(img, product, relaxed);
              if (!validation.valid) continue;
              const imgCenterY = img.centerY || img.y;
              const dist = Math.abs(imgCenterY - anchor.y);
              const combined = validation.score - dist; // mayor score, menor distancia
              if (combined > bestScore) {
                bestScore = combined;
                best = img;
              }
            }
            return best;
          };
          // Fallback relajado: mismo criterio que la sección 1 — si el shape gate
          // rechazó todas las fotos, aceptar la mejor con penalty.
          const bestImg = pickBest(false) || pickBest(true);if (bestImg) {
            matchedImg = this.isValidImageDataUrl(bestImg.dataUrl) ? bestImg.dataUrl : '-';
            matchedInterior = bestImg.interiorColor || null;
            matchedAspect = bestImg.width && bestImg.height
              ? bestImg.width / bestImg.height
              : null;
          }
        }
      }

      const grounding = this.verifyGrounding({
        anchor,
        rowTextY: this.medianY(cellItems),
        pageNum,
        pageAnchors: priceAnchors,
      });

      pageProducts.push({
        sku: productCode,
        cat,
        marca: detectedBrand,
        modelo: sanitized.modelo,
        variante: sanitized.variante,
        fob: anchor.price,
        img: matchedImg,
        _interiorColor: matchedInterior,
        _imgAspect: matchedAspect,
        grounded: grounding.grounded,
        groundedFob: grounding.grounded,
        isGroundedPrice: grounding.grounded,
        groundingReason: grounding.reason,
        groundingEvidence: grounding.evidence,
      _rowEvidence: this._buildRowEvidence(
        pageNum,
        this.medianY(cellItems),
        cellItems,
        priceAnchors,
        grounding.evidence,
      ),
        rawText: rawCombined,
        cellRawText: rawCombined,
        pageNum,
        x: anchor.x,
        y: anchor.y,
            _keepColorNames: hasSpecsColumn
      });
      const pushedNow = pageProducts[pageProducts.length - 1];
      pushedNow._inheritedModel = inheritedModelFlag;
      pushedNow._inheritedFromPrice = inheritedFromPrice;

      // SLICE 2 backfill: esta fila tiene modelo real y las anteriores quedaron con
      // un swap de color/switch (celda de modelo fusionada con texto centrado).
      // Corrige TODAS las filas swap consecutivas pendientes (no solo la última).
      // IT15: arranca en length-2 — la fila recién pusheada (length-1) tiene modelo
      // real y nunca lleva _needsModel; sin esto el backfill era dead code y las
      // filas swap de inicio de página (Irok "Black"/"Silver", Logitech "Black")
      // quedaban con el color como modelo.
      if (!rowModelEmpty && !modelFromSwap) {
        for (let k = pageProducts.length - 2; k >= 0 && pageProducts[k] && pageProducts[k]._needsModel; k--) {
          const prev = pageProducts[k];
          const restoredVariante = prev.variante || '';
          prev.modelo = sanitized.modelo;
          prev.variante = restoredVariante;
          prev.rawText = (sanitized.modelo + ' ' + restoredVariante).replace(/s+/g, ' ').trim();
          prev.cellRawText = prev.rawText;
          prev.cat = this.detectCategory(prev.rawText, prev.marca);
          prev.marca = this.detectBrandFromTextLine(prev.rawText, customBrands) || prev.marca || brandFallback || 'OTRO';
          delete prev._needsModel;
        }
      }
      // SLICE 2: marcar filas cuyo "modelo" es un swap — serán corregidas por
      // el backfill de la siguiente fila con modelo real (si existe).
      if (rowModelEmpty && modelFromSwap) {
        const pushed = pageProducts[pageProducts.length - 1];
        pushed._needsModel = true;
        // SLICE 2 fix: la celda fusionada repite el modelo en el texto de
        // detalle (Irok/Mars: "Mars75 Pro" en la columna modelo Y en el
        // detalle) — la variante no debe repetir el modelo extraído.
        const modelTokens = (sanitized.modelo || '').split(/\s+/).map(t => t.toLowerCase());
        let swapVar = swapOriginalVariante;
        if (modelTokens.length) {
          swapVar = swapVar.split(/\s+/).filter(w => !modelTokens.includes(w.toLowerCase())).join(' ');
        }
        pushed.variante = swapVar.replace(/\s+/g, ' ').trim();
        pushed.rawText = (pushed.modelo + ' ' + pushed.variante).replace(/s+/g, ' ').trim();
        pushed.cellRawText = pushed.rawText;
      }

      // Update model inheritance for color-only rows that follow.
      // Un modelo de swap (color/switch) NO debe contaminar la herencia.
      if (!modelFromSwap && sanitized.modelo && sanitized.modelo.length > 2 && !/^(item|producto)$/i.test(sanitized.modelo)) {
        lastInheritedModel = sanitized.modelo;
        lastInheritedPrice = anchor.price;
      }
    }

    // SLICE 4: fused-cell forward model. A row that inherited a model but whose
    // price differs from the inherited model's price belongs to a NEW fused cell
    // whose model text is centered BELOW (Logitech: "M750 M" below the first
    // price row of its block). Bind by price + Y-overlap: the next row with a
    // real (non-inherited) model and the SAME price wins.
    for (let fi = 0; fi < pageProducts.length; fi++) {
      const fused = pageProducts[fi];
      if (!fused._inheritedModel) continue;
      if (Math.abs(fused.fob - fused._inheritedFromPrice) < 0.01) continue; // same block, fine
      // Price differs from the inherited model's price -> look ahead for a real
      // model with the SAME price within a reasonable Y window.
      const fob = fused.fob;
      for (let fj = fi + 1; fj < pageProducts.length; fj++) {
        const cand = pageProducts[fj];
        if (cand._inheritedModel) continue; // also inherited, not a real model
        if (Math.abs(cand.fob - fob) > 0.01) continue; // different price block
        if (cand.y - fused.y > avgRowHeight * 1.5) break; // too far, not the same cell
        if (cand.modelo && cand.modelo !== fused.modelo) {
          const restoredVariante = fused.variante || '';
          fused.modelo = cand.modelo;
          fused.variante = restoredVariante;
          fused.rawText = (fused.modelo + ' ' + restoredVariante).replace(/\s+/g, ' ').trim();
          fused.cellRawText = fused.rawText;
          fused.cat = this.detectCategory(fused.rawText, fused.marca);
          fused.marca = this.detectBrandFromTextLine(fused.rawText, customBrands) || fused.marca || brandFallback || 'OTRO';
        }
        break;
      }
    }

    for (const p of pageProducts) { delete p._needsModel; delete p._inheritedModel; delete p._inheritedFromPrice; }
    return pageProducts;
  },

  // SLICE 3 (KZ matrix): find horizontal bands of code-like tokens sitting just
  // below a "型号 / Model Name" header. Returns [{ y, tokens: [{x, text}] }].
  detectModelNameRows(rawElements, isPageNoise) {
    const rows = [];
    const band = {};
    const headerLabels = [];
    // Colors that look code-like but are NOT model names (KZ color rows).
    const COLOR_TOK = /^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy|black\/cyan|silver\/black|grey\/cyan|black\/white)$/i;
    for (const el of rawElements) {
      if (isPageNoise && isPageNoise(el.text)) continue;
      // Structural labels ("Model" / "Name") live far left; "型号" is filtered as
      // CJK noise but the English pair survives and marks the header band.
      if (el.x < 120 && /^(Model|Name|Model Name)$/.test(el.text.trim())) {
        headerLabels.push(el.y);
      }
      if (/^[¥￥$]/.test(el.text)) continue;
      if (this.extractUsdPrice(el.text) !== null) continue;
      if (el.x < 120) continue; // model names are in the column area
      if (COLOR_TOK.test(el.text.trim())) continue; // color row, not model row
      const key = Math.round(el.y / 8);
      (band[key] = band[key] || []).push({ x: el.x, y: el.y, text: el.text });
    }
    for (const key of Object.keys(band)) {
      const toks = band[key];
      if (toks.length < 2) continue;
      toks.sort((a, b) => a.x - b.x);
      // Model-name tokens: alphanumeric (allow mixed case: Libra, Sonata/),
      // reject long pure-word descriptors (Version, Switches, Resolution) and
      // short standalone suffixes (Hot, Pro, X) that follow a real token.
      const codeLike = toks.filter(t => {
        const s = t.text.trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9/-]{1,}$/.test(s)) return false;
        if (/^[A-Za-z]{6,}$/.test(s)) return false;
        // Price-row labels that repeat per column (KZ "Without mic" / "With mic")
        // are NOT model names.
        if (/^(mic|without|with|price|rmb|usd|version|edition|color|model)$/i.test(s)) return false;
        return true;
      });
      if (codeLike.length < 2) continue;
      // Cluster tokens closer than 60px (e.g. "ZVX" + "PRO" in one column), then
      // require >= 2 clusters separated by >= 60px (multiple matrix columns).
      const clusters = [];
      for (const t of codeLike) {
        const last = clusters[clusters.length - 1];
        if (last && t.x - last.tokens[last.tokens.length - 1].x < 60) {
          last.tokens.push(t);
        } else {
          clusters.push({ x: t.x, tokens: [t] });
        }
      }
      if (clusters.length < 2) continue;
      let ok = true;
      for (let i = 1; i < clusters.length; i++) {
        if (clusters[i].x - clusters[i - 1].x < 60) { ok = false; break; }
      }
      if (!ok) continue;
      // The row must sit right under a "Model Name" header label.
      const rowY = toks[0].y;
      if (!headerLabels.some(hy => Math.abs(hy - rowY) <= 45)) continue;
      const tokens = clusters.map(c => ({
        x: c.tokens[0].x,
        text: c.tokens.map(t => t.text).join(' ')
      }));
      rows.push({ y: rowY, tokens });
    }
    return rows.sort((a, b) => a.y - b.y);
  },

  // Nearest model-name row above (within 260px) the anchor.
  findModelNameRowAbove(modelNameRows, anchorY) {
    let best = null;
    for (const r of modelNameRows) {
      if (r.y >= anchorY - 5) continue;
      if (anchorY - r.y > 260) continue;
      if (!best || anchorY - r.y < anchorY - best.y) best = r;
    }
    return best;
  },

  // Token of the model-name row whose X is closest to anchorX.
  findModelNameTokenAt(mnr, anchorX) {
    let best = null;
    for (const t of mnr.tokens) {
      if (!best || Math.abs(t.x - anchorX) < Math.abs(best.x - anchorX)) best = t;
    }
    return best ? best.text : null;
  },

  // SLICE 5 (bloques multi-línea): layout "V8 / PAW3950MAX / Black ¥..." —
  // el código del modelo es la línea ARRIBA de la celda (fuera del corte
  // geométrico por 5px). Devuelve el texto de la línea código más cercana
  // por encima de `y` dentro de la banda X [xMin, xMax].
  findBlockCodeAbove(rawElements, isPageNoise, y, xMin, xMax, maxDist = 250) {
    const codeLike = /(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]*)/i;
    const headerRe = /^(model|color|price|image|picture|spec|remark|moq|fob|cny|rmb|usd)\b/i;
    const candidates = rawElements
      .filter(el => el.y < y && el.y >= y - maxDist && !isPageNoise(el.text))
      .filter(el => el.x >= xMin && el.x <= xMax)
      .filter(el => codeLike.test(el.text) && !headerRe.test(el.text.trim()))
      .sort((a, b) => b.y - a.y);
    return candidates.length ? candidates[0].text.trim() : null;
  },

  // ¿El texto de modelo es spec PURA (todos sus tokens son spec/feature/unidad)?
  // Trigger del SLICE 5: "PAW3950MAX", "8KHz", "Tri mode", "Magnetic Charging
  // Dock" → sí (todos los tokens son specs). "99G Air PRO", "Charging Dock
  // Xbox", "Fiber Polar Onyx", "Esports Hall Effect" → NO (tienen tokens de
  // producto real — el peso 99g o el accesorio con nombre propio). Un modelo
  // con un código real (X3 Wireless, V3PRO) tampoco es spec.
  isSpecOnlyModel(rawModelo) {
    const text = String(rawModelo || '').trim();
    if (!text) return false;
    if (/(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]*)/i.test(text)) return false;
    const tokens = text.toLowerCase().split(/[\s\-+/]+/).filter(Boolean);
    if (!tokens.length) return false;
    if (/^paw\d[\w]*$/i.test(tokens.join(''))) return true;
    const SPEC_TOKEN_RE = /^(tri|mode|charging|charge|dock|wireless|wired|bluetooth|mechanical|magnetic|carbon|fiber|rapid|trigger|hall|effect|ice|axis|switch|keycap|engraving|gradient|screen|display|paw\d[\w]*|with|and|total|bottoming|\d+(\.\d+)?(k|khz|ghz|mhz|hz|dpi|g|mm|%|mah|mv|db))$/i;
    return tokens.every(t => SPEC_TOKEN_RE.test(t));
  },

  sanitizeProductNames(rawModelo, rawVariante, brand, existingProducts = [], keepColorNames = false) {
    let modelo = (rawModelo || '').trim();
    let variante = (rawVariante || '').trim();

    // 1. Limpieza de razones sociales corporativas y texto institucional
    const CORPORATE_NOISE = /\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi;
    modelo = modelo.replace(CORPORATE_NOISE, '').trim();

    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      modelo = modelo.replace(reBrand, '').trim();
    }

    modelo = modelo
      .replace(/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^[-\s,:]+|[-\s,:]+$/g, '')
      .trim();

    // 1b. Remover códigos de barras EAN/UPC (13 dígitos) y números de serie largos
    modelo = modelo.replace(/\b\d{12,15}\b/g, '').replace(/\s+/g, ' ').trim();

    // 1c. Mover specs de sensor a variante (PAW3950MAX, PAW3395, etc.)
    const SENSOR_RE = /\b(paw\d{4}\w*)\b/gi;
    const sensorMatches = modelo.match(SENSOR_RE);
    if (sensorMatches) {
      modelo = modelo.replace(SENSOR_RE, '').replace(/\s+/g, ' ').trim();
      variante = (sensorMatches.join(' ') + ' ' + variante).trim();
    }

    // 1d. Mover colores del modelo a variante
    const COLOR_EXTRACT_RE = /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent)\b/gi;
        const colorMatches = modelo.match(COLOR_EXTRACT_RE);
        // SLICE 3 (Haimu switch specs): "Brown"/"Blue"/"Red" are switch NAMES in
        // the left name column, not colors — keep them in the model.
        if (colorMatches && colorMatches.length > 0 && !keepColorNames) {
      const nonColorWords = modelo.replace(COLOR_EXTRACT_RE, '').replace(/\s+/g, ' ').trim();
      // ALWAYS move colors to variante — even if modelo becomes empty
      modelo = nonColorWords;
      variante = (colorMatches.join(' ') + ' ' + variante).replace(/\s+/g, ' ').trim();
    }

    // 1e. Remover palabras genéricas que no son modelo
    modelo = modelo
      .replace(/\b(list|item|product|prodcut|catalog|catalogue|release|sale|pro version|electronic|technology|co\.,?\s*ltd\.?|shenzhen|guangdong|unit|photo|ean|barcode|classification|technical|parameters|description|office|gaming|cny|rmb|bottoming|total|style)\b/gi, '')
      .replace(/\b\d+\.\d+mm\b/gi, '')  // specs técnicas
      .replace(/\b\d+\.\d+mn\b/gi, '')  // typo de mm
      .replace(/\s+/g, ' ')
      .replace(/^[-\s,:.]+|[-\s,:.]+$/g, '')
      .trim();

    // Deduplicar palabras en modelo (ej: "AK820 Red AK820 Wired" → "AK820 Red Wired")
    const modWords = modelo.split(/\s+/);
    const uniqueModWords = [];
    for (const w of modWords) {
      if (!uniqueModWords.map(x => x.toLowerCase()).includes(w.toLowerCase())) {
        uniqueModWords.push(w);
      }
    }
    modelo = uniqueModWords.join(' ');

    // 1f. Ruido de tipo/estado al final del modelo → variante (WS1):
    //     'Ultimate 2C Controller' → modelo 'Ultimate 2C', variante 'Controller';
    //     'Combo MK120 Mouse' → modelo 'MK120', variante 'Combo Mouse';
    //     'Xbox Keyboard' → modelo 'Xbox', variante 'Keyboard';
    //     'Lake Released' → modelo 'Lake', variante 'New Green Released'.
    //     NUNCA toca pro|wireless|ultra|max|bluetooth|wired|mechanical|gaming
    //     (sufijos legítimos). No toca colores, así que corre también en
    //     layouts de specs de switch (keepColorNames=true) — las guardas de
    //     moveTrailingTypeKeyword protegen los nombres compuestos
    //     ('LatteSwitch', 'ShadowSwitch') y los descriptores puros.
    {
      const moved = this.moveTrailingTypeKeyword(modelo, variante);
      modelo = moved.modelo;
      variante = moved.variante;
    }

    // 2. Si el modelo resultante es puramente numérico/decimal (ej: "235.75" o "$120"), no dejar el precio como modelo
    if (/^\$?\d+([.,]\d+)?$/.test(modelo) || /^\d+$/.test(modelo)) {
      if (variante && !/^\$?\d+([.,]\d+)?$/.test(variante)) {
        modelo = variante;
        variante = '';
      } else {
        const brandLabel = (brand && brand !== 'OTRO') ? brand : 'Producto';
        modelo = `${brandLabel} Item`;
      }
    }

    variante = variante
      .replace(/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi, '')
      // Remover specs técnicas de switches que contaminan la variante
      .replace(/\b(working|lower|upper|axle|core|cover|stroke:?|material:?|force:?|total|pre[\s-]?travel|travel)\b/gi, '')
      .replace(/\b\d+\.\d+mm\b/gi, '')  // "0.50mm"
      .replace(/\b\d+g\b/gi, '')         // "5g" (force grams)
      .replace(/\b(pom|pc|pa|upe|pa12|fr4|ixpe|pet)\b/gi, '') // material codes
      .replace(/[-\s]+$/g, '')
      .replace(/^[-\s]+/g, '')
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

    const COLOR_WORDS = /^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-.]*$/i;
    if (modelo.length <= 18 && COLOR_WORDS.test(modelo.trim())) {
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

    // Segunda pasada: remover brand del modelo (puede haber quedado oculto bajo ruido limpiado)
    if (brand && brand !== 'OTRO') {
      const reBrand2 = new RegExp('\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      modelo = modelo.replace(reBrand2, '').replace(/\s+/g, ' ').replace(/^[-\s,:.]+|[-\s,:.]+$/g, '').trim();
    }

    // If modelo cleaned to empty but variante holds a real (non-numeric) model, promote it.
    // Fixes catalogs where the model code lands in variante and modelo is header noise
    // (e.g. raw "Price List DQ6" -> modelo="" variante="DQ6" -> modelo="DQ6").
    if (!modelo && variante && !/^\$?\d+([.,]\d+)?$/.test(variante)) {
      modelo = variante;
      variante = '';
    }

    return { modelo: modelo || (brand !== 'OTRO' ? `${brand} Item` : 'Producto'), variante };
  },

  /**
   * Mueve ruido de tipo/estado desde el FINAL del modelo hacia la variante (WS1).
   * Reglas (solo si el modelo tiene >= 2 palabras):
   *  - Última palabra = keyword de tipo (mouse|keyboard|controller|headset|earphone|
   *    earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|
   *    adapter|cable|stand|gamepad|dock|receiver) → variante.
   *  - Última palabra = estado (released|new|upcoming) → variante.
   *  - 'combo' como primera palabra es ruido → variante ('Combo MK120 Mouse' →
   *    modelo 'MK120', variante 'Combo Mouse').
   * Se aplica en loop (una fila puede arrastrar 'Charing Dock Mouse' →
   * 'Charing Dock'). Guarda: no deja un descriptor puro como modelo
   * ('Wireless Keyboard' no se toca: 'Wireless' solo no es un modelo). Nunca
   * toca pro|wireless|ultra|max|bluetooth|wired|mechanical|gaming (sufijos
   * legítimos de línea).
   */
  moveTrailingTypeKeyword(modelo, variante) {
    const TYPE_TAIL_RE = /\b(mouse|keyboard|controller|headset|earphone|earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|adapter|cable|stand|gamepad|dock|receiver)$/i;
    const STATUS_TAIL_RE = /^(released|new|upcoming)$/i;
    const DESCRIPTOR_ONLY_RE = /^(combo|wired|wireless|bluetooth|mechanical|gaming|optical|rgb|silent|magnetic|hall|usb|2\.4g|pro|ultra|max)$/i;
    let m = String(modelo || '').trim();
    let v = String(variante || '').trim();
    let guard = 0;
    while (guard++ < 5) {
      const words = m.split(/\s+/);
      if (words.length < 2) break;
      const last = words[words.length - 1];
      const isTypeTail = TYPE_TAIL_RE.test(last);
      const isStatusTail = STATUS_TAIL_RE.test(last);
      if (isTypeTail || isStatusTail) {
        const remaining = words.slice(0, -1);
        // No dejes un descriptor puro como modelo ('Combo Mouse' → no 'Combo').
        if (remaining.length === 1 && DESCRIPTOR_ONLY_RE.test(remaining[0])) break;
        m = remaining.join(' ');
        v = (v + ' ' + last).replace(/\s+/g, ' ').trim();
        continue;
      }
      if (/^combo$/i.test(words[0])) {
        m = words.slice(1).join(' ');
        v = (words[0] + ' ' + v).replace(/\s+/g, ' ').trim();
        continue;
      }
      break;
    }
    return { modelo: m, variante: v };
  },

  finalizeCatalogProducts(allProducts, brandFallback, baseLength = 0, customBrands = [], allImages = []) {
    const products = [];
    const seen = new Set();

    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      const detectedBrand = p.marca !== 'OTRO' ? p.marca : (brandFallback || 'OTRO');

      // Limpieza universal de tipo/estado al final del modelo (WS1): los paths
      // que NO pasan por sanitizeProductNames (fallback de texto plano del AI
      // engine, items del LLM) pueden traer la categoría pegada al modelo
      // ('Ultimate 2C Controller', 'Xbox Keyboard'). Acá el fix es idempotente:
      // los productos ya limpios no cambian. Se aplica ANTES del dedup para que
      // la identidad use el modelo limpio.
      {
        const moved = this.moveTrailingTypeKeyword(p.modelo || '', p.variante || '');
        p.modelo = moved.modelo;
        p.variante = moved.variante;
      }

      const key = (detectedBrand + '|' + p.modelo.substring(0, 50) + '|' + p.variante.substring(0, 30) + '|' + p.fob).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

       p.sku = (typeof SkuAllocator !== 'undefined') ? SkuAllocator.normalizeSku(p.sku) : p.sku;
       p.marca = detectedBrand;

       const sourceWarnings = Array.isArray(p.warnings) ? p.warnings : [];
       p.sourceStatus = p.status || p.sourceStatus;
       p.sourceConfidence = Number.isFinite(p.confidence) ? p.confidence : (p.sourceConfidence || null);
       p.sourceWarnings = [...sourceWarnings];

      products.push(p);
    }

    if (typeof SkuAllocator !== 'undefined') SkuAllocator.allocateBatch(products, []);

    // Image inheritance: products without image inherit from same brand+modelo+category.
    // Category is part of the key on purpose: a keyboard must never inherit a mouse photo
    // (cross-category inheritance produced portrait images on TECLADO products).
    const imageByModel = new Map();
    for (const p of products) {
      const hasImg = typeof p.img === 'string' && /^data:image\//i.test(p.img);
      if (hasImg) {
        const modelKey = (p.marca + '|' + p.modelo + '|' + p.cat).toLowerCase();
        if (!imageByModel.has(modelKey)) {
          imageByModel.set(modelKey, p.img);
        }
      }
    }
    for (const p of products) {
      const hasImg = typeof p.img === 'string' && /^data:image\//i.test(p.img);
      if (!hasImg) {
        const modelKey = (p.marca + '|' + p.modelo + '|' + p.cat).toLowerCase();
        const inherited = imageByModel.get(modelKey);
        if (inherited) {
          p.img = inherited;
          p._imageInherited = true;
        }
      }
    }


    // Recover real model names for variant rows whose model is a bare color
    // or status word (e.g. "Purple", "released") by adopting the parent row.
    this.recoverGenericModelNames(products);

    // Backfill global de imágenes (doble pase estricto + relajado): las filas
    // que el engine por-fila dejó sin foto (fotos desplazadas de la columna,
    // tiles anchas tipo Logitech, galerías desfasadas) reciben la mejor imagen
    // restante de su página. Es el matcher bipartito por página.
    if (allImages && allImages.length) {
      this.matchImagesToProductsGlobal(products, allImages);
    }

    // Evaluar confianza DESPUÉS de todas las asignaciones de imagen (herencia
    // por modelo + backfill global): evita warnings fantasma de "imagen
    // faltante" en productos que sí terminaron con foto, y evalúa con el
    // modelo ya recuperado (recoverGenericModelNames).
    for (const p of products) {
      const evalScore = this.evaluateItemConfidence(p);
      const srcConf = (p.sourceConfidence === null || p.sourceConfidence === undefined) ? null : p.sourceConfidence;
      p.confidence = srcConf === null ? evalScore.confidence : Math.min(srcConf, evalScore.confidence);
      p.status = evalScore.status;
      // Fusionar imgWarnings (validación visual del matcher: monocromática,
      // color mismatch, shape) a warnings para que el preview los muestre.
      const imgW = Array.isArray(p.imgWarnings) ? p.imgWarnings : [];
      p.warnings = [...new Set([...(p.sourceWarnings || []), ...evalScore.warnings, ...imgW])];
      p.qualityReason = p.warnings[0] || 'Sin observaciones';
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
          .replace(/[-\s]+$/g, '')
          .replace(/^[-\s]+/g, '')
          .replace(/\bmode\b/i, '3-Mode')
          .trim();
      }

      // Si el modelo resultante es muy corto (solo color/variante), heredar nombre base de la familia
      const COLOR_WORDS = /^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-.]*$/i;
      if (finalModel.trim().length <= 18 && (COLOR_WORDS.test(finalModel.trim()) || /^[a-z\s-]+[-\s]*$/i.test(finalModel.trim()))) {
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

                // Slice 2: matrix path has NO literal anchor - derive grounded:false
          // with evidence (YELLOW via R10, never RED) instead of hardcoded true.
          const grounding = this.verifyGrounding({
            anchor: null,
            rowTextY: rows[i].y || null,
            pageNum: rows[i].pageNum,
            pageAnchors: [],
          });

        products.push({
        sku,
        cat,
        marca: detectedBrand,
        modelo: finalModel,
        variante: finalVariant,
        fob: usdPrice,
         img: '-',
         grounded: grounding.grounded,
         groundedFob: grounding.grounded,
         isGroundedPrice: grounding.grounded,
         groundingReason: grounding.reason,
         groundingEvidence: grounding.evidence,
      _rowEvidence: this._buildRowEvidence(
        rows[i].pageNum,
        rows[i].y || null,
        Array.isArray(rows[i].tokens) ? rows[i].tokens : Array.isArray(rows[i].text) ? rows[i].text : (rows[i].text ? [{ x: rows[i].x || 0, y: rows[i].y || 0, text: rows[i].text }] : []),
        [],
        grounding.evidence,
      ),
        rawText: ctx.rawText,
        pageNum: rows[i].pageNum,
        x: rows[i].x || 0,
        y: rows[i].y || 0
      });
    }

    if (typeof SkuAllocator !== 'undefined') SkuAllocator.allocateBatch(products, []);

    // 2. ASIGNACIÓN GLOBAL BIPARTITA DE IMÁGENES POR PÁGINA (Previene robo de fotos e índices desfasados)
    this.matchImagesToProductsGlobal(products, allImages);

    // 3. Evaluar confianza final para cada producto
    for (const p of products) {
      const evalScore = this.evaluateItemConfidence(p);
      p.confidence = evalScore.confidence;
      p.status = evalScore.status;
       p.warnings = [...new Set([...(p.warnings || []), ...evalScore.warnings])];
       p.sourceWarnings = p.sourceWarnings || [...(p.warnings || [])];
       p.qualityReason = p.warnings[0] || 'Sin observaciones';
    }

    return products;
  },


  /**
   * Detecta si el modelo NO tiene evidencia literal en el cellRawText.
   * Devuelve { gap, cellCodes, cellText }. gap=true cuando la primera palabra
   * alfanumérica del modelo (>=4 chars) no aparece en la celda (comparación
   * sin espacios + tolerancia de prefijo >=3) Y la celda contiene códigos de
   * producto alternativos (no solo variante/color/estado/tipo/specs). Usado
   * por evaluateItemConfidence (degradar) y finalizeCatalogProducts (corregir
   * el modelo cuando la celda tiene UN código con formato de modelo).
   */
  modelEvidenceGap(item) {
    const cellText = (item.cellRawText || item.rawText || '').trim();
    if (!cellText || !item.modelo) return { gap: false, cellCodes: [], cellText };
    const firstWordMatch = item.modelo.match(/[A-Za-z0-9][A-Za-z0-9.-]*/);
    const firstWord = firstWordMatch ? firstWordMatch[0] : '';
    const cellFlat = cellText.replace(/\s+/g, '').toLowerCase();
    const firstFlat = firstWord.replace(/[\s-]/g, '').toLowerCase();
    // Comparación sin espacios + tolerancia de prefijo (Mars75 vs 'Mar 75').
    let hasEvidence = firstFlat.length >= 2 && cellFlat.includes(firstFlat);
    if (!hasEvidence && firstFlat.length >= 3) {
      for (let k = 3; k <= Math.min(5, firstFlat.length); k++) {
        if (cellFlat.includes(firstFlat.slice(0, k))) { hasEvidence = true; break; }
      }
    }
    if (hasEvidence || firstFlat.length < 4) return { gap: false, cellCodes: [], cellText };
    const CODE_NOISE_RE = /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|dark|light|transparent|released|new|upcoming|color|wired|wireless|bluetooth|2\.4g|usb|model|price|rmb|usd|cny|keyboard|mouse|controller|headset|earphone|earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|adapter|cable|stand|gamepad|receiver|mechanical|magnetic|tri|mode|keycap|engraving|mint|side|ice|core|total|bottoming|stroke|upper|lower|cover|material|working|force|axle|tactile|linear|clicky|actuation|travel|spring|stem|housing|factory|lubed|pom|pc|pa|upe|nylon|dustproof|dust|plate|bracket|screw|pre[-\s]?travel|post[-\s]?travel|bottom[- ]?out|noise|silent|smooth|clack|thock|long[- ]?pole|short[- ]?pole)\b/gi;
    const cellCodes = cellText.replace(CODE_NOISE_RE, ' ').replace(/[^\w\u00C0-\u024F]+/g, ' ').trim().split(/\s+/).filter(w => w.length >= 2 && !/^\d+$/.test(w) && !/^\d+([.,]\d+)?(mn|mm|g|n|hz|khz|mv|mah|db|ms|rpm|kg|v|w|dpi|ips|pf|f|k)\b/i.test(w));
    // La marca del propio producto no es evidencia de un modelo distinto
    // ("MChose Red" → codes=[MChose] → gap falso). Se filtra por token.
    const brandTokens = (item.marca || '').toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    const filteredCodes = cellCodes.filter(w => !brandTokens.includes(w.toLowerCase()));
    if (envFlag('P1_DEBUG') && cellCodes.length >= 1) {
      console.error(`[GRND] "${item.modelo}" | cell="${cellText.slice(0, 80)}" | codes=${cellCodes.join(',')}`);
    }
    return { gap: filteredCodes.length >= 1, cellCodes: filteredCodes, cellText };
  },

  evaluateItemConfidence(item) {
    let confidence = 100;
    const warnings = [];
    const critical = [];

    if (!item.marca || item.marca === 'OTRO') critical.push('Marca no identificada');
    if (!item.cat || item.cat === 'OTRO') critical.push('Categoría no identificada');
    if (!item.modelo || item.modelo.length < 2) critical.push('Modelo vacío o demasiado corto');

    if (!Number.isFinite(Number(item.fob)) || Number(item.fob) <= 0) {
      critical.push('FOB inválido');
    } else {
      // Range by category: switches legitimately cost $0.19 (SWITCH min 0.05),
      // while a keyboard below $0.50 is suspicious. Reuse the validator ranges.
      const range = (typeof CatalogValidator !== 'undefined' && CatalogValidator.PRICE_RANGES)
        ? CatalogValidator.PRICE_RANGES[item.cat] : null;
      const fobNum = Number(item.fob);
      // Fail-closed (B4): una categoría sin rango conocido (OTRO/desconocida)
      // NUNCA debe dejar un FOB extremo (<$0.05 o >$2000) en GREEN silencioso.
      // La banda conservadora 0.50–350 es más estricta que el piso del spec y
      // cubre el rango intermedio; se mantiene deliberadamente (duda → YELLOW).
      const minFob = range ? Math.max(0.01, range.min * 0.5) : 0.50;
      const maxFob = range ? range.max : 350.00;
      if (fobNum < minFob || fobNum > maxFob) {
        confidence -= 15;
        warnings.push(`Precio FOB USD ($${fobNum.toFixed(2)}) inusual o fuera de rango habitual`);
      }
    }

    if (!this.isValidImageDataUrl(item.img)) {
      confidence -= 15;
      warnings.push('Imagen faltante o inválida: requiere revisión');
    }

    // Grounding literal del modelo (B1, fail-closed): la primera palabra
    // alfanumérica del modelo debe aparecer en el texto crudo de su celda/fila.
    // Si no, el modelo pudo mezclarse (specs de otra columna, fila mal unida)
    // -> YELLOW. Solo aplica cuando hay texto crudo (paths espaciales) y la
    // celda contiene un CÓDIGO de producto alternativo: si la celda es solo
    // variante/color/estado (ej 'Purple', 'released Color New Red'), el modelo
    // vino por herencia de familia y es legítimo — no se degrada.
    const gap = this.modelEvidenceGap(item);
    if (gap.gap) {
      confidence -= 20;
      warnings.push(`Modelo "${item.modelo}" sin evidencia literal en el texto de la celda`);
    }

    const grounded = item.grounded !== undefined ? item.grounded : item.isGroundedFob;
    if (grounded === false) {
      confidence -= 25;
      warnings.push(item.groundingReason || 'FOB sin evidencia literal suficiente');
    } else if (grounded !== true) {
      critical.push('Evidencia de grounding insuficiente');
    }

    let status = 'GREEN';
    if (critical.length > 0) status = 'RED';
    else if (confidence < 100 || warnings.length > 0) status = 'YELLOW';

    return {
      confidence: Math.max(0, confidence - critical.length * 30),
      status,
      warnings: [...critical, ...warnings],
      critical
    };
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
      if (/^[\d\s.,-]+$/.test(t)) return true;
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
      ? inlineParts.replace(/[-\s]+$/g, '').trim()
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


  /**
   * Recovers real model names for rows whose extracted model is a bare color or
   * status word (e.g. "Purple", "released", "Black") — a variant row that lost
   * its parent. The parent is the nearest product above on the same page with
   * the same brand+category and a non-generic model. The color moves to the
   * variant and the parent model is adopted.
   * @returns {number} number of recovered products
   */
  recoverGenericModelNames(products) {
    const GENERIC_MODEL_RE = /^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy|released|new|upcoming)$/i;
    let recovered = 0;
    for (const p of products) {
      const modelo = String(p.modelo || '').trim();
      if (!modelo || !GENERIC_MODEL_RE.test(modelo)) continue;
      if (typeof p.y !== 'number' || typeof p.pageNum !== 'number') continue;

      // Candidate parents: same brand+category, non-generic model.
      // Priority 1: same FOB (a color/status row is a variant of the row with
      // the same price), on the same page OR the previous page (first row of a
      // continuation block). Priority 2: nearest row above on the same page.
      let sameFob = null;
      let sameFobDist = Infinity;
      let nearest = null;
      let nearestDist = Infinity;

      for (const q of products) {
        if (q === p) continue;
        if (String(q.cat || '').toUpperCase() !== String(p.cat || '').toUpperCase()) continue;
        if (String(q.marca || '').toLowerCase() !== String(p.marca || '').toLowerCase()) continue;
        const qModelo = String(q.modelo || '').trim();
        if (!qModelo || GENERIC_MODEL_RE.test(qModelo)) continue;
        const qPage = typeof q.pageNum === 'number' ? q.pageNum : null;
        const qY = typeof q.y === 'number' ? q.y : null;
        if (qY === null || qPage === null) continue;

        const fobMatch = typeof p.fob === 'number' && typeof q.fob === 'number' &&
          Math.abs(p.fob - q.fob) <= 0.01 && (qPage === p.pageNum || qPage === p.pageNum - 1);
        if (fobMatch) {
          const dist = Math.abs(p.y - qY) + (qPage === p.pageNum - 1 ? 500 : 0);
          if (dist < sameFobDist) { sameFobDist = dist; sameFob = q; }
          continue;
        }
        if (qPage === p.pageNum && qY < p.y) {
          const dist = p.y - qY;
          if (dist <= 250 && dist < nearestDist) { nearestDist = dist; nearest = q; }
        }
      }

      const best = sameFob || nearest;
      if (best) {
        p.variante = (modelo + ' ' + String(p.variante || '')).replace(/\s+/g, ' ').trim();
        p.modelo = best.modelo;
        p._modelRecovered = true;
        recovered += 1;
      }
    }
    return recovered;
  },

  /**
   * Asignación de costo mínimo (Kuhn-Munkres / húngaro, O(n^3)).
   * costMatrix: n×n con costos (Infinity = prohibido, se usa BIG).
   * Devuelve [{ prodIdx, imgIdx }] — la asignación óptima global.
   */
  hungarianAssign(costMatrix, n) {
    const BIG = 1e12;
    const c = costMatrix.map(row => row.map(v => (Number.isFinite(v) ? v : BIG)));
    const u = new Array(n + 1).fill(0);
    const v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0);
    const way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(n + 1).fill(BIG);
      const used = new Array(n + 1).fill(false);
      let guard = 0;
      do {
        // Guard anti-loop infinito (fix 05/08): el do-while del húngaro nunca
        // necesita más de n iteraciones (cada una marca used[j0]). Si un caso
        // degenerado (matriz con BIG/valores repetidos) lo hace ciclar, se
        // corta y la fila queda sin asignar — fail-closed, el greedy ya corrió.
        if (++guard > n + 1) break;
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = -1;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        if (j1 === -1) break; // sin columnas alcanzables: matriz degenerada
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else { minv[j] -= delta; }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      let guard2 = 0;
      do {
        // Guard anti-loop (fix 05/08): la reconstrucción del camino vía way[]
        // puede ciclar si la matriz degenerada dejó way con un ciclo (medido
        // en 8BitDo p7: cuelgue infinito). Se corta a n+1 pasos — la fila
        // queda sin asignar (fail-closed, el greedy ya corrió).
        if (++guard2 > n + 1) break;
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0);
    }
    const assignment = [];
    for (let j = 1; j <= n; j++) {
      if (p[j] > 0 && c[p[j] - 1][j - 1] < BIG) {
        assignment.push({ prodIdx: p[j] - 1, imgIdx: j - 1 });
      }
    }
    return assignment;
  },

  matchImagesToProductsGlobal(products, allImages) {
    // Marcadores de coincidencia débil (fail-closed). El matcher registra en
    // imgWarnings las advertencias de VALIDACIÓN VISUAL reales (color no
    // coincide, casi monocromática, shape aceptada en backfill). NO se marcan
    // los mecanismos de recuperación por sí mismos (pase relajado, huérfanas
    // por proximidad, alineación de galería): están verificados como fuentes
    // de fotos correctas en estos catálogos (fotos combo mouse+teclado, AJAZZ
    // 11/11, Irok 7/7). Degradarlos en masa volvería inutilizable el semáforo
    // (1072 YELLOW medidos). El gate weak-image degrada SOLO por señales de
    // foto posiblemente equivocada (casi monocromática = fondo sin producto).
    if (!products || !products.length) return;
    products.forEach(product => {
      if (!this.isValidImageDataUrl(product.img)) {
        product.img = '-';
        // Wire absent evidence for R9 contract
        if (!product.imageEvidence) {
          product.imageEvidence = this.buildImageEvidence(
            product._pdfIdentity || 'unknown',
            product.pageNum || 0,
            null,
            product.sku || '',
            'none'
          );
        }
      }
    });
    if (!allImages || !allImages.length) return;
    // Deduplicar imágenes (mismo dataUrl = misma imagen extraída dos veces)
    const seenUrls = new Set();
    const uniqueImages = allImages.filter(img => {
      if (!this.isValidImageDataUrl(img.dataUrl) || seenUrls.has(img.dataUrl)) return false;
      seenUrls.add(img.dataUrl);
      return true;
    });

    const pageNumbers = [...new Set(products.map(p => p.pageNum))];

    for (const pNum of pageNumbers) {
      const pageProds = products.filter(p => p.pageNum === pNum);
      const pageImgs = uniqueImages.filter(img => img.pageNum === pNum);
      if (!pageProds.length || !pageImgs.length) continue;
      const assignedProds = new Set();
      const assignedImgs = new Set();
      const MAX_SCORE = 50000;

      // Matriz de costos por página. relaxed=true afloja las gates duras
      // (shape gate → penalty, distancias mayores) para el backfill.
      const buildMatrix = (relaxed) => {
        const costMatrix = [];
        for (let i = 0; i < pageProds.length; i++) {
          const p = pageProds[i];
          const rowCost = [];

          for (let j = 0; j < pageImgs.length; j++) {
            const img = pageImgs[j];
            const distX = Math.abs(img.x - p.x);
            const distYRaw = p.y - img.y;

            // Hard gate: demasiado lejos → Infinity (no asignar). Gates ajustados
            // (distX 300→200, distY 400→250) para evitar fugas entre columnas/filas densas.
            // El backfill (relaxed) NO relaja la distancia — solo el shape gate.
            const distXLimit = 200;
            const yUpper = 250;
            const yLower = -100;
            if (distX > distXLimit || distYRaw > yUpper || distYRaw < yLower) {
              rowCost.push({ imgIdx: j, prodIdx: i, totalScore: Infinity, distX, distYRaw, penalty: Infinity, validation: null });
              continue;
            }

            const validation = this.validateImageForProduct(img, p, relaxed);

            // Hard gate: validación visual fallida → Infinity
            if (!validation.valid) {
              rowCost.push({ imgIdx: j, prodIdx: i, totalScore: Infinity, distX, distYRaw, penalty: Infinity, validation });
              continue;
            }

            let penalty = (100 - validation.score) * 150;
            if (img.y > p.y + 10) penalty += (relaxed ? 20000 : 40000);
            if (distX > 160) penalty += 25000;

            const baseDist = Math.hypot(distX * 1.5, Math.max(0, distYRaw) * 1.0);
            rowCost.push({ imgIdx: j, prodIdx: i, totalScore: baseDist + penalty, distX, distYRaw, penalty, validation });
          }
          costMatrix.push(rowCost);
        }
        return costMatrix;
      };

      const runGreedy = (costMatrix, relaxed) => {
        while (assignedProds.size < pageProds.length && assignedImgs.size < pageImgs.length) {
          let minPair = null;

          for (let i = 0; i < pageProds.length; i++) {
            if (assignedProds.has(i)) continue;
            for (let j = 0; j < pageImgs.length; j++) {
              if (assignedImgs.has(j)) continue;
              const pair = costMatrix[i][j];
              if (pair.totalScore === Infinity) continue;
              if (!minPair || pair.totalScore < minPair.totalScore) {
                minPair = pair;
              }
            }
          }

          if (!minPair || minPair.totalScore > MAX_SCORE) break;

          const winnerProd = pageProds[minPair.prodIdx];
          const winnerImg = pageImgs[minPair.imgIdx];

          winnerProd.img = this.isValidImageDataUrl(winnerImg.dataUrl) ? winnerImg.dataUrl : '-';
          if (minPair.validation && minPair.validation.warnings.length) {
            winnerProd.imgWarnings = minPair.validation.warnings;
          }
          // Wire image evidence for R9 contract (Slice 2)
          winnerProd.imageEvidence = this.buildImageEvidence(
            winnerProd._pdfIdentity || 'unknown',
            pNum,
            winnerImg,
            winnerProd.sku || '',
            'matched'
          );
          assignedProds.add(minPair.prodIdx);
          assignedImgs.add(minPair.imgIdx);
        }
      };

      // Pase 1: asignación estricta (gates duras).
      runGreedy(buildMatrix(false), false);

      // Pase 2 (backfill): productos que quedaron sin imagen reciben la mejor
      // imagen restante con gates relajadas (shape gate → penalty). Recupera
      // páginas cuyas fotos son todas anchas (Logitech product + specs tiles).
      const stillEmpty = pageProds.some((p, idx) => !assignedProds.has(idx) && !this.isValidImageDataUrl(p.img));
      if (stillEmpty && assignedImgs.size < pageImgs.length) {
        runGreedy(buildMatrix(true), true);
      }

      // Pase 4 (re-optimización húngara — SOLO páginas con fotos compartidas):
      // cuando 2+ productos de la página comparten el MISMO dataUrl (el row
      // engine dio la misma foto al par TECLADO/MOUSE de una línea), el greedy
      // no deshace el cruce y las gates cross-cat desasignan al secundario.
      // La asignación de costo mínimo global (Kuhn-Munkres) le da a cada
      // producto su mejor foto. Solo se aplica un cambio si el nuevo par es
      // ESTRICTAMENTE mejor que el actual (los productos bien asignados no se
      // tocan; los que tienen su foto fuera de las gates la conservan).
      // NOTA ORQUESTADOR (2026-08-06 IT11): ACTIVADO por defecto — el guard
      // anti-loop (CIERRE 05/08) eliminó el colgado (8BitDo: >600s → 1.4s
      // verificado IT6). Desactivar con HUNGARIAN_P4=0 si algún catálogo
      // regresiona (medición de corpus es la evidencia, no la opinión).
      if (envFlag('HUNGARIAN_P4') !== '0') {
      {
        const urlCount = {};
        for (const pp of pageProds) {
          if (this.isValidImageDataUrl(pp.img)) urlCount[pp.img] = (urlCount[pp.img] || 0) + 1;
        }
        const hasShared = Object.values(urlCount).some(c => c > 1);
        if (hasShared && pageProds.length > 1) {
          const matrix = buildMatrix(false);
          const n = Math.max(pageProds.length, pageImgs.length);
          const bigMatrix = [];
          for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < n; j++) {
              row.push((i < pageProds.length && j < pageImgs.length) ? matrix[i][j].totalScore : Infinity);
            }
            bigMatrix.push(row);
          }
          const assignment = this.hungarianAssign(bigMatrix, n);
          for (const { prodIdx, imgIdx } of assignment) {
            if (prodIdx >= pageProds.length || imgIdx >= pageImgs.length) continue;
            const prod = pageProds[prodIdx];
            const newCost = matrix[prodIdx][imgIdx].totalScore;
            if (!Number.isFinite(newCost) || newCost > MAX_SCORE) continue;
            let curCost = Infinity;
            if (this.isValidImageDataUrl(prod.img)) {
              for (let j = 0; j < pageImgs.length; j++) {
                if (pageImgs[j].dataUrl === prod.img) { curCost = matrix[prodIdx][j].totalScore; break; }
              }
            }
            if (newCost < curCost) {
              prod.img = pageImgs[imgIdx].dataUrl;
              if (matrix[prodIdx][imgIdx].validation && matrix[prodIdx][imgIdx].validation.warnings.length) {
                prod.imgWarnings = matrix[prodIdx][imgIdx].validation.warnings;
              }
            }
          }
        }
      }
      } // fin HUNGARIAN_P4 guard

      // Pase 3 (galería desfasada): tablas con la galería de fotos desplazada
      // (tabla arriba y fotos ~400-500px debajo, o viceversa — AJAZZ/ATK/AULA).
      // Las gates de distancia no pueden cubrirlo sin arriesgar fugas entre
      // filas densas, así que cuando los productos sin imagen tienen una
      // galería alineable por orden de Y (offset UNIFORME, pitch constante) se
      // alinean fila-i ↔ foto-i. Usa las imágenes crudas de la página (no el
      // dedup global): fotos idénticas repetidas (mismo switch, mismo cable
      // en 2 colores) son compartición legítima, no duplicados.
      const stillEmptyIdx = [];
      for (let i = 0; i < pageProds.length; i++) {
        if (!assignedProds.has(i) && !this.isValidImageDataUrl(pageProds[i].img)) stillEmptyIdx.push(i);
      }
      // Productos con foto COMPARTIDA dentro de la página (el row engine no
      // trackea imágenes usadas: dos filas pueden elegir la misma foto). El
      // secundario buscará su propia imagen libre en el backfill de huérfanas;
      // si no hay, conserva la compartida (los gates la auditan luego).
      const sharedIdx = [];
      const pageUrlCount = {};
      for (const p of pageProds) {
        if (this.isValidImageDataUrl(p.img)) pageUrlCount[p.img] = (pageUrlCount[p.img] || 0) + 1;
      }
      for (let i = 0; i < pageProds.length; i++) {
        const p = pageProds[i];
        if (assignedProds.has(i) || stillEmptyIdx.includes(i)) continue;
        if (this.isValidImageDataUrl(p.img) && pageUrlCount[p.img] > 1) sharedIdx.push(i);
      }
      const usedUrls = new Set();
      for (const j of assignedImgs) usedUrls.add(pageImgs[j].dataUrl);
      // Imágenes tomadas: las del greedy + las que ya tienen dueño en la página
      // (fila con imagen válida que no es huérfana ni compartida). Evita que el
      // backfill vuelva a elegir la foto compartida o robe la de otra fila.
      const orphanSet = new Set([...stillEmptyIdx, ...sharedIdx]);
      for (let i = 0; i < pageProds.length; i++) {
        const p = pageProds[i];
        if (orphanSet.has(i)) continue;
        if (this.isValidImageDataUrl(p.img)) usedUrls.add(p.img);
      }
      const fullPageImgs = (allImages || []).filter(img => img.pageNum === pNum && !usedUrls.has(img.dataUrl));
      if (stillEmptyIdx.length >= 3 && fullPageImgs.length >= stillEmptyIdx.length) {
        const prodsAsc = [...stillEmptyIdx].sort((a, b) => pageProds[a].y - pageProds[b].y);
        const imgsAsc = fullPageImgs.slice().sort((a, b) => a.y - b.y);
        const np = prodsAsc.length;
        const maxShift = imgsAsc.length - np;
        let best = null;
        for (let shift = 0; shift <= maxShift; shift++) {
          const dists = prodsAsc.map((pi, k) => pageProds[pi].y - imgsAsc[shift + k].y);
          const mid = dists[Math.floor(dists.length / 2)];
          const dev = Math.max(...dists.map(d => Math.abs(d - mid)));
          if (dev > Math.max(60, Math.abs(mid) * 0.2)) continue;
          if (!best || dev < best.dev) best = { shift, dev };
        }
        if (best) {
          for (let k = 0; k < np; k++) {
            const prod = pageProds[prodsAsc[k]];
            const img = imgsAsc[best.shift + k];
            prod.img = this.isValidImageDataUrl(img.dataUrl) ? img.dataUrl : '-';
            assignedProds.add(prodsAsc[k]);
          }
        }
      } else if ((stillEmptyIdx.length + sharedIdx.length) >= 1 && (stillEmptyIdx.length + sharedIdx.length) <= 20 && fullPageImgs.length >= 3) {
        if (envFlag('P3_DEBUG')) console.log(`[P3] p${pNum} empty=${stillEmptyIdx.length} shared=${sharedIdx.length} free=${fullPageImgs.length}`);
        // Huérfanas individuales: la foto de la fila está ~250-700px debajo del
        // texto (layout foto-bajo-texto con espacio variable). El fallback del
        // row engine (distY < -160) y las gates del matcher (distYRaw < -100)
        // las dejan afuera. La imagen libre MÁS CERCANA en Y (dentro de 700px)
        // que pase la validación relaxed es la de su propia fila: las vecinas
        // ya consumieron las suyas (excluidas vía usedUrls). También entran
        // los productos con foto compartida en la página (sharedIdx): buscan
        // su propia foto antes de que los gates los desasignen.
        const orphans = [...stillEmptyIdx, ...sharedIdx].sort((a, b) => pageProds[a].y - pageProds[b].y);
        let freeSorted = fullPageImgs.slice().sort((a, b) => a.y - b.y);
        for (const pi of orphans) {
          const prod = pageProds[pi];
          let bestImg = null;
          let bestDist = Infinity;
          let bestValidation = null;
          for (const img of freeSorted) {
            const distY = prod.y - (img.centerY || (img.y + (img.height || 0) / 2));
            if (distY > 460 || distY < -700) continue;
            const validation = this.validateImageForProduct(img, prod, true);
            if (!validation.valid) continue;
            if (Math.abs(distY) < bestDist) { bestDist = Math.abs(distY); bestImg = img; bestValidation = validation; }
          }
          if (bestImg) {
            prod.img = this.isValidImageDataUrl(bestImg.dataUrl) ? bestImg.dataUrl : '-';
            assignedProds.add(pi);
            usedUrls.add(bestImg.dataUrl);
            freeSorted = freeSorted.filter(i => i !== bestImg);
            // Conserva los warnings de VALIDACIÓN VISUAL del ganador (color,
            // casi monocromática) — el gate weak-image los evalúa; el marcador
            // de 'huérfana por proximidad' por sí solo NO degrada (mecanismo
            // verificado: galerías desplazadas de Irok/AULA/RK asignan bien).
            if (bestValidation && bestValidation.warnings && bestValidation.warnings.length) {
              if (!Array.isArray(prod.imgWarnings)) prod.imgWarnings = [];
              for (const w of bestValidation.warnings) {
                if (!prod.imgWarnings.includes(w)) prod.imgWarnings.push(w);
              }
            }
          }
        }
      }
    }
  },

  /**
   * Slice 1: attach interior color + aspect meta to a product that just
   * received an image (used by the global matcher paths). ImageTextGates
   * consumes _interiorColor/_imgAspect on the final product.
   */
  _attachImageMeta(product, img) {
    if (!product || !img) return;
    product._interiorColor = img.interiorColor || null;
    product._imgAspect = img.width && img.height ? img.width / img.height : null;
  },

  /**
   * Median Y of a row's text tokens - the row baseline used by grounding
   * verification (Slice 2). Returns null when no numeric y is available.
   */
  _buildRowEvidence(page, rowTextY, textItems, anchors, alignment) {
    return {
      page,
      rowTextY: typeof rowTextY === 'number' ? rowTextY : null,
      textItems: (Array.isArray(textItems) ? textItems : []).map((t) => ({
        str: t && typeof t.str === 'string' ? t.str : String((t && t.text) || ''),
        x: t && typeof t.x === 'number' ? t.x : 0,
        y: t && typeof t.y === 'number' ? t.y : 0,
        width: t && typeof t.width === 'number' ? t.width : 0,
        height: t && typeof t.height === 'number' ? t.height : 0,
        page,
      })),
      anchors: (Array.isArray(anchors) ? anchors : []).map((a) => ({
        x: a && typeof a.x === 'number' ? a.x : 0,
        y: a && typeof a.y === 'number' ? a.y : 0,
        str: a && typeof a.rawLine === 'string' ? a.rawLine : a && typeof a.str === 'string' ? a.str : '',
      })),
      alignment: {
        dx: alignment && typeof alignment.dx === 'number' ? alignment.dx : 0,
        dy: alignment && typeof alignment.dy === 'number' ? alignment.dy : null,
      },
    };
  },

  medianY(items) {
    if (!Array.isArray(items) || !items.length) return null;
    const ys = items.map(it => (it && typeof it.y === 'number' ? it.y : null))
      .filter(y => y !== null).sort((a, b) => a - b);
    if (!ys.length) return null;
    const mid = Math.floor(ys.length / 2);
    return ys.length % 2 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2;
  },

  /**
   * Slice 2 (fob-grounding-integrity): DERIVES `grounded` from anchor-to-row
   * geometry instead of trusting the literal-anchor presence. The FOB anchor
   * must be on the same page, horizontally aligned with the row's text
   * baseline (same column band), and the NEAREST candidate anchor to that
   * row - otherwise the price probably belongs to a neighbor (fused cell /
   * shifted column). Unverifiable anchors degrade to YELLOW (never RED); RED
   * stays reserved for missing/invalid FOB.
   *
   * @param {Object} opts
   * @param {Object|null} opts.anchor - The price anchor used for this product
   * @param {number|null} opts.rowTextY - Median Y of the row's text tokens
   * @param {number} opts.pageNum
   * @param {Array} opts.pageAnchors - All price anchors of the page
   * @param {number} [opts.columnTolerance=40] - grid engine column epsilon
   * @param {number} [opts.rowTolerance=30] - engine same-row epsilon
   * @returns {{grounded:boolean, reason:string, evidence:Object}}
   */
  verifyGrounding({ anchor, rowTextY, pageNum, pageAnchors, columnTolerance = 40, rowTolerance = 30 }) {
    const page = pageNum;
    const price = anchor ? anchor.price : null;

    // 1. Absent anchor (matrix/fallback path): nothing to verify.
    if (!anchor || typeof anchor.x !== 'number' || typeof anchor.y !== 'number') {
      return { grounded: false, reason: 'FOB sin ancla literal verificada',
        evidence: { groundingMode: 'geometric', page, anchorX: null, rowX: null, dx: null, dy: null, price } };
    }

    // 2. Same-column band (the grid engine's column tolerance).
    const band = (pageAnchors || []).filter(a => a && typeof a.x === 'number' && Math.abs(a.x - anchor.x) <= columnTolerance);

    // 3. Nearest anchor to the row text baseline (the anchor itself included).
    const rowY = typeof rowTextY === 'number' && Number.isFinite(rowTextY) ? rowTextY : null;
    if (rowY === null) {
      return { grounded: false, reason: 'ancla no alineada',
        evidence: { groundingMode: 'geometric', page, anchorX: anchor.x, rowX: anchor.x, dx: 0, dy: null, price } };
    }
    let nearest = anchor;
    let minDist = Math.abs(anchor.y - rowY);
    for (const a of band) {
      const d = Math.abs(a.y - rowY);
      if (d < minDist) { minDist = d; nearest = a; }
    }

    // 4. Fused cell / shifted column: a neighbor anchor is closer to this row.
    if (nearest !== anchor) {
      return { grounded: false, reason: 'ancla de fila vecina',
        evidence: { groundingMode: 'geometric', page, anchorX: anchor.x, rowX: nearest.x, dx: nearest.x - anchor.x, dy: minDist, price } };
    }

    // 5. Vertical alignment: the anchor must be within the row tolerance.
    const dy = anchor.y - rowY;
    if (Math.abs(dy) > rowTolerance) {
      return { grounded: false, reason: 'ancla no alineada',
        evidence: { groundingMode: 'geometric', page, anchorX: anchor.x, rowX: anchor.x, dx: 0, dy, price } };
    }

    // 6. Verified: anchor belongs to this row.
    return { grounded: true, reason: 'FOB verificado por geometría de fila',
      evidence: { groundingMode: 'geometric', page, anchorX: anchor.x, rowX: anchor.x, dx: 0, dy, price } };
  },

  /**
   * Build structured image evidence for the R1-R10 contract (Slice 2).
   * Records PDF identity, page, decode result, dimensions, position, and association.
   * @param {string} pdfIdentity - SHA-256 or stable identifier of the source PDF
   * @param {number} pageNum - 1-based page number
   * @param {Object|null} rawImage - Extracted image {width,height,x,y,dataUrl} or null
   * @param {string} productRowId - SKU or row identity this evidence belongs to
   * @param {string} association - 'matched' | 'none' | 'ambiguous'
   * @returns {Object} Structured evidence for evaluateItem R9
   */
  buildImageEvidence(pdfIdentity, pageNum, rawImage, productRowId, association) {
    if (!rawImage) {
      return {
        pdfIdentity: pdfIdentity || 'unknown',
        page: pageNum || 0,
        imageFormat: null,
        width: 0,
        height: 0,
        sourcePosition: null,
        canvasDecode: 'absent',
        productRowId: productRowId || '',
        association: association || 'none'
      };
    }
    const fmt = (rawImage.dataUrl || '').match(/^data:image\/(\w+)/);
    return {
      pdfIdentity: pdfIdentity || 'unknown',
      page: pageNum || 0,
      imageFormat: fmt ? fmt[1] : 'unknown',
      width: rawImage.width || 0,
      height: rawImage.height || 0,
      sourcePosition: { x: rawImage.x || 0, y: rawImage.y || 0 },
      canvasDecode: this.isValidImageDataUrl(rawImage.dataUrl) ? 'success' : 'failed',
      productRowId: productRowId || '',
      association: association || 'none'
    };
  }
};

if (typeof window !== 'undefined') window.PdfParser = PdfParser;
  // IT35: clasificador puro extraído (pdfParserClassifier.js) — marca, categoría,
  // precio y limpieza de títulos. Se asigna acá para preservar la API PdfParser.*
  // (browser: global cargado antes; node: require fallback para ground-truth/measure).
if (typeof PdfParserClassifier !== 'undefined') {
  Object.assign(PdfParser, PdfParserClassifier);
} else if (typeof module !== 'undefined' && typeof require === 'function') {
  try { Object.assign(PdfParser, require('./pdfParserClassifier.js')); } catch (e) {}
}

if (typeof module !== 'undefined') module.exports = PdfParser;

