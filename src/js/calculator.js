// ============================================
//  Mambo Pedidos - Módulo de Cálculos de Costo, Logística y Rentabilidad (USD / ARS)
//  Matriz NCM Aduanera, Liquidación Puerta a Puerta Exacta, ENACOM & Seguridad Eléctrica
//  Desarrollado por @geto_dev
// ============================================

const Calculator = {
  parseNum(val, defaultVal) {
    if (val === null || val === undefined || val === '') return defaultVal;
    let str = String(val).trim();
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    if (hasComma && hasDot) {
      // Formato AR '1.234,56' → miles=punto, decimal=coma
      // Formato US '1,234.56' → miles=coma, decimal=punto
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (hasComma) {
      str = str.replace(',', '.');
    }
    const parsed = parseFloat(str);
    return !isNaN(parsed) ? parsed : defaultVal;
  },

  // Matriz NCM Aduanera y Regulaciones (Argentina / MERCOSUR)
  NCM_MATRIX: {
    'TECLADO_CABLE': { ncm: '8471.60.52', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    'TECLADO_WIRELESS': { ncm: '8471.60.53', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['ENACOM', 'LITIO_DG'] },
    'MOUSE_CABLE': { ncm: '8471.60.53', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    'MOUSE_WIRELESS': { ncm: '8471.60.53', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['ENACOM', 'LITIO_DG'] },
    'HEADSET_CABLE': { ncm: '8518.30.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    'HEADSET_WIRELESS': { ncm: '8518.30.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['ENACOM', 'LITIO_DG'] },
    'CONTROLLER_WIRELESS': { ncm: '9504.50.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['ENACOM', 'LITIO_DG'] },
    'MONITOR': { ncm: '8528.52.00', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'MOUSEPAD': { ncm: '3926.90.90', derechos: 0.35, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    'SWITCH': { ncm: '8536.50.90', derechos: 0.16, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    'OTRO': { ncm: '8473.30.99', derechos: 0.16, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: [] },
    // IT22: generalización — electrodomésticos y electrónica de consumo (DI validado
    // vía pcram.net/AEC MERCOSUR ≈20%; celular 0% por Decreto 333/25).
    'IMPRESORA': { ncm: '8443.32.90', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'LAVADORA': { ncm: '8450.11.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'HELADERA': { ncm: '8418.21.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'TV': { ncm: '8528.72.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'MICROONDAS': { ncm: '8516.50.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'AIRE': { ncm: '8415.10.19', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'ASPIRADORA': { ncm: '8508.11.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'CAFETERA': { ncm: '8516.71.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'LICUADORA': { ncm: '8509.40.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'PLANCHA': { ncm: '8516.40.00', derechos: 0.20, tasa: 0.03, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['SEGURIDAD_ELECTRICA_SMARK'] },
    'CELULAR': { ncm: '8517.13.00', derechos: 0, tasa: 0, iva: 0.21, ivaAdd: 0.20, percGan: 0.06, iibb: 0.025, certs: ['ENACOM', 'LITIO_DG'] }
  },

  CERTIFICATIONS_INFO: {
    'ENACOM': { title: '📡 Homologación ENACOM (Radiofrecuencia/BT)', costUsd: 350, description: 'Requerido para equipos inalámbricos (2.4GHz / Bluetooth 5.0+)' },
    'SEGURIDAD_ELECTRICA_SMARK': { title: '⚡ Certificación S-Mark (IRAM / UL)', costUsd: 850, description: 'Requerido para fuentes alimentadas a red eléctrica de 220V' },
    'LITIO_DG': { title: '🔋 Recargo Batería de Litio (IATA Dangerous Goods)', costUsd: 75, description: 'Recargo de transporte aéreo por materiales peligrosos (Li-Ion)' }
  },

  // Vigencia de la matriz de alícuotas (guided-import-wizard: "aviso de
  // vencimiento de la matriz"). Los DI 0% de teclados, mouse, monitores y
  // celulares no son un hecho físico: viven dentro del régimen de Bienes de
  // Tecnología de la Información (Decreto 557/23 + Decreto 1140/24), que tiene
  // alcance temporal. Cuando vence, el 0% deja de ser 0% y el cálculo sigue
  // devolviendo un número "bien". La matriz no puede vencer en silencio.
  RATES_META: {
    // De las dos fechas del régimen se toma la temprana a propósito: avisar
    // antes de tiempo molesta, avisar tarde manda un presupuesto mal hecho.
    vigenciaHasta: '2027-12-31',
    // Último control humano de la matriz contra el Boletín Oficial.
    actualizada: '2026-08-01',
    // Fuentes verificadas 2026-09-03 con texto primario del BO: el 333/2025
    // (BO 20/05/2025) modifica el BIT 557/23 — Art. 1 (Anexo IV DIE), Art. 2
    // (9504.50.00 sale del Anexo V y tributa AEC 20%: confirma controllers), Art. 3
    // (II 9,5% a celulares/monitores: la app lo avisa, fuera del scope periféricos).
    fuentes: 'Decreto 557/23 + Decreto 1140/24 + Decreto 333/25 (Bienes de Tecnología de la Información)',
  },

  // Estado de vigencia, para que la UI avise. `today` se puede forzar (tests y
  // reproducción de un informe viejo). Severidades: ok | proxima | vencida |
  // desconocida.
  ratesStatus(today) {
    const meta = this.RATES_META || {};
    const now = today instanceof Date ? today : today ? new Date(today) : new Date();
    if (Number.isNaN(now.getTime())) {
      return { severity: 'desconocida', days: null, vence: meta.vigenciaHasta || null, stale: false, message: 'No se pudo leer la fecha actual: verificá la vigencia de las alícuotas antes de confiar en este cálculo.' };
    }
    const end = new Date(String(meta.vigenciaHasta || '') + 'T23:59:59');
    const days = Number.isNaN(end.getTime())
      ? null
      : Math.ceil((end.getTime() - now.getTime()) / 86400000);
    const from = new Date(String(meta.actualizada || '') + 'T23:59:59');
    const stale = !Number.isNaN(from.getTime()) && (now.getTime() - from.getTime()) / 86400000 > 365;
    if (days === null) {
      return { severity: 'desconocida', days: null, vence: null, stale, message: 'La matriz de alícuotas no tiene fecha de vigencia: confirmala antes de usar estos números.' };
    }
    if (days < 0) {
      return {
        severity: 'vencida',
        days,
        vence: meta.vigenciaHasta,
        stale,
        message: `La matriz de alícuotas venció el ${meta.vigenciaHasta} (hace ${Math.abs(days)} días). Los aranceles pueden haber cambiado: revisá los números antes de cotizar.`,
      };
    }
    if (days <= 90 || stale) {
      const porque = days <= 90
        ? `vence el ${meta.vigenciaHasta} (quedan ${days} días)`
        : `está sin actualizar desde ${meta.actualizada}`;
      return { severity: 'proxima', days, vence: meta.vigenciaHasta, stale, message: `Chequeá la matriz de alícuotas: ${porque}.` };
    }
    return { severity: 'ok', days, vence: meta.vigenciaHasta, stale, message: null };
  },

  // IT33: márgenes de referencia por categoría (markup sobre costo neto real).
  // Valores realistas del rubro: accesorios baratos (cables, pads) llevan markup
  // mayor; hardware (teclados, mouse) menos. Override por configuración del usuario.
  MARKUP_MATRIX: {
    TECLADO: 2.5, MOUSE: 2.5, MOUSEPAD: 2.8, AURICULARES: 2.8, HEADSET: 2.8,
    EARBUDS: 2.8, CONTROLLER: 2.4, SWITCH: 2.2, KEYCAP: 2.6, CABLE: 2.0,
    HUB: 2.0, ADAPTER: 1.9, DOCK: 2.0, STAND: 2.2, WEBCAM: 2.3, CAMARA: 2.3,
    MONITOR: 1.8, SILLA: 1.6, DESK: 1.7, MICROFONO: 2.4, RECEIVER: 2.0,
    LAVADORA: 1.5, ELECTRODOMESTICO: 1.5, CELULAR: 1.35, TV: 1.4, IMPRESORA: 1.6,
    OTRO: 2.5
  },

  // IT33: markup efectivo para una categoría. Precedencia:
  // 1. overrides[cat] (override por categoría del usuario — máxima prioridad)
  // 2. matriz por categoría SOLO si el user usa el default 2.5 (no fijó markup global)
  // 3. defaultMarkup (lo que fijó el user, o 2.5)
  getMarkup(cat, defaultMarkup = 2.5, overrides = null) {
    const key = String(cat || '').toUpperCase();
    if (overrides && overrides[key] != null) return overrides[key];
    if (this.MARKUP_MATRIX[key] != null && Math.abs((defaultMarkup || 0) - 2.5) < 1e-9) return this.MARKUP_MATRIX[key];
    return defaultMarkup;
  },

  getCostConfig(inputs = {}, items = []) {
    // IT30: default de derechos NCM-aware — si el usuario no fija derechos,
    // deriva del NCM dominante de los ítems (teclados/mouse BIT = 0%, no 16% stale).
    let defaultDerechos = 16;
    if (inputs.derechos === undefined && Array.isArray(items) && items.length) {
      const dis = items.map(it => {
        const key = this.ncmKeyFor(it);
        const info = this.NCM_MATRIX[key];
        if (!info) return null;
        if (typeof NcmDatabase !== 'undefined' && NcmDatabase._db) {
          const db = NcmDatabase.byCode(info.ncm);
          if (db && db.di != null) return db.di;
        }
        return info.derechos;
      }).filter(v => v != null);
      if (dis.length) defaultDerechos = dis.reduce((a, b) => a + b, 0) / dis.length * 100;
    }
    return {
      fletePct: this.parseNum(inputs.flete, 15) / 100,
      fleteModo: inputs.fleteModo || 'porcentaje',
      pesoKg: this.parseNum(inputs.pesoKg, 0),
      costoPorKg: this.parseNum(inputs.costoPorKg, 12),
      logisticaModo: inputs.logisticaModo || 'courier',
      transporteModo: inputs.transporteModo || 'aereo',
      seguro: this.parseNum(inputs.seguro, 2) / 100,
      derechos: this.parseNum(inputs.derechos, defaultDerechos) / 100,
      tasa: this.parseNum(inputs.tasa, 3) / 100,
      perc: this.parseNum(inputs.perc, 6) / 100,
      ivaPct: this.parseNum(inputs.ivaPct, 21) / 100,
      desp: this.parseNum(inputs.desp, 500),
      courier: this.parseNum(inputs.courier, 8),
      markup: this.parseNum(inputs.markup, 2.5),
      markupOverrides: inputs.markupOverrides || null,
      tipoCambio: this.parseNum(inputs.tipoCambio, 1400.0),
      incluirIva: inputs.incluirIva !== undefined ? inputs.incluirIva : false,
    };
  },

  calculateOrder(items = [], costConfig = {}) {
    const config = this.getCostConfig(costConfig, items);
    const tc = config.tipoCambio;

    const totalFob = items.reduce((s, r) => s + (r.fob || 0) * (r.qty || 0), 0);
    const totalQty = items.reduce((s, r) => s + (r.qty || 0), 0);

    let flete;
    if (config.fleteModo === 'peso' && config.pesoKg > 0 && config.costoPorKg > 0) {
      flete = config.pesoKg * config.costoPorKg;
    } else {
      flete = totalFob * config.fletePct;
    }

    const seguro = totalFob * config.seguro;
    const cif = totalFob + flete + seguro;
    const derechos = cif * config.derechos;
    const tasa = cif * config.tasa;
    const perc = cif * config.perc;
    const ivaUsd = cif * config.ivaPct;
    const courierCost = config.logisticaModo === 'courier' ? totalQty * config.courier : 0;
    const despCost = config.logisticaModo === 'importador' ? config.desp : 0;

    // El IVA es recuperable/repercutible y nunca forma parte del costo del producto.
    const totalCostoNeto = cif + derechos + tasa + perc + despCost + courierCost;
    const factorCosto = totalFob > 0 ? totalCostoNeto / totalFob : 0;

    const calculatedItems = items.map(item => {
      const fob = item.fob || 0;
      const qty = item.qty || 0;

      // BUG P10 (fix 05/08): con FOB total 0 pero costos fijos > 0 (flete por
      // peso, despachante, courier), factorCosto = 0 → costo unitario 0 y el
      // costo fijo se perdía. Ahora: sin FOB, se distribuye el costo neto
      // total entre las unidades (prorrateo por qty).
      const costoU = totalFob > 0
        ? Math.round(fob * factorCosto * 100) / 100
        : (totalQty > 0 ? Math.round((totalCostoNeto / totalQty) * 100) / 100 : 0);
      const pvp = Math.round(costoU * this.getMarkup(item.cat, config.markup, config.markupOverrides) * 100) / 100;
      const subFob = fob * qty;
      const subPvp = pvp * qty;
      const subCosto = costoU * qty;
      const subIva = totalFob > 0 ? ivaUsd * (subFob / totalFob) : 0;
      const ivaU = qty > 0 ? subIva / qty : 0;
      const subMargen = subPvp - subCosto;
      const margenPct = pvp > 0 ? Math.round(((pvp - costoU) / pvp) * 100) : 0;
      const itemRoiPct = costoU > 0 ? Math.round(((pvp - costoU) / costoU) * 100) : 0;

      const costoUArs = Math.round(costoU * tc);
      const pvpArs = Math.round(pvp * tc);
      const subFobArs = Math.round(subFob * tc);

      return {
        ...item,
        costoU,
        pvp,
        subFob,
        subPvp,
        subCosto,
        ivaU,
        subIva,
        subMargen,
        margenPct,
        roiPct: itemRoiPct,
        costoUArs,
        pvpArs,
        ivaUArs: Math.round(ivaU * tc),
        subIvaArs: Math.round(subIva * tc),
        subFobArs
      };
    });

    const totalFacturacion = calculatedItems.reduce((s, r) => s + r.subPvp, 0);
    const totalMargen = totalFacturacion - totalCostoNeto;
    const margenGeneralPct = totalFacturacion > 0 ? Math.round((totalMargen / totalFacturacion) * 100) : 0;
    const roiGeneralPct = totalCostoNeto > 0 ? Math.round((totalMargen / totalCostoNeto) * 100) : 0;

    const warnings = [];
    const cautions = [];

    if (config.logisticaModo === 'courier') {
      cautions.push('ℹ️ Régimen Courier Simplificado: Máx USD 3.000 FOB por envío · Máx 50 kg por bulto');
      if (totalFob > 3000) {
        warnings.push({
          type: 'danger',
          code: 'COURIER_FOB_EXCEEDED',
          title: '🚨 Límite Courier Superado',
          message: `El importe FOB total ($${totalFob.toFixed(2)} USD) excede el máximo permitido de USD 3,000 para Courier Simplificado.`
        });
      }
      if (config.fleteModo === 'peso' && config.pesoKg > 50) {
        warnings.push({
          type: 'warning',
          code: 'COURIER_WEIGHT_EXCEEDED',
          title: '⚠️ Peso Excedido para Courier',
          message: `El peso total de ${config.pesoKg} kg supera el límite reglamentario de 50 kg por bulto.`
        });
      }

      const speciesExceeded = calculatedItems.filter(i => i.qty > 3);
      if (speciesExceeded.length > 0) {
        warnings.push({
          type: 'warning',
          code: 'COURIER_SPECIES_WARNING',
          title: '⚠️ Presunción de Fin Comercial',
          message: `${speciesExceeded.length} productos superan las 3 unidades de la misma especie.`
        });
      }
    } else {
      cautions.push('⚓ Régimen de Importación General (Despachante de Aduana / Despacho oficial)');
    }
    cautions.push(`ℹ️ Transporte ${config.transporteModo}: informativo; el flete se calcula por ${config.fleteModo === 'peso' ? 'peso' : 'porcentaje FOB'}.`);

    return {
      config,
      items: calculatedItems,
      warnings,
      cautions,
      totals: {
        fob: totalFob,
        fobArs: Math.round(totalFob * tc),
        qty: totalQty,
        fleteUsd: flete,
        fleteArs: Math.round(flete * tc),
        cifUsd: cif,
        derechosUsd: derechos,
        tasaUsd: tasa,
        percUsd: perc,
        ivaUsd: ivaUsd,
        ivaArs: Math.round(ivaUsd * tc),
        costo: totalCostoNeto,
        costoNeto: totalCostoNeto,
        costoArs: Math.round(totalCostoNeto * tc),
        costoNetoArs: Math.round(totalCostoNeto * tc),
        totalBrutoConIva: totalCostoNeto + ivaUsd,
        totalBrutoConIvaArs: Math.round((totalCostoNeto + ivaUsd) * tc),
        facturacion: totalFacturacion,
        facturacionArs: Math.round(totalFacturacion * tc),
        margen: totalMargen,
        margenArs: Math.round(totalMargen * tc),
        margenPct: margenGeneralPct,
        roiPct: roiGeneralPct,
        tipoCambio: tc
      }
    };
  },

  // IT23: mapea un item (cat + modelo + variante) a su clave NCM de la matriz.
  ncmKeyFor(item) {
    const catUpper = (item.cat || '').toUpperCase();
    const textAll = `${item.modelo} ${item.variante || ''} ${item.cat}`.toUpperCase();
    if (catUpper.includes('TECLADO')) return textAll.includes('WIRELESS') || textAll.includes('BT') || textAll.includes('BLUETOOTH') ? 'TECLADO_WIRELESS' : 'TECLADO_CABLE';
    if (catUpper.includes('MOUSE') && !catUpper.includes('MOUSEPAD')) return textAll.includes('WIRELESS') || textAll.includes('BT') || textAll.includes('BLUETOOTH') ? 'MOUSE_WIRELESS' : 'MOUSE_CABLE';
    if (catUpper.includes('HEADSET') || catUpper.includes('AURICULAR')) return textAll.includes('WIRELESS') || textAll.includes('BT') ? 'HEADSET_WIRELESS' : 'HEADSET_CABLE';
    if (catUpper.includes('CONTROLLER')) return 'CONTROLLER_WIRELESS';
    if (catUpper.includes('MONITOR')) return 'MONITOR';
    if (catUpper.includes('MOUSEPAD')) return 'MOUSEPAD';
    if (catUpper.includes('SWITCH')) return 'SWITCH';
    if (this.NCM_MATRIX[catUpper]) return catUpper; // categorías directas (LAVADORA, TV...)
    return 'OTRO';
  },

  // MOTOR DE LIQUIDACIÓN EXACTA PUERTA A PUERTA (NCM & REGULACIONES)
  calculateDoorToDoorExactCost(items = [], doorConfig = {}) {
    const tc = this.parseNum(doorConfig.tipoCambio, 1400);
    const pesoTotal = this.parseNum(doorConfig.pesoKg, 0);
    const costoPorKg = this.parseNum(doorConfig.costoPorKg, 12);
    const depositoFiscalUsd = this.parseNum(doorConfig.depositoFiscalUsd, 150);
    const despachanteUsd = this.parseNum(doorConfig.despachanteUsd, 450);
    const simDigitalizacionUsd = this.parseNum(doorConfig.simDigitalizacionUsd, 40);
    const fleteInternoUsd = this.parseNum(doorConfig.fleteInternoUsd, 80);
    // Slice C: Percepción Bienes Personales (BP) — aditiva sobre baseImp, default 0.
    // 0 ⇒ salida byte-identical a la legada del motor auditado (regresión pinneada).
    const bpPct = doorConfig.bpPct != null ? doorConfig.bpPct : 0;

    const totalFob = items.reduce((s, r) => s + (r.fob || 0) * (r.qty || 0), 0);
    const totalQty = items.reduce((s, r) => s + (r.qty || 0), 0);
    const fletePct = doorConfig.fletePct != null ? doorConfig.fletePct : 0.15;
    // Precisión (guía exhaustiva): el forwarder cotiza un monto total en USD (LCL
    // por CBM, aéreo, courier). Si viene fleteUsd explícito (>0) gana sobre peso
    // y % — sin él, el criterio es el de siempre (byte-identical).
    const fleteUsdExplicit = (doorConfig.fleteUsd != null && Number.isFinite(Number(doorConfig.fleteUsd)) && Number(doorConfig.fleteUsd) > 0) ? Number(doorConfig.fleteUsd) : 0;
    const fleteTotal = fleteUsdExplicit > 0 ? fleteUsdExplicit : (pesoTotal > 0 ? pesoTotal * costoPorKg : totalFob * fletePct);
    const seguroPct = doorConfig.seguroPct != null ? doorConfig.seguroPct : 0.015;
    const seguroTotal = totalFob * seguroPct;
    const cifTotal = totalFob + fleteTotal + seguroTotal;

    // IT21: régimen de importación. courier = ≤USD 3.000/50kg, arancel simplificado
    // 50% sobre excedente de USD 400, IVA total, SIN anticipos (Ganancias/IIBB/IVA adic).
    // importador = despacho general (matriz NCM completa).
    // Etapa A (d1 CONFIRMADO con fuente primaria): Decreto 1065/2024, Art. 1º — la
    // importación PSP/Courier queda desgravada "sin finalidad comercial", 5 envíos/año
    // por persona, franquicia USD 400 FOB; "el excedente no quedará alcanzado por los
    // beneficios". Un envío courier CON finalidad comercial (reventa) tributa con la
    // matriz NCM completa (el courier despacha por cuenta y orden). doorConfig.proposito
    // ('personal' | 'reventa') selecciona el camino; sin proposito se mantiene el
    // simplificado (byte-identical a la salida auditada del motor).
    const regimen = doorConfig.regimen || (doorConfig.logisticaModo === 'courier' ? 'courier' : 'importador');
    if (regimen === 'courier' && (doorConfig.proposito === 'reventa')) {
      const gen = this.calculateDoorToDoorExactCost(items, Object.assign({}, doorConfig, { regimen: 'importador' }));
      gen.regimen = 'courier';
      return gen;
    }
    if (regimen === 'courier') {
      const excedente = Math.max(0, cifTotal - 400);
      const arancelSimplificado = excedente * 0.50;
      const ivaCourier = cifTotal * 0.21;
      const totalGastos = depositoFiscalUsd + despachanteUsd + simDigitalizacionUsd + fleteInternoUsd;
      const tributos = arancelSimplificado + ivaCourier;
      const caja = cifTotal + tributos + totalGastos;
      const itemsOut = items.map(it => {
        const q = Math.max(0, Number(it.qty) || 0);
        const frac = totalFob > 0 ? ((it.fob || 0) * q) / totalFob : (totalQty > 0 ? q / totalQty : 0);
        const itCif = cifTotal * frac;
        const itEx = Math.max(0, itCif - 400 * frac);
        return Object.assign({}, it, {
          itemCif: itCif, derechosUsd: itEx * 0.50, tasaUsd: 0, ivaUsd: itCif * 0.21,
          ivaAddUsd: 0, percGanUsd: 0, iibbUsd: 0, ncm: (Calculator.NCM_MATRIX.OTRO || {}).ncm || 'COURIER',
          totalTributosItemUsd: itEx * 0.50 + itCif * 0.21, recuperableUsd: itCif * 0.21,
          costoRealItemUsd: itCif + itEx * 0.50
        });
      });
      return {
        regimen: 'courier', items: itemsOut, certificationsRequired: [],
        summary: {
          fobTotalUsd: totalFob, fleteTotalUsd: fleteTotal, seguroTotalUsd: seguroTotal,
          cifTotalUsd: cifTotal, totalTributosAduanaUsd: tributos, totalIvaAduanaUsd: ivaCourier,
          ivaUsd: ivaCourier, ivaArs: ivaCourier * tc, depositoFiscalUsd, despachanteUsd,
          simDigitalizacionUsd, fleteInternoUsd, totalCertsCostUsd: 0, totalGastosFijosDestinoUsd: totalGastos,
          bpUsd: 0, // BP percepción: solo aplica en régimen importador
          totalPuertaUsd: caja - ivaCourier, totalPuertaConIvaUsd: caja, totalPuertaConIvaArs: caja * tc,
          totalPuertaArs: (caja - ivaCourier) * tc, totalRecuperableUsd: ivaCourier,
          totalAnticiposRecuperablesUsd: 0, costoNetoRealUsd: caja - ivaCourier,
          costoNetoRealArs: (caja - ivaCourier) * tc, creditoFiscalArs: ivaCourier * tc, tipoCambio: tc
        }
      };
    }
    const certsSet = new Set();
    const itemCalculations = items.map(item => {
      const q = Math.max(0, Number(item.qty) || 0);
      const subFob = (item.fob || 0) * q;
      const weightFrac = totalFob > 0 ? (subFob / totalFob) : (totalQty > 0 ? q / totalQty : 0);
      const itemFlete = fleteTotal * weightFrac;
      const itemSeguro = seguroTotal * weightFrac;
      const itemCif = subFob + itemFlete + itemSeguro;

      // Determinar NCM y Aranceles exactos por categoría/variant
      // (lógica consolidada en ncmKeyFor — incluye fallback a categorías directas de la matriz
      const ncmKey = this.ncmKeyFor(item)

      const baseRule = this.NCM_MATRIX[ncmKey] || this.NCM_MATRIX['OTRO'];
      // IT41: override por producto. Gana el de SKU sobre el de categoria para
      // poder corregir un item mal clasificado sin cambiarle el arancel a todos
      // los de su categoria. Sin ncmBySku la resolucion es la de siempre.
      const ovSku = doorConfig.ncmBySku && item.sku ? doorConfig.ncmBySku[String(item.sku)] : null;
      const ov = ovSku || (doorConfig.ncmOverrides && doorConfig.ncmOverrides[ncmKey]);

      // IT40: override NCM con utilidad real — el código elegido por el usuario
      // reemplaza al de la matriz en el resultado y, si mapea a OTRA entrada de
      // la matriz (ej: eligió el NCM de un mousepad para un teclado), se usan
      // SUS rates (TE/IVA/adic/Ganancias/IIBB/certs). Si no mapea, se mantienen
      // los estructurales de la categoría (dependen del tipo de producto) y el
      // DI real viene del override.
      let ncmRule = baseRule;
      if (ov && ov.ncm) {
        const matched = Object.values(this.NCM_MATRIX).find(r => r.ncm === ov.ncm);
        ncmRule = matched ? { ...matched } : { ...baseRule, ncm: ov.ncm };
      }

      ncmRule.certs.forEach(c => certsSet.add(c));
      const iibbPct = doorConfig.iibbPct != null ? doorConfig.iibbPct : ncmRule.iibb;
      const derechoPct = ov && ov.derechos != null ? ov.derechos : ncmRule.derechos;

      // Impuestos SIM Aduana Argentina
      const derechosUsd = itemCif * derechoPct;
      const tasaUsd = itemCif * ncmRule.tasa;
      const baseImp = itemCif + derechosUsd + tasaUsd;
      const ivaUsd = baseImp * ncmRule.iva;
      const ivaAddUsd = baseImp * ncmRule.ivaAdd;
      const percGanUsd = baseImp * ncmRule.percGan;
      const iibbUsd = baseImp * iibbPct;
      const bpUsd = baseImp * bpPct; // Percepción Bienes Personales — aditiva, default 0
       const totalTributosItemUsd = derechosUsd + tasaUsd + ivaAddUsd + percGanUsd + iibbUsd + bpUsd;

      return {
        ...item,
        ncm: ncmRule.ncm,
        ncmKey,
        itemCif,
        derechosUsd,
        tasaUsd,
        ivaUsd,
        ivaAddUsd,
        percGanUsd,
         iibbUsd,
         bpUsd,
         totalTributosItemUsd,
         totalTributosItemConIvaUsd: totalTributosItemUsd + ivaUsd,
        // IT19 (crédito fiscal): IVA + IVA adicional + Ganancias + IIBB son
        // pagos a cuenta recuperables (crédito fiscal a favor del inscripto).
        // El costo REAL neto = solo DI + TE (no recuperables).
        recuperableUsd: ivaUsd + ivaAddUsd + percGanUsd + iibbUsd,
        costoRealItemUsd: itemCif + derechosUsd + tasaUsd,
        certs: ncmRule.certs
      };
    });

    // Sumar costos fijos de certificaciones activas
    let totalCertsCostUsd = 0;
    const certDetails = [];
    certsSet.forEach(certKey => {
      const info = this.CERTIFICATIONS_INFO[certKey];
      if (info) {
        totalCertsCostUsd += info.costUsd;
        certDetails.push(info);
      }
    });

    const totalGastosFijosDestinoUsd = depositoFiscalUsd + despachanteUsd + simDigitalizacionUsd + fleteInternoUsd + totalCertsCostUsd;
    const totalBpUsd = itemCalculations.reduce((sum, i) => sum + (i.bpUsd || 0), 0);
    const totalTributosAduanaUsd = itemCalculations.reduce((sum, i) => sum + i.derechosUsd + i.tasaUsd + i.ivaAddUsd + i.percGanUsd + i.iibbUsd + (i.bpUsd || 0), 0);
    const totalIvaAduanaUsd = itemCalculations.reduce((sum, i) => sum + i.ivaUsd, 0);
    // IT19 (crédito fiscal): lo recuperable = IVA + anticipos (IVA add + Ganancias + IIBB).
    // Caja = todo lo que sale al despachar. Costo neto real = solo lo NO recuperable.
    const totalRecuperableUsd = totalIvaAduanaUsd + itemCalculations.reduce((sum, i) => sum + i.ivaAddUsd + i.percGanUsd + i.iibbUsd, 0);
    const totalAnticiposRecuperablesUsd = totalRecuperableUsd - totalIvaAduanaUsd;
    const costoNetoRealUsd = cifTotal + (totalTributosAduanaUsd - totalAnticiposRecuperablesUsd) + totalGastosFijosDestinoUsd;

    const totalPuertaUsd = cifTotal + totalTributosAduanaUsd + totalGastosFijosDestinoUsd;
    const totalPuertaConIvaUsd = totalPuertaUsd + totalIvaAduanaUsd;
    const totalPuertaArs = totalPuertaUsd * tc;

    // Asignación final de costo unitario exactamente puesto en puerta
    const finalItems = itemCalculations.map(i => {
      const weightFrac = totalFob > 0 ? ((i.fob * i.qty) / totalFob) : (totalQty > 0 ? i.qty / totalQty : 0);
      const itemGastosFijosProrrateados = totalGastosFijosDestinoUsd * weightFrac;
      const itemCostoPuertaTotalUsd = i.itemCif + i.totalTributosItemUsd + itemGastosFijosProrrateados;
      const costoPuertaUnitUsd = i.qty > 0 ? (itemCostoPuertaTotalUsd / i.qty) : 0;
      const costoPuertaUnitArs = costoPuertaUnitUsd * tc;

      return {
        ...i,
        costoPuertaTotalUsd: itemCostoPuertaTotalUsd,
        costoPuertaUnitUsd,
        costoPuertaUnitArs
      };
    });

    return {
      items: finalItems,
      certificationsRequired: certDetails,
      summary: {
        fobTotalUsd: totalFob,
        fleteTotalUsd: fleteTotal,
        seguroTotalUsd: seguroTotal,
        cifTotalUsd: cifTotal,
        totalTributosAduanaUsd,
        totalIvaAduanaUsd,
        ivaUsd: totalIvaAduanaUsd,
        ivaArs: totalIvaAduanaUsd * tc,
        depositoFiscalUsd,
        despachanteUsd,
        simDigitalizacionUsd,
        fleteInternoUsd,
        totalCertsCostUsd,
        totalGastosFijosDestinoUsd,
        bpUsd: totalBpUsd,
        totalPuertaUsd,
        totalPuertaConIvaUsd,
        totalPuertaConIvaArs: totalPuertaConIvaUsd * tc,
        totalPuertaArs,
        // IT19: crédito fiscal a favor (recuperable) y costo neto real
        totalRecuperableUsd,
        totalAnticiposRecuperablesUsd,
        costoNetoRealUsd,
        costoNetoRealArs: costoNetoRealUsd * tc,
        creditoFiscalArs: totalRecuperableUsd * tc,
        tipoCambio: tc
      }
    };
  },

  estimateItemFreightAndIva(fob, tc = 1400, fletePct = 0.15, ivaPct = 0.21) {
    const fleteEst = fob * fletePct;
    const cifEst = fob + fleteEst;
    const ivaEst = cifEst * ivaPct;
    return {
      fleteEstUsd: fleteEst,
      fleteEstArs: Math.round(fleteEst * tc),
      ivaEstUsd: ivaEst,
      ivaEstArs: Math.round(ivaEst * tc)
    };
  },

  // Slice C (landed-cost-verdict): compara el costo puesto en puerta (salida del
  // motor auditado) contra un precio local de referencia. Consume el summary del
  // motor — NO recalcula impuestos por su cuenta (spec: reuse existing engine).
  compareVsLocal(landedUsd, localPriceUsd, tipoCambio) {
    if (localPriceUsd === null || localPriceUsd === undefined ||
        typeof localPriceUsd !== 'number' || !Number.isFinite(localPriceUsd) || localPriceUsd <= 0) {
      // Sin precio local: nunca asumir un precio, nunca lanzar.
      return { available: false };
    }
    const landed = this.parseNum(landedUsd, 0);
    const local = localPriceUsd;
    const tc = this.parseNum(tipoCambio, 0);
    const diffUsd = local - landed;
    // Tolerancia float: |landed − local| < 1e-6 cuenta como empate exacto.
    const verdict = Math.abs(diffUsd) < 1e-6 ? 'break_even' : (diffUsd > 0 ? 'cheaper' : 'more_expensive');
    const cleanDiff = Math.abs(diffUsd) < 1e-6 ? 0 : diffUsd;
    const diffPct = local !== 0 ? (cleanDiff / local) * 100 : 0;
    return {
      available: true,
      verdict,
      diffUsd: cleanDiff,
      diffPct,
      diffArs: cleanDiff * tc,
      landedUsd: landed,
      localPriceUsd: local,
      tipoCambio: tc
    };
  },

  // Slice C: línea informativa de Impuesto PAIS — 0% eliminado (matriz auditada
  // 2026). Fuente única para el desglose del wizard; NUNCA omitir en silencio.
  getPaisLine() {
    return { label: 'Impuesto PAIS', ratePct: 0, amountUsd: 0, status: 'eliminated' };
  },

  // Slice C: preset de seguro sugerido ≈ 1.1% de (FOB + flete). El wizard convierte
  // el monto al equivalente seguroPct = amount / fobTotal sin tocar el motor.
  suggestInsuranceUsd(fob, freight) {
    return (this.parseNum(fob, 0) + this.parseNum(freight, 0)) * 0.011;
  }
};

if (typeof window !== 'undefined') window.Calculator = Calculator;
if (typeof module !== 'undefined') module.exports = Calculator;
