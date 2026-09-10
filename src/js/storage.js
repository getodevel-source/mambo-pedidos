// ============================================
//  Mambo Pedidos - Módulo de Persistencia (Storage)
//  Backend real: los plugins de Tauri v2 a traves de window.MamboTauriBridge
//  (ver src/bridge/tauri-bridge.mjs), con fallback transparente a LocalStorage
//  cuando el puente no esta (navegador, tests de Node, dist/ sin vendor).
// ============================================

const AppStorage = {
  KEYS: {
    CATALOG: 'mambo_catalog_v2',
    HISTORIAL: 'mambo_historial_v2',
    BRANDS: 'mambo_brands_v1',
    IMPORTS: 'mambo_imports_v1',
    // importWizard: el draft del proyecto vivia en localStorage crudo (cuota
    // ~5MB, se perdía con el strip). Pasa a este par, que en desktop vive en el
    // store de $APPDATA.
    PROJECT: 'mambo_project_v1',
    // importWizard: state auto-guardado del asistente (markup, fletes, NCM).
    // Distinta de PROJECT: esa es la guardada explicita del proyecto completo.
    WIZARD: 'mambo_wizard_v1'
  },
  storeInstance: null,
  // 'tauri' = store del plugin (cuota de disco) | 'localstorage' = cuota ~5MB.
  // Se resuelve en init() y manda sobre la politica de strip (ver setItem).
  mode: 'localstorage',
  // Ultimo intento de escritura: {backend, at, imagesWritten, imagesFailed,
  // failedRefs, degraded, stripLevel}. Existe para que ningun fallo de
  // persistencia vuelva a ser silencioso.
  lastPersistence: null,
  // Motivo por el cual NO se pudo usar el store de Tauri (null = sin problema).
  persistenceError: null,
  _storeWarned: false,

  // Unico acceso al puente de plugins. Fuera de Tauri es null.
  _bridge() {
    try { return (typeof window !== 'undefined' && window.MamboTauriBridge) || null; } catch { return null; }
  },

  // Inicializar el store: SOLO via el puente (MamboTauriBridge.store.load).
  async init() {
    const bridge = this._bridge();
    const tauriExpected = !!(bridge && bridge.inTauri);
    this.mode = 'localstorage';
    try {
      // Causa raiz que arregla esto: en Tauri v2 los plugins se publican solo como
      // modulos ESM, asi que window.__TAURI_PLUGIN_STORE__ y __TAURI__.store NUNCA
      // existen y el probe viejo dejaba storeInstance en null para siempre. El
      // puente es el unico camino real; los probes legacy quedan como ultima
      // oportunidad porque no cuestan nada y los ejercita la suite de Node, pero
      // no definen `mode` (en la app real no van a resolver jamas).
      let pending = null;
      if (tauriExpected && bridge.store && typeof bridge.store.load === 'function') {
        pending = bridge.store.load('.mambo-store.json');
      } else {
        const storePlugin = window.__TAURI_PLUGIN_STORE__ || window.__TAURI__?.store || window.__TAURI__?.plugin?.store;
        let createStore = null;
        if (storePlugin) {
          if (typeof storePlugin.createStore === 'function') createStore = storePlugin.createStore;
          else if (storePlugin.Store && typeof storePlugin.Store.load === 'function') createStore = storePlugin.Store.load;
          else if (typeof storePlugin.getStore === 'function') createStore = storePlugin.getStore;
        }
        if (createStore) pending = createStore('.mambo-store.json');
      }
      if (pending) {
        // IT37: guard de timeout — si el store file esta lockeado (otra
        // instancia corriendo) o el IPC no responde, NUNCA colgamos el init
        // (init colgado = app renderizada sin listeners = ningun boton).
        const timeoutMs = 3000;
        let timer;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Store init timeout')), timeoutMs); });
        try {
          this.storeInstance = await Promise.race([pending, timeout]);
        } finally {
          clearTimeout(timer);
        }
        // Store.load (Tauri v2) ya devuelve el store cargado (sin metodo .load);
        // createStore legacy si necesita load() explicito, una sola vez.
        if (this.storeInstance && typeof this.storeInstance.load === 'function' && !this.storeInstance._loaded) {
          let loadTimer;
          const loadTimeout = new Promise((_, reject) => { loadTimer = setTimeout(() => reject(new Error('Store load timeout')), 3000); });
          try {
            await Promise.race([this.storeInstance.load(), loadTimeout]);
            this.storeInstance._loaded = true;
          } finally {
            clearTimeout(loadTimer);
          }
        }
      }
      if (!this.storeInstance) this.storeInstance = null;
      if (tauriExpected && this.storeInstance) this.mode = 'tauri';
      if (this.mode === 'tauri') {
        this.persistenceError = null;
      } else if (tauriExpected) {
        // Modo 'tauri' esperado pero el store no resolvio: NO lo decimos con el
        // modo, porque el resto de la politica (strip) depende de lo que HAY.
        this.persistenceError = 'El store de Tauri no devolvio una instancia; los datos quedan en localStorage (cuota limitada).';
        this._warnPersistence();
      }
    } catch (e) {
      console.warn('Tauri Store no disponible, usando LocalStorage fallback:', e);
      this.storeInstance = null;
      this.mode = 'localstorage';
      if (tauriExpected) {
        this.persistenceError = 'El store de Tauri no se pudo cargar: ' + ((e && e.message) || e) + '. Los datos quedan en localStorage (cuota limitada).';
        this._warnPersistence();
      }
    }
  },

  // Aviso unico por sesion: init() puede correrse mas de una vez y repetir el
  // toast solo tapa el trabajo del usuario.
  _warnPersistence() {
    if (this._storeWarned) return;
    this._storeWarned = true;
    if (typeof toast === 'function') toast(this.persistenceError, 'warning');
  },
  // ── Cifrado en reposo (ítem 1 ronda 2) ──
  // DEK de 256 bits en el KEYCHAIN del SO (nunca en disco ni en el store);
  // valores AES-GCM con iv aleatorio por escritura: {__enc__:1, iv, ct}.
  // Migración transparente: lo que ya está en texto plano se sigue leyendo y
  // se cifra al próximo guardado. Sin keychain (navegador, keychain roto) se
  // degrada a texto plano CON aviso, nunca se brickea la app.
  DEK_SERVICE: 'com.mambo.pedidos',
  DEK_ACCOUNT: 'store-dek-v1',
  _dek: null,
  _cryptoWarned: false,

  _warnCrypto(msg) {
    if (this._cryptoWarned) return;
    this._cryptoWarned = true;
    console.warn(msg);
    if (typeof toast === 'function') toast(msg, 'warning');
  },

  _b64enc(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof Buffer !== 'undefined') return Buffer.from(arr).toString('base64');
    let bin = '';
    for (let i = 0; i < arr.length; i += 8192) bin += String.fromCharCode.apply(null, arr.subarray(i, i + 8192));
    return btoa(bin);
  },

  _b64dec(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(str), 'base64'));
    const bin = atob(String(str));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  },

  _subtle() {
    try {
      const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto
        : (typeof require === 'function' ? require('crypto').webcrypto : null);
      return (c && c.subtle) || null;
    } catch { return null; }
  },

  // DEK en memoria (solo proceso vivo). null = sin cifrado disponible.
  async _getDek() {
    if (this._dek) return this._dek;
    const subtle = this._subtle();
    if (!subtle) return null;
    let bridge = null;
    try { bridge = this._bridge(); } catch { bridge = null; }
    const kc = bridge && bridge.inTauri && bridge.keychain;
    if (!kc) return null;
    try {
      const stored = await kc.get(this.DEK_SERVICE, this.DEK_ACCOUNT);
      if (stored) {
        this._dek = this._b64dec(stored);
        if (this._dek.length === 32) return this._dek;
        this._dek = null;
      }
    } catch (e) {
      const msg = String((e && e.message) || e || '');
      if (!/NO_ENTRY/.test(msg)) {
        this._warnCrypto('⚠️ Keychain no disponible: el store queda en texto plano en este equipo.');
        return null;
      }
      // NO_ENTRY: primera vez → generar y guardar la DEK.
    }
    try {
      const raw = new Uint8Array(32);
      const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto
        : (typeof require === 'function' ? require('crypto').webcrypto : null);
      (g || crypto).getRandomValues(raw);
      await kc.set(this.DEK_SERVICE, this.DEK_ACCOUNT, this._b64enc(raw));
      this._dek = raw;
      return this._dek;
    } catch (e) {
      this._warnCrypto('⚠️ No se pudo guardar la clave en el keychain: el store queda en texto plano.');
      return null;
    }
  },

  async _importDek(raw) {
    const subtle = this._subtle();
    if (!subtle) throw new Error('WebCrypto no disponible');
    return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  },

  // Cifra un valor a sobre sellado {__enc__, iv, ct}. Sin DEK → tal cual.
  async _encryptValue(value) {
    const dek = await this._getDek();
    if (!dek) return value;
    const subtle = this._subtle();
    const iv = new Uint8Array(12);
    ((typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto).getRandomValues(iv);
    const key = await this._importDek(dek);
    const data = new TextEncoder().encode(JSON.stringify(value));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return { __enc__: 1, iv: this._b64enc(iv), ct: this._b64enc(new Uint8Array(ct)) };
  },

  // Inversa: sobre → valor; texto plano heredado → tal cual (migración).
  async _decryptValue(stored, defaultValue = null) {
    if (!stored || typeof stored !== 'object' || stored.__enc__ !== 1) return stored !== undefined ? stored : defaultValue;
    const dek = await this._getDek();
    if (!dek) {
      this._warnCrypto('⚠️ Dato cifrado ilegible sin acceso al keychain.');
      return defaultValue;
    }
    try {
      const subtle = this._subtle();
      const key = await this._importDek(dek);
      const pt = await subtle.decrypt(
        { name: 'AES-GCM', iv: this._b64dec(stored.iv) },
        key, this._b64dec(stored.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) {
      console.error('Dato del store ilegible (¿manipulado?):', e);
      if (typeof toast === 'function') toast('⚠️ Un dato guardado está corrupto o fue manipulado; se ignora.', 'error');
      return defaultValue;
    }
  },


  // Arranca el registro de un intento de persistencia (lo llama saveCatalog).
  _beginPersistence() {
    this.lastPersistence = {
      backend: null,
      at: null,
      imagesWritten: 0,
      imagesFailed: 0,
      failedRefs: [],
      degraded: false,
      stripLevel: 0
    };
    return this.lastPersistence;
  },

  // Anota el resultado de un paso del intento actual (imagenes, store, strip).
  _recordPersistence(fields) {
    const rec = this.lastPersistence || this._beginPersistence();
    Object.assign(rec, fields);
    rec.at = new Date().toISOString();
    return rec;
  },

  // Error accionable: en desktop el almacen es un archivo bajo $APPDATA; un
  // "cuota insuficiente" sin ruta ni clave no permite reparar nada.
  async _storageError(key, cause) {
    let where = '';
    try {
      const fsApi = this._fsApi();
      if (fsApi && typeof fsApi.appDataDir === 'function') where = ' en ' + (await fsApi.appDataDir());
    } catch { /* sin ruta: el mensaje sigue siendo util */ }
    return new Error('No se pudo guardar "' + key + '" en el almacenamiento de la app' + where + ': ' + ((cause && cause.message) || cause));
  },

  // Foto de la persistencia para diagnostico/soporte. imagesDir es la base
  // $APPDATA donde el puente ancla images/ (null si no se puede resolver).
  async diagnostics() {
    const bridge = this._bridge();
    let imagesDir = null;
    try {
      const fsApi = this._fsApi();
      if (fsApi && typeof fsApi.appDataDir === 'function') imagesDir = await fsApi.appDataDir();
    } catch { /* sin appDataDir no hay diagnostico de ruta */ }
    return {
      mode: this.mode,
      storeReady: !!this.storeInstance,
      bridgePresent: !!bridge,
      inTauri: !!(bridge && bridge.inTauri),
      imagesDir
    };
  },


  async getItem(key, defaultValue = null) {
    if (this.storeInstance) {
      try {
        const val = await this.storeInstance.get(key);
        if (val === undefined || val === null) return defaultValue;
        return await this._decryptValue(val, defaultValue);
      } catch (e) {
        console.error('Error leyendo Tauri Store:', e);
      }
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        // Antes: JSON corrupto → vacío silencioso (el usuario perdía el
        // historial/marcas sin red). Ahora se avisa y el rescate (backup)
        // lo intenta el caller (loadCatalog).
        console.error('Dato local corrupto en "' + key + '":', parseErr);
        if (typeof toast === 'function') toast('⚠️ Dato local "' + key + '" corrupto; se intenta el respaldo.', 'warning');
        return defaultValue;
      }
      return await this._decryptValue(parsed, defaultValue);
    } catch {
      return defaultValue;
    }
  },

  async setItem(key, value) {
    if (this.storeInstance) {
      try {
        await this.storeInstance.set(key, await this._encryptValue(value));
        await this.storeInstance.save();
        // backend='store' solo aparece por el probe legacy (store sin puente);
        // en la app real el camino bueno es 'tauri'.
        this._recordPersistence({
          backend: this.mode === 'tauri' ? 'tauri' : 'store',
          degraded: false,
          stripLevel: 0,
          encrypted: !!this._dek
        });
        return;
      } catch (e) {
        console.error('Error guardando en Tauri Store:', e);
        // B: aca NUNCA se despoja nada. En desktop hay cuota de disco y borrar
        // imagenes o _evaluations en silencio es perder datos que si cabian: el
        // error sube, accionable.
        if (this.mode === 'tauri') throw await this._storageError(key, e);
      }
    }
    const serialized = JSON.stringify(await this._encryptValue(value));
    try {
      localStorage.setItem(key, serialized);
      this._recordPersistence({ backend: 'localstorage', degraded: false, stripLevel: 0 });
      return;
    } catch (e) {
      console.warn('localStorage quota exceeded, attempting progressive strip...', e);
      // Red de seguridad: en modo tauri no deberíamos llegar acá (arriba ya
      // lanzamos), pero _stripForQuota esta prohibido en ese modo por contrato.
      if (this.mode === 'tauri') throw await this._storageError(key, e);
    }

    // Progressive strip: remove heavy data to fit localStorage.
    // Ítem 17 devolución: un guardado recortado NO es un guardado exitoso.
    // Se persiste lo que entra (para no perder TODO) pero se LANZA un error
    // accionable en vez de retornar como si nada: el caller (scheduleCatalogSave
    // y cía.) lo convierte en toast de error, no en silencio.
    const stripped = this._stripForQuota(value);
    try {
      localStorage.setItem(key, JSON.stringify(await this._encryptValue(stripped)));
      this._recordPersistence({ backend: 'localstorage', degraded: true, stripLevel: 1, encrypted: !!this._dek });
      throw new Error('Cuota localStorage: "' + key + '" guardado SIN imágenes (quedaron solo en esta sesión). Liberá espacio y guardá de nuevo.');
    } catch (e2) {
      if (e2 && /Cuota localStorage/.test(e2.message || '')) throw e2;
      console.warn('Still over quota after image strip, removing evaluations...', e2);
    }

    // Level 2: also remove _evaluations, warnings, rawText, cellRawText
    const strippedDeep = this._stripForQuota(stripped, true);
    try {
      localStorage.setItem(key, JSON.stringify(await this._encryptValue(strippedDeep)));
      this._recordPersistence({ backend: 'localstorage', degraded: true, stripLevel: 2, encrypted: !!this._dek });
      throw new Error('Cuota localStorage: "' + key + '" guardado SIN imágenes ni metadatos (degradado). Liberá espacio y guardá de nuevo.');
    } catch (e3) {
      if (e3 && /Cuota localStorage/.test(e3.message || '')) throw e3;
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
    const clone = structuredClone(value);
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
      } catch (e) { console.warn('AppStorage.removeItem (store):', e); }
    }
    try {
      localStorage.removeItem(key);
    } catch (e) { console.warn('AppStorage.removeItem (localStorage):', e); }
  },

  // Helpers específicos
  async saveCatalog(items, selection) {
    // B: cada guardado deja registro auditable (backend, imagenes escritas y
    // perdidas, nivel de degradacion si lo hay).
    this._beginPersistence();
    // Layer 3: Backup before save
    if (typeof Reliability !== 'undefined') {
      Reliability.createBackup({ items, sel: selection });
    }
    // photo-quality (FASE B): escribe las dataURLs a archivos y persiste _imageRef
    // (contrato runtime item.img=dataURL se mantiene intacto).
    const payload = await this._serializeImagesToFiles(items, selection);
    await this.setItem(this.KEYS.CATALOG, payload);
  },

  async loadCatalog() {
    let data = await this.getItem(this.KEYS.CATALOG, { items: [], sel: {} });
    // Spec process-storage-backup: si el primary vino vacío/corrupto, intentar
    // el backup de disco (tauri) antes de devolver catálogo vacío.
    if (!data || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
      if (typeof Reliability !== 'undefined' && typeof Reliability._readBackup === 'function') {
        const bk = await Reliability._readBackup();
        if (bk && bk.data && Array.isArray(bk.data.items) && bk.data.items.length) {
          data = bk.data;
          if (typeof toast === 'function') toast('⚠️ Catálogo recuperado del respaldo (' + bk.data.items.length + ' productos)', 'warning');
        }
      }
    }
    // photo-quality (FASE B): resuelve _imageRef → item.img (dataURL) leyendo archivo.
    await this._embedImagesFromFiles(data && data.items);
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

  async saveImports(payload) {
    await this.setItem(this.KEYS.IMPORTS, payload);
  },

  async loadImports() {
    return await this.getItem(this.KEYS.IMPORTS, { records: [], counter: 0 });
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

  // ── Slice 5b: imágenes a archivos (photo-quality, FASE B) ──
  // Mantiene el contrato runtime item.img=dataURL; mueve SOLO la persistencia:
  // save → archivos (images/<id>.<ext>) + _imageRef; load → resuelve ref→dataURL.

  _fsApi() {
    // El plugin fs de v2 tampoco es alcanzable por window.__TAURI__.fs (siempre
    // indefinido): la unica fuente valida es el puente.
    try {
      const bridge = this._bridge();
      return (bridge && bridge.inTauri && bridge.fs) || null;
    } catch { return null; }
  },

  _dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.replace(/^data:image\/[\w.+-]+;base64,/i, '');
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  },

  _bytesToDataUrl(bytes, mime) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // Chunked: String.fromCharCode.apply sobre bloques. Concatenar de a un char
    // (bin += ...) es quadratico: costaba segundos en un catalogo con cientos de
    // imagenes de cientos de KB. apply() con demasiados args revienta en algunos
    // engines, de ahi el tamano del bloque.
    const CHUNK = 8192;
    const parts = [];

    for (let i = 0; i < arr.length; i += CHUNK) {
      parts.push(String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK)));
    }
    return 'data:image/' + (mime || 'png') + ';base64,' + btoa(parts.join(''));
  },

  _fileNameFromDataUrl(dataUrl) {
    const ref = this.buildImageRef(dataUrl, '');
    return ref ? ref.relativePath : null;
  },
  // Valida un relativePath ANTES de tocar el fs: el ref se persiste en el store
  // y un valor manipulado ("../../token", "/etc/x") convertiría cada lectura
  // de imagen en acceso fuera de images/. Solo acepta lo que genera
  // buildImageRef: images/img_<hex>.<ext>.
  _isSafeImageRel(rel) {
    return typeof rel === 'string' && /^images\/img_[0-9a-f]{1,64}\.(png|jpg|jpeg|webp|gif)$/i.test(rel);
  },


  // Devuelve un payload persistible: escribe cada dataURL a archivo y deja
  // _imageRef en el item. Sin puente fs (tests / no-Tauri) → dataURL inline.
  async _serializeImagesToFiles(items, selection) {
    const fsApi = this._fsApi();
    const clone = (items || []).map(o => Object.assign({}, o));
    const refs = [];
    const failedRefs = [];
    let imagesWritten = 0;
    if (fsApi) {
      try { await fsApi.ensureDir('images'); } catch (e) {}
      // Mem (import-2026): desde el batch de import, el item en vivo lleva img=
      // THUMBNAIL y _imageRef → el archivo full ya existe en disco. Un item con
      // _imageRef válido NO se reescribe (el thumb es solo para render). Los que
      // no tienen ref (imagen manual/ediciones) conservan el camino de escritura.
      const BATCH = 32;
      for (let i = 0; i < clone.length; i += BATCH) {
        const chunk = clone.slice(i, i + BATCH);
        await Promise.all(chunk.map(async (item) => {
          if (item && item._imageRef && item._imageRef.relativePath) {
            // Ref heredado: solo vale si apunta dentro de images/ con el
            // formato propio; si no, se descarta y se re-deriva del img.
            if (this._isSafeImageRel(item._imageRef.relativePath)) {
              refs.push(item._imageRef.relativePath);
            } else {
              delete item._imageRef;
              failedRefs.push(String((item && item.sku) || '?') + ':ref-inseguro');
            }
          }
          if (item && !item._imageRef && typeof item.img === 'string' && /^data:image\//i.test(item.img)) {
            const rel = this._fileNameFromDataUrl(item.img);
            if (rel) {
              try {
                const mime = (item.img.match(/^data:image\/([\w.+-]+);/i) || [])[1] || 'png';
                await fsApi.writeBytes(rel, this._dataUrlToBytes(item.img));
                item._imageRef = { relativePath: rel, mime };
                item.img = '';
                refs.push(rel);
                imagesWritten++;
              } catch (e) {
                failedRefs.push(rel);
                console.warn('photo-quality: no se pudo escribir imagen a archivo:', e.message);
              }
            }
          }
        }));
      }
      await this._gcOrphanImages(refs, fsApi);
    }
    this._recordPersistence({ imagesWritten, imagesFailed: failedRefs.length, failedRefs });
    return { items: clone, sel: selection || {} };
  },

  // Genera un thumbnail PNG (maxSide corto) de una dataURL. ASINCRÓNICO: el
  // decode sincrónico (img.width justo después de src) devuelve 0 en Chromium/
  // WebKit, así que se espera onload. Sin canvas (tests/Node) devuelve null y
  // el caller conserva la imagen original.
  // Encodo un canvas ya dibujado: JPEG si no hay alpha (más chico), PNG si la hay.
  _encodeCanvas(c, quality = 0.82) {
    try {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let opaque = true;
      for (let i = 3; i < px.length && opaque; i += 4) if (px[i] < 250) opaque = false;
      return opaque ? c.toDataURL('image/jpeg', quality) : c.toDataURL('image/png');
    } catch {
      return c.toDataURL('image/png');
    }
  },

  // Genera thumbnails (112px para render + 36px para cotizaciones) de una
  // dataURL en UNA decode. ASINCRÓNICO: img.width justo después de src da 0 en
  // Chromium/WebKit; se espera onload. Sin canvas (tests/Node) devuelve null y
  // el caller conserva la imagen original.
  async _makeThumb(dataUrl, maxSide = 112) {
    try {
      if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      if (!img.width || !img.height) return null;
      const short = Math.min(img.width, img.height);
      const scale = short > maxSide ? maxSide / short : 1;
      if (scale >= 1) return null; // ya es chica: no agrandar ni re-codificar
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext && c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const thumb = this._encodeCanvas(c);
      // Sub-thumb 36px para cotizaciones (spec process-quote): el HTML embebe
      // la imagen por fila; 36px ≈ 1-2KB vs 12KB del thumb → quote 337→~120ms.
      let sm = null;
      try {
        const s36 = document.createElement('canvas');
        s36.width = Math.max(1, Math.round(img.width * (36 / Math.max(1, short))));
        s36.height = Math.max(1, Math.round(img.height * (36 / Math.max(1, short))));
        const sx = s36.getContext && s36.getContext('2d');
        if (sx) {
          sx.drawImage(img, 0, 0, s36.width, s36.height);
          sm = this._encodeCanvas(s36);
        }
      } catch {}
      return { thumb, sm };
    } catch { return null; }
  },

  // Mem (import-2026): el import de N productos con imágenes vivía en memoria
  // como dataURL completas (~75KB c/u → ~150MB con catálogo lleno; picos de
  // varios GB en WebKitGTK al decodificar 300px por card). Este paso:
  //  1) escribe el archivo COMPLETO a images/ (batches de 32 IPC — ~1.3s en
  //     2080 imágenes) y deja _imageRef en el item (el zoom resuelve full-res);
  //  2) reemplaza item.img por un thumbnail de ~112px (render idéntico en
  //     cards/tabla/cotizaciones, ~10x menos memoria y decodificado).
  // Sin fs o sin canvas degrada a imagen inline (contrato viejo); sin excepción.
  async batchImportImages(items) {
    if (!Array.isArray(items)) return { written: 0, thumbs: 0 };
    const fsApi = this._fsApi();
    const BATCH = 32;
    let written = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (item) => {
        if (!item || typeof item.img !== 'string' || !/^data:image\//i.test(item.img) || item._imageRef) return;
        const rel = this._fileNameFromDataUrl(item.img);
        if (!rel || !fsApi) return; // sin fs: el item queda con su dataURL inline (contrato viejo)
        try {
          await fsApi.writeBytes(rel, this._dataUrlToBytes(item.img));
          const mime = (item.img.match(/^data:image\/([\w.+-]+);/i) || [])[1] || 'png';
          item._imageRef = { relativePath: rel, mime };
          written++;
        } catch (e) {
          console.warn('import: no se pudo guardar la imagen a archivo (queda inline):', e.message);
          delete item._imageRef;
        }
      }));
    }
    let thumbs = 0;
    // Decodificar las 2080 completas a la vez no: batches de 32 como los writes.
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (item) => {
        if (item && item._imageRef && typeof item.img === 'string' && /^data:image\//i.test(item.img)) {
          const t = await this._makeThumb(item.img);
          if (t) {
            item.img = t.thumb || item.img;
            if (t.sm) item.imgSm = t.sm;
            thumbs++;
          }
        }
      }));
    }
    return { written, thumbs };
  },

  // Resuelve _imageRef → item.img (dataURL) leyendo el archivo. Desde el batch
  // de import el item lleva un THUMBNAIL en img; acá se regenera el thumb desde
  // el archivo full y se CONSERVA _imageRef (el zoom usa loadFullImage).
  async _embedImagesFromFiles(items) {
    const fsApi = this._fsApi();
    if (!fsApi || !Array.isArray(items)) return;
    const missing = [];
    const BATCH = 32;
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (item) => {
        if (item && item._imageRef && item._imageRef.relativePath &&
            !(typeof item.img === 'string' && /^data:image\//i.test(item.img))) {
          const rel = item._imageRef.relativePath;
          // Ref fuera de formato → no se toca el fs (ver _isSafeImageRel).
          if (!this._isSafeImageRel(rel)) { delete item._imageRef; item.img = '-'; return; }
          try {
            const bytes = await fsApi.readBytes(rel);
            const dataUrl = this._bytesToDataUrl(bytes, item._imageRef.mime);
            const t = await this._makeThumb(dataUrl);
            item.img = (t && t.thumb) || dataUrl;
            if (t && t.sm) item.imgSm = t.sm;
          } catch (e) {
            // Antes: foto faltante → img='-' + ref borrado EN SILENCIO (dato
            // perdido sin red). Ahora: se CONSERVA el ref para reintentar en el
            // próximo load y se informa una sola vez.
            item.img = '-';
            missing.push(rel);
          }
        }
      }));
    }
    if (missing.length) {
      this._recordPersistence({ imagesFailed: missing.length, failedRefs: missing.slice(0, 20) });
      console.warn('photo-quality: ' + missing.length + ' imágenes no se pudieron leer del disco (se conserva la referencia):', missing.slice(0, 10));
      if (typeof toast === 'function') toast('⚠️ ' + missing.length + ' fotos no están en disco; se muestran como "-".', 'warning');
    }
  },
  // Imagen COMPLETA de un item para zoom/edición: archivo si hay _imageRef
  // (async), si no el dataURL actual. null si no hay imagen.
  async loadFullImage(item) {
    if (!item) return null;
    const fsApi = this._fsApi();
    if (item._imageRef && item._imageRef.relativePath && fsApi && this._isSafeImageRel(item._imageRef.relativePath)) {
      try {
        const bytes = await fsApi.readBytes(item._imageRef.relativePath);
        return this._bytesToDataUrl(bytes, item._imageRef.mime || 'png');
      } catch (e) { /* fallback al thumb */ }
    }
    return (typeof item.img === 'string' && /^data:image\//i.test(item.img)) ? item.img : null;
  },

  // Huérfanos a PAPELERA (images/.trash/), no rm directo: la limpieza vieja
  // borraba archivos sin red y un ref válido con typo perdía la foto.
  async _gcOrphanImages(refs, fsApi) {
    try {
      const refSet = new Set(Array.isArray(refs) ? refs : []);
      const entries = await fsApi.list('images');
      for (const e of entries) {
        if (!e || !e.name) continue;
        if (e.name === '.trash') continue;
        const rel = 'images/' + e.name;
        if (!this._isSafeImageRel(rel) || refSet.has(rel)) continue;
        try {
          await fsApi.ensureDir('images/.trash');
          const bytes = await fsApi.readBytes(rel);
          await fsApi.writeBytes('images/.trash/' + e.name, bytes);
          await fsApi.remove(rel);
        } catch { try { await fsApi.remove(rel); } catch {} }
      }
    } catch {}
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
        await this.storeInstance.set(this.KEYS.CATALOG, await this._encryptValue(payload));
        await this.storeInstance.save();
        evidence.backend = 'tauri';
        evidence.encrypted = !!this._dek;
        return { backend: 'tauri', evidence };
      } catch (e) {
        evidence.backend = 'localstorage';
        evidence.tauriError = e.message;
      }
    } else {
      evidence.backend = 'localstorage';
    }

    try {
      localStorage.setItem(this.KEYS.CATALOG, JSON.stringify(await this._encryptValue(payload)));
    } catch (e) {
      evidence.localstorageError = e.message;
      // Retry with stripped images
      try {
        const stripped = this._stripForQuota(payload);
        localStorage.setItem(this.KEYS.CATALOG, JSON.stringify(await this._encryptValue(stripped)));
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
        data = await this._decryptValue(await this.storeInstance.get(this.KEYS.CATALOG), null);
        if (data) evidence.backend = 'tauri';
      } catch (e) {
        evidence.tauriError = e.message;
      }
    }

    if (!data) {
      try {
        const raw = localStorage.getItem(this.KEYS.CATALOG);
        if (raw) {
          data = await this._decryptValue(JSON.parse(raw), null);
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
};

if (typeof window !== 'undefined') window.AppStorage = AppStorage;
if (typeof module !== 'undefined') module.exports = AppStorage;
