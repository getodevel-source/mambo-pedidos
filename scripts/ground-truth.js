#!/usr/bin/env node
/**
 * Ground-truth sampler: extracts products with the REAL pipeline, takes a seeded
 * random sample, renders the source PDF pages to PNG (with numbered markers at each
 * sampled product's anchor), and writes a manifest for visual verification.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { createCanvas } = require('canvas');

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
const OUT_DIR = path.join(__dirname, '..', 'ground-truth');
const SAMPLE_PER_PDF = 10;
const KEEP_FIRST = 5;
const SCALE = 1.7;
const SEED = 42;

// Deterministic RNG (mulberry32)
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);

class NodeCanvasFactory {
  create(w, h) { const canvas = createCanvas(Math.floor(w), Math.floor(h)); return { canvas, context: canvas.getContext('2d') }; }
  reset(c, w, h) { c.canvas.width = Math.floor(w); c.canvas.height = Math.floor(h); }
  destroy(c) { c.canvas = null; c.context = null; }
}

function makeFile(p) {
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { name: path.basename(p), arrayBuffer: async () => ab };
}

async function renderPage(pdfPath, pageNum, markers) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, canvasFactory: new NodeCanvasFactory() }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: SCALE });
  const factory = new NodeCanvasFactory();
  const { canvas, context } = factory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
  // Draw markers (product anchor x/y are in PDF points, bottom-left origin)
  for (const m of markers) {
    const px = m.x * SCALE;
    const py = m.y * SCALE; // product y is already top-left origin
    context.beginPath();
    context.arc(px, py, 13, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255,0,80,0.85)';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#fff';
    context.stroke();
    context.fillStyle = '#fff';
    context.font = 'bold 15px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(m.id), px, py);
  }
  return canvas.toBuffer('image/png');
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfs = fs.readdirSync(CATALOG_DIR).filter(f => /\.pdf$/i.test(f)).sort();
  const sampled = [];
  let id = 1;

  for (const f of pdfs) {
    const pdfPath = path.join(CATALOG_DIR, f);
    let products = [];
    try {
      const res = await PdfParser.processPdfFile(makeFile(pdfPath), 0, [], null);
      products = res.products || [];
    } catch (e) { console.error('skip', f, e.message); continue; }
    // Only products with a usable anchor position
    const withPos = products.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.pageNum);
    // Seeded random sample
    const pool = [...withPos];
    const picks = [];
    // First pass: KEEP_FIRST picks per PDF reuse the SAME RNG sequence as the
    // original 65-case sample, so ids 1-65 stay identical and existing human
    // verdicts keep matching. Second pass adds the remaining picks (ids 66+).
    for (let i = 0; i < KEEP_FIRST && pool.length; i++) {
      const idx = Math.floor(rand() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    for (let i = 0; i < SAMPLE_PER_PDF - KEEP_FIRST && pool.length; i++) {
      const idx = Math.floor(rand() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    for (const p of picks) {
      sampled.push({
        id: id++, pdf: f, pageNum: p.pageNum, x: Math.round(p.x), y: Math.round(p.y),
        marca: p.marca, modelo: p.modelo, variante: p.variante || '', cat: p.cat,
        fob: p.fob, sku: p.sku, status: p.status,
        raw: (p.rawText || p.cellRawText || '').slice(0, 90)
      });
    }
    console.log(`${f}: ${withPos.length} con posición, ${picks.length} muestreados`);
  }

  // Group by pdf+page and render
  const byPage = new Map();
  for (const s of sampled) {
    const k = s.pdf + '#' + s.pageNum;
    if (!byPage.has(k)) byPage.set(k, { pdf: s.pdf, pageNum: s.pageNum, items: [] });
    byPage.get(k).items.push(s);
  }

  let pageIdx = 0;
  for (const [, g] of byPage) {
    pageIdx++;
    const file = `page_${String(pageIdx).padStart(2, '0')}_${g.pdf.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}_p${g.pageNum}.png`;
    try {
      const png = await renderPage(path.join(CATALOG_DIR, g.pdf), g.pageNum, g.items);
      fs.writeFileSync(path.join(OUT_DIR, file), png);
      g.items.forEach(it => it.markerFile = file);
      console.log(`rendered ${file} (${g.items.length} markers)`);
    } catch (e) {
      console.error('render fail', g.pdf, g.pageNum, e.message);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(sampled, null, 2));
  console.log(`\n✅ ${sampled.length} productos muestreados en ${byPage.size} páginas → ${OUT_DIR}`);
}

main().catch(e => { console.error('crash', e); process.exit(1); });
