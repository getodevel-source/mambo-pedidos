/**
 * Mambo Pedidos - Conector Real a Modelo de Lenguaje Local (LocalLlm)
 *
 * Cliente modular para integración real con servidores LLM locales (Ollama / LM Studio / Tauri IPC).
 * Endpoint por defecto: http://localhost:11434 (Ollama)
 * Cero simulaciones. Verificación de conectividad real en runtime.
 */

const LocalLlm = {
  endpoint: 'http://localhost:11434',
  model: 'llama3:8b',
  isAvailable: false,
  isChecking: false,
  lastError: null,

  /**
   * Configura el endpoint y modelo a utilizar.
   */
  configure(options = {}) {
    if (options.endpoint) this.endpoint = options.endpoint.replace(/\/$/, '');
    if (options.model) this.model = options.model;
  },

  /**
   * Comprueba si el servidor local de IA está corriendo y respondiendo.
   */
  async checkHealth() {
    if (this.isChecking) return this.isAvailable;
    this.isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map(m => m.name);
        this.isAvailable = true;
        this.lastError = null;
        if (models.length > 0 && !models.includes(this.model)) {
          this.model = models[0]; // Usar primer modelo disponible
        }
        return true;
      }
    } catch (e) {
      this.isAvailable = false;
      this.lastError = e.message || 'Servidor local no disponible';
    } finally {
      this.isChecking = false;
    }

    return false;
  },

  /**
   * Devuelve el estado actual de la conexión con el motor local.
   */
  getStatus() {
    return {
      available: this.isAvailable,
      endpoint: this.endpoint,
      model: this.model,
      lastError: this.lastError
    };
  },

  /**
   * Consulta al modelo local enviando un prompt y esperando respuesta en JSON estructurado.
   */
  async queryStructuredJson(prompt, systemPrompt = 'Responde exclusivamente con un objeto JSON válido.') {
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new Error(`Motor de IA local no disponible en ${this.endpoint}.`);
    }

    try {
      const res = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\n${prompt}`,
          stream: false,
          format: 'json'
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} de ${this.endpoint}`);
      }

      const data = await res.json();
      const responseText = data.response || '';
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Error al consultar LocalLlm:', e);
      throw e;
    }
  },

  /**
   * Extrae atributos estructurados de un texto de celda/producto vía el modelo local real.
   */
  async parseCellStructured(cellText, customBrands = []) {
    const prompt = `Analiza este texto de catálogo de periféricos gamer y extrae los campos en este formato JSON exacto:
{"marca": "...", "modelo": "...", "variante": "...", "cat": "...", "fob": 0.0}

Categorías válidas: TECLADO, MOUSE, HEADSET, AURICULAR, CONTROLLER, MOUSEPAD, SWITCH, CAMARA, CUIDADO_PERSONAL, NUMPAD, ACCESORIO.
Marcas conocidas: ${['REDRAGON', 'LOGITECH', 'RAZER', ...customBrands].join(', ')}.

Texto de la celda: "${cellText}"`;

    return this.queryStructuredJson(prompt);
  }
};

if (typeof window !== 'undefined') window.LocalLlm = LocalLlm;
if (typeof module !== 'undefined') module.exports = LocalLlm;
