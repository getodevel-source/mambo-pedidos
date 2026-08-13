#!/usr/bin/env node
/**
 * anti-overfit-audit.js — Slice 3 hard anti-overfit audit.
 *
 * grep-based audit that no brand/catalog string appears in remediation source or
 * the bootstrapped noun lexicon. Remediation rules MUST be structural/generic —
 * a hardcoded brand name or catalog string is an overfit defect.
 *
 * Usage: node scripts/quality/anti-overfit-audit.js [--json]
 * Exit 0 when no brand/catalog strings are found in remediation source.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
// The audit targets ONLY the remediation sources introduced by this change.
// textSanitizer/catalogValidator/pdfParser hold legitimate pre-existing
// brand->category mappings (the pipeline knows vendor brands) — those are not
// remediation rules and are intentionally excluded.
const srcFiles = [
  path.join(repoRoot, 'src', 'js', 'remediation.js'),
  path.join(repoRoot, 'src', 'js', 'remediationConfig.js'),
  path.join(repoRoot, 'src', 'js', 'imageTextGates.js'),
  path.join(repoRoot, 'src', 'js', 'importGates.js'),
  path.join(repoRoot, 'scripts', 'remediate-catalog.js'),
  path.join(repoRoot, 'scripts', 'quality', 'hold-out-catalog.js'),
  path.join(repoRoot, 'scripts', 'quality', 'synthetic-stress.js'),
  path.join(repoRoot, 'scripts', 'quality', 'promotion-audit.js'),
  path.join(repoRoot, 'scripts', 'quality', 'bootstrap-noun-lexicon.js'),
];

// Brand/catalog tokens that must never appear in remediation source. These are
// the actual vendor names from C:\Mambo\Catalogos — a structural rule never needs them.
const BRAND_TOKENS = [
  '8bitdo',
  '8BitDo',
  'ajazz',
  'AJAZZ',
  'atk',
  'ATK',
  'attack shark',
  'Attack Shark',
  'aula',
  'AULA',
  'irok',
  'Irok',
  'haimu',
  'Haimu',
  'logitech',
  'Logitech',
  'madlions',
  'Madlions',
  'razer',
  'Razer',
  'kz',
  'KZ ',
];

// The BRAND_TOKENS array below is the exclusion list the lexicon must strip —
// its presence is required, not an overfit. Skip the definition block.
const BRAND_TOKEN_DEF_RE = /const BRAND_TOKENS = \[[\s\S]*?\];/;

function audit() {
  const findings = [];
  for (const file of srcFiles) {
    if (!fs.existsSync(file)) {
      findings.push({ file, issue: 'missing' });
      continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(BRAND_TOKEN_DEF_RE, '');
    for (const token of BRAND_TOKENS) {
      if (content.includes(token)) {
        // Allow the token only inside a comment that explicitly documents the
        // anti-overfit guarantee (the audit test itself) — never in logic.
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(token)) {
            const stripped = line
              .replace(/\/\/.*$/, '')
              .replace(/\/\*[\s\S]*?\*\//g, '');
            if (stripped.includes(token)) {
              findings.push({
                file: path.basename(file),
                line: idx + 1,
                token,
                code: stripped.trim().slice(0, 80),
              });
            }
          }
        });
      }
    }
  }

  // Also audit the bootstrapped noun lexicon if present.
  const lexicon = path.join(
    repoRoot,
    'scripts',
    'quality',
    'noun-lexicon.json',
  );
  if (fs.existsSync(lexicon)) {
    const lex = JSON.parse(fs.readFileSync(lexicon, 'utf8'));
    for (const token of BRAND_TOKENS) {
      if (JSON.stringify(lex).includes(token)) {
        findings.push({
          file: 'noun-lexicon.json',
          token,
          issue: 'brand token in lexicon',
        });
      }
    }
  }

  return findings;
}

function main() {
  const json = process.argv.includes('--json');
  const findings = audit();
  if (json) {
    console.log(
      JSON.stringify({ passed: findings.length === 0, findings }, null, 2),
    );
  } else {
    for (const f of findings) {
      console.log(
        `OVERFIT ${f.file}:${f.line || ""} token="${f.token}" code="${f.code || f.issue}"`,
      );
    }
    console.log(
      findings.length
        ? 'ANTI-OVERFIT AUDIT FAIL'
        : 'ANTI-OVERFIT OK: sin strings de marca en el código de remediación',
    );
  }
  process.exit(findings.length ? 1 : 0);
}

main();
