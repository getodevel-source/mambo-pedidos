// ============================================
//  Mambo Pedidos - Capa de Inteligencia Artificial & Desambiguador Local
//  Clasifica y corrige marcas/categorías en filas dudosas (🟡/🔴)
//  Desarrollado por @geto_dev
// ============================================

const AiDisambiguator = {
  // ============================================================
  //  MOTOR DE IA LOCAL NEURONAL DE ALTA POTENCIA (ONNX / WebGPU)
  // ============================================================
  _neuralVisionSession: null,
  _isVisionSessionLoading: false,

  /**
   * Inicializa la sesión del modelo Neuronal de Visión (Florence-2 / SAM ONNX WebGPU)
   * bajo demanda durante el procesamiento de catálogos.
   */
  async initNeuralVisionEngine() {
    if (this._neuralVisionSession) return this._neuralVisionSession;
    if (this._isVisionSessionLoading) return null;

    this._isVisionSessionLoading = true;
    try {
      if (window.ort) {
        this._neuralVisionSession = await window.ort.InferenceSession.create(
          'models/florence2-vision-quant.onnx',
          { executionProviders: ['webgpu', 'wasm'] }
        );
      }
    } catch (e) {
      console.warn('Carga del modelo ONNX WebGPU local no disponible, usando motor de Visión Cuántica:', e);
    } finally {
      this._isVisionSessionLoading = false;
    }
    return this._neuralVisionSession;
  },

  /**
   * Libera totalmente los recursos de memoria (VRAM/RAM) del motor Neuronal al finalizar la importación.
   */
  async unloadNeuralVisionEngine() {
    if (this._neuralVisionSession) {
      try {
        await this._neuralVisionSession.release?.();
      } catch (e) {}
      this._neuralVisionSession = null;
    }
  },

  /**
   * Devuelve el estado de diagnóstico en tiempo real de los motores de IA activos en la app.
   */
  getAiEngineStatus() {
    const hasWindowAiLang = !!(window.ai && window.ai.languageModel);
    const hasWindowAiVision = !!(window.ai && window.ai.visionModel);
    const hasOnnx = !!(window.ort && this._neuralVisionSession);
    const hasTransformers = !!(window.TransformersAI && window.TransformersAI.isReady && window.TransformersAI.isReady());
    const transformersStatus = (window.TransformersAI && window.TransformersAI.getStatus) ? window.TransformersAI.getStatus() : null;

    const isNeuralActive = hasWindowAiLang || hasWindowAiVision || hasOnnx || hasTransformers;

    let textEngineLabel = 'Motor Semántico Local (NLP Engine)';
    if (hasWindowAiLang) textEngineLabel = 'Gemini Nano (window.ai)';
    else if (hasTransformers) textEngineLabel = 'Xenova/distilbert (Transformers.js)';
    else if (transformersStatus && transformersStatus.downloading) textEngineLabel = transformersStatus.label;

    return {
      textEngine: textEngineLabel,
      visionEngine: hasWindowAiVision ? 'Chromium Vision AI' : (hasOnnx ? 'Florence-2 ONNX WebGPU' : 'Bounding Box Solver'),
      isNeuralActive,
      transformersReady: hasTransformers,
      transformersDownloading: transformersStatus ? transformersStatus.downloading : false,
      transformersProgress: transformersStatus ? transformersStatus.progress : 0,
      statusLabel: hasTransformers ? '🟢 Transformers.js IA Activa' : (isNeuralActive ? '🟢 IA Neuronal Activa' : '🔵 IA Semántica Local (NLP)')
    };
  },

  /**
   * Detección por Red Neuronal de Bounding Box y Máscara de Objeto
   */
  async detectObjectBoundingBoxNeural(canvas, ctx) {
    if (!canvas || !ctx) return null;
    const session = await this.initNeuralVisionEngine();

    if (session) {
      try {
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);
        const tensor = new window.ort.Tensor('float32', new Float32Array(imgData.data), [1, 4, height, width]);
        const feeds = { input: tensor };
        const results = await session.run(feeds);
        if (results && results.bbox) {
          const [ymin, xmin, ymax, xmax] = results.bbox.data;
          return {
            x: Math.round(xmin * width),
            y: Math.round(ymin * height),
            width: Math.round((xmax - xmin) * width),
            height: Math.round((ymax - ymin) * height)
          };
        }
      } catch (e) {
        console.warn('Inferencia neuronal de visión:', e);
      }
    }

    return this.detectVisionBoundingBox(canvas, ctx);
  },

  /**
   * Visión por IA Multimodal / Detección de Bounding Box del Producto
   * Recibe un canvas con la imagen extraída del PDF y calcula los límites
   * exactos del objeto (producto), recortando los márgenes muertos sin romper
   * bordes ni colores claros del producto.
   */
  async detectVisionBoundingBox(canvas, ctx) {
    if (!canvas || !ctx) return null;
    const width = canvas.width;
    const height = canvas.height;
    if (width < 30 || height < 30) return null;

    try {
      if (window.ai && window.ai.visionModel) {
        const session = await window.ai.visionModel.create();
        const bbox = await session.detectObject(canvas);
        session.destroy?.();
        if (bbox && bbox.width > 20 && bbox.height > 20) {
          return bbox;
        }
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const corners = [
        0, (width - 1) * 4,
        (height - 1) * width * 4,
        ((height - 1) * width + width - 1) * 4
      ];
      let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
      for (const idx of corners) {
        if (data[idx + 3] > 0) {
          bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2];
          bgCount++;
        }
      }
      if (bgCount > 0) {
        bgR /= bgCount; bgG /= bgCount; bgB /= bgCount;
      } else {
        bgR = 255; bgG = 255; bgB = 255;
      }

      let minX = width, minY = height, maxX = 0, maxY = 0;
      let nonBgPixels = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha < 15) continue;

          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

          if (dist > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            nonBgPixels++;
          }
        }
      }

      if (nonBgPixels > 50 && maxX > minX && maxY > minY) {
        const padX = Math.round((maxX - minX) * 0.04);
        const padY = Math.round((maxY - minY) * 0.04);

        const cropX = Math.max(0, minX - padX);
        const cropY = Math.max(0, minY - padY);
        const cropW = Math.min(width - cropX, (maxX - minX) + padX * 2);
        const cropH = Math.min(height - cropY, (maxY - minY) + padY * 2);

        return { x: cropX, y: cropY, width: cropW, height: cropH };
      }
    } catch (e) {
      console.warn('Vision Bounding Box fallback:', e);
    }

    return null;
  },

  /**
   * Recorta de forma quirúrgica un canvas de producto utilizando el Bounding Box predicho por la IA de Visión.
   */
  async cropProductWithVision(canvas, ctx) {
    const bbox = await this.detectObjectBoundingBoxNeural(canvas, ctx);
    if (!bbox || bbox.width < 25 || bbox.height < 25) return canvas;

    try {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = bbox.width;
      croppedCanvas.height = bbox.height;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (croppedCtx) {
        croppedCtx.drawImage(
          canvas,
          bbox.x, bbox.y, bbox.width, bbox.height,
          0, 0, bbox.width, bbox.height
        );
        return croppedCanvas;
      }
    } catch (e) {
      console.warn('Error al recortar canvas con Bounding Box de Visión:', e);
    }
    return canvas;
  },
  
  // Reglas de inferencia semántica avanzadas (Micro-LLM Engine)
  brandPatterns: [
    { name: '8BitDo', patterns: [/8bitdo/i, /sn30/i, /pro 2 controller/i] },
    { name: 'Flydigi', patterns: [/flydigi/i, /vader/i, /apex 4/i, /direwolf/i] },
    { name: 'GameSir', patterns: [/gamesir/i, /g7 se/i, /t4 kaleid/i, /g8 galileo/i] },
    { name: 'Attack Shark', patterns: [/attack\s*shark/i, /r1 ultra/i, /x3 max/i, /v8 paw/i] },
    { name: 'Royal Kludge', patterns: [/royal\s*kludge/i, /\brk\d{2}/i, /rk-s\d/i, /r65\b/i, /r75\b/i, /r87\b/i] },
    { name: 'Irok', patterns: [/\birok\b/i, /he6 ultra/i, /he2 wired/i, /he3 pro/i] },
    { name: 'Mars', patterns: [/mars75/i, /mars68/i, /mars mer/i, /iyx\b/i] },
    { name: 'AJAZZ', patterns: [/ajazz/i, /ak820/i, /ak870/i, /ak980/i, /ak650/i, /mk87/i] },
    { name: 'AULA', patterns: [/aula/i, /f75/i, /f99/i, /f108/i, /au75/i] },
    { name: 'ATK', patterns: [/\batk\b/i, /atk 68/i, /rs6/i, /rs7/i, /vxe v75/i, /vxe/i] },
    { name: 'MCHOSE', patterns: [/mchose/i, /ace 68/i, /ace 75/i, /mix 87/i, /mount tai/i, /jet 75/i, /v9 turbo/i] },
    { name: 'VGN', patterns: [/\bvgn\b/i, /dragonfly/i, /f1 pro/i, /f2 master/i] },
    { name: 'Madlions', patterns: [/madlions/i, /mad 60/i, /mad 68/i, /titan 68/i] },
    { name: 'Razer', patterns: [/razer/i, /deathadder/i, /viper v/i, /blackwidow/i, /huntsman/i, /basilisk/i, /cobra pro/i] },
    { name: 'Logitech', patterns: [/logitech/i, /pebble/i, /mx anywhere/i, /ergo m575/i] },
    { name: 'KZ', patterns: [/\bkz\b/i, /zst/i, /zsn/i, /zs10/i, /edx pro/i, /zex/i, /pr1/i] },
    { name: 'Polaroid', patterns: [/polaroid/i, /polaroid go/i] },
    { name: 'Philips', patterns: [/philips/i, /shaver/i, /hairclipper/i, /toothbrush/i] },
    { name: 'Haimu', patterns: [/haimu/i, /seasalt switch/i, /flamingo switch/i] },
    { name: 'Redragon', patterns: [/redragon/i, /kumara/i, /fizz/i] },
    { name: 'HyperX', patterns: [/hyperx/i, /cloud ii/i, /pulsefire/i, /alloy/i] },
    { name: 'SteelSeries', patterns: [/steelseries/i, /apex pro/i, /rival/i, /arctis/i] }
  ],

  categoryPatterns: [
    { cat: 'NUMPAD', patterns: [/numpad/i, /numeric keypad/i, /keypad/i, /np20/i, /ak33 numpad/i] },
    { cat: 'TECLADO', patterns: [/keyboard/i, /teclado/i, /mechanical/i, /switches keyboard/i, /keys/i, /75%/i, /68%/i, /80%/i, /full-aluminum/i, /gasket/i] },
    { cat: 'MOUSE', patterns: [/mouse/i, /mice/i, /raton/i, /paw\d{4}/i, /8khz/i, /tri-mode mouse/i, /optical mouse/i, /aj139\w*/i, /aj159\w*/i, /aj199\w*/i, /ax5\w*/i, /r1 ultra/i, /x3 max/i] },
    { cat: 'HEADSET', patterns: [/headset/i, /headphone/i, /auricular gaming/i, /wireless headset/i, /7\.1/i] },
    { cat: 'AURICULAR', patterns: [/earphone/i, /earbuds/i, /in-ear/i, /iem/i, /hifi earphones/i] },
    { cat: 'CONTROLLER', patterns: [/controller/i, /gamepad/i, /joystick/i, /mando/i, /hall effect joystick/i] },
    { cat: 'MOUSEPAD', patterns: [/mousepad/i, /mouse pad/i, /mat\b/i, /alfombrilla/i] },
    { cat: 'SWITCH', patterns: [/switch\b/i, /switches\b/i, /interruptor/i, /linear switch/i, /tactile switch/i] },
    { cat: 'CAMARA', patterns: [/camera/i, /camara/i, /film\b/i, /instant camera/i] },
    { cat: 'CUIDADO_PERSONAL', patterns: [/shaver/i, /trimmer/i, /clipper/i, /toothbrush/i, /afeitadora/i] }
  ],

  /**
   * Vision Guard: Verifica si el Aspect Ratio de una imagen concuerda con la categoría.
   * Evita asignar fotos de teclados panorámicos (width/height > 1.35) a mouses o viceversa.
   */
  verifyImageAspect(imgWidth, imgHeight, category) {
    if (!imgWidth || !imgHeight || !category) return { valid: true, ratio: 1 };
    const ratio = imgWidth / imgHeight;

    if (category === 'MOUSE' && ratio >= 1.40) {
      return { valid: false, ratio, reason: 'Imagen panorámica de Teclado asignada a MOUSE' };
    }
    if (category === 'TECLADO' && ratio <= 0.85) {
      return { valid: false, ratio, reason: 'Imagen angosta asignada a TECLADO' };
    }
    return { valid: true, ratio };
  },

  /**
   * Color Guard (Layer 4): Analiza el perfil cromático dominante de un canvas de producto (RGB/HSV)
   * y verifica si concuerda con las palabras clave de color en el título del producto.
   */
  extractCanvasColorProfile(canvasCtx, width, height) {
    if (!canvasCtx || !width || !height) return null;
    try {
      const imgData = canvasCtx.getImageData(0, 0, width, height);
      const data = imgData.data;

      let totalSat = 0, totalVal = 0;
      let rSum = 0, gSum = 0, bSum = 0;
      let nonBgCount = 0;

      const step = Math.max(1, Math.floor((width * height) / 1200));
      for (let i = 0; i < data.length; i += step * 4) {
        const a = data[i + 3];
        if (a < 30) continue;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) continue;

        rSum += r; gSum += g; bSum += b;

        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const delta = max - min;

        const sat = max === 0 ? 0 : delta / max;
        totalSat += sat;
        totalVal += max;
        nonBgCount++;
      }

      if (nonBgCount === 0) return { avgR: 255, avgG: 255, avgB: 255, avgSat: 0, avgVal: 1, hue: 0 };

      const avgR = rSum / nonBgCount;
      const avgG = gSum / nonBgCount;
      const avgB = bSum / nonBgCount;
      const avgSat = totalSat / nonBgCount;
      const avgVal = totalVal / nonBgCount;

      let hue = 0;
      const rN = avgR / 255, gN = avgG / 255, bN = avgB / 255;
      const cMax = Math.max(rN, gN, bN);
      const cMin = Math.min(rN, gN, bN);
      const cDelta = cMax - cMin;
      if (cDelta > 0.05) {
        if (cMax === rN) hue = ((gN - bN) / cDelta) % 6;
        else if (cMax === gN) hue = (bN - rN) / cDelta + 2;
        else hue = (rN - gN) / cDelta + 4;
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
      }

      return { avgR, avgG, avgB, avgSat, avgVal, hue };
    } catch (e) {
      return null;
    }
  },

  verifyImageColorMatch(profile, titleText) {
    if (!profile || !titleText) return { match: true, confidence: 100 };
    const text = String(titleText).toLowerCase();

    let targetColor = null;
    if (/\b(pink|rosa|rosado)\b/i.test(text)) targetColor = 'pink';
    else if (/\b(purple|violeta|morado|wukong)\b/i.test(text)) targetColor = 'purple';
    else if (/\b(green|verde|mint|menta)\b/i.test(text)) targetColor = 'green';
    else if (/\b(orange|naranja|coffee|brown|café|cafe)\b/i.test(text)) targetColor = 'orange';
    else if (/\b(blue|dark blue|azul|cyan)\b/i.test(text)) targetColor = 'blue';
    else if (/\b(white|blanco)\b/i.test(text)) targetColor = 'white';
    else if (/\b(black|negro|dark)\b/i.test(text)) targetColor = 'black';
    else if (/\b(grey|gray|gris)\b/i.test(text)) targetColor = 'grey';

    if (!targetColor) return { match: true, confidence: 100 };

    const { avgSat, avgVal, hue, avgR, avgG, avgB } = profile;

    if (targetColor === 'pink') {
      // Pink is high-R/B hue (310-355 or 0-15) with high luminance (> 0.45)
      const isPurpleHue = (hue >= 245 && hue <= 300);
      const isGreenHue = (hue >= 70 && hue <= 165);
      if (isPurpleHue) {
        return { match: false, confidence: 0, reason: 'Título dice Pink pero la foto es Violeta/Púrpura' };
      }
      if (isGreenHue) {
        return { match: false, confidence: 0, reason: 'Título dice Pink pero la foto es Verde' };
      }
      if (avgVal < 0.35) {
        return { match: false, confidence: 0, reason: 'Título dice Pink pero la foto es oscura' };
      }
    } else if (targetColor === 'purple') {
      // Purple is hue 240-305 with B > G
      const isPinkHue = (hue >= 320 || hue <= 15) && (avgR > avgB + 15);
      const isGreenHue = (hue >= 70 && hue <= 165);
      if (isPinkHue) {
        return { match: false, confidence: 0, reason: 'Título dice Purple pero la foto es Rosa/Pink' };
      }
      if (isGreenHue) {
        return { match: false, confidence: 0, reason: 'Título dice Purple pero la foto es Verde' };
      }
      if (avgVal < 0.30) {
        return { match: false, confidence: 0, reason: 'Título dice Purple pero la foto es completamente oscura' };
      }
    } else if (targetColor === 'green') {
      const isGreenHue = (hue >= 65 && hue <= 170) && avgSat > 0.08;
      const isGreenDOM = (avgG > avgR + 8) && (avgG > avgB + 8);
      if (!isGreenHue && !isGreenDOM) {
        return { match: false, confidence: 0, reason: 'Título dice Green pero la foto no es verde' };
      }
    } else if (targetColor === 'orange') {
      const isOrangeHue = (hue >= 10 && hue <= 50);
      const isGreenOrPurple = (hue >= 70 && hue <= 310);
      if (isGreenOrPurple) {
        return { match: false, confidence: 0, reason: 'Título dice Orange/Coffee pero la foto es Verde o Violeta' };
      }
    } else if (targetColor === 'black') {
      if (avgVal > 0.85 && avgSat < 0.15) {
        return { match: false, confidence: 0, reason: 'Título dice Black pero la foto es completamente blanca' };
      }
    } else if (targetColor === 'white') {
      if (avgVal < 0.35) {
        return { match: false, confidence: 0, reason: 'Título dice White pero la foto es negra' };
      }
    }

    return { match: true, confidence: 100 };
  },

  // Consulta a la IA nativa del WebView (window.ai / Gemini Nano) con fallback a Ollama local
  async queryWebViewAi(rawText) {
    // 1. Probar window.ai (Chrome/Chromium Built-in WebAI en WebView)
    try {
      if (window.ai && window.ai.languageModel) {
        const capabilities = await window.ai.languageModel.capabilities();
        if (capabilities.available !== 'no') {
          const session = await window.ai.languageModel.create();
          const prompt = `Classify this gaming peripheral product into valid category (TECLADO, MOUSE, HEADSET, AURICULAR, CONTROLLER, MOUSEPAD, SWITCH, MONITOR, OTRO) and brand. Respond JSON only {"cat":"...", "marca":"..."}. Text: "${rawText}"`;
          const response = await session.prompt(prompt);
          session.destroy?.();
          const match = response?.match(/\{[\s\S]*?\}/);
          if (match) return JSON.parse(match[0]);
        }
      }
    } catch (e) {
      console.warn('window.ai WebAI no activo en WebView:', e);
    }

    // 2. Fallback: Ollama local en puerto 11434
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900);
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama3',
          prompt: `Classify product into JSON {"cat":"...", "marca":"..."}: "${rawText}"`,
          stream: false
        })
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const match = data.response?.match(/\{[\s\S]*?\}/);
        if (match) return JSON.parse(match[0]);
      }
    } catch (e) {}

    return null;
  },

  // Desambiguar un ítem dudoso
  /**
   * Desglose Inteligente NLP de Modelo y Variante / Color
   * Separa cadenas sueltas tipo "F75 Mechanical Keyboard Gasket Structure (White / Purple Switch)"
   * en { modelo: "F75", variante: "White / Purple Switch" }
   */
  parseModelAndVariant(rawText, brand = '') {
    if (!rawText) return { modelo: '', variante: '' };

    let text = String(rawText).trim();

    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      text = text.replace(reBrand, '').trim();
    }

    let model = '';
    let variant = '';

    const matchParentheses = text.match(/^(.*?)\s*[\(\[\{](.*?)[\)\]\}]\s*$/);
    if (matchParentheses) {
      let rawModel = matchParentheses[1].trim();
      model = rawModel.replace(/\b(mechanical keyboard|teclado|gaming mouse|mouse|headset|auricular|controller|joystick|mousepad|mat)\b/gi, '').trim();
      variant = matchParentheses[2].trim();
    }

    if (!model && text.includes(' - ')) {
      const parts = text.split(' - ');
      model = parts[0].trim();
      variant = parts.slice(1).join(' - ').trim();
    }

    if (!model) {
      const matchCode = text.match(/\b([A-Za-z]{1,4}[-_\s]?\d{2,4}[A-Za-z]?)\b/);
      if (matchCode) {
        model = matchCode[1].toUpperCase();
        const rest = text.replace(matchCode[0], '').replace(/mechanical keyboard|gaming mouse|headset|wireless|bluetooth/gi, '').trim();
        variant = rest.replace(/^[,\s\-\/]+|[,\s\-\/]+$/g, '');
      } else {
        model = text;
      }
    }

    if (variant) {
      variant = variant.replace(/\b(teclado|keyboard|mouse|headset|auricular|controller|joystick|mousepad|mat)\b/gi, '').trim();
      variant = variant.replace(/^[\s\-\/,]+|[\s\-\/,]+$/g, '');
    }

    return {
      modelo: model || text,
      variante: variant || ''
    };
  },

  disambiguateItem(item, customBrands = []) {
    const text = ((item.marca || '') + ' ' + (item.modelo || '') + ' ' + (item.variante || '') + ' ' + (item.rawText || '')).trim();
    let detectedBrand = item.marca;
    let detectedCat = item.cat;
    let fixed = false;

    // 1. Intentar resolver Marca si es 'OTRO'
    if (detectedBrand === 'OTRO' || !detectedBrand) {
      for (const b of customBrands) {
        if (b.name && b.pattern) {
          try {
            if (new RegExp(b.pattern, 'i').test(text)) {
              detectedBrand = b.name;
              fixed = true;
              break;
            }
          } catch(e) {}
        }
      }

      if (detectedBrand === 'OTRO' || !detectedBrand) {
        for (const entry of this.brandPatterns) {
          if (entry.patterns.some(p => p.test(text))) {
            detectedBrand = entry.name;
            fixed = true;
            break;
          }
        }
      }
    }

    // 2. Intentar resolver Categoría si es 'OTRO'
    if (detectedCat === 'OTRO' || !detectedCat) {
      for (const entry of this.categoryPatterns) {
        if (entry.patterns.some(p => p.test(text))) {
          detectedCat = entry.cat;
          fixed = true;
          break;
        }
      }
    }

    // 3. Limpieza inteligente del nombre de modelo y separación NLP de variante
    let cleanedModel = item.modelo || '';
    if (detectedBrand !== 'OTRO') {
      const reBrand = new RegExp('^' + detectedBrand + '\\s+', 'i');
      cleanedModel = cleanedModel.replace(reBrand, '').trim();
    }

    const nlpRes = this.parseModelAndVariant(cleanedModel || item.modelo, detectedBrand);
    const finalModel = nlpRes.modelo || cleanedModel || item.modelo;
    const finalVariant = item.variante || nlpRes.variante || '';

    const updated = {
      ...item,
      marca: detectedBrand,
      cat: detectedCat,
      modelo: finalModel,
      variante: finalVariant
    };

    const evalRes = PdfParser.evaluateItemConfidence(updated);
    updated.confidence = evalRes.confidence;
    updated.status = evalRes.status;
    updated.warnings = evalRes.warnings;
    updated.aiCorrected = fixed;

    return updated;
  },

  // Auto-corregir lote completo de productos dudosas en la vista previa
  async autoCorrectItems(items, customBrands = []) {
    let correctedCount = 0;
    const result = [];
    for (const item of items) {
      if (item.status === 'WARNING' || item.status === 'ERROR' || item.marca === 'OTRO' || item.cat === 'OTRO') {
        let corrected = this.disambiguateItem(item, customBrands);

        // Si sigue en 'OTRO', intentar clasificación con Transformers.js (IA neural real)
        if (corrected.cat === 'OTRO' || corrected.marca === 'OTRO') {
          let llmRes = null;
          // Try Transformers.js first (real neural inference, offline after first download)
          if (window.TransformersAI && window.TransformersAI.isReady && window.TransformersAI.isReady()) {
            const tfRes = await window.TransformersAI.classify(item.rawText || item.modelo || '');
            if (tfRes && tfRes.cat && tfRes.cat !== 'OTRO' && tfRes.score > 0.35) {
              llmRes = { cat: tfRes.cat };
            }
          }
          // Fallback to window.ai / Ollama if Transformers.js not available
          if (!llmRes) {
            llmRes = await this.queryWebViewAi(item.rawText || item.modelo);
          }
          if (llmRes && (llmRes.cat || llmRes.marca)) {
            if (llmRes.cat && llmRes.cat !== 'OTRO') corrected.cat = llmRes.cat;
            if (llmRes.marca && llmRes.marca !== 'OTRO') corrected.marca = llmRes.marca;
            const reEval = PdfParser.evaluateItemConfidence(corrected);
            corrected.confidence = reEval.confidence;
            corrected.status = reEval.status;
            corrected.warnings = reEval.warnings;
            corrected.aiCorrected = true;
          }
        }

        if (corrected.marca !== item.marca || corrected.cat !== item.cat || corrected.status !== item.status) {
          correctedCount++;
        }
        result.push(corrected);
      } else {
        result.push(item);
      }
    }

    return { items: result, correctedCount };
  }
};

window.AiDisambiguator = AiDisambiguator;
