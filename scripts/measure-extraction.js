#!/usr/bin/env node
/**
 * FASE 2 measurement loop: re-runs the REAL extraction pipeline over the 13
 * ground-truth PDFs and diffs the 65 manifest cases against their baseline
 * (modelo/variante/status). Cheap (no rendering) — this is the gate for every
 * parser slice: targeted cases must improve, nothing must regress.
 *
 * Usage:
 *   node scripts/measure-extraction.js            # diff vs manifest baseline
 *   node scripts/measure-extraction.js --json     # machine-readable result
 *   node scripts/measure-extraction.js --items <pdf> <page>   # dump raw text items
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Image = dom.window.Image;
let pdfjs;
try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); } catch { pdfjs = require('pdfjs-dist'); }
global.pdfjsLib = pdfjs;
global.TextSanitizer = require('../src/js/textSanitizer.js');
global.CatalogValidator = require('../src/js/catalogValidator.js');
global.SkuAllocator = require('../src/js/skuAllocator.js');
global.toast = () => {};
global.LocalLlm = { parseCellStructured: async () => null, parsePageChunk: async () => null, isAvailable: async () => false };
const PdfParser = require('../src/js/pdfParser.js');

const CATALOG_DIR = process.env.MAMBO_CATALOG_DIR || 'C:\\Mambo\\Catalogos';
const ROOT = path.join(__dirname, '..');

function makeFile(p) {
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { name: path.basename(p), arrayBuffer: async () => ab };
}

const DIST = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);

async function extractAll() {
  const pdfs = fs.readdirSync(CATALOG_DIR).filter(f => /\.pdf$/i.test(f)).sort();
  const byPdf = {};
  for (const f of pdfs) {
    try {
      const res = await PdfParser.processPdfFile(makeFile(path.join(CATALOG_DIR, f)), 0, [], null);
      byPdf[f] = res.products || [];
    } catch (e) { console.error('skip', f, e.message); }
  }
  return byPdf;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ground-truth', 'manifest.json'), 'utf8'));
  const verdicts = JSON.parse(fs.readFileSync(path.join(ROOT, 'ground-truth', 'verdicts.json'), 'utf8'));
  const verBy = {};
  for (const it of verdicts.items) verBy[it.id] = it;

  const byPdf = await extractAll();

  // Re-map each manifest case to the NEW extraction by nearest anchor (same pdf/page).
  const result = [];
  for (const m of manifest) {
    const pool = (byPdf[m.pdf] || []).filter(p => p.pageNum === m.pageNum);
    if (!pool.length) { result.push({ id: m.id, missing: true }); continue; }
    const best = pool.reduce((a, b) => (DIST(a, m) < DIST(b, m) ? a : b));
    result.push({
      id: m.id,
      dist: Math.round(DIST(best, m)),
      veredicto: verBy[m.id] ? verBy[m.id].veredicto : '?',
      old: { modelo: m.modelo, variante: m.variante, status: m.status },
      neu: { modelo: best.modelo, variante: best.variante || '', status: best.status || '' }
    });
  }

  const changed = result.filter(r => !r.missing && (r.old.modelo !== r.neu.modelo || r.old.variante !== r.neu.variante));
  console.log(`\n=== ${result.length} casos, ${changed.length} cambiaron ===`);
  for (const r of changed) {
    const verdict = r.veredicto;
    const v = verBy[r.id] ? ` [${verdict}] ${(verBy[r.id].razon || '').slice(0, 60)}` : '';
    console.log(`#${r.id}${v}`);
    console.log(`   OLD: modelo=${JSON.stringify(r.old.modelo)} variante=${JSON.stringify(r.old.variante)} (${r.old.status})`);
    console.log(`   NEW: modelo=${JSON.stringify(r.neu.modelo)} variante=${JSON.stringify(r.neu.variante)} (${r.neu.status})`);
  }
  const unchanged = result.filter(r => !r.missing && r.old.modelo === r.neu.modelo && r.old.variante === r.neu.variante);
  console.log(`\nSin cambios: ${unchanged.length} casos (incluye los NO-regresión sentinel)`);
  if (process.argv.includes('--json')) {
    fs.writeFileSync(path.join(ROOT, 'ground-truth', 'extraction-diff.json'), JSON.stringify(result, null, 1));
    console.log('diff JSON → ground-truth/extraction-diff.json');
  }
}

async function dumpItems(pdfName, pageNums) {
  const res = await PdfParser.processPdfFile(makeFile(path.join(CATALOG_DIR, pdfName)), 0, [], null);
  const pages = Array.isArray(pageNums) ? pageNums : [pageNums];
  const prod = (res.products || []).filter(p => pages.includes(p.pageNum));
  console.log(`\n=== ${pdfName} p${pages.join(',')}: ${prod.length} productos ===`);
  for (const p of prod) {
    console.log(`  [x=${Math.round(p.x)} y=${Math.round(p.y)}] ${p.marca} | ${JSON.stringify(p.modelo)} | ${JSON.stringify(p.variante || '')} | $${p.fob} (${p.status})`);
  }
  // Raw items: instrument by re-running the internal extraction with a monkeypatch
  // to capture rawElements + priceAnchors for this page.
  const origGrid = PdfParser.extractPageProductsByCellGrid.bind(PdfParser);
  const origRows = PdfParser.extractPageProductsByTableRows.bind(PdfParser);
  let captured = [];
  PdfParser.extractPageProductsByCellGrid = async function (items, viewportHeight, pageNum2, pageImages, brandFallback, customBrands, existingProducts) {
    if (pages.includes(pageNum2)) {
      const rawElements = items.filter(i => i.str && i.str.trim()).map(i => ({
        x: i.transform[4], y: viewportHeight - i.transform[5], text: i.str.trim(), pageNum2
      }));
      const anchors = rawElements.filter(el => PdfParser.extractUsdPrice(el.text) !== null);
      captured.push({ page: pageNum2, rawElements, anchors: anchors.map(a => ({ x: Math.round(a.x), y: Math.round(a.y), text: a.text })) });
    }
    return origGrid(items, viewportHeight, pageNum2, pageImages, brandFallback, customBrands, existingProducts);
  };
  PdfParser.extractPageProductsByTableRows = async function (...a) { return origRows(...a); };
  await PdfParser.processPdfFile(makeFile(path.join(CATALOG_DIR, pdfName)), 0, [], null);
  for (const cap of captured) {
    console.log(`\n=== rawElements p${cap.page} (${cap.rawElements.length}) ===`);
    for (const el of cap.rawElements.sort((a, b) => a.y - b.y || a.x - b.x)) {
      console.log(`  x=${String(el.x).padStart(6)} y=${String(el.y).padStart(6)} | ${JSON.stringify(el.text)}`);
    }
  }
}

(async () => {
  if (process.argv.includes('--items')) {
    const spec = process.argv[process.argv.indexOf('--items') + 1];
    const [pdfName, pagesPart] = spec.split('::');
    const pages = pagesPart ? pagesPart.split(',').map(Number) : null;
    await dumpItems(pdfName, pages);
    return;
  }
  await main();
})();
