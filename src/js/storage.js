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
    } catch (e) {
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('No se pudo guardar el catálogo: cuota de almacenamiento insuficiente. Se conservaron los datos en memoria y no se eliminaron imágenes.', e);
      throw new Error('Cuota de almacenamiento insuficiente; el catálogo no fue truncado');
    }
  },

  async removeItem(key) {
    if (this.storeInstance) {
      try {
        await this.storeInstance.delete(key);
        await this.storeInstance.save();
      } catch (e) {}
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  },

  // Helpers específicos
  async saveCatalog(items, selection) {
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
  }
};

window.AppStorage = AppStorage;
