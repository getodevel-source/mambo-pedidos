// ============================================
// Mambo Pedidos - UI Import Flow Module
// File processing, import preview modal,
// batch editing, AI auto-correct, confirm import
// ============================================

const ImportFlow = {
  pendingPreviewItems: [],
  previewFilter: 'ALL',
  previewSearch: '',

  // Interceptor de Importación con Vista Previa por Semáforo
  async processFiles(files) {
    if (!files.length) return;
    showProgress(0, 'Iniciando carga de catálogos...', `0 de ${files.length} archivos`);
    customBrandsList = await AppStorage.loadBrands();
    ImportFlow.pendingPreviewItems = [];

    const totalFiles = files.length;
    for (let i = 0; i < totalFiles; i++) {
      const f = files[i];
      const basePct = (i / totalFiles) * 100;
      const stepPct = (1 / totalFiles) * 100;

      showProgress(basePct, `Cargando ${f.name}...`, `Archivo ${i + 1} de ${totalFiles}`);

      try {
        const ext = f.name.split('.').pop().toLowerCase();
        const progressCb = (current, total) => {
          const filePct = (current / total) * stepPct;
          const currentPct = Math.round(basePct + filePct);
          showProgress(currentPct, `Procesando ${f.name}`, `Página ${current} de ${total} · ${currentPct}%`);
        };

        // PDFs → Parser Espacial (Cell Grid)
        // CSV/Excel → Parser determinístico por headers (FileImporter)
        // P17 opción 2: garantizar la lib pesada antes de parsear (lazy-load)
        let res;
        if (ext === 'pdf') {
          if (typeof ensurePdfLib === 'function') await ensurePdfLib();
          const parsed = await PdfParser.processPdfFile(f, 0, customBrandsList, progressCb);
          res = { products: parsed.products || [] };
        } else {
          if (typeof ensureXlsxLib === 'function') await ensureXlsxLib();
          const items = (ext === 'csv')
            ? await FileImporter.processCsvFile(f, catalog)
            : await FileImporter.processExcelFile(f, catalog);
          res = { products: items || [] };
        }

        const incoming = res.products || [];

        for (const rawItem of incoming) {
          const item = (typeof TextSanitizer !== 'undefined')
            ? TextSanitizer.sanitizeItem(rawItem, customBrandsList)
            : rawItem;

          item.img = hasCatalogImage(item.img) ? item.img : '-';
          item.sourceFile = f.name;
          item._selected = item.status !== 'RED' && item.importable !== false;

          ImportFlow.pendingPreviewItems.push(item);
        }
      } catch (err) {
        console.error('Error procesando ' + f.name, err);
        toast(f.name + ': ' + err.message, 'error');
      }
    }

    showProgress(100, 'Validando calidad de datos...', 'Motor de validación cruzada...');

    if (ImportFlow.pendingPreviewItems.length > 0) {
      if (typeof SkuAllocator !== 'undefined') SkuAllocator.allocateBatch(ImportFlow.pendingPreviewItems, catalog);
      // Capa 1+3+4: Validación cruzada + semáforo + estadística
      const validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

      ImportFlow.pendingPreviewItems = validation.products;

      // RED → deseleccionados por defecto (no se importan)
            for (const p of validation.rejected) {
              p._selected = false;
            }
            // IT16/F3 (infallibility): los flagueados por DATOS (YELLOW no-foto) NO se
            // auto-seleccionan — el usuario DEBE confirmarlos a consciencia antes de
            // importar (nada con dato dudoso entra en silencio). Los de SOLO foto
            // (datos OK) quedan seleccionados.
            ImportFlow.isPhotoOnlyItem = (it) =>
              (!Array.isArray(it._imgTextWarnings) || it._imgTextWarnings.length === 0) &&
              it.status === 'YELLOW' &&
              !hasCatalogImage(it.img) &&
              (!it.warnings || it.warnings.length === 0 || it.warnings.every(w => /imagen|foto/i.test(w)));
            ImportFlow.isDataFlagged = (it) => it.status === 'YELLOW' && !ImportFlow.isPhotoOnlyItem(it);
            for (const p of validation.accepted) {
              p._selected = p.importable !== false;
            }
            for (const p of validation.review) {
              p._selected = p.importable !== false && !ImportFlow.isDataFlagged(p);
            }

      // RED → rechazados (no se importan, se muestran separados)
      if (validation.rejected.length > 0) {
        toast(`${validation.rejected.length} productos rechazados por validación crítica`, 'error');
      }

      // Actualizar el preview con el resultado de la validación
      ImportFlow.renderImportPreviewModal(validation);
    } else {
      toast('No se detectaron productos válidos en los archivos', 'warning');
    }
    setTimeout(hideProgress, 400);
  },

  setPreviewFilter(filter, el) {
    ImportFlow.previewFilter = filter;
    document.querySelectorAll('.pv-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    ImportFlow.renderImportPreviewModal(window._previewValidation);
  },

  _searchDebounceTimer: null,

  setPreviewSearch(val) {
    ImportFlow.previewSearch = (val || '').toLowerCase().trim();
    // Debounce re-render to avoid lag with 500+ products
    clearTimeout(ImportFlow._searchDebounceTimer);
    ImportFlow._searchDebounceTimer = setTimeout(() => {
      ImportFlow.renderImportPreviewModal(window._previewValidation);
    }, 250);
  },

  renderImportPreviewModal(validation) {
    const modal = document.getElementById('importPreviewModal');
    const body = document.getElementById('importPreviewBody');
    if (!modal || !body) return;

    window._previewValidation = validation;

    const greenCount = validation ? validation.stats.green : ImportFlow.pendingPreviewItems.filter(i => i.status === 'GREEN').length;
    const yellowCount = validation ? validation.stats.yellow : ImportFlow.pendingPreviewItems.filter(i => i.status === 'YELLOW').length;
    const redCount = validation ? validation.stats.red : ImportFlow.pendingPreviewItems.filter(i => i.status === 'RED').length;

    // IT16 (UX): separar los YELLOW por razón — "sin foto" (solo previsualización,
    // datos verificados) vs "en revisión" (modelo/grounding/duplicado). El usuario
    // necesita saber que un YELLOW de foto NO es un error de datos.
    const isPhotoOnly = (it) =>
      (!Array.isArray(it._imgTextWarnings) || it._imgTextWarnings.length === 0) &&
      it.status === 'YELLOW' &&
      !hasCatalogImage(it.img) &&
      (!it.warnings || it.warnings.length === 0 || it.warnings.every(w => /imagen|foto/i.test(w)));
    const photoOnlyCount = ImportFlow.pendingPreviewItems.filter(isPhotoOnly).length;
    const dataReviewCount = Math.max(0, yellowCount - photoOnlyCount);

    document.getElementById('badgeValidCount').textContent = greenCount;
    document.getElementById('badgeWarnCount').textContent = yellowCount;
    document.getElementById('badgeErrCount').textContent = redCount;
    document.getElementById('pvCountAll').textContent = ImportFlow.pendingPreviewItems.length;

    document.getElementById('importPreviewSummary').textContent =
      `${ImportFlow.pendingPreviewItems.length} productos detectados · ${greenCount} verificados · ` +
      `${photoOnlyCount} sin foto (datos OK) · ${dataReviewCount} en revisión · ${redCount} no importables`;

    // Filtrar por tab + búsqueda
    const filtered = ImportFlow.pendingPreviewItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (ImportFlow.previewFilter !== 'ALL' && item.status !== ImportFlow.previewFilter) return false;
        if (ImportFlow.previewSearch) {
          const hay = `${item.modelo} ${item.marca} ${item.variante} ${item.sku}`.toLowerCase();
          if (!hay.includes(ImportFlow.previewSearch)) return false;
        }
        return true;
      });

    // Actualizar botón de confirmar
    const selCount = ImportFlow.pendingPreviewItems.filter(i => i._selected).length;
    const selPhotoOnly = ImportFlow.pendingPreviewItems.filter(i => i._selected && isPhotoOnly(i)).length;
    const confirmBtn = document.getElementById('pvConfirmBtn');
    if (confirmBtn) confirmBtn.textContent =
      selPhotoOnly > 0 ? `Importar ${selCount} (${selPhotoOnly} sin foto)` : `Importar ${selCount} seleccionados`;

    const CATS = ['TECLADO','MOUSE','HEADSET','AURICULAR','CONTROLLER','MOUSEPAD','SWITCH','CAMARA','SPEAKER','SILLA_GAMING','ACCESORIO','NUMPAD','MONITOR','CUIDADO_PERSONAL','OTRO'];

    function buildCard({ item, idx }) {
      const status = ['GREEN', 'YELLOW', 'RED'].includes(item.status) ? item.status : 'RED';
      const reason = (item.warnings && item.warnings.length) ? item.warnings[0] : '';
      const imgHtml = hasCatalogImage(item.img)
        ? `<img class="pv-card-img" src="${esc(item.img)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
      const placeholder = `<div class="pv-card-img pv-card-img-empty" style="${hasCatalogImage(item.img) ? 'display:none' : ''}">-</div>`;

      // IT16 (UX): un YELLOW de SOLO foto se explica como "datos OK, falta la
      // previsualización" — no es un error de datos y se importa igual.
      const photoOnly =
        status === 'YELLOW' &&
        !hasCatalogImage(item.img) &&
        (!item.warnings || item.warnings.length === 0 || item.warnings.every(w => /imagen|foto/i.test(w)));
      const shownReason = photoOnly ? 'Sin foto de previsualización (datos OK)' : reason;

      const reasonBanner = shownReason
              ? `<div class="pv-reason ${status === 'YELLOW' ? 'pv-reason-warn' : ''}">${esc(shownReason)}</div>`
              : '';

            // F3 (infallibility): los flagueados por DATOS llevan badge explícito de
            // revisión — el usuario entiende que NO se importan salvo que los marque.
            const reviewBadge = (ImportFlow.isDataFlagged && ImportFlow.isDataFlagged(item))
              ? `<div class="pv-reason pv-reason-review">requiere revisión (no se importa salvo confirmación)</div>`
              : '';

            return `<article class="pv-card pv-${status.toLowerCase()}" style="animation-delay:${Math.min(idx % 60, 20) * 18}ms">` +
              `<label class="pv-card-check"><input type="checkbox" ${item._selected ? 'checked' : ''} onchange="ImportFlow.pendingPreviewItems[${idx}]._selected=this.checked;updateConfirmCount()"></label>` +
              `<button class="pv-card-del" onclick="removePreviewItem(${idx})" title="Quitar">✕</button>` +
              `<div class="pv-card-media">${imgHtml}${placeholder}</div>` +
              `<div class="pv-card-body">` +
                `<div class="pv-card-brand">${esc(item.marca || 'OTRO')}</div>` +
              `<input class="pv-card-model" value="${esc(item.modelo)}" data-edit-idx="${idx}" data-edit-field="modelo" onchange="updatePreviewItem(${idx}, 'modelo', this.value)" title="Modelo (clic para editar)">` +
              `<input class="pv-card-variant" value="${esc(item.variante || '')}" placeholder="Variante / color" data-edit-idx="${idx}" data-edit-field="variante" onchange="updatePreviewItem(${idx}, 'variante', this.value)">` +
                `<div class="pv-card-meta">` +
                  `<select class="pv-card-cat" data-edit-idx="${idx}" data-edit-field="cat" onchange="updatePreviewItem(${idx}, 'cat', this.value)">` +
                    CATS.map(c => `<option value="${c}" ${c === item.cat ? 'selected' : ''}>${c}</option>`).join('') +
                  `</select>` +
                  `<div class="pv-card-price"><span class="pv-price-cur">$</span><input type="number" step="0.01" value="${item.fob}" data-edit-idx="${idx}" data-edit-field="fob" onchange="updatePreviewItem(${idx}, 'fob', this.value)"></div>` +
                `</div>` +
                reasonBanner +
                reviewBadge +
              `</div>` +
            `</article>`;
    }

    // Renderizado lazy por chunks
    const CHUNK = 60;
    let rendered = 0;
    body.innerHTML = '';

    if (filtered.length === 0) {
      body.innerHTML = `<div class="pv-empty">No hay productos que coincidan con este filtro.</div>`;
      modal.style.display = 'flex';
      return;
    }

    function renderChunk() {
      const end = Math.min(rendered + CHUNK, filtered.length);
      let html = '';
      for (let i = rendered; i < end; i++) {
        html += buildCard(filtered[i]);
      }
      body.insertAdjacentHTML('beforeend', html);
      rendered = end;
    }

    renderChunk();

    const scrollContainer = document.getElementById('pvGridWrap');
    function onScroll() {
      if (rendered >= filtered.length) {
        scrollContainer.removeEventListener('scroll', onScroll);
        return;
      }
      if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 300) {
        renderChunk();
      }
    }
    scrollContainer.removeEventListener('scroll', onScroll);
    scrollContainer.addEventListener('scroll', onScroll);

    modal.style.display = 'flex';
  },

  updateConfirmCount() {
    const selCount = ImportFlow.pendingPreviewItems.filter(i => i._selected).length;
    const confirmBtn = document.getElementById('pvConfirmBtn');
    if (confirmBtn) confirmBtn.textContent = `Importar ${selCount} seleccionados`;
  },

  updatePreviewItem(idx, field, value) {
    const item = ImportFlow.pendingPreviewItems[idx];
    if (!item) return;
    item[field] = field === 'fob'
      ? (parseFloat(String(value).replace(',', '.')) || 0)
      : String(value || '').trim();
    const validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

    ImportFlow.pendingPreviewItems = validation.products;
    validation.rejected.forEach(p => { p._selected = false; });
    window._previewValidation = validation;

    // Preservar scroll y foco: el re-render reconstruye el grid completo
    const wrap = document.getElementById('pvGridWrap');
    const prevScroll = wrap ? wrap.scrollTop : 0;
    ImportFlow.renderImportPreviewModal(validation);
    if (wrap) wrap.scrollTop = prevScroll;
    const edited = wrap ? wrap.querySelector(`[data-edit-idx="${idx}"][data-edit-field="${field}"]`) : null;
    if (edited) {
      edited.focus();
      if (typeof edited.setSelectionRange === 'function') {
        const len = edited.value.length;
        edited.setSelectionRange(len, len);
      }
    }
  },

  toggleSelectAllPreview(checked) {
    // Afecta solo los items visibles según filtro + búsqueda activos
    ImportFlow.pendingPreviewItems.forEach(i => {
      if (ImportFlow.previewFilter !== 'ALL' && i.status !== ImportFlow.previewFilter) return;
      if (i.importable === false || i.status === 'RED') return;
      if (ImportFlow.previewSearch) {
        const hay = `${i.modelo} ${i.marca} ${i.variante} ${i.sku}`.toLowerCase();
        if (!hay.includes(ImportFlow.previewSearch)) return;
      }
      i._selected = checked;
    });
    ImportFlow.renderImportPreviewModal(window._previewValidation);
  },

  applyBatchBrand() {
    const brand = (document.getElementById('batchBrandInput')?.value || '').trim();
    if (!brand) return;
    let count = 0;
    ImportFlow.pendingPreviewItems.forEach(i => {
      if (i._selected) {
        i.marca = brand;
        count++;
      }
    });
    const validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

    ImportFlow.pendingPreviewItems = validation.products;
    validation.rejected.forEach(p => { p._selected = false; });
    window._previewValidation = validation;
    ImportFlow.renderImportPreviewModal(validation);
    toast(`Marca "${brand}" aplicada a ${count} ítems`, 'success');
  },

  applyBatchCat() {
    const cat = document.getElementById('batchCatSelect')?.value;
    if (!cat) return;
    let count = 0;
    ImportFlow.pendingPreviewItems.forEach(i => {
      if (i._selected) {
        i.cat = cat;
        count++;
      }
    });
    const validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

    ImportFlow.pendingPreviewItems = validation.products;
    validation.rejected.forEach(p => { p._selected = false; });
    window._previewValidation = validation;
    ImportFlow.renderImportPreviewModal(validation);
    toast(`Categoría "${cat}" aplicada a ${count} ítems`, 'success');
  },

  async autoCorrectPreview() {
    if (!ImportFlow.pendingPreviewItems || !ImportFlow.pendingPreviewItems.length) return;
    toast('Sanitizando productos...', 'info');
    try {
      if (typeof TextSanitizer !== 'undefined') {
        // Use shared fix logic (single source of truth)
        TextSanitizer.fixItemsInPlace(ImportFlow.pendingPreviewItems, customBrandsList);
      }
      const validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

      ImportFlow.pendingPreviewItems = validation.products;
      validation.rejected.forEach(p => { p._selected = false; });
      window._previewValidation = validation;
      ImportFlow.renderImportPreviewModal(validation);
      toast('Catálogo sanitizado correctamente', 'success');
    } catch (err) {
      console.error('Error en sanitización:', err);
      toast('Error durante la sanitización del catálogo', 'error');
    }
  },

  removePreviewItem(idx) {
    ImportFlow.pendingPreviewItems.splice(idx, 1);
    if (!ImportFlow.pendingPreviewItems.length) {
      ImportFlow.closeImportPreviewModal();
    } else {
      ImportFlow.renderImportPreviewModal();
    }
  },

  closeImportPreviewModal() {
    const modal = document.getElementById('importPreviewModal');
    if (modal) modal.style.display = 'none';
    ImportFlow.pendingPreviewItems = [];
  },

  async confirmImportPreview() {
    const _validation = ImportGates.runImportVerification(ImportFlow.pendingPreviewItems);

    ImportFlow.pendingPreviewItems = _validation.products;
    if (typeof SkuAllocator !== 'undefined') SkuAllocator.allocateBatch(ImportFlow.pendingPreviewItems, catalog);
    const selectedItems = ImportFlow.pendingPreviewItems.filter(i => i._selected && i.status !== 'RED' && i.importable !== false);
    if (!selectedItems.length) {
      toast('No hay productos seleccionados para importar', 'warning');
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of selectedItems) {
      // #11: Never dedup items with empty modelo — they are not "equivalent" to each other
      const hasModelo = (item.modelo || '').trim().length > 0;
      const existing = hasModelo
        ? catalog.find(c => typeof SkuAllocator !== 'undefined'
          ? SkuAllocator.isEquivalent(c, item)
          : ((c.marca || '').toLowerCase().trim() === (item.marca || '').toLowerCase().trim() &&
             (c.modelo || '').toLowerCase().trim() === (item.modelo || '').toLowerCase().trim() &&
             (c.variante || '').toLowerCase().trim() === (item.variante || '').toLowerCase().trim()))
        : undefined;

      if (existing) {
        if (Math.abs(existing.fob - item.fob) >= 0.01) {
          existing.fob = item.fob;
          existing.cat = item.cat || existing.cat;
          existing.variante = item.variante || existing.variante || '';
          existing.img = hasCatalogImage(item.img) ? item.img : (existing.img || '-');
          existing.status = item.status;
          existing.warnings = item.warnings;
          existing.confidence = item.confidence;
          existing.grounded = item.grounded;
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
          img: hasCatalogImage(item.img) ? item.img : '-',
          status: item.status,
          warnings: item.warnings || [],
          confidence: item.confidence,
          grounded: item.grounded,
          sourceFile: item.sourceFile,
          qualityReason: item.qualityReason
        });
        addedCount++;
      }
    }

    // persistence-fix: saveCatalog lanza si el backend real no puede escribir
    // (en desktop ya no despoja imágenes en silencio). Aun así se pinta lo
    // importado — está en memoria y es lo que el usuario quiere ver — pero el
    // aviso final pasa a 'error': decir 'success' con datos sin guardar miente.
    let saveError = null;
    try {
      await AppStorage.saveCatalog(catalog, selection);
    } catch (e) {
      saveError = (e && e.message) || String(e);
      console.error('No se pudo persistir el catálogo:', e);
    }
    showCatalogContent();
    populateCatalogFilters();
    renderCatalog();
    ImportFlow.closeImportPreviewModal();

    let msg = `Importación completada: ${addedCount} nuevos`;
    if (updatedCount > 0) msg += `, ${updatedCount} precios actualizados`;
    if (skippedCount > 0) msg += ` (${skippedCount} sin cambios)`;

    toast(saveError ? msg + ' — ⚠️ NO se pudo guardar: ' + saveError : msg, saveError ? 'error' : 'success');
  }
};

// Browser-global bridge: keep existing function names working
if (typeof window !== 'undefined') {
  window.ImportFlow = ImportFlow;
  window.processFiles = (files) => ImportFlow.processFiles(files);
  window.renderImportPreviewModal = (validation) => ImportFlow.renderImportPreviewModal(validation);
  window.setPreviewFilter = (filter, el) => ImportFlow.setPreviewFilter(filter, el);
  window.setPreviewSearch = (val) => ImportFlow.setPreviewSearch(val);
  window.updateConfirmCount = () => ImportFlow.updateConfirmCount();
  window.updatePreviewItem = (idx, field, value) => ImportFlow.updatePreviewItem(idx, field, value);
  window.toggleSelectAllPreview = (checked) => ImportFlow.toggleSelectAllPreview(checked);
  window.applyBatchBrand = () => ImportFlow.applyBatchBrand();
  window.applyBatchCat = () => ImportFlow.applyBatchCat();
  window.autoCorrectPreview = () => ImportFlow.autoCorrectPreview();
  window.removePreviewItem = (idx) => ImportFlow.removePreviewItem(idx);
  window.closeImportPreviewModal = () => ImportFlow.closeImportPreviewModal();
  window.confirmImportPreview = () => ImportFlow.confirmImportPreview();
}
if (typeof module !== 'undefined') module.exports = ImportFlow;
