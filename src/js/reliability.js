// ============================================
// Mambo Pedidos - Reliability Module
// Error boundaries, data integrity, backup/recovery, import validation
// ============================================

const Reliability = {
  _errorLog: [],
  MAX_ERROR_LOG: 50,
  ERROR_LOG_KEY: 'mambo_error_log',

  _loadPersistedErrors() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(this.ERROR_LOG_KEY);
      if (raw) this._errorLog = JSON.parse(raw).slice(-this.MAX_ERROR_LOG);
    } catch (e) {}
  },

  _persistErrors() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(this._errorLog.slice(-this.MAX_ERROR_LOG)));
      }
    } catch (e) {}
  },

  // ── Layer 1: Global Error Boundary ──

  /**
   * Install global error handlers. Call once at app startup.
   * Catches unhandled errors and promise rejections, shows user-visible toast.
   */
  installErrorBoundary() {
      if (typeof window === 'undefined') return;
      this._loadPersistedErrors();

    window.addEventListener('error', (event) => {
      this._recordError('uncaught', event.message, event.filename, event.lineno);
      if (typeof toast === 'function') {
        toast('⚠️ Error inesperado: ' + (event.message || 'desconocido').substring(0, 80), 'error');
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || 'promesa rechazada');
      this._recordError('unhandledrejection', msg);
      if (typeof toast === 'function') {
        toast('⚠️ Operación falló: ' + msg.substring(0, 80), 'error');
      }
    });
  },

  /**
   * Wrap a critical function with error catching.
   * If the function throws, shows a toast and returns the fallback value.
   * @param {Function} fn - The function to wrap
   * @param {string} label - Human-readable label for error messages
   * @param {*} [fallback] - Value to return on error
   * @returns {Function} Wrapped function
   */
  safeCall(fn, label, fallback) {
    return function (...args) {
      try {
        const result = fn.apply(this, args);
        if (result && typeof result.catch === 'function') {
          return result.catch((err) => {
            Reliability._recordError('async:' + label, err.message || String(err));
            if (typeof toast === 'function') {
              toast(`⚠️ ${label} falló: ${(err.message || '').substring(0, 60)}`, 'error');
            }
            return fallback;
          });
        }
        return result;
      } catch (err) {
        Reliability._recordError('sync:' + label, err.message || String(err));
        if (typeof toast === 'function') {
          toast(`⚠️ ${label} falló: ${(err.message || '').substring(0, 60)}`, 'error');
        }
        return fallback;
      }
    };
  },

  _recordError(type, message, source, line) {
      this._errorLog.push({
        type,
        message: String(message || '').substring(0, 200),
        source: source || '',
        line: line || 0,
        timestamp: new Date().toISOString()
      });
      if (this._errorLog.length > this.MAX_ERROR_LOG) {
        this._errorLog.shift();
      }
      this._persistErrors();
    },

    getErrorLog() {
      if (this._errorLog.length === 0) this._loadPersistedErrors();
      return [...this._errorLog];
    },

    // IT29: exporta el error log como JSON descargable (para soporte/debug).
    exportErrorLog() {
      const log = this.getErrorLog();
      const payload = {
        app: 'Mambo Pedidos',
        exportedAt: new Date().toISOString(),
        count: log.length,
        errors: log
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mambo-error-log.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof toast === 'function') toast(`📋 ${log.length} errores exportados`, 'info');
      return log;
    },

  // ── Layer 2: Data Integrity Guard ──

  /**
   * Validate catalog data integrity.
   * Checks: unique SKUs, numeric FOB, required fields, valid categories.
   * @param {Array} items - Catalog items
   * @returns {{ valid: boolean, issues: Array, repaired: number }}
   */
  validateCatalogIntegrity(items) {
    const issues = [];
    let repaired = 0;
    if (!Array.isArray(items)) {
      return { valid: false, issues: [{ type: 'fatal', message: 'Catalog is not an array' }], repaired: 0 };
    }

    const seenSkus = new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        issues.push({ type: 'corrupt', index: i, message: 'Item is not an object' });
        continue;
      }

      // SKU uniqueness
      const sku = String(item.sku || '').trim();
      if (!sku) {
        issues.push({ type: 'missing_sku', index: i, message: `Item ${i} has no SKU` });
      } else if (seenSkus.has(sku)) {
        issues.push({ type: 'duplicate_sku', index: i, sku, message: `Duplicate SKU "${sku}" at index ${i}` });
      }
      seenSkus.add(sku);

      // FOB numeric
      const fob = Number(item.fob);
      if (!Number.isFinite(fob) || fob < 0) {
        issues.push({ type: 'invalid_fob', index: i, sku, message: `Invalid FOB "${item.fob}" for ${sku}` });
        item.fob = 0;
        repaired++;
      }

      // Required fields
      if (!item.modelo || typeof item.modelo !== 'string' || item.modelo.trim().length === 0) {
        issues.push({ type: 'missing_model', index: i, sku, message: `Missing modelo for ${sku}` });
      }
    }

    return { valid: issues.filter(i => i.type === 'corrupt' || i.type === 'fatal').length === 0, issues, repaired };
  },

  /**
   * Clean selection of orphaned SKUs not present in the catalog.
   * @param {Object} selection - SKU → qty map
   * @param {Array} catalog - Catalog items
   * @returns {{ cleaned: Object, removed: string[] }}
   */
  cleanOrphanedSelection(selection, catalog) {
    const catalogSkus = new Set((catalog || []).map(i => String(i.sku || '').trim()).filter(Boolean));
    const cleaned = {};
    const removed = [];
    for (const [sku, qty] of Object.entries(selection || {})) {
      if (catalogSkus.has(sku)) {
        cleaned[sku] = qty;
      } else {
        removed.push(sku);
      }
    }
    return { cleaned, removed };
  },

  // ── Layer 3: Storage Backup & Recovery ──

  BACKUP_KEY: 'mambo_catalog_backup',

  /**
   * Create a backup of the current catalog state before saving.
   * @param {Object} payload - The catalog payload {items, sel}
   */
  createBackup(payload) {
    try {
      if (typeof localStorage !== 'undefined' && payload) {
        localStorage.setItem(this.BACKUP_KEY, JSON.stringify({
          data: payload,
          timestamp: new Date().toISOString()
        }));
      }
    } catch {
      // Backup failure is non-fatal; log silently
    }
  },

  /**
   * Attempt to recover catalog from backup if primary is corrupt/empty.
   * @param {Object|null} primaryData - Data from primary storage (null if corrupt)
   * @returns {{ data: Object|null, recovered: boolean, backupAge: string|null }}
   */
  recoverFromBackup(primaryData) {
    // If primary is valid, no recovery needed
    if (primaryData && primaryData.items && Array.isArray(primaryData.items) && primaryData.items.length > 0) {
      return { data: primaryData, recovered: false, backupAge: null };
    }

    try {
      if (typeof localStorage === 'undefined') return { data: null, recovered: false, backupAge: null };
      const raw = localStorage.getItem(this.BACKUP_KEY);
      if (!raw) return { data: null, recovered: false, backupAge: null };

      const backup = JSON.parse(raw);
      if (backup && backup.data && backup.data.items && Array.isArray(backup.data.items)) {
        return { data: backup.data, recovered: true, backupAge: backup.timestamp || 'unknown' };
      }
    } catch {
      // Backup also corrupt
    }
    return { data: null, recovered: false, backupAge: null };
  },

  // ── Layer 4: Import Schema Validation ──

  CATALOG_REQUIRED_COLUMNS: ['Modelo'],
  CATALOG_RECOMMENDED_COLUMNS: ['Marca', 'Categoría', 'FOB USD', 'FOB unit USD'],
  ORDER_REQUIRED_COLUMNS: ['Modelo'],
  ORDER_RECOMMENDED_COLUMNS: ['SKU', 'Cantidad', 'FOB USD', 'FOB unit USD'],

  /**
   * Validate that an imported file has the minimum required columns.
   * @param {string[]} headers - Column headers from the file
   * @param {string} route - 'catalog' or 'order'
   * @returns {{ valid: boolean, missing: string[], detected: string[], warnings: string[] }}
   */
  validateImportSchema(headers, route) {
    const required = route === 'order' ? this.ORDER_REQUIRED_COLUMNS : this.CATALOG_REQUIRED_COLUMNS;
    const recommended = route === 'order' ? this.ORDER_RECOMMENDED_COLUMNS : this.CATALOG_RECOMMENDED_COLUMNS;
    const normalizedHeaders = (headers || []).map(h => String(h || '').trim());
    const headerSet = new Set(normalizedHeaders.map(h => h.toLowerCase()));

    const missing = required.filter(col => !headerSet.has(col.toLowerCase()));
    const detected = [...required, ...recommended].filter(col => headerSet.has(col.toLowerCase()));
    const warnings = recommended.filter(col => !headerSet.has(col.toLowerCase()));

    return {
      valid: missing.length === 0,
      missing,
      detected,
      warnings: warnings.map(w => `Columna recomendada "${w}" no encontrada`),
      headerCount: normalizedHeaders.length
    };
  },

  /**
   * Detect encoding from a file's raw bytes (BOM detection).
   * @param {Uint8Array|Buffer} bytes - First bytes of the file
   * @returns {{ encoding: string, hasBOM: boolean }}
   */
  detectEncoding(bytes) {
    if (!bytes || bytes.length < 2) return { encoding: 'utf-8', hasBOM: false };
    // UTF-8 BOM: EF BB BF
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes.length > 2 && bytes[2] === 0xBF) {
      return { encoding: 'utf-8', hasBOM: true };
    }
    // UTF-16 LE BOM: FF FE
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return { encoding: 'utf-16le', hasBOM: true };
    }
    // UTF-16 BE BOM: FE FF
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return { encoding: 'utf-16be', hasBOM: true };
    }
    return { encoding: 'utf-8', hasBOM: false };
  },

  // ── Layer 5: Import Result Summary ──

  /**
   * Build a structured summary of an import operation.
   * @param {Object} opts - { fileName, totalParsed, imported, skipped, failed, emptyParse, warnings }
   * @returns {Object} Structured summary with user-visible message
   */
  buildImportSummary(opts) {
    const { fileName = '', totalParsed = 0, imported = 0, skipped = 0, failed = 0, warnings = [] } = opts || {};
    const emptyParse = totalParsed === 0;

    let status, message;
    if (emptyParse) {
      status = 'EMPTY';
      message = `⚠️ "${fileName}" no produjo ningún producto. Verificá que el archivo tenga datos y el formato correcto.`;
    } else if (failed > 0 && imported === 0) {
      status = 'ALL_FAILED';
      message = `❌ "${fileName}": ${failed} filas fallaron, 0 importadas. Revisá los errores.`;
    } else if (imported > 0) {
      status = 'OK';
      const parts = [`${imported} importados`];
      if (skipped > 0) parts.push(`${skipped} omitidos`);
      if (failed > 0) parts.push(`${failed} con error`);
      message = `✅ "${fileName}": ${parts.join(', ')}.`;
    } else {
      status = 'EMPTY';
      message = `⚠️ "${fileName}": ${totalParsed} filas procesadas pero ninguna cumplió los criterios de importación.`;
    }

    return { status, message, fileName, totalParsed, imported, skipped, failed, emptyParse, warnings };
  },

  /**
   * Validate that a parsed product has the minimum viable fields.
   * @param {Object} item - Parsed product item
   * @returns {{ viable: boolean, missing: string[] }}
   */
  validateProductViability(item) {
    const missing = [];
    if (!item) return { viable: false, missing: ['item'] };
    if (!item.modelo || String(item.modelo).trim().length === 0) missing.push('modelo');
    const fob = Number(item.fob);
    if (!Number.isFinite(fob) || fob <= 0) missing.push('fob');
    return { viable: missing.length === 0, missing };
  },

  /**
   * Validate file type before processing.
   * @param {string} fileName - The file name
   * @param {string} expectedType - 'pdf', 'csv', 'xlsx', or 'any'
   * @returns {{ valid: boolean, detectedType: string, reason: string }}
   */
  validateFileType(fileName, expectedType) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const typeMap = { pdf: 'pdf', csv: 'csv', xlsx: 'xlsx', xls: 'xlsx' };
    const detectedType = typeMap[ext] || 'unknown';

    if (detectedType === 'unknown') {
      return { valid: false, detectedType, reason: `Extensión ".${ext}" no soportada. Usá PDF, CSV o XLSX.` };
    }
    if (expectedType && expectedType !== 'any' && detectedType !== expectedType) {
      return { valid: false, detectedType, reason: `Se esperaba ${expectedType} pero se recibió .${ext}` };
    }
    return { valid: true, detectedType, reason: '' };
  }
};

if (typeof window !== 'undefined') window.Reliability = Reliability;
if (typeof module !== 'undefined') module.exports = Reliability;
