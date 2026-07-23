// ============================================
//  Mambo Pedidos - Transformers.js Local AI Engine
//  Zero-Shot Classification via Xenova/transformers CDN
//  Downloads model on first use, caches locally (IndexedDB).
//  No API keys. No server. 100% offline after first download.
//  Desarrollado por @geto_dev
// ============================================

const TransformersAI = {
  _pipeline: null,
  _isLoading: false,
  _loadError: null,
  _downloadProgress: 0,

  // Category labels for zero-shot classification
  LABELS: ['keyboard', 'numeric keypad', 'mouse', 'headset', 'earphones', 'controller', 'mousepad', 'switches', 'camera', 'personal care', 'other'],
  LABEL_MAP: {
    'keyboard': 'TECLADO',
    'numeric keypad': 'NUMPAD',
    'mouse': 'MOUSE',
    'headset': 'HEADSET',
    'earphones': 'AURICULAR',
    'controller': 'CONTROLLER',
    'mousepad': 'MOUSEPAD',
    'switches': 'SWITCH',
    'camera': 'CAMARA',
    'personal care': 'CUIDADO_PERSONAL',
    'other': 'OTRO'
  },

  /**
   * Returns true if the Transformers pipeline is ready to use.
   */
  isReady() {
    return this._pipeline !== null;
  },

  /**
   * Returns current download progress (0-100).
   */
  getDownloadProgress() {
    return this._downloadProgress;
  },

  /**
   * Initialize the Transformers.js pipeline.
   * Uses Xenova/distilbert-base-uncased-mnli for zero-shot classification.
   * Model is ~67MB, cached in browser IndexedDB after first download.
   * @param {Function} onProgress - Called with (progress 0-100, statusText) during download
   */
  async init(onProgress = null) {
    if (this._pipeline) return true;
    if (this._isLoading) return false;
    if (this._loadError) return false;

    this._isLoading = true;
    this._downloadProgress = 0;

    try {
      // Check if transformers pipeline is available (loaded via CDN script tag)
      if (typeof window === 'undefined' || !window.__transformersPipeline) {
        // Try to dynamically import from CDN
        await this._loadTransformersScript();
      }

      if (!window.__transformersPipeline) {
        throw new Error('Transformers.js no disponible');
      }

      const progressCallback = (progressInfo) => {
        if (progressInfo && progressInfo.progress !== undefined) {
          this._downloadProgress = Math.round(progressInfo.progress);
        } else if (progressInfo && progressInfo.status === 'downloading') {
          this._downloadProgress = Math.round((progressInfo.loaded / progressInfo.total) * 100) || 0;
        } else if (progressInfo && progressInfo.status === 'ready') {
          this._downloadProgress = 100;
        }
        const statusText = progressInfo?.status === 'downloading'
          ? `Descargando modelo IA... ${this._downloadProgress}%`
          : progressInfo?.status === 'loading'
          ? 'Cargando modelo en memoria...'
          : progressInfo?.status === 'ready'
          ? '¡Modelo IA listo!'
          : 'Inicializando motor IA...';
        if (typeof onProgress === 'function') {
          onProgress(this._downloadProgress, statusText);
        }
      };

      this._pipeline = await window.__transformersPipeline(
        'zero-shot-classification',
        'Xenova/distilbert-base-uncased-mnli',
        { progress_callback: progressCallback }
      );

      this._downloadProgress = 100;
      this._isLoading = false;
      console.log('✅ Transformers.js pipeline ready: Xenova/distilbert-base-uncased-mnli');
      return true;
    } catch (e) {
      console.warn('Transformers.js init failed, falling back to semantic NLP:', e);
      this._loadError = e;
      this._isLoading = false;
      return false;
    }
  },

  /**
   * Dynamically loads Transformers.js from CDN if not already present.
   */
  async _loadTransformersScript() {
    return new Promise((resolve) => {
      if (document.getElementById('transformers-cdn')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'transformers-cdn';
      script.type = 'module';
      // Use jsdelivr CDN for the UMD build
      script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
      script.onload = () => {
        // The UMD build exposes window.transformers
        if (window.transformers && window.transformers.pipeline) {
          window.__transformersPipeline = window.transformers.pipeline;
        }
        resolve();
      };
      script.onerror = () => resolve(); // Silent fail, will use NLP fallback
      document.head.appendChild(script);
      // Timeout after 10s
      setTimeout(() => resolve(), 10000);
    });
  },

  /**
   * Classify a product text into a category using Transformers.js zero-shot classification.
   * Returns null if not ready (caller should use NLP fallback).
   * @param {string} text - Raw product text
   * @returns {Promise<{cat: string, score: number} | null>}
   */
  async classify(text) {
    if (!this._pipeline) return null;
    if (!text || text.trim().length < 3) return null;

    try {
      const result = await this._pipeline(text, this.LABELS, {
        multi_label: false
      });

      if (result && result.labels && result.labels.length > 0) {
        const topLabel = result.labels[0];
        const topScore = result.scores[0];
        const cat = this.LABEL_MAP[topLabel] || 'OTRO';
        return { cat, score: topScore, rawLabel: topLabel };
      }
    } catch (e) {
      console.warn('TransformersAI classify error:', e);
    }
    return null;
  },

  /**
   * Get current status for display
   */
  getStatus() {
    if (this._pipeline) return { ready: true, label: '🟢 Transformers.js (Xenova/distilbert)', downloading: false, progress: 100 };
    if (this._isLoading) return { ready: false, label: `⏳ Descargando modelo IA... ${this._downloadProgress}%`, downloading: true, progress: this._downloadProgress };
    if (this._loadError) return { ready: false, label: '🔵 Motor Semántico Local (NLP)', downloading: false, progress: 0 };
    return { ready: false, label: '🔵 Motor Semántico Local (NLP)', downloading: false, progress: 0 };
  }
};

window.TransformersAI = TransformersAI;
