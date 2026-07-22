// ============================================
//  Mambo Pedidos - Capa de Inteligencia Artificial & Desambiguador Local
//  Clasifica y corrige marcas/categorías en filas dudosas (🟡/🔴)
//  Desarrollado por @geto_dev
// ============================================

const AiDisambiguator = {
  
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
    { cat: 'TECLADO', patterns: [/keyboard/i, /teclado/i, /mechanical/i, /switches keyboard/i, /keys/i, /75%/i, /68%/i, /80%/i, /full-aluminum/i, /gasket/i] },
    { cat: 'MOUSE', patterns: [/mouse/i, /mice/i, /raton/i, /paw\d{4}/i, /8khz/i, /tri-mode mouse/i, /optical mouse/i] },
    { cat: 'HEADSET', patterns: [/headset/i, /headphone/i, /auricular gaming/i, /wireless headset/i, /7\.1/i] },
    { cat: 'AURICULAR', patterns: [/earphone/i, /earbuds/i, /in-ear/i, /iem/i, /hifi earphones/i] },
    { cat: 'CONTROLLER', patterns: [/controller/i, /gamepad/i, /joystick/i, /mando/i, /hall effect joystick/i] },
    { cat: 'MOUSEPAD', patterns: [/mousepad/i, /mouse pad/i, /mat\b/i, /alfombrilla/i] },
    { cat: 'SWITCH', patterns: [/switch\b/i, /switches\b/i, /interruptor/i, /linear switch/i, /tactile switch/i] },
    { cat: 'CAMARA', patterns: [/camera/i, /camara/i, /film\b/i, /instant camera/i] },
    { cat: 'CUIDADO_PERSONAL', patterns: [/shaver/i, /trimmer/i, /clipper/i, /toothbrush/i, /afeitadora/i] }
  ],

  // Desambiguar un ítem dudoso
  disambiguateItem(item, customBrands = []) {
    const text = ((item.marca || '') + ' ' + (item.modelo || '') + ' ' + (item.variante || '') + ' ' + (item.rawText || '')).trim();
    let detectedBrand = item.marca;
    let detectedCat = item.cat;
    let fixed = false;

    // 1. Intentar resolver Marca si es 'OTRO'
    if (detectedBrand === 'OTRO' || !detectedBrand) {
      // Probar diccionario personalizado
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

      // Probar patrones nativos de IA
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

    // 3. Limpieza inteligente del nombre de modelo
    let cleanedModel = item.modelo || '';
    if (detectedBrand !== 'OTRO') {
      // Eliminar redundancias de la marca en el nombre del modelo
      const reBrand = new RegExp('^' + detectedBrand + '\\s+', 'i');
      cleanedModel = cleanedModel.replace(reBrand, '').trim();
    }

    // Construir ítem corregido
    const updated = {
      ...item,
      marca: detectedBrand,
      cat: detectedCat,
      modelo: cleanedModel || item.modelo
    };

    // Reevaluar puntuación de confianza
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
    const result = items.map(item => {
      if (item.status === 'WARNING' || item.status === 'ERROR' || item.marca === 'OTRO' || item.cat === 'OTRO') {
        const corrected = this.disambiguateItem(item, customBrands);
        if (corrected.marca !== item.marca || corrected.cat !== item.cat || corrected.status !== item.status) {
          correctedCount++;
        }
        return corrected;
      }
      return item;
    });

    return { items: result, correctedCount };
  }
};

window.AiDisambiguator = AiDisambiguator;
