// ============================================
//  Mambo Pedidos - Módulo de Persistencia (Storage)
//  Soporte para Tauri Store con fallback transparente a LocalStorage
// ============================================

const AppStorage = {
  KEYS: {
    CATALOG: 'mambo_catalog_v2',
    HISTORIAL: 'mambo_historial_v2'
  },
  storeInstance: null,

  // Inicializar Tauri Store si está disponible
  async init() {
    if (window.__TAURI__ && window.__TAURI__.store) {
      try {
        this.storeInstance = await window.__TAURI__.store.createStore('.mambo-store.json');
        await this.storeInstance.load();
      } catch (e) {
        console.warn('Tauri Store no disponible, usando LocalStorage fallback', e);
        this.storeInstance = null;
      }
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
      } catch (e) {
        console.error('Error guardando en Tauri Store:', e);
      }
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage quota superada:', e);
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
    return await this.getItem(this.KEYS.CATALOG, { items: [], sel: {} });
  },

  async saveHistorial(historialArray) {
    await this.setItem(this.KEYS.HISTORIAL, historialArray);
  },

  async loadHistorial() {
    return await this.getItem(this.KEYS.HISTORIAL, []);
  }
};

window.AppStorage = AppStorage;
