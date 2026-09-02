// scratch: perfil de performance del flujo de importación REAL (chromium + dist/)
// mide: parse, validación por gates, render modal, scroll (chunks), búsqueda,
// edit de ítem, confirm, saveCatalog, renderCatalog y memoria JS.
// NO se commitea.
import { chromium } from 'playwright-core';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CATALOG_DIR = process.env.MAMBO_CATALOG_DIR || '/home/geto/Mambo-app/Catalogos';
let PORT = 0;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
PORT = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

const T = (label, ms) => console.log(`  ⏱  ${label}: ${(ms).toFixed(0)}ms`);
const MB = (n) => (n / 1048576).toFixed(1) + 'MB';

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(() => window.AppStorage && window.ImportFlow && window.PdfParser, null, { timeout: 20000 });
await page.waitForTimeout(1000);

// Stub de fs como el runtime Tauri (writeBytes/readBytes/list en memoria) —
// sin esto el harness cae al modo localStorage y no refleja el path real.
await page.evaluate(() => {
  window.__fs = { files: new Map(), dirs: new Set(['images']) };
  window.AppStorage._fsApi = () => ({
    ensureDir: async () => { window.__fs.dirs.add('images'); },
    writeBytes: async (rel, bytes) => { window.__fs.files.set(rel, bytes); },
    readBytes: async (rel) => window.__fs.files.get(rel),
    list: async () => Array.from(window.__fs.files.keys()).map(n => ({ name: n.split('/').pop() })),
    remove: async (rel) => { window.__fs.files.delete(rel); },
  });
});

// ── fase 1: importar TODA la carpeta, cronometrando por fuera ──
console.log('== 1) CARGA CARPETA COMPLETA ==');
const t0 = Date.now();
await page.setInputFiles('#folderInput', CATALOG_DIR);
// aviso de fin: modal flex
await page.waitForFunction(() => document.getElementById('importPreviewModal').style.display === 'flex', null, { timeout: 600000 });
const tParse = Date.now() - t0;
T('parse total + optimización de imágenes (10 PDFs → 2080 items)', tParse);

// ── fase 2: métricas del estado (memoria, tamaño de imágenes) ──
const meta = await page.evaluate(() => {
  const items = window.ImportFlow.pendingPreviewItems;
  let imgBytes = 0, withImg = 0, maxImg = 0, refs = 0;
  for (const it of items) {
    if (typeof it.img === 'string' && it.img.startsWith('data:')) {
      imgBytes += it.img.length; withImg++;
      if (it.img.length > maxImg) maxImg = it.img.length;
    }
    if (it._imageRef) refs++;
  }
  const m = performance.memory;
  return {
    n: items.length, withImg, imgBytes, maxImg, refs,
    heapUsed: m ? m.usedJSHeapSize : 0, heapTotal: m ? m.totalJSHeapSize : 0,
  };
});
console.log(`  🧠 items=${meta.n} con img=${meta.withImg} imgBytes=${MB(meta.imgBytes)} (media ${(meta.imgBytes / Math.max(1, meta.withImg) / 1024).toFixed(0)}KB) max=${(meta.maxImg / 1024).toFixed(0)}KB`);
console.log(`  🧠 heap usado=${MB(meta.heapUsed)} total=${MB(meta.heapTotal)}`);

// ── fase 3: desglose de la validación (gates) ──
/* eslint-disable no-undef */
const gateT = await page.evaluate(async () => {
  const items = window.ImportFlow.pendingPreviewItems;
  const out = {};
  const t0 = performance.now();
  CatalogValidator.runFullValidation(items);
  out.validator = performance.now() - t0;
  const t1 = performance.now();
  const r2 = ImageTextGates.runAll(items);
  out.imageText = performance.now() - t1;
  const items2 = r2.products;
  const t2 = performance.now();
  if (typeof CatalogAssignmentGates !== 'undefined') {
    CatalogAssignmentGates.runAll(items2);
    out.assignment = performance.now() - t2;
  } else {
    out.assignment = -1;
  }
  const t3 = performance.now();
  ImportGates.runImportVerification(items);
  out.fullVerify = performance.now() - t3;
  return out;
});
console.log('== 2) VALIDACIÓN (gates) ==');
T('CatalogValidator.runFullValidation', gateT.validator);
T('ImageTextGates.runAll', gateT.imageText);
T('CatalogAssignmentGates.runAll', gateT.assignment);
T('runImportVerification (todo de nuevo)', gateT.fullVerify);

// ── fase 4: render del modal completo + scroll ──
console.log('== 3) RENDER MODAL + SCROLL ==');
const rt = await page.evaluate(async () => {
  const t0 = performance.now();
  ImportFlow.renderImportPreviewModal(window._previewValidation || null);
  const tModal = performance.now() - t0;
  // hacer scroll hasta el final en pasos, midiendo el costo por chunk
  const wrap = document.getElementById('pvGridWrap');
  const chunkTimes = [];
  const t1 = performance.now();
  while (wrap.scrollTop + wrap.clientHeight < wrap.scrollHeight - 100) {
    wrap.scrollTop += 1200;
    await new Promise(r => setTimeout(r, 30));
    chunkTimes.push(performance.now());
  }
  const tScroll = performance.now() - t1;
  const cards = document.querySelectorAll('.pv-card').length;
  const imgs = document.querySelectorAll('.pv-card img').length;
  const m2 = performance.memory;
  return { tModal, tScroll, chunkTimes, cards, imgs, heap: m2 ? m2.usedJSHeapSize : 0 };
});
T('renderImportPreviewModal (primer chunk)', rt.tModal);
T('scroll completo (chunks)', rt.tScroll);
console.log(`  cards renderizadas=${rt.cards} imgs=${rt.imgs} heap=${MB(rt.heap)}`);
const chunkSpacing = rt.chunkTimes.slice(1).map((t, i) => t - rt.chunkTimes[i]);
T('costo medio por chunk (60 cards)', chunkSpacing.length ? chunkSpacing.reduce((a, b) => a + b, 0) / chunkSpacing.length : 0);

// ── fase 5: búsqueda (re-render con debounce) ──
console.log('== 4) BÚSQUEDA (debounce 250ms) ==');
const searchT = await page.evaluate(async () => {
  const t0 = performance.now();
  ImportFlow.setPreviewSearch('a');  // ~todo coincide en parte
  await new Promise(r => setTimeout(r, 400));
  return performance.now() - t0;
});
T('setPreviewSearch + re-render', searchT);

// ── fase 6: editar un ítem (re-validación completa) ──
console.log('== 5) EDIT DE ÍTEM (updatePreviewItem) ==');
const editT = await page.evaluate(async () => {
  const t0 = performance.now();
  ImportFlow.updatePreviewItem(0, 'modelo', 'Prueba Perf Test');
  await new Promise(r => setTimeout(r, 100));
  return performance.now() - t0;
});
T('updatePreviewItem (re-run verificación completa)', editT);

// ── fase 7: confirm + save ──
console.log('== 6) CONFIRM IMPORT + SAVE ==');
const tConf0 = Date.now();
await page.evaluate(() => window.ImportFlow.confirmImportPreview());
await page.waitForFunction(() => typeof catalog !== 'undefined' && catalog.length >= 1200, null, { timeout: 180000 });
T('confirm import completo (click → catálogo importado)', Date.now() - tConf0);
const after = await page.evaluate(() => {
  const m = performance.memory;
  return { n: catalog.length, heap: m ? m.usedJSHeapSize : 0 };
});
console.log(`  catálogo=${after.n} heap post-confirm=${MB(after.heap)}`);

await browser.close();
server.close();
console.log('\nperfil completo');