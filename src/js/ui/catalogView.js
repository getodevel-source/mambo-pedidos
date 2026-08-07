// ============================================
// Mambo Pedidos - UI Catalog View Module
// Catalog rendering, filtering, pagination,
// inline editing, selection, view modes
// ============================================

const CatalogView = {
  currentPage: 1,
  pageSize: 50,
  activeCategoryChip: '',
  catalogViewMode: 'table',
  _searchTimer: null,
  _nextStepDismissed: false,

  /**
   * Debounced catalog render for search/filter inputs.
   * Waits 250ms after the last keystroke before re-rendering.
   */
  debouncedRender() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.renderCatalog();
    }, 250);
  },

  showCatalogContent() {
    document.getElementById('catalogEmpty').style.display = 'none';
    document.getElementById('catalogContent').style.display = 'block';
    document.getElementById('catalogActions').style.display = 'flex';
    CatalogView.populateCatalogFilters();
    updateBadges();
  },

  populateCatalogFilters() {
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
  },

  /** Filtros activos (búsqueda + marca + categoría + rango de precio + chip).
   *  Fuente única de verdad compartida por renderCatalog, nextPage y toggleSelectAll. */
  getFilteredCatalog() {
    const txt = (document.getElementById('catSearch')?.value || '').toLowerCase();
    const marca = document.getElementById('catFilterMarca')?.value;
    const cat = document.getElementById('catFilterCat')?.value;
    const minPrice = parseFloat(document.getElementById('catFilterMinPrice')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('catFilterMaxPrice')?.value) || Infinity;

    return catalog.filter(r => {
      const matchTxt = !txt || (r.sku + ' ' + r.marca + ' ' + r.modelo + ' ' + (r.variante || '')).toLowerCase().includes(txt);
      const matchMarca = !marca || r.marca === marca;
      let matchCat = !cat || r.cat === cat;
      if (CatalogView.activeCategoryChip === 'SELECTED_ONLY') {
        matchCat = (selection[r.sku] || 0) > 0;
      } else if (CatalogView.activeCategoryChip) {
        matchCat = r.cat === CatalogView.activeCategoryChip;
      }
      const matchPrice = (r.fob >= minPrice) && (r.fob <= maxPrice);
      return matchTxt && matchMarca && matchCat && matchPrice;
    });
  },

  prevPage() {
    if (CatalogView.currentPage > 1) {
      CatalogView.currentPage--;
      CatalogView.renderCatalog();
    }
  },

  nextPage() {
    const filteredCount = CatalogView.getFilteredCatalog().length;

    const totalPages = Math.ceil(filteredCount / CatalogView.pageSize) || 1;
    if (CatalogView.currentPage < totalPages) {
      CatalogView.currentPage++;
      CatalogView.renderCatalog();
    }
  },

  refreshNextStepHint() {
    const nextStepHint = document.getElementById('catalogNextStepHint');
    if (!nextStepHint) return;
    const selQty = Object.values(selection).reduce((sum, v) => sum + v, 0);
    nextStepHint.style.display = (selQty === 0 && !CatalogView._nextStepDismissed) ? 'flex' : 'none';
  },

  adjustQty(sku, delta) {
    const current = selection[sku] || 0;
    const next = Math.max(0, current + delta);
    AppStore.commit(() => {
      if (next > 0) selection[sku] = next;
      else delete selection[sku];
    });
    CatalogView.renderCatalog();
  },

  setCatChip(cat, el) {
    CatalogView.activeCategoryChip = cat;
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
    CatalogView.renderCatalog();
  },

  clearCatalogFilters() {
    ['catSearch', 'catFilterMarca', 'catFilterCat', 'catFilterMinPrice', 'catFilterMaxPrice'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    CatalogView.currentPage = 1;
    const allChip = document.querySelector('#catFilterChips .chip');
    if (allChip) {
      CatalogView.setCatChip('', allChip); // restaura el chip "Todas las categorías" y re-renderiza
    } else {
      CatalogView.activeCategoryChip = '';
      CatalogView.renderCatalog();
    }
  },

  renderCatalog() {
    if (!catalog.length) return;
    const filtered = CatalogView.getFilteredCatalog();

    const totalPages = Math.ceil(filtered.length / CatalogView.pageSize) || 1;
    if (CatalogView.currentPage > totalPages) CatalogView.currentPage = totalPages;
    if (CatalogView.currentPage < 1) CatalogView.currentPage = 1;

    const pageIndicator = document.getElementById('pageIndicator');
    if (pageIndicator) pageIndicator.textContent = `Página ${CatalogView.currentPage} de ${totalPages}`;

    const startIndex = (CatalogView.currentPage - 1) * CatalogView.pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + CatalogView.pageSize);

    // Single-pass min/max/sum (avoids Math.min(...spread) call-stack limit on large catalogs)
    let minFob = Infinity, maxFob = 0, sumFob = 0, positiveCount = 0;
    for (const r of catalog) {
      const f = r.fob;
      if (f > maxFob) maxFob = f;
      if (f > 0) { if (f < minFob) minFob = f; sumFob += f; positiveCount++; }
    }
    if (minFob === Infinity) minFob = 0;
    const setKpi = (id, text) => {
      if (typeof updateStatValue === 'function') updateStatValue(id, text);
      else { const el = document.getElementById(id); if (el) el.textContent = text; }
    };
    setKpi('catKpiTotal', String(catalog.length));
    setKpi('catKpiMarcas', [...new Set(catalog.map(r => r.marca))].length + ' marcas');
    setKpi('catKpiMin', '$' + (minFob >= 10 ? minFob.toFixed(0) : minFob.toFixed(2)));
    setKpi('catKpiMax', '$' + maxFob.toFixed(0));
    setKpi('catKpiAvg', '$' + (positiveCount ? (sumFob / positiveCount) : 0).toFixed(2));

    const selItems = Object.entries(selection);
    const selQty = selItems.reduce((s, [k, v]) => s + v, 0);
    const bySku = new Map(catalog.map(r => [r.sku, r]));
    const selFob = selItems.reduce((s, [k, v]) => {
      const item = bySku.get(k);
      return s + (item ? item.fob * v : 0);
    }, 0);
    setKpi('catKpiSel', selQty + ' u');
    setKpi('catKpiSelFob', '$' + selFob.toFixed(2) + ' FOB');
    document.getElementById('catalogSubtitle').textContent = filtered.length + ' de ' + catalog.length + ' productos · ' + new Set(filtered.map(r => r.marca)).size + ' marcas';

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

    // Guided next-step hint: visible while nothing is selected
    CatalogView.refreshNextStepHint();

    const DEFAULT_SVG_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="#12131C"/><circle cx="8.5" cy="8.5" r="1.5" fill="#334155"/><polyline points="21 15 16 10 5 21" stroke="#334155"/></svg>');
    const qualityBadge = r => {
      const status = ['GREEN', 'YELLOW', 'RED'].includes(r.status) ? r.status : 'YELLOW';
      const labels = { GREEN: 'Verificado', YELLOW: 'Revisión', RED: 'No importable' };
      const reason = r.qualityReason || (r.warnings || [])[0] || 'Estado de calidad no disponible';
      const reasonHtml = status === 'GREEN' ? '' : `<small style="display:block; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted);" title="${esc(reason)}">${esc(reason)}</small>`;
      return `<span title="${esc(reason)}" style="font-size:10px; font-weight:800; color:${status === 'GREEN' ? '#34d399' : status === 'YELLOW' ? '#fde047' : '#f87171'};">● ${labels[status]}</span>${reasonHtml}`;
    };

    let html = '';
    pageItems.forEach(r => {
      const qty = selection[r.sku] || 0;
      const isSel = qty > 0;
      const skuJs = escJs(r.sku);
      const imgHtml = hasCatalogImage(r.img) ? `<img src="${esc(r.img)}" onerror="this.onerror=null; this.src='${DEFAULT_SVG_IMG}';" style="width: 32px; height: 32px; object-fit: contain; border-radius: 6px; cursor: zoom-in; background: rgba(0,0,0,0.4); border: 1px solid var(--border);" onclick="zoomImage('${skuJs}')">` : `<img src="${DEFAULT_SVG_IMG}" alt="Sin imagen" title="Sin imagen: requiere revisión" style="width: 32px; height: 32px; object-fit: contain; border-radius: 6px; opacity: 0.4;">`;
      html += '<tr' + (isSel ? ' style="background: rgba(255,90,31,0.05);"' : '') + '>';
      html += '<td class="checkbox"><input type="checkbox" ' + (isSel ? 'checked' : '') + ' onchange="toggleItem(\'' + skuJs + '\', this.checked)"></td>';
      html += '<td style="text-align: center;">' + imgHtml + '</td>';
      html += '<td><code style="font-size: 10px; font-family: JetBrains Mono, monospace; color: var(--text-3);">' + esc(r.sku) + '</code><br>' + qualityBadge(r) + '</td>';
      html += '<td><input class="inline" value="' + esc(r.marca) + '" onchange="updateField(\'' + skuJs + '\', \'marca\', this.value)"></td>';
      html += '<td><input class="inline" value="' + esc(r.modelo) + '" onchange="updateField(\'' + skuJs + '\', \'modelo\', this.value)"></td>';
      html += '<td><input class="inline" value="' + esc(r.variante || '') + '" placeholder="—" onchange="updateField(\'' + skuJs + '\', \'variante\', this.value)"></td>';
      html += '<td><input class="inline" value="' + esc(r.cat) + '" onchange="updateField(\'' + skuJs + '\', \'cat\', this.value)"></td>';
      html += '<td><input class="inline num" value="' + r.fob.toFixed(2) + '" onchange="updateField(\'' + skuJs + '\', \'fob\', this.value)"></td>';
      html += '<td>';
      html += '<div style="display: flex; align-items: center; gap: 4px;">';
      html += '<button class="btn btn-sm" onclick="adjustQty(\'' + skuJs + '\', -1)" style="padding: 1px 6px; font-weight: 700;">-</button>';
      html += '<input class="inline num qty" type="number" value="' + qty + '" min="0" style="width: 45px; text-align: center;" onchange="setQty(\'' + skuJs + '\', this.value)">';
      html += '<button class="btn btn-sm" onclick="adjustQty(\'' + skuJs + '\', 1)" style="padding: 1px 6px; font-weight: 700;">+</button>';
      html += '</div>';
      html += '</td>';
      html += '<td class="action"><button class="btn btn-sm" onclick="removeItem(\'' + skuJs + '\')" style="background: transparent; border: 1px solid var(--border); padding: 2px 6px; color: var(--red);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></td>';
      html += '</tr>';
    });
    const gridEl = document.getElementById('catalogGrid');
    if (CatalogView.catalogViewMode === 'grid') {
      let gridHtml = '';
      pageItems.forEach(r => {
        const qty = selection[r.sku] || 0;
        const isSel = qty > 0;
        const skuJs = escJs(r.sku);
        const markup = (typeof Calculator !== 'undefined' && typeof Calculator.getMarkup === 'function')
                  ? Calculator.getMarkup(r.cat, parseFloat(document.getElementById('cMarkup')?.value) || 2.5, null)
                  : (parseFloat(document.getElementById('cMarkup')?.value) || 2.5);
                const pvp = (r.fob * markup).toFixed(2);
        const imgSrc = hasCatalogImage(r.img) ? r.img : DEFAULT_SVG_IMG;

        gridHtml += `<div class="card" style="padding: 12px; display: flex; flex-direction: column; gap: 10px; border: ${isSel ? '2px solid var(--primary)' : '1px solid var(--border)'}; background: ${isSel ? 'rgba(255,87,34,0.05)' : 'var(--surface)'}; border-radius: 12px; position: relative;">`;
        gridHtml += `<div style="width: 100%; height: 140px; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: zoom-in;" onclick="zoomImage('${skuJs}')">`;
        gridHtml += `<img src="${esc(imgSrc)}" onerror="this.onerror=null; this.src='${DEFAULT_SVG_IMG}';" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: -webkit-optimize-contrast;">`;
        gridHtml += `</div>`;
        gridHtml += `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">`;
        gridHtml += `<span style="font-weight: 700; color: var(--primary); background: rgba(255,87,34,0.15); padding: 2px 6px; border-radius: 4px;">${esc(r.marca)}</span>`;
        gridHtml += `<code style="font-size: 10px; color: var(--text-3);">${esc(r.sku)}</code>${qualityBadge(r)}`;
        gridHtml += `</div>`;
        const variantHtml = r.variante ? `<span style="display: inline-block; font-size: 10px; font-weight: 600; color: #a7f3d0; background: rgba(16,185,129,0.15); padding: 1px 5px; border-radius: 4px; margin-left: 6px;">${esc(r.variante)}</span>` : '';
        gridHtml += `<div style="font-weight: 700; font-size: 13px; color: #fff; line-height: 1.3; height: 34px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${esc(r.modelo)}${variantHtml}</div>`;
        gridHtml += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">`;
        gridHtml += `<div><span style="font-size: 10px; color: var(--text-muted); display: block;">FOB ${tip('FOB')}</span><strong style="color: #38bdf8;">$${r.fob.toFixed(2)}</strong></div>`;
                gridHtml += `<div><span style="font-size: 10px; color: var(--text-muted); display: block;">PVP Est. ${tip('PVP')}</span><strong style="color: #34d399;">$${pvp}</strong></div>`;
        gridHtml += `</div>`;
        gridHtml += `<div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 4px;">`;
        gridHtml += `<button class="btn btn-sm" onclick="adjustQty('${skuJs}', -1)" style="padding: 4px 10px; font-weight: 800;">-</button>`;
        gridHtml += `<span style="font-weight: 800; font-size: 14px; color: ${isSel ? 'var(--primary)' : 'var(--text-muted)'};">${qty} u</span>`;
        gridHtml += `<button class="btn btn-sm btn-primary" onclick="adjustQty('${skuJs}', 1)" style="padding: 4px 10px; font-weight: 800;">+</button>`;
        gridHtml += `</div>`;
        gridHtml += `</div>`;
      });
      if (gridEl) gridEl.innerHTML = gridHtml || '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-3);">Sin productos con esos filtros</div>';
    }

    if (!filtered.length) {
      html = '<tr><td colspan="10" style="text-align: center; padding: 36px 16px; color: var(--text-3);">Sin productos que coincidan con los filtros actuales.<button class="btn btn-xs btn-secondary" style="margin-left: 10px;" onclick="clearCatalogFilters()">Limpiar filtros</button></td></tr>';
    }

    document.getElementById('catalogBody').innerHTML = html;
    updateBadges();
  },

  toggleItem(sku, on) {
    AppStore.commit(() => {
      if (on) { if (!selection[sku]) selection[sku] = 1; }
      else { delete selection[sku]; }
    });
    scheduleCatalogSave();
    CatalogView.renderCatalog();
  },

  setQty(sku, val) {
    const qty = parseInt(val) || 0;
    AppStore.commit(() => {
      if (qty > 0) selection[sku] = qty;
      else delete selection[sku];
    });
    scheduleCatalogSave();
    CatalogView.renderCatalog();
  },

  toggleSelectAll(on) {
    AppStore.commit(() => {
      if (on) {
        // Respeta los filtros activos: selecciona solo lo visible (igual que el preview de importación)
        CatalogView.getFilteredCatalog().forEach(r => { selection[r.sku] = 1; });
      } else {
        selection = {};
      }
    });
    scheduleCatalogSave();
    CatalogView.renderCatalog();
  },

  async removeItem(sku) {
    const item = catalog.find(r => r.sku === sku);
    if (!item) return;
    const ok = await showConfirm({ title: 'Eliminar producto', message: '¿Eliminar <strong>' + esc(sku) + '</strong> del catálogo?', confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    const idx = catalog.indexOf(item);
    const qty = selection[sku] || 0;
    AppStore.commit(() => {
      catalog = catalog.filter(r => r.sku !== sku);
      delete selection[sku];
    });
    scheduleCatalogSave();
    CatalogView.renderCatalog();
    toastUndo('Producto ' + sku + ' eliminado', () => {
      AppStore.commit(() => {
        catalog.splice(idx, 0, item);
        if (qty > 0) selection[sku] = qty;
      });
      scheduleCatalogSave();
      CatalogView.renderCatalog();
    });
  },

  addCatalogItem() {
    const sku = typeof SkuAllocator !== 'undefined'
      ? SkuAllocator.allocateBatch([{ marca: 'NEW', cat: 'OTRO', modelo: 'Producto nuevo', variante: '' }], catalog)[0].sku
      : 'NEW-' + String(catalog.length + 1).padStart(4, '0');
    catalog.unshift({ sku, cat: 'OTRO', marca: '', modelo: 'Producto nuevo', variante: '', fob: 0 });
    scheduleCatalogSave();
    CatalogView.showCatalogContent();
    CatalogView.renderCatalog();
    toast('Producto agregado', 'success');
  },

  async resetCatalog() {
    const ok = await showConfirm({ title: 'Limpiar catálogo', message: '¿Borrar <strong>todo</strong> el catálogo? Podés deshacerlo unos segundos después.', confirmText: 'Borrar todo', danger: true });
    if (!ok) return;
    const prevCatalog = catalog.slice();
    const prevSelection = Object.assign({}, selection);
    AppStore.commit(() => {
      catalog = [];
      selection = {};
    });
    AppStorage.removeItem(AppStorage.KEYS.CATALOG);
    document.getElementById('catalogEmpty').style.display = 'block';
    document.getElementById('catalogContent').style.display = 'none';
    document.getElementById('catalogActions').style.display = 'none';
    updateBadges();
    toastUndo('Catálogo vaciado', () => {
      AppStore.commit(() => {
        catalog = prevCatalog;
        selection = prevSelection;
      });
      scheduleCatalogSave();
      CatalogView.showCatalogContent();
      CatalogView.renderCatalog();
    });
  },

  updateField(oldSku, field, value) {
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
      const n = parseFloat(value.replace(',', '.').replace(/[$ ]/g, ''));
      if (!isNaN(n) && n > 0 && n <= 100000) { item.fob = n; }
      else {
        if (typeof toast === 'function') toast('FOB inválido: ingresá un precio entre 0 y 100000', 'error');
        CatalogView.renderCatalog();
        return;
      }
    } else if (field === 'sku' && value && value !== oldSku) {
      const normalizedSku = typeof SkuAllocator !== 'undefined' ? SkuAllocator.normalizeSku(value) : value;
      if (catalog.find(r => r !== item && (typeof SkuAllocator !== 'undefined' ? SkuAllocator.normalizeSku(r.sku) === normalizedSku : r.sku === normalizedSku))) { toast('SKU duplicado globalmente', 'error'); CatalogView.renderCatalog(); return; }
      if (selection[oldSku]) { selection[normalizedSku] = selection[oldSku]; delete selection[oldSku]; }
      item.sku = normalizedSku;
    } else if (value) {
      item[field] = value;
    }
    if (typeof CatalogValidator !== 'undefined') CatalogValidator.runFullValidation(catalog);
    scheduleCatalogSave();
    CatalogView.renderCatalog();
  },

  setCatalogViewMode(mode) {
    CatalogView.catalogViewMode = mode;
    try { localStorage.setItem('mambo_catalog_viewmode', mode); } catch { /* persistencia opcional */ }
    const btnTable = document.getElementById('btnViewTable');
    const btnGrid = document.getElementById('btnViewGrid');
    const tableWrap = document.getElementById('catalogTableWrap');
    const gridWrap = document.getElementById('catalogGrid');

    if (mode === 'grid') {
      if (btnTable) { btnTable.classList.remove('active'); btnTable.style.background = ''; btnTable.style.color = ''; }
      if (btnGrid) { btnGrid.classList.add('active'); btnGrid.style.background = ''; btnGrid.style.color = ''; }
      if (tableWrap) tableWrap.style.display = 'none';
      if (gridWrap) gridWrap.style.display = 'grid';
    } else {
      if (btnTable) { btnTable.classList.add('active'); btnTable.style.background = ''; btnTable.style.color = ''; }
      if (btnGrid) { btnGrid.classList.remove('active'); btnGrid.style.background = ''; btnGrid.style.color = ''; }
      if (tableWrap) tableWrap.style.display = 'block';
      if (gridWrap) gridWrap.style.display = 'none';
    }
    CatalogView.renderCatalog();
  }
};

// Browser-global bridge: keep existing function names working
if (typeof window !== 'undefined') {
  window.CatalogView = CatalogView;
  window.showCatalogContent = () => CatalogView.showCatalogContent();
  window.populateCatalogFilters = () => CatalogView.populateCatalogFilters();
  window.prevPage = () => CatalogView.prevPage();
  window.nextPage = () => CatalogView.nextPage();
  window.adjustQty = (sku, delta) => CatalogView.adjustQty(sku, delta);
  window.setCatChip = (cat, el) => CatalogView.setCatChip(cat, el);
  window.clearCatalogFilters = () => CatalogView.clearCatalogFilters();
  window.renderCatalog = () => CatalogView.renderCatalog();
  window.debouncedRenderCatalog = () => CatalogView.debouncedRender();
  window.toggleItem = (sku, on) => CatalogView.toggleItem(sku, on);
  window.setQty = (sku, val) => CatalogView.setQty(sku, val);
  window.toggleSelectAll = (on) => CatalogView.toggleSelectAll(on);
  window.removeItem = (sku) => CatalogView.removeItem(sku);
  window.addCatalogItem = () => CatalogView.addCatalogItem();
  window.resetCatalog = () => CatalogView.resetCatalog();
  window.updateField = (oldSku, field, value) => CatalogView.updateField(oldSku, field, value);
  window.setCatalogViewMode = (mode) => CatalogView.setCatalogViewMode(mode);
}
if (typeof module !== 'undefined') module.exports = CatalogView;
