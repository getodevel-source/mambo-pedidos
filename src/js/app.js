// ============================================
//  Mambo Pedidos - Módulo Controlador Principal UI
// ============================================

let catalog = [];
let selection = {};
let currentPedido = null;
let dragCount = 0;

// Escape Helpers
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function hasCatalogImage(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(value.trim());
}

let catalogSaveTimer = null;
function scheduleCatalogSave() {
  clearTimeout(catalogSaveTimer);
  catalogSaveTimer = setTimeout(() => {
    AppStorage.saveCatalog(catalog, selection).catch(err => console.error('No se pudo persistir el catálogo:', err));
  }, 150);
}

// toast, showProgress, hideProgress, showDropOverlay, hideDropOverlay
// are now in src/js/ui/notifications.js (loaded before app.js)

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (name === 'historial') renderHistorial();
  updateBadges();
}

async function updateBadges() {
  const catBadge = document.getElementById('navBadgeCat');
  const pedBadge = document.getElementById('navBadgePed');
  const hisBadge = document.getElementById('navBadgeHis');

  if (catBadge) catBadge.textContent = catalog.length;
  const selQty = Object.values(selection).reduce((s, v) => s + v, 0);
  if (pedBadge) pedBadge.textContent = selQty;
  
  const historial = await AppStorage.loadHistorial();
  if (hisBadge) hisBadge.textContent = historial.length;
}

// showCatalogContent, populateCatalogFilters, prevPage, nextPage, adjustQty,
// setCatChip → src/js/ui/catalogView.js

function syncMarkup(val, origin) {
  const numInput = document.getElementById('cMarkup');
  const rangeInput = document.getElementById('cMarkupRange');
  const numVal = parseFloat(val) || 2.5;

  if (origin === 'range' && numInput) numInput.value = numVal.toFixed(2);
  if (origin === 'num' && rangeInput) rangeInput.value = numVal;

  recalc();
}

// renderCatalog, toggleItem, setQty, toggleSelectAll, removeItem,
// addCatalogItem, resetCatalog, updateField → src/js/ui/catalogView.js

// Brand Manager State (pendingPreviewItems → src/js/ui/importFlow.js)
// pendingPreviewItems → src/js/ui/importFlow.js
let customBrandsList = [];

// openBrandManagerModal, closeBrandManagerModal, addCustomBrand, deleteCustomBrand → src/js/ui/modals.js

function renderBrandList() {
  const cont = document.getElementById('brandListContainer');
  if (!cont) return;
  if (!customBrandsList.length) {
    cont.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 12px; text-align: center;">No hay marcas personalizadas aún. Agregá una arriba.</div>';
    return;
  }
  let html = '';
  customBrandsList.forEach((b, i) => {
    html += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px; font-size: 12px;">`;
    html += `<div><strong style="color: var(--primary);">${esc(b.name)}</strong> <span style="color: var(--text-muted); font-size: 11px;">(Patrón: "${esc(b.pattern)}")</span></div>`;
    html += `<button class="btn btn-sm" onclick="deleteCustomBrand(${i})" style="color: var(--red); padding: 2px 6px;">🗑</button>`;
    html += `</div>`;
  });
  cont.innerHTML = html;
}

// processFiles, renderImportPreviewModal, setPreviewFilter, setPreviewSearch,
// updateConfirmCount, updatePreviewItem, toggleSelectAllPreview,
// applyBatchBrand, applyBatchCat, autoCorrectPreviewWithAI,
// removePreviewItem, closeImportPreviewModal, confirmImportPreview → src/js/ui/importFlow.js

// Pedido UI
function validarYOarmarPedido() {
  if (!Object.keys(selection).length) {
    toast('Seleccioná al menos un producto', 'error');
    return;
  }
  const items = Object.entries(selection).map(([sku, qty]) => {
    const r = catalog.find(c => c.sku === sku);
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, variante: r.variante || '', color: r.variante || '', fob: r.fob, img: r ? r.img || '-' : '-', status: r.status, qty };
  });
  if (items.some(item => item.status === 'RED')) {
    toast('Hay productos en rojo que no pueden pasar a un pedido confirmado', 'error');
    return;
  }

  const validation = Validations.validateOrder({ items });
  if (!validation.valid) {
    showValidationPanel(validation.errors, validation.warnings);
    return;
  }
  if (validation.warnings.length) {
    if (!confirm('Hay ' + validation.warnings.length + ' advertencias. ¿Continuar?\n\n' + validation.warnings.map(w => '• ' + w.message).join('\n'))) {
      return;
    }
  }
  armarPedido();
  hideValidationPanel();
}

function armarPedido() {
  const sel = Object.entries(selection);
  if (!sel.length) { toast('Seleccioná al menos un producto', 'error'); return; }
  const items = sel.map(([sku, qty]) => {
    const r = catalog.find(c => c.sku === sku);
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, variante: r.variante || '', color: r.variante || '', fob: r.fob, img: r ? r.img || '-' : '-', status: r.status, qty };
  });
  currentPedido = { name: 'Pedido ' + new Date().toLocaleDateString('es-AR'), items, costs: getCostInputs(), date: new Date().toISOString() };
  switchView('pedido');
  renderPedido();
  toast('📦 Pedido armado: ' + items.length + ' SKUs', 'success');
}

function getCostInputs() {
  const getRadioVal = (name, defaultVal) => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : defaultVal;
  };

  return {
    flete: document.getElementById('cFlete')?.value || 15,
    fleteModo: getRadioVal('rFleteModo', 'porcentaje'),
    pesoKg: document.getElementById('cPesoKg')?.value || 0,
    costoPorKg: document.getElementById('cCostoPorKg')?.value || 12,
    logisticaModo: getRadioVal('rLogisticaModo', 'courier'),
    transporteModo: getRadioVal('rTransporteModo', 'aereo'),
    seguro: document.getElementById('cSeguro')?.value || 2,
    derechos: document.getElementById('cDerechos')?.value || 16,
    tasa: document.getElementById('cTasa')?.value || 3,
    perc: document.getElementById('cPerc')?.value || 6,
    ivaPct: document.getElementById('cIvaPct')?.value !== undefined && document.getElementById('cIvaPct')?.value !== '' ? document.getElementById('cIvaPct').value : 21,
    desp: document.getElementById('cDesp')?.value || 500,
    courier: document.getElementById('cCourier')?.value || 8,
    markup: document.getElementById('cMarkup')?.value || 2.5,
    tipoCambio: document.getElementById('cTasaCambio')?.value || 1400,
  };
}

function renderPedido() {
  if (!currentPedido || !currentPedido.items.length) return;
  document.getElementById('pedidoEmpty').style.display = 'none';
  document.getElementById('pedidoContent').style.display = 'block';
  document.getElementById('pedidoName').value = currentPedido.name;

  if (currentPedido.costs) {
    const c = currentPedido.costs;
    if (document.getElementById('cFlete')) document.getElementById('cFlete').value = c.flete;
    if (document.getElementById('cPesoKg')) document.getElementById('cPesoKg').value = c.pesoKg || 0;
    if (document.getElementById('cCostoPorKg')) document.getElementById('cCostoPorKg').value = c.costoPorKg || 12;
    if (document.getElementById('cSeguro')) document.getElementById('cSeguro').value = c.seguro;
    if (document.getElementById('cDerechos')) document.getElementById('cDerechos').value = c.derechos;
    if (document.getElementById('cTasa')) document.getElementById('cTasa').value = c.tasa;
    if (document.getElementById('cPerc')) document.getElementById('cPerc').value = c.perc;
    if (document.getElementById('cIvaPct')) document.getElementById('cIvaPct').value = c.ivaPct || 21;
    if (document.getElementById('cDesp')) document.getElementById('cDesp').value = c.desp;
    if (document.getElementById('cCourier')) document.getElementById('cCourier').value = c.courier;
    if (document.getElementById('cMarkup')) document.getElementById('cMarkup').value = c.markup;
    if (document.getElementById('cTasaCambio')) document.getElementById('cTasaCambio').value = c.tipoCambio || 1400;

    // Radios
    const setRadio = (name, val) => {
      const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    };
    if (c.logisticaModo) setRadio('rLogisticaModo', c.logisticaModo);
    if (c.transporteModo) setRadio('rTransporteModo', c.transporteModo);
    if (c.fleteModo) setRadio('rFleteModo', c.fleteModo);
  }

  recalc();
}

function recalc() {
  if (!currentPedido) return;
  const costInputs = getCostInputs();
  const res = Calculator.calculateOrder(currentPedido.items, costInputs);

  currentPedido.items = res.items;
  currentPedido.costs = costInputs;
  currentPedido.totals = res.totals;
  currentPedido.warnings = res.warnings;
  currentPedido.cautions = res.cautions;

  const t = res.totals;

  if (document.getElementById('pedFob')) document.getElementById('pedFob').textContent = '$' + t.fob.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' USD';
  if (document.getElementById('pedFobSub')) document.getElementById('pedFobSub').textContent = t.qty + ' u · ARS $' + (t.fobArs || 0).toLocaleString();
  if (document.getElementById('pedCosto')) document.getElementById('pedCosto').textContent = '$' + Math.round(t.costo).toLocaleString() + ' USD';
  if (document.getElementById('pedCostoSub')) document.getElementById('pedCostoSub').textContent = 'Neto · Bruto con IVA $' + Math.round(t.totalBrutoConIva || t.costo).toLocaleString() + ' USD';
  if (document.getElementById('pedFact')) document.getElementById('pedFact').textContent = '$' + Math.round(t.facturacion).toLocaleString() + ' USD';
  if (document.getElementById('pedMargen')) document.getElementById('pedMargen').textContent = '$' + Math.round(t.margen).toLocaleString() + ' USD';
  if (document.getElementById('pedMargenSub')) document.getElementById('pedMargenSub').textContent = t.facturacion > 0 ? t.margenPct + '% margen (ARS $' + (t.margenArs || 0).toLocaleString() + ')' : '—';

  if (document.getElementById('pedRoi')) document.getElementById('pedRoi').textContent = (t.roiPct || 0) + '%';
  if (document.getElementById('pedIva')) document.getElementById('pedIva').textContent = '$' + Math.round(t.ivaUsd || 0).toLocaleString() + ' USD';
  if (document.getElementById('pedIvaSub')) document.getElementById('pedIvaSub').textContent = 'ARS $' + (t.ivaArs || 0).toLocaleString();

  // Actualizar semáforo de margen
  const healthBadge = document.getElementById('marginHealthBadge');
  if (healthBadge) {
    const mPct = t.margenPct || 0;
    if (mPct >= 40) {
      healthBadge.textContent = '🟢 Excelente Rentabilidad (>40%)';
      healthBadge.style.background = 'rgba(16,185,129,0.15)';
      healthBadge.style.borderColor = 'rgba(16,185,129,0.4)';
      healthBadge.style.color = '#34d399';
    } else if (mPct >= 20) {
      healthBadge.textContent = '🟡 Margen Saludable (20-40%)';
      healthBadge.style.background = 'rgba(234,179,8,0.15)';
      healthBadge.style.borderColor = 'rgba(234,179,8,0.4)';
      healthBadge.style.color = '#fde047';
    } else {
      healthBadge.textContent = '🔴 Margen Ajustado (<20%)';
      healthBadge.style.background = 'rgba(239,68,68,0.15)';
      healthBadge.style.borderColor = 'rgba(239,68,68,0.4)';
      healthBadge.style.color = '#f87171';
    }
  }

  if (document.getElementById('pedidoSubtitle')) document.getElementById('pedidoSubtitle').textContent = currentPedido.items.length + ' SKUs · ' + t.qty + ' unidades · TC: $' + t.tipoCambio + '/USD';
  if (document.getElementById('pedidoMeta')) document.getElementById('pedidoMeta').textContent = 'Actualizado: ' + new Date().toLocaleString('es-AR') + ' · Facturación ARS: $' + (t.facturacionArs || 0).toLocaleString();
  if (document.getElementById('pedTableMeta')) document.getElementById('pedTableMeta').textContent = currentPedido.items.length + ' SKUs · ' + t.qty + ' unidades';

  // Renderear advertencias y regulaciones
  const warnCont = document.getElementById('orderWarningsContainer');
  if (warnCont) {
    let warnHtml = '';
    if (res.cautions && res.cautions.length) {
      warnHtml += `<div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #a5b4fc;">${res.cautions.join(' · ')}</div>`;
    }
    if (res.warnings && res.warnings.length) {
      res.warnings.forEach(w => {
        const bg = w.type === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)';
        const border = w.type === 'danger' ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)';
        const color = w.type === 'danger' ? '#f87171' : '#fde047';
        warnHtml += `<div style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; font-size: 13px; color: ${color};">
          <strong>${esc(w.title)}:</strong> ${esc(w.message)}
        </div>`;
      });
    }
    warnCont.innerHTML = warnHtml;
  }

  renderPedidoTable();
}

// clonarPedido, copiarResumenPedido → src/js/ui/historyView.js

// catalogViewMode, setCatalogViewMode → src/js/ui/catalogView.js

// zoomImage, zoomImageByUrl, closeImageZoomModal, triggerImageUpload,
// openSupplierCompareModal, closeSupplierCompareModal,
// openSensitivitySimulatorModal, closeSensitivitySimulatorModal, runSensitivitySimulation,
// openBreakEvenModal, closeBreakEvenModal, runBreakEvenCalculation,
// openDoorToDoorModal, closeDoorToDoorModal, runDoorToDoorCalculation,
// handleProductImageFile, triggerCleanBackground → src/js/ui/modals.js

let liveDolarData = null;

async function fetchLiveDolarRates(userInitiated = false) {
  if (userInitiated) toast('🔄 Consultando DólarAPI en vivo...', 'info');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    liveDolarData = {};
    data.forEach(item => {
      liveDolarData[item.casa] = item;
    });

    renderDolarBadges();
    if (userInitiated) toast('✅ Cotizaciones Dólar actualizadas', 'success');
  } catch (err) {
    console.warn('Error al obtener cotizaciones de dólar:', err);
    if (userInitiated) toast('⚠️ No se pudo conectar con la API de Dólar', 'error');
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderDolarBadges() {
  if (!liveDolarData) return;
  const badgeList = document.getElementById('dolarRatesBadgeList');
  if (!badgeList) return;

  const mayorista = liveDolarData.mayorista?.venta || liveDolarData.mayorista?.compra;
  const oficial = liveDolarData.oficial?.venta;
  const blue = liveDolarData.blue?.venta;
  const mep = liveDolarData.bolsa?.venta || liveDolarData.mep?.venta;
  const cripto = liveDolarData.cripto?.venta;

  let html = '';
  const chip = (key, label, value, color) =>
    `<button class="dolar-chip" onclick="applyDolarRate('${key}')" title="Aplicar $${Math.round(value)} ARS como tipo de cambio">` +
      `<span class="dolar-dot" style="background:${color}"></span>` +
      `<span class="dolar-label">${label}</span>` +
      `<span class="dolar-value">$${Math.round(value).toLocaleString('es-AR')}</span>` +
    `</button>`;
  if (mayorista) html += chip('mayorista', 'Mayorista', mayorista, '#e2e8f0');
  if (oficial)   html += chip('oficial', 'Oficial', oficial, '#94a3b8');
  if (blue)      html += chip('blue', 'Blue', blue, '#38bdf8');
  if (mep)       html += chip('mep', 'MEP', mep, '#a5b4fc');
  if (cripto)    html += chip('cripto', 'Cripto', cripto, '#34d399');

  badgeList.innerHTML = html;
}

function applyDolarRate(key) {
  if (!liveDolarData || !liveDolarData[key]) {
    fetchLiveDolarRates(true);
    return;
  }
  const val = liveDolarData[key].venta || liveDolarData[key].compra;
  if (!val) return;

  const tcInput = document.getElementById('cTasaCambio');
  if (tcInput) {
    tcInput.value = Math.round(val);
    recalc();
    toast(`Tasa de cambio aplicada: Dólar ${key.toUpperCase()} ($${Math.round(val).toLocaleString('es-AR')} ARS)`, 'success');
  }
}

function syncDescuentoNegociado(val) {
  const pct = parseFloat(val) || 0;
  const label = document.getElementById('cDescuentoNegociadoVal');
  if (label) label.textContent = `${pct}%`;

  if (currentPedido && currentPedido.items) {
    let origFobTotal = 0;
    let realFobTotal = 0;
    currentPedido.items.forEach(i => {
      if (i.fobOriginal === undefined) i.fobOriginal = i.fob;
      i.fob = i.fobOriginal * (1 - (pct / 100));
      origFobTotal += i.fobOriginal * (i.qty || 1);
      realFobTotal += i.fob * (i.qty || 1);
    });

    const diffSavings = origFobTotal - realFobTotal;
    const badge = document.getElementById('negotiationSavingsBadge');
    if (badge) {
      if (pct > 0) {
        badge.innerHTML = `🤝 Ahorro por Negociación: <strong>-$${Math.round(diffSavings)} USD</strong> (${pct}% off list)`;
        badge.style.background = 'rgba(16,185,129,0.2)';
      } else {
        badge.textContent = '🤝 Sin descuento negociado';
        badge.style.background = 'rgba(16,185,129,0.15)';
      }
    }
  }
  recalc();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  } else {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }
}

function updateProductImage(sku, dataUrl) {
  const item = catalog.find(r => r.sku === sku);
  if (item) {
    if (!hasCatalogImage(dataUrl)) {
      toast('La imagen seleccionada no es válida', 'error');
      return;
    }
    item.img = dataUrl;
    if (typeof CatalogValidator !== 'undefined') CatalogValidator.runFullValidation(catalog);
    zoomImageByUrl(dataUrl, `${item.marca} ${item.modelo} (${item.sku})`);
    renderCatalog();
    if (typeof renderPedidoTable === 'function') renderPedidoTable();
    scheduleCatalogSave();
    toast('📷 Foto del producto actualizada', 'success');
  }
}

// Escuchar evento Paste (Ctrl+V) para pegar fotos directamente
window.addEventListener('paste', (e) => {
  if (!UIModals.activeZoomSku) return;
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (evt) => {
        updateProductImage(UIModals.activeZoomSku, evt.target.result);
      };
      reader.readAsDataURL(blob);
      break;
    }
  }
});

function renderPedidoTable() {
  if (!currentPedido) return;
  let html = '';
  currentPedido.items.forEach((r, i) => {
    const imgHtml = hasCatalogImage(r.img) ? `<img src="${esc(r.img)}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; cursor: zoom-in; background: rgba(0,0,0,0.3); border: 1px solid var(--border);" onclick="zoomImageByUrl('${escJs(r.img)}', '${escJs(r.marca + ' ' + r.modelo)}')">` : `<span style="font-size: 16px; opacity: 0.3;">-</span>`;
    html += '<tr>';
    html += '<td style="text-align: center;">' + imgHtml + '</td>';
    html += '<td><code style="font-size: 10px; font-family: JetBrains Mono, monospace; color: var(--text-3);">' + esc(r.sku) + '</code></td>';
    html += '<td>' + esc(r.marca) + '</td>';
    html += '<td>' + esc(r.modelo) + '</td>';
    html += '<td><span class="muted">' + esc(r.color) + '</span></td>';
    html += '<td class="num">$' + r.fob.toFixed(2) + '</td>';
    html += '<td class="center"><input class="inline num qty" type="number" value="' + r.qty + '" onchange="currentPedido.items[' + i + '].qty=parseInt(this.value)||0; recalc()"></td>';
    html += '<td class="num">$' + r.subFob.toFixed(0) + '</td>';
    html += '<td class="num" style="color: var(--accent);">$' + r.pvp.toLocaleString() + '</td>';
    html += '<td class="num" style="color: var(--green);">' + r.margenPct + '%</td>';
    html += '<td class="action"><button class="btn btn-sm" onclick="removePedItem(' + i + ')" style="background: transparent; border: 1px solid var(--border); padding: 2px 6px; color: var(--red);">🗑</button></td>';
    html += '</tr>';
  });
  document.getElementById('pedidoBody').innerHTML = html;
}

function removePedItem(idx) {
  currentPedido.items.splice(idx, 1);
  if (!currentPedido.items.length) {
    currentPedido = null;
    document.getElementById('pedidoEmpty').style.display = 'block';
    document.getElementById('pedidoContent').style.display = 'none';
    document.getElementById('pedidoSubtitle').textContent = 'No hay productos en el pedido';
    return;
  }
  recalc();
}

// Historial UI → src/js/ui/historyView.js
// saveToHistorial, renderHistorial, loadFromHistorial,
// clonarPedido, copiarResumenPedido, deleteFromHistorial

function showValidationPanel(errors, warnings) {
  let panel = document.getElementById('validationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'validationPanel';
    panel.className = 'validation-panel';
    document.body.appendChild(panel);
  }
  let html = '<span class="close" onclick="hideValidationPanel()">✕</span>';
  html += '<h4>❌ ' + errors.length + ' errores encontrados</h4>';
  html += '<ul>';
  errors.forEach(e => {
    html += '<li><strong style="color: var(--red);">' + esc(e.field) + ':</strong> ' + esc(e.message) + '</li>';
  });
  html += '</ul>';
  if (warnings.length) {
    html += '<h4 style="color: var(--yellow); margin-top: 12px;">⚠️ ' + warnings.length + ' advertencias</h4>';
    html += '<ul>';
    warnings.forEach(w => {
      html += '<li><strong style="color: var(--yellow);">' + esc(w.field) + ':</strong> ' + esc(w.message) + '</li>';
    });
    html += '</ul>';
  }
  panel.innerHTML = html;
  panel.style.display = 'block';
}

function hideValidationPanel() {
  const p = document.getElementById('validationPanel');
  if (p) p.style.display = 'none';
}

function loadDemoCatalog() {
  const demo = [
    {sku:'TEC-001',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Glacier Blue',fob:31.75},
    {sku:'TEC-002',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Cedar Green',fob:31.75},
    {sku:'TEC-003',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Sea Salt Blue',fob:31.75},
    {sku:'TEC-004',cat:'TECLADO',marca:'AULA',modelo:'F75MAX',variante:'Thunder Black',fob:39.48},
    {sku:'TEC-005',cat:'TECLADO',marca:'AULA',modelo:'F75MAX',variante:'Glacier Blue',fob:39.48},
    {sku:'TEC-006',cat:'TECLADO',marca:'AULA',modelo:'F99',variante:'Light Grey',fob:36.04},
    {sku:'TEC-007',cat:'TECLADO',marca:'MCHOSE',modelo:'ACE 68 V2 HE',variante:'Peachy Pink',fob:37.75},
    {sku:'TEC-008',cat:'TECLADO',marca:'MCHOSE',modelo:'ACE 68 V2 HE',variante:'Berry Red',fob:37.75},
    {sku:'TEC-009',cat:'TECLADO',marca:'MCHOSE',modelo:'Mix 87 8KHz',variante:'Black',fob:40.39},
    {sku:'TEC-010',cat:'TECLADO',marca:'Madlions',modelo:'MAD 60 V2 White Horse',variante:'Matte White',fob:25.57},
    {sku:'TEC-011',cat:'TECLADO',marca:'Madlions',modelo:'MAD 60 V2 White Horse',variante:'Matte Black',fob:25.57},
    {sku:'TEC-012',cat:'TECLADO',marca:'Madlions',modelo:'TITAN 68 TURBO',variante:'Black',fob:42.74},
    {sku:'TEC-013',cat:'TECLADO',marca:'ATK',modelo:'Z87',variante:'Caribbean Blue',fob:32.80},
    {sku:'TEC-014',cat:'TECLADO',marca:'ATK',modelo:'Z87 PRO',variante:'Foggy Black',fob:46.00},
    {sku:'MOU-001',cat:'MOUSE',marca:'ATK',modelo:'X1 Ultimate 8KHz',variante:'White',fob:60.70},
    {sku:'MOU-002',cat:'MOUSE',marca:'ATK',modelo:'X1 Ultimate 8KHz',variante:'Black',fob:60.70},
    {sku:'MOU-003',cat:'MOUSE',marca:'ATK',modelo:'A9 Ultra PAW3950',variante:'White',fob:51.70},
    {sku:'MOU-004',cat:'MOUSE',marca:'ATK',modelo:'A9 Ultra PAW3950',variante:'Black',fob:51.70},
    {sku:'MOU-005',cat:'MOUSE',marca:'VXE',modelo:'R1 Pro Max 8KHz',variante:'Sunset Orange',fob:32.80},
    {sku:'MOU-006',cat:'MOUSE',marca:'VXE',modelo:'R1 Pro Max 8KHz',variante:'Lilac Purple',fob:32.80},
    {sku:'MOU-007',cat:'MOUSE',marca:'Attack Shark',modelo:'R5 Ultra',variante:'Black',fob:45.97},
    {sku:'MOU-008',cat:'MOUSE',marca:'Attack Shark',modelo:'R5 Ultra',variante:'White',fob:45.97},
    {sku:'MOU-009',cat:'MOUSE',marca:'Attack Shark',modelo:'X8 SE Tri-mode',variante:'White',fob:13.37},
    {sku:'MOU-010',cat:'MOUSE',marca:'Attack Shark',modelo:'X3 PRO 4K',variante:'Black',fob:29.25},
    {sku:'PAD-001',cat:'MOUSEPAD',marca:'ATK',modelo:'Sky Large 900x400',variante:'Black',fob:13.10},
    {sku:'PAD-002',cat:'MOUSEPAD',marca:'ATK',modelo:'Sky Large 900x400',variante:'Orange',fob:13.10},
    {sku:'PAD-003',cat:'MOUSEPAD',marca:'ATK',modelo:'99G Carbon eSport',variante:'Matcha Green',fob:13.10},
    {sku:'PAD-004',cat:'MOUSEPAD',marca:'ATK',modelo:'Anime Mouse Pad Reverie',variante:'Black-White',fob:8.10},
    {sku:'PAD-005',cat:'MOUSEPAD',marca:'ATK',modelo:'Anime Mouse Pad NANA',variante:'Anime',fob:8.10},
    {sku:'PAD-006',cat:'MOUSEPAD XL',marca:'ATK',modelo:'99G Air PRO XL',variante:'Green',fob:32.80},
    {sku:'PAD-007',cat:'MOUSEPAD',marca:'ATK',modelo:'99G Air Carbon',variante:'Green',fob:6.70},
    {sku:'HEA-001',cat:'HEADSET',marca:'MCHOSE',modelo:'V9 Turbo+ Magnetic',variante:'Black Gold',fob:60.58},
    {sku:'HEA-002',cat:'HEADSET',marca:'MCHOSE',modelo:'V9 Turbo+ Magnetic',variante:'White Gold',fob:60.58},
    {sku:'HEA-003',cat:'HEADSET',marca:'MCHOSE',modelo:'X9 53mm 7.1',variante:'White',fob:40.39},
    {sku:'HEA-004',cat:'HEADSET',marca:'ATK',modelo:'Neptune N9 eSports',variante:'White',fob:24.50},
    {sku:'HEA-005',cat:'HEADSET',marca:'Attack Shark',modelo:'L50 PRO Wireless',variante:'Black',fob:23.17},
  ];
  catalog = demo.map(d => ({...d}));
  selection = {};
  scheduleCatalogSave();
  showCatalogContent();
  renderCatalog();
  toast('🎮 ' + catalog.length + ' productos demo cargados', 'success');
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  fetchLiveDolarRates(false);
  await AppStorage.init();
  const saved = await AppStorage.loadCatalog();
  if (saved && saved.items && saved.items.length) {
    catalog = saved.items;
    selection = saved.sel || {};
    showCatalogContent();
    renderCatalog();
    toast('📚 ' + catalog.length + ' productos restaurados', 'info');
  }

  // Inputs de Archivos
  document.getElementById('fileInputPdf')?.addEventListener('change', e => processFiles(Array.from(e.target.files)));
  document.getElementById('fileInputCsv')?.addEventListener('change', e => processFiles(Array.from(e.target.files)));
  document.getElementById('folderInput')?.addEventListener('change', e => {
    const files = Array.from(e.target.files).filter(f => /\.(pdf|csv|xlsx|xls)$/i.test(f.name));
    if (files.length) processFiles(files);
  });
  document.getElementById('fileInputPedido')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];
      if (ext === 'csv') rows = await FileImporter.processCsvFile(file);
      else rows = await FileImporter.processExcelFile(file);
      
      const items = rows.map(r => ({
        sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, variante: r.variante || '', color: r.variante || '', fob: r.fob, qty: 1
      }));
      currentPedido = { name: 'Pedido importado ' + new Date().toLocaleDateString('es-AR'), items, costs: getCostInputs(), date: new Date().toISOString() };
      switchView('pedido');
      renderPedido();
      toast('📦 Pedido importado: ' + items.length + ' SKUs', 'success');
    } catch(err) {
      toast('❌ Error importando pedido: ' + err.message, 'error');
    }
  });

  // Drag & drop
  document.addEventListener('dragenter', e => { e.preventDefault(); dragCount++; showDropOverlay(); });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('dragleave', e => { dragCount--; if (dragCount <= 0) { dragCount = 0; hideDropOverlay(); } });
  document.addEventListener('drop', e => {
    e.preventDefault(); dragCount = 0; hideDropOverlay();
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|csv|xlsx|xls)$/i.test(f.name));
    if (files.length) processFiles(files);
  });

  // Verificación silenciosa de actualizaciones al inicio
  setTimeout(() => {
    if (typeof AppUpdater !== 'undefined') {
      AppUpdater.checkUpdate(false);
    }
  }, 3000);

  // Verificar disponibilidad del motor de IA local (opcional, auto-detectado)
  setTimeout(() => {
    if (typeof LocalLlm !== 'undefined') {
      LocalLlm.checkHealth().then(available => {
        if (available) {
          console.log(`✅ Motor de IA local detectado en ${LocalLlm.endpoint}`);
        } else {
          console.log(`ℹ️ Motor de IA local no activo (usando validación determinística)`);
        }
      });
    }
  }, 1000);
});

// showDropOverlay/hideDropOverlay are now in src/js/ui/notifications.js

// Global Escape Key Listener for Modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (typeof closeImportPreviewModal === 'function') closeImportPreviewModal();
    if (typeof closeBrandManagerModal === 'function') closeBrandManagerModal();
    if (typeof closeImageZoomModal === 'function') closeImageZoomModal();
    if (typeof closeSupplierCompareModal === 'function') closeSupplierCompareModal();
    if (typeof closeSensitivitySimulatorModal === 'function') closeSensitivitySimulatorModal();
    if (typeof closeBreakEvenModal === 'function') closeBreakEvenModal();
    if (typeof closeDoorToDoorModal === 'function') closeDoorToDoorModal();
    if (window.AppUpdater && typeof window.AppUpdater.closeModal === 'function') window.AppUpdater.closeModal();
  }
});
