// ============================================
// Mambo Pedidos - History View Module
// Save, render, load, clone, copy, delete orders
// ============================================

const HistoryView = {
  async save() {
    if (!currentPedido || !currentPedido.items.length) { toast('No hay pedido', 'error'); return; }

    const validation = Validations.validateOrder({ items: currentPedido.items });
    if (!validation.valid) {
      showValidationPanel(validation.errors, validation.warnings);
      toast('Hay errores que corregir antes de guardar', 'error');
      return;
    }

    currentPedido.name = document.getElementById('pedidoName').value || 'Pedido sin nombre';
    currentPedido.costs = getCostInputs();
    currentPedido.date = new Date().toISOString();

    const res = Calculator.calculateOrder(currentPedido.items, currentPedido.costs);
    currentPedido.totals = res.totals;

    const list = await AppStorage.loadHistorial();
    list.unshift({ ...currentPedido });
    await AppStorage.saveHistorial(list);
    toast(currentPedido.name + ' guardado', 'success');
    updateBadges();
    hideValidationPanel();
    switchView('historial');
  },

  async render() {
    const list = await AppStorage.loadHistorial();
    const cont = document.getElementById('historialList');
    document.getElementById('historialSubtitle').textContent = list.length + ' pedido' + (list.length !== 1 ? 's' : '') + ' guardado' + (list.length !== 1 ? 's' : '');
    if (!list.length) {
      cont.innerHTML = '<div class="card"><div class="empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg></div><div class="empty-title">Sin pedidos guardados</div><div class="empty-sub">Armá un pedido desde el catálogo y hacé click en "Guardar en historial".</div></div></div>';
      return;
    }
    let html = '';
    list.forEach((p, i) => {
      const t = p.totals || {};
      const date = new Date(p.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
      html += '<div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">';
      html += '<div><div class="card-title">' + esc(p.name) + '</div><div class="card-sub">' + (p.items ? p.items.length : 0) + ' SKUs · ' + (t.qty || 0) + ' unidades · ' + date + '</div></div>';
      html += '<div class="row" style="gap: 24px;">';
      html += '<div><div class="stat-label">FOB</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px;">$' + (t.fob || 0).toFixed(0) + '</div></div>';
      html += '<div><div class="stat-label">Costo</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--blue);">$' + (t.costo || 0).toFixed(0) + '</div></div>';
      html += '<div><div class="stat-label">Fact</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--primary);">$' + (t.facturacion || t.fact || 0).toFixed(0) + '</div></div>';
      html += '<div><div class="stat-label">Margen</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--green);">$' + (t.margen || 0).toFixed(0) + '</div></div>';
      html += '</div>';
      html += '<div class="row" style="gap: 8px;">';
      html += '<button class="btn btn-primary btn-sm" onclick="loadFromHistorial(' + i + ')">Abrir</button>';
      html += '<button class="btn btn-secondary btn-sm" onclick="clonarPedido(' + i + ')" title="Clonar este pedido como nuevo"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Clonar</button>';
      html += '<button class="btn btn-secondary btn-sm" onclick="copiarResumenPedido(' + i + ')" title="Copiar resumen al portapapeles"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copiar</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="deleteFromHistorial(' + i + ')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>';
      html += '</div></div>';
    });
    cont.innerHTML = html;
  },

  async load(idx) {
    const list = await AppStorage.loadHistorial();
    currentPedido = list[idx];
    switchView('pedido');
    renderPedido();
    toast('Pedido cargado', 'info');
  },

  async clone(index) {
    const historial = await AppStorage.loadHistorial();
    if (!historial[index]) return;
    const p = historial[index];
    selection = {};
    p.items.forEach(it => {
      selection[it.sku] = it.qty;
    });

    currentPedido = JSON.parse(JSON.stringify(p));
    currentPedido.name = p.name + ' (Copia)';
    currentPedido.date = new Date().toISOString();

    switchView('pedido');
    renderPedido();
    toast('Pedido clonado exitosamente', 'success');
  },

  async copySummary(index) {
    const historial = await AppStorage.loadHistorial();
    if (!historial[index]) return;
    const p = historial[index];
    const t = p.totals || {};
    let txt = `${p.name}\n`;
    txt += `Fecha: ${new Date(p.date).toLocaleDateString('es-AR')}\n`;
    txt += `------------------------------\n`;
    p.items.forEach(it => {
      txt += `• ${it.qty}x ${it.marca} ${it.modelo} (${it.sku}) - PVP: $${(it.pvp || 0).toLocaleString()}\n`;
    });
    txt += `------------------------------\n`;
    txt += `FOB Total: $${(t.fob || 0).toLocaleString()} USD\n`;
    txt += `Costo Puesto en País: $${(t.costo || 0).toLocaleString()} USD\n`;
    txt += `IVA separado: $${(t.ivaUsd || 0).toLocaleString()} USD / ARS $${(t.ivaArs || 0).toLocaleString()}\n`;
    txt += `Costo bruto con IVA: $${(t.totalBrutoConIva || t.costo || 0).toLocaleString()} USD\n`;
    txt += `Facturación Proyectada: $${(t.facturacion || 0).toLocaleString()} USD\n`;
    txt += `Ganancia Neta: $${(t.margen || 0).toLocaleString()} USD (${t.margenPct || 0}%)\n`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        toast('Resumen copiado al portapapeles', 'success');
      });
    } else {
      toast('Resumen generado en la consola', 'info');
      console.log(txt);
    }
  },

  async remove(idx) {
    const before = await AppStorage.loadHistorial();
    const pedido = before[idx];
    if (!pedido) return;
    const ok = await showConfirm({ title: 'Borrar pedido', message: '¿Borrar <strong>' + esc(pedido.name) + '</strong>?', confirmText: 'Borrar', danger: true });
    if (!ok) return;
    const list = await AppStorage.loadHistorial();
    list.splice(idx, 1);
    await AppStorage.saveHistorial(list);
    this.render();
    updateBadges();
    toastUndo('Pedido "' + pedido.name + '" borrado', async () => {
      const l = await AppStorage.loadHistorial();
      l.splice(idx, 0, pedido);
      await AppStorage.saveHistorial(l);
      HistoryView.render();
      updateBadges();
    });
  }
};

// Browser-global bridge: keep existing onclick names working
if (typeof window !== 'undefined') {
  window.HistoryView = HistoryView;
  window.saveToHistorial = () => HistoryView.save();
  window.renderHistorial = () => HistoryView.render();
  window.loadFromHistorial = (idx) => HistoryView.load(idx);
  window.clonarPedido = (i) => HistoryView.clone(i);
  window.copiarResumenPedido = (i) => HistoryView.copySummary(i);
  window.deleteFromHistorial = (idx) => HistoryView.remove(idx);
}
if (typeof module !== 'undefined') module.exports = HistoryView;
