/**
 * export-catalog-batch.js — Reprocess the real vendor PDFs in Node and export
 * the full catalog JSON (including image assignment) for the quality loop.
 *
 * Usage:
 *   node scripts/export-catalog-batch.js [output.json]
 *
 * Mirrors app.processPdfFile: per-page grid extraction + image extraction
 * (canvas 2D shim with a minimal PNG encoder) + finalize + inheritance.
 * Writes the exported catalog to output.json (default: catalog-export.json).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CATALOG_DIR = 'C:\\Mambo\\Catalogos';
const OUTPUT = process.argv[2] || 'catalog-export.json';

/* ------------------------------------------------------------------ *
 * Minimal PNG encoder (RGBA) + canvas 2D shim for Node
 * ------------------------------------------------------------------ */
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // compression 0, filter 0, interlace 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

class Canvas2D {
  constructor(width, height) {
    this.width = width || 300;
    this.height = height || 150;
    this._data = new Uint8ClampedArray(this.width * this.height * 4);
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = 'high';
  }

  getContext() { return this; }

  createImageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }

  putImageData(imgData, dx, dy) {
    const w = imgData.width, h = imgData.height;
    for (let y = 0; y < h && dy + y < this.height; y++) {
      for (let x = 0; x < w && dx + x < this.width; x++) {
        const src = (y * w + x) * 4;
        const dst = ((dy + y) * this.width + (dx + x)) * 4;
        this._data[dst] = imgData.data[src];
        this._data[dst + 1] = imgData.data[src + 1];
        this._data[dst + 2] = imgData.data[src + 2];
        this._data[dst + 3] = imgData.data[src + 3];
      }
    }
  }

  drawImage(src, sx, sy, sw, sh) {
    // Resize path: drawImage(canvas, 0, 0, outW, outH)
    if (typeof sw === 'number' && typeof sh === 'number' && src instanceof Canvas2D) {
      const outW = sw, outH = sh;
      const srcData = src._data;
      const srcW = src.width, srcH = src.height;
      const out = new Uint8ClampedArray(outW * outH * 4);
      for (let y = 0; y < outH; y++) {
        const srcY = Math.min(srcH - 1, Math.floor((y / outH) * srcH));
        for (let x = 0; x < outW; x++) {
          const srcX = Math.min(srcW - 1, Math.floor((x / outW) * srcW));
          const s = (srcY * srcW + srcX) * 4;
          const d = (y * outW + x) * 4;
          out[d] = srcData[s]; out[d + 1] = srcData[s + 1];
          out[d + 2] = srcData[s + 2]; out[d + 3] = srcData[s + 3];
        }
      }
      this.width = outW;
      this.height = outH;
      this._data = out;
      return;
    }
    // drawImage(bitmap) fallback: no-op (bitmap is null in Node)
  }

  getImageData(x, y, w, h) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const s = ((y + j) * this.width + (x + i)) * 4;
        const d = (j * w + i) * 4;
        data[d] = this._data[s]; data[d + 1] = this._data[s + 1];
        data[d + 2] = this._data[s + 2]; data[d + 3] = this._data[s + 3];
      }
    }
    return { width: w, height: h, data };
  }

  toDataURL(format, quality) {
    const png = encodePNG(this.width, this.height, Buffer.from(this._data.buffer, this._data.byteOffset, this._data.byteLength));
    return `data:image/png;base64,${png.toString('base64')}`;
  }
}

/* ------------------------------------------------------------------ *
 * Environment mocks (mirrors run-tests.js / test-catalog-batch.js)
 * ------------------------------------------------------------------ */
global.window = global;
global.navigator = {};
global.Image = class {};
global.localStorage = {
  values: new Map(),
  getItem(k) { return this.values.has(k) ? this.values.get(k) : null; },
  setItem(k, v) { this.values.set(k, v); },
  removeItem(k) { this.values.delete(k); },
};
global.document = {
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
  getElementById() { return null; },
  createElement(tag) {
    if (tag === 'canvas') return new Canvas2D(300, 150);
    return { style: {}, click() {}, setAttribute() {}, appendChild() {}, getContext() { return null; } };
  },
  body: { appendChild() {}, removeChild() {} },
};
global.Papa = { parse() {} };
global.XLSX = {
  utils: {
    aoa_to_sheet(d) { return { data: d }; },
    book_new() { return { SheetNames: [], Sheets: {} }; },
    book_append_sheet(wb, s, n) { wb.SheetNames.push(n); wb.Sheets[n] = s; },
    sheet_to_json() { return []; },
    sheet_to_csv() { return ''; },
  },
  writeFile() {},
};
global.TransformersAI = null;
global.toast = () => {};
global.SkuAllocator = null; // will be set after require

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
require('../src/js/textSanitizer.js');
require('../src/js/skuAllocator.js');
const CatalogValidator = require('../src/js/catalogValidator.js');
global.CatalogValidator = CatalogValidator;
const PdfParser = require('../src/js/pdfParser.js');

// Instrumentation: count extracted images per page without touching the parser
const imageStats = [];
let currentFile = '';
const origExtractImages = PdfParser.extractImagesFromPage.bind(PdfParser);
PdfParser.extractImagesFromPage = async function (page, viewport, pageNum) {
  const imgs = await origExtractImages(page, viewport, pageNum);
  imageStats.push({
    file: currentFile,
    page: pageNum,
    nImgs: imgs.length,
    imgs: imgs.map(i => ({ x: Math.round(i.x), y: Math.round(i.y), w: i.width, h: i.height, aspect: Number((i.width / Math.max(1, i.height)).toFixed(2)) })),
  });
  return imgs;
};

/* ------------------------------------------------------------------ *
 * Batch run
 * ------------------------------------------------------------------ */
(async () => {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`❌ La carpeta ${CATALOG_DIR} no existe`);
    process.exit(1);
  }
  const files = fs.readdirSync(CATALOG_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .filter(f => !process.env.CATALOG_FILTER || f.includes(process.env.CATALOG_FILTER));
  console.log(`🔍 Reprocesando ${files.length} catálogos en ${CATALOG_DIR}...\n`);

  const allExported = [];
  const perFile = [];
  const pageStats = [];

  for (const fileName of files) {
    currentFile = fileName;
    const filePath = path.join(CATALOG_DIR, fileName);
    const buffer = fs.readFileSync(filePath);
    const file = {
      name: fileName,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
    try {
      const { brand, products } = await PdfParser.processPdfFile(file, 0, [], () => {});
      // Page-level stats: images available vs products left without one
      const byPage = new Map();
      for (const p of products) {
        const key = String(p.pageNum || 0);
        if (!byPage.has(key)) byPage.set(key, { page: p.pageNum || 0, prods: 0, noImg: 0 });
        byPage.get(key).prods += 1;
        if (!p.img || p.img === '-') byPage.get(key).noImg += 1;
      }
      for (const [page, stats] of byPage) {
        pageStats.push({ file: fileName, page: Number(page), ...stats });
      }
      const exported = products.map(p => ({
        sku: p.sku, cat: p.cat, marca: p.marca, modelo: p.modelo, variante: p.variante,
        fob: p.fob, img: p.img || '-', status: p.status,
        warnings: p.warnings || [], confidence: p.confidence, grounded: !!p.grounded,
        sourceFile: fileName, qualityReason: p.qualityReason || 'Sin observaciones',
        pageNum: p.pageNum, x: p.x, y: p.y,
        imgWarnings: Array.isArray(p.imgWarnings) ? p.imgWarnings : undefined,
        sourceStatus: p.sourceStatus,
      }));
      allExported.push(...exported);
      perFile.push({ file: fileName, brand, count: exported.length, placeholders: exported.filter(p => p.img === '-').length });
      console.log(`📄 [${fileName}] → ${brand} | ${exported.length} productos | ${perFile[perFile.length - 1].placeholders} sin imagen`);
    } catch (err) {
      console.error(`❌ Error procesando ${fileName}:`, err.message);
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(allExported, null, 2), 'utf-8');
  const diagFile = OUTPUT.replace(/\.json$/i, '-diag.json');
  fs.writeFileSync(diagFile, JSON.stringify({ pageStats, imageStats }, null, 2), 'utf-8');
  console.log(`\n✅ Export: ${allExported.length} productos → ${OUTPUT}`);
  console.log(`📊 Diagnóstico por página → ${diagFile}`);
  console.log('Por catálogo:', perFile.map(f => `${f.file.split(' ')[0]}:${f.count}`).join(' '));
})().catch(err => { console.error(err); process.exit(1); });
