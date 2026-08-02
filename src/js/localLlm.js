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

  async fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Comprueba si el servidor local de IA está corriendo y respondiendo.
   */
  async checkHealth() {
    // Cache health check for 30 seconds to avoid per-call HTTP overhead
    const now = Date.now();
    if (this._lastHealthCheck && (now - this._lastHealthCheck) < 30000) {
      return this.isAvailable;
    }
    if (this.isChecking) return this.isAvailable;
    this.isChecking = true;

    try {
      const res = await this.fetchWithTimeout(`${this.endpoint}/api/tags`, { method: 'GET' }, 2000);

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
      this._lastHealthCheck = Date.now();
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
      lastError: this.lastError,
      label: this.isAvailable
        ? `IA local activa (${this.model})`
        : this.lastError
          ? `IA local no disponible: ${this.lastError}`
          : 'IA local no detectada'
    };
  },

  /**
   * Update a DOM badge with the current LLM health status.
   * Call after checkHealth() to make the status visible to the user.
   * @param {string} [elementId='llmStatusBadge'] - DOM element id
   */
  updateStatusBadge(elementId = 'llmStatusBadge') {
    const el = document.getElementById(elementId);
    if (!el) return;
    const status = this.getStatus();
    el.textContent = status.label;
    el.title = `Endpoint: ${status.endpoint} | Modelo: ${status.model}`;
    el.style.color = status.available ? 'var(--green, #4caf50)' : 'var(--text-muted, #888)';
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
      const res = await this.fetchWithTimeout(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\n${prompt}`,
          stream: false,
          format: 'json'
        })
      }, 120000);

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
    const prompt = `Eres un extractor de datos de catálogos de periféricos gamer. Analiza el texto y extrae EXACTAMENTE estos campos en JSON:
{"marca": "...", "modelo": "...", "variante": "...", "cat": "...", "fob": 0.0}

REGLAS ESTRICTAS DE SEPARACIÓN DE CAMPOS:
- "marca": SOLO el nombre de la marca/fabricante (ej: "Redragon", "Logitech", "Razer"). NUNCA incluyas modelo, color ni descripción.
- "modelo": SOLO el nombre/código del producto SIN marca, SIN color, SIN descripción larga. Ej: "M652", "G502 HERO", "AK820 Pro". NUNCA incluyas colores ni specs técnicas aquí.
- "variante": Color + tipo de conexión + specs clave. Ej: "Black Wireless", "Pink Wired", "White 2.4G Bluetooth". Los colores SIEMPRE van aquí, NUNCA en modelo.
- "cat": UNA de estas categorías exactas: TECLADO, MOUSE, HEADSET, AURICULAR, CONTROLLER, MOUSEPAD, SWITCH, CAMARA, CUIDADO_PERSONAL, NUMPAD, ACCESORIO.
- "fob": Precio en USD como número decimal. SOLO el número, sin símbolo $.

EJEMPLOS CORRECTOS:
Texto: "Redragon M652 RGB Gaming Mouse Black Wired $12.50"
→ {"marca": "Redragon", "modelo": "M652 RGB", "variante": "Black Wired", "cat": "MOUSE", "fob": 12.50}

Texto: "Logitech G502 HERO High Performance Gaming Mouse $39.99"
→ {"marca": "Logitech", "modelo": "G502 HERO", "variante": "", "cat": "MOUSE", "fob": 39.99}

Texto: "AK820 Pro 75% Mechanical Keyboard Pink Wireless Bluetooth $45.00"
→ {"marca": "OTRO", "modelo": "AK820 Pro 75%", "variante": "Pink Wireless Bluetooth", "cat": "TECLADO", "fob": 45.00}

Texto: "KZ ZSN Pro X Earphone Silver $8.90"
→ {"marca": "KZ", "modelo": "ZSN Pro X", "variante": "Silver", "cat": "AURICULAR", "fob": 8.90}

ERRORES COMUNES A EVITAR:
- NO pongas el color en "modelo" (ej: modelo="M652 Black" es INCORRECTO → modelo="M652", variante="Black")
- NO pongas la marca en "modelo" (ej: modelo="Redragon M652" es INCORRECTO → marca="Redragon", modelo="M652")
- NO pongas descripciones largas en "modelo" (máximo 4-5 palabras)
- NO pongas el precio en "modelo" ni en "variante"

Marcas conocidas: ${['REDRAGON', 'LOGITECH', 'RAZER', 'HYPERX', 'CORSAIR', 'AULA', 'AJAZZ', 'MACHENIKE', '8BITDO', 'ATTACK SHARK', 'VGN', 'VXE', 'FLYDIGI', 'DARMOSHARK', 'LAMZU', 'WLMOUSE', 'KEYCHRON', ...customBrands].join(', ')}.

Texto de la celda: "${cellText}"`;

    return this.queryStructuredJson(prompt);
  }
};

if (typeof window !== 'undefined') window.LocalLlm = LocalLlm;
if (typeof module !== 'undefined') module.exports = LocalLlm;
