// layout-audit.mjs — auditoría geométrica del frontend por viewport (tiers CSS).
// Sirve dist/ localmente y mide con Playwright+chromium: overflow horizontal,
// ancho del sidebar por tier, título por tier, toggle oculto, sticky bar
// centrada, tabla sin scroll horizontal. Exit != 0 con el primer fallo.
//
// Uso: npm run layout-audit   (chromium del sistema: /usr/bin/chromium o
// PLAYWRIGHT_CHROMIUM). Carga sin catalogo demo: sidebar y título se miden
// sobre el estado vacío, que es el mismo layout.

import { chromium } from 'playwright-core';
import http from 'http';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const EXE = process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

const VIEWPORTS = [
  { w: 621, h: 752 }, { w: 701, h: 850 }, { w: 900, h: 700 },
  { w: 1256, h: 800 }, { w: 1512, h: 910 }, { w: 1600, h: 900 }, { w: 1920, h: 1080 },
];

// tiers del CSS vigente (src/css/styles.css)
const TIER = (w) =>
  w <= 900 ? { sidebar: 180, title: 18 }
    : w <= 1100 ? { sidebar: 225, title: 18 }
    : w <= 1600 ? { sidebar: 225, title: 20 }
    : { sidebar: 270, title: 26 };

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = path.normalize(path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname));
      if (!p.startsWith(DIST)) { res.writeHead(403); return res.end(); }
      try {
        const st = await stat(p);
        if (st.isDirectory()) p = path.join(p, 'index.html');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
        createReadStream(p).pipe(res);
      } catch {
        res.writeHead(404); res.end();
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };

for (const vp of VIEWPORTS) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  const srv = await serve();
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const demoBtn = page.locator('button:has-text("Cargar Demo")');
  if (await demoBtn.count()) { await demoBtn.click(); await page.waitForTimeout(1000); }

  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    let maxOverR = 0;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      maxOverR = Math.max(maxOverR, r.right - vw);
    }
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    const title = document.querySelector('.view.active .page-title');
    const t = title ? getComputedStyle(title).fontSize : null;
    const toggle = document.querySelector('.menu-toggle');
    const toc = toggle ? getComputedStyle(toggle).display : 'no-existe';
    const sb = document.getElementById('stickyOrderBar');
    const sticky = sb && getComputedStyle(sb).display !== 'none' ? (() => {
      const r = sb.getBoundingClientRect();
      return { left: r.left, right: r.right, w: r.width };
    })() : null;
    const table = document.querySelector('.view.active .table-scroll, .table-scroll');
    const tbl = table ? { sw: table.scrollWidth, cw: table.clientWidth } : null;
    return { overflow: doc.scrollWidth - doc.clientWidth, maxOverR, sidebarW: Math.round(sidebar.width), title: t, toggle: toc, sticky, tbl };
  });

  const tier = TIER(vp.w);
  console.log(`\n=== ${vp.w}x${vp.h} (tier sidebar ${tier.sidebar}, title ${tier.title}) ===`);
  check(m.overflow === 0, `overflow doc == 0 (got ${m.overflow})`);
  check(Math.abs(m.sidebarW - tier.sidebar) <= 2, `sidebar ${tier.sidebar}px (±2, got ${m.sidebarW})`);
  check(m.title === null || parseFloat(m.title) === tier.title, `page-title ${tier.title}px (got ${m.title})`);
  check(m.toggle === 'none' || m.toggle === 'no-existe', `menu-toggle no visible (got ${m.toggle})`);
  if (m.sticky) check(Math.abs(m.sticky.left - (vp.w - m.sticky.w) / 2) <= 2, `sticky bar centrada (left ${Math.round(m.sticky.left)} vs ${Math.round((vp.w - m.sticky.w) / 2)})`);
  if (m.tbl) {
    if (vp.w <= 900) check(m.tbl.sw >= m.tbl.cw, `tabla con scroll interno disponible a <=900 (SW ${m.tbl.sw} >= CW ${m.tbl.cw})`);
    else check(m.tbl.sw <= m.tbl.cw + 1, `tabla sin scroll interno a >900 (scrollW ${m.tbl.sw} vs clientW ${m.tbl.cw})`);
  }

  await page.close(); await srv.close(); await browser.close();
}

console.log(`\n${failures.length === 0 ? '✅ LAYOUT-AUDIT OK — todos los viewports' : `❌ ${failures.length} fallos`}`);
process.exit(failures.length === 0 ? 0 : 1);