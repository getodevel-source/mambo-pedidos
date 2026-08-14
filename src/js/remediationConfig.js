/**
 * RemediationConfig — config gating for the catalog remediation loop (Slice 2,
 * catalog-remediation-loop).
 *
 * DEFAULT_REMEDIATION_CONFIG: every strategy and calibration rule is config-
 * gated. Flipping a strategy off, or `enabled:false`, restores the prior
 * (measure-only) behavior with no code revert.
 *
 *   enabled:false            → diagnose + measure only (quality-iterate behavior)
 *   strategies.<name>:false  → that strategy never runs
 *
 * The orchestrator deep-merges an optional repo-root `remediation-config.json`
 * over the defaults; no app storage, no migration surface. Browser-global +
 * CommonJS (same convention as the other modules).
 */

const DEFAULT_REMEDIATION_CONFIG = {
  enabled: true,
  strategies: {
    // 9 remediation strategies (Slice 2)
    colorFromImage: true,
    varianteColorAdoption: true,
    literalPriceRegrounding: true,
    literalAnchorSearch: true,
    truncationRepair: true,
    switchToVariante: true,
    rowContextDisambiguation: true,
    codeAdoption: true,
    sharedImageReassign: true,
    aspectProductCalibration: true,
    // config-gated calibration rules (Slice 1) — flipping off restores
    // pre-calibration gate behavior
    nounPhraseCalibration: true,
    colorAmbiguityResolution: true,
    outlierLiteralCalibration: true,
    reasonInstrumentation: true,
  },
};

const RemediationConfig = {
  DEFAULT_REMEDIATION_CONFIG,

  /**
   * Deep-merge `overrides` over `base` (recursive on plain objects, shallow on
   * arrays). Returns a NEW config; never mutates its inputs.
   * @param {Object} base
   * @param {Object} overrides
   * @returns {Object}
   */
  deepMerge(base, overrides) {
    if (!overrides || typeof overrides !== "object") {
      return JSON.parse(JSON.stringify(base || {}));
    }
    const out = JSON.parse(JSON.stringify(base || {}));
    for (const key of Object.keys(overrides)) {
      const ov = overrides[key];
      if (
        ov &&
        typeof ov === "object" &&
        !Array.isArray(ov) &&
        out[key] &&
        typeof out[key] === "object" &&
        !Array.isArray(out[key])
      ) {
        out[key] = this.deepMerge(out[key], ov);
      } else {
        out[key] = ov;
      }
    }
    return out;
  },

  /**
   * Loads the effective remediation config: DEFAULT_REMEDIATION_CONFIG
   * deep-merged with an optional repo-root `remediation-config.json` (when the
   * file exists and is valid JSON). Node-only file read; returns the defaults
   * untouched when no file / no fs / no working directory (browser).
   * @returns {Object} effective config
   */
  loadRemediationConfig() {
    try {
      if (typeof process === "undefined" || typeof require !== "function") {
        return this.deepMerge(this.DEFAULT_REMEDIATION_CONFIG, null);
      }
      // Guarded line: the browser-runtime check requires `typeof process` on
      // the same line as any process access (WebView2 has no process).
      const cwd = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '.';
      const fs = require("fs");
      const path = require("path");
      const file = path.join(cwd, "remediation-config.json");
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        return this.deepMerge(this.DEFAULT_REMEDIATION_CONFIG, parsed);
      }
    } catch (_e) {
      // File missing/corrupt → defaults (fail open to the safe baseline).
    }
    return this.deepMerge(this.DEFAULT_REMEDIATION_CONFIG, null);
  },
};

if (typeof window !== "undefined") window.RemediationConfig = RemediationConfig;
if (typeof module !== "undefined") module.exports = RemediationConfig;
