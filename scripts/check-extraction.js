#!/usr/bin/env node
// ============================================
// check-extraction.js — mide la extracción del parser contra el corpus
// SINTÉTICO con ground-truth conocido (spec process-qa-groundtruth).
// Uso: node scripts/check-extraction.js [corpusDir] [--json out.json]
// Gates: fobExact >= 90% · modeloMatch >= 70% · 0 RED estructurales.
// Exit != 0 = regresión del motor frente al ground-truth.
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m', RED = '\x1b[31m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

(async () => {
  const { JSDOM } = require('jsdom');
  const { createCanvas } = require('canvas');
  const dom = new JSDOM('', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.Image = dom.window.Image;
  global.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  global.TextSanitizer = require('../src/js/textSanitizer.js');
  global.CatalogValidator = require('../src/js/catalogValidator.js');
  global.SkuAllocator = require('../src/js/skuAllocator.js');
  global.CatalogAssignmentGates = require('../src/js/catalogAssignmentGates.js');
  global.ImageTextGates = require('../src/js/imageTextGates.js');
  global.toast = () => {};
  // Fuentes base14 (Helvetica) del corpus sintético: pdf.js v3 en Node necesita
  // standardFontDataUrl servido por http + useWorkerFetch (verificado: la
  // extracción de 4 productos funciona en este entorno con este setup).
  const http = require('http');
  const stdFonts = path.dirname(require.resolve('pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'));
  const fontServer = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0].replace(/^\//, ''));
    try { res.writeHead(200); res.end(fs.readFileSync(path.join(stdFonts, name))); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => fontServer.listen(0, '127.0.0.1', r));
  const stdFontsUrl = `http://127.0.0.1:${fontServer.address().port}/`;
  if (!process.env.CHECK_NO_HOOK) {
    const origGetDoc = global.pdfjsLib.getDocument.bind(global.pdfjsLib);
    global.pdfjsLib.getDocument = (params) => {
      console.error('[dbg] getDocument hook: keys=' + Object.keys(params || {}).join(','));
      return origGetDoc({
        ...(params || {}),
        useWorkerFetch: true,
        standardFontDataUrl: stdFontsUrl,
      });
    };
  }
  const PdfParser = require('../src/js/pdfParser.js');

  const dir = process.argv[2] || '/tmp/mambo-synth-corpus';
  const jsonOut = process.argv.indexOf('--json') !== -1
    ? process.argv[process.argv.indexOf('--json') + 1]
    : null;
  const gt = JSON.parse(fs.readFileSync(path.join(dir, 'ground-truth.json'), 'utf8'));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).sort();

  const makeFile = (p) => {
    const buf = fs.readFileSync(p);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return { name: path.basename(p), arrayBuffer: async () => ab };
  };

  let totalExpected = 0, fobExact = 0, modeloMatch = 0, redStructural = 0;
  const perFile = [];
  for (const f of files) {
    if (process.env.CHECK_ONLY && f !== process.env.CHECK_ONLY) continue;
    const expected = gt[f] || [];
    const res = await PdfParser.processPdfFile(makeFile(path.join(dir, f)), 0, [], null);
    const prods = res.products || [];
    totalExpected += expected.length;
    let fe = 0, mm = 0;
    for (const exp of expected) {
      const hit = prods.find(p => Math.abs(Number(p.fob) - Number(exp.fob)) < 0.005);
      if (hit) {
        fe++;
        const modelNorm = String(hit.modelo || '').toLowerCase();
        const want = String(exp.modelo).toLowerCase();
        if (modelNorm.includes(want) || want.includes(modelNorm)) mm++;
      }
    }
    fobExact += fe;
    modeloMatch += mm;
    redStructural += prods.filter(p => p.status === 'RED' && /estructural/i.test((p.warnings || []).join(' '))).length;
    perFile.push({ file: f, esperados: expected.length, extraidos: prods.length, fobExact: fe, modeloMatch: mm });
  }

  const pct = (n) => Math.round((n / Math.max(1, totalExpected)) * 100);
  const fobPct = pct(fobExact);
  const modelPct = pct(modeloMatch);
  const ok = fobPct >= 90 && modelPct >= 70 && redStructural === 0;
  console.log(`${BOLD}${ok ? GREEN + '✅' : RED + '❌'}${RESET} extracción sobre corpus sintético (${files.length} PDFs, ${totalExpected} filas): ` +
    `FOB exacto ${fobExact}/${totalExpected} (${fobPct}%, gate >=90) · modelo ${modelPct}% (gate >=70) · RED estructurales ${redStructural}${RESET}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ok, perFile, fobPct, modelPct, redStructural }, null, 1));
  if (!ok) { console.error('❌ el motor no cumple el ground-truth sintético'); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('check-extraction falló:', e.message || e); process.exit(2); });