#!/usr/bin/env node
/**
 * sample-image-ground-truth.js — stratified sampler for the image/photo
 * labeling packet (IMPORT-PIPELINE-PROGRESS remaining work #2).
 *
 * Input: an export-catalog-batch.js JSON + its -diag.json (diag optional).
 * Output: a labeling packet JSON (to /tmp or a path arg — NEVER inside
 * ground-truth/, which is versioned) + a coverage summary on stdout.
 *
 * Sampling conventions mirror scripts/ground-truth.js exactly:
 * deterministic mulberry32 RNG with seed 42, --per-pdf / GT_PER_PDF,
 * --keep-first / GT_KEEP_FIRST (kept for interface parity; the image
 * packet keeps its own target budget via --target).
 *
 * Strata: PDF x status (GREEN/YELLOW) x with/without imageEvidence
 * x association mechanism (matched / inherited / backfill / none / gallery).
 * Mechanism derivation (no parser changes — read-only classification):
 *   none      — no usable photo (img "-" or missing)
 *   inherited — product._imageInherited === true
 *   backfill  — imgWarnings mention "backfill" (relaxed pass)
 *   matched   — imageEvidence.association === "matched"
 *   gallery   — has photo but no evidence / no backfill marker
 *               (P3 gallery/orphan passes assign prod.img directly)
 *
 * Packet row: sampler id, sku, pdf, page, marca/modelo/cat, imageEvidence
 * fields, a view pointer a human can open (pdf path + page + export index
 * + optional --images file name), and an EMPTY label slot
 * { correctPhoto: null, notes: "" }.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : null;
};
const flagNum = (name, envName, dflt) => {
  const v = flagValue(name);
  if (v != null) return Number(v);
  const e = process.env[envName];
  return e != null && e !== '' ? Number(e) : dflt;
};

const SEED = 42;
const PER_PDF = flagNum('per-pdf', 'GT_PER_PDF', 18);
const KEEP_FIRST = flagNum('keep-first', 'GT_KEEP_FIRST', 5);
const TARGET = Number(flagValue('target') || 180);
const positionals = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i-1] === "--out"));
const EXPORT_PATH = positionals[0];
const OUT_PATH = flagValue('out') || positionals[1] || '/tmp/image-ground-truth-packet.json';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasPhoto(p) {
  return typeof p.img === 'string' && /^data:image\//i.test(p.img);
}

function mechanismOf(p) {
  if (!hasPhoto(p)) return 'none';
  if (p._imageInherited === true) return 'inherited';
  const w = Array.isArray(p.imgWarnings) ? p.imgWarnings.join(' ') : '';
  if (/backfill/i.test(w)) return 'backfill';
  if (p.imageEvidence && p.imageEvidence.association === 'matched') return 'matched';
  return 'gallery';
}

function evidenceOf(p) {
  const e = p.imageEvidence || {};
  return {
    pdfIdentity: e.pdfIdentity ?? null,
    page: e.page ?? p.pageNum ?? null,
    canvasDecode: e.canvasDecode ?? null,
    association: e.association ?? null,
    imageFormat: e.imageFormat ?? null,
    width: e.width ?? null,
    height: e.height ?? null,
  };
}

function imgFileHint(p) {
  if (!hasPhoto(p)) return null;
  try {
    const b64 = p.img.slice(p.img.indexOf(',') + 1);
    return 'img_' + crypto.createHash('sha256').update(b64).digest('hex').slice(0, 16) + '.png';
  } catch { return null; }
}

// Pure: group export rows into strata keyed "pdf|status|photo|mechanism".
function stratify(products) {
  const strata = new Map();
  products.forEach((p, idx) => {
    const mech = mechanismOf(p);
    const photo = hasPhoto(p) ? 'with-photo' : 'no-photo';
    const status = p.status === 'GREEN' ? 'GREEN' : p.status === 'YELLOW' ? 'YELLOW' : String(p.status || 'OTHER');
    const key = [p.sourceFile || 'unknown', status, photo, mech].join('|');
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(idx);
  });
  return strata;
}

// Pure: deterministic round-robin draw across strata (KEEP_FIRST rows per
// stratum guaranteed first, then round-robin up to TARGET total).
function drawSample(strata, products, { perPdf = PER_PDF, keepFirst = KEEP_FIRST, target = TARGET, seed = SEED } = {}) {
  const rand = mulberry32(seed);
  // Shuffle each stratum deterministically.
  for (const idxs of strata.values()) {
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
  }
  // Fair rotation: sort strata by (pdf, key) so rotation is stable.
  const keys = [...strata.keys()].sort();
  const taken = new Set();
  const pick = [];
  // Phase 1: keep-first per stratum (bounded by perPdf per PDF overall).
  const perPdfCount = new Map();
  const pdfOf = (k) => k.split('|')[0];
  for (const k of keys) {
    for (const idx of strata.get(k).slice(0, keepFirst)) {
      if (taken.has(idx)) continue;
      const pdf = products[idx].sourceFile || 'unknown';
      if ((perPdfCount.get(pdf) || 0) >= perPdf) break;
      taken.add(idx);
      pick.push(idx);
      perPdfCount.set(pdf, (perPdfCount.get(pdf) || 0) + 1);
    }
  }
  // Phase 2: round-robin until target.
  let progress = true;
  while (pick.length < target && progress) {
    progress = false;
    for (const k of keys) {
      if (pick.length >= target) break;
      const pdf = pdfOf(k);
      void pdf;
      const next = (strata.get(k) || []).find((i) => !taken.has(i));
      if (next == null) continue;
      taken.add(next);
      pick.push(next);
      progress = true;
    }
  }
  return pick;
}

function buildPacket(products, indices, exportPath) {
  return indices.map((idx, n) => {
    const p = products[idx];
    return {
      id: 'IMG-' + String(n + 1).padStart(3, '0'),
      sku: p.sku || null,
      pdf: p.sourceFile || null,
      page: p.pageNum ?? null,
      marca: p.marca ?? null,
      modelo: p.modelo ?? null,
      cat: p.cat ?? null,
      status: p.status ?? null,
      mechanism: mechanismOf(p),
      imageEvidence: evidenceOf(p),
      imgWarnings: Array.isArray(p.imgWarnings) ? p.imgWarnings : [],
      view: {
        exportFile: exportPath,
        exportIndex: idx,
        pdfPage: p.pageNum ?? null,
        imgFile: imgFileHint(p),
        imgFileNote: 're-export with export-catalog-batch.js --images <dir> to materialize; file name above',
      },
      label: { correctPhoto: null, notes: '' },
    };
  });
}

async function main() {
  if (!EXPORT_PATH || !fs.existsSync(EXPORT_PATH)) {
    console.error('usage: node scripts/sample-image-ground-truth.js <export.json> [--out packet.json] [--target N] [--per-pdf N] [--keep-first N]');
    process.exit(1);
  }
  if (path.resolve(OUT_PATH).startsWith(path.resolve(__dirname, '..', 'ground-truth') + path.sep)) {
    console.error('refusing to write inside ground-truth/ (versioned dir)');
    process.exit(1);
  }
  const products = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf-8'));
  if (!Array.isArray(products)) { console.error('export JSON is not an array'); process.exit(1); }
  const strata = stratify(products);
  const indices = drawSample(strata, products, {});
  const rows = buildPacket(products, indices, path.resolve(EXPORT_PATH));
  // Coverage summary.
  const byPdf = {}, byStratum = {};
  for (const r of rows) {
    byPdf[r.pdf] = (byPdf[r.pdf] || 0) + 1;
    const k = [r.status, r.mechanism].join('|');
    byStratum[k] = (byStratum[k] || 0) + 1;
  }
  const packet = {
    meta: { seed: SEED, perPdf: PER_PDF, keepFirst: KEEP_FIRST, target: TARGET, exportFile: path.resolve(EXPORT_PATH), createdAt: new Date().toISOString(), totalExportRows: products.length },
    coverage: { rows: rows.length, byPdf, byStratum, strataTotal: strata.size },
    rows,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(packet, null, 2), 'utf-8');
  console.log(`packet: ${rows.length} rows (${products.length} export rows, ${strata.size} strata) -> ${OUT_PATH}`);
  console.log('byPdf: ' + Object.entries(byPdf).map(([k, v]) => `${k.split(' ')[0]}:${v}`).join(' '));
  console.log('byStratum: ' + Object.entries(byStratum).map(([k, v]) => `${k}=${v}`).join(' '));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { mulberry32, SEED, hasPhoto, mechanismOf, evidenceOf, stratify, drawSample, buildPacket };
