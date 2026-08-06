/**
 * Mambo Pedidos - Motor Único de Ingesta por IA Local Nativa (AiCatalogEngine)
 *
 * Arquitectura de 3 Capas Anti-Alucinaciones:
 *   1. Chunking Aislado por Página (Sin desbordar ventana de contexto)
 *   2. Extracción Guiada por Gramática JSON (Qwen2.5 / Llama 3.2 GGUF)
 *   3. Puerta de Verificación / Fact-Checking Literal (Grounding Gate 0% Alucinación de precios)
 */

const AiCatalogEngine = {
  /**
   * Punto de entrada único para ingestar catálogos (PDF, Excel, CSV) exclusivamente mediante IA Local.
   *
   * @param {File} file - Archivo fuente
   * @param {Array} customBrands - Marcas conocidas
   * @param {Function} onProgress - Callback de progreso (paginaActual, totalPaginas)
   */
  async processCatalogFile(file, customBrands = [], onProgress = null) {
    if (!file) throw new Error('Archivo no provisto para ingesta por IA');

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return this.processPdfWithLocalAI(file, customBrands, onProgress);
    } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      return this.processSpreadsheetWithLocalAI(file, customBrands, onProgress);
    } else {
      throw new Error(`Formato .${ext} no soportado por el motor de IA`);
    }
  },

  /**
   * CAPA 1: Chunking por Página para PDFs (Sin Desbordar Contexto)
   */
  async processPdfWithLocalAI(file, customBrands = [], onProgress = null) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    let detectedBrand = 'OTRO';

    // Fase 1: lectura de páginas (rápida, sin IA) — separada del batch para
    // poder detectar la marca antes de disparar las consultas al modelo.
    const pagesText = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (typeof onProgress === 'function') {
        try { onProgress(pageNum, totalPages); } catch {}
      }

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageRawText = textContent.items.map(item => item.str).join(' ');

      if (pageNum <= 3 && detectedBrand === 'OTRO') {
        detectedBrand = this.extractBrandFromRawText(pageRawText, customBrands) || 'OTRO';
      }
      pagesText.push(pageRawText);
    }

    // Fase 2 (loop de calidad 05/08): extracción IA en BATCH con concurrencia
    // limitada (antes secuencial: 1 round-trip por página = N×latencia).
    const results = await this._runPool(pagesText, async (pageRawText, i) => {
      const pageNum = i + 1;
      const extractedItems = await this.extractPageChunkWithAI(pageRawText, pageNum, customBrands);
      // CAPA 3: Puerta de Fact-Checking & Grounding
      return this.groundAndVerifyExtractedItems(extractedItems, pageRawText, pageNum);
    }, 3, onProgress);

    const allProducts = [];
    for (const items of results) {
      if (Array.isArray(items)) allProducts.push(...items);
    }

    return {
      brand: detectedBrand !== 'OTRO' ? detectedBrand : this.extractBrandFromFilename(file.name, customBrands),
      products: allProducts
    };
  },

  /**
   * Pool de ejecución con concurrencia limitada (batch para el motor local).
   * Preserva el orden de entrada, aísla fallos por ítem (null en la posición
   * fallida) y reporta progreso por ítem completado. Concurrencia 3 por
   * defecto: un modelo local (Ollama/LM Studio) degrada con más llamadas
   * concurrentes (VRAM/memoria del prompt).
   */
  async _runPool(items, worker, concurrency = 3, onProgress = null) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = new Array(items.length);
    let next = 0;
    let done = 0;

    const runWorker = async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = await worker(items[i], i);
        } catch (e) {
          results[i] = null;
          console.warn(`[AiCatalogEngine._runPool] ítem ${i} falló:`, e && e.message ? e.message : e);
        }
        done++;
        if (typeof onProgress === 'function') {
          try { onProgress(done, items.length); } catch {}
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, runWorker);
    await Promise.all(workers);
    return results;
  },

  /**
   * CAPA 1: Chunking de planillas Excel/CSV enviando bloques a la IA Local
   */
  async processSpreadsheetWithLocalAI(file, customBrands = [], onProgress = null) {
    let rawText;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      rawText = await file.text();
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rawText = XLSX.utils.sheet_to_csv(ws);
    }

    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    const chunkSize = 25; // 25 filas por prompt para mantener el contexto ultra compacto

    const allProducts = [];
    const brand = this.extractBrandFromFilename(file.name, customBrands);

    const chunks = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize).join('\n'));
    }

    // Batch con concurrencia limitada (antes secuencial chunk por chunk)
    const results = await this._runPool(chunks, async (chunkText, i) => {
      const chunkNum = i + 1;
      const extractedItems = await this.extractPageChunkWithAI(chunkText, chunkNum, customBrands);
      return this.groundAndVerifyExtractedItems(extractedItems, chunkText, chunkNum);
    }, 3, onProgress);

    for (const verifiedItems of results) {
      if (Array.isArray(verifiedItems)) allProducts.push(...verifiedItems);
    }

    return { brand, products: allProducts };
  },

  /**
   * CAPA 2: Consulta de Extracción Guiada al Modelo Local
   */
  async extractPageChunkWithAI(chunkText, chunkIndex, customBrands = []) {
    if (!chunkText || chunkText.trim().length < 5) return [];

    const prompt = `Eres un extractor de datos de catálogos de periféricos gamer. Extrae TODOS los productos del fragmento.
Responde únicamente en este formato JSON exacto:
{
  "items": [
    { "sku": "...", "marca": "...", "modelo": "...", "variante": "...", "cat": "...", "fob": 0.0 }
  ]
}

REGLAS ESTRICTAS DE SEPARACIÓN DE CAMPOS:
- "marca": SOLO el nombre de la marca (ej: "Redragon", "Logitech"). NUNCA incluyas modelo ni color.
- "modelo": SOLO el código/nombre del producto SIN marca, SIN color. Ej: "M652", "G502 HERO", "AK820 Pro". Máximo 4-5 palabras.
- "variante": Color + conexión + specs. Ej: "Black Wireless", "Pink Wired". Los colores SIEMPRE van aquí.
- "cat": UNA de: TECLADO, MOUSE, HEADSET, AURICULAR, CONTROLLER, MOUSEPAD, SWITCH, CAMARA, CUIDADO_PERSONAL, NUMPAD, ACCESORIO.
- "fob": Precio USD como número. Sin símbolo $.

ERRORES A EVITAR: color en modelo, marca en modelo, precio en modelo/variante, descripciones largas en modelo.

Categorías permitidas: TECLADO, MOUSE, HEADSET, AURICULAR, CONTROLLER, MOUSEPAD, SWITCH, CAMARA, CUIDADO_PERSONAL, NUMPAD, ACCESORIO.

Fragmento del documento (Página/Bloque ${chunkIndex}):
"""
${chunkText}
"""`;

    try {
      if (typeof LocalLlm !== 'undefined') {
        const response = await LocalLlm.queryStructuredJson(prompt);
        if (response && Array.isArray(response.items)) {
          return response.items;
        }
      }
    } catch (e) {
      console.warn(`Extracción por IA local en chunk ${chunkIndex} derivó a procesador determinístico fallback:`, e);
    }

    // Fallback determinístico directo si el servidor local no está disponible
    const fallbackItems = this.fallbackDeterministicChunkParser(chunkText, customBrands);
    // Tag items so the UI can show a "basic parser" badge
    for (const item of fallbackItems) {
      item.sourceEngine = 'deterministic';
      item.engineWarning = 'IA local no disponible — extraído con parser básico. Calidad reducida.';
    }
    return fallbackItems;
  },

  /**
   * CAPA 3: Puerta de Fact-Checking & Grounding Literal (0% Alucinación)
   * Verifica que cada precio FOB y modelo extraído por la IA existan literalmente en el texto crudo del documento.
   */
  groundAndVerifyExtractedItems(items = [], rawText = '', chunkIndex = 1) {
    if (!Array.isArray(items)) return [];

    const cleanRaw = rawText.replace(/\s+/g, ' ');

    return items.map((item, idx) => {
      const fob = parseFloat(item.fob) || 0;
      const modelo = (item.modelo || '').trim();
      const warnings = [];

      // 1. Verificación Literal de FOB (Grounding Rule)
      let isGroundedFob = false;
      if (fob > 0) {
        const fobStr = fob.toString();
        const fobFormatted = fob.toFixed(2);
        const fobComa = fobFormatted.replace('.', ',');
        const fobInt = Math.round(fob).toString();

        if (cleanRaw.includes(fobStr) || cleanRaw.includes(fobFormatted) || cleanRaw.includes(fobComa)) {
          isGroundedFob = true;
        } else if (fob === Math.round(fob) && cleanRaw.includes(fobInt)) {
          // Integer match: FOB 45.00 matches "45" in text
          isGroundedFob = true;
        } else {
          // Regex fallback: match $XX.XX or $XX,XX with optional whitespace
          const escaped = fobFormatted.replace('.', '\\.');
          const priceRe = new RegExp('\\$\\s*' + escaped + '|\\$\\s*' + fobComa.replace(',', '\\,'), 'i');
          if (priceRe.test(cleanRaw)) {
            isGroundedFob = true;
          } else {
            warnings.push(`⚠️ Precio FOB $${fob} USD no encontrado literalmente en el texto crudo del documento (Posible alucinación ajustada)`);
          }
        }
      }

      // 2. Verificación Literal de Modelo
      let isGroundedModel = true;
      if (modelo && modelo.length > 2) {
        const firstWord = modelo.split(' ')[0];
        if (!cleanRaw.toLowerCase().includes(firstWord.toLowerCase())) {
          isGroundedModel = false;
          warnings.push(`⚠️ Nombre de modelo "${modelo}" no coincide con el fragmento original`);
        }
      }

      const status = (fob > 0 && modelo.length > 0 && warnings.length === 0) ? 'VALID' : (fob > 0 ? 'WARNING' : 'INVALID');
      const confidence = (isGroundedFob ? 50 : 20) + (isGroundedModel ? 50 : 20);

      return {
        sku: item.sku || `AI-${chunkIndex}-${idx + 1}`,
        marca: item.marca || 'OTRO',
        modelo: modelo || 'Producto',
        variante: item.variante || '',
        cat: (item.cat || 'OTRO').toUpperCase(),
        fob,
        img: item.img || '-',
        confidence: Math.min(100, confidence),
        sourceConfidence: Math.min(100, confidence),
        sourceStatus: status,
        sourceWarnings: [...warnings],
        status,
        warnings,
        isGroundedFob,
        groundedFob: isGroundedFob,
        grounded: isGroundedFob,
        groundingReason: isGroundedFob
          ? 'FOB encontrado literalmente en el texto del bloque'
          : 'FOB no encontrado literalmente en el texto del bloque'
      };
    });
  },

  /**
   * Parser determinístico fallback para cuando el motor LLM local no está activo
   */
  fallbackDeterministicChunkParser(chunkText, customBrands = []) {
    const lines = chunkText.split('\n');
    const items = [];

    for (const line of lines) {
      const priceMatch = line.match(/\b\$?\s*(\d+[.,]\d{1,2})\b/);
      if (!priceMatch) continue;

      const fob = parseFloat(priceMatch[1].replace(',', '.'));
      if (fob <= 0) continue;

      const cleanLine = line.replace(priceMatch[0], '').replace(/\s+/g, ' ').trim();
      if (cleanLine.length < 3) continue;

      // Skip header/section rows: títulos de sección bilingües (chino+inglés)
      // y filas de cabecera de tabla (ej. "型号 Model Name LS01" en catálogos
      // KZ, "升级线及配件 Upgrade Cables and"). El precio de la fila header es
      // el del primer producto de la sección, no un producto real.
      const HEADER_LINE_RE = /^(型号|规格|参数|名称|图片|颜色|价格|升级|配件|附件|产品|特性|说明)/;
      if (HEADER_LINE_RE.test(cleanLine) || /model\s*name/i.test(cleanLine)) continue;
      // Cabecera de columna "Product Picture Model No.#" (catálogos AULA).
      if (/product\s*picture\s*model/i.test(cleanLine)) continue;
      // Título de sección bilingüe: 2-6 ideogramas seguidos de texto latino.
      if (/^[\u4e00-\u9fff]{2,6}\s+[A-Za-z]/.test(cleanLine)) continue;

      const marca = this.extractBrandFromRawText(cleanLine, customBrands) || 'OTRO';

      // Use TextSanitizer for proper model/variant separation instead of substring(0,50)
      let modelo;
      let variante = '';
      if (typeof TextSanitizer !== 'undefined') {
        // Remove brand prefix before parsing
        let textForParse = cleanLine;
        if (marca !== 'OTRO') {
          textForParse = cleanLine.replace(new RegExp('^' + marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
        }
        const parsed = TextSanitizer.parseModelAndVariant(textForParse, marca);
        modelo = parsed.modelo;
        variante = parsed.variante;

        // Run cross-audit to fix contamination
        if (typeof TextSanitizer.crossAuditFields === 'function') {
          const audited = TextSanitizer.crossAuditFields(modelo, variante, marca, '');
          modelo = audited.modelo;
          variante = audited.variante;
        }
      } else {
        modelo = cleanLine.substring(0, 50);
      }

      const cat = (typeof TextSanitizer !== 'undefined') ? TextSanitizer.detectCategoryFromText(modelo + ' ' + variante) : 'OTRO';

      items.push({
        sku: '',
        marca,
        modelo: modelo || (marca !== 'OTRO' ? marca + ' Item' : 'Producto'),
        variante,
        cat,
        fob
      });
    }

    return items;
  },

  extractBrandFromRawText(text = '', customBrands = []) {
    const known = ['REDRAGON', 'LOGITECH', 'RAZER', 'VSG', 'HYPERX', 'CORSAIR', 'AULA', 'AJAZZ', 'MACHENIKE', '8BITDO', ...customBrands];
    const upper = text.toUpperCase();
    return known.find(b => upper.includes(b)) || null;
  },

  extractBrandFromFilename(filename = '', customBrands = []) {
    const known = ['REDRAGON', 'LOGITECH', 'RAZER', 'VSG', 'HYPERX', 'CORSAIR', 'AULA', 'AJAZZ', 'MACHENIKE', '8BITDO', ...customBrands];
    const upper = filename.toUpperCase();
    return known.find(b => upper.includes(b)) || 'OTRO';
  }
};

if (typeof window !== 'undefined') window.AiCatalogEngine = AiCatalogEngine;
if (typeof module !== 'undefined') module.exports = AiCatalogEngine;
