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
      console.warn('LocalStorage quota superada. Guardando versión compacta sin imágenes pesadas...', e);
      try {
        // Fallback Ponytail: Strip base64 image strings to ensure data preservation without crashing
        const compactVal = JSON.parse(JSON.stringify(value, (k, v) => (k === 'img' && typeof v === 'string' && v.length > 500 ? '' : v)));
        localStorage.setItem(key, JSON.stringify(compactVal));
      } catch (err) {
        console.error('Error al guardar datos compactos en LocalStorage:', err);
      }
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
      data.items = data.items.map(item => {
        if (typeof TextSanitizer !== 'undefined' && typeof TextSanitizer.sanitizeItem === 'function') {
          return TextSanitizer.sanitizeItem(item);
        }
        return item;
      });
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
