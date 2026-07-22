// ============================================
//  Mambo Pedidos - Módulo de Generación de Cotizaciones Comerciales en PDF
//  Exporta presupuestos formales para clientes con membrete, precios PVP y totales
//  Desarrollado por @geto_dev
// ============================================

const QuoteGenerator = {

  // Genera un documento HTML imprimible/convertible a PDF
  generatePrintableQuote(pedido, companyInfo = {}) {
    if (!pedido || !pedido.items || !pedido.items.length) {
      if (typeof toast === 'function') toast('No hay productos en el pedido para cotizar', 'error');
      return;
    }

    const t = pedido.totals || {};
    const dateStr = new Date(pedido.date || Date.now()).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const clientName = companyInfo.clientName || 'Cliente Mayorista';
    const companyName = companyInfo.companyName || 'Mambo Pedidos';
    const sellerName = companyInfo.sellerName || '@geto_dev';

    let itemsHtml = '';
    pedido.items.forEach((item, i) => {
      const pvpU = item.pvp || item.fob || 0;
      const sub = item.subPvp || (pvpU * item.qty);
      const pvpArs = item.pvpArs || Math.round(pvpU * (t.tipoCambio || 1400));
      const subArs = Math.round(sub * (t.tipoCambio || 1400));
      const imgCell = item.img ? `<img src="${item.img}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1;">` : `<span style="color: #cbd5e1;">🖼️</span>`;

      itemsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-family: monospace; font-size: 11px; color: #64748b;">${i + 1}</td>
          <td style="padding: 8px; text-align: center;">${imgCell}</td>
          <td style="padding: 8px; font-weight: 600; color: #1e293b;">${this.esc(item.sku)}</td>
          <td style="padding: 8px; color: #334155;">${this.esc(item.marca)}</td>
          <td style="padding: 8px; color: #0f172a; font-weight: 600;">${this.esc(item.modelo)}</td>
          <td style="padding: 8px; color: #64748b;">${this.esc(item.color || item.variante || '-')}</td>
          <td style="padding: 8px; text-align: center; font-weight: 700; color: #6366f1;">${item.qty}</td>
          <td style="padding: 8px; text-align: right; font-family: monospace;">$${pvpU.toFixed(2)} USD</td>
          <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 700; color: #059669;">$${sub.toLocaleString(undefined, {minimumFractionDigits: 2})} USD</td>
        </tr>
      `;
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cotización - ${this.esc(pedido.name)}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; padding: 0; }
          .no-print { display: none !important; }
        }
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
        .totals-box { width: 320px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #334155; }
        .total-row.grand { font-size: 18px; font-weight: 800; color: #059669; border-top: 2px dashed #cbd5e1; margin-top: 8px; padding-top: 10px; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 40px; }
      </style>
    </head>
    <body>

      <div class="no-print" style="max-width: 900px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center;">
        <button onclick="window.close()" style="padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">← Volver a la App</button>
        <button onclick="window.print()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 14px;">🖨️ Imprimir / Guardar como PDF</button>
      </div>

      <div class="quote-card">
        <div class="header">
          <div>
            <div class="logo">⚡ ${this.esc(companyName)}</div>
            <div class="subtitle">Gestión de Catálogos & Presupuestos Mayoristas</div>
          </div>
          <div class="quote-title">
            <h1>COTIZACIÓN</h1>
            <p>Ref: ${this.esc(pedido.name)}</p>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>Fecha de emisión</label>
            <span>${dateStr}</span>
          </div>
          <div class="meta-item">
            <label>Cliente</label>
            <span>${this.esc(clientName)}</span>
          </div>
          <div class="meta-item">
            <label>Emitido por</label>
            <span>${this.esc(sellerName)}</span>
          </div>
          <div class="meta-item">
            <label>Tipo de Cambio</label>
            <span>$${t.tipoCambio || 1400} ARS / USD</span>
          </div>
          <div class="meta-item">
            <label>Total Ítems</label>
            <span>${pedido.items.length} SKUs (${t.qty || 0} unidades)</span>
          </div>
          <div class="meta-item">
            <label>Validez</label>
            <span>5 Días Hábiles</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 40px; text-align: center;">Foto</th>
              <th>SKU</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Variante</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">Precio Unit (USD)</th>
              <th style="text-align: right;">Subtotal (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal USD:</span>
              <span>$${(t.facturacion || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="total-row">
              <span>Equivalente ARS:</span>
              <span>$${(t.facturacionArs || 0).toLocaleString()} ARS</span>
            </div>
            <div class="total-row grand">
              <span>TOTAL FINAL:</span>
              <span>$${(t.facturacion || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} USD</span>
            </div>
          </div>
        </div>

        <div class="footer">
          Documento generado automáticamente por <strong>Mambo Pedidos</strong> · Desarrollado por @geto_dev
        </div>
      </div>

    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
    } else {
      if (typeof toast === 'function') toast('Permití las ventanas emergentes para abrir la cotización', 'warning');
    }
  },

  esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};

window.QuoteGenerator = QuoteGenerator;
