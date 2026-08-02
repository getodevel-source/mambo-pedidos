#!/usr/bin/env node
/**
 * Deep extraction audit — processes real PDFs through the pipeline
 * and reports every field contamination issue found.
 * 
 * Usage: node scripts/audit-extraction.js [pdf-path ...]
 * If no paths given, processes all PDFs in C:\Mambo\Catalogos\
 */

const fs = require('fs');
const path = require('path');

// Load modules
const TextSanitizer = require('../src/js/textSanitizer.js');
const CatalogValidator = require('../src/js/catalogValidator.js');

// Color regex (no /g to avoid lastIndex issues in audit)
const COLOR_RE = /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|matte|glossy|negro|blanco|rosa|azul|rojo|verde|violeta|gris|plateado|dorado|naranja|marron|amarillo)\b/i;
const CATEGORY_RE = /\b(mouse|raton|keyboard|teclado|headset|auricular|earphone|earbuds|controller|gamepad|joystick|mousepad|switch|webcam|camera|camara|numpad|chair|silla|monitor|speaker|parlante|microphone|microfono)\b/i;
const PRICE_RE = /\$?\d{1,4}[.,]\d{2}\b/;
const CONNECTION_RE = /\b(wired|wireless|bluetooth|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\b/i;
const GARBAGE_MODELS = /^(item|producto|product|\.|-|n\/a|undefined|null|none|white|black|pink|blue|red|green|purple|grey|gray|silver|gold|dark|light)$/i;

const KNOWN_BRANDS = ['REDRAGON','LOGITECH','RAZER','HYPERX','CORSAIR','AULA','AJAZZ','MACHENIKE','8BITDO','ATTACK SHARK','VGN','VXE','FLYDIGI','DARMOSHARK','LAMZU','WLMOUSE','KEYCHRON','VSG','KZ','HAIMU','POLAROID','GAMESIR','MADLIONS','ATK','IROK','MCHOSE','ROYAL KLUDGE','RK'];

function auditProduct(item, idx, source) {
  const issues = [];
  const modelo = (item.modelo || '').trim();
  const variante = (item.variante || '').trim();
  const marca = (item.marca || '').trim();
  const cat = (item.cat || '').trim().toUpperCase();
  const fob = parseFloat(item.fob) || 0;

  // 1. Color as modelo (entire modelo is a color)
  if (modelo && GARBAGE_MODELS.test(modelo)) {
    issues.push({ type: 'COLOR_OR_GARBAGE_AS_MODEL', modelo, variante, marca, detail: `Modelo es color/basura: "${modelo}"` });
  }

  // 2. Color word inside modelo
  if (modelo && COLOR_RE.test(modelo) && !GARBAGE_MODELS.test(modelo)) {
    const m = modelo.match(COLOR_RE);
    issues.push({ type: 'COLOR_IN_MODEL', modelo, variante, marca, detail: `Color "${m[0]}" en modelo` });
  }

  // 3. Brand in modelo
  if (modelo && marca && marca !== 'OTRO') {
    if (modelo.toUpperCase().includes(marca.toUpperCase())) {
      issues.push({ type: 'BRAND_IN_MODEL', modelo, variante, marca, detail: `Marca "${marca}" en modelo` });
    }
  }

  // 4. Category word in modelo
  if (modelo && CATEGORY_RE.test(modelo)) {
    const m = modelo.match(CATEGORY_RE);
    issues.push({ type: 'CATEGORY_IN_MODEL', modelo, variante, marca, detail: `"${m[0]}" en modelo` });
  }

  // 5. Connection word in modelo
  if (modelo && CONNECTION_RE.test(modelo)) {
    const m = modelo.match(CONNECTION_RE);
    issues.push({ type: 'CONNECTION_IN_MODEL', modelo, variante, marca, detail: `"${m[0]}" en modelo` });
  }

  // 6. Price in modelo
  if (modelo && PRICE_RE.test(modelo)) {
    issues.push({ type: 'PRICE_IN_MODEL', modelo, variante, marca, detail: 'Precio en modelo' });
  }

  // 7. No brand
  if (!marca || marca === 'OTRO') {
    issues.push({ type: 'NO_BRAND', modelo, variante, marca, detail: 'Sin marca' });
  }

  // 8. No category
  if (!cat || cat === 'OTRO') {
    issues.push({ type: 'NO_CATEGORY', modelo, variante, marca, detail: 'Sin categoría' });
  }

  // 9. Invalid FOB
  if (!Number.isFinite(fob) || fob <= 0) {
    issues.push({ type: 'INVALID_FOB', modelo, variante, marca, detail: `FOB: ${fob}` });
  }

  // 10. Empty modelo
  if (!modelo || modelo.length < 2) {
    issues.push({ type: 'EMPTY_MODEL', modelo, variante, marca, detail: 'Modelo vacío' });
  }

  // 11. Modelo too long
  if (modelo && modelo.length > 60) {
    issues.push({ type: 'LONG_MODEL', modelo, variante, marca, detail: `${modelo.length} chars` });
  }

  // 12. Description in variante (too long or contains category words)
  if (variante && variante.length > 40) {
    issues.push({ type: 'LONG_VARIANT', modelo, variante, marca, detail: `Variante ${variante.length} chars: "${variante.substring(0, 50)}"` });
  }

  return issues.map(i => ({ ...i, idx, source, cat, fob, status: item.status || 'UNKNOWN' }));
}

// Try to load pdfjs-dist
let pdfjs;
try {
  pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e) {
  try {
    pdfjs = require('pdfjs-dist');
  } catch (e2) {
    console.error('❌ pdfjs-dist not available. Run: npm install pdfjs-dist');
    process.exit(1);
  }
}

async function extractTextFromPdf(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push({ pageNum: i, text, items: content.items });
  }
  return pages;
}

function simulateExtraction(pages) {
  // Simple line-based extraction to simulate what the parser does
  const products = [];
  for (const page of pages) {
    const lines = page.text.split(/\n+/);
    for (const line of lines) {
      const priceMatch = line.match(/\$?\s*(\d+[\.,]\d{1,2})\b/);
      if (!priceMatch) continue;
      const fob = parseFloat(priceMatch[1].replace(',', '.'));
      if (fob <= 0 || fob > 9999) continue;

      const cleanLine = line.replace(priceMatch[0], '').replace(/\s+/g, ' ').trim();
      if (cleanLine.length < 3) continue;

      // Detect brand
      let marca = 'OTRO';
      const upper = cleanLine.toUpperCase();
      for (const b of KNOWN_BRANDS) {
        if (upper.includes(b)) { marca = b; break; }
      }

      // Simple model extraction (what the parser roughly does)
      let modelo = cleanLine;
      if (marca !== 'OTRO') {
        modelo = cleanLine.replace(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
      }

      products.push({ modelo, variante: '', marca, cat: 'OTRO', fob, _rawLine: cleanLine });
    }
  }
  return products;
}

async function main() {
  let pdfPaths = process.argv.slice(2);
  if (pdfPaths.length === 0) {
    const catalogDir = 'C:\\Mambo\\Catalogos';
    if (fs.existsSync(catalogDir)) {
      pdfPaths = fs.readdirSync(catalogDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => path.join(catalogDir, f));
    }
  }

  if (pdfPaths.length === 0) {
    console.error('No PDFs found. Usage: node scripts/audit-extraction.js [pdf-path ...]');
    process.exit(1);
  }

  console.log(`📂 Auditing ${pdfPaths.length} PDFs...\n`);

  const allIssues = [];
  const allProducts = [];
  const perFileStats = [];

  for (const pdfPath of pdfPaths) {
    const name = path.basename(pdfPath);
    try {
      const pages = await extractTextFromPdf(pdfPath);
      const rawProducts = simulateExtraction(pages);
      
      // Run through TextSanitizer
      const sanitized = rawProducts.map(p => TextSanitizer.sanitizeItem(p));
      
      // Audit each
      let fileIssues = [];
      for (let i = 0; i < sanitized.length; i++) {
        const issues = auditProduct(sanitized[i], i, name);
        fileIssues.push(...issues);
      }

      const clean = sanitized.length - new Set(fileIssues.map(i => i.idx)).size;
      perFileStats.push({
        file: name,
        products: sanitized.length,
        clean,
        issues: fileIssues.length,
        cleanPct: sanitized.length > 0 ? Math.round((clean / sanitized.length) * 100) : 0
      });

      allIssues.push(...fileIssues);
      allProducts.push(...sanitized.map((p, i) => ({ ...p, _source: name, _idx: i })));

      console.log(`  📄 ${name.padEnd(45)} ${String(sanitized.length).padStart(4)} products · ${String(clean).padStart(4)} clean (${perFileStats[perFileStats.length-1].cleanPct}%) · ${fileIssues.length} issues`);
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
    }
  }

  // Aggregate stats
  const totalProducts = allProducts.length;
  const totalClean = totalProducts - new Set(allIssues.map(i => `${i.source}-${i.idx}`)).size;
  const byType = {};
  for (const issue of allIssues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }
  const topIssues = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  AUDITORÍA DE EXTRACCIÓN — ${totalProducts} productos de ${pdfPaths.length} PDFs`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  ✅ Limpios: ${totalClean} (${Math.round((totalClean/Math.max(1,totalProducts))*100)}%)`);
  console.log(`  ⚠️  Issues:  ${allIssues.length}`);
  console.log(`───────────────────────────────────────────────────────────`);
  console.log(`  TOP ISSUE TYPES:`);
  for (const [type, count] of topIssues.slice(0, 15)) {
    console.log(`    ${type.padEnd(30)} ${String(count).padStart(4)} (${Math.round((count/totalProducts)*100)}%)`);
  }

  // Show samples per issue type
  console.log(`\n  EJEMPLOS POR TIPO:`);
  console.log(`  ─────────────────────────────────────────────────────────`);
  const shown = new Set();
  for (const [type] of topIssues.slice(0, 8)) {
    const examples = allIssues.filter(i => i.type === type).slice(0, 5);
    console.log(`\n  [${type}] (${byType[type]} total)`);
    for (const ex of examples) {
      const key = `${ex.source}-${ex.modelo}`;
      if (shown.has(key)) continue;
      shown.add(key);
      console.log(`    ${ex.source.substring(0, 20).padEnd(20)} | marca="${ex.marca}" modelo="${(ex.modelo || '').substring(0, 30)}" var="${(ex.variante || '').substring(0, 20)}" | ${ex.detail}`);
    }
  }

  // Write full report
  const report = {
    generatedAt: new Date().toISOString(),
    totalProducts,
    totalClean,
    totalIssues: allIssues.length,
    perFileStats,
    topIssues: topIssues.map(([type, count]) => ({ type, count })),
    allIssues
  };
  fs.writeFileSync('extraction-audit-report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Reporte completo: extraction-audit-report.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
