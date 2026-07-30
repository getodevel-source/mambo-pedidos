/**
 * Geometry diagnostic: dumps raw spatial data from catalog PDFs
 * to understand actual layout before fixing the cell grid engine.
 *
 * Usage: node scripts/test-geometry-dump.js
 */

const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const CATALOG_DIR = path.resolve(__dirname, '..', '..', 'Catalogos');

// Pick 3 diverse catalogs
const TARGETS = [
  '8BitDo-2026 .pdf',
  'ATK Price list 2607.pdf',
  'Razer Catalogue-2026.pdf'
];

const MAX_PAGES = 2; // first 2 pages per catalog

async function dumpPageGeometry(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });

  console.log(`\n  --- Page ${pageNum} (${Math.round(viewport.width)}x${Math.round(viewport.height)} pts) ---`);

  // Map all text items to spatial coords
  const items = content.items
    .filter(item => item.str && item.str.trim())
    .map(item => ({
      x: Math.round(item.transform[4] * 10) / 10,
      y: Math.round((viewport.height - item.transform[5]) * 10) / 10,
      w: Math.round(item.width * 10) / 10,
      text: item.str.trim(),
      font: item.fontName || '?'
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // Group into visual rows (items within 6pts Y)
  const rows = [];
  let curRow = [items[0]];
  let curY = items[0]?.y ?? 0;

  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].y - curY) <= 6) {
      curRow.push(items[i]);
    } else {
      rows.push({ y: curY, items: curRow });
      curRow = [items[i]];
      curY = items[i].y;
    }
  }
  if (curRow.length) rows.push({ y: curY, items: curRow });

  // Detect price anchors
  const USD_RE = /(?<![¥￥\d])\$\s*(\d{1,4}(?:\.\d{1,2})?)/;
  const CNY_RE = /(?:¥|￥)\s*([\d,]+\.?\d*)/;
  const BARE_NUM_RE = /^[\d,]+\.\d{2}$/;

  let usdCount = 0, cnyCount = 0, bareNumCount = 0;

  console.log(`  Total text items: ${items.length} | Visual rows: ${rows.length}\n`);

  for (const row of rows) {
    const rowText = row.items.map(i => i.text).join(' | ');
    const hasUsd = row.items.some(i => USD_RE.test(i.text));
    const hasCny = row.items.some(i => CNY_RE.test(i.text));
    const hasBareNum = row.items.some(i => BARE_NUM_RE.test(i.text));

    if (hasUsd) usdCount++;
    if (hasCny) cnyCount++;
    if (hasBareNum) bareNumCount++;

    // Tag the row type
    let tag = '';
    if (hasUsd) tag += '[$USD]';
    if (hasCny) tag += '[¥CNY]';
    if (hasBareNum) tag += '[BARE#]';
    if (/[\u4e00-\u9fff]/.test(rowText)) tag += '[中文]';

    // Print row with coords
    const yStr = String(row.y).padStart(7);
    const coords = row.items.map(i => `[${i.x},${i.y}] "${i.text}"`).join('  ');
    console.log(`  Y=${yStr} ${tag}`);
    console.log(`          ${coords}`);
  }

  console.log(`\n  Price summary: $USD rows=${usdCount} | ¥CNY rows=${cnyCount} | bare-number rows=${bareNumCount}`);

  // Also dump image positions
  try {
    const ops = await page.getOperatorList();
    let imgCount = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === 85) { // OPS.paintImageXObject
        imgCount++;
        // Walk backwards to find transform
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (ops.fnArray[j] === 12) { // OPS.transform
            const args = ops.argsArray[j];
            const imgX = args[4];
            const imgY = viewport.height - args[5];
            const imgW = args[0];
            const imgH = args[3];
            console.log(`  🖼  Image #${imgCount}: x=${Math.round(imgX)}, y=${Math.round(imgY)}, ${Math.round(imgW)}x${Math.round(imgH)} pts`);
            break;
          }
        }
      }
    }
    if (imgCount === 0) console.log('  🖼  No images detected on this page');
  } catch (e) {
    console.log(`  🖼  Image extraction error: ${e.message}`);
  }
}

async function main() {
  for (const filename of TARGETS) {
    const filePath = path.join(CATALOG_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ File not found: ${filename}`);
      continue;
    }

    console.log(`\n${'='.repeat(90)}`);
    console.log(`📄 ${filename}`);
    console.log('='.repeat(90));

    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

    console.log(`  Total pages: ${pdf.numPages}`);

    for (let p = 1; p <= Math.min(MAX_PAGES, pdf.numPages); p++) {
      await dumpPageGeometry(pdf, p);
    }

    await pdf.destroy();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
