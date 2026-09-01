// ============================================
//  Mambo Pedidos — import-audit.mjs
// ============================================
// Auditoría E2E del flujo de IMPORTACIÓN REAL sobre dist/ (servido local) con
// Chromium del sistema (PLAYWRIGHT_CHROMIUM, default /usr/bin/chromium).
// Reproduce exactamente lo que hace el usuario y corta con exit != 0 si algo
// no funciona:
//   A) carga de CADA PDF individual -> modal de preview con productos
//   B) confirmación real -> el catálogo crece
//   C) persistencia: reload -> se restaura lo guardado
//   D) carga de CARPETA completa (input webkitdirectory) -> los 2080 productos
//   F) navegación por todas las vistas
//   G) sin requests fallidos ni errores de la app (excluye el updater, que en
//      este harness http golpea GitHub por CORS; en Tauri no mezcla orígenes)
//
// Uso:
//   MAMBO_CATALOG_DIR="/ruta/a/los/catalogos" npm run audit:import
//   MAMBO_CATALOG_DIR=... PLAYWRIGHT_CHROMIUM=/usr/bin/chromium npm run audit:import
//
// Origem: el bug real d3e17d2 (helpers del parser solo asignados en la ruta
// Node) pasaba todos los unit tests y rompía el import real: la animación
// corría y no se agregaba NI UN producto. Esta auditoría corre el browser de
// verdad con los PDFs reales, así esa clase de bug ya no puede escapar.
// ============================================
import { chromium } from 'playwright-core';
import http from 'http';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CATALOG_DIR =
  process.env.MAMBO_CATALOG_DIR ||
  path.join(ROOT, 'Catalogos') ||
  'C:\\Mambo catalogos';
let PORT = 0;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !existsSync(file)) {
    res.writeHead(404);
    res.end('nf');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
PORT = server.address().port;

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const logs = [];
const reqFails = [];
const UPSTREAM = /(github\.com|latest\.json|updater)/i;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 400)}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 400)}`));
page.on('requestfailed', (r) => reqFails.push(r.url()));

// Expresiones evaluadas en el BROWSER (catalog es un binding global let de
// app.js clásico — no está en window, solo se resuelve por nombre de scope).
const CAT = () => page.evaluate("typeof catalog !== 'undefined' ? catalog.length : -2");
const ROWS = () => page.evaluate("document.querySelectorAll('tbody tr').length");
const PEND = () => page.evaluate('window.ImportFlow.pendingPreviewItems.length');
const MODAL = () => page.evaluate("document.getElementById('importPreviewModal').style.display");
const SEMI = () => page.evaluate(`
  (() => { const v = window._previewValidation;
    return v ? { g: v.stats.green, y: v.stats.yellow, r: v.stats.red, t: v.stats.total } : null; })()`);

if (!existsSync(CATALOG_DIR)) {
  console.error(`❌ No existe MAMBO_CATALOG_DIR="${CATALOG_DIR}"`);
  process.exit(2);
}
const pdfs = readdirSync(CATALOG_DIR).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
const pdfPaths = pdfs.map((f) => path.join(CATALOG_DIR, f));
console.log(`PDFs (${pdfs.length}): ${pdfs.join(', ')}\n`);

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(
    () => window.AppStorage && window.ImportFlow && window.PdfParser,
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(1200);

  // ── A) cada PDF individual → modal de preview con productos ──
  for (let i = 0; i < pdfPaths.length; i++) {
    const before = await PEND();
    await page.setInputFiles('#fileInputPdf', [pdfPaths[i]]);
    await page.waitForFunction(
      (prev) =>
        window.ImportFlow.pendingPreviewItems.length > prev ||
        document.getElementById('importPreviewModal').style.display === 'flex',
      before,
      { timeout: 180000 },
    );
    await page.waitForTimeout(200);
    const pend = await PEND();
    const modal = await MODAL();
    check(`A${i + 1}) ${pdfs[i].slice(0, 22)}`, pend > before && modal === 'flex', `pend=${pend} modal=${modal}`);
    await page.evaluate(() => window.closeImportPreviewModal());
  }

  // ── B) confirm real → el catálogo crece ──
  await page.setInputFiles('#fileInputPdf', [pdfPaths[0]]);
  await page.waitForFunction(() => window.ImportFlow.pendingPreviewItems.length > 0, null, {
    timeout: 180000,
  });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const v = window._previewValidation;
    const btn = document.getElementById('pvConfirmBtn');
    const rect = btn ? btn.getBoundingClientRect() : null;
    const sem = v
      ? { g: v.stats.green, y: v.stats.yellow, r: v.stats.red, t: v.stats.total }
      : null;
    const sel = window.ImportFlow.pendingPreviewItems.filter((i) => i._selected).length;
    return { sem, btnVisible: !!(rect && rect.width > 0 && rect.height > 0), sel };
  });
  check('B-semáforo', !!info.sem && info.sem.t > 0, JSON.stringify(info.sem));
  check('B-btn confirmar visible', info.btnVisible, `sel=${info.sel}`);
  if (info.btnVisible) {
    const rowsBefore = await ROWS();
    const catBefore = await CAT();
    await page.evaluate(() => document.getElementById('pvConfirmBtn').click());
    await page.waitForFunction((r) => document.querySelectorAll('tbody tr').length > r, rowsBefore, {
      timeout: 20000,
    });
    await page.waitForTimeout(300);
    check('B-catálogo creció', (await ROWS()) > rowsBefore && (await CAT()) > catBefore,
      `rows ${rowsBefore}→${await ROWS()} cat ${catBefore}→${await CAT()}`);
  }

  // ── C) persistencia: reload restaura ──
  const savedLen = await CAT();
  await page.reload();
  await page.waitForFunction(() => window.AppStorage && typeof catalog !== 'undefined', null, {
    timeout: 20000,
  });
  await page.waitForTimeout(1500);
  const restored = await CAT();
  check('C-persistencia tras reload', restored >= savedLen && restored > 0,
    `saved=${savedLen} restored=${restored} rows=${await ROWS()}`);

  // ── D) carpeta completa (todos los PDFs de una). Se espera el MODAL final:
  //     aparece solo cuando el parse completo + la validación terminaron. ──
  await page.setInputFiles('#folderInput', CATALOG_DIR);
  await page.waitForFunction(
    () => document.getElementById('importPreviewModal').style.display === 'flex',
    null,
    { timeout: 480000 },
  );
  await page.waitForTimeout(400);
  const pendFolder = await PEND();
  const semiF = await SEMI();
  check('D-carpeta: items completos en preview', !!semiF && semiF.t >= 1800,
    `pend=${pendFolder} semi=${semiF && semiF.t}`);
  check('D-carpeta: semáforo', !!semiF && semiF.t >= 1800, JSON.stringify(semiF));

  // ── F) navegación por todas las vistas (cerrando overlays del harness) ──
  await page.evaluate(() => {
    try {
      window.closeImportPreviewModal();
    } catch (e) {}
    const m = document.getElementById('importPreviewModal');
    if (m) m.style.display = 'none';
    const o = document.getElementById('loadingOverlay');
    if (o) o.style.display = 'none';
  });
  await page.waitForTimeout(300);
  for (const v of ['pedido', 'historial', 'importaciones', 'catalogo']) {
    await page.click(`.nav-item[data-view="${v}"]`, { force: true });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => document.querySelector('.nav-item.active')?.dataset.view);
    check(`F-nav ${v}`, after === v, `${v}→${after}`);
  }

  // ── G) sin requests fallidos ni errores de la propia app ──
  const appReqFails = reqFails.filter((u) => !UPSTREAM.test(u));
  const appErrors = logs.filter(
    (l) =>
      (l.startsWith('pageerror') || l.startsWith('error')) &&
      !UPSTREAM.test(l) &&
      !/Failed to load resource: net::ERR_FAILED/.test(l),
  );
  check('G-sin requests/errores de la app', appReqFails.length === 0 && appErrors.length === 0,
    (appReqFails.slice(0, 3).join(' | ') + (appErrors.length ? ' ; ' + appErrors.slice(0, 2).join(' | ') : '')).slice(0, 300));

  await page.screenshot({ path: '/tmp/mambo-import-audit-final.png' });
} finally {
  await browser.close();
  server.close();
}

console.log('\n════════ RESULTADOS AUDITORÍA IMPORTACIÓN (browser real) ════════');
let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  if (!r.ok) fails++;
}
console.log(`\n${fails === 0 ? '✅ TODO OK' : `❌ ${fails} fallos`}`);
process.exit(fails === 0 ? 0 : 1);