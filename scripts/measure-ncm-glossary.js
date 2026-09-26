// Offline measurement: BEFORE vs AFTER glossary query expansion on 30 real corpus products.
// Usage: node scripts/measure-ncm-glossary.js
// Reads: ground-truth/manifest.json (product names), src/data/ncmDatabase.json, src/data/ncmGlossary.json.
// Pure token-overlap scoring identical to NcmDatabase.search(); BEFORE = raw tokens only.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/ncmDatabase.json'), 'utf8'));
const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/ncmGlossary.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ground-truth/manifest.json'), 'utf8'));

function tokenize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

const index = new Map();
(db.registros || []).forEach((r, i) => {
  tokenize((r.desc || '') + ' ' + r.ncm).forEach(t => {
    if (!index.has(t)) index.set(t, new Set());
    index.get(t).add(i);
  });
});

// Glossary sanity: every expansion token must exist in the index.
const missing = [];
Object.entries(glossary.entries || {}).forEach(([k, vs]) => {
  vs.forEach(v => { if (!index.has(v)) missing.push(k + '->' + v); });
});

// Category -> expected NCM prefixes (domain-relevant acceptance, not single-code truth).
const EXPECT = {
  TECLADO: ['8471.60.52'],
  MOUSE: ['8471.60.53'],
  AURICULAR: ['8518.30'],
  HEADSET: ['8518.30'],
  SPEAKER: ['8518.2', '8518.90'],
  SWITCH: ['8536.50', '8536.90'],
  CONTROLLER: ['9504.50', '9504.90'],
  CAMARA: ['8525.8', '9006', '8528'],
  ACCESORIO: ['8473.30', '9504.90', '8536.90'],
};

function search(tokens, k) {
  const scores = new Map();
  tokens.forEach(t => {
    const hits = index.get(t);
    if (hits) hits.forEach(i => scores.set(i, (scores.get(i) || 0) + 1));
  });
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, k)
    .map(([i, score]) => Object.assign({ score }, db.registros[i]));
}

function expand(tokens) {
  const out = tokens.slice();
  tokens.forEach(t => {
    const vs = (glossary.entries || {})[t];
    if (vs) vs.forEach(v => { if (!out.includes(v)) out.push(v); });
  });
  return out;
}

// Deterministic 30-product sample: seeded stride across manifest.
const sample = [];
for (let i = 0; i < manifest.length && sample.length < 30; i += 2) sample.push(manifest[i]);
while (sample.length < 30) sample.push(manifest[sample.length % manifest.length]);

let top1b = 0, top8b = 0, top1a = 0, top8a = 0;
const rows = [];
sample.forEach(e => {
  const q = (e.raw || '') + ' ' + (e.modelo || '') + ' ' + (e.cat || '');
  const want = EXPECT[e.cat] || [];
  const rb = search(tokenize(q), 8).map(r => r.ncm);
  const ra = search(expand(tokenize(q)), 8).map(r => r.ncm);
  const hb = p => rb.some(n => p.some(x => n.startsWith(x)));
  const ha = p => ra.some(n => p.some(x => n.startsWith(x)));
  if (want.length) {
    if (rb.length && want.some(x => rb[0].startsWith(x))) top1b++;
    if (want.length && hb(want)) top8b++;
    if (ra.length && want.some(x => ra[0].startsWith(x))) top1a++;
    if (want.length && ha(want)) top8a++;
  }
  rows.push({ raw: String(e.raw || '').slice(0, 50), cat: e.cat, top1before: rb[0] || '-', top1after: ra[0] || '-' });
});

console.log('sample=' + sample.length);
console.log('BEFORE top1=' + top1b + '/' + sample.length + ' top8=' + top8b + '/' + sample.length);
console.log('AFTER  top1=' + top1a + '/' + sample.length + ' top8=' + top8a + '/' + sample.length);
console.log('glossary-missing-tokens=' + (missing.length ? JSON.stringify(missing) : 'none'));
rows.forEach(r => console.log('  [' + r.cat + '] ' + r.raw + ' | ' + r.top1before + ' -> ' + r.top1after));
