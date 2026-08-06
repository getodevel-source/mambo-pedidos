// ============================================
//  Mambo Pedidos - Módulo de Persistencia (Storage)
//  Soporte para Tauri Store con fallback transparente a LocalStorage
// ============================================

const AppStorage = {
  KEYS: {
    CATALOG: 'mambo_catalog_v2',
    HISTORIAL: 'mambo_historial_v2',
    BRANDS: 'mambo_brands_v1'
  },
  storeInstance: null,

  // Inicializar Tauri Store si está disponible (Tauri v1/v2 compatible)
  async init() {
    try {
      const storePlugin = window.__TAURI_PLUGIN_STORE__ || window.__TAURI__?.store || window.__TAURI__?.plugin?.store;
      if (storePlugin && typeof storePlugin.createStore === 'function') {
        this.storeInstance = await storePlugin.createStore('.mambo-store.json');
        if (this.storeInstance && typeof this.storeInstance.load === 'function') {
          await this.storeInstance.load();
        }
      }
    } catch (e) {
      console.warn('Tauri Store no disponible, usando LocalStorage fallback:', e);
      this.storeInstance = null;
    }
  },

  async getItem(key, defaultValue = null) {
    if (this.storeInstance) {
      try {
        const val = await this.storeInstance.get(key);
        return val !== undefined && val !== null ? val : defaultValue;
      } catch (e) {
        console.error('Error leyendo Tauri Store:', e);
      }
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setItem(key, value) {
    if (this.storeInstance) {
      try {
        await this.storeInstance.set(key, value);
        await this.storeInstance.save();
        return;
      } catch (e) {
        console.error('Error guardando en Tauri Store:', e);
      }
    }
    const serialized = JSON.stringify(value);
    try {
      localStorage.setItem(key, serialized);
      return;
    } catch (e) {
      console.warn('localStorage quota exceeded, attempting progressive strip...', e);
    }

    // Progressive strip: remove heavy data to fit localStorage
    const stripped = this._stripForQuota(value);
    try {
      localStorage.setItem(key, JSON.stringify(stripped));
      if (typeof toast === 'function') {
        toast('⚠️ Imágenes removidas del almacenamiento local para caber en la cuota. Las imágenes siguen visibles en esta sesión.', 'warning');
      }
      return;
    } catch (e2) {
      console.warn('Still over quota after image strip, removing evaluations...', e2);
    }

    // Level 2: also remove _evaluations, warnings, rawText, cellRawText
    const strippedDeep = this._stripForQuota(stripped, true);
    try {
      localStorage.setItem(key, JSON.stringify(strippedDeep));
      if (typeof toast === 'function') {
        toast('⚠️ Catálogo guardado sin imágenes ni metadatos de validación (cuota localStorage).', 'warning');
      }
      return;
    } catch (e3) {
      console.error('No se pudo guardar el catálogo ni siquiera sin imágenes:', e3);
      throw new Error('Cuota de almacenamiento insuficiente incluso sin imágenes. Considere usar menos catálogos o limpiar el almacenamiento.');
    }
  },

  /**
   * Strip heavy data from a catalog payload to fit localStorage quota.
   * Level 1: replace base64 images with '-'
   * Level 2 (deep): also remove _evaluations, warnings, rawText, cellRawText, sourceWarnings
   */
  _stripForQuota(value, deep = false) {
    if (!value || typeof value !== 'object') return value;
    const clone = JSON.parse(JSON.stringify(value));
    const items = clone.items || clone;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object') {
          if (typeof item.img === 'string' && item.img.startsWith('data:image/')) {
            item.img = '-';
          }
          if (deep) {
            delete item._evaluations;
            delete item._validation;
            delete item.warnings;
            delete item.sourceWarnings;
            delete item.rawText;
            delete item.cellRawText;
            delete item._imageRef;
          }
        }
      }
    }
    return clone;
  },

  async removeItem(key) {
    if (this.storeInstance) {
      try {
        await this.storeInstance.delete(key);
        await this.storeInstance.save();
      } catch {}
    }
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  // Helpers específicos
  async saveCatalog(items, selection) {
    // Layer 3: Backup before save
    if (typeof Reliability !== 'undefined') {
      Reliability.createBackup({ items, sel: selection });
    }
    await this.setItem(this.KEYS.CATALOG, { items, sel: selection });
  },

  async loadCatalog() {
    const data = await this.getItem(this.KEYS.CATALOG, { items: [], sel: {} });
    if (data && data.items && Array.isArray(data.items)) {
      data.items = data.items.filter(item => item && typeof item === 'object').map(item => {
        if (typeof TextSanitizer !== 'undefined' && typeof TextSanitizer.sanitizeItem === 'function') {
          item = TextSanitizer.sanitizeItem(item);
        }
        item.sku = String(item.sku || '').trim();
        item.marca = String(item.marca || 'OTRO').trim();
        item.modelo = String(item.modelo || 'Producto').trim();
        item.cat = String(item.cat || 'OTRO').trim().toUpperCase();
        item.fob = Number.parseFloat(item.fob);
        if (!Number.isFinite(item.fob)) item.fob = 0;
        if (!item.img || typeof item.img !== 'string' || !/^data:image\/(?:png|jpe?g|webp|gif);/i.test(item.img)) item.img = '-';
        if (!item.variante && item.color) item.variante = item.color;
        if (!item.color && item.variante) item.color = item.variante;
        return item;
      });
      const previousSkus = data.items.map(item => item.sku);
      if (typeof SkuAllocator !== 'undefined' && typeof SkuAllocator.allocateBatch === 'function') {
        SkuAllocator.allocateBatch(data.items, []);
      }
      if (typeof CatalogValidator !== 'undefined' && typeof CatalogValidator.runFullValidation === 'function') {
        CatalogValidator.runFullValidation(data.items);
      }
      const previousSelection = data.sel && typeof data.sel === 'object' ? data.sel : {};
      const remappedSelection = {};
      data.items.forEach((item, index) => {
        const qty = Number(previousSelection[previousSkus[index]]) || 0;
        if (item.sku && qty > 0 && !remappedSelection[item.sku]) remappedSelection[item.sku] = qty;
      });
      data.sel = remappedSelection;
    }
    return data;
  },

  async saveHistorial(historialArray) {
    await this.setItem(this.KEYS.HISTORIAL, historialArray);
  },

  async loadHistorial() {
    return await this.getItem(this.KEYS.HISTORIAL, []);
  },

  async saveBrands(brandsArray) {
    await this.setItem(this.KEYS.BRANDS, brandsArray);
  },

  async loadBrands() {
    return await this.getItem(this.KEYS.BRANDS, []);
  },

  // ── Slice 5: Image Storage References ──

  /**
   * Build a stable ImageRef from a data URL payload.
   * @param {string} dataUrl - The inline image data URL
   * @param {string} sku - The product SKU (for provenance, NOT for lookup)
   * @returns {Object|null} ImageRef {id, relativePath, mime, sha256, width, height} or null
   */
  buildImageRef(dataUrl, sku) {
    if (!dataUrl || typeof dataUrl !== 'string' || !/^data:image\//i.test(dataUrl)) return null;
    const mimeMatch = dataUrl.match(/^data:image\/(\w+);/i);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'unknown';
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/i, '');
    let sha256;
    try {
      if (typeof require === 'function') {
        const crypto = require('crypto');
        sha256 = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
      } else {
        // Browser fallback: simple hash for ID generation
        let h = 0;
        for (let i = 0; i < base64.length; i++) { h = ((h << 5) - h + base64.charCodeAt(i)) | 0; }
        sha256 = Math.abs(h).toString(16).padStart(8, '0');
      }
    } catch { sha256 = 'error'; }
    const id = `img_${sha256.substring(0, 16)}`;
    return {
      id,
      relativePath: `images/${id}.${mime === 'jpeg' ? 'jpg' : mime}`,
      mime,
      sha256,
      width: 0,
      height: 0,
      sourceSku: sku || ''
    };
  },

  /**
   * Read-only audit of inline images in a catalog.
   * Categories: inline (valid data URL), missing (no image or '-'),
   * invalid (malformed data URL), duplicate (same sha256), orphan (ref without product).
   * @param {Array} items - Catalog items
   * @returns {Object} { inline: [], missing: [], invalid: [], duplicates: [], orphans: [], summary: {} }
   */
  auditInlineImages(items) {
    const audit = { inline: [], missing: [], invalid: [], duplicates: [], orphans: [], summary: {} };
    if (!Array.isArray(items)) return audit;

    const seenHashes = new Map();
    for (const item of items) {
      const sku = (item.sku || '').toString();
      const img = item.img;
      if (!img || img === '-' || typeof img !== 'string') {
        audit.missing.push({ sku, reason: 'No image payload' });
        continue;
      }
      if (!/^data:image\/(?:png|jpe?g|webp|gif);/i.test(img)) {
        audit.invalid.push({ sku, reason: 'Malformed data URL', preview: img.substring(0, 40) });
        continue;
      }
      const ref = this.buildImageRef(img, sku);
      if (!ref) {
        audit.invalid.push({ sku, reason: 'Failed to build ImageRef' });
        continue;
      }
      if (seenHashes.has(ref.sha256)) {
        audit.duplicates.push({ sku, sha256: ref.sha256, firstSku: seenHashes.get(ref.sha256) });
      } else {
        seenHashes.set(ref.sha256, sku);
        audit.inline.push({ sku, ref });
      }
    }

    audit.summary = {
      total: items.length,
      inline: audit.inline.length,
      missing: audit.missing.length,
      invalid: audit.invalid.length,
      duplicates: audit.duplicates.length,
      orphans: audit.orphans.length,
      uniqueImages: seenHashes.size
    };
    return audit;
  },

  /**
   * Build a deterministic migration receipt from an audit.
   * @param {Object} audit - Result of auditInlineImages
   * @param {string} schemaVersion - e.g. 'image-ref-v1'
   * @returns {Object} MigrationReceipt
   */
  buildMigrationReceipt(audit, schemaVersion) {
    const mappings = [];
    for (const entry of audit.inline) {
      mappings.push({ sku: entry.sku, imageRef: entry.ref, status: 'mapped' });
    }
    for (const entry of audit.missing) {
      mappings.push({ sku: entry.sku, imageRef: null, status: 'unresolved', reason: entry.reason });
    }
    for (const entry of audit.invalid) {
      mappings.push({ sku: entry.sku, imageRef: null, status: 'failed', reason: entry.reason });
    }
    for (const entry of audit.duplicates) {
      mappings.push({ sku: entry.sku, imageRef: null, status: 'duplicate', firstSku: entry.firstSku });
    }
    return {
      schema: schemaVersion || 'image-ref-v1',
      inputIdentity: `audit:${audit.summary.total}items:${audit.summary.uniqueImages}unique`,
      counts: Object.assign({}, audit.summary),
      mappings,
      committed: false,
      orphans: audit.orphans
    };
  },

  /**
   * Check idempotence: if a receipt with the same inputIdentity exists, migration is a no-op.
   * @param {Object} existingReceipt - Previously stored receipt (or null)
   * @param {Object} newReceipt - Newly computed receipt
   * @returns {{ idempotent: boolean, reason: string }}
   */
  checkIdempotence(existingReceipt, newReceipt) {
    if (!existingReceipt) {
      return { idempotent: false, reason: 'No previous receipt; first migration' };
    }
    if (existingReceipt.inputIdentity === newReceipt.inputIdentity) {
      return { idempotent: true, reason: 'Same input identity; migration is a no-op' };
    }
    return { idempotent: false, reason: `Input changed: "${existingReceipt.inputIdentity}" → "${newReceipt.inputIdentity}"` };
  },

  // ── Slice 7: Persistence & Fallback Evidence ──

  /**
   * Save catalog with quality evidence, recording which storage backend was used.
   * @param {Array} items - Catalog items with R1-R10 evaluations
   * @param {Object} selection - SKU → qty map
   * @returns {Promise<Object>} { backend: 'tauri'|'localstorage', evidence: {} }
   */
  async saveCatalogWithEvidence(items, selection) {
    const evidence = { backend: null, itemCount: 0, selectionKeys: 0, hasEvaluations: false };
    const payload = {
      items: (items || []).map(item => {
        const copy = Object.assign({}, item);
        if (item._evaluations) copy._evaluations = item._evaluations;
        return copy;
      }),
      sel: selection || {},
      savedAt: new Date().toISOString()
    };
    evidence.itemCount = payload.items.length;
    evidence.selectionKeys = Object.keys(payload.sel).length;
    evidence.hasEvaluations = payload.items.some(i => i._evaluations && i._evaluations.length > 0);

    if (this.storeInstance) {
      try {
        await this.storeInstance.set(this.KEYS.CATALOG, payload);
        await this.storeInstance.save();
        evidence.backend = 'tauri';
        return { backend: 'tauri', evidence };
      } catch (e) {
        evidence.backend = 'localstorage';
        evidence.tauriError = e.message;
      }
    } else {
      evidence.backend = 'localstorage';
    }

    try {
      localStorage.setItem(this.KEYS.CATALOG, JSON.stringify(payload));
    } catch (e) {
      evidence.localstorageError = e.message;
      // Retry with stripped images
      try {
        const stripped = this._stripForQuota(payload);
        localStorage.setItem(this.KEYS.CATALOG, JSON.stringify(stripped));
        evidence.imagesStripped = true;
      } catch (e2) {
        evidence.localstorageError = e2.message;
      }
    }
    return { backend: evidence.backend, evidence };
  },

  /**
   * Load catalog and verify quality evidence survived the round-trip.
   * @returns {Promise<Object>} { items, sel, evidence: { backend, itemCount, hasEvaluations, restored } }
   */
  async loadCatalogWithEvidence() {
    const evidence = { backend: null, itemCount: 0, hasEvaluations: false, restored: false };
    let data = null;

    if (this.storeInstance) {
      try {
        data = await this.storeInstance.get(this.KEYS.CATALOG);
        if (data) evidence.backend = 'tauri';
      } catch (e) {
        evidence.tauriError = e.message;
      }
    }

    if (!data) {
      try {
        const raw = localStorage.getItem(this.KEYS.CATALOG);
        if (raw) {
          data = JSON.parse(raw);
          evidence.backend = evidence.backend || 'localstorage';
        }
      } catch (e) {
        evidence.localstorageError = e.message;
      }
    }

    if (data && data.items && Array.isArray(data.items)) {
      evidence.itemCount = data.items.length;
      evidence.hasEvaluations = data.items.some(i => i._evaluations && i._evaluations.length > 0);
      evidence.restored = true;
      return { items: data.items, sel: data.sel || {}, evidence };
    }

    evidence.restored = false;
    return { items: [], sel: {}, evidence };
  },

  /**
   * Filter items by importability: RED/REJECTED rows are excluded, YELLOW/GREEN are kept.
   * @param {Array} items - Items with _evaluations
   * @returns {{ importable: [], rejected: [] }}
   */
  filterByImportability(items) {
    const importable = [];
    const rejected = [];
    for (const item of (items || [])) {
      const evals = item._evaluations || [];
      const hasRejection = evals.some(e => e.importability === 'REJECTED');
      if (hasRejection) {
        rejected.push(item);
      } else {
        importable.push(item);
      }
    }
    return { importable, rejected };
  },

  /**
   * Run the full image migration pipeline (AP-3a approved 2026-07-31).
   * Audit → receipt → idempotence check → commit (structural; actual file
   * copy requires Tauri FS plugin at runtime).
   * @param {Array} items - Current catalog items
   * @param {Object} [existingReceipt] - Previous receipt for idempotence check
   * @returns {Object} { audit, receipt, idempotence, committed }
   */
  runImageMigration(items, existingReceipt) {
    const audit = this.auditInlineImages(items);
    const receipt = this.buildMigrationReceipt(audit, 'image-ref-v1');
    const idempotence = this.checkIdempotence(existingReceipt || null, receipt);

    if (idempotence.idempotent) {
      return { audit, receipt, idempotence, committed: false, reason: 'no-op' };
    }

    // Structural commit: attach ImageRefs to items (actual file copy is runtime-only)
    for (const mapping of receipt.mappings) {
      if (mapping.status === 'mapped' && mapping.imageRef) {
        const item = items.find(i => (i.sku || '') === mapping.sku);
        if (item) {
          item._imageRef = mapping.imageRef;
        }
      }
    }
    receipt.committed = true;
    return { audit, receipt, idempotence, committed: true, reason: 'first-migration' };
  }
};

if (typeof window !== 'undefined') window.AppStorage = AppStorage;
if (typeof module !== 'undefined') module.exports = AppStorage;
