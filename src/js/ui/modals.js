// ============================================
// Mambo Pedidos - UI Modals Module
// Image zoom, supplier compare, sensitivity simulator,
// break-even, door-to-door, image upload/clean, brand manager
// ============================================

const UIModals = {
  activeZoomSku: null,

  // --- Image Zoom ---

  async zoomImage(sku) {
    UIModals.activeZoomSku = sku;
    const item = catalog.find(r => r.sku === sku);
    if (item) {
      // Mem (import-2026): item.img es un thumbnail; el zoom muestra la imagen
      // COMPLETA desde el archivo (loadFullImage) cuando existe.
      const full = (typeof AppStorage !== 'undefined' && typeof AppStorage.loadFullImage === 'function')
        ? await AppStorage.loadFullImage(item)
        : null;
      UIModals.zoomImageByUrl(full || (hasCatalogImage(item.img) ? item.img : ''), `${item.marca} ${item.modelo} (${item.sku})`);
    }
  },

  zoomImageByUrl(url, caption) {
    const modal = document.getElementById('imageZoomModal');
    const srcEl = document.getElementById('imageZoomSrc');
    const capEl = document.getElementById('imageZoomCaption');

    const fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e1e2d"/><rect x="50" y="55" width="100" height="90" rx="10" fill="none" stroke="#64748b" stroke-width="5"/><circle cx="78" cy="82" r="9" fill="#64748b"/><path d="M60 135 L95 100 L120 122 L135 108 L142 135" fill="none" stroke="#64748b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    if (srcEl) srcEl.src = url || fallbackSvg;
    if (capEl) capEl.textContent = caption || '';
    if (modal) modal.style.display = 'flex';
  },

  closeImageZoomModal() {
    const modal = document.getElementById('imageZoomModal');
    if (modal) modal.style.display = 'none';
    UIModals.activeZoomSku = null;
  },

  triggerImageUpload() {
    const input = document.getElementById('productImageFileInput');
    if (input) input.click();
  },

  // --- Supplier Compare ---

  openSupplierCompareModal() {
    const modal = document.getElementById('supplierCompareModal');
    const body = document.getElementById('supplierCompareBody');
    if (!modal || !body) return;

    const grouped = {};
    catalog.forEach(item => {
      const key = (item.modelo || '').toLowerCase().trim();
      if (!key || key.length < 3) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const comparisons = Object.entries(grouped).filter(([k, list]) => list.length > 1);

    if (!comparisons.length) {
      body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-3);">
        <div style="margin-bottom: 12px; color: var(--text-dim);"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg></div>
        <div style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px;">Sin productos coincidentes para comparar</div>
        <div style="font-size: 13px; color: var(--text-muted);">Cargá catálogos de 2 o más proveedores diferentes para detectar automáticamente diferencias de precios FOB en los mismos modelos.</div>
      </div>
    `;
    } else {
      let html = '';
      comparisons.forEach(([modelKey, list]) => {
        list.sort((a, b) => a.fob - b.fob);
        const minFob = list[0].fob;
        const maxFob = list[list.length - 1].fob;
        const diffFob = maxFob - minFob;
        const diffPct = minFob > 0 ? ((diffFob / minFob) * 100).toFixed(1) : 0;

        html += `<div class="card" style="margin-bottom: 16px; border: 1px solid var(--border); padding: 16px;">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">`;
        html += `<div style="font-weight: 800; font-size: 15px; color: #fff;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg> ${esc(list[0].modelo)}</div>`;
        html += `<div style="font-size: 12px; color: #34d399; font-weight: 700; background: rgba(16,185,129,0.15); padding: 4px 10px; border-radius: 20px;">Ahorro máximo: $${diffFob.toFixed(2)} USD (${diffPct}%)</div>`;
        html += `</div>`;

        html += `<table class="data-table">`;
        html += `<thead><tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);"><th style="padding: 6px;">Proveedor / Marca</th><th style="padding: 6px;">SKU</th><th style="padding: 6px;">Categoría</th><th style="padding: 6px; text-align: right;">FOB Unit (USD)</th><th style="padding: 6px; text-align: center;">Estado</th></tr></thead>`;
        html += `<tbody>`;

        list.forEach((item, idx) => {
          const isBest = idx === 0;
          html += `<tr style="border-bottom: 1px solid var(--border); ${isBest ? 'background: rgba(16,185,129,0.08);' : ''}">`;
          html += `<td style="padding: 8px; font-weight: 700; color: #fff;">${esc(item.marca)}</td>`;
          html += `<td style="padding: 8px; font-family: monospace; color: var(--text-muted);">${esc(item.sku)}</td>`;
          html += `<td style="padding: 8px; color: var(--text-muted);">${esc(item.cat)}</td>`;
          html += `<td style="padding: 8px; text-align: right; font-weight: 800; color: ${isBest ? '#34d399' : '#f87171'};">$${item.fob.toFixed(2)}</td>`;
          html += `<td style="padding: 8px; text-align: center;">${isBest ? '<span style="font-size: 11px; font-weight: 800; color: #34d399; background: rgba(16,185,129,0.2); padding: 2px 8px; border-radius: 12px;">MEJOR PRECIO</span>' : '<span style="font-size: 11px; color: var(--text-muted);">+$' + (item.fob - minFob).toFixed(2) + '</span>'}</td>`;
          html += `</tr>`;
        });

        html += `</tbody></table></div>`;
      });
      body.innerHTML = html;
    }
    modal.style.display = 'flex';
  },

  closeSupplierCompareModal() {
    const modal = document.getElementById('supplierCompareModal');
    if (modal) modal.style.display = 'none';
  },

  // --- Sensitivity Simulator ---

  openSensitivitySimulatorModal() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) {
      toast('Armá o abrí un pedido para usar el simulador', 'error');
      return;
    }

    const modal = document.getElementById('sensitivitySimulatorModal');
    const tcInput = document.getElementById('cTasaCambio');
    const simTcRange = document.getElementById('simTcRange');

    if (tcInput && simTcRange) {
      simTcRange.value = parseFloat(tcInput.value) || 1400;
    }

    if (modal) modal.style.display = 'flex';
    UIModals.runSensitivitySimulation();
  },

  closeSensitivitySimulatorModal() {
    const modal = document.getElementById('sensitivitySimulatorModal');
    if (modal) modal.style.display = 'none';
  },

  runSensitivitySimulation() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) return;

    const tcRange = parseFloat(document.getElementById('simTcRange')?.value) || 1400;
    const fleteRange = parseFloat(document.getElementById('simFleteRange')?.value) || 0;
    const margenRange = parseFloat(document.getElementById('simMargenRange')?.value) || 35;

    if (document.getElementById('simTcVal')) document.getElementById('simTcVal').textContent = `$${tcRange} ARS`;
    if (document.getElementById('simFleteVal')) document.getElementById('simFleteVal').textContent = `${fleteRange > 0 ? '+' : ''}${fleteRange}%`;
    if (document.getElementById('simMargenVal')) document.getElementById('simMargenVal').textContent = `${margenRange}%`;

    const origCosts = getCostInputs();
    const simCosts = { ...origCosts }; // shallow copy — getCostInputs() outputs primitives

    simCosts.tipoCambio = tcRange;
    simCosts.flete = parseFloat(origCosts.flete || 15) * (1 + (fleteRange / 100));

    const origRes = Calculator.calculateOrder(currentPedido.items, origCosts);
    const simRes = Calculator.calculateOrder(currentPedido.items, simCosts);

    const origT = origRes.totals;
    const simT = simRes.totals;

    const targetMultiplier = 1 / (1 - (margenRange / 100));
    const simTargetFactUsd = simT.costo * targetMultiplier;
    const simTargetMargenUsd = simTargetFactUsd - simT.costo;
    const simTargetFactArs = simTargetFactUsd * tcRange;

    const diffCostoUsd = simT.costo - origT.costo;

    const body = document.getElementById('simResultsBody');
    if (!body) return;

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Costo Puesto Simulado</div>
    <div class="kpi-mini-value val-blue">$${Math.round(simT.costo).toLocaleString()} USD</div>
    <div class="kpi-mini-sub ${diffCostoUsd >= 0 ? 'val-red' : 'val-green'}">${diffCostoUsd >= 0 ? '+' : ''}$${Math.round(diffCostoUsd).toLocaleString()} USD vs actual</div>
  </div>`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Facturación Objetivo</div>
    <div class="kpi-mini-value val-accent">$${Math.round(simTargetFactUsd).toLocaleString()} USD</div>
    <div class="kpi-mini-sub">ARS $${Math.round(simTargetFactArs).toLocaleString()}</div>
  </div>`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Ganancia Limpia Objetivo</div>
    <div class="kpi-mini-value val-green">$${Math.round(simTargetMargenUsd).toLocaleString()} USD</div>
    <div class="kpi-mini-sub val-green">${margenRange}% margen neto sobre venta</div>
  </div>`;

    html += `</div>`;

    html += `<div class="modal-section-title">PVP Sugerido por Producto para asegurar ${margenRange}% de Ganancia Neta</div>`;
    html += `<table class="data-table">`;
    html += `<thead><tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);"><th style="padding: 6px;">SKU</th><th style="padding: 6px;">Producto</th><th style="padding: 6px; text-align: right;">Costo Sim. (USD)</th><th style="padding: 6px; text-align: right;">PVP Sugerido (USD)</th><th style="padding: 6px; text-align: right;">PVP Sugerido (ARS)</th></tr></thead><tbody>`;

    currentPedido.items.forEach(r => {
      const itemUnitCost = (simT.costo / (origT.fob || 1)) * r.fob;
      const itemPvpUsd = itemUnitCost * targetMultiplier;
      const itemPvpArs = Math.round(itemPvpUsd * tcRange);

      html += `<tr style="border-bottom: 1px solid var(--border);">`;
      html += `<td style="padding: 6px; font-family: monospace; color: var(--text-muted);">${esc(r.sku)}</td>`;
      html += `<td style="padding: 6px; font-weight: 600; color: #fff;">${esc(r.marca)} ${esc(r.modelo)}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #38bdf8;">$${itemUnitCost.toFixed(2)}</td>`;
      html += `<td style="padding: 6px; text-align: right; font-weight: 700; color: #34d399;">$${itemPvpUsd.toFixed(2)}</td>`;
      html += `<td style="padding: 6px; text-align: right; font-weight: 700; color: var(--accent);">$${itemPvpArs.toLocaleString()} ARS</td>`;
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
  },

  // --- Break-Even ---

  openBreakEvenModal() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) {
      toast('Armá o abrí un pedido para calcular el punto de equilibrio', 'error');
      return;
    }
    const modal = document.getElementById('breakEvenModal');
    if (modal) modal.style.display = 'flex';
    UIModals.runBreakEvenCalculation();
  },

  closeBreakEvenModal() {
    const modal = document.getElementById('breakEvenModal');
    if (modal) modal.style.display = 'none';
  },

  runBreakEvenCalculation() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) return;

    const alquiler = parseFloat(document.getElementById('beAlquiler')?.value) || 0;
    const sueldos = parseFloat(document.getElementById('beSueldos')?.value) || 0;
    const servicios = parseFloat(document.getElementById('beServicios')?.value) || 0;
    const publicidad = parseFloat(document.getElementById('bePublicidad')?.value) || 0;

    const totalFixedCostsUsd = alquiler + sueldos + servicios + publicidad;

    const t = currentPedido.totals || {};
    const totalQty = currentPedido.items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const netProfitUsd = t.margen || 0;
    const avgProfitPerUnitUsd = totalQty > 0 ? (netProfitUsd / totalQty) : 0;

    const unitsNeeded = avgProfitPerUnitUsd > 0 ? Math.ceil(totalFixedCostsUsd / avgProfitPerUnitUsd) : 0;
    const totalFactNeededUsd = unitsNeeded * (totalQty > 0 ? (t.facturacion / totalQty) : 0);

    const tc = parseFloat(document.getElementById('cTasaCambio')?.value) || 1400;

    const body = document.getElementById('breakEvenResultsBody');
    if (!body) return;

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px; margin-bottom: 20px;">`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Gastos Fijos Mensuales</div>
    <div class="kpi-mini-value val-red">$${totalFixedCostsUsd.toLocaleString()} USD</div>
    <div class="kpi-mini-sub">ARS $${Math.round(totalFixedCostsUsd * tc).toLocaleString()}</div>
  </div>`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Ganancia Limpia / Unidad</div>
    <div class="kpi-mini-value val-green">$${avgProfitPerUnitUsd.toFixed(2)} USD</div>
    <div class="kpi-mini-sub">Margen promedio por producto</div>
  </div>`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Unidades para Equilibrio</div>
    <div class="kpi-mini-value val-blue">${unitsNeeded} unidades</div>
    <div class="kpi-mini-sub val-green">Punto de Equilibrio (0% pérdida)</div>
  </div>`;

    html += `</div>`;

    html += `<div class="card" style="padding: 14px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px;">`;
    html += `<div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 4px;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Resumen de Operación</div>`;
    html += `<div style="font-size: 13px; color: var(--text-muted);">Para cubrir tus <strong>$${totalFixedCostsUsd} USD</strong> de gastos fijos este mes, necesitás vender un total de <strong>${unitsNeeded} unidades</strong> (equivalente a una facturación de <strong>$${Math.round(totalFactNeededUsd).toLocaleString()} USD</strong> o <strong>$${Math.round(totalFactNeededUsd * tc).toLocaleString()} ARS</strong>).</div>`;
    html += `</div>`;

    body.innerHTML = html;
  },

  // --- Door-to-Door ---

  openDoorToDoorModal() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) {
      toast('Armá o abrí un pedido para calcular la liquidación Puerta a Puerta', 'error');
      return;
    }
    const modal = document.getElementById('doorToDoorModal');
    if (modal) modal.style.display = 'flex';
    UIModals.runDoorToDoorCalculation();
  },

  closeDoorToDoorModal() {
    const modal = document.getElementById('doorToDoorModal');
    if (modal) modal.style.display = 'none';
  },

  runDoorToDoorCalculation() {
    if (!currentPedido || !currentPedido.items || !currentPedido.items.length) return;

    const tc = parseFloat(document.getElementById('cTasaCambio')?.value) || 1400;
    const pesoKg = parseFloat(document.getElementById('cPesoKg')?.value) || 0;
    const costoPorKg = parseFloat(document.getElementById('cCostoPorKg')?.value) || 12;

    const doorConfig = {
      tipoCambio: tc,
      pesoKg,
      costoPorKg,
      depositoFiscalUsd: parseFloat(document.getElementById('doorDepositoFiscal')?.value) || 150,
      despachanteUsd: parseFloat(document.getElementById('doorDespachante')?.value) || 450,
      fleteInternoUsd: parseFloat(document.getElementById('doorFleteInterno')?.value) || 80,
      simDigitalizacionUsd: parseFloat(document.getElementById('doorSimDigitalizacion')?.value) || 40,
    };

    const res = Calculator.calculateDoorToDoorExactCost(currentPedido.items, doorConfig);
    const s = res.summary;
    const body = document.getElementById('doorToDoorResultsBody');
    if (!body) return;

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px; margin-bottom: 20px;">`;

    html += `<div class="card kpi-mini">
        <div class="kpi-mini-label">Inversión Total CIF ${tip('CIF')} (Mercadería + Flete)</div>
        <div class="kpi-mini-value val-blue">$${Math.round(s.cifTotalUsd).toLocaleString()} USD</div>
        <div class="kpi-mini-sub">FOB $${Math.round(s.fobTotalUsd).toLocaleString()} + Flete $${Math.round(s.fleteTotalUsd).toLocaleString()}</div>
      </div>`;

        html += `<div class="card kpi-mini">
        <div class="kpi-mini-label">Tributos Aduana SIM ${tip('DI')}${tip('TE')} (sin IVA)</div>
    <div class="kpi-mini-value val-yellow">$${Math.round(s.totalTributosAduanaUsd).toLocaleString()} USD</div>
    <div class="kpi-mini-sub">ARS $${Math.round(s.totalTributosAduanaUsd * tc).toLocaleString()}</div>
  </div>`;

    html += `<div class="card kpi-mini is-pink">
    <div class="kpi-mini-label val-pink-soft">IVA separado ${tip('IVA')} / repercutible</div>
    <div class="kpi-mini-value val-pink">$${Math.round(s.totalIvaAduanaUsd || 0).toLocaleString()} USD</div>
    <div class="kpi-mini-sub val-pink-soft">ARS $${Math.round((s.totalIvaAduanaUsd || 0) * tc).toLocaleString()}</div>
  </div>`;

    html += `<div class="card kpi-mini">
    <div class="kpi-mini-label">Despacho, Depósito ${tip('DEPOSITO')} & Certificaciones ${tip('DESPACHANTE')}</div>
    <div class="kpi-mini-value val-indigo">$${Math.round(s.totalGastosFijosDestinoUsd).toLocaleString()} USD</div>
    <div class="kpi-mini-sub">Despachante + TCA + Certs + Acarreo</div>
  </div>`;

    html += `<div class="card kpi-mini is-hero">
        <div class="kpi-mini-label val-green">COSTO NETO PUESTO EN PUERTA</div>
        <div style="font-size: 20px; font-weight: 800; color: #34d399;">$${Math.round(s.totalPuertaUsd).toLocaleString()} USD</div>
        <div style="font-size: 11px; color: #34d399; font-weight: 700;">ARS $${Math.round(s.totalPuertaArs).toLocaleString()} · Bruto con IVA $${Math.round(s.totalPuertaConIvaUsd).toLocaleString()} USD</div>
      </div>`;

        // IT19: costo neto real (deduciendo el crédito fiscal recuperable) vs caja
        const netoReal = s.costoNetoRealUsd || 0;
        const credito = s.totalRecuperableUsd || 0;
        html += `<div class="card kpi-mini">
        <div class="kpi-mini-label val-blue">COSTO NETO REAL ${tip('CRED')} (post crédito fiscal)</div>
        <div class="kpi-mini-value val-blue">$${Math.round(netoReal).toLocaleString()} USD</div>
        <div class="kpi-mini-sub">ARS $${Math.round((s.costoNetoRealArs || 0)).toLocaleString()} — tu costo VERDADERO de la mercadería</div>
      </div>`;
        html += `<div class="card kpi-mini is-green">
        <div class="kpi-mini-label">Crédito fiscal a favor ${tip('CRED')} (recuperable)</div>
        <div class="kpi-mini-value">$${Math.round(credito).toLocaleString()} USD</div>
        <div class="kpi-mini-sub">IVA + IVA adicional + Ganancias + IIBB (pagos a cuenta) — ARS $${Math.round((s.creditoFiscalArs || 0)).toLocaleString()}</div>
      </div>`;

        html += `</div>`;

    if (res.certificationsRequired && res.certificationsRequired.length > 0) {
      html += `<div class="card" style="padding: 14px; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 8px; margin-bottom: 16px;">`;
      html += `<div style="font-weight: 800; font-size: 13px; color: #fde047; margin-bottom: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Trámites Burocráticos & Certificaciones Detectadas (${res.certificationsRequired.length})</div>`;
      res.certificationsRequired.forEach(c => {
        html += `<div style="font-size: 12px; color: #fff; margin-bottom: 4px;">• <strong>${c.title}</strong> (Cost. Est: $${c.costUsd} USD) — ${c.description}</div>`;
      });
      html += `</div>`;
    }

    html += `<div class="modal-section-title">Detalle Exacto por Producto (Posición Arancelaria NCM & Costo Puerta Unitario)</div>`;
    html += `<table class="data-table">`;
    html += `<thead><tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);"><th style="padding: 6px;">SKU</th><th style="padding: 6px;">Producto</th><th style="padding: 6px;">Posición NCM ${tip('NCM')}</th><th style="padding: 6px; text-align: right;">FOB Unit ${tip('FOB')}</th><th style="padding: 6px; text-align: right;">Tributos ${tip('DI')}${tip('TE')}</th><th style="padding: 6px; text-align: right; color: #34d399;">Costo Puerta Unit (USD)</th><th style="padding: 6px; text-align: right; color: var(--accent);">Costo Puerta Unit (ARS)</th></tr></thead><tbody>`;

    res.items.forEach(i => {
      html += `<tr style="border-bottom: 1px solid var(--border);">`;
      html += `<td style="padding: 6px; font-family: monospace; color: var(--text-muted);">${esc(i.sku)}</td>`;
      html += `<td style="padding: 6px; font-weight: 600; color: #fff;">${esc(i.marca)} ${esc(i.modelo)}</td>`;
      html += `<td style="padding: 6px; font-family: monospace; color: #a5b4fc;">${i.ncm}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: var(--text-muted);">$${i.fob.toFixed(2)}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #fde047;">$${(i.qty > 0 ? i.totalTributosItemUsd / i.qty : 0).toFixed(2)}</td>`;
      html += `<td style="padding: 6px; text-align: right; font-weight: 800; color: #34d399;">$${i.costoPuertaUnitUsd.toFixed(2)}</td>`;
      html += `<td style="padding: 6px; text-align: right; font-weight: 800; color: var(--accent);">$${Math.round(i.costoPuertaUnitArs).toLocaleString()} ARS</td>`;
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
  },

  // --- Image Upload / Clean ---

  handleProductImageFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !UIModals.activeZoomSku) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      updateProductImage(UIModals.activeZoomSku, evt.target.result);
    };
    reader.readAsDataURL(file);
  },

  async triggerCleanBackground() {
    if (!UIModals.activeZoomSku) return;
    const item = catalog.find(r => r.sku === UIModals.activeZoomSku);
    // La limpieza de fondo trabaja sobre la imagen COMPLETA (item.img es thumb).
    const full = (typeof AppStorage !== 'undefined' && typeof AppStorage.loadFullImage === 'function')
      ? await AppStorage.loadFullImage(item)
      : null;
    if (!item || !(full || hasCatalogImage(item.img))) { toast('No hay imagen válida para procesar', 'error'); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      if (PdfParser && typeof PdfParser.cleanImageBackground === 'function') {
        PdfParser.cleanImageBackground(ctx, img.width, img.height);
        const cleanUrl = canvas.toDataURL('image/webp', 0.85);
        updateProductImage(UIModals.activeZoomSku, cleanUrl);
        toast('Fondo limpiado exitosamente', 'success');
      }
    };
    img.src = full || item.img;
  },

  // --- Brand Manager ---

  async openBrandManagerModal() {
    customBrandsList = await AppStorage.loadBrands();
    renderBrandList();
    const m = document.getElementById('brandManagerModal');
    if (m) m.style.display = 'flex';
  },

  closeBrandManagerModal() {
    const m = document.getElementById('brandManagerModal');
    if (m) m.style.display = 'none';
  },

  async addCustomBrand() {
    const nameInput = document.getElementById('newBrandName');
    const patInput = document.getElementById('newBrandPattern');
    const name = (nameInput?.value || '').trim();
    const pattern = (patInput?.value || '').trim() || name.toLowerCase();

    if (!name) {
      toast('Ingresá el nombre de la marca', 'error');
      return;
    }

    customBrandsList = customBrandsList.filter(b => b.name.toLowerCase() !== name.toLowerCase());
    customBrandsList.push({ name, pattern });
    await AppStorage.saveBrands(customBrandsList);

    if (nameInput) nameInput.value = '';
    if (patInput) patInput.value = '';
    renderBrandList();
    toast(`Marca "${name}" guardada en el diccionario`, 'success');
  },

  async deleteCustomBrand(idx) {
    customBrandsList.splice(idx, 1);
    await AppStorage.saveBrands(customBrandsList);
    renderBrandList();
    toast('Marca eliminada del diccionario', 'info');
  }
};

// Browser-global bridge: keep existing function names working
if (typeof window !== 'undefined') {
  window.UIModals = UIModals;
  window.zoomImage = (sku) => UIModals.zoomImage(sku);
  window.zoomImageByUrl = (url, caption) => UIModals.zoomImageByUrl(url, caption);
  window.closeImageZoomModal = () => UIModals.closeImageZoomModal();
  window.triggerImageUpload = () => UIModals.triggerImageUpload();
  window.openSupplierCompareModal = () => UIModals.openSupplierCompareModal();
  window.closeSupplierCompareModal = () => UIModals.closeSupplierCompareModal();
  window.openSensitivitySimulatorModal = () => UIModals.openSensitivitySimulatorModal();
  window.closeSensitivitySimulatorModal = () => UIModals.closeSensitivitySimulatorModal();
  window.runSensitivitySimulation = () => UIModals.runSensitivitySimulation();
  window.openBreakEvenModal = () => UIModals.openBreakEvenModal();
  window.closeBreakEvenModal = () => UIModals.closeBreakEvenModal();
  window.runBreakEvenCalculation = () => UIModals.runBreakEvenCalculation();
  window.openDoorToDoorModal = () => UIModals.openDoorToDoorModal();
  window.closeDoorToDoorModal = () => UIModals.closeDoorToDoorModal();
  window.runDoorToDoorCalculation = () => UIModals.runDoorToDoorCalculation();
  window.handleProductImageFile = (e) => UIModals.handleProductImageFile(e);
  window.triggerCleanBackground = () => UIModals.triggerCleanBackground();
  window.openBrandManagerModal = () => UIModals.openBrandManagerModal();
  window.closeBrandManagerModal = () => UIModals.closeBrandManagerModal();
  window.addCustomBrand = () => UIModals.addCustomBrand();
  window.deleteCustomBrand = (idx) => UIModals.deleteCustomBrand(idx);
}
if (typeof module !== 'undefined') module.exports = UIModals;
