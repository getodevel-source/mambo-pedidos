// ============================================
//  Mambo Pedidos - Módulo Controlador Principal UI
// ============================================

let catalog = [];
let selection = {};
let currentPedido = null;
let dragCount = 0;

// ============================================
//  AppStore - Mínimo store reactivo (pub/sub sobre el estado de la app).
//  Los mutadores envuelven sus cambios con AppStore.commit() para que la UI
//  se sincronice sola (badges, hint guiado). Adopción incremental.
// ============================================
const AppStore = {
  _listeners: [],
  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  },
  commit(mutator) {
    mutator();
    this.notify();
  },
  notify() {
    this._listeners.slice().forEach(fn => {
      try { fn(); } catch (e) { console.error('AppStore listener error:', e); }
    });
  }
};

// Sincronización reactiva de la UI tras cada commit.
AppStore.subscribe(() => {
  if (typeof updateBadges === 'function') updateBadges();
  if (typeof CatalogView !== 'undefined' && CatalogView.refreshNextStepHint) CatalogView.refreshNextStepHint();
});

// Escape Helpers
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function hasCatalogImage(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(value.trim());
}

let catalogSaveTimer = null;
// persistence-fix: el autosave solo hacía console.error, así que un fallo del
// backend real (ahora lanza en vez de despojar imágenes) era invisible para el
// usuario. Se avisa una vez por mensaje distinto para no spammar el debounce.
let catalogSaveError = null;
function scheduleCatalogSave() {
  clearTimeout(catalogSaveTimer);
  catalogSaveTimer = setTimeout(() => {
    AppStorage.saveCatalog(catalog, selection).then(() => {
      catalogSaveError = null;
    }).catch(err => {
      const msg = (err && err.message) || String(err);
      console.error('No se pudo persistir el catálogo:', err);
      if (msg !== catalogSaveError && typeof toast === 'function') {
        catalogSaveError = msg;
        toast('No se pudo guardar el catálogo: ' + msg, 'error');
      }
    });
  }, 150);
}

// toast, showProgress, hideProgress, showDropOverlay, hideDropOverlay
// are now in src/js/ui/notifications.js (loaded before app.js)

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (name === 'historial') renderHistorial();
  if (name === 'importaciones') renderImportaciones();
  updateBadges();
}

let _historialBadgeCache = null;
let _historialBadgeCachedAt = 0;
const HISTORIAL_BADGE_TTL = 10 * 1000;

/* exported invalidateHistorialBadge */
function invalidateHistorialBadge() { _historialBadgeCache = null; }

let _importsBadgeCache = null;
let _importsBadgeCachedAt = 0;

/* exported invalidateImportsBadge */
function invalidateImportsBadge() { _importsBadgeCache = null; }

async function updateBadges() {
  const catBadge = document.getElementById('navBadgeCat');
  const pedBadge = document.getElementById('navBadgePed');
  const hisBadge = document.getElementById('navBadgeHis');
  const impBadge = document.getElementById('navBadgeImp');

  if (catBadge) catBadge.textContent = catalog.length;
  const selQty = Object.values(selection).reduce((s, v) => s + v, 0);
  if (pedBadge) pedBadge.textContent = selQty;
  
  // Evitar I/O de disco (Tauri Store) en cada render: cachear el conteo con TTL
  if (_historialBadgeCache === null || (Date.now() - _historialBadgeCachedAt) > HISTORIAL_BADGE_TTL) {
    try {
      const historial = await AppStorage.loadHistorial();
      _historialBadgeCache = historial.length;
      _historialBadgeCachedAt = Date.now();
    } catch {
      _historialBadgeCache = _historialBadgeCache || 0;
    }
  }
  if (hisBadge) hisBadge.textContent = _historialBadgeCache;

  // Badge de importaciones: mismo patrón TTL que el historial (KEYS.IMPORTS)
  if (_importsBadgeCache === null || (Date.now() - _importsBadgeCachedAt) > HISTORIAL_BADGE_TTL) {
    try {
      const importsPayload = await AppStorage.loadImports();
      _importsBadgeCache = importsPayload && Array.isArray(importsPayload.records) ? importsPayload.records.length : 0;
      _importsBadgeCachedAt = Date.now();
    } catch {
      _importsBadgeCache = _importsBadgeCache || 0;
    }
  }
  if (impBadge) impBadge.textContent = _importsBadgeCache;
}

// showCatalogContent, populateCatalogFilters, prevPage, nextPage, adjustQty,
// setCatChip → src/js/ui/catalogView.js

/* exported syncMarkup */
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
/* exported customBrandsList */
let customBrandsList = [];

// openBrandManagerModal, closeBrandManagerModal, addCustomBrand, deleteCustomBrand → src/js/ui/modals.js

/* exported renderBrandList */
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
    html += `<button class="btn btn-sm" onclick="deleteCustomBrand(${i})" style="color: var(--red); padding: 2px 6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>`;
    html += `</div>`;
  });
  cont.innerHTML = html;
}

// processFiles, renderImportPreviewModal, setPreviewFilter, setPreviewSearch,
// updateConfirmCount, updatePreviewItem, toggleSelectAllPreview,
// applyBatchBrand, applyBatchCat, autoCorrectPreview,
// removePreviewItem, closeImportPreviewModal, confirmImportPreview → src/js/ui/importFlow.js

// Pedido UI
/* exported validarYOarmarPedido */
async function validarYOarmarPedido() {
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
    const list = validation.warnings.map(w => '• ' + esc(w.message)).join('<br>');
    const ok = await showConfirm({ title: validation.warnings.length + ' advertencias', message: list, confirmText: 'Continuar de todos modos' });
    if (!ok) return;
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
  toast('Pedido armado: ' + items.length + ' SKUs', 'success');
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
    derechos: (function(){ const v = document.getElementById('cDerechos')?.value; return v !== undefined && v !== '' ? parseFloat(v) : undefined; })(),
    tasa: document.getElementById('cTasa')?.value || 3,
    perc: document.getElementById('cPerc')?.value || 6,
    ivaPct: document.getElementById('cIvaPct')?.value || 21,
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

// Adaptative fiscal form: show only the fields the current regime/freight mode actually uses.
// Safe because Calculator already ignores the inactive mode's fields (courierCost vs despCost, peso vs porcentaje).
function applyLogisticsVisibility() {
  const getRadio = (name) => {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  };
  const logModo = getRadio('rLogisticaModo') || 'courier';
  const fleteModo = getRadio('rFleteModo') || 'porcentaje';
  const setVisible = (inputId, visible) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const wrap = el.closest('.cost');
    if (wrap) wrap.style.display = visible ? '' : 'none';
  };
  setVisible('cCourier', logModo === 'courier');
  setVisible('cDesp', logModo === 'importador');
  setVisible('cFlete', fleteModo === 'porcentaje');
  setVisible('cPesoKg', fleteModo === 'peso');
  setVisible('cCostoPorKg', fleteModo === 'peso');
}

// Preset de costos: aplica los valores recomendados para el régimen seleccionado.
/* exported applyFiscalPreset */
function applyFiscalPreset() {
  const preset = {
    cMarkup: 2.5,
    cTasaCambio: 1400,
    cFlete: 15,
    cPesoKg: 0,
    cCostoPorKg: 12,
    cSeguro: 2,
    cDerechos: 16,
    cTasa: 3,
    cPerc: 6,
    cIvaPct: 21,
    cDesp: 500,
    cCourier: 8,
  };
  for (const [id, val] of Object.entries(preset)) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  if (typeof syncMarkup === 'function') syncMarkup(preset.cMarkup, 'num');
  recalc();
  toast('Preset aplicado: valores recomendados para el régimen actual', 'success');
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
      healthBadge.textContent = 'Excelente Rentabilidad (>40%)';
      healthBadge.style.background = 'rgba(16,185,129,0.15)';
      healthBadge.style.borderColor = 'rgba(16,185,129,0.4)';
      healthBadge.style.color = '#34d399';
    } else if (mPct >= 20) {
      healthBadge.textContent = 'Margen Saludable (20-40%)';
      healthBadge.style.background = 'rgba(234,179,8,0.15)';
      healthBadge.style.borderColor = 'rgba(234,179,8,0.4)';
      healthBadge.style.color = '#fde047';
    } else {
      healthBadge.textContent = 'Margen Ajustado (<20%)';
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
      warnHtml += `<div class="alert-banner info">${res.cautions.join(' · ')}</div>`;
    }
    if (res.warnings && res.warnings.length) {
      res.warnings.forEach(w => {
        const cls = w.type === 'danger' ? 'danger' : 'warning';
        warnHtml += `<div class="alert-banner ${cls}"><strong>${esc(w.title)}:</strong> ${esc(w.message)}</div>`;
      });
    }
    warnCont.innerHTML = warnHtml;
  }

  applyLogisticsVisibility();
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
let _dolarLastFetch = 0;
const DOLAR_CACHE_MS = 5 * 60 * 1000;

// ── Persistencia de cotizaciones (modo offline) ──
function cacheDolarRates() {
  try {
    localStorage.setItem('mambo_dolar_cache', JSON.stringify({ data: liveDolarData, ts: Date.now() }));
  } catch { /* cuota/privacidad: no crítico */ }
}

function loadCachedDolarRates() {
  try {
    const raw = localStorage.getItem('mambo_dolar_cache');
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached && cached.data && cached.ts) return cached;
  } catch { /* cache corrupto: ignorar */ }
  return null;
}

function showDolarStaleBadge(ts) {
  let el = document.getElementById('dolarStaleBadge');
  if (!el) {
    el = document.createElement('span');
    el.id = 'dolarStaleBadge';
    el.style.cssText = 'font-size: 10px; color: var(--yellow); font-weight: 700; margin-left: 10px; white-space: nowrap;';
    const banner = document.getElementById('topDolarBanner');
    if (banner) banner.appendChild(el);
  }
  el.textContent = '· guardado ' + new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function hideDolarStaleBadge() {
  const el = document.getElementById('dolarStaleBadge');
  if (el) el.remove();
}

async function fetchLiveDolarRates(userInitiated = false) {
  // Cache: skip re-fetch within 5 minutes unless user explicitly requested
  if (!userInitiated && liveDolarData && (Date.now() - _dolarLastFetch) < DOLAR_CACHE_MS) {
    return;
  }
  if (userInitiated) toast('Consultando DólarAPI en vivo...', 'info');
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
    _dolarLastFetch = Date.now();

    renderDolarBadges();
    cacheDolarRates();
    hideDolarStaleBadge();
    if (userInitiated) toast('Cotizaciones Dólar actualizadas', 'success');
  } catch (err) {
    console.warn('Error al obtener cotizaciones de dólar:', err);
    if (!liveDolarData) {
      // Sin datos en memoria: restaurar la última cotización guardada (modo offline)
      const cached = loadCachedDolarRates();
      if (cached) {
        liveDolarData = cached.data;
        _dolarLastFetch = cached.ts;
        renderDolarBadges();
        showDolarStaleBadge(cached.ts);
        if (userInitiated) toast('Sin conexión: mostrando cotizaciones guardadas', 'warning');
        return;
      }
    }
    if (userInitiated) {
      const stale = liveDolarData ? ` (última: ${new Date(_dolarLastFetch).toLocaleTimeString('es-AR')})` : '';
      toast(`No se pudo conectar con la API de Dólar${stale}`, 'error');
    }
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

/* exported applyDolarRate */
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

/* exported syncDescuentoNegociado */
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
        badge.innerHTML = `Ahorro por Negociación: <strong>-$${Math.round(diffSavings)} USD</strong> (${pct}% off list)`;
        badge.style.background = 'rgba(16,185,129,0.2)';
      } else {
        badge.textContent = 'Sin descuento negociado';
        badge.style.background = 'rgba(16,185,129,0.15)';
      }
    }
  }
  recalc();
}

/* exported toggleFullscreen */
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

// ============================================
//  Premium UI: dropdowns, collapsibles, guided hints
// ============================================
/* exported toggleDropdown */
function toggleDropdown(btn) {
  const dd = btn.closest('.dropdown');
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  if (!wasOpen) dd.classList.add('open');
}

/* exported toggleAdvancedCosts */
function toggleAdvancedCosts(btn) {
  const panel = document.getElementById('advancedCostsPanel');
  if (!panel) return;
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  panel.style.display = expanded ? 'none' : 'block';
}

/* exported dismissNextStepHint */
function dismissNextStepHint() {
  if (typeof CatalogView !== 'undefined') CatalogView._nextStepDismissed = true;
  const h = document.getElementById('catalogNextStepHint');
  if (h) h.style.display = 'none';
}

// Close dropdowns on outside click or when an item is selected
document.addEventListener('click', (e) => {
  if (e.target.closest('.dropdown-item') || !e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }
});

// ============================================
//  Confirm modal (promise-based) + undo toast
// ============================================
const CONFIRM_DANGER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
let _confirmResolve = null;

function showConfirm(opts = {}) {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const iconEl = document.getElementById('confirmIcon');
    if (titleEl) titleEl.textContent = opts.title || 'Confirmar';
    if (msgEl) msgEl.innerHTML = opts.message || '';
    if (iconEl) { iconEl.innerHTML = opts.danger ? CONFIRM_DANGER_ICON : ''; }
    if (okBtn) {
      okBtn.textContent = opts.confirmText || 'Confirmar';
      okBtn.className = 'btn btn-sm ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    }
    const m = document.getElementById('confirmModal');
    if (m) m.style.display = 'flex';
  });
}

function resolveConfirm(value) {
  const m = document.getElementById('confirmModal');
  if (m) m.style.display = 'none';
  if (_confirmResolve) { const r = _confirmResolve; _confirmResolve = null; r(value); }
}

function closeConfirmModal() { resolveConfirm(false); }

/* exported toastUndo */
function toastUndo(msg, onUndo) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  const btn = document.createElement('button');
  btn.className = 'toast-undo';
  btn.textContent = 'Deshacer';
  btn.onclick = () => { try { onUndo(); } catch (err) { console.error('Undo falló:', err); } t.classList.remove('show'); };
  t.appendChild(span);
  t.appendChild(btn);
  t.className = 'toast show info';
  clearTimeout(t._undoTimer);
  t._undoTimer = setTimeout(() => t.classList.remove('show'), 6000);
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
    toast('Foto del producto actualizada', 'success');
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
    html += '<td class="action"><button class="btn btn-sm" onclick="removePedItem(' + i + ')" style="background: transparent; border: 1px solid var(--border); padding: 2px 6px; color: var(--red);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></td>';
    html += '</tr>';
  });
  document.getElementById('pedidoBody').innerHTML = html;
}

/* exported removePedItem */
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
  html += '<h4>' + errors.length + ' errores encontrados</h4>';
  html += '<ul>';
  errors.forEach(e => {
    html += '<li><strong style="color: var(--red);">' + esc(e.field) + ':</strong> ' + esc(e.message) + '</li>';
  });
  html += '</ul>';
  if (warnings.length) {
    html += '<h4 style="color: var(--yellow); margin-top: 12px;">' + warnings.length + ' advertencias</h4>';
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

/* exported loadDemoCatalog */
function loadDemoCatalog() {
  const demo = DEMO_CATALOG;
  catalog = demo.map(d => ({...d}));
  selection = {};
  scheduleCatalogSave();
  showCatalogContent();
  renderCatalog();
        bootMark("boot:first-render");
  toast(catalog.length + ' productos demo cargados', 'success');
}

// Setup Event Listeners
// boot-interactivity (repo-improvement-sprint): marcas de arranque para el
// e2e con CDP (Windows) — la interactividad completa no es medible en Linux.
const bootMark = (name) => {
  if (typeof performance === "undefined" || !performance.mark) return;
  try {
    performance.mark(name);
    if (typeof process !== "undefined" && process.env && process.env.MAMBO_PROFILE_APP) {
      console.log("[boot]", name, performance.now().toFixed(1) + "ms");
    }
  } catch {}
};
const bootInteractiveOnce = () => {
  bootMark("boot:interactive");
  window.removeEventListener("pointerdown", bootInteractiveOnce);
  window.removeEventListener("keydown", bootInteractiveOnce);
};
window.addEventListener("pointerdown", bootInteractiveOnce);
window.addEventListener("keydown", bootInteractiveOnce);

document.addEventListener('DOMContentLoaded', async () => {
  bootMark("boot:dom-ready");
  // Layer 1: Install global error boundary
  if (typeof Reliability !== 'undefined') Reliability.installErrorBoundary();

  fetchLiveDolarRates(false);
  await AppStorage.init();
  bootMark("boot:store-loaded");
  // IT37: la restauración de datos NUNCA debe matar el wiring de botones —
  // un throw acá (datos corruptos) dejaría la app renderizada pero muerta.
  // Los listeners de abajo SIEMPRE se adjuntan.
  try {
    const saved = await AppStorage.loadCatalog();
        bootMark("boot:catalog-loaded");
    if (saved && saved.items && saved.items.length) {
        // boot-interactivity (spec #4): el restore NO debe bloquear el
        // primer render: catalog + selección van de una; la validación de
        // integridad (costosa con 1.472 items + imágenes) corre al idle.
        catalog = saved.items;
        selection = (saved.sel || {});
        if (typeof Reliability !== 'undefined') {
          const defer = (window.requestIdleCallback || ((cb) => setTimeout(cb, 0)));
          defer(() => {
            try {
              const integrity = Reliability.validateCatalogIntegrity(catalog);
              if (integrity.issues.length > 0) {
                console.warn(`Integridad de catálogo: ${integrity.issues.length} problemas, ${integrity.repaired} reparados`);
              }
              const selResult = Reliability.cleanOrphanedSelection(selection, catalog);
              if (selResult.removed.length > 0) {
                console.warn(`Selección: ${selResult.removed.length} SKUs huérfanos removidos`);
              }
              selection = selResult.cleaned;
            } catch (e) { console.error('restore-pós-render:', e); }
          });
        }
    // Restaurar preferencia de vista (tabla/galería) entre sesiones
    try {
      const savedMode = localStorage.getItem('mambo_catalog_viewmode');
      if (savedMode === 'grid' && typeof CatalogView !== 'undefined' && CatalogView.setCatalogViewMode) {
        CatalogView.setCatalogViewMode('grid');
      }
    } catch { /* preferencia opcional */ }
    showCatalogContent();
    renderCatalog();
    toast(catalog.length + ' productos restaurados', 'info');
    }
  } catch (restoreErr) {
    console.error('Error restaurando catálogo — se continúa con app vacía:', restoreErr);
    if (typeof toast === 'function') toast('⚠️ No se pudo restaurar el catálogo guardado', 'warning');
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
      toast('Pedido importado: ' + items.length + ' SKUs', 'success');
    } catch(err) {
      toast('Error importando pedido: ' + err.message, 'error');
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

  bootMark("boot:listeners");
  // Verificación silenciosa de actualizaciones al inicio
  setTimeout(() => {
    if (typeof AppUpdater !== 'undefined') {
      AppUpdater.checkUpdate(false);
    }
  }, 3000);
});

// showDropOverlay/hideDropOverlay are now in src/js/ui/notifications.js

// Global Escape Key Listener for Modals + Atajos de teclado (app desktop)
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod) {
    const anyModalOpen = Array.from(document.querySelectorAll('.modal-backdrop')).some(m => m.style.display === 'flex');
    const key = e.key.toLowerCase();
    if (!anyModalOpen) {
      if (key === 'f') {
        const search = document.getElementById('catSearch');
        if (search) { e.preventDefault(); search.focus(); search.select(); return; }
      }
      if (['1', '2', '3', '4'].includes(key)) {
        e.preventDefault();
        switchView({ '1': 'catalogo', '2': 'pedido', '3': 'historial', '4': 'importaciones' }[key]);
        return;
      }
      if (e.key === 'Enter' && document.getElementById('view-catalogo')?.classList.contains('active')) {
        e.preventDefault();
        validarYOarmarPedido();
        return;
      }
    }
  }
  if (e.key === 'Escape') {
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
        closeConfirmModal();
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

    // IT18 (accesibilidad): focus trap + focus inicial dentro del modal abierto.
    // Un solo bootstrap global, sin tocar cada modal. El Trap aplica al modal
    // visible de mayor z-index (el último con display:flex).
    function __modalFocusTrap(e) {
      if (e.key !== 'Tab') return;
      const modals = Array.from(document.querySelectorAll('.modal-backdrop'))
        .filter(m => m.style.display === 'flex');
      if (!modals.length) return;
      const top = modals[modals.length - 1];
      const focusables = top.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', __modalFocusTrap);

    // Al abrir un modal, mover el foco al primer elemento interactivo dentro de él.
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => {
        const modals = Array.from(document.querySelectorAll('.modal-backdrop'))
          .filter(m => m.style.display === 'flex');
        if (!modals.length) return;
        const top = modals[modals.length - 1];
        if (top.contains(document.activeElement)) return;
        const f = top.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (f) f.focus();
      }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    }
