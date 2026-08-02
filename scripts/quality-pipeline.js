#!/usr/bin/env node
/**
 * Mambo Pedidos — Automated Validation Loop
 * 
 * Processes all 13 PDFs through extraction + sanitization + R1-R10 validation.
 * Reports GREEN/YELLOW/RED counts. Exit 0 = all GREEN.
 * 
 * Usage: node scripts/quality-pipeline.js [--verbose] [--pdf path]
 */

const fs = require('fs');
const path = require('path');
const TextSanitizer = require('../src/js/textSanitizer.js');
const CatalogValidator = require('../src/js/catalogValidator.js');

const VERBOSE = process.argv.includes('--verbose');
const PDF_FILTER = process.argv.find((a, i) => process.argv[i - 1] === '--pdf');
const CATALOG_DIR = 'C:\\Mambo\\Catalogos';

let pdfjs;
try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); }
catch { pdfjs = require('pdfjs-dist'); }

const KNOWN_BRANDS = [
  'REDRAGON','LOGITECH','RAZER','HYPERX','CORSAIR','AULA','AJAZZ',
  'MACHENIKE','8BITDO','ATTACK SHARK','VGN','VXE','FLYDIGI','DARMOSHARK',
  'LAMZU','WLMOUSE','KEYCHRON','VSG','KZ','HAIMU','POLAROID','GAMESIR',
  'MADLIONS','ATK','IROK','MCHOSE','ROYAL KLUDGE','RK','8BITDO','KEYBOARD_SWITCH'
];

const COLOR_RE = /\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent|dark|light|wukong|myth|faker|shadow|warrior|hunter|night|zenith|iceblade|primordial|wolf|fox|dream|whimsy|perilla|tea|flash)\b/i;
const CURRENCY_NOISE = /[￥¥元]\s*/g;
const GARBAGE_RE = /^(item|producto|product|\.|-|n\/a|undefined|null|none)$/i;

function brandFromFilename(filename) {
  const upper = filename.toUpperCase().replace(/[-_.]/g, ' ');
  for (const b of KNOWN_BRANDS) { if (upper.includes(b)) return b; }
  if (upper.includes('KEYBOARD SWITCH')) return 'KEYBOARD_SWITCH';
  if (upper.includes('迈从')) return 'MCHOSE';
  return null;
}

function findPriceAnchors(textItems) {
  const anchors = [];
  for (const item of textItems) {
    const txt = item.str.trim();
    const m = txt.match(/^\$?\s*(\d+[\.,]\d{1,2})$/);
    if (m) {
      const price = parseFloat(m[1].replace(',', '.'));
      if (price > 0 && price < 9999) {
        anchors.push({ x: item.transform[4], y: item.transform[5], price });
      }
    }
  }
  return anchors;
}

function extractTableRows(textItems, priceAnchors) {
  if (!priceAnchors.length) return [];

  // Deduplicate: keep only the rightmost price per Y-row (USD column)
  // RMB prices are at lower X, USD at higher X
  priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
  const deduped = [];
  for (const anchor of priceAnchors) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.y - anchor.y) < 10) {
      // Same row — keep the rightmost (higher X = USD)
      if (anchor.x > last.x) deduped[deduped.length - 1] = anchor;
    } else {
      deduped.push(anchor);
    }
  }
  priceAnchors = deduped;

  const priceColX = priceAnchors.reduce((s, a) => s + a.x, 0) / priceAnchors.length;
  const products = [];
  let lastModel = '';
  priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);

  const rowBounds = [];
  for (let i = 0; i < priceAnchors.length; i++) {
    const top = i === 0 ? priceAnchors[i].y + 80 : (priceAnchors[i].y + priceAnchors[i - 1].y) / 2;
    const bottom = i === priceAnchors.length - 1 ? priceAnchors[i].y - 80 : (priceAnchors[i].y + priceAnchors[i + 1].y) / 2;
    rowBounds.push({ top, bottom, anchor: priceAnchors[i] });
  }

  for (const row of rowBounds) {
    const { top, bottom, anchor } = row;
    const rowItems = textItems.filter(item => {
      const y = item.transform[5], x = item.transform[4], txt = item.str.trim();
      if (!txt || y > top || y < bottom || x >= priceColX * 0.85) return false;
      if (/^[￥¥$€£]/.test(txt) || /^\d+[\.,]?\d*$/.test(txt)) return false;
      return true;
    });

    const nameParts = [], colorParts = [], typeParts = [];
    for (const item of rowItems) {
      const txt = item.str.trim();
      const x = item.transform[4];
      const relX = priceColX > 0 ? x / priceColX : 0.5;
      const isColor = COLOR_RE.test(txt);
      const isConn = /\b(bluetooth|wired|wireless|2\.4g|tri[\s-]?mode|usb[\s-]?c|rgb)\b/i.test(txt);
      if (isColor) colorParts.push(txt);
      else if (isConn) typeParts.push(txt);
      else if (relX < 0.45) nameParts.push(txt);
      else if (txt.length <= 15 && !/\s/.test(txt)) typeParts.push(txt);
      else nameParts.push(txt);
    }

    let rawModelo = nameParts.join(' ').replace(CURRENCY_NOISE, '').replace(/\s+/g, ' ').trim();
    let rawVariante = [...typeParts, ...colorParts].join(' ').replace(/\s+/g, ' ').trim();

    // Header noise filter: skip rows where modelo is table header text
    const HEADER_NOISE = /\b(USD|PRICE|RMB|CNY|MODEL|COLOR|NO\.|SKU|EAN|BARCODE|PRODUCT|ITEM|QTY|QUANTITY|MATERIAL|AXLE|CORE|BOTTOMING)\b|型号|颜色|价格|产品|数量/i;
    if (HEADER_NOISE.test(rawModelo)) continue;

    if (!rawModelo && lastModel) rawModelo = lastModel;
    else if (!rawModelo && rawVariante) { rawModelo = rawVariante; rawVariante = ''; }
    if (!rawModelo) continue;

    const combined = rawModelo + ' ' + rawVariante;
    let marca = 'OTRO';
    const upper = combined.toUpperCase();
    for (const b of KNOWN_BRANDS) { if (upper.includes(b)) { marca = b; break; } }
    if (marca !== 'OTRO') {
      rawModelo = rawModelo.replace(new RegExp('\\b' + marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '').replace(/\s+/g, ' ').trim();
    }

    if (rawModelo && rawModelo.length > 2 && !GARBAGE_RE.test(rawModelo)) lastModel = rawModelo;

    products.push({ sku: 'TMP-' + products.length, marca, modelo: rawModelo, variante: rawVariante, cat: 'OTRO', fob: anchor.price, img: '-', grounded: true });
  }
  return products;
}

async function main() {
  let pdfPaths;
  if (PDF_FILTER) pdfPaths = [PDF_FILTER];
  else {
    pdfPaths = fs.readdirSync(CATALOG_DIR).filter(f => f.endsWith('.pdf')).map(f => path.join(CATALOG_DIR, f));
  }

  console.log(`\n🔬 MAMBO VALIDATION LOOP — ${pdfPaths.length} PDFs\n`);
  console.log('═'.repeat(70));

  let allProducts = [];
  const perFile = [];

  for (const pdfPath of pdfPaths) {
    const name = path.basename(pdfPath);
    const fileBrand = brandFromFilename(name);
    try {
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
      let fileProducts = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const anchors = findPriceAnchors(content.items);
        if (!anchors.length) continue;
        const products = extractTableRows(content.items, anchors);
        if (fileBrand) products.forEach(prod => { if (!prod.marca || prod.marca === 'OTRO') prod.marca = fileBrand; });
        products.forEach(prod => {
          const sanitized = TextSanitizer.sanitizeItem(prod, []);
          if (sanitized) fileProducts.push(sanitized);
        });
      }

      // Run R1-R10 validation
      CatalogValidator.runFullValidation(fileProducts);

      const green = fileProducts.filter(p => p.status === 'GREEN').length;
      const yellow = fileProducts.filter(p => p.status === 'YELLOW').length;
      const red = fileProducts.filter(p => p.status === 'RED').length;
      const allGreen = yellow === 0 && red === 0;

      perFile.push({ name, total: fileProducts.length, green, yellow, red, allGreen });
      allProducts.push(...fileProducts);

      const icon = allGreen ? '🟢' : red > 0 ? '🔴' : '🟡';
      console.log(`  ${icon} ${name.padEnd(42)} ${String(fileProducts.length).padStart(4)} prod · G=${green} Y=${yellow} R=${red}`);

      if (VERBOSE && !allGreen) {
        const yellowItems = fileProducts.filter(p => p.status === 'YELLOW').slice(0, 3);
        for (const item of yellowItems) {
          const reasons = (item.warnings || []).slice(0, 2).join('; ');
          console.log(`      Y: marca="${item.marca}" modelo="${(item.modelo || '').substring(0, 30)}" → ${reasons}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ ${name.padEnd(42)} ERROR: ${err.message}`);
    }
  }

  // Global stats
  const totalGreen = allProducts.filter(p => p.status === 'GREEN').length;
  const totalYellow = allProducts.filter(p => p.status === 'YELLOW').length;
  const totalRed = allProducts.filter(p => p.status === 'RED').length;
  const totalAll = allProducts.length;
  const greenPct = Math.round((totalGreen / Math.max(1, totalAll)) * 100);

  console.log('\n' + '═'.repeat(70));
  console.log(`\n  📊 RESULTADO GLOBAL: ${totalAll} productos`);
  console.log(`  🟢 GREEN:  ${totalGreen} (${greenPct}%)`);
  console.log(`  🟡 YELLOW: ${totalYellow} (${Math.round((totalYellow / Math.max(1, totalAll)) * 100)}%)`);
  console.log(`  🔴 RED:    ${totalRed} (${Math.round((totalRed / Math.max(1, totalAll)) * 100)}%)`);

  // Show top YELLOW reasons
  if (totalYellow > 0) {
    const reasonCounts = {};
    for (const p of allProducts.filter(p => p.status === 'YELLOW')) {
      for (const w of (p.warnings || [])) {
        const short = w.substring(0, 60);
        reasonCounts[short] = (reasonCounts[short] || 0) + 1;
      }
    }
    const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`\n  TOP RAZONES YELLOW:`);
    for (const [reason, count] of topReasons) {
      console.log(`    ${String(count).padStart(4)} | ${reason}`);
    }
  }

  // Show RED samples
  if (totalRed > 0) {
    console.log(`\n  EJEMPLOS RED:`);
    for (const p of allProducts.filter(p => p.status === 'RED').slice(0, 5)) {
      const reasons = (p.warnings || []).join('; ');
      console.log(`    marca="${p.marca}" modelo="${(p.modelo || '').substring(0, 30)}" cat=${p.cat} fob=${p.fob} → ${reasons}`);
    }
  }

  console.log('\n' + '═'.repeat(70));

  // Per-file summary
  console.log(`\n  RESUMEN POR ARCHIVO:`);
  for (const f of perFile.sort((a, b) => (a.allGreen ? 1 : 0) - (b.allGreen ? 1 : 0) || a.green - b.green)) {
    const icon = f.allGreen ? '🟢' : f.red > 0 ? '🔴' : '🟡';
    console.log(`  ${icon} ${f.name.padEnd(42)} G=${String(f.green).padStart(4)} Y=${String(f.yellow).padStart(3)} R=${String(f.red).padStart(2)}`);
  }

  const allGreenGlobal = totalYellow === 0 && totalRed === 0;
  console.log(`\n  ${allGreenGlobal ? '✅ ALL GREEN — PASS' : '❌ FAIL — ' + (totalYellow + totalRed) + ' productos no GREEN'}\n`);

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    total: totalAll, green: totalGreen, yellow: totalYellow, red: totalRed,
    greenPct, allGreen: allGreenGlobal,
    perFile: perFile.map(f => ({ name: f.name, ...f }))
  };
  fs.writeFileSync('quality-report.json', JSON.stringify(report, null, 2), 'utf-8');

  process.exit(allGreenGlobal ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(2); });
