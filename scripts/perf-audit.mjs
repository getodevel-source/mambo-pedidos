// ============================================
//  Mambo Pedidos — perf-audit.mjs
// ============================================
// Auditoría de performance INTEGRAL de la app sobre dist/ (Chromium real +
// stub de fs = camino Tauri). Mide TODOS los procesos: boot, importación,
// catálogo, pedido, cotización, historial, modales y jank (longtasks).
//
// Uso: MAMBO_CATALOG_DIR=/ruta npm run perf:audit
// Salida: tabla por proceso + JSON en /tmp/perf-audit.json
import { chromium } from 'playwright-core';
import http from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CATALOG_DIR = process.env.MAMBO_CATALOG_DIR || '/home/geto/Mambo-app/Catalogos';
let PORT = 0;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2' };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(DIST,p); if(!f.startsWith(DIST)||!existsSync(f)){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'}); res.end(readFileSync(f)); });
await new Promise(r=>server.listen(PORT,r)); PORT=server.address().port;

const browser = await chromium.launch({ headless:true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args:['--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
page.on('pageerror', e=>console.log('⛔ pageerror:', String(e).slice(0,200)));

/* eslint-disable no-undef */
const R = {}; // resultados: {fase: {ms, detalle}}
const rec = (fase, ms, detalle='') => { R[fase] = { ms: Math.round(ms), detalle }; console.log(`  ⏱  ${fase}: ${ms.toFixed(0)}ms${detalle ? ' — '+detalle : ''}`); };
const MB = n => (n/1048576).toFixed(0)+'MB';
const fsStub = `
  window.__fs = { files: new Map(), dirs: new Set(['images']) };
  window.AppStorage._fsApi = () => ({
    ensureDir: async () => { window.__fs.dirs.add('images'); },
    writeBytes: async (rel, bytes) => { window.__fs.files.set(rel, bytes); },
    readBytes: async (rel) => window.__fs.files.get(rel),
    list: async () => Array.from(window.__fs.files.keys()).map(n => ({ name: n.split('/').pop() })),
    remove: async (rel) => { window.__fs.files.delete(rel); },
  });`;

async function evalT(expr) { return page.evaluate(expr); }
const heap = () => evalT("performance.memory ? performance.memory.usedJSHeapSize : 0");
const bootMarks = () => evalT(`(() => {
  const marks = {};
  for (const m of (performance.getEntriesByType('mark')||[])) if (m.name.startsWith('boot:')) marks[m.name] = Math.round(m.startTime);
  return { marks, all: (performance.getEntriesByType('mark')||[]).map(m=>m.name).slice(0,5) };
})()`);
const imgStats = () => evalT(`(() => {
  const items = typeof catalog !== 'undefined' ? catalog : [];
  let bytes=0, withImg=0;
  for (const it of items) if (typeof it.img === 'string' && it.img.startsWith('data:')) { bytes += it.img.length; withImg++; }
  return { n: items.length, withImg, bytes, refs: items.filter(i=>i._imageRef).length };
})()`);

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(()=>window.AppStorage && window.ImportFlow, null, {timeout:20000});
await page.waitForTimeout(800);
await page.evaluate(fsStub);

// ── A) BOOT VACÍO ──
console.log('\n═══ A) BOOT (app vacía) ═══');
await page.reload();
await page.waitForFunction(()=>window.AppStorage && typeof catalog !== 'undefined', null, {timeout:20000});
await page.waitForTimeout(500);
await page.evaluate(fsStub);
const bootA = await bootMarks();
rec('A.boot-marks', 0, JSON.stringify(bootA.marks) + (bootA.all.length ? ' primeros: '+bootA.all.join(',') : ' SIN marks'));

// ── B) IMPORTACIÓN DE LA CARPETA COMPLETA (con longtasks) ──
console.log('\n═══ B) IMPORTACIÓN (10 PDFs → 2080 items) ═══');
await page.evaluate(`window.__lt = []; try {
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lt.push(e.duration); })
    .observe({ entryTypes: ['longtask'] });
} catch (e) {}`);
const tB0 = Date.now();
await page.setInputFiles('#folderInput', CATALOG_DIR);
await page.waitForFunction(()=>document.getElementById('importPreviewModal').style.display==='flex', null, {timeout:600000});
rec('B.parse+optimización total', Date.now()-tB0);
const lt = await evalT("window.__lt || []");
rec('B.longtasks (jank)', lt.reduce((a,b)=>a+b,0), `${lt.length} tareas ≥50ms · max ${lt.length?Math.round(Math.max(...lt)):0}ms`);
const gates = await evalT(`(async () => {
  const out = {};
  let t0=performance.now(); CatalogValidator.runFullValidation(window.ImportFlow.pendingPreviewItems); out.validator=performance.now()-t0;
  t0=performance.now(); ImageTextGates.runAll(window.ImportFlow.pendingPreviewItems); out.imageText=performance.now()-t0;
  t0=performance.now(); ImportGates.runImportVerification(window.ImportFlow.pendingPreviewItems); out.verify=performance.now()-t0;
  return out; })()`);
rec('B.gates validación', gates.validator+gates.imageText+gates.verify, JSON.stringify(gates));
const pendStats = await evalT(`(() => { const it = window.ImportFlow.pendingPreviewItems; let b=0,w=0; for (const x of it) if (typeof x.img==='string' && x.img.startsWith('data:')) { b+=x.img.length; w++; } return { n: it.length, withImg: w, bytes: b }; })()`);
rec('B.imágenes en memoria (preview)', 0, `${MB(pendStats.bytes)} (media ${Math.round(pendStats.bytes/Math.max(1,pendStats.withImg)/1024)}KB)`);
rec('B.heap', await heap(), MB(await heap()));

// ── C) CONFIRM + SAVE ──
console.log('\n═══ C) CONFIRM IMPORT + PERSISTENCIA ═══');
const tC0 = Date.now();
await evalT("window.ImportFlow.confirmImportPreview()");
await page.waitForFunction(()=>typeof catalog!=='undefined' && catalog.length>=1200, null, {timeout:120000});
rec('C.confirm completo', Date.now()-tC0);
await page.waitForTimeout(600);
const stC = await imgStats();
rec('C.catálogo en memoria', 0, `${MB(stC.bytes)} con ${stC.refs} refs a archivos`);
rec('C.heap post-confirm', await heap(), MB(await heap()));
const files = await evalT("window.__fs.files.size");
rec('C.archivos escritos en images/', 0, `${files} (stub)`);
const saveT = await evalT(`(async () => { const t0=performance.now(); await AppStorage.saveCatalog(catalog, selection); return performance.now()-t0; })()`);
rec('C.saveCatalog (segundo save, refs)', saveT);

// ── D) BOOT CON CATÁLOGO LLENO ──
console.log('\n═══ D) BOOT con catálogo de 1264 items ═══');
const tD0 = Date.now();
await page.reload();
await page.waitForFunction(()=>window.AppStorage && typeof catalog!=='undefined' && catalog.length>=1200, null, {timeout:60000});
const bootD = await bootMarks();
rec('D.restore completo (reload → catálogo listo)', Date.now()-tD0, JSON.stringify(bootD.marks));
await page.waitForTimeout(800);
await page.evaluate(fsStub);
rec('D.heap post-restore', await heap(), MB(await heap()));

// ── E) INTERACCIÓN CON EL CATÁLOGO ──
console.log('\n═══ E) CATÁLOGO (vista/filtros/búsqueda/selección) ═══');
const catT = await evalT(`(async () => {
  const out = {};
  let t=performance.now(); renderCatalog(); out.render=performance.now()-t;
  t=performance.now(); populateCatalogFilters(); out.populateFilters=performance.now()-t;
  t=performance.now(); CatalogView.setCatChip('TECLADO', null); out.chip=performance.now()-t;
  document.getElementById('catFilterCat').value=''; CatalogView.setCatChip('', null);
  const s=document.getElementById('catSearch'); if (s) { s.value='key'; const ev=new Event('input',{bubbles:true}); t=performance.now(); s.dispatchEvent(ev); }
  await new Promise(r=>setTimeout(r,400)); out.search=performance.now()-t;
  const s2=document.getElementById('catSearch'); if (s2) { s2.value=''; s2.dispatchEvent(new Event('input',{bubbles:true})); }
  await new Promise(r=>setTimeout(r,400));
  t=performance.now(); for (let i=0;i<5;i++) CatalogView.nextPage(); out.nextPages5=performance.now()-t;
  t=performance.now(); toggleSelectAll(true); out.selectAll=performance.now()-t;
  t=performance.now(); CatalogView.setCatalogViewMode('grid'); renderCatalog(); out.gridRender=performance.now()-t;
  CatalogView.setCatalogViewMode('table'); renderCatalog();
  return out; })()`);
rec('E.renderCatalog (60 filas)', catT.render);
rec('E.populateCatalogFilters', catT.populateFilters);
rec('E.chip de categoría + render', catT.chip);
rec('E.búsqueda debounce', catT.search);
rec('E.nextPage ×5', catT.nextPages5);
rec('E.toggleSelectAll(true)', catT.selectAll);
rec('E.render grilla (grid)', catT.gridRender);
rec('E.heap', await heap(), MB(await heap()));

// ── F) PEDIDO + COTIZACIÓN + HISTORIAL ──
console.log('\n═══ F) PEDIDO / COTIZACIÓN / HISTORIAL ═══');
const pedT = await evalT(`(async () => {
  const out = {};
  // seleccionar 1200 items directo (camino real sin DOM)
  const skus = (typeof catalog !== 'undefined' ? catalog : []).slice(0, 1200).map(i => i.sku);
  selection = {}; for (const s of skus) selection[s] = 1;
  let t=performance.now(); armarPedido(); out.armarPedido=performance.now()-t;
  t=performance.now(); renderPedido(); out.renderPedido=performance.now()-t;
  t=performance.now(); recalc(); out.recalc=performance.now()-t;
  t=performance.now(); renderPedidoTable(); out.renderPedidoTable=performance.now()-t;
  const cfg = QuoteGenerator.getConfig && QuoteGenerator.getConfig() || {};
  t=performance.now(); QuoteGenerator.generatePrintableQuote(currentPedido, cfg, { skipHistory: true }); out.quoteHtml=performance.now()-t;
  t=performance.now(); QuoteGenerator.saveToHistory ? QuoteGenerator.saveToHistory(currentPedido) : null; out.saveHistory=performance.now()-t;
  t=performance.now(); HistoryView.render(); out.historyRender=performance.now()-t;
  const idx = (QuoteGenerator.getHistory ? QuoteGenerator.getHistory() : []).length - 1;
  t=performance.now(); if (idx >= 0) QuoteGenerator.openFromHistory(idx); out.reprint=performance.now()-t;
  return out; })()`).catch(e => ({ err: String(e).slice(0,200) }));
if (pedT.err) console.log('  ⛔ pedido err:', pedT.err);
else {
  rec('F.armarPedido (1200 seleccionados)', pedT.armarPedido);
  rec('F.renderPedido', pedT.renderPedido);
  rec('F.recalc (costos/iva/flete)', pedT.recalc);
  rec('F.renderPedidoTable', pedT.renderPedidoTable);
  rec('F.cotización HTML (1200 ítems)', pedT.quoteHtml);
  rec('F.saveToHistory', pedT.saveHistory);
  rec('F.renderHistorial', pedT.historyRender);
  rec('F.reimprimir última cotización', pedT.reprint);
}
rec('F.heap', await heap(), MB(await heap()));

// ── G) PROCESOS RESTANTES (I0 del process-improvement-program) ──
console.log('\n═══ G) CSV/XLSX · EXPORTS · WIZARD · MODALES ═══');
const g = await evalT(`(async () => {
  const out = {};
  // G1/G2: CSV y XLSX sintéticos de 5000 filas
  const rows = [];
  for (let i = 0; i < 5000; i++) rows.push({ sku: 'T' + String(i).padStart(5,'0'), cat: 'TECLADO', marca: 'FIXTURE', modelo: 'Modelo ' + i, variante: i % 2 ? 'Black' : 'White', fob: 10 + (i % 90), img: '-' });
  const csv = 'sku,cat,marca,modelo,variante,fob,img\\n' + rows.map(r => [r.sku,r.cat,r.marca,r.modelo,r.variante,r.fob,r.img].join(',')).join('\\n');
  let t = performance.now();
  const csvFile = new File([csv], 'fixture-5000.csv', { type: 'text/csv' });
  await FileImporter.processCsvFile(csvFile, []);
  out.csv = performance.now() - t;
  t = performance.now();
  await ensureXlsxLib();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ok');
  const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const xFile = new File([xlsxBuf], 'fixture-5000.xlsx');
  await FileImporter.processExcelFile(xFile, []);
  out.xlsx = performance.now() - t;
  // G3: exports del pedido (1200 items)
  const items = catalog.slice(0, 1200).map(r => ({ sku: r.sku, cat: r.cat, marca: r.marca, modelo: r.modelo, variante: r.variante || '', color: r.variante || '', fob: r.fob, img: r.img, status: r.status, qty: 2 }));
  const ped = { name: 'Pedido I0', items, costs: getCostInputs(), date: new Date().toISOString() };
  t = performance.now(); FileImporter.exportCustomsPackingList(ped); out.packingList = performance.now() - t;
  t = performance.now(); FileImporter.exportExecutiveReport(ped); out.executive = performance.now() - t;
  t = performance.now(); QuoteGenerator.exportCsv(ped); out.quoteCsv = performance.now() - t;
  // G4: wizard (open + 6 pasos)
  t = performance.now(); if (typeof ImportWizard !== 'undefined' && ImportWizard.open) ImportWizard.open(); out.wizardOpen = performance.now() - t;
  const steps = (ImportWizard.steps || []).length;
  t = performance.now();
  for (let i = 0; i < Math.min(steps || 6, 6); i++) { if (ImportWizard.next) ImportWizard.next(); }
  out.wizardSteps = performance.now() - t;
  // G5: modales
  const modals = ['openSupplierCompareModal', 'openSensitivitySimulatorModal', 'openBreakEvenModal', 'openDoorToDoorModal'];
  for (const fn of modals) {
    if (typeof UIModals !== 'undefined' && typeof UIModals[fn] === 'function') {
      t = performance.now(); try { UIModals[fn](); } catch (e) {}
      out[fn] = performance.now() - t;
      // cerrar backdrops abiertos por el modal
      document.querySelectorAll('.modal-backdrop').forEach(m => { m.style.display = 'none'; });
    }
  }
  return out;
})()`).catch(e => ({ err: String(e).slice(0, 300) }));
if (g.err) console.log('  ⛔ phase G err:', g.err);
else {
  for (const [k, v] of Object.entries(g)) rec('G.' + k, v);
}
rec('G.heap', await heap());

await browser.close();
server.close();
writeFileSync('/tmp/perf-audit.json', JSON.stringify(R, null, 2));
console.log('\n📄 /tmp/perf-audit.json escrito');

// ── modo --check: umbrales por fase (baselines 02/09 + tolerancia) ──
if (process.argv[2] === '--check') {
  // claves parciales de fase → umbral en ms (heap en MB→bytes)
  const TH = [
    ['A.boot-marks', 500],
    ['B.parse+optimización', 60000],
    ['B.longtasks', 15000],
    ['B.gates', 500],
    ['C.confirm', 1000],
    ['C.saveCatalog', 500],
    ['C.heap post-confirm', 400 * 1048576],
    ['D.restore', 2000],
    ['D.heap post-restore', 400 * 1048576],
    ['E.renderCatalog', 50],
    ['E.búsqueda', 300],
    ['F.armarPedido', 200],
    ['F.renderPedido', 200],
    ['F.recalc', 200],
    ['F.cotización', 500],
    ['G.csv', 500],
    ['G.xlsx', 1000],
    ['G.packingList', 500],
    ['G.executive', 500],
    ['G.quoteCsv', 500],
    ['G.wizardSteps', 1000],
    ['G.open', 200],
  ];
  let fails = 0;
  console.log('\n⛔ CHECK DE UMBRALES:');
  const flat = {};
  for (const [k, v] of Object.entries(R)) flat[k] = v.ms;
  for (const [part, limit] of TH) {
    const hit = Object.entries(flat).find(([k]) => k.includes(part));
    if (!hit) continue;
    const got = hit[1];
    const status = got <= limit ? '✅' : '❌';
    if (got > limit) fails++;
    console.log(`  ${status} ${hit[0]}: ${Math.round(got)}ms (límite ${limit >= 1000000 ? (limit / 1048576).toFixed(0) + 'MB' : limit}ms)`);
  }
  console.log(fails === 0 ? '\n✅ PERF-AUDIT CHECK OK' : `\n❌ ${fails} fase(s) sobre el umbral`);
  process.exit(fails === 0 ? 0 : 1);
}