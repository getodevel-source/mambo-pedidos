// scratch: golden + perfil por PDF (NO se commitea)
// v1: tiempos + hash de productos + conteo de imágenes y su dimensión mínima
const { JSDOM } = require('jsdom');
const { createCanvas } = require('canvas');
const dom = new JSDOM('', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.Image = dom.window.Image;
global.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
global.TextSanitizer = require('../src/js/textSanitizer.js');
global.CatalogValidator = require('../src/js/catalogValidator.js');
global.SkuAllocator = require('../src/js/skuAllocator.js');
global.toast = () => {};
const PdfParser = require('../src/js/pdfParser.js');
const fs = require('fs'); const path = require('path');
const crypto = require('crypto');
function makeFile(p) {
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { name: path.basename(p), arrayBuffer: async () => ab };
}
(async () => {
  const dir = process.env.MAMBO_CATALOG_DIR;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).sort();
  const t0 = Date.now();
  let totalProds = 0, hash = '';
  let totalImgs = 0, smallImgs = 0, minDimSum = 0;
  for (const f of files) {
    const res = await PdfParser.processPdfFile(makeFile(path.join(dir, f)), 0, [], null);
    const prods = res.products || [];
    totalProds += prods.length;
    hash += crypto.createHash('sha1').update(JSON.stringify(prods.map(p => [p.sku || '', p.modelo, p.variante, p.fob, p.marca]))).digest('hex').slice(0, 10);
    const imgs = res.images || res.allImages || res.pageImages || [];
    for (const im of imgs) {
      const w = im && (im.width || im.naturalWidth || (im.img && im.img.width));
      const h = im && (im.height || im.naturalHeight || (im.img && im.img.height));
      const d = Math.min(Number(w) || 0, Number(h) || 0);
      if (d > 0) { totalImgs++; minDimSum += d; if (d <= 150) smallImgs++; }
    }
  }
  const elapsed = Date.now() - t0;
  console.log('hashGlobal=' + hash);
  console.log('TOTAL ' + elapsed + 'ms | prods=' + totalProds + ' | imgs=' + totalImgs +
    ' | <=150px=' + smallImgs + ' | avgMinDim=' + (totalImgs ? Math.round(minDimSum / totalImgs) : 0));
})().catch(e => { console.error(e); process.exit(1); });