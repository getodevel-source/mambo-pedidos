/**
 * ImageTextGates — post-extraction image↔text verification gates (Slice 1).
 *
 * Adds the visual checks the matcher cannot perform reliably:
 *   1. Interior-color verification: the dominant color is sampled over the
 *      CENTER-60% crop (page background excluded) and compared against the
 *      declared color word (color/variante/modelo × COLOR_KEEP vocabulary).
 *      Contradicting pairs degrade GREEN → YELLOW with evidence. Low-occupancy
 *      (multi-color) interiors are WATCH-only (no status change).
 *   2. Category-aspect degradation: a compact product (MOUSE/HEADSET/
 *      AURICULAR/CONTROLLER/SWITCH) carrying a wide photo (aspect > 1.9) is
 *      YELLOW; a wide product (TECLADO/MOUSEPAD) carrying a narrow photo
 *      (aspect < 0.65) is YELLOW. The gate is post-matching, so the matcher's
 *      relaxed backfill acceptance cannot clear it.
 *
 * Pure RGBA core (sampleInteriorColor) carries the unit tests; the decode
 * adapter (interiorColorFor) bridges browser canvas / Node node-canvas.
 * Browser-global + CommonJS compatible (same convention as the other modules).
 */

// Vocabulary derived from CatalogValidator.COLOR_AUDIT_RE plus the
// switch-adjacent colors the spec adds (transparent, smoke, mint, navy, beige).
const COLOR_KEEP_WORDS = [
  "black",
  "white",
  "pink",
  "blue",
  "red",
  "green",
  "purple",
  "grey",
  "gray",
  "silver",
  "gold",
  "orange",
  "brown",
  "cyan",
  "magenta",
  "yellow",
  "coffee",
  "periwinkle",
  "lavender",
  "cream",
  "obsidian",
  "sakura",
  "phantom",
  "gunmetal",
  "blackberry",
  "neon",
  "arctic",
  "translucent",
  "matte",
  "glossy",
  "negro",
  "blanco",
  "rosa",
  "azul",
  "rojo",
  "verde",
  "violeta",
  "gris",
  "plateado",
  "dorado",
  "naranja",
  "marron",
  "amarillo",
  "transparent",
  "smoke",
  "mint",
  "navy",
  "beige",
];
const COLOR_KEEP_RE = new RegExp(
  "\\b(" + COLOR_KEEP_WORDS.join("|") + ")\\b",
  "i",
);

// Declared word → classifier family (classifyColorName vocabulary). Finishes
// (matte/glossy/neon/...) map to no family and skip the color check.
const COLOR_FAMILY = {
  black: "BLACK",
  negro: "BLACK",
  obsidian: "BLACK",
  blackberry: "BLACK",
  gunmetal: "BLACK",
  phantom: "BLACK",
  white: "WHITE",
  blanco: "WHITE",
  cream: "WHITE",
  transparent: "WHITE",
  translucent: "WHITE",
  grey: "GRAY",
  gray: "GRAY",
  gris: "GRAY",
  silver: "SILVER",
  plateado: "SILVER",
  smoke: "SILVER",
  blue: "BLUE",
  azul: "BLUE",
  navy: "BLUE",
  periwinkle: "BLUE",
  cyan: "CYAN",
  mint: "CYAN",
  purple: "PURPLE",
  violet: "PURPLE",
  violeta: "PURPLE",
  lavender: "PURPLE",
  pink: "PINK",
  rosa: "PINK",
  sakura: "PINK",
  magenta: "PINK",
  red: "RED",
  rojo: "RED",
  green: "GREEN",
  verde: "GREEN",
  gold: "GOLD",
  dorado: "GOLD",
  orange: "ORANGE",
  naranja: "ORANGE",
  brown: "ORANGE",
  marron: "ORANGE",
  coffee: "ORANGE",
  yellow: "YELLOW",
  amarillo: "YELLOW",
};

// Compatibility groups (spec): GRAY↔SILVER↔WHITE, PURPLE↔BLUE↔PINK,
// CYAN↔BLUE↔GREEN, GOLD↔ORANGE. Exact match is always compatible.
const COLOR_COMPATIBLE = {
  GRAY: ["GRAY", "SILVER", "WHITE"],
  SILVER: ["GRAY", "SILVER", "WHITE"],
  WHITE: ["GRAY", "SILVER", "WHITE"],
  PURPLE: ["PURPLE", "BLUE", "PINK"],
  BLUE: ["PURPLE", "BLUE", "PINK"],
  PINK: ["PURPLE", "BLUE", "PINK"],
  CYAN: ["CYAN", "BLUE", "GREEN"],
  GREEN: ["CYAN", "BLUE", "GREEN"],
  GOLD: ["GOLD", "ORANGE"],
  ORANGE: ["GOLD", "ORANGE"],
};

const COMPACT_CATS = ["MOUSE", "HEADSET", "AURICULAR", "CONTROLLER", "SWITCH"];
const WIDE_CATS = ["TECLADO", "MOUSEPAD"];

const ImageTextGates = {
  COLOR_KEEP_WORDS,
  COLOR_KEEP_RE,
  COLOR_FAMILY,
  COLOR_COMPATIBLE,
  COMPACT_CATS,
  WIDE_CATS,

  /**
   * Classifies an RGB pixel into a broad color name (mirrors
   * PdfParser.classifyColorName semantics so both layers agree).
   */
  classifyColorName(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max > 0 ? (max - min) / max : 0;
    const brightness = max / 255;

    if (brightness < 0.22) return "BLACK";
    if (saturation < 0.12 && brightness > 0.85) return "WHITE";
    if (saturation < 0.12) return brightness > 0.55 ? "SILVER" : "GRAY";

    if (r > g + 40 && r > b + 40) {
      if (g > 100 && b < 80) return "GOLD";
      if (g < 80) return "RED";
      return "ORANGE";
    }
    if (g > r + 25 && g > b + 25) return "GREEN";
    if (b > r + 30 && b > g + 15) {
      if (r > 80 && g < 100) return "PURPLE";
      if (g > 150) return "CYAN";
      return "BLUE";
    }
    if (r > 140 && g < 130 && b > 120) return "PINK";
    if (r > 120 && g > 100 && b < 80) return "GOLD";

    return "MULTICOLOR";
  },

  /**
   * Pure RGBA core: dominant color of the PRODUCT inside the CENTER-60% crop,
   * with the photo's own background excluded. The center crop removes the page
   * margins, but catalog photos still carry their own background (white or a
   * gradient) that can dominate the interior when the product does not fill the
   * frame — measured at 91% false positives on the full corpus when the
   * background is counted. The background is estimated from the crop's corner
   * band, then pixels close to it are excluded; the dominant color is computed
   * over the remaining (product) pixels only.
   *
   * When the product does not fill enough of the frame (< 35% non-background
   * pixels) the result is WATCH-ambiguous ({ name:"UNKNOWN", confidence:<35 })
   * so the caller does NOT degrade status on an unreadable photo.
   *
   * @param {Uint8ClampedArray} pixels - RGBA pixel buffer
   * @param {number} width
   * @param {number} height
   * @param {number} ratio - center crop side ratio (0.6 = central 60%)
   * @returns {{name:string, confidence:number, occupancy:number}}
   */
  sampleInteriorColor(pixels, width, height, ratio = 0.6) {
    try {
      if (!pixels || !width || !height || pixels.length < width * height * 4) {
        return { name: "UNKNOWN", confidence: 0, occupancy: 0, topColors: [] };
      }
      const x0 = Math.floor((width * (1 - ratio)) / 2);
      const y0 = Math.floor((height * (1 - ratio)) / 2);
      const x1 = width - x0;
      const y1 = height - y0;

      // 1. Background estimate = average RGB of the crop's corner band
      //    (2% inset from each side of the interior crop). Photos on white or
      //    gradient backgrounds are dominated by this color in the corners.
      const insetX = Math.max(2, Math.floor((x1 - x0) * 0.02));
      const insetY = Math.max(2, Math.floor((y1 - y0) * 0.02));
      const cornerPts = [
        [y0 + insetY, x0 + insetX],
        [y0 + insetY, x1 - insetX - 1],
        [y1 - insetY - 1, x0 + insetX],
        [y1 - insetY - 1, x1 - insetX - 1],
      ];
      let br = 0,
        bg = 0,
        bb = 0,
        cn = 0;
      for (const [cy, cx] of cornerPts) {
        const i = (cy * width + cx) * 4;
        if (pixels[i + 3] < 30) continue;
        br += pixels[i];
        bg += pixels[i + 1];
        bb += pixels[i + 2];
        cn++;
      }
      if (cn === 0)
        return { name: "UNKNOWN", confidence: 0, occupancy: 0, topColors: [] };
      br = br / cn;
      bg = bg / cn;
      bb = bb / cn;

      // 2. Count product pixels (far from background) and bucket their colors.
      const BG_TOLERANCE = 64; // max RGB distance to be treated as background
      const buckets = {};
      let total = 0;
      let content = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          if (pixels[i + 3] < 30) continue;
          total++;
          const dr = pixels[i] - br;
          const dg = pixels[i + 1] - bg;
          const db = pixels[i + 2] - bb;
          const dist = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
          if (dist < BG_TOLERANCE) continue; // background pixel
          content++;
          const name = this.classifyColorName(
            pixels[i],
            pixels[i + 1],
            pixels[i + 2],
          );
          buckets[name] = (buckets[name] || 0) + 1;
        }
      }
      // 3. If the product does not fill the frame, the photo is unreadable
      //    for color verification — WATCH, do not degrade.
      const occupancy = total > 0 ? Math.round((content / total) * 100) : 0;
      if (content < 5 || occupancy < 35) {
        return {
          name: "UNKNOWN",
          confidence: occupancy,
          occupancy,
          topColors: [],
        };
      }
      let bestName = null;
      let bestCount = -1;
      for (const [name, count] of Object.entries(buckets)) {
        if (count > bestCount) {
          bestName = name;
          bestCount = count;
        }
      }
      const confidence = Math.round((bestCount / content) * 100);
      // Slice 1 (gate-calibration): topColors aditivo — top 3 buckets reales
      // (sin MULTICOLOR/UNKNOWN) para la resolución de ambigüedad de color.
      const topColors = Object.entries(buckets)
        .filter(([name]) => name !== "MULTICOLOR" && name !== "UNKNOWN")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({
          name,
          pct: Math.round((count / content) * 100),
        }));
      return { name: bestName, confidence, occupancy, topColors };
    } catch {
      return { name: "UNKNOWN", confidence: 0, occupancy: 0, topColors: [] };
    }
  },


  /**
   * Finds ALL declared color words on the product (color → variante → modelo).
   * Multi-color variants ("Purple White Blue RGB") declare several colors but
   * the catalog photo shows ONE — the check must not degrade those (structural
   * false positive). Returns an array of {word, color} matches.
   * @returns {Array<{word:string, color:string}>}
   */
  declaredColorsOf(product) {
    const found = [];
    const fields = [
      product && product.color,
      product && product.variante,
      product && product.modelo,
    ];
    const seen = new Set();
    for (const field of fields) {
      if (typeof field !== "string" || !field.trim()) continue;
      const re = new RegExp(COLOR_KEEP_RE.source, "gi");
      let m;
      while ((m = re.exec(field)) !== null) {
        const key = m[0].toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ word: m[0], color: m[0] });
        }
      }
    }
    return found;
  },

  /**
   * True when the declared family and the actual classifier name are compatible
   * (exact match or same compatibility group).
   */
  colorCompatibility(declared, actual) {
    const d = String(declared || "").toUpperCase();
    const a = String(actual || "").toUpperCase();
    if (d === a) return true;
    const group = COLOR_COMPATIBLE[d];
    return Array.isArray(group) && group.includes(a);
  },

  /**
   * Calibración de ambigüedad de color (Slice 1, gate-calibration): TODAS las
   * familias declaradas (variante/color/modelo) deben ser compatibles con
   * ALGUNO de los top colors reales de la foto → el multi-color es un DISEÑO
   * INTENCIONAL del producto (ej. variante 'Pink/White' con foto PINK+WHITE),
   * no una incertidumbre. Familias contradictorias → false (WATCH se mantiene).
   * @param {string[]} declaredFamilies - familias declaradas (COLOR_FAMILY)
   * @param {{topColors?:Array<{name:string,pct:number}>}} interior - muestreo
   * @returns {boolean}
   */
  colorAmbiguityResolved(declaredFamilies, interior) {
    const families = (
      Array.isArray(declaredFamilies) ? declaredFamilies : []
    ).filter(Boolean);
    const tops = (
      interior && Array.isArray(interior.topColors) ? interior.topColors : []
    )
      .map((t) => t && t.name)
      .filter(Boolean);
    if (!families.length || !tops.length) return false;
    return families.every((fam) =>
      tops.some((top) => this.colorCompatibility(fam, top)),
    );
  },

  /**
   * Category-aspect policy: compact cats reject wide photos, wide cats reject
   * narrow photos. Returns { violation, expectedFamily }.
   */
  categoryAspectViolation(cat, aspect) {
    const c = String(cat || "").toUpperCase();
    const a = Number(aspect);
    if (!Number.isFinite(a)) return { violation: false, expectedFamily: null };
    if (COMPACT_CATS.includes(c) && a > 1.9)
      return { violation: true, expectedFamily: "COMPACT" };
    if (WIDE_CATS.includes(c) && a < 0.65)
      return { violation: true, expectedFamily: "WIDE" };
    return { violation: false, expectedFamily: null };
  },

  /**
   * Runs the image-text gates over a copy of the products. Only degrades
   * (GREEN→YELLOW); never promotes. Attaches `_imgTextWarnings` (evidence) and
   * appends human-readable warnings for the pv-reason path.
   * @returns {{products:Array, changes:Array}}
   */
  runAll(products) {
    const result = (products || []).map((p) => ({
      ...p,
      warnings: Array.isArray(p.warnings) ? [...p.warnings] : [],
      _imgTextWarnings: Array.isArray(p._imgTextWarnings)
        ? [...p._imgTextWarnings]
        : [],
    }));

    for (const p of result) {
      // 1. Interior color vs declared color (background excluded)
      const interior =
        p._interiorColor ||
        (p.imageEvidence && p.imageEvidence.interiorColor) ||
        null;
      if (interior && interior.name) {
        const declaredColors = this.declaredColorsOf(p);
        const families = [
          ...new Set(
            declaredColors
              .map((d) => COLOR_FAMILY[d.word.toLowerCase()])
              .filter(Boolean),
          ),
        ];
        const unreadable =
          interior.name === "UNKNOWN" ||
          interior.confidence < 65 ||
          interior.name === "MULTICOLOR";
        // Slice 1 (gate-calibration, config-gated colorAmbiguityResolution):
        // familias multi-color declaradas que casan con los top colors de la
        // foto → diseño intencional, el warning ambiguo se SUPRIME (benigno);
        // familias contradictorias o foto ilegible → WATCH se mantiene.
        const resolved =
          IMAGE_TEXT_CALIBRATION.colorAmbiguityResolution &&
          families.length > 1 &&
          this.colorAmbiguityResolved(families, interior);
        const watchAmbiguous =
          !families.length ||
          (!resolved && (unreadable || families.length > 1));
        if (watchAmbiguous) {
          // WATCH only — no status change (no declared color, multi-color
          // variant like "Purple White Blue RGB" where the photo shows ONE
          // color, low single-color occupancy, or product too small to read).
          const warn = `Color de imagen ambiguo (multi-color, ocupación ${interior.confidence}%)`;
          p._imgTextWarnings.push({
            type: "color-ambiguous",
            ambiguous: true,
            occupancy: interior.confidence,
            declaredColors: families,
          });
          if (!p.warnings.includes(warn)) p.warnings.push(warn);
        } else if (resolved) {
          // Diseño multi-color intencional verificado contra los top colors
          // de la foto → evidencia etiquetada, sin warning, sin cambio de
          // status (benigno).
          p._colorAmbiguityResolved = {
            declaredColors: families,
            topColors: interior.topColors || [],
          };
        } else if (!this.colorCompatibility(families[0], interior.name)) {
          const declared = declaredColors.find(
            (d) => COLOR_FAMILY[d.word.toLowerCase()] === families[0],
          );
          const warn = `Color de imagen (${interior.name}) no coincide con el producto (${declared.word})`;
          p._imgTextWarnings.push({
            type: "color-mismatch",
            declared: families[0],
            actual: interior.name,
            sampleRegion: "center-60%",
            occupancy: interior.confidence,
            reason: warn,
          });
          if (!p.warnings.includes(warn)) p.warnings.push(warn);
          if (p.status === "GREEN") p.status = "YELLOW";
        }
      }

      // 2. Category-aspect (post-matching gate — relaxed backfill cannot clear it)
      // El aspect llega como _imgAspect (shape interno del parser/browser) o como
      // imgAspect (shape público del export); aceptamos ambos para que el gate
      // degrade igual en el pipeline de import y en el export batch.
      const aspectNum =
        typeof p._imgAspect === "number"
          ? p._imgAspect
          : typeof p.imgAspect === "number"
            ? p.imgAspect
            : null;
      if (aspectNum !== null && Number.isFinite(aspectNum)) {
        const aspect = Math.round(aspectNum * 100) / 100;
        const vio = this.categoryAspectViolation(p.cat, aspect);
        // Aspect-product-calibration (Slice 3 loop-orchestration): a real
        // catalog photo of a product with real identity + confirmed row has a
        // NATURAL aspect (mouses/controllers are elongated, 60% keyboards are
        // vertical). The calibration evidence from remediation.js is respected
        // here so the re-verify does not re-degrade the same product.
        const calibrated =
          p._aspectCalibrated &&
          p._aspectCalibrated.aspect === aspect &&
          String(p._aspectCalibrated.cat || "") ===
            String(p.cat || "").toUpperCase();
        if (vio.violation && calibrated) {
          // calibrated: no degradation — natural product shape
        } else if (vio.violation) {
          const warn = `Imagen ${aspect > 1.9 ? "ancha" : "angosta"} (ratio ${aspect.toFixed(2)}) incompatible con ${(p.cat || "").toUpperCase()}`;
          p._imgTextWarnings.push({
            type: "category-aspect",
            cat: (p.cat || "").toUpperCase(),
            aspect,
            expectedFamily: vio.expectedFamily,
            reason: warn,
          });
          if (!p.warnings.includes(warn)) p.warnings.push(warn);
          if (p.status === "GREEN") p.status = "YELLOW";
        }
      }
    }

    const changes = [];
    for (const p of result) {
      if (p._imgTextWarnings.length) {
        changes.push({
          sku: p.sku,
          type: "image-text",
          detail: p._imgTextWarnings[0].type,
        });
      }
    }
    return { products: result, changes };
  },
};

if (typeof window !== "undefined") window.ImageTextGates = ImageTextGates;
if (typeof module !== "undefined") module.exports = ImageTextGates;

// Slice 1 (gate-calibration): flag de calibración de ambigüedad de color
// (default ON; Slice 2 lo consolida en remediationConfig.js). Apagarlo
// restaura el comportamiento pre-calibración (todo multi-color no declarado
// o ilegible queda WATCH con warning).
const IMAGE_TEXT_CALIBRATION = { colorAmbiguityResolution: true };
