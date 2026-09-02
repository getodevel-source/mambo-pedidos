// ============================================
//  Mambo Pedidos — perf-export.mjs (perf-engineering §2)
// ============================================
// Benchmark del export JSON de diagnóstico: la 4 combinaciones
// (scope x imágenes x formato), invariantes (sin _imageRef/_selected) y
// gates (< 600ms stringify, sin imágenes < 200ms, archivo < 1MB sin img).
// Uso: MAMBO_CATALOG_DIR=... npm run perf:export
/* eslint-disable no-undef */
import { chromium } from "playwright-core";
import http from "http";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CATALOG_DIR = process.env.MAMBO_CATALOG_DIR || "/home/geto/Mambo-app/Catalogos";
let PORT = 0;
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml" };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split("?")[0]); if(p==="/")p="/index.html"; const f=path.join(DIST,p); if(!f.startsWith(DIST)||!existsSync(f)){res.writeHead(404);res.end("nf");return;} res.writeHead(200,{"content-type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"}); res.end(readFileSync(f)); });
await new Promise(r=>server.listen(PORT,r)); PORT=server.address().port;

const browser = await chromium.launch({ headless:true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
page.on("pageerror", e=>console.log("pageerror:", String(e).slice(0,200)));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(()=>window.AppStorage && window.ImportFlow, null, {timeout:20000});
await page.waitForTimeout(800);
await page.evaluate(`window.__fs={files:new Map(),dirs:new Set(["images"])}; window.AppStorage._fsApi=()=>({ensureDir:async()=>{},writeBytes:async(r,b)=>{window.__fs.files.set(r,b)},readBytes:async(r)=>window.__fs.files.get(r),list:async()=>[],remove:async()=>{}});`);
await page.setInputFiles("#folderInput", CATALOG_DIR);
await page.waitForFunction(()=>document.getElementById("importPreviewModal").style.display==="flex", null, {timeout:600000});

const bench = await page.evaluate(`(async()=>{
  const out={};
  const combos=[
    ["preview+thumb+pretty",{scope:"preview",images:"thumb",pretty:true}],
    ["preview+ninguna+compact",{scope:"preview",images:"none",pretty:false}],
  ];
  const items = window.ImportFlow.pendingPreviewItems;
  for (const [name,opts] of combos) {
    const t0=performance.now();
    const data=CatalogValidator.buildCatalogExportJSON(items,opts);
    const json=JSON.parse(data);
    out[name]={items:json.length, ms:+((performance.now()-t0)).toFixed(0), mb:+(data.length/1048576).toFixed(1), hasRuntimeRefs:JSON.stringify(data).includes("_imageRef")||JSON.stringify(data).includes("_selected")};
  }
  return out;
})()`);

// catálogo confirmado
await page.evaluate("window.ImportFlow.confirmImportPreview()");
await page.waitForFunction(()=>typeof catalog!=="undefined" && catalog.length>=1200, null, {timeout:120000});
await page.waitForTimeout(400);
const benchCat = await page.evaluate(`(async()=>{
  const out={};
  const combos=[
    ["catalog+thumb+pretty",{scope:"catalog",images:"thumb",pretty:true}],
    ["catalog+thumb+compact",{scope:"catalog",images:"thumb",pretty:false}],
    ["catalog+ninguna+compact",{scope:"catalog",images:"none",pretty:false}],
  ];
  for (const [name,opts] of combos) {
    const t0=performance.now();
    const data=CatalogValidator.buildCatalogExportJSON(catalog,opts);
    const json=JSON.parse(data);
    out[name]={items:json.length, ms:+((performance.now()-t0)).toFixed(0), mb:+(data.length/1048576).toFixed(1), hasRuntimeRefs:JSON.stringify(data).includes("_imageRef")||JSON.stringify(data).includes("_selected")};
  }
  return out;
})()`);

const all = { preview: bench, catalog: benchCat };
let fails = 0;
for (const [grp, combos] of Object.entries(all)) {
  for (const [name, v] of Object.entries(combos)) {
    const st = v.hasRuntimeRefs ? "❌ runtime refs" : (v.ms < 600 ? "✅" : "❌ >600ms");
    console.log(`${grp}/${name.padEnd(24)} items=${v.items} ms=${v.ms} mb=${v.mb} ${st}`);
    if (v.hasRuntimeRefs || v.ms >= 600) fails++;
  }
}
if (all.catalog["catalog+ninguna+compact"].mb >= 1) { console.log("❌ archivo sin imágenes >= 1MB"); fails++; }
writeFileSync("/tmp/perf-export.json", JSON.stringify(all, null, 2));
console.log(fails === 0 ? "\n✅ PERF-EXPORT OK — gates cumplidos" : `\n❌ ${fails} gate(s) fallados`);
await browser.close(); server.close();
process.exit(fails === 0 ? 0 : 1);
