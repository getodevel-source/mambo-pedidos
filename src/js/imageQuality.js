// ============================================
//  Mambo Pedidos - Detección de calidad de imagen
//  Primitivas puras para la auditoría/import de fotos (photo-quality).
// ============================================

const ImageQuality = {
  /**
   * Detecta crops que agarraron el borde de la página: imagen casi uniforme
   * (fondo) con poca fracción de contenido real. Un crop marginal es el que
   * "sale" pero no muestra el producto (ej: franja oscura sobre blanco).
   * @param {{width:number,height:number,data:Uint8ClampedArray}} imgData - RGBA
   * @param {Object} [opts] - {background:[r,g,b], contentThreshold, diffThreshold}
   * @returns {boolean} true si el crop es marginal (no sirve)
   */
  isMarginalCrop(imgData, opts = {}) {
    if (!imgData || !imgData.data || !imgData.width || !imgData.height) return true;
    const { width, height, data } = imgData;
    if (width < 4 || height < 4) return true;

    const contentThreshold = opts.contentThreshold || 0.12;
    const diffThreshold = opts.diffThreshold || 48;

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
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (Math.abs(data[o] - br) + Math.abs(data[o + 1] - bg) + Math.abs(data[o + 2] - bb) > diffThreshold) content++;
    }
    return (content / n) < contentThreshold;
  }
};

if (typeof module !== 'undefined') module.exports = ImageQuality;
if (typeof window !== 'undefined') window.ImageQuality = ImageQuality;