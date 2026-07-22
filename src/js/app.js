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

function showProgress(pct, statusText = 'Procesando archivos...', subText = '') {
  const p = document.getElementById('progress');
  const b = document.getElementById('progressBar');
  if (p && b) {
    p.style.display = 'block';
    b.style.width = `${pct}%`;
  }

  const overlay = document.getElementById('loadingOverlay');
  const progressBar = document.getElementById('progressBarInner');
  const progressPct = document.getElementById('progressPctText');
  const progressTitle = document.getElementById('progressTitleText');
  const progressSub = document.getElementById('progressSubText');

  const cleanPct = Math.min(100, Math.max(0, Math.round(pct)));

  if (overlay) overlay.style.display = 'flex';
  if (progressBar) progressBar.style.width = `${cleanPct}%`;
  if (progressPct) progressPct.textContent = `${cleanPct}%`;
  if (progressTitle && statusText) progressTitle.textContent = statusText;
  if (progressSub && subText) progressSub.textContent = subText;
}

function hideProgress() {
  const p = document.getElementById('progress');
  if (p) p.style.display = 'none';

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    showProgress(100, '¡Carga completada al 100%!', 'Abriendo vista previa...');
    setTimeout(() => {
      overlay.style.display = 'none';
      if (typeof AiDisambiguator !== 'undefined' && AiDisambiguator.unloadNeuralVisionEngine) {
        AiDisambiguator.unloadNeuralVisionEngine();
      }
    }, 450);
  }
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
  const marcas = [...new Set(catalog.map(r => r.marca).filter(Boolean))].sort();
  const cats = [...new Set(catalog.map(r => r.cat).filter(Boolean))].sort();
  const selM = document.getElementById('catFilterMarca');
  const selC = document.getElementById('catFilterCat');

  if (selM) {
    const curVal = selM.value;
    selM.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      if (m === curVal) o.selected = true;
      selM.appendChild(o);
    });
  }

  if (selC) {
    const curVal = selC.value;
    selC.innerHTML = '<option value="">Todas las categorías</option>';
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      if (c === curVal) o.selected = true;
      selC.appendChild(o);
    });
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

function adjustQty(sku, delta) {
  const current = selection[sku] || 0;
  const next = Math.max(0, current + delta);
  if (next > 0) selection[sku] = next;
  else delete selection[sku];
  renderCatalog();
}

let activeCategoryChip = '';

function setCatChip(cat, el) {
  activeCategoryChip = cat;
  const chips = document.querySelectorAll('#catFilterChips .chip');
  chips.forEach(c => {
    c.style.background = 'var(--surface)';
    c.style.borderColor = 'var(--border)';
    c.style.color = 'var(--text-muted)';
    c.classList.remove('active');
  });

  if (el) {
    el.classList.add('active');
    if (cat === 'SELECTED_ONLY') {
      el.style.background = 'rgba(16,185,129,0.25)';
      el.style.borderColor = 'rgba(16,185,129,0.6)';
      el.style.color = '#34d399';
    } else {
      el.style.background = 'rgba(255,87,34,0.2)';
      el.style.borderColor = 'var(--primary)';
      el.style.color = '#fff';
    }
  }

  // Si seleccionó una categoría normal, sincronizar select
  const catSelect = document.getElementById('catFilterCat');
  if (catSelect && cat !== 'SELECTED_ONLY') {
    catSelect.value = cat;
  }
  renderCatalog();
}

function syncMarkup(val, origin) {
  const numInput = document.getElementById('cMarkup');
  const rangeInput = document.getElementById('cMarkupRange');
  const numVal = parseFloat(val) || 2.5;

  if (origin === 'range' && numInput) numInput.value = numVal.toFixed(2);
  if (origin === 'num' && rangeInput) rangeInput.value = numVal;

  recalc();
}

function renderCatalog() {
  if (!catalog.length) return;
  const txt = (document.getElementById('catSearch')?.value || '').toLowerCase();
  const marca = document.getElementById('catFilterMarca')?.value;
  const cat = document.getElementById('catFilterCat')?.value;
  const minPrice = parseFloat(document.getElementById('catFilterMinPrice')?.value) || 0;
  const maxPrice = parseFloat(document.getElementById('catFilterMaxPrice')?.value) || Infinity;

  const filtered = catalog.filter(r => {
    const matchTxt = !txt || (r.sku + ' ' + r.marca + ' ' + r.modelo + ' ' + (r.variante || '')).toLowerCase().includes(txt);
    const matchMarca = !marca || r.marca === marca;
    let matchCat = !cat || r.cat === cat;
    if (activeCategoryChip === 'SELECTED_ONLY') {
      matchCat = (selection[r.sku] || 0) > 0;
    } else if (activeCategoryChip) {
      matchCat = r.cat === activeCategoryChip;
    }
    const matchPrice = (r.fob >= minPrice) && (r.fob <= maxPrice);
    return matchTxt && matchMarca && matchCat && matchPrice;
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

  // Actualizar Sticky Order Bar
  const stickyBar = document.getElementById('stickyOrderBar');
  const stickyCount = document.getElementById('stickySelCount');
  const stickyFob = document.getElementById('stickySelFob');
  if (stickyBar) {
    if (selQty > 0) {
      stickyBar.style.display = 'flex';
      if (stickyCount) stickyCount.textContent = `${selQty} producto${selQty > 1 ? 's' : ''}`;
      if (stickyFob) stickyFob.textContent = `$${selFob.toFixed(2)} FOB`;
    } else {
      stickyBar.style.display = 'none';
    }
  }

  let html = '';
  pageItems.forEach(r => {
    const qty = selection[r.sku] || 0;
    const isSel = qty > 0;
    const skuJs = escJs(r.sku);
    const DEFAULT_SVG_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#181824"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="36">🖼️</text></svg>');
    const imgHtml = r.img ? `<img src="${esc(r.img)}" onerror="this.onerror=null; this.src='${DEFAULT_SVG_IMG}';" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; cursor: zoom-in; background: rgba(0,0,0,0.3); border: 1px solid var(--border);" onclick="zoomImage('${skuJs}')">` : `<span style="font-size: 16px; opacity: 0.3;">🖼️</span>`;
    html += '<tr' + (isSel ? ' style="background: rgba(255,90,31,0.05);"' : '') + '>';
    html += '<td class="checkbox"><input type="checkbox" ' + (isSel ? 'checked' : '') + ' onchange="toggleItem(\'' + skuJs + '\', this.checked)"></td>';
    html += '<td style="text-align: center;">' + imgHtml + '</td>';
    html += '<td><code style="font-size: 10px; font-family: JetBrains Mono, monospace; color: var(--text-3);">' + esc(r.sku) + '</code></td>';
    html += '<td><input class="inline" value="' + esc(r.marca) + '" onchange="updateField(\'' + skuJs + '\', \'marca\', this.value)"></td>';
    html += '<td><input class="inline" value="' + esc(r.modelo) + '" onchange="updateField(\'' + skuJs + '\', \'modelo\', this.value)"></td>';
    html += '<td><input class="inline" value="' + esc(r.cat) + '" onchange="updateField(\'' + skuJs + '\', \'cat\', this.value)"></td>';
    html += '<td><input class="inline num" value="' + r.fob.toFixed(2) + '" onchange="updateField(\'' + skuJs + '\', \'fob\', this.value)"></td>';
    html += '<td>';
    html += '<div style="display: flex; align-items: center; gap: 4px;">';
    html += '<button class="btn btn-sm" onclick="adjustQty(\'' + skuJs + '\', -1)" style="padding: 1px 6px; font-weight: 700;">-</button>';
    html += '<input class="inline num qty" type="number" value="' + qty + '" min="0" style="width: 45px; text-align: center;" onchange="setQty(\'' + skuJs + '\', this.value)">';
    html += '<button class="btn btn-sm" onclick="adjustQty(\'' + skuJs + '\', 1)" style="padding: 1px 6px; font-weight: 700;">+</button>';
    html += '</div>';
    html += '</td>';
    html += '<td class="action"><button class="btn btn-sm" onclick="removeItem(\'' + skuJs + '\')" style="background: transparent; border: 1px solid var(--border); padding: 2px 6px; color: var(--red);">🗑</button></td>';
    html += '</tr>';
  });
  const gridEl = document.getElementById('catalogGrid');
  if (catalogViewMode === 'grid') {
    let gridHtml = '';
    const DEFAULT_SVG_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#181824"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="36">🖼️</text></svg>');
    pageItems.forEach(r => {
      const qty = selection[r.sku] || 0;
      const isSel = qty > 0;
      const skuJs = escJs(r.sku);
      const pvp = (r.fob * 2.5).toFixed(2);
      const imgSrc = r.img || DEFAULT_SVG_IMG;

      gridHtml += `<div class="card" style="padding: 12px; display: flex; flex-direction: column; gap: 10px; border: ${isSel ? '2px solid var(--primary)' : '1px solid var(--border)'}; background: ${isSel ? 'rgba(255,87,34,0.05)' : 'var(--surface)'}; border-radius: 12px; position: relative;">`;
      gridHtml += `<div style="width: 100%; height: 140px; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: zoom-in;" onclick="zoomImage('${skuJs}')">`;
      gridHtml += `<img src="${esc(imgSrc)}" onerror="this.onerror=null; this.src='${DEFAULT_SVG_IMG}';" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: -webkit-optimize-contrast;">`;
      gridHtml += `</div>`;
      gridHtml += `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">`;
      gridHtml += `<span style="font-weight: 700; color: var(--primary); background: rgba(255,87,34,0.15); padding: 2px 6px; border-radius: 4px;">${esc(r.marca)}</span>`;
      gridHtml += `<code style="font-size: 10px; color: var(--text-3);">${esc(r.sku)}</code>`;
      gridHtml += `</div>`;
      const variantHtml = r.variante ? `<span style="display: inline-block; font-size: 10px; font-weight: 600; color: #a7f3d0; background: rgba(16,185,129,0.15); padding: 1px 5px; border-radius: 4px; margin-left: 6px;">${esc(r.variante)}</span>` : '';
      gridHtml += `<div style="font-weight: 700; font-size: 13px; color: #fff; line-height: 1.3; height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${esc(r.modelo)}${variantHtml}</div>`;
      gridHtml += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">`;
      gridHtml += `<div><span style="font-size: 10px; color: var(--text-muted); display: block;">FOB</span><strong style="color: #38bdf8;">$${r.fob.toFixed(2)}</strong></div>`;
      gridHtml += `<div><span style="font-size: 10px; color: var(--text-muted); display: block;">PVP Est.</span><strong style="color: #34d399;">$${pvp}</strong></div>`;
      gridHtml += `</div>`;
      gridHtml += `<div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-pt: 4px;">`;
      gridHtml += `<button class="btn btn-sm" onclick="adjustQty('${skuJs}', -1)" style="padding: 4px 10px; font-weight: 800;">-</button>`;
      gridHtml += `<span style="font-weight: 800; font-size: 14px; color: ${isSel ? 'var(--primary)' : 'var(--text-muted)'};">${qty} u</span>`;
      gridHtml += `<button class="btn btn-sm btn-primary" onclick="adjustQty('${skuJs}', 1)" style="padding: 4px 10px; font-weight: 800;">+</button>`;
      gridHtml += `</div>`;
      gridHtml += `</div>`;
    });
    if (gridEl) gridEl.innerHTML = gridHtml || '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-3);">Sin productos con esos filtros</div>';
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
  showProgress(0, 'Iniciando carga de catálogos...', `0 de ${files.length} archivos`);
  customBrandsList = await AppStorage.loadBrands();
  pendingPreviewItems = [];

  const totalFiles = files.length;
  for (let i = 0; i < totalFiles; i++) {
    const f = files[i];
    const basePct = (i / totalFiles) * 100;
    const stepPct = (1 / totalFiles) * 100;

    showProgress(basePct, `Cargando ${f.name}...`, `Archivo ${i + 1} de ${totalFiles}`);

    try {
      let incoming = [];
      if (f.name.toLowerCase().endsWith('.pdf')) {
        const res = await PdfParser.processPdfFile(f, catalog.length, customBrandsList, (page, totalPages) => {
          const filePct = (page / totalPages) * stepPct;
          const currentPct = Math.round(basePct + filePct);
          showProgress(currentPct, `Analizando ${f.name}`, `Página ${page} de ${totalPages} · ${currentPct}%`);
        });
        incoming = res.products;
      } else if (f.name.toLowerCase().endsWith('.csv')) {
        incoming = await FileImporter.processCsvFile(f, catalog);
        showProgress(basePct + stepPct, `Procesando ${f.name}`, `Archivo ${i + 1} de ${totalFiles}`);
      } else {
        incoming = await FileImporter.processExcelFile(f, catalog);
        showProgress(basePct + stepPct, `Procesando ${f.name}`, `Archivo ${i + 1} de ${totalFiles}`);
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

  showProgress(100, '¡Carga completada al 100%!', 'Procesando catálogo final...');
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

async function autoCorrectPreviewWithAI() {
  if (!pendingPreviewItems || !pendingPreviewItems.length) return;
  toast('🧠 Analizando con IA...', 'info');
  const res = await AiDisambiguator.autoCorrectItems(pendingPreviewItems, customBrandsList);
  pendingPreviewItems = res.items;
  renderImportPreviewModal();
  if (res.correctedCount > 0) {
    toast(`✨ IA desambiguó y corrigió ${res.correctedCount} productos`, 'success');
  } else {
    toast(`ℹ️ No se requirieron correcciones adicionales`, 'info');
  }
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
        fob: item.fob,
        img: item.img || ''
      });
      addedCount++;
    }
  }

  await AppStorage.saveCatalog(catalog, selection);
  showCatalogContent();
  populateCatalogFilters();
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
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, color: r.variante || '', fob: r.fob, img: r ? r.img || '' : '', qty };
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
    return { sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, color: r.variante || '', fob: r.fob, img: r ? r.img || '' : '', qty };
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

function clonarPedido(index) {
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
  toast('👯 Pedido clonado exitosamente', 'success');
}

function copiarResumenPedido(index) {
  if (!historial[index]) return;
  const p = historial[index];
  const t = p.totals || {};
  let txt = `📦 ${p.name}\n`;
  txt += `📅 Fecha: ${new Date(p.date).toLocaleDateString('es-AR')}\n`;
  txt += `------------------------------\n`;
  p.items.forEach(it => {
    txt += `• ${it.qty}x ${it.marca} ${it.modelo} (${it.sku}) - PVP: $${(it.pvp || 0).toLocaleString()}\n`;
  });
  txt += `------------------------------\n`;
  txt += `💵 FOB Total: $${(t.fob || 0).toLocaleString()} USD\n`;
  txt += `🚢 Costo Puesto en País: $${(t.costo || 0).toLocaleString()} USD\n`;
  txt += `💰 Facturación Proyectada: $${(t.facturacion || 0).toLocaleString()} USD\n`;
  txt += `🟢 Ganancia Neta: $${(t.margen || 0).toLocaleString()} USD (${t.margenPct || 0}%)\n`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      toast('📋 Resumen copiado al portapapeles', 'success');
    });
  } else {
    toast('📋 Resumen generado en la consola', 'info');
    console.log(txt);
  }
}

// Listener de Drag & Drop para toda la ventana
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  const overlay = document.getElementById('dropOverlay');
  if (overlay) overlay.style.display = 'flex';
});

window.addEventListener('dragleave', (e) => {
  if (e.clientX === 0 && e.clientY === 0) {
    const overlay = document.getElementById('dropOverlay');
    if (overlay) overlay.style.display = 'none';
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const overlay = document.getElementById('dropOverlay');
  if (overlay) overlay.style.display = 'none';
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    FileImporter.processFiles(e.dataTransfer.files);
  }
});

let catalogViewMode = 'table';
let activeZoomSku = null;

function setCatalogViewMode(mode) {
  catalogViewMode = mode;
  const btnTable = document.getElementById('btnViewTable');
  const btnGrid = document.getElementById('btnViewGrid');
  const tableWrap = document.getElementById('catalogTableWrap');
  const gridWrap = document.getElementById('catalogGrid');

  if (mode === 'grid') {
    if (btnTable) { btnTable.style.background = 'transparent'; btnTable.style.color = 'var(--text-muted)'; }
    if (btnGrid) { btnGrid.style.background = 'var(--primary)'; btnGrid.style.color = '#fff'; }
    if (tableWrap) tableWrap.style.display = 'none';
    if (gridWrap) gridWrap.style.display = 'grid';
  } else {
    if (btnTable) { btnTable.style.background = 'var(--primary)'; btnTable.style.color = '#fff'; }
    if (btnGrid) { btnGrid.style.background = 'transparent'; btnGrid.style.color = 'var(--text-muted)'; }
    if (tableWrap) tableWrap.style.display = 'block';
    if (gridWrap) gridWrap.style.display = 'none';
  }
  renderCatalog();
}

function zoomImage(sku) {
  activeZoomSku = sku;
  const item = catalog.find(r => r.sku === sku);
  if (item) {
    zoomImageByUrl(item.img || '', `${item.marca} ${item.modelo} (${item.sku})`);
  }
}

function zoomImageByUrl(url, caption) {
  const modal = document.getElementById('imageZoomModal');
  const srcEl = document.getElementById('imageZoomSrc');
  const capEl = document.getElementById('imageZoomCaption');

  const fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e1e2d"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="40">🖼️</text></svg>');
  if (srcEl) srcEl.src = url || fallbackSvg;
  if (capEl) capEl.textContent = caption || '';
  if (modal) modal.style.display = 'flex';
}

function openSupplierCompareModal() {
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
        <div style="font-size: 40px; margin-bottom: 12px;">📊</div>
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
      html += `<div style="font-weight: 800; font-size: 15px; color: #fff;">📦 ${esc(list[0].modelo)}</div>`;
      html += `<div style="font-size: 12px; color: #34d399; font-weight: 700; background: rgba(16,185,129,0.15); padding: 4px 10px; border-radius: 20px;">Ahorro máximo: $${diffFob.toFixed(2)} USD (${diffPct}%)</div>`;
      html += `</div>`;

      html += `<table style="width: 100%; font-size: 12px; border-collapse: collapse;">`;
      html += `<thead><tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--text-muted);"><th style="padding: 6px;">Proveedor / Marca</th><th style="padding: 6px;">SKU</th><th style="padding: 6px;">Categoría</th><th style="padding: 6px; text-align: right;">FOB Unit (USD)</th><th style="padding: 6px; text-align: center;">Estado</th></tr></thead>`;
      html += `<tbody>`;

      list.forEach((item, idx) => {
        const isBest = idx === 0;
        html += `<tr style="border-bottom: 1px solid var(--border); ${isBest ? 'background: rgba(16,185,129,0.08);' : ''}">`;
        html += `<td style="padding: 8px; font-weight: 700; color: #fff;">${esc(item.marca)}</td>`;
        html += `<td style="padding: 8px; font-family: monospace; color: var(--text-muted);">${esc(item.sku)}</td>`;
        html += `<td style="padding: 8px; color: var(--text-muted);">${esc(item.cat)}</td>`;
        html += `<td style="padding: 8px; text-align: right; font-weight: 800; color: ${isBest ? '#34d399' : '#f87171'};">$${item.fob.toFixed(2)}</td>`;
        html += `<td style="padding: 8px; text-align: center;">${isBest ? '<span style="font-size: 11px; font-weight: 800; color: #34d399; background: rgba(16,185,129,0.2); padding: 2px 8px; border-radius: 12px;">🟢 MEJOR PRECIO</span>' : '<span style="font-size: 11px; color: var(--text-muted);">+$' + (item.fob - minFob).toFixed(2) + '</span>'}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    });
    body.innerHTML = html;
  }
  modal.style.display = 'flex';
}

function closeSupplierCompareModal() {
  const modal = document.getElementById('supplierCompareModal');
  if (modal) modal.style.display = 'none';
}

function openSensitivitySimulatorModal() {
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
  runSensitivitySimulation();
}

function closeSensitivitySimulatorModal() {
  const modal = document.getElementById('sensitivitySimulatorModal');
  if (modal) modal.style.display = 'none';
}

function runSensitivitySimulation() {
  if (!currentPedido || !currentPedido.items || !currentPedido.items.length) return;

  const tcRange = parseFloat(document.getElementById('simTcRange')?.value) || 1400;
  const fleteRange = parseFloat(document.getElementById('simFleteRange')?.value) || 0;
  const margenRange = parseFloat(document.getElementById('simMargenRange')?.value) || 35;

  if (document.getElementById('simTcVal')) document.getElementById('simTcVal').textContent = `$${tcRange} ARS`;
  if (document.getElementById('simFleteVal')) document.getElementById('simFleteVal').textContent = `${fleteRange > 0 ? '+' : ''}${fleteRange}%`;
  if (document.getElementById('simMargenVal')) document.getElementById('simMargenVal').textContent = `${margenRange}%`;

  const origCosts = getCostInputs();
  const simCosts = JSON.parse(JSON.stringify(origCosts));

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

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Costo Puesto Simulado</div>
    <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">$${Math.round(simT.costo).toLocaleString()} USD</div>
    <div style="font-size: 11px; color: ${diffCostoUsd >= 0 ? '#f87171' : '#34d399'};">${diffCostoUsd >= 0 ? '+' : ''}$${Math.round(diffCostoUsd).toLocaleString()} USD vs actual</div>
  </div>`;

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Facturación Objetivo</div>
    <div style="font-size: 18px; font-weight: 800; color: var(--accent);">$${Math.round(simTargetFactUsd).toLocaleString()} USD</div>
    <div style="font-size: 11px; color: var(--text-muted);">ARS $${Math.round(simTargetFactArs).toLocaleString()}</div>
  </div>`;

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Ganancia Limpia Objetivo</div>
    <div style="font-size: 18px; font-weight: 800; color: #34d399;">$${Math.round(simTargetMargenUsd).toLocaleString()} USD</div>
    <div style="font-size: 11px; color: #34d399;">${margenRange}% margen neto sobre venta</div>
  </div>`;

  html += `</div>`;

  html += `<div class="card-title" style="font-size: 13px; margin-bottom: 8px;">PVP Sugerido por Producto para asegurar ${margenRange}% de Ganancia Neta</div>`;
  html += `<table style="width: 100%; font-size: 12px; border-collapse: collapse;">`;
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
}

let liveDolarData = null;

async function fetchLiveDolarRates(userInitiated = false) {
  if (userInitiated) toast('🔄 Consultando DólarAPI en vivo...', 'info');
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' });
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
  if (mayorista) html += `<span class="dolar-chip" onclick="applyDolarRate('mayorista')" style="cursor: pointer; background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #fff;" title="Click para aplicar $${mayorista} ARS">🏛️ Mayorista: $${Math.round(mayorista)}</span>`;
  if (oficial) html += `<span class="dolar-chip" onclick="applyDolarRate('oficial')" style="cursor: pointer; background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #fff;" title="Click para aplicar $${oficial} ARS">🏢 Oficial: $${Math.round(oficial)}</span>`;
  if (blue) html += `<span class="dolar-chip" onclick="applyDolarRate('blue')" style="cursor: pointer; background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #38bdf8;" title="Click para aplicar $${blue} ARS">💙 Blue: $${Math.round(blue)}</span>`;
  if (mep) html += `<span class="dolar-chip" onclick="applyDolarRate('mep')" style="cursor: pointer; background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #a5b4fc;" title="Click para aplicar $${mep} ARS">📈 MEP: $${Math.round(mep)}</span>`;
  if (cripto) html += `<span class="dolar-chip" onclick="applyDolarRate('cripto')" style="cursor: pointer; background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #34d399;" title="Click para aplicar $${cripto} ARS">⚡ Cripto: $${Math.round(cripto)}</span>`;

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
    toast(`💵 Tasa de Cambio aplicada: Dólar ${key.toUpperCase()} ($${Math.round(val)} ARS)`, 'success');
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

function openBreakEvenModal() {
  if (!currentPedido || !currentPedido.items || !currentPedido.items.length) {
    toast('Armá o abrí un pedido para calcular el punto de equilibrio', 'error');
    return;
  }
  const modal = document.getElementById('breakEvenModal');
  if (modal) modal.style.display = 'flex';
  runBreakEvenCalculation();
}

function closeBreakEvenModal() {
  const modal = document.getElementById('breakEvenModal');
  if (modal) modal.style.display = 'none';
}

function runBreakEvenCalculation() {
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

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Gastos Fijos Mensuales</div>
    <div style="font-size: 18px; font-weight: 800; color: #f87171;">$${totalFixedCostsUsd.toLocaleString()} USD</div>
    <div style="font-size: 11px; color: var(--text-muted);">ARS $${Math.round(totalFixedCostsUsd * tc).toLocaleString()}</div>
  </div>`;

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Ganancia Limpia / Unidad</div>
    <div style="font-size: 18px; font-weight: 800; color: #34d399;">$${avgProfitPerUnitUsd.toFixed(2)} USD</div>
    <div style="font-size: 11px; color: var(--text-muted);">Margen promedio por producto</div>
  </div>`;

  html += `<div class="card" style="padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Unidades para Equilibrio</div>
    <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">${unitsNeeded} unidades</div>
    <div style="font-size: 11px; color: #34d399;">Punto de Equilibrio (0% pérdida)</div>
  </div>`;

  html += `</div>`;

  html += `<div class="card" style="padding: 14px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px;">`;
  html += `<div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 4px;">🎯 Resumen de Operación</div>`;
  html += `<div style="font-size: 13px; color: var(--text-muted);">Para cubrir tus <strong>$${totalFixedCostsUsd} USD</strong> de gastos fijos este mes, necesitás vender un total de <strong>${unitsNeeded} unidades</strong> (equivalente a una facturación de <strong>$${Math.round(totalFactNeededUsd).toLocaleString()} USD</strong> o <strong>$${Math.round(totalFactNeededUsd * tc).toLocaleString()} ARS</strong>).</div>`;
  html += `</div>`;

  body.innerHTML = html;
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

function handleProductImageFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !activeZoomSku) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    updateProductImage(activeZoomSku, evt.target.result);
  };
  reader.readAsDataURL(file);
}

function updateProductImage(sku, dataUrl) {
  const item = catalog.find(r => r.sku === sku);
  if (item) {
    item.img = dataUrl;
    zoomImageByUrl(dataUrl, `${item.marca} ${item.modelo} (${item.sku})`);
    renderCatalog();
    if (typeof renderPedidoTable === 'function') renderPedidoTable();
    AppStorage.saveCatalog(catalog, selection);
    toast('📷 Foto del producto actualizada', 'success');
  }
}

function triggerCleanBackground() {
  if (!activeZoomSku) return;
  const item = catalog.find(r => r.sku === activeZoomSku);
  if (!item || !item.img) { toast('No hay imagen para procesar', 'error'); return; }

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
      updateProductImage(activeZoomSku, cleanUrl);
      toast('🪄 Fondo limpiado exitosamente', 'success');
    }
  };
  img.src = item.img;
}

// Escuchar evento Paste (Ctrl+V) para pegar fotos directamente
window.addEventListener('paste', (e) => {
  if (!activeZoomSku) return;
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (evt) => {
        updateProductImage(activeZoomSku, evt.target.result);
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
    const imgHtml = r.img ? `<img src="${esc(r.img)}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; cursor: zoom-in; background: rgba(0,0,0,0.3); border: 1px solid var(--border);" onclick="zoomImageByUrl('${escJs(r.img)}', '${escJs(r.marca + ' ' + r.modelo)}')">` : `<span style="font-size: 16px; opacity: 0.3;">🖼️</span>`;
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
    html += '<button class="btn btn-sm" onclick="clonarPedido(' + i + ')" title="Clonar este pedido como nuevo">👯 Clonar</button>';
    html += '<button class="btn btn-sm" onclick="copiarResumenPedido(' + i + ')" title="Copiar resumen al portapapeles">📋 Copiar</button>';
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
