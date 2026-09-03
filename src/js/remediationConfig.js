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
      return structuredClone(base || {});
    }
    const out = structuredClone(base || {});
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
};

if (typeof window !== "undefined") window.RemediationConfig = RemediationConfig;
if (typeof module !== "undefined") module.exports = RemediationConfig;
