/**
 * Test harness: runs PdfParser cell grid extraction on all catalog PDFs
 * and reports quality metrics per file.
 *
 * Usage: node scripts/test-spatial-import.js
 */

const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Provide browser-like globals that pdfParser.js expects
global.pdfjsLib = pdfjsLib;

const PdfParser = require('../src/js/pdfParser.js');

const CATALOG_DIR = path.resolve(__dirname, '..', '..', 'Catalogos');

async function extractWithCellGrid(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const filename = path.basename(filePath);

  // Detect brand from filename (same as processPdfFile does)
  const filenameBrand = PdfParser.detectBrandFromFilename(filename, []) || '';

  const allProducts = [];
  const pagesWithProducts = [];
  const pagesEmpty = [];
  let fullTextForBrand = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    if (pageNum <= 3) {
      fullTextForBrand += content.items.map(item => item.str).join(' ') + ' ';
    }

    const currentBrand = PdfParser.detectBrandFromContent(fullTextForBrand, []) || filenameBrand;

    // No images in Node.js test (canvas unavailable) — pass empty array
    const pageProducts = PdfParser.extractPageProductsByCellGrid(
      content.items, viewport.height, pageNum, [], currentBrand, [], allProducts
    );

    if (pageProducts.length > 0) {
      pagesWithProducts.push(pageNum);
      allProducts.push(...pageProducts);
    } else {
      pagesEmpty.push(pageNum);
    }
  }

  await pdf.destroy();
  return { allProducts, pagesWithProducts, pagesEmpty, totalPages: pdf.numPages, brand: PdfParser.detectBrandFromContent(fullTextForBrand, []) || filenameBrand };
}

function analyzeQuality(products, filename) {
  const total = products.length;
  if (total === 0) return { total, issues: ['NO PRODUCTS EXTRACTED'] };

  const issues = [];
  let noModel = 0;
  let noPrice = 0;
  let noBrand = 0;
  let noCat = 0;
  let priceAsModel = 0;
  let tooShortModel = 0;

  for (const p of products) {
    if (!p.modelo || p.modelo.trim().length < 2 || p.modelo === 'Producto') noModel++;
    if (!p.fob || p.fob <= 0) noPrice++;
    if (!p.marca || p.marca === 'OTRO') noBrand++;
    if (!p.cat || p.cat === 'OTRO') noCat++;
    if (/^\$?\d+([.,]\d+)?$/.test(p.modelo)) priceAsModel++;
    if (p.modelo && p.modelo.trim().length <= 3 && !/^\$?\d/.test(p.modelo)) tooShortModel++;
  }

  if (noModel > 0) issues.push(`${noModel} products with missing/empty model`);
  if (noPrice > 0) issues.push(`${noPrice} products with no price`);
  if (noBrand > 0) issues.push(`${noBrand} products with brand=OTRO`);
  if (noCat > 0) issues.push(`${noCat} products with cat=OTRO`);
  if (priceAsModel > 0) issues.push(`${priceAsModel} products with price as model name`);
  if (tooShortModel > 0) issues.push(`${tooShortModel} products with suspiciously short model`);

  return { total, issues, noModel, noPrice, noBrand, noCat };
}

async function main() {
  const files = fs.readdirSync(CATALOG_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`\n📦 Testing ${files.length} catalogs from ${CATALOG_DIR}\n`);
  console.log('='.repeat(90));

  let grandTotal = 0;
  let grandIssues = 0;

  for (const file of files) {
    const filePath = path.join(CATALOG_DIR, file);
    process.stdout.write(`\n📄 ${file}\n`);

    try {
      const { allProducts, pagesWithProducts, pagesEmpty, totalPages, brand } = await extractWithCellGrid(filePath);
      const quality = analyzeQuality(allProducts, file);

      grandTotal += quality.total;
      grandIssues += quality.issues.length;

      console.log(`   Brand detected: ${brand || 'NONE'}`);
      console.log(`   Pages: ${totalPages} | With products: ${pagesWithProducts.length} | Empty: ${pagesEmpty.length}`);
      console.log(`   Products extracted: ${quality.total}`);

      if (quality.issues.length === 0) {
        console.log(`   ✅ No quality issues detected`);
      } else {
        for (const issue of quality.issues) {
          console.log(`   ⚠️  ${issue}`);
        }
      }

      // Show sample products (first 5)
      if (allProducts.length > 0) {
        console.log(`   Sample products:`);
        for (const p of allProducts.slice(0, 5)) {
          console.log(`      [${p.marca}] ${p.modelo} | ${p.variante || '-'} | $${p.fob} | ${p.cat}`);
        }
        if (allProducts.length > 5) {
          console.log(`      ... and ${allProducts.length - 5} more`);
        }
      }
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
      grandIssues++;
    }

    console.log('-'.repeat(90));
  }

  console.log(`\n📊 SUMMARY: ${grandTotal} total products from ${files.length} catalogs | ${grandIssues} quality flags\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
