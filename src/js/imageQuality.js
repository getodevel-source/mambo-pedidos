// ============================================
//  Mambo Pedidos - Detección de calidad de imagen
//  Primitivas puras para la auditoría/import de fotos (photo-quality).
// ============================================

const ImageQuality = {
  // Ítem 3 ronda 2: umbrales configurables por categoría con los defaults
  // auditados. Vacío = mismo comportamiento de siempre; la calibración se
  // hace vía configureThresholds() + getDecisionLog() (ver abajo).
  DEFAULTS: { contentThreshold: 0.12, diffThreshold: 48 },
  byCategory: {},

  // Fija umbrales para una categoría (ej: TECLADO con fotos oscuras buenas).
  // opts: {contentThreshold?, diffThreshold?}. Valores fuera de rango se
  // ignoran (fail-safe a defaults).
  configureThresholds(category, opts = {}) {
    const cat = String(category || '').trim().toUpperCase();
    if (!cat) return;
    const cur = this.byCategory[cat] || {};
    const ct = Number(opts.contentThreshold);
    const dt = Number(opts.diffThreshold);
    if (Number.isFinite(ct) && ct > 0 && ct < 1) cur.contentThreshold = ct;
    if (Number.isFinite(dt) && dt >= 8 && dt <= 200) cur.diffThreshold = dt;
    this.byCategory[cat] = cur;
  },

  resetThresholds(category) {
    if (category) delete this.byCategory[String(category).trim().toUpperCase()];
    else this.byCategory = {};
  },

  thresholdsFor(category) {
    const cat = String(category || '').trim().toUpperCase();
    return Object.assign({}, this.DEFAULTS, this.byCategory[cat] || {});
  },

  // Anillo de decisiones para calibrar FP/FN sin adivinar: cada descarte o
  // segunda oportunidad deja {contentRatio, threshold, bgBrightness, ...}.
  _decisions: [],
  MAX_DECISIONS: 200,

  _logDecision(entry) {
    this._decisions.push(Object.assign({ at: new Date().toISOString() }, entry));
    if (this._decisions.length > this.MAX_DECISIONS) this._decisions.shift();
  },

  getDecisionLog() { return this._decisions.slice(); },
  clearDecisionLog() { this._decisions = []; },

  /**
   * Detecta crops que agarraron el borde de la página: imagen casi uniforme
   * (fondo) con poca fracción de contenido real. Un crop marginal es el que
   * "sale" pero no muestra el producto (ej: franja oscura sobre blanco).
   * @param {{width:number,height:number,data:Uint8ClampedArray}} imgData - RGBA
   * @param {Object} [opts] - {background, contentThreshold, diffThreshold, category, log}
   * @returns {boolean} true si el crop es marginal (no sirve)
   */
  isMarginalCrop(imgData, opts = {}) {
    if (!imgData || !imgData.data || !imgData.width || !imgData.height) return true;
    const { width, height, data } = imgData;
    if (width < 4 || height < 4) return true;

    const base = this.thresholdsFor(opts.category);
    const contentThreshold = opts.contentThreshold || base.contentThreshold;
    const diffThreshold = opts.diffThreshold || base.diffThreshold;

    let br, bg, bb;
    if (opts.background) {
      [br, bg, bb] = opts.background;
    } else {
      // Fondo estimado = promedio de las 4 esquinas (foto de catálogo: blanco/negro)
      const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
      let r = 0, g = 0, b = 0;
      for (const c of corners) { r += data[c]; g += data[c + 1]; b += data[c + 2]; }
      br = r / 4; bg = g / 4; bb = b / 4;
    }

    let content = 0;
    let sumD = 0;
    let sumD2 = 0;
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const d = Math.abs(data[o] - br) + Math.abs(data[o + 1] - bg) + Math.abs(data[o + 2] - bb);
      sumD += d;
      sumD2 += d * d;
      if (d > diffThreshold) content++;
    }
    const ratio = content / n;
    if (ratio >= contentThreshold) {
      if (opts.log) this._logDecision({ category: opts.category || null, contentRatio: ratio, threshold: contentThreshold, marginal: false, reason: 'contenido-suficiente' });
      return false;
    }
    // Segunda oportunidad (fotos oscuras buenas): si el fondo estimado es
    // oscuro pero el frame tiene TEXTURA real (varianza alta: ruido de sensor,
    // gradientes, bordes del producto), no se puede afirmar "borde uniforme"
    // y NO se descarta. Una franja negra de página es casi uniforme (std
    // baja) y sigue marginal. Defaults intactos para el resto.
    const mean = sumD / n;
    const variance = Math.max(0, sumD2 / n - mean * mean);
    const std = Math.sqrt(variance);
    const bgBrightness = (br + bg + bb) / 3 / 255;
    if (bgBrightness < 0.25 && std > 30) {
      if (opts.log) this._logDecision({ category: opts.category || null, contentRatio: ratio, threshold: contentThreshold, bgBrightness, std, marginal: false, reason: 'foto-oscura-con-textura' });
      return false;
    }
    if (opts.log) this._logDecision({ category: opts.category || null, contentRatio: ratio, threshold: contentThreshold, bgBrightness, std, marginal: true, reason: 'bajo-contenido' });
    return true;
  }
};

if (typeof module !== 'undefined') module.exports = ImageQuality;
if (typeof window !== 'undefined') window.ImageQuality = ImageQuality;