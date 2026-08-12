// ============================================
//  Mambo Pedidos - Import Tracker View (Dashboard)
//  Renders import records grouped by status: dates,
//  courier, final cost, ROI, empty state.
//  Follows the historyView.js render pattern.
// ============================================

const ImportsView = {
  // Status board order (spec: ordered → in_transit → in_customs → cleared → delivered, + cancelled)
  STATUS_ORDER: ['ordered', 'in_transit', 'in_customs', 'cleared', 'delivered', 'cancelled'],
  STATUS_LABELS: {
    ordered: 'Pedido',
    in_transit: 'En tránsito',
    in_customs: 'En aduana',
    cleared: 'Liberado',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  },

  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  },

  _fmtUsd(n) {
    return '$' + (Number.isFinite(n) ? n : 0).toFixed(0) + ' USD';
  },

  // Última fecha relevante: fecha del estado actual si existe, si no la del pedido.
  _statusDate(record) {
    if (record.status !== 'ordered' && record.dates && record.dates[record.status]) {
      return record.dates[record.status];
    }
    return record.dates && record.dates.ordered ? record.dates.ordered : null;
  },

  _recordHtml(record) {
    const profit = ImportsTracker.computeProfitability(record);
    const roi = profit.available ? profit.roiPct.toFixed(0) + '%' : '—';
    const courier = record.courier || '—';
    const date = this._fmtDate(this._statusDate(record));

    return '<div class="card">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">' +
        '<div>' +
          '<div class="card-title"><span class="badge">' + esc(record.number || '') + '</span> ' + esc(record.description || '') + '</div>' +
          '<div class="card-sub">' + esc(record.supplier || '') + ' · ' + esc(courier) + ' · ' + date + '</div>' +
        '</div>' +
        '<div class="row" style="gap: 24px;">' +
          '<div><div class="stat-label">Costo final</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px;">' + this._fmtUsd(record.finalLandedCostUsd) + '</div></div>' +
          '<div><div class="stat-label">ROI</div><div style="font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--primary);">' + roi + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  },

  async render() {
    const payload = await AppStorage.loadImports();
    const records = payload && Array.isArray(payload.records) ? payload.records : [];
    const cont = document.getElementById('importsList');
    const subtitle = document.getElementById('importsSubtitle');

    if (subtitle) {
      subtitle.textContent = records.length + (records.length === 1 ? ' importación' : ' importaciones');
    }
    if (!cont) return;

    if (!records.length) {
      cont.innerHTML = '<div class="card"><div class="empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg></div><div class="empty-title">Sin importaciones registradas</div><div class="empty-sub">Las importaciones que guardes aparecerán acá, agrupadas por estado.</div></div></div>';
      return;
    }

    const rollups = ImportsTracker.computeRollups(records);
    let html = '<div class="stats">' +
      '<div class="stat"><div class="stat-label">Invertido</div><div class="stat-value">' + this._fmtUsd(rollups.totalInvestedUsd) + '</div><div class="stat-sub">Costo final acumulado</div></div>' +
      '<div class="stat"><div class="stat-label">Ganancia</div><div class="stat-value">' + this._fmtUsd(rollups.totalProfitUsd) + '</div><div class="stat-sub">Vs. precio local</div></div>' +
      '<div class="stat"><div class="stat-label">Activas</div><div class="stat-value">' + rollups.activeCount + '</div><div class="stat-sub">En curso</div></div>' +
    '</div>';

    for (const status of this.STATUS_ORDER) {
      const group = records.filter(r => r.status === status);
      if (!group.length) continue;
      html += '<div class="imp-group" data-status="' + status + '">';
      html += '<div style="display: flex; align-items: center; gap: 10px; margin: 18px 0 10px;">' +
        '<span class="badge">' + group.length + '</span>' +
        '<span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em;">' + (this.STATUS_LABELS[status] || status) + '</span>' +
      '</div>';
      group.forEach(r => { html += this._recordHtml(r); });
      html += '</div>';
    }
    cont.innerHTML = html;
  }
};

// Browser-global bridge: keep existing onclick names working
if (typeof window !== 'undefined') {
  window.ImportsView = ImportsView;
  window.renderImportaciones = () => ImportsView.render();
}
if (typeof module !== 'undefined') module.exports = ImportsView;
