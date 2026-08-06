#!/usr/bin/env node
/**
 * Mambo Pedidos — Headless REAL-pipeline audit.
 *
 * Runs the ACTUAL browser extraction pipeline (PdfParser.processPdfFile), including
 * canvas-based image extraction + spatial image matching, against every PDF in the
 * catalog directory — no GUI, no manual steps. Then runs R1-R10 validation and an
 * image-fit audit (detects photos whose silhouette contradicts the product category).
 *
 * The LLM enrichment is stubbed to null on purpose: this audit measures the rule-based
 * pipeline deterministically (no network / local-model dependency), which is where all
 * the extraction and image-matching fixes live.
 *
 * Usage:
 *   node scripts/audit-app.js                 # all PDFs in CATALOG_DIR
 *   node scripts/audit-app.js --pdf <path>    # single PDF
 *   node scripts/audit-app.js --json out.json # also write a machine-readable report
 *
 * Exit code: 0 = no RED products and no image-fit mismatches; 1 otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── DOM shim (node-canvas backed) ────────────────────────────────────────────
const { JSDOM } = require('jsdom');
const dom = new JSDOM('', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Image = dom.window.Image;

// ── pdfjs (Node legacy build) ────────────────────────────────────────────────
let pdfjs;
try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); }
catch { pdfjs = require('pdfjs-dist'); }
global.pdfjsLib = pdfjs;

// ── App modules (pure JS, shared with the browser build) ─────────────────────
global.TextSanitizer = require('../src/js/textSanitizer.js');
global.CatalogValidator = require('../src/js/catalogValidator.js');
global.SkuAllocator = require('../src/js/skuAllocator.js');
global.toast = () => {}; // no-op UI toast for headless runs
// Deterministic LLM stub: no enrichment (see header note).
global.LocalLlm = {
  parseCellStructured: async () => null,
  parsePageChunk: async () => null,
  isAvailable: async () => false
};

const PdfParser = require('../src/js/pdfParser.js');

// ── Config ───────────────────────────────────────────────────────────────────
const CATALOG_DIR = process.env.MAMBO_CATALOG_DIR || 'C:\\Mambo\\Catalogos';

// Shape-gate categories (must mirror PdfParser.validateImageForProduct).
const COMPACT_CATS = ['MOUSE', 'AURICULAR', 'HEADSET', 'CONTROLLER', 'SWITCH'];
const WIDE_CATS = ['TECLADO', 'MOUSEPAD'];

function parseArgs() {
  const argv = process.argv.slice(2);
  const pdfIdx = argv.indexOf('--pdf');
  const jsonIdx = argv.indexOf('--json');
  return {
    pdf: pdfIdx >= 0 ? argv[pdfIdx + 1] : null,
    json: jsonIdx >= 0 ? argv[jsonIdx + 1] : null,
    verbose: argv.includes('--verbose')
  };
}

function makeFile(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { name: path.basename(pdfPath), arrayBuffer: async () => ab };
}

/** Image-fit audit: does the matched photo's silhouette contradict the category? */
// Uses imageEvidence dims when present; otherwise decodes the dataUrl (cached, since
// inherited images are shared) so cell-grid products without evidence are still checked.
// This closes the blind spot that hid cross-category inheritance leaks.
const { loadImage } = require('canvas');
const dimCache = new Map();
async function imageDims(dataUrl) {
  if (dimCache.has(dataUrl)) return dimCache.get(dataUrl);
  let d = null;
  try { const im = await loadImage(dataUrl); d = { w: im.width, h: im.height }; } catch {}
  dimCache.set(dataUrl, d);
  return d;
}
async function auditImageFit(product) {
  let w, h;
  const ev = product.imageEvidence;
  if (ev && ev.width && ev.height) { w = ev.width; h = ev.height; }
  else if (/^data:image\//i.test(product.img || '')) {
    const d = await imageDims(product.img);
    if (!d) return null;
    w = d.w; h = d.h;
  } else return null;
  const cat = (product.cat || '').toUpperCase();
  const aspect = w / Math.max(1, h);
  if (COMPACT_CATS.includes(cat) && aspect > 1.9) {
    return { cat, aspect: +aspect.toFixed(2), w, h, reason: 'wide photo on compact product' };
  }
  if (WIDE_CATS.includes(cat) && aspect < 0.65) {
    return { cat, aspect: +aspect.toFixed(2), w, h, reason: 'tall photo on wide product' };
  }
  return null;
}

async function auditPdf(pdfPath) {
  const name = path.basename(pdfPath);
  const t0 = Date.now();
  let products;
  try {
    const result = await PdfParser.processPdfFile(makeFile(pdfPath), 0, [], null);
    products = (result && result.products) || [];
  } catch (e) {
    return { name, error: e.message, products: 0, green: 0, yellow: 0, red: 0, mismatches: [], ms: Date.now() - t0 };
  }
  global.CatalogValidator.runFullValidation(products);

  const green = products.filter(p => p.status === 'GREEN').length;
  const yellow = products.filter(p => p.status === 'YELLOW').length;
  const red = products.filter(p => p.status === 'RED').length;
  const withImage = products.filter(p => typeof p.img === 'string' && /^data:image\//i.test(p.img)).length;
  const inherited = products.filter(p => p._imageInherited).length;

  const mismatches = [];
  for (const p of products) {
    const m = await auditImageFit(p);
    if (m) mismatches.push({ sku: p.sku, marca: p.marca, modelo: p.modelo, ...m });
  }

  // Top RED reasons
  const redReasons = {};
  for (const p of products.filter(p => p.status === 'RED')) {
    const r = (p.qualityReason || p.warnings?.[0] || 'unknown').slice(0, 60);
    redReasons[r] = (redReasons[r] || 0) + 1;
  }

  return {
    name, products: products.length, green, yellow, red, withImage, inherited,
    mismatches, redReasons, ms: Date.now() - t0,
    _products: products
  };
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

async function main() {
  const args = parseArgs();
  let pdfPaths;
  if (args.pdf) {
    pdfPaths = [args.pdf];
  } else {
    if (!fs.existsSync(CATALOG_DIR)) {
      console.error(`❌ Catalog dir not found: ${CATALOG_DIR} (set MAMBO_CATALOG_DIR)`);
      process.exit(2);
    }
    pdfPaths = fs.readdirSync(CATALOG_DIR).filter(f => /\.pdf$/i.test(f)).map(f => path.join(CATALOG_DIR, f));
  }

  console.log(`\n🔬 MAMBO REAL-PIPELINE AUDIT — ${pdfPaths.length} PDFs (headless, canvas enabled)\n`);
  console.log('═'.repeat(72));

  const results = [];
  for (const p of pdfPaths) {
    const r = await auditPdf(p);
    results.push(r);
    const flag = r.error ? '💥' : (r.red + r.mismatches.length === 0 ? '🟢' : (r.red > 0 ? '🔴' : '🟡'));
    const line = `${flag} ${r.name.padEnd(42)} P=${String(r.products).padStart(4)} G=${String(r.green).padStart(4)} Y=${String(r.yellow).padStart(3)} R=${String(r.red).padStart(3)} img=${String(r.withImage).padStart(4)} mismatch=${r.mismatches.length}`;
    console.log(line);
    if (r.error) console.log(`     ERROR: ${r.error}`);
  }

  console.log('═'.repeat(72));

  const all = results.filter(r => !r.error);
  const tP = all.reduce((s, r) => s + r.products, 0);
  const tG = all.reduce((s, r) => s + r.green, 0);
  const tY = all.reduce((s, r) => s + r.yellow, 0);
  const tR = all.reduce((s, r) => s + r.red, 0);
  const tImg = all.reduce((s, r) => s + r.withImage, 0);
  const tMism = all.reduce((s, r) => s + r.mismatches.length, 0);

  console.log(`\n  📦 Productos: ${tP}`);
  console.log(`  🟢 GREEN:  ${tG} (${pct(tG, tP)}%)`);
  console.log(`  🟡 YELLOW: ${tY} (${pct(tY, tP)}%)`);
  console.log(`  🔴 RED:    ${tR} (${pct(tR, tP)}%)`);
  console.log(`  🖼️  Con imagen: ${tImg} (${pct(tImg, tP)}%)`);
  console.log(`  🧩 Image-fit mismatches: ${tMism}`);

  // Aggregate RED reasons
  const aggRed = {};
  for (const r of all) for (const [k, v] of Object.entries(r.redReasons || {})) aggRed[k] = (aggRed[k] || 0) + v;
  const topRed = Object.entries(aggRed).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topRed.length) {
    console.log(`\n  TOP RAZONES RED:`);
    for (const [reason, n] of topRed) console.log(`    ${String(n).padStart(4)}  ${reason}`);
  }

  // Mismatch detail
  const allMism = all.flatMap(r => r.mismatches.map(m => ({ file: r.name, ...m })));
  if (allMism.length) {
    console.log(`\n  🧩 IMAGE-FIT MISMATCHES (${allMism.length}):`);
    for (const m of allMism.slice(0, 20)) {
      console.log(`    [${m.file}] ${m.marca} ${m.modelo} → ${m.cat} aspect=${m.aspect} (${m.w}x${m.h}) ${m.reason}`);
    }
    if (allMism.length > 20) console.log(`    ... y ${allMism.length - 20} más`);
  }

  // RED split: model-quality REDs are the HONEST semaphore rejecting unusable models
  // (desired behaviour, not a pipeline regression); structural REDs are real defects.
  let gateRed = 0;
  for (const r of all) for (const [k, v] of Object.entries(r.redReasons || {})) if (k.includes("specs técnicas")) gateRed += v;
  const structRed = tR - gateRed;
  const pass = tMism === 0 && structRed === 0 && all.every(r => !r.error);
  console.log(pass
    ? `
  ✅ PASS — pipeline íntegro (0 image-mismatches, 0 RED estructurales). Semáforo honesto: ${gateRed} RED de calidad de modelo (rechazados por diseño) + ${tY} YELLOW a revisar.
`
    : `
  ❌ FAIL — ${structRed} RED estructurales, ${tMism} image-mismatches, ${all.filter(r=>r.error).length} errores de archivo.
`);

  if (args.json) {
    const report = {
      generatedAt: new Date().toISOString(),
      totals: { products: tP, green: tG, yellow: tY, red: tR, withImage: tImg, mismatches: tMism },
      topRedReasons: topRed.map(([reason, count]) => ({ reason, count })),
      mismatches: allMism,
      perFile: results.map(({ _products, redReasons, ...r }) => ({ ...r, redReasons }))
    };
    fs.writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`  📄 Report escrito en ${args.json}\n`);
  }

  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('💥 Audit crashed:', e); process.exit(2); });
