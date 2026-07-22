// ============================================
//  Mambo Pedidos - Módulo de Cálculos de Costo, Logística y Rentabilidad (USD / ARS)
//  Soporte para Cálculo de Flete por Peso (Kg), Regulaciones Courier/Importador, ROI e IVA
//  Desarrollado por @geto_dev
// ============================================

const Calculator = {
  parseNum(val, defaultVal) {
    if (val === null || val === undefined || val === '') return defaultVal;
    const str = String(val).replace(',', '.');
    const parsed = parseFloat(str);
    return !isNaN(parsed) ? parsed : defaultVal;
  },

  getCostConfig(inputs = {}) {
    return {
      fletePct: this.parseNum(inputs.flete, 15) / 100,
      fleteModo: inputs.fleteModo || 'porcentaje', // 'porcentaje' | 'peso'
      pesoKg: this.parseNum(inputs.pesoKg, 0),
      costoPorKg: this.parseNum(inputs.costoPorKg, 12), // USD por Kg
      logisticaModo: inputs.logisticaModo || 'courier', // 'courier' | 'importador'
      transporteModo: inputs.transporteModo || 'aereo', // 'aereo' | 'maritimo'
      seguro: this.parseNum(inputs.seguro, 2) / 100,
      derechos: this.parseNum(inputs.derechos, 16) / 100,
      tasa: this.parseNum(inputs.tasa, 3) / 100,
      perc: this.parseNum(inputs.perc, 6) / 100,
      ivaPct: this.parseNum(inputs.ivaPct, 21) / 100, // 21% o 10.5%
      desp: this.parseNum(inputs.desp, 500),
      courier: this.parseNum(inputs.courier, 8),
      markup: this.parseNum(inputs.markup, 2.5),
      tipoCambio: this.parseNum(inputs.tipoCambio, 1400.0),
    };
  },

  calculateOrder(items = [], costConfig = {}) {
    const config = this.getCostConfig(costConfig);
    const tc = config.tipoCambio;

    const totalFob = items.reduce((s, r) => s + (r.fob || 0) * (r.qty || 0), 0);
    const totalQty = items.reduce((s, r) => s + (r.qty || 0), 0);

    // Cálculo del flete según el modo (Porcentaje vs Peso $ / Kg)
    let flete = 0;
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

    const totalCosto = cif + derechos + tasa + perc + despCost + courierCost;
    const factorCosto = totalFob > 0 ? totalCosto / totalFob : 0;

    const calculatedItems = items.map(item => {
      const fob = item.fob || 0;
      const qty = item.qty || 0;

      const costoU = Math.round(fob * factorCosto * 100) / 100;
      const pvp = Math.round(costoU * config.markup * 100) / 100;
      const subFob = fob * qty;
      const subPvp = pvp * qty;
      const subCosto = costoU * qty;
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
        subMargen,
        margenPct,
        roiPct: itemRoiPct,
        costoUArs,
        pvpArs,
        subFobArs
      };
    });

    const totalFacturacion = calculatedItems.reduce((s, r) => s + r.subPvp, 0);
    const totalMargen = totalFacturacion - totalCosto;
    const margenGeneralPct = totalFacturacion > 0 ? Math.round((totalMargen / totalFacturacion) * 100) : 0;
    const roiGeneralPct = totalCosto > 0 ? Math.round((totalMargen / totalCosto) * 100) : 0;

    // Evaluaciones y Advertencias de Régimen Logístico
    const warnings = [];
    const cautions = [];

    if (config.logisticaModo === 'courier') {
      cautions.push('ℹ️ Régimen Courier Simplificado: Máx USD 3.000 FOB por envío · Máx 50 kg por bulto');
      if (totalFob > 3000) {
        warnings.push({
          type: 'danger',
          code: 'COURIER_FOB_EXCEEDED',
          title: '🚨 Límite Courier Superado',
          message: `El importe FOB total ($${totalFob.toFixed(2)} USD) excede el máximo permitido de USD 3,000 para Courier Simplificado en Argentina.`
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
          message: `${speciesExceeded.length} productos superan las 3 unidades de la misma especie (podría requerir régimen de importación general).`
        });
      }
    } else {
      cautions.push('⚓ Régimen de Importación General (Despachante de Aduana / Despacho oficial)');
    }

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
        costo: totalCosto,
        costoArs: Math.round(totalCosto * tc),
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

  // Estimador rápido para ítems individuales en vista de Catálogo
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
  }
};

window.Calculator = Calculator;
