/**
 * Mambo Pedidos - Manejador Central de Errores
 * Captura, loguea y reporta errores de forma consistente
 */

const ErrorHandler = {
  errorHistory: [],
  maxHistorySize: 50,

  /**
   * Registra un error con contexto completo
   */
  capture(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context,
      type: this.classifyError(error)
    };

    this.errorHistory.unshift(errorRecord);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }

    console.error(`[${errorRecord.type}] ${errorRecord.message}`, context);
    return errorRecord;
  },

  /**
   * Clasifica el tipo de error
   */
  classifyError(error) {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) return 'NETWORK';
    if (msg.includes('parse') || msg.includes('json')) return 'PARSE';
    if (msg.includes('permission') || msg.includes('access')) return 'PERMISSION';
    if (msg.includes('not found') || msg.includes('404')) return 'NOT_FOUND';
    if (msg.includes('quota') || msg.includes('storage')) return 'STORAGE';
    if (msg.includes('invalid') || msg.includes('format')) return 'VALIDATION';
    return 'UNKNOWN';
  },

  /**
   * Ejecuta una función asíncrona con manejo de errores
   */
  async safeExecute(fn, fallback = null, context = {}) {
    try {
      return await fn();
    } catch (error) {
      this.capture(error, context);
      return typeof fallback === 'function' ? fallback(error) : fallback;
    }
  },

  /**
   * Valida que un valor no sea nulo/undefined
   */
  validateNotNull(value, fieldName, defaultValue = null) {
    if (value === null || value === undefined) {
      console.warn(`Campo "${fieldName}" es nulo, usando valor por defecto`);
      return defaultValue;
    }
    return value;
  },

  /**
   * Valida que un array sea válido
   */
  validateArray(value, fieldName) {
    if (!Array.isArray(value)) {
      console.warn(`Campo "${fieldName}" no es un array`);
      return [];
    }
    return value;
  },

  /**
   * Obtiene los últimos errores registrados
   */
  getRecentErrors(count = 10) {
    return this.errorHistory.slice(0, count);
  },

  /**
   * Limpia el historial de errores
   */
  clearHistory() {
    this.errorHistory = [];
  }
};

if (typeof window !== 'undefined') window.ErrorHandler = ErrorHandler;
if (typeof module !== 'undefined') module.exports = ErrorHandler;
