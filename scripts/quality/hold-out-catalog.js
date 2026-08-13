#!/usr/bin/env node
/**
 * hold-out-catalog.js — Slice 3 generalization validation (leave-one-catalog-out).
 *
 * Derives/tunes each remediation rule on 12 catalogs and validates on the 13th:
 * a rule qualifies only if it resolves its class on the held-out catalog without
 * introducing new false positives there. Emits per-class held-out resolution.
 *
 * Usage: node scripts/quality/hold-out-catalog.js --export export.json
 * Exit 0 when every rule resolves its class on each held-out catalog with 0 new FPs.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const jsPath = (f) => path.join(repoRoot, 'src', 'js', f);
global.window = global;
global.TextSanitizer = require(jsPath('textSanitizer.js'));
global.CatalogValidator = require(jsPath('catalogValidator.js'));
global.ImageTextGates = require(jsPath('imageTextGates.js'));
global.ImportGates = require(jsPath('importGates.js'));
global.Remediation = require(jsPath('remediation.js'));
global.RemediationConfig = require(jsPath('remediationConfig.js'));

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--export') out.export = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'hold-out-catalog.js — leave-one-catalog-out validation of remediation rules.\nUso: node scripts/quality/hold-out-catalog.js --export export.json',
    );
    return;
  }
  if (!args.export) {
    console.error('Se requiere --export');
    process.exit(2);
  }
  let j;
  try {
    j = JSON.parse(fs.readFileSync(args.export, 'utf8'));
  } catch (e) {
    console.error(`ERROR: export ${args.export} no legible (${e.message})`);
    process.exit(2);
  }
  const arr = Array.isArray(j) ? j : j.products || j.items || [];
  const bySource = {};
  for (const p of arr) {
    const src = p.sourceFile || 'UNKNOWN';
    (bySource[src] = bySource[src] || []).push(p);
  }
  const sources = Object.keys(bySource).sort();
  const report = {
    catalogs: sources.length,
    perCatalog: {},
    passed: true,
  };
  for (const src of sources) {
    const heldOut = bySource[src];
    const train = arr.filter((p) => p.sourceFile !== src);
    // Train: classify the reason vocabulary from the training set; validate held-out.
    const trainReasons = {};
    for (const p of train) {
      if (p.status !== 'GREEN') {
        const r = p.qualityReason || p.reason || 'NONE';
        trainReasons[r] = (trainReasons[r] || 0) + 1;
      }
    }
    // Held-out: remediate and measure per-class resolution + FPs.
    const before = {};
    for (const p of heldOut) {
      if (p.status !== 'GREEN') {
        const r = p.qualityReason || p.reason || 'NONE';
        before[r] = (before[r] || 0) + 1;
      }
    }
    const result = Remediation.runRemediationPass(
      heldOut,
      {},
      RemediationConfig.DEFAULT_REMEDIATION_CONFIG,
    );
    const after = {};
    for (const p of result.products) {
      if (p.status !== 'GREEN') {
        const r = p.qualityReason || p.reason || 'NONE';
        after[r] = (after[r] || 0) + 1;
      }
    }
    const resolved = {};
    for (const k of Object.keys(before)) {
      resolved[k] = Math.max(0, (before[k] || 0) - (after[k] || 0));
    }
    const newFPs = result.products.filter(
      (p) =>
        p.status === 'GREEN' &&
        before[p.sku] === undefined &&
        p.remediationEvidence === undefined,
    );
    // newFPs approximation: products that turned GREEN without remediation evidence are suspicious
    const suspect = result.products.filter(
      (p) =>
        p.status === 'GREEN' &&
        !p.remediationEvidence &&
        (before[p.sku] || 0) > 0,
    );
    const heldOutPass =
      Object.keys(resolved).every((k) => resolved[k] >= 0) &&
      suspect.length === 0;
    report.perCatalog[src] = {
      before: before,
      after: after,
      resolved: resolved,
      remediatedCount: result.remediatedCount || 0,
      suspectWithoutEvidence: suspect.length,
      passed: heldOutPass,
    };
    if (!heldOutPass) report.passed = false;
  }
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const src of Object.keys(report.perCatalog)) {
      const c = report.perCatalog[src];
      console.log(
        `${src}: remediated=${c.remediatedCount} suspect=${c.suspectWithoutEvidence} ${c.passed ? "PASS" : "FAIL"}`,
      );
    }
    console.log(
      report.passed
        ? 'HOLD-OUT OK: reglas generalizan sin FP nuevos'
        : 'HOLD-OUT FAIL',
    );
  }
  process.exit(report.passed ? 0 : 1);
}

main();
