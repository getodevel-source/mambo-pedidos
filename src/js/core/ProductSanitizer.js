/**
 * Mambo Pedidos - Sanitizador Especializado de Productos
 * Maneja la limpieza, validación y enriquecimiento de productos extraídos
 */

const ProductSanitizer = {

  COLOR_WORDS_PATTERN: /^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-\.]*$/i,
  
  CORPORATE_NOISE: /\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi,
  
  HEADER_KEYWORDS: /\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi,

  /**
   * Sanitiza nombres de producto eliminando ruido y extrayendo variante
   */
  sanitizeProductNames(rawModelo, rawVariante, brand, existingProducts = []) {
    let modelo = (rawModelo || '').trim();
    let variante = (rawVariante || '').trim();

    // 1. Limpieza de razones sociales corporativas
    modelo = modelo.replace(this.CORPORATE_NOISE, '').trim();

    // 2. Remover marca del inicio si está presente
    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      modelo = modelo.replace(reBrand, '').trim();
    }

    // 3. Eliminar keywords de encabezado
    modelo = modelo
      .replace(this.HEADER_KEYWORDS, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\-\s,:]+|[\-\s,:]+$/g, '')
      .trim();

    // 4. Si el modelo es puramente numérico, intentar recuperar de variante
    if (/^\$?\d+([,\.]\d+)?$/.test(modelo) || /^\d+$/.test(modelo)) {
      if (variante && !/^\$?\d+([,\.]\d+)?$/.test(variante)) {
        modelo = variante;
        variante = '';
      } else {
        const brandLabel = (brand && brand !== 'OTRO') ? brand : 'Producto';
        modelo = `${brandLabel} Item`;
      }
    }

    // 5. Limpiar variante
    variante = variante
      .replace(this.HEADER_KEYWORDS, '')
      .replace(/[\-\s]+$/g, '')
      .replace(/^[\-\s]+/g, '')
      .replace(/\bmode\b/i, '3-Mode')
      .replace(/\s+/g, ' ')
      .trim();

    // 6. Eliminar duplicados en variante
    const varWords = variante.split(/\s+/);
    const uniqueVarWords = [];
    for (const w of varWords) {
      if (!uniqueVarWords.map(x => x.toLowerCase()).includes(w.toLowerCase())) {
        uniqueVarWords.push(w);
      }
    }
    variante = uniqueVarWords.join(' ');

    // 7. Herencia de familia para modelos cortos (solo colores)
    if (modelo.length <= 18 && this.COLOR_WORDS_PATTERN.test(modelo.trim())) {
      const familyBase = existingProducts
        .filter(p => p.marca === brand)
        .slice(-3)
        .reverse()
        .find(p => p.modelo && p.modelo.length > 15 && !this.COLOR_WORDS_PATTERN.test(p.modelo.trim()));

      if (familyBase) {
        const baseCore = familyBase.modelo
          .replace(this.COLOR_WORDS_PATTERN, '')
          .replace(/\b(pink|green|purple|orange|coffee|white|black|grey|gray|blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (baseCore.length > 8) {
          variante = (modelo + (variante ? ' ' + variante : '')).trim();
          modelo = baseCore;
        }
      }
    }

    return { 
      modelo: modelo || (brand !== 'OTRO' ? `${brand} Item` : 'Producto'), 
      variante 
    };
  },

  /**
   * Limpia título de producto eliminando repeticiones y ruido
   */
  cleanProductTitle(rawText, brand = '') {
    if (!rawText) return { modelo: '', variante: '' };

    let text = String(rawText).replace(/\s+/g, ' ').trim();

    if (brand && brand !== 'OTRO') {
      const reBrand = new RegExp('^' + brand + '\\s+', 'i');
      text = text.replace(reBrand, '').trim();
    }

    // Desduplicar fragmentos repetidos
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

    // Usar TextSanitizer si está disponible
    if (typeof TextSanitizer !== 'undefined' && TextSanitizer.parseModelAndVariant) {
      return TextSanitizer.parseModelAndVariant(text, brand);
    }

    // Fallback: parseo básico
    const parts = text.split(/\s+-\s+|\s*\(\s*/);
    const modelo = parts[0] ? parts[0].trim().substring(0, 60) : text.substring(0, 60);
    const variante = parts.slice(1).join(' ').replace(/[\}\]\)]/g, '').trim().substring(0, 60);

    return { modelo, variante };
  },

  /**
   * Valida y evalúa confianza de un producto
   */
  evaluateProduct(item) {
    let confidence = 100;
    const warnings = [];

    if (!item.marca || item.marca === 'OTRO') {
      confidence -= 30;
      warnings.push('Marca no identificada automáticamente');
    }

    if (!item.cat || item.cat === 'OTRO') {
      confidence -= 20;
      warnings.push('Categoría no identificada');
    }

    if (!item.modelo || item.modelo.length < 3) {
      confidence -= 25;
      warnings.push('Nombre de modelo inusualmente corto');
    }

    if (item.fob < 0.50 || item.fob > 350.00) {
      confidence -= 15;
      warnings.push(`Precio FOB USD ($${item.fob.toFixed(2)}) fuera de rango habitual`);
    }

    let status = 'VALID';
    if (confidence < 60) status = 'ERROR';
    else if (confidence < 85) status = 'WARNING';

    return { 
      confidence: Math.max(0, confidence), 
      status, 
      warnings 
    };
  },

  /**
   * Verifica grounding de precio contra texto crudo
   */
  verifyPriceGrounding(fob, rawText) {
    if (!fob || fob <= 0) return false;
    
    const cleanRaw = rawText.replace(/\s+/g, ' ');
    const fobStr = fob.toString();
    const fobFormatted = fob.toFixed(2);
    const fobComa = fobFormatted.replace('.', ',');

    return cleanRaw.includes(fobStr) || 
           cleanRaw.includes(fobFormatted) || 
           cleanRaw.includes(fobComa);
  },

  /**
   * Procesa lote de productos aplicando sanitización y evaluación
   */
  processBatch(products, brand, customBrands = []) {
    const processed = [];
    const seen = new Set();

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const detectedBrand = p.marca !== 'OTRO' ? p.marca : (brand || 'OTRO');
      
      // Crear clave de deduplicación
      const key = `${detectedBrand}|${p.modelo.substring(0, 50)}|${p.variante.substring(0, 30)}|${p.fob}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Sanitizar
      const sanitized = this.sanitizeProductNames(p.modelo, p.variante, detectedBrand, processed);
      
      // Generar SKU
      const catCode = (p.cat || 'OTR').substring(0, 3).toUpperCase();
      const brandCode = detectedBrand.substring(0, 3).toUpperCase();
      const sku = `${brandCode}-${catCode}-${String(processed.length + 1).padStart(4, '0')}`;

      // Evaluar confianza
      const evaluation = this.evaluateProduct({
        ...p,
        modelo: sanitized.modelo,
        variante: sanitized.variante,
        marca: detectedBrand
      });

      processed.push({
        ...p,
        sku,
        marca: detectedBrand,
        modelo: sanitized.modelo,
        variante: sanitized.variante,
        confidence: evaluation.confidence,
        status: evaluation.status,
        warnings: evaluation.warnings
      });
    }

    return processed;
  }
};

if (typeof window !== 'undefined') window.ProductSanitizer = ProductSanitizer;
if (typeof module !== 'undefined') module.exports = ProductSanitizer;
