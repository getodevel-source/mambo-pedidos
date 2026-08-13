#!/usr/bin/env node
/**
 * synthetic-stress.js — Slice 3 generalization validation (synthetic stress tests).
 *
 * Mutates fixture models (truncation, marketing words, switch tokens, generic
 * words) and probes the remediation rules with fictional brands: identical
 * structural patterns must behave identically regardless of brand. This is the
 * anti-overfit guarantee — the rules are structural, never per-brand.
 *
 * Usage: node scripts/quality/synthetic-stress.js [--json]
 * Exit 0 when every probe behaves as expected.
 */
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

const TS = global.TextSanitizer;

// Structural probes: same pattern, different brands. The noun-phrase rule must
// treat 'Dual Charging Dock <BRAND>' identically for every brand.
const NOUN_PHRASE_PROBES = [
  'Dual Charging Dock Xbox',
  'Dual Charging Dock Fiktiv',
  'Triple Stand Pad BrandX',
  'Wireless Hub Case Glorp',
];

// Puffery stacks must stay YELLOW regardless of brand.
const PUFFERY_PROBES = [
  'Ultra Crystalblade Gleam',
  'Mega Hyper Nova Zeta',
  'Super Ultra Crystal Frost',
];

// Switch/axis tokens must classify switch-axis regardless of brand.
const SWITCH_PROBES = [
  'Magnetic Switch T9',
  'Hall Effect X7 BrandY',
  'Speed Axis Pro ZX',
];

// Truncation: unclosed paren must be detected regardless of brand.
const TRUNCATED_PROBES = [
  'F75 Glacier (Light',
  'AK820 Pro (Switch',
  'R87 Kaihua (Red',
];

// Generic words must be flagged generic regardless of brand context.
const GENERIC_PROBES = ['Rose', 'Standard', 'Zero', 'Ultimate'];

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const failures = [];

  const nounResults = NOUN_PHRASE_PROBES.map((m) => {
    const c = TS.classifyMarketingModel(m, 'CONTROLLER');
    return {
      model: m,
      class: c.class,
      noun: c.noun || null,
      marketingWords: c.marketingWords || 0,
    };
  });
  // All noun-phrase probes must classify noun-phrase (identical structural behavior).
  if (!nounResults.every((r) => r.class === 'noun-phrase')) {
    failures.push(`noun-phrase probes: ${JSON.stringify(nounResults)}`);
  }

  const pufferyResults = PUFFERY_PROBES.map((m) => {
    const c = TS.classifyMarketingModel(m, 'MOUSE');
    return { model: m, class: c.class };
  });
  if (
    !pufferyResults.every(
      (r) => r.class === 'puffery' || r.class === 'marketing-only',
    )
  ) {
    failures.push(`puffery probes: ${JSON.stringify(pufferyResults)}`);
  }

  const switchResults = SWITCH_PROBES.map((m) => {
    const c = TS.classifyMarketingModel(m, 'KEYBOARD');
    return { model: m, class: c.class, switchToken: c.switchToken || null };
  });
  if (!switchResults.every((r) => r.class === 'switch-axis')) {
    failures.push(`switch probes: ${JSON.stringify(switchResults)}`);
  }

  const truncatedResults = TRUNCATED_PROBES.map((m) => {
    const q = TS.assessModelQuality
      ? TS.assessModelQuality(m, '', 'KEYBOARD', m + ' row')
      : null;
    return { model: m, level: q ? q.level : null, reasons: q ? q.reasons : [] };
  });
  if (
    !truncatedResults.every(
      (r) => r.level === 'YELLOW' && r.reasons.some((x) => /truncado/i.test(x)),
    )
  ) {
    failures.push(`truncated probes: ${JSON.stringify(truncatedResults)}`);
  }

  const genericResults = GENERIC_PROBES.map((m) => {
    const q = TS.assessModelQuality
      ? TS.assessModelQuality(m, '', 'KEYBOARD', m + ' row')
      : null;
    return { model: m, level: q ? q.level : null };
  });
  if (!genericResults.every((r) => r.level === 'YELLOW' || r.level === 'RED')) {
    failures.push(`generic probes: ${JSON.stringify(genericResults)}`);
  }

  const report = {
    nounPhrase: nounResults,
    puffery: pufferyResults,
    switch: switchResults,
    truncated: truncatedResults,
    generic: genericResults,
    passed: failures.length === 0,
    failures,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`noun-phrase: ${nounResults.map((r) => r.class).join(", ")}`);
    console.log(`puffery: ${pufferyResults.map((r) => r.class).join(", ")}`);
    console.log(`switch: ${switchResults.map((r) => r.class).join(", ")}`);
    console.log(
      `truncated: ${truncatedResults.map((r) => r.level).join(", ")}`,
    );
    console.log(`generic: ${genericResults.map((r) => r.level).join(", ")}`);
    console.log(
      failures.length
        ? 'SYNTHETIC STRESS FAIL'
        : 'SYNTHETIC STRESS OK: patrón estructural idéntico entre marcas',
    );
  }
  process.exit(failures.length ? 1 : 0);
}

main();
