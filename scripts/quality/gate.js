/**
 * Mambo Pedidos — Quality Gate module
 * 
 * Environment-gated quality checks. A missing gate MUST be reported
 * explicitly as SKIPPED_ENVIRONMENT_GATED, never treated as a pass.
 */

const QualityGate = {
  /**
   * Produce a GateOutcome for an absent environment gate.
   * @param {Object} opts - { gate: string, reason: string }
   * @returns {{ status: 'SKIPPED_ENVIRONMENT_GATED', gate: string, reason: string }}
   */
  GateOutcome(opts) {
    const gate = (opts && opts.gate) || 'unknown';
    const reason = (opts && opts.reason) || 'Environment gate not present';
    return { status: 'SKIPPED_ENVIRONMENT_GATED', gate, reason };
  },

  /**
   * Check if a named gate is present (environment variable or manifest).
   * @param {string} gateName - e.g. 'full-corpus', 'tauri-fixture'
   * @returns {boolean}
   */
  isGatePresent(gateName) {
    const envVar = 'QUALITY_GATE_' + gateName.toUpperCase().replace(/-/g, '_');
    return !!process.env[envVar];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QualityGate;
}
if (typeof window !== 'undefined') {
  window.QualityGate = QualityGate;
}