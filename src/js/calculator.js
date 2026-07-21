// ============================================
//  Mambo Pedidos - Módulo de Cálculos de Costo y Rentabilidad (USD / ARS)
// ============================================

const Calculator = {
  // Parsea números de forma segura permitiendo el 0 y soportando formato decimal con coma (LATAM)
  parseNum(val, defaultVal) {
    if (val === null || val === undefined || val === '') return defaultVal;
    const str = String(val).replace(',', '.');
    const parsed = parseFloat(str);
    return !isNaN(parsed) ? parsed : defaultVal;
  },

  // Extrae y parsea los valores de costos de la UI o de un objeto dado
  getCostConfig(inputs = {}) {
    return {
      flete: this.parseNum(inputs.flete, 15) / 100,
      seguro: this.parseNum(inputs.seguro, 2) / 100,
      derechos: this.parseNum(inputs.derechos, 16) / 100,
      tasa: this.parseNum(inputs.tasa, 3) / 100,
      perc: this.parseNum(inputs.perc, 6) / 100,
      desp: this.parseNum(inputs.desp, 500),
      courier: this.parseNum(inputs.courier, 8),
      markup: this.parseNum(inputs.markup, 2.5),
      tipoCambio: this.parseNum(inputs.tipoCambio, 1400.0),
    };
  },

  // Recalcula los costos y márgenes de un pedido completo (Soporte Dólar / Pesos ARS)
  calculateOrder(items = [], costConfig = {}) {
    const config = this.getCostConfig(costConfig);
    const tc = config.tipoCambio;

    const totalFob = items.reduce((s, r) => s + (r.fob || 0) * (r.qty || 0), 0);
    const totalQty = items.reduce((s, r) => s + (r.qty || 0), 0);

    const flete = totalFob * config.flete;
    const seguro = totalFob * config.seguro;
    const cif = totalFob + flete + seguro;
    const derechos = cif * config.derechos;
    const tasa = cif * config.tasa;
    const perc = cif * config.perc;
    const courier = totalQty * config.courier;

    const totalCosto = cif + derechos + tasa + perc + config.desp + courier;
    const factorCosto = totalFob > 0 ? totalCosto / totalFob : 0;

    const calculatedItems = items.map(item => {
      const fob = item.fob || 0;
      const qty = item.qty || 0;

      const costoU = Math.round(fob * factorCosto * 100) / 100;
      const pvp = Math.round(costoU * config.markup * 100) / 100;
      const subFob = fob * qty;
      const margenPct = pvp > 0 ? Math.round(((pvp - costoU) / pvp) * 100) : 0;

      // Valores en Pesos ARS
      const costoUArs = Math.round(costoU * tc);
      const pvpArs = Math.round(pvp * tc);
      const subFobArs = Math.round(subFob * tc);

      return {
        ...item,
        costoU,
        pvp,
        subFob,
        margenPct,
        costoUArs,
        pvpArs,
        subFobArs
      };
    });

    const totalFacturacion = calculatedItems.reduce((s, r) => s + r.pvp * r.qty, 0);
    const totalMargen = totalFacturacion - totalCosto;
    const margenGeneralPct = totalFacturacion > 0 ? Math.round((totalMargen / totalFacturacion) * 100) : 0;

    // Totales en Pesos ARS
    const totalCostoArs = Math.round(totalCosto * tc);
    const totalFacturacionArs = Math.round(totalFacturacion * tc);
    const totalMargenArs = Math.round(totalMargen * tc);

    return {
      config,
      items: calculatedItems,
      totals: {
        fob: totalFob,
        fobArs: Math.round(totalFob * tc),
        qty: totalQty,
        costo: totalCosto,
        costoArs: totalCostoArs,
        facturacion: totalFacturacion,
        facturacionArs: totalFacturacionArs,
        margen: totalMargen,
        margenArs: totalMargenArs,
        margenPct: margenGeneralPct,
        tipoCambio: tc
      }
    };
  }
};

window.Calculator = Calculator;
