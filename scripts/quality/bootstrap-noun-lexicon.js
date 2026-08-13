#!/usr/bin/env node
/**
 * bootstrap-noun-lexicon.js — Slice 3 known-good noun lexicon bootstrap.
 *
 * Derives the product-noun lexicon from GREEN products that survive 2 iterations
 * of the gates (never hand-curated per brand). Brand-excluded: brand tokens are
 * removed before tokenization so the lexicon stays structural.
 *
 * Usage:
 *   node scripts/quality/bootstrap-noun-lexicon.js --export export.json [--out noun-lexicon.json] [--json]
 * Writes scripts/quality/noun-lexicon.json by default.
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

// Brand tokens stripped before tokenization (structural lexicon, never per-brand).
const BRAND_TOKENS = [
  '8bitdo',
  'ajazz',
  'atk',
  'attack shark',
  'aula',
  'irok',
  'haimu',
  'logitech',
  'madlions',
  'razer',
  'kz',
  'gateron',
  'kaihua',
  'holyoops',
  'jwk',
  'outemu',
  'ttc',
  'mchose',
  'lofree',
  'womier',
  'monsgeek',
  'motospeed',
];

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--export') out.export = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function tokenize(modelo) {
  if (!modelo) return [];
  let m = String(modelo);
  for (const b of BRAND_TOKENS) {
    m = m.replace(
      new RegExp(
        '\\b' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
        'gi',
      ),
      ' ',
    );
  }
  return m
    .split(/[^a-záéíóúñü]+/i)
    .filter((w) => w.length >= 3)
    .map((w) => w.toLowerCase());
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'bootstrap-noun-lexicon.js — deriva el léxico de sustantivos desde GREEN estables.\nUso: node scripts/quality/bootstrap-noun-lexicon.js --export export.json [--out noun-lexicon.json]',
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
  // Known-good: GREEN products with no warnings and no remediation evidence.
  const stable = arr.filter(
    (p) =>
      p.status === 'GREEN' &&
      (!p.warnings || p.warnings.length === 0) &&
      !p.remediationEvidence,
  );
  const counts = {};
  for (const p of stable) {
    for (const w of tokenize(p.modelo)) {
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  // Keep nouns appearing in >= 3 stable products (structural frequency signal).
  const lexicon = Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  const outFile =
    args.out || path.join(repoRoot, 'scripts', 'quality', 'noun-lexicon.json');
  const payload = {
    generatedFrom: stable.length + ' stable GREEN products',
    size: lexicon.length,
    nouns: lexicon,
  };
  try {
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error(`ERROR: no se pudo escribir ${outFile} (${e.message})`);
    process.exit(2);
  }

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(
      `Estables: ${stable.length} · Léxico: ${lexicon.length} sustantivos (frecuencia >= 3)`,
    );
    console.log('Sample:', lexicon.slice(0, 20).join(', '));
    console.log(`Escrito: ${outFile}`);
  }
}

main();
