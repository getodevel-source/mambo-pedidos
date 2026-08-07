// ============================================
//  Mambo Pedidos - Generación de Cotizaciones Comerciales (a 10)
//  PDF/HTML imprimible + CSV + historial + branding configurable
// ============================================

const QuoteGenerator = {

  CONFIG_KEY: 'mamboQuoteConfig',
  COUNTER_KEY: 'mamboQuoteCounter',
  HISTORY_KEY: 'mamboQuoteHistory',

  DEFAULT_CONFIG: {
    companyName: 'Mambo Pedidos',
    logo: '',
    cuit: '',
    address: '',
    city: '',
    sellerName: '',
    conditions: 'Pago: transferencia bancaria. Precios en USD, IVA de costos no incluido.',
    validityDays: 5,
    showCosts: false,
    currency: 'USD',
    footer: 'Documento generado automáticamente por Mambo Pedidos.'
  },

  getConfig() {
    try {
      const raw = localStorage.getItem(QuoteGenerator.CONFIG_KEY);
      if (raw) return Object.assign({}, QuoteGenerator.DEFAULT_CONFIG, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, QuoteGenerator.DEFAULT_CONFIG);
  },

  saveConfig(config) {
    try { localStorage.setItem(QuoteGenerator.CONFIG_KEY, JSON.stringify(config)); } catch (e) {}
  },

  nextNumber() {
    let n = 1;
    try { n = parseInt(localStorage.getItem(QuoteGenerator.COUNTER_KEY) || '0', 10) + 1; } catch (e) {}
    const num = 'NQ-' + String(n).padStart(4, '0');
    try { localStorage.setItem(QuoteGenerator.COUNTER_KEY, String(n)); } catch (e) {}
    return num;
  },

  getHistory() {
    try { return JSON.parse(localStorage.getItem(QuoteGenerator.HISTORY_KEY) || '[]'); } catch (e) { return []; }
  },

  saveToHistory(entry) {
    try {
      const h = QuoteGenerator.getHistory();
      h.unshift(entry);
      localStorage.setItem(QuoteGenerator.HISTORY_KEY, JSON.stringify(h.slice(0, 50))); // últimas 50
    } catch (e) {}
  },

  formatCurrency(value, opts = {}) {
    const locale = opts.locale || 'es-AR';
    const currency = opts.currency || 'USD';
    const decimals = opts.decimals !== undefined ? opts.decimals : 2;
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value || 0);
    } catch {
      return `$${(value || 0).toFixed(decimals)}`;
    }
  },

  esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // Genera el documento HTML imprimible/PDF con la configuración aplicada.
  generatePrintableQuote(pedido, config = {}, opts = {}) {
    if (!pedido || !pedido.items || !pedido.items.length) {
      if (typeof toast === 'function') toast('No hay productos en el pedido para cotizar', 'error');
      return;
    }
    const cfg = Object.assign(QuoteGenerator.getConfig(), config);
    const t = pedido.totals || {};
    const currency = opts.currency || cfg.currency || 'USD';
    const tc = opts.tipoCambio || t.tipoCambio || 1400;
    const showCosts = cfg.showCosts;

    const dateStr = new Date(pedido.date || Date.now()).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const clientName = cfg.clientName || opts.clientName || 'Cliente Mayorista';
    const number = opts.number || cfg.pendingNumber || QuoteGenerator.nextNumber();
    const validity = cfg.validityDays || 5;

    // Desglose por ítem — subtotal siempre desde item.pvp*qty (fuente única)
    let itemsHtml = '';
    let sumItems = 0;
    pedido.items.forEach((item, i) => {
      const pvpU = item.pvp || item.fob || 0;
      const sub = pvpU * (item.qty || 1);
      sumItems += sub;
      const hasImage = typeof item.img === 'string' && /data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(item.img.trim());
      const imgCell = hasImage ? `<img src="${this.esc(item.img)}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1;">` : `<span style="color: #cbd5e1;">-</span>`;
      const costCell = showCosts ? `<td style="padding: 8px; text-align: right; font-family: monospace; color: #64748b;">$${(item.fob || 0).toFixed(2)}</td>` : '';
      itemsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-family: monospace; font-size: 11px; color: #64748b;">${i + 1}</td>
          <td style="padding: 8px; text-align: center;">${imgCell}</td>
          <td style="padding: 8px; font-weight: 600; color: #1e293b;">${this.esc(item.sku)}</td>
          <td style="padding: 8px; color: #334155;">${this.esc(item.marca)}</td>
          <td style="padding: 8px; color: #0f172a; font-weight: 600;">${this.esc(item.modelo)}</td>
          <td style="padding: 8px; color: #64748b;">${this.esc(item.color || item.variante || '-')}</td>
          <td style="padding: 8px; text-align: center; font-weight: 700; color: #6366f1;">${item.qty}</td>
          ${costCell}
          <td style="padding: 8px; text-align: right; font-family: monospace;">${QuoteGenerator.formatCurrency(pvpU, { currency })}</td>
          <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 700; color: #059669;">${QuoteGenerator.formatCurrency(sub, { currency })}</td>
        </tr>`;
    });

    // Moneda: si ARS, convertir con el TC; si USD, usar el valor directo.
    const fx = currency === 'ARS' ? tc : 1;
    const totalFx = (t.facturacion || sumItems) * fx;
    const totalArsFx = (t.facturacionArs || 0);

    const costHeader = showCosts ? '<th style="text-align: right;">Costo Unit</th>' : '';
    const logoHtml = cfg.logo ? `<img src="${this.esc(cfg.logo)}" style="max-height: 48px; max-width: 160px; object-fit: contain;">` : `<div class="logo">${this.esc(cfg.companyName)}</div>`;
    const cuitHtml = cfg.cuit ? `<div class="meta-item"><label>CUIT</label><span>${this.esc(cfg.cuit)}</span></div>` : '';
    const addrHtml = (cfg.address || cfg.city) ? `<div class="meta-item"><label>Domicilio</label><span>${this.esc([cfg.address, cfg.city].filter(Boolean).join(' - '))}</span></div>` : '';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cotización ${this.esc(number)} - ${this.esc(cfg.companyName)}</title>
      <style>
        @media print { body { -webkit-print-color-adjust: exact; padding: 0; } .no-print { display: none !important; } }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
        .quote-card { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); padding: 40px; border: 1px solid #e2e8f0; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; }
        .logo { font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
        .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
        .quote-title { text-align: right; }
        .quote-title h1 { margin: 0; font-size: 22px; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; }
        .quote-title p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; }
        .meta-item label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px; }
        .meta-item span { font-weight: 600; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #f8fafc; color: #475569; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .totals-box { width: 340px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #334155; }
        .total-row.grand { font-size: 18px; font-weight: 800; color: #059669; border-top: 2px dashed #cbd5e1; margin-top: 8px; padding-top: 10px; }
        .conditions { font-size: 12px; color: #475569; background: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; white-space: pre-line; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="no-print" style="max-width: 900px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <button onclick="window.close()" style="padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">← Volver a la App</button>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 14px;">Imprimir / Guardar PDF</button>
        </div>
      </div>
      <div class="quote-card">
        <div class="header">
          <div>${logoHtml}<div class="subtitle">Gestión de Catálogos & Presupuestos Mayoristas</div></div>
          <div class="quote-title"><h1>COTIZACIÓN</h1><p>Ref: ${this.esc(number)}</p></div>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><label>Fecha de emisión</label><span>${dateStr}</span></div>
          <div class="meta-item"><label>Cliente</label><span>${this.esc(clientName)}</span></div>
          <div class="meta-item"><label>Emitido por</label><span>${this.esc(cfg.sellerName || cfg.companyName)}</span></div>
          <div class="meta-item"><label>Referencia</label><span>${this.esc(pedido.name || number)}</span></div>
          ${cuitHtml}${addrHtml}
          <div class="meta-item"><label>Tipo de Cambio</label><span>${currency === 'ARS' ? '$' + tc + ' ARS / USD' : 'USD'}</span></div>
          <div class="meta-item"><label>Vigencia</label><span>${validity} días hábiles</span></div>
        </div>
        <table>
          <thead><tr>
            <th style="width: 30px;">#</th><th style="width: 40px; text-align: center;">Foto</th><th>SKU</th><th>Marca</th><th>Modelo</th><th>Variante</th>
            <th style="text-align: center;">Cant.</th>${costHeader}<th style="text-align: right;">P. Unit (${currency})</th><th style="text-align: right;">Subtotal (${currency})</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="conditions"><strong>Condiciones:</strong>\n${this.esc(cfg.conditions)}</div>
        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row"><span>Subtotal ${currency}:</span><span>${QuoteGenerator.formatCurrency(totalFx, { currency })}</span></div>
            ${currency === 'ARS' ? `<div class="total-row"><span>Equivalente USD:</span><span>${QuoteGenerator.formatCurrency(t.facturacion || sumItems, { currency: 'USD' })}</span></div>` : `<div class="total-row"><span>Equivalente ARS:</span><span>${QuoteGenerator.formatCurrency(totalArsFx, { currency: 'ARS' })}</span></div>`}
            <div class="total-row grand"><span>TOTAL FINAL:</span><span>${QuoteGenerator.formatCurrency(totalFx, { currency })}</span></div>
          </div>
        </div>
        <div class="footer">${this.esc(cfg.footer)}</div>
      </div>
    </body>
    </html>`;

    // Guardar en historial
    QuoteGenerator.saveToHistory({
      number, clientName, date: new Date().toISOString(),
      currency, total: totalFx, items: pedido.items.length, qty: t.qty || 0
    });

    const win = window.open('', '_blank');
    if (win) { win.document.write(htmlContent); win.document.close(); }
    else if (typeof toast === 'function') toast('Permití las ventanas emergentes para abrir la cotización', 'warning');
  },

  // Exporta los ítems del pedido a CSV descargable.
  exportCsv(pedido, config = {}) {
    if (!pedido || !pedido.items || !pedido.items.length) {
      if (typeof toast === 'function') toast('No hay productos en el pedido para exportar', 'error');
      return;
    }
    const cfg = Object.assign(QuoteGenerator.getConfig(), config);
    const currency = cfg.currency || 'USD';
    const rows = [['#', 'SKU', 'Marca', 'Modelo', 'Variante', 'Cant', `P.Unit(${currency})`, `Subtotal(${currency})`]];
    pedido.items.forEach((it, i) => {
      const pvpU = it.pvp || it.fob || 0;
      rows.push([i + 1, it.sku, it.marca, it.modelo, it.color || it.variante || '', it.qty, pvpU.toFixed(2), (pvpU * (it.qty || 1)).toFixed(2)]);
    });
    const t = pedido.totals || {};
    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', t.qty || 0, '', (t.facturacion || 0).toFixed(2)]);
    const csv = rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cotizacion-${QuoteGenerator.nextNumber()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    QuoteGenerator.saveToHistory({ number: 'CSV', clientName: cfg.clientName || 'Cliente', date: new Date().toISOString(), currency, total: t.facturacion || 0, items: pedido.items.length });
  },

  // ---- Modal de configuración ----
  openConfig(clientName) {
    const cfg = QuoteGenerator.getConfig();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
    set('qcCompany', cfg.companyName); set('qcCuit', cfg.cuit); set('qcAddress', cfg.address);
    set('qcCity', cfg.city); set('qcClient', clientName || cfg.clientName || 'Cliente Mayorista');
    set('qcValidity', cfg.validityDays || 5); set('qcConditions', cfg.conditions);
    const cur = document.getElementById('qcCurrency'); if (cur) cur.value = cfg.currency || 'USD';
    const sc = document.getElementById('qcShowCosts'); if (sc) sc.checked = !!cfg.showCosts;
    const m = document.getElementById('quoteConfigModal'); if (m) m.style.display = 'flex';
  },

  closeConfig() {
    const m = document.getElementById('quoteConfigModal'); if (m) m.style.display = 'none';
  },

  // Lee el modal, guarda la config y genera la cotización en la moneda elegida.
  saveConfigFromModal() {
    const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const cfg = QuoteGenerator.getConfig();
    cfg.companyName = g('qcCompany') || cfg.companyName;
    cfg.cuit = g('qcCuit'); cfg.address = g('qcAddress'); cfg.city = g('qcCity');
    cfg.clientName = g('qcClient'); cfg.validityDays = parseInt(g('qcValidity'), 10) || 5;
    cfg.conditions = g('qcConditions') || cfg.conditions;
    const cur = document.getElementById('qcCurrency'); if (cur) cfg.currency = cur.value;
    const sc = document.getElementById('qcShowCosts'); if (sc) cfg.showCosts = sc.checked;
    QuoteGenerator.saveConfig(cfg);
    QuoteGenerator.closeConfig();
    QuoteGenerator.generatePrintableQuote(currentPedido, cfg, { currency: cfg.currency });
  }
};

if (typeof window !== 'undefined') window.QuoteGenerator = QuoteGenerator;
if (typeof module !== 'undefined') module.exports = QuoteGenerator;