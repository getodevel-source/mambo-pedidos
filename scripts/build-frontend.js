// ============================================
// Mambo Pedidos - Build Frontend (P17)
// Minifica src/js/** → dist/ (espejo exacto de la estructura, script tags
// intactos: index.html se copia tal cual con rutas relativas).
// Dev y release usan dist/ vía tauri.conf.json (beforeDevCommand /
// beforeBuildCommand). Self-check: si algún JS no se minificó o falta →
// exit 1 (pineado en el runner oficial de tests).
// ============================================
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// JS test-only que no se sirve en el frontend
const SKIP = new Set(['tests.js']);

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith('.js') && !SKIP.has(e.name)) out.push(p);
  }
  return out;
}

(async () => {
  const entries = jsFiles(path.join(SRC, 'js'));

  await esbuild.build({
    entryPoints: entries,
    outdir: path.join(DIST, 'js'),
    outbase: path.join(SRC, 'js'),
    bundle: false, // cada archivo standalone (patrón browser-global, tags intactos)
    minify: true,
    allowOverwrite: true,
    logLevel: 'warning',
  });

  // Assets estáticos copiados tal cual (rutas relativas intactas)
  for (const rel of ['index.html', 'css', 'vendor', 'header-logo.png']) {
    fs.cpSync(path.join(SRC, rel), path.join(DIST, rel), { recursive: true });
  }

  // Self-check: todo JS minificado existe y es más chico que el original
  let bad = 0;
  let srcBytes = 0;
  let minBytes = 0;
  for (const p of entries) {
    const rel = path.relative(SRC, p);
    const mp = path.join(DIST, rel);
    srcBytes += fs.statSync(p).size;
    if (!fs.existsSync(mp)) { console.error('FALTA dist/' + rel); bad++; continue; }
    const mSize = fs.statSync(mp).size;
    minBytes += mSize;
    if (mSize >= fs.statSync(p).size) { console.error('NO MINIFICÓ dist/' + rel); bad++; }
  }
  const pct = srcBytes ? Math.round((1 - minBytes / srcBytes) * 100) : 0;
  console.log(`build-frontend OK → dist/ (${srcBytes} → ${minBytes} bytes, −${pct}%)`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message || e); process.exit(1); });
