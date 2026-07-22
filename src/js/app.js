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

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function showProgress(pct) {
  const p = document.getElementById('progress');
  const b = document.getElementById('progressBar');
  if (p && b) {
    p.style.display = 'block';
    b.style.width = `${pct}%`;
  }
}

function hideProgress() {
  const p = document.getElementById('progress');
  if (p) p.style.display = 'none';
}

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

// Catálogo UI
function showCatalogContent() {
  document.getElementById('catalogEmpty').style.display = 'none';
  document.getElementById('catalogContent').style.display = 'block';
  document.getElementById('catalogActions').style.display = 'flex';
  populateCatalogFilters();
  updateBadges();
}

function populateCatalogFilters() {
  const marcas = [...new Set(catalog.map(r => r.marca))].sort();
  const cats = [...new Set(catalog.map(r => r.cat))].sort();
  const selM = document.getElementById('catFilterMarca');
  const selC = document.getElementById('catFilterCat');
  if (selM && selM.options.length <= 1) {
    marcas.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; selM.appendChild(o); });
  }
  if (selC && selC.options.length <= 1) {
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; selC.appendChild(o); });
  }
}

let currentPage = 1;
const pageSize = 50;

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderCatalog();
  }
}

function nextPage() {
  const txt = (document.getElementById('catSearch')?.value || '').toLowerCase();
  const marca = document.getElementById('catFilterMarca')?.value;
  const cat = document.getElementById('catFilterCat')?.value;
  const filteredCount = catalog.filter(r => {
    const matchTxt = !txt || (r.sku + ' ' + r.marca + ' ' + r.modelo + ' ' + (r.variante || '')).toLowerCase().includes(txt);
    const matchMarca = !marca || r.marca === marca;
    const matchCat = !cat || r.cat === cat;
    return matchTxt && matchMarca && matchCat;
  }).length;

  const totalPages = Math.ceil(filteredCount / pageSize) || 1;
  if (currentPage < totalPages) {
    currentPage++;
    renderCatalog();
  }
}

function renderCatalog() {
  if (!catalog.length) return;
  const txt = (document.getElementById('catSearch')?.value || '').toLowerCase();
  const marca = document.getElementById('catFilterMarca')?.value;
  const cat = document.getElementById('catFilterCat')?.value;

  const filtered = catalog.filter(r => {
    const matchTxt = !txt || (r.sku + ' ' + r.marca + ' ' + r.modelo + ' ' + (r.variante || '')).toLowerCase().includes(txt);
    const matchMarca = !marca || r.marca === marca;
    const matchCat = !cat || r.cat === cat;
    return matchTxt && matchMarca && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const pageIndicator = document.getElementById('pageIndicator');
  if (pageIndicator) pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;

  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const allFob = catalog.map(r => r.fob);
  document.getElementById('catKpiTotal').textContent = catalog.length;
  document.getElementById('catKpiMarcas').textContent = [...new Set(catalog.map(r => r.marca))].length + ' marcas';
  document.getElementById('catKpiMin').textContent = '$' + Math.min(...allFob).toFixed(0);
  document.getElementById('catKpiMax').textContent = '$' + Math.max(...allFob).toFixed(0);
  document.getElementById('catKpiAvg').textContent = '$' + (allFob.reduce((a, b) => a + b, 0) / allFob.length).toFixed(2);

  const selItems = Object.entries(selection);
  const selQty = selItems.reduce((s, [k, v]) => s + v, 0);
  const selFob = selItems.reduce((s, [k, v]) => {
    const item = catalog.find(r => r.sku === k);
    return s + (item ? item.fob * v : 0);
  }, 0);
  document.getElementById('catKpiSel').textContent = selQty + ' u';
  document.getElementById('catKpiSelFob').textContent = '$' + selFob.toFixed(2) + ' FOB';
  document.getElementById('catalogSubtitle').textContent = filtered.length + ' de ' + catalog.length + ' productos · ' + [...new Set(catalog.map(r => r.marca))].length + ' marcas';

  let html = '';
  pageItems.forEach(r => {
    const qty = selection[r.sku] || 0;
    const isSel = qty > 0;
    const skuJs = escJs(r.sku);
    html += '<tr' + (isSel ? ' style="background: rgba(255,90,31,0.05);"' : '') + '>';
    html += '<td class="checkbox"><input type="checkbox" ' + (isSel ? 'checked' : '') + ' onchange="toggleItem(\'' + skuJs + '\', this.checked)"></td>';
    html += '<td><code style="font-size: 10px; font-family: JetBrains Mono, monospace; color: var(--text-3);">' + esc(r.sku) + '</code></td>';
    html += '<td><input class="inline" value="' + esc(r.marca) + '" onchange="updateField(\'' + skuJs + '\', \'marca\', this.value)"></td>';
    html += '<td><input class="inline" value="' + esc(r.modelo) + '" onchange="updateField(\'' + skuJs + '\', \'modelo\', this.value)"></td>';
    html += '<td><input class="inline" value="' + esc(r.cat) + '" onchange="updateField(\'' + skuJs + '\', \'cat\', this.value)"></td>';
    html += '<td><input class="inline num" value="' + r.fob.toFixed(2) + '" onchange="updateField(\'' + skuJs + '\', \'fob\', this.value)"></td>';
    html += '<td><input class="inline num qty" type="number" value="' + qty + '" min="0" onchange="setQty(\'' + skuJs + '\', this.value)"></td>';
    html += '<td class="action"><button class="btn btn-sm" onclick="removeItem(\'' + skuJs + '\')" style="background: transparent; border: 1px solid var(--border); padding: 2px 6px; color: var(--red);">🗑</button></td>';
    html += '</tr>';
  });
  if (!filtered.length) {
    html = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-3);">Sin productos con esos filtros</td></tr>';
  }
  document.getElementById('catalogBody').innerHTML = html;
  AppStorage.saveCatalog(catalog, selection);
  updateBadges();
}

function toggleItem(sku, on) {
  if (on) { if (!selection[sku]) selection[sku] = 1; }
  else { delete selection[sku]; }
  renderCatalog();
}
function setQty(sku, val) {
  const qty = parseInt(val) || 0;
  if (qty > 0) selection[sku] = qty;
  else delete selection[sku];
  renderCatalog();
}
function toggleSelectAll(on) {
  if (on) catalog.forEach(r => selection[r.sku] = 1);
  else selection = {};
  renderCatalog();
}
function removeItem(sku) {
  if (!confirm('¿Eliminar ' + sku + '?')) return;
  catalog = catalog.filter(r => r.sku !== sku);
  delete selection[sku];
  renderCatalog();
}
function addCatalogItem() {
  const n = catalog.length + 1;
  const sku = 'NEW-' + String(n).padStart(4, '0');
  catalog.unshift({ sku, cat: 'OTRO', marca: '', modelo: 'Producto nuevo', variante: '', fob: 0 });
  showCatalogContent();
  renderCatalog();
  toast('➕ Producto agregado', 'success');
}
function resetCatalog() {
  if (!confirm('¿Borrar TODO el catálogo? Esta acción no se puede deshacer.')) return;
  catalog = [];
  selection = {};
  AppStorage.removeItem(AppStorage.KEYS.CATALOG);
  document.getElementById('catalogEmpty').style.display = 'block';
  document.getElementById('catalogContent').style.display = 'none';
  document.getElementById('catalogActions').style.display = 'none';
  updateBadges();
  toast('Catálogo reseteado', 'success');
}

function updateField(oldSku, field, value) {
  value = (value || '').toString().trim();
  const item = catalog.find(r => r.sku === oldSku);
  if (!item) return;

  const validation = Validations.validateField(field, value);
  const inputEl = (typeof event !== 'undefined' && event) ? event.target : null;
  if (inputEl) {
    if (validation.severity === 'error' || !validation.valid) {
      inputEl.classList.add('input-error');
    } else {
      inputEl.classList.remove('input-error');
    }
  }

  if (field === 'fob') {
    const n = parseFloat(value.replace(',', '.').replace(/[$\s]/g, ''));
    if (!isNaN(n) && n > 0 && n <= 500) { item.fob = n; }
    else { renderCatalog(); return; }
  } else if (field === 'sku' && value && value !== oldSku) {
    if (catalog.find(r => r.sku === value)) { toast('SKU duplicado', 'error'); renderCatalog(); return; }
    if (selection[oldSku]) { selection[value] = selection[oldSku]; delete selection[oldSku]; }
    item.sku = value;
  } else if (value) {
    item[field] = value;
  }
  renderCatalog();
}

// Preview Modal and Brand Manager State
let pendingPreviewItems = [];
let customBrandsList = [];

// Diccionario de Marcas Manager
async function openBrandManagerModal() {
  customBrandsList = await AppStorage.loadBrands();
  renderBrandList();
  const m = document.getElementById('brandManagerModal');
  if (m) m.style.display = 'flex';
}

function closeBrandManagerModal() {
  const m = document.getElementById('brandManagerModal');
  if (m) m.style.display = 'none';
}

async function addCustomBrand() {
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
  toast(`🏷️ Marca "${name}" guardada en el diccionario`, 'success');
}

async function deleteCustomBrand(idx) {
  customBrandsList.splice(idx, 1);
  await AppStorage.saveBrands(customBrandsList);
  renderBrandList();
  toast('Marca eliminada del diccionario', 'info');
}

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

// Interceptor de Importación con Vista Previa por Semáforo
async function processFiles(files) {
  if (!files.length) return;
  showProgress(0);
  customBrandsList = await AppStorage.loadBrands();
  pendingPreviewItems = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    showProgress(((i) / files.length) * 100);
    try {
      let incoming = [];
      if (f.name.toLowerCase().endsWith('.pdf')) {
        const res = await PdfParser.processPdfFile(f, catalog.length, customBrandsList);
        incoming = res.products;
      } else if (f.name.toLowerCase().endsWith('.csv')) {
        incoming = await FileImporter.processCsvFile(f, catalog);
      } else {
        incoming = await FileImporter.processExcelFile(f, catalog);
      }

      for (const item of incoming) {
        if (!item.status) {
          const evalRes = PdfParser.evaluateItemConfidence(item);
          item.confidence = evalRes.confidence;
          item.status = evalRes.status;
          item.warnings = evalRes.warnings;
        }
        item.sourceFile = f.name;
        item._selected = true;
        pendingPreviewItems.push(item);
      }
    } catch (err) {
      console.error('Error procesando ' + f.name, err);
      toast('❌ ' + f.name + ': ' + err.message, 'error');
    }
  }

  showProgress(100);
  setTimeout(hideProgress, 400);

  if (pendingPreviewItems.length > 0) {
    renderImportPreviewModal();
  } else {
    toast('⚠️ No se detectaron productos válidos en los archivos', 'warning');
  }
}

function renderImportPreviewModal() {
  const modal = document.getElementById('importPreviewModal');
  const body = document.getElementById('importPreviewBody');
  if (!modal || !body) return;

  const validCount = pendingPreviewItems.filter(i => i.status === 'VALID').length;
  const warnCount = pendingPreviewItems.filter(i => i.status === 'WARNING').length;
  const errCount = pendingPreviewItems.filter(i => i.status === 'ERROR').length;

  document.getElementById('badgeValidCount').textContent = `🟢 ${validCount} Confiables`;
  document.getElementById('badgeWarnCount').textContent = `🟡 ${warnCount} Revisar`;
  document.getElementById('badgeErrCount').textContent = `🔴 ${errCount} Incertidumbre`;
  document.getElementById('importPreviewSummary').textContent = `Se detectaron ${pendingPreviewItems.length} productos en los archivos. Podés editar marca o categoría en lote antes de confirmar.`;

  let html = '';
  pendingPreviewItems.forEach((item, i) => {
    let statusBadge = '🟢';
    if (item.status === 'WARNING') statusBadge = '🟡';
    if (item.status === 'ERROR') statusBadge = '🔴';

    const warnTooltip = (item.warnings && item.warnings.length) ? item.warnings.join(' · ') : 'Confiable';

    html += `<tr style="${item.status === 'ERROR' ? 'background: rgba(239,68,68,0.08);' : (item.status === 'WARNING' ? 'background: rgba(234,179,8,0.06);' : '')}">`;
    html += `<td style="text-align: center;"><input type="checkbox" ${item._selected ? 'checked' : ''} onchange="pendingPreviewItems[${i}]._selected = this.checked"></td>`;
    html += `<td style="text-align: center; font-size: 14px;" title="${esc(warnTooltip)}">${statusBadge}</td>`;
    html += `<td><input type="text" value="${esc(item.sku)}" style="width: 100%; border: none; background: transparent; font-family: monospace; font-size: 11px; color: #aaa;" onchange="pendingPreviewItems[${i}].sku = this.value"></td>`;
    html += `<td><input type="text" value="${esc(item.marca)}" style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: rgba(0,0,0,0.3); color: #fff; padding: 2px 6px;" onchange="pendingPreviewItems[${i}].marca = this.value"></td>`;
    html += `<td><input type="text" value="${esc(item.modelo)}" style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: rgba(0,0,0,0.3); color: #fff; padding: 2px 6px;" onchange="pendingPreviewItems[${i}].modelo = this.value"></td>`;
    html += `<td><input type="text" value="${esc(item.variante || '')}" style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: rgba(0,0,0,0.3); color: #ccc; padding: 2px 6px;" onchange="pendingPreviewItems[${i}].variante = this.value"></td>`;
    html += `<td>
      <select style="border: 1px solid var(--border); border-radius: 4px; background: rgba(0,0,0,0.3); color: #fff; padding: 2px 4px; font-size: 11px;" onchange="pendingPreviewItems[${i}].cat = this.value">
        ${['TECLADO','MOUSE','HEADSET','AURICULAR','CONTROLLER','MOUSEPAD','SWITCH','CAMARA','CUIDADO_PERSONAL','OTRO'].map(c => `<option value="${c}" ${c === item.cat ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </td>`;
    html += `<td class="num"><input type="number" step="0.01" value="${item.fob}" style="width: 70px; border: 1px solid var(--border); border-radius: 4px; background: rgba(0,0,0,0.3); color: #fff; padding: 2px 6px; text-align: right;" onchange="pendingPreviewItems[${i}].fob = parseFloat(this.value)||0"></td>`;
    html += `<td style="text-align: center;"><button class="btn btn-sm" onclick="removePreviewItem(${i})" style="color: var(--red); padding: 2px 4px;">🗑</button></td>`;
    html += `</tr>`;
  });

  body.innerHTML = html;
  modal.style.display = 'flex';
}

function toggleSelectAllPreview(checked) {
  pendingPreviewItems.forEach(i => i._selected = checked);
  renderImportPreviewModal();
}

function applyBatchBrand() {
  const brand = (document.getElementById('batchBrandInput')?.value || '').trim();
  if (!brand) return;
  let count = 0;
  pendingPreviewItems.forEach(i => {
    if (i._selected) {
      i.marca = brand;
      count++;
    }
  });
  renderImportPreviewModal();
  toast(`🛠️ Marca "${brand}" aplicada a ${count} ítems`, 'success');
}

function applyBatchCat() {
  const cat = document.getElementById('batchCatSelect')?.value;
  if (!cat) return;
  let count = 0;
  pendingPreviewItems.forEach(i => {
    if (i._selected) {
      i.cat = cat;
      count++;
    }
  });
  renderImportPreviewModal();
  toast(`🛠️ Categoría "${cat}" aplicada a ${count} ítems`, 'success');
}

function removePreviewItem(idx) {
  pendingPreviewItems.splice(idx, 1);
  if (!pendingPreviewItems.length) {
    closeImportPreviewModal();
  } else {
    renderImportPreviewModal();
  }
}

function closeImportPreviewModal() {
  const modal = document.getElementById('importPreviewModal');
  if (modal) modal.style.display = 'none';
  pendingPreviewItems = [];
}

async function confirmImportPreview() {
  const selectedItems = pendingPreviewItems.filter(i => i._selected);
  if (!selectedItems.length) {
    toast('No hay productos seleccionados para importar', 'warning');
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of selectedItems) {
    const existing = catalog.find(c =>
      (c.sku && item.sku && c.sku === item.sku) ||
      (c.marca.toLowerCase().trim() === item.marca.toLowerCase().trim() &&
       c.modelo.toLowerCase().trim() === item.modelo.toLowerCase().trim() &&
       (c.variante || '').toLowerCase().trim() === (item.variante || '').toLowerCase().trim())
    );

    if (existing) {
      if (Math.abs(existing.fob - item.fob) >= 0.01) {
        existing.fob = item.fob;
        existing.cat = item.cat || existing.cat;
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      catalog.push({
        sku: item.sku,
        cat: item.cat || 'OTRO',
        marca: item.marca || 'OTRO',
        modelo: item.modelo,
        variante: item.variante || '',
        fob: item.fob
      });
      addedCount++;
    }
  }

  await AppStorage.saveCatalog(catalog, selection);
  showCatalogContent();
  renderCatalog();
  closeImportPreviewModal();

  let msg = `✅ Importación completada: ${addedCount} nuevos`;
  if (updatedCount > 0) msg += `, ${updatedCount} precios actualizados`;
  if (skippedCount > 0) msg += ` (${skippedCount} sin cambios)`;

  toast(msg, 'success');
}

// Pedido UI
function validarYOarmarPedido() {
  if (!Object.keys(selection).length) {
    toast('Seleccioná al menos un producto', 'error');
    return;
  }
  const items = Object.entries(selection).map(([sku, qty]) => {
    const r = catalog.find(c => c.sku === sku);
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, color: r.variante || '', fob: r.fob, qty };
  });

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
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, color: r.variante || '', fob: r.fob, qty };
  });
  currentPedido = { name: 'Pedido ' + new Date().toLocaleDateString('es-AR'), items, costs: getCostInputs(), date: new Date().toISOString() };
  switchView('pedido');
  renderPedido();
  toast('📦 Pedido armado: ' + items.length + ' SKUs', 'success');
}

function getCostInputs() {
  return {
    flete: document.getElementById('cFlete')?.value || 15,
    seguro: document.getElementById('cSeguro')?.value || 2,
    derechos: document.getElementById('cDerechos')?.value || 16,
    tasa: document.getElementById('cTasa')?.value || 3,
    perc: document.getElementById('cPerc')?.value || 6,
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
    if (document.getElementById('cSeguro')) document.getElementById('cSeguro').value = c.seguro;
    if (document.getElementById('cDerechos')) document.getElementById('cDerechos').value = c.derechos;
    if (document.getElementById('cTasa')) document.getElementById('cTasa').value = c.tasa;
    if (document.getElementById('cPerc')) document.getElementById('cPerc').value = c.perc;
    if (document.getElementById('cDesp')) document.getElementById('cDesp').value = c.desp;
    if (document.getElementById('cCourier')) document.getElementById('cCourier').value = c.courier;
    if (document.getElementById('cMarkup')) document.getElementById('cMarkup').value = c.markup;
    if (document.getElementById('cTasaCambio')) document.getElementById('cTasaCambio').value = c.tipoCambio || 1400;
  }

  recalc();
}

function recalc() {
  if (!currentPedido) return;
  const costInputs = getCostInputs();
  const res = Calculator.calculateOrder(currentPedido.items, costInputs);

  currentPedido.items = res.items;
  currentPedido.costs = costInputs;
  const t = res.totals;

  document.getElementById('pedFob').textContent = '$' + t.fob.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' USD';
  document.getElementById('pedFobSub').textContent = t.qty + ' u · ARS $' + (t.fobArs || 0).toLocaleString();
  document.getElementById('pedCosto').textContent = '$' + Math.round(t.costo).toLocaleString() + ' USD';
  document.getElementById('pedFact').textContent = '$' + t.facturacion.toLocaleString() + ' USD';
  document.getElementById('pedMargen').textContent = '$' + Math.round(t.margen).toLocaleString() + ' USD';
  document.getElementById('pedMargenSub').textContent = t.facturacion > 0 ? t.margenPct + '% margen (ARS $' + (t.margenArs || 0).toLocaleString() + ')' : '—';
  document.getElementById('pedidoSubtitle').textContent = currentPedido.items.length + ' SKUs · ' + t.qty + ' unidades · TC: $' + t.tipoCambio + '/USD';
  document.getElementById('pedidoMeta').textContent = 'Actualizado: ' + new Date().toLocaleString('es-AR') + ' · Facturación ARS: $' + (t.facturacionArs || 0).toLocaleString();
  document.getElementById('pedTableMeta').textContent = currentPedido.items.length + ' SKUs · ' + t.qty + ' unidades';
  renderPedidoTable();
}

function renderPedidoTable() {
  if (!currentPedido) return;
  let html = '';
  currentPedido.items.forEach((r, i) => {
    html += '<tr>';
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

// Historial UI
async function saveToHistorial() {
  if (!currentPedido || !currentPedido.items.length) { toast('No hay pedido', 'error'); return; }

  const validation = Validations.validateOrder({ items: currentPedido.items });
  if (!validation.valid) {
    showValidationPanel(validation.errors, validation.warnings);
    toast('❌ Hay errores que corregir antes de guardar', 'error');
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
  toast('💾 ' + currentPedido.name + ' guardado', 'success');
  updateBadges();
  hideValidationPanel();
  switchView('historial');
}

async function renderHistorial() {
  const list = await AppStorage.loadHistorial();
  const cont = document.getElementById('historialList');
  document.getElementById('historialSubtitle').textContent = list.length + ' pedido' + (list.length !== 1 ? 's' : '') + ' guardado' + (list.length !== 1 ? 's' : '');
  if (!list.length) {
    cont.innerHTML = '<div class="card"><div class="empty"><div class="empty-icon">📋</div><div class="empty-title">Sin pedidos guardados</div><div class="empty-sub">Armá un pedido desde el catálogo y hacé click en "Guardar en historial".</div></div></div>';
    return;
  }
  let html = '';
  list.forEach((p, i) => {
    const t = p.totals || {};
    const date = new Date(p.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    html += '<div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">';
    html += '<div><div class="card-title">' + esc(p.name) + '</div><div class="muted text-sm">' + (p.items ? p.items.length : 0) + ' SKUs · ' + (t.qty || 0) + ' unidades · ' + date + '</div></div>';
    html += '<div class="row" style="gap: 24px;">';
    html += '<div><div class="muted" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">FOB</div><div style="font-family: JetBrains Mono, monospace; font-weight: 600;">$' + (t.fob || 0).toFixed(0) + '</div></div>';
    html += '<div><div class="muted" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">Costo</div><div style="font-family: JetBrains Mono, monospace; font-weight: 600; color: var(--blue);">$' + (t.costo || 0).toFixed(0) + '</div></div>';
    html += '<div><div class="muted" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">Fact</div><div style="font-family: JetBrains Mono, monospace; font-weight: 600; color: var(--accent);">$' + (t.facturacion || t.fact || 0).toFixed(0) + '</div></div>';
    html += '<div><div class="muted" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">Margen</div><div style="font-family: JetBrains Mono, monospace; font-weight: 600; color: var(--green);">$' + (t.margen || 0).toFixed(0) + '</div></div>';
    html += '</div>';
    html += '<div class="row" style="gap: 6px;">';
    html += '<button class="btn btn-sm" onclick="loadFromHistorial(' + i + ')">Abrir</button>';
    html += '<button class="btn btn-sm" style="color: var(--red);" onclick="deleteFromHistorial(' + i + ')">🗑</button>';
    html += '</div></div>';
  });
  cont.innerHTML = html;
}

async function loadFromHistorial(idx) {
  const list = await AppStorage.loadHistorial();
  currentPedido = list[idx];
  switchView('pedido');
  renderPedido();
  toast('📂 Pedido cargado', 'info');
}
async function deleteFromHistorial(idx) {
  if (!confirm('¿Borrar este pedido?')) return;
  const list = await AppStorage.loadHistorial();
  list.splice(idx, 1);
  await AppStorage.saveHistorial(list);
  renderHistorial();
  updateBadges();
}

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
  showCatalogContent();
  renderCatalog();
  toast('🎮 ' + catalog.length + ' productos demo cargados', 'success');
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
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
        sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, color: r.variante || '', fob: r.fob, qty: 1
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
});

function showDropOverlay() {
  if (document.getElementById('dropOverlay')) return;
  const o = document.createElement('div');
  o.id = 'dropOverlay';
  o.style.cssText = 'position: fixed; inset: 0; background: rgba(255,90,31,0.1); border: 3px dashed #FF5A1F; z-index: 9999; display: flex; align-items: center; justify-content: center; pointer-events: none; backdrop-filter: blur(4px);';
  o.innerHTML = '<div style="background: var(--surface); border: 1px solid var(--accent); border-radius: 12px; padding: 32px 48px; text-align: center;"><div style="font-size: 48px;">📥</div><div style="font-family: Sora, sans-serif; font-size: 18px; font-weight: 700; margin-top: 8px;">Soltá los archivos</div></div>';
  document.body.appendChild(o);
}
function hideDropOverlay() { const e = document.getElementById('dropOverlay'); if (e) e.remove(); }
