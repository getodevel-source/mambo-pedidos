/**
 * Mambo Pedidos - Parser Moderno de PDFs (v6)
 * Arquitectura modular basada en los nuevos componentes core
 */

const ModernPdfParser = {

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
        if (typeof onProgress === 'function') onProgress(pageNum, pdf.numPages);

        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        if (pageNum <= 3) fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';

        const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
        allImages.push(...pageImages);

        const pageProducts = this.extractPageProductsByCellGrid(
          content.items, viewport.height, pageNum, pageImages, customBrands
        );
        allProducts.push(...pageProducts);
      }

      const cleanText = fullTextForBrand.replace(/\s+/g, '');
      if (pdf.numPages > 0 && cleanText.length < 20) {
        throw new Error('El PDF no contiene capa de texto seleccionable. Requiere OCR.');
      }

      const brand = SharedUtils.detectBrand(fullTextForBrand, customBrands) 
        || this.detectBrandFromFilename(file.name, customBrands);

      const finalProducts = ProductSanitizer.processBatch(allProducts, brand, customBrands);

      return { brand, products: finalProducts };

    } catch (error) {
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.capture(error, { module: 'ModernPdfParser', method: 'processPdfFile' });
      } else {
        console.error('Error procesando PDF:', error);
      }
      throw error;
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try { pdf.destroy(); } catch (e) {}
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
        const isImageOp = fnArray[i] === pdfjsLib.OPS.paintImageXObject 
          || fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject;
        if (!isImageOp) continue;

        const imageName = argsArray[i][0];
        let imgObj = null;
        try { imgObj = page.objs.get(imageName); } catch (e) { continue; }

        if (!imgObj || !imgObj.width || !imgObj.height || imgObj.width < 25 || imgObj.height < 25) continue;

        let ctm = null;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (fnArray[j] === pdfjsLib.OPS.transform) { ctm = argsArray[j]; break; }
        }

        const x = ctm ? ctm[4] : 0;
        const y = ctm ? viewport.height - ctm[5] : 0;

        if (typeof document !== 'undefined') {
          const dataUrl = this.renderImageToCanvas(imgObj);
          if (dataUrl) pageImages.push({ pageNum, y, x, width: imgObj.width, height: imgObj.height, dataUrl });
        }
      }
    } catch (err) { console.warn('Extracción de imágenes falló:', err); }
    return pageImages;
  },

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

    if (imgObj.bitmap) {
      try { ctx.drawImage(imgObj.bitmap, 0, 0); drewSuccessfully = true; } catch (e) {}
    }

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
          imgData.data[dstIdx] = imgObj.data[srcIdx++];
          imgData.data[dstIdx + 1] = imgObj.data[srcIdx++];
          imgData.data[dstIdx + 2] = imgObj.data[srcIdx++];
          imgData.data[dstIdx + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        drewSuccessfully = true;
      } else if (imgObj.data.length === totalPixels) {
        for (let p = 0; p < totalPixels; p++) {
          const val = imgObj.data[p];
          const idx = p * 4;
          imgData.data[idx] = val;
          imgData.data[idx + 1] = val;
          imgData.data[idx + 2] = val;
          imgData.data[idx + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        drewSuccessfully = true;
      }
    }

    if (!drewSuccessfully) return null;
    this.cleanImageBackground(ctx, imgObj.width, imgObj.height);

    const checkBytes = ctx.getImageData(0, 0, imgObj.width, imgObj.height).data;
    let visiblePixels = 0;
    for (let p = 0; p < checkBytes.length; p += 16) {
      if (checkBytes[p + 3] > 20 && (checkBytes[p] < 240 || checkBytes[p + 1] < 240 || checkBytes[p + 2] < 240)) {
        visiblePixels++;
      }
    }
    return visiblePixels >= 10 ? canvas.toDataURL('image/png') : null;
  },

  cleanImageBackground(ctx, width, height) {
    if (!ctx || !width || !height) return;
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const corners = [0, (width-1)*4, (height-1)*width*4, ((height-1)*width+width-1)*4];
      let sumR=0, sumG=0, sumB=0, count=0;
      for (const idx of corners) {
        if (data[idx+3] > 0) { sumR+=data[idx]; sumG+=data[idx+1]; sumB+=data[idx+2]; count++; }
      }
      if (count === 0 || sumR/count < 180) return;
      const bgR=sumR/count, bgG=sumG/count, bgB=sumB/count;
      const visited = new Uint8Array(width*height);
      const queue = [];
      for (let x=0; x<width; x++) { queue.push(x,0,x,height-1); }
      for (let y=1; y<height-1; y++) { queue.push(0,y,width-1,y); }
      let head = 0;
      while (head < queue.length) {
        const cx=queue[head++], cy=queue[head++], idx=cy*width+cx;
        if (visited[idx]) continue;
        visited[idx]=1;
        const pIdx=idx*4;
        if (Math.abs(data[pIdx]-bgR)+Math.abs(data[pIdx+1]-bgG)+Math.abs(data[pIdx+2]-bgB) < 28) {
          data[pIdx+3]=0;
          if(cx>0)queue.push(cx-1,cy);if(cx<width-1)queue.push(cx+1,cy);
          if(cy>0)queue.push(cx,cy-1);if(cy<height-1)queue.push(cx,cy+1);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch(e) { console.warn('Limpieza de fondo falló:', e); }
  },

  extractPageProductsByCellGrid(items, viewportHeight, pageNum, pageImages, customBrands) {
    if (!items || !items.length) return [];
    const rawElements = items.filter(i=>i.str&&i.str.trim()).map(i=>({x:i.transform[4],y:viewportHeight-i.transform[5],text:i.str.trim(),pageNum}));
    const priceAnchors = rawElements.filter(el=>!SharedUtils.isHeaderNoise(el.text)&&SharedUtils.extractUsdPrice(el.text)!==null)
      .map(el=>({...el,price:SharedUtils.extractUsdPrice(el.text)}));
    if (!priceAnchors.length) return [];
    priceAnchors.sort((a,b)=>a.y-b.y||a.x-b.x);
    const pageProducts = [];
    for (let i=0;i<priceAnchors.length;i++){
      const anchor=priceAnchors[i];
      const sameRow=priceAnchors.filter(a=>Math.abs(a.y-anchor.y)<=30).sort((a,b)=>a.x-b.x);
      const idx=sameRow.indexOf(anchor);
      let minX=idx>0?(sameRow[idx-1].x+anchor.x)/2:Math.max(0,anchor.x-140);
      let maxX=idx<sameRow.length-1?(sameRow[idx+1].x+anchor.x)/2:anchor.x+140;
      const prevY=priceAnchors.filter(a=>a.y<anchor.y-10);
      const rowH=prevY.length?Math.min(240,Math.max(40,anchor.y-Math.max(...prevY.map(p=>p.y)))):160;
      const cellItems=rawElements.filter(el=>el.y>=anchor.y-rowH+5&&el.y<=anchor.y+12&&el.x>=minX-10&&el.x<=maxX+10&&!SharedUtils.isPageNoise(el.text)&&SharedUtils.extractUsdPrice(el.text)===null);
      cellItems.sort((a,b)=>a.y-b.y||a.x-b.x);
      const lines=[];
      if(cellItems.length){
        let cur=[cellItems[0]],curY=cellItems[0].y;
        for(let j=1;j<cellItems.length;j++){
          if(Math.abs(cellItems[j].y-curY)<=6)cur.push(cellItems[j]);
          else{lines.push(cur.map(c=>c.text).join(' '));cur=[cellItems[j]];curY=cellItems[j].y;}
        }
        lines.push(cur.map(c=>c.text).join(' '));
      }
      const inline=anchor.rawLine.replace(/[¥￥]\s*[\d,]+\.?\d*/g,'').replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g,'').replace(/[\-\s]+$/,'').trim();
      let modelo=lines.length?lines[0]:inline?inline:'';
      let variante=lines.length>1?[...lines.slice(1),inline].filter(p=>p&&!SharedUtils.isPageNoise(p)).join(' '):'';
      if(!modelo)continue;
      const brand=SharedUtils.detectBrand(modelo+' '+variante,customBrands)||'OTRO';
      const cat=SharedUtils.detectCategory(modelo+' '+variante,brand);
      let img='';
      if(pageImages?.length){
        const cands=pageImages.filter(g=>g.pageNum===pageNum&&g.y<=anchor.y+10&&g.y>=anchor.y-280&&g.x>=minX-30&&g.x<=maxX+30);
        if(cands.length){
          const scored=cands.map(g=>({g,s:Math.hypot(Math.abs(g.x-anchor.x)*1.5,Math.max(0,anchor.y-g.y))})).sort((a,b)=>a.s-b.s);
          if(scored[0])img=scored[0].g.dataUrl;
        }
      }
      pageProducts.push({sku:'',cat,marca:brand,modelo,variante,fob:anchor.price,img,pageNum,x:anchor.x,y:anchor.y});
    }
    return pageProducts;
  },

  detectBrandFromFilename(filename, customBrands) {
    const f=filename.toLowerCase();
    for(const b of customBrands||[]){if(b.name&&b.pattern&&new RegExp(b.pattern,'i').test(f))return b.name;}
    const checks=[['8BitDo','8bitdo'],['AJAZZ','ajazz'],['AULA','aula'],['ATK','atk'],['Attack Shark','attack'],['MCHOSE','mchose'],['VGN','vgn'],['Madlions','madlions'],['Razer','razer'],['Logitech','logitech'],['Royal Kludge','royal kludge'],['Irok','irok'],['KZ','kz'],['Polaroid','polaroid'],['Philips','philips'],['Haimu','keyboard switch'],['Flydigi','flydigi'],['GameSir','gamesir']];
    for(const[b,k]of checks)if(f.includes(k))return b;
    return'OTRO';
  }
};

if(typeof window!=='undefined')window.ModernPdfParser=ModernPdfParser;
if(typeof module!=='undefined')module.exports=ModernPdfParser;
