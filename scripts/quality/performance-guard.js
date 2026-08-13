#!/usr/bin/env node
/**
 * performance-guard.js — Slice 4 (performance-quality-guard).
 *
 * Measurement-only regression guard for the remediation loop:
 *   1. export-time guard   — full-corpus re-export must stay within baseline
 *   2. gate-cost guard     — delta-only re-verification (no full-corpus re-verify per pass)
 *   3. test/lint gate      — npm test 0 failures + lint 0 errors before results accepted
 *   4. FASE 2 no-regression — recall >= 85%, FP <= 8%, extraction >= 46/65 closed baseline
 *
 * Usage:
 *   node scripts/quality/performance-guard.js --export-time MINUTES [--gate-cost N]
 *       [--test-ok true] [--lint-ok true] [--recall PCT] [--fp-rate PCT] [--extraction N65] [--json]
 * Exit 0 when every guard passes; 1 with the failing guards reported.
 */
const path = require('path');

const EXPORT_BASELINE_MIN = 8; // 8-10 min full-corpus export
const EXPORT_ALARM_MIN = 12; // > 12 min or > 1.25x previous → alarm
const GATE_COST_ALARM = 1; // > 1 full-corpus re-verify per pass → alarm

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--export-time') out.exportTime = parseFloat(argv[++i]);
    else if (a === '--gate-cost') out.gateCost = parseInt(argv[++i], 10);
    else if (a === '--test-ok') out.testOk = argv[++i] === 'true';
    else if (a === '--lint-ok') out.lintOk = argv[++i] === 'true';
    else if (a === '--recall') out.recall = parseFloat(argv[++i]);
    else if (a === '--fp-rate') out.fpRate = parseFloat(argv[++i]);
    else if (a === '--extraction') out.extraction = parseInt(argv[++i], 10);
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`performance-guard.js — guard de regresión (solo medición)

Uso:
  node scripts/quality/performance-guard.js --export-time MIN [--gate-cost N]
      [--test-ok true] [--lint-ok true] [--recall PCT] [--fp-rate PCT] [--extraction N]
Exit 0 = todas las gates pasan; 1 = alguna alarma.`);
    return;
  }
  const failures = [];

  // 1. Export-time guard
  if (typeof args.exportTime === 'number') {
    if (args.exportTime > EXPORT_ALARM_MIN) {
      failures.push(
        `export-time ${args.exportTime}min > alarma ${EXPORT_ALARM_MIN}min`,
      );
    }
  }

  // 2. Gate-cost guard
  if (typeof args.gateCost === 'number') {
    if (args.gateCost > GATE_COST_ALARM) {
      failures.push(
        `gate-cost ${args.gateCost} full-corpus re-verifies > alarm ${GATE_COST_ALARM}`,
      );
    }
  }

  // 3. Test/lint gate
  if (typeof args.testOk === 'boolean' && !args.testOk) {
    failures.push('tests fallan (npm test != 0 failures)');
  }
  if (typeof args.lintOk === 'boolean' && !args.lintOk) {
    failures.push('lint con errores (npm run lint != 0 errors)');
  }

  // 4. FASE 2 no-regression
  if (typeof args.recall === 'number' && args.recall < 85) {
    failures.push(`recall ${args.recall}% < 85%`);
  }
  if (typeof args.fpRate === 'number' && args.fpRate > 8) {
    failures.push(`FP rate ${args.fpRate}% > 8%`);
  }
  if (typeof args.extraction === 'number' && args.extraction < 46) {
    failures.push(`extraction ${args.extraction}/65 < 46 closed baseline`);
  }

  const report = {
    exportTime: args.exportTime,
    gateCost: args.gateCost,
    testOk: args.testOk,
    lintOk: args.lintOk,
    recall: args.recall,
    fpRate: args.fpRate,
    extraction: args.extraction,
    passed: failures.length === 0,
    failures,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const f of failures) console.log(`  ⚠️  ${f}`);
    console.log(
      report.passed
        ? 'PERFORMANCE GUARD OK: sin regresión'
        : 'PERFORMANCE GUARD FAIL',
    );
  }
  process.exit(report.passed ? 0 : 1);
}

if (require.main === module) {
  main();
}
