// ============================================
//  Mambo Pedidos — perf-smoke.mjs (gate CI de mecánica)
// ============================================
// Gate de performance EJECUTABLE EN CI sin corpus de PDFs: ejercita las
// mecánicas completas (boot, import CSV sintético, confirm, persistencia con
// stub de fs, catálogo, pedido, cotización, export JSON) con umbrales.
// Los gates de corpus REAL (parse/jank/recall) corren en local por release
// (MAMBO_CATALOG_DIR) — ver docs/RELEASE-QA.md y openspec/specs/perf-engineering.
// Uso: npm run perf:smoke   (exit != 0 = regresión)
import { chromium } from 'playwright-core';
import http from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* eslint-disable no-undef */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
let PORT = 0;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(DIST,p); if(!f.startsWith(DIST)||!existsSync(f)){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'}); res.end(readFileSync(f)); });
await new Promise(r=>server.listen(PORT,r)); PORT=server.address().port;

const browser = await chromium.launch({ headless:true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args:['--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
page.on('pageerror', e=>console.log('pageerror:', String(e).slice(0,200)));

const R = {};
const NAME_KEY = { 'boot a listeners':'boot', 'import CSV sintético 5000':'csvImport', 'confirm 5000 items':'confirm', 'saveCatalog con refs/stub':'save', 'heap post-confirm':'heapPostConfirmMB', 'restore 5000 tras reload':'restore', 'renderCatalog':'renderCatalog', 'búsqueda (neta)':'search', 'armarPedido 1200':'armarPedido', 'recalc':'renderPedido', 'cotización 1200':'quote', 'export JSON stringify':'exportJson' };
const rec = (k, ms, ok, det='') => { R[k] = { ms: Math.round(ms), ok, det }; const lim = Math.round((TH[NAME_KEY[k]] ?? 0) * LOAD); console.log(`  ${ok?'✅':'❌'} ${k}: ${ms.toFixed(0)}ms${det?' — '+det:''}${lim ? ' (límite '+lim+'ms)' : ''}`); };
const TH = { boot: 1500, csvImport: 3000, confirm: 1500, save: 1500, restore: 3000, renderCatalog: 150, search: 600, armarPedido: 400, renderPedido: 400, quote: 1000, exportJson: 800, heapPostConfirmMB: 400 };
// Factor de carga (mismo mecanismo que perf-audit): en CI/sesión ocupada el
// harness se degrada ~2x; un ref barato escala los umbrales sin esconder
// regresiones (una regresión real escala PEOR que la referencia).
const REF_QUIET = 12;
async function loadFactor() {
  try {
    const ref = await page.evaluate(`(() => { const t0 = performance.now();
      for (let i = 0; i < 10000; i++) QuoteGenerator.formatCurrency(1234.5, { currency: 'USD' });
      return performance.now() - t0; })()`);
    return Math.min(3, Math.max(1, ref / REF_QUIET));
  } catch { return 1; }
}

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(()=>window.AppStorage && window.ImportFlow, null, {timeout:30000});
const LOAD = await loadFactor();
console.log(`REF carga perf-smoke: ${LOAD.toFixed(2)}x`);
let t = Date.now();
await page.waitForFunction(()=>window.AppStorage && typeof catalog!=='undefined', null, {timeout:20000});
// boot completo (store + listeners): esperar marks
await page.waitForFunction(()=>performance.getEntriesByType('mark').some(m=>m.name==='boot:listeners'), null, {timeout:15000});
const bootMs = Date.now() - t;
rec('boot a listeners', bootMs, bootMs < TH.boot * LOAD);

// stub fs (camino Tauri)
await page.evaluate(`window.__fs={files:new Map(),dirs:new Set(['images'])}; window.AppStorage._fsApi=()=>({ensureDir:async()=>{},writeBytes:async(r,b)=>{window.__fs.files.set(r,b)},readBytes:async(r)=>window.__fs.files.get(r),list:async()=>[],remove:async()=>{}});`);

// import sintético CSV 5000 filas (sin PDFs)
t = Date.now();
const r = await page.evaluate(`(async()=>{
  const rows=[];
  for (let i=0;i<5000;i++) rows.push({sku:'T'+String(i).padStart(5,'0'),cat:'TECLADO',marca:'FIXTURE',modelo:'Modelo '+i,variante:i%2?'Black':'White',fob:10+(i%90),img:'-'});
  const csv='sku,cat,marca,modelo,variante,fob,img\\n'+rows.map(x=>[x.sku,x.cat,x.marca,x.modelo,x.variante,x.fob,x.img].join(',')).join('\\n');
  await FileImporter.processCsvFile(new File([csv],'f-5000.csv',{type:'text/csv'}), []);
  const items = rows.map(x => ({...x, status:'GREEN', warnings:[], confidence:95, grounded:true, importable:true, _selected:true}));
  window.ImportFlow.pendingPreviewItems = items;
  ImportGates.runImportVerification(items);
  return items.length;
})()`);
const csvMs = Date.now() - t;
rec('import CSV sintético 5000', csvMs, csvMs < TH.csvImport * LOAD, `items=${r}`);

// confirm + save + restore
t = Date.now();
await page.evaluate(`window.ImportFlow.confirmImportPreview()`);
await page.waitForFunction(()=>typeof catalog!=='undefined' && catalog.length>=4000, null, {timeout:60000});
const confirmMs = Date.now() - t;
rec('confirm 5000 items', confirmMs, confirmMs < TH.confirm * LOAD);
t = Date.now();
await page.evaluate(`AppStorage.saveCatalog(catalog, selection)`);
const saveMs = Date.now() - t;
rec('saveCatalog con refs/stub', saveMs, saveMs < TH.save * LOAD);
await page.waitForTimeout(300);
const heapMB = await page.evaluate("performance.memory ? (performance.memory.usedJSHeapSize/1048576) : 0");
rec('heap post-confirm', heapMB, heapMB < TH.heapPostConfirmMB * LOAD, heapMB.toFixed(0)+'MB');

t = Date.now();
await page.reload();
await page.waitForFunction(()=>window.AppStorage && typeof catalog!=='undefined' && catalog.length>=4000, null, {timeout:60000});
const restoreMs = Date.now() - t;
rec('restore 5000 tras reload', restoreMs, restoreMs < TH.restore * LOAD);
await page.waitForTimeout(400);

// catálogo + pedido + cotización + export
const ph = await page.evaluate(`(async()=>{
  const out={};
  let t=performance.now(); renderCatalog(); out.render=performance.now()-t;
  const s=document.getElementById('catSearch'); if(s){ s.value='Modelo 1'; s.dispatchEvent(new Event('input',{bubbles:true})); }
  await new Promise(r=>setTimeout(r,600)); out.search=performance.now()-t-600;
  const skus=catalog.slice(0,1200).map(i=>i.sku); selection={}; for(const sk of skus) selection[sk]=1;
  t=performance.now(); armarPedido(); out.armar=performance.now()-t;
  t=performance.now(); recalc(); out.recalc=performance.now()-t;
  t=performance.now(); QuoteGenerator.generatePrintableQuote(currentPedido, QuoteGenerator.getConfig(), {skipHistory:true}); out.quote=performance.now()-t;
  t=performance.now(); CatalogValidator.buildCatalogExportJSON(catalog, {images:'none', pretty:false}); out.exportJson=performance.now()-t;
  return out;
})()`);
rec('renderCatalog', ph.render, ph.render < TH.renderCatalog * LOAD);
rec('búsqueda (neta)', ph.search, ph.search < TH.search * LOAD);
rec('armarPedido 1200', ph.armar, ph.armar < TH.armarPedido * LOAD);
rec('recalc', ph.recalc, ph.recalc < TH.renderPedido * LOAD);
rec('cotización 1200', ph.quote, ph.quote < TH.quote * LOAD);
rec('export JSON stringify', ph.exportJson, ph.exportJson < TH.exportJson * LOAD);

await browser.close();
server.close();
writeFileSync('/tmp/perf-smoke.json', JSON.stringify(R, null, 2));
const fails = Object.values(R).filter(v => !v.ok).length;
console.log(fails === 0 ? '\n✅ PERF-SMOKE OK — sin regresiones de mecánica' : `\n❌ ${fails} fase(s) sobre umbral`);
process.exit(fails === 0 ? 0 : 1);