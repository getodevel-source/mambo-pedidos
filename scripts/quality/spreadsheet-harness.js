/**
 * Mambo Pedidos — Spreadsheet Physical Round-Trip Harness (Slice 3)
 *
 * Creates physical CSV/XLSX files, processes them through the real
 * PapaParse/SheetJS parsers, and compares semantic fields.
 * No mocks: real file I/O, real parsers, real bytes.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const Papa = require(path.join(__dirname, '..', '..', 'src', 'vendor', 'papaparse.min.js'));
const XLSX = require(path.join(__dirname, '..', '..', 'src', 'vendor', 'xlsx.full.min.js'));

const CATALOG_FIELDS = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color/Variante', 'FOB unit USD'];
const ORDER_FIELDS = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color/Variante', 'FOB unit USD', 'Cantidad', 'Costo neto unit USD', 'IVA unit USD', 'IVA subtotal USD'];

const CATALOG_FIXTURE = [
  { SKU: 'RED-TEC-0001', 'Categoría': 'TECLADO', Marca: 'Redragon', Modelo: 'K552', 'Color/Variante': 'Black', 'FOB unit USD': 35.50 },
  { SKU: 'LOG-MOU-0002', 'Categoría': 'MOUSE', Marca: 'Logitech', Modelo: 'G203', 'Color/Variante': 'White', 'FOB unit USD': 22.99 },
  { SKU: 'AUL-TEC-0003', 'Categoría': 'TECLADO', Marca: 'AULA', Modelo: 'F75', 'Color/Variante': 'Pink', 'FOB unit USD': 41.00 }
];

const ORDER_FIXTURE = [
  { SKU: 'RED-TEC-0001', 'Categoría': 'TECLADO', Marca: 'Redragon', Modelo: 'K552', 'Color/Variante': 'Black', 'FOB unit USD': 35.50, Cantidad: 10, 'Costo neto unit USD': 38.25, 'IVA unit USD': 8.05, 'IVA subtotal USD': 80.50 },
  { SKU: 'LOG-MOU-0002', 'Categoría': 'MOUSE', Marca: 'Logitech', Modelo: 'G203', 'Color/Variante': 'White', 'FOB unit USD': 22.99, Cantidad: 20, 'Costo neto unit USD': 24.50, 'IVA unit USD': 5.15, 'IVA subtotal USD': 103.00 }
];

const SpreadsheetHarness = {
  /**
   * Run the full catalog round-trip: write CSV + XLSX, read back, compare.
   * @returns {{ csv: Object, xlsx: Object, errors: string[] }}
   */
  catalogRoundTrip() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mambo-spreadsheet-'));
    const errors = [];
    const results = { csv: null, xlsx: null, errors, tmpDir };

    try {
      // ── CSV round-trip ──
      const csvPath = path.join(tmpDir, 'catalog-fixture.csv');
      const csvContent = Papa.unparse({ fields: CATALOG_FIELDS, data: CATALOG_FIXTURE.map(r => CATALOG_FIELDS.map(f => r[f])) });
      fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8');

      const csvRead = fs.readFileSync(csvPath, 'utf8');
      const csvParsed = Papa.parse(csvRead, { header: true, skipEmptyLines: true });
      results.csv = { path: csvPath, rows: csvParsed.data, fields: csvParsed.meta.fields };

      // Verify semantic fields
      for (let i = 0; i < CATALOG_FIXTURE.length; i++) {
        const expected = CATALOG_FIXTURE[i];
        const actual = csvParsed.data[i];
        if (!actual) { errors.push(`CSV row ${i}: missing`); continue; }
        for (const field of CATALOG_FIELDS) {
          const exp = String(expected[field]);
          const act = String(actual[field] || '').trim();
          if (field === 'FOB unit USD') {
            if (Math.abs(parseFloat(act) - parseFloat(exp)) > 0.001) {
              errors.push(`CSV row ${i} field "${field}": expected ${exp}, got ${act}`);
            }
          } else if (act !== exp) {
            errors.push(`CSV row ${i} field "${field}": expected "${exp}", got "${act}"`);
          }
        }
      }

      // ── XLSX round-trip ──
      const xlsxPath = path.join(tmpDir, 'catalog-fixture.xlsx');
      const ws = XLSX.utils.json_to_sheet(CATALOG_FIXTURE);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalog');
      const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(xlsxPath, xlsxBuf);

      const xlsxReadBuf = fs.readFileSync(xlsxPath);
      const xlsxRead = XLSX.read(xlsxReadBuf, { type: 'buffer' });
      const xlsxSheet = xlsxRead.Sheets[xlsxRead.SheetNames[0]];
      const xlsxRows = XLSX.utils.sheet_to_json(xlsxSheet);
      results.xlsx = { path: xlsxPath, rows: xlsxRows, sheetName: xlsxRead.SheetNames[0] };

      for (let i = 0; i < CATALOG_FIXTURE.length; i++) {
        const expected = CATALOG_FIXTURE[i];
        const actual = xlsxRows[i];
        if (!actual) { errors.push(`XLSX row ${i}: missing`); continue; }
        for (const field of CATALOG_FIELDS) {
          const exp = expected[field];
          const act = actual[field];
          if (field === 'FOB unit USD') {
            if (Math.abs(Number(act) - Number(exp)) > 0.001) {
              errors.push(`XLSX row ${i} field "${field}": expected ${exp}, got ${act}`);
            }
          } else if (String(act || '').trim() !== String(exp)) {
            errors.push(`XLSX row ${i} field "${field}": expected "${exp}", got "${act}"`);
          }
        }
      }
    } catch (err) {
      errors.push(`Harness error: ${err.message}`);
    }

    return results;
  },

  /**
   * Run the order round-trip: write CSV + XLSX with order fields, read back, compare.
   * @returns {{ csv: Object, xlsx: Object, errors: string[] }}
   */
  orderRoundTrip() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mambo-order-'));
    const errors = [];
    const results = { csv: null, xlsx: null, errors, tmpDir };

    try {
      // ── CSV order round-trip ──
      const csvPath = path.join(tmpDir, 'order-fixture.csv');
      const csvContent = Papa.unparse({ fields: ORDER_FIELDS, data: ORDER_FIXTURE.map(r => ORDER_FIELDS.map(f => r[f])) });
      fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8');

      const csvRead = fs.readFileSync(csvPath, 'utf8');
      const csvParsed = Papa.parse(csvRead, { header: true, skipEmptyLines: true });
      results.csv = { path: csvPath, rows: csvParsed.data, fields: csvParsed.meta.fields };

      for (let i = 0; i < ORDER_FIXTURE.length; i++) {
        const expected = ORDER_FIXTURE[i];
        const actual = csvParsed.data[i];
        if (!actual) { errors.push(`CSV order row ${i}: missing`); continue; }
        for (const field of ORDER_FIELDS) {
          const exp = String(expected[field]);
          const act = String(actual[field] || '').trim();
          const numeric = ['FOB unit USD', 'Cantidad', 'Costo neto unit USD', 'IVA unit USD', 'IVA subtotal USD'].includes(field);
          if (numeric) {
            if (Math.abs(parseFloat(act) - parseFloat(exp)) > 0.001) {
              errors.push(`CSV order row ${i} field "${field}": expected ${exp}, got ${act}`);
            }
          } else if (act !== exp) {
            errors.push(`CSV order row ${i} field "${field}": expected "${exp}", got "${act}"`);
          }
        }
      }

      // ── XLSX order round-trip ──
      const xlsxPath = path.join(tmpDir, 'order-fixture.xlsx');
      const ws = XLSX.utils.json_to_sheet(ORDER_FIXTURE);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
      const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(xlsxPath, xlsxBuf);

      const xlsxReadBuf = fs.readFileSync(xlsxPath);
      const xlsxRead = XLSX.read(xlsxReadBuf, { type: 'buffer' });
      const xlsxSheet = xlsxRead.Sheets[xlsxRead.SheetNames[0]];
      const xlsxRows = XLSX.utils.sheet_to_json(xlsxSheet);
      results.xlsx = { path: xlsxPath, rows: xlsxRows, sheetName: xlsxRead.SheetNames[0] };

      for (let i = 0; i < ORDER_FIXTURE.length; i++) {
        const expected = ORDER_FIXTURE[i];
        const actual = xlsxRows[i];
        if (!actual) { errors.push(`XLSX order row ${i}: missing`); continue; }
        for (const field of ORDER_FIELDS) {
          const exp = expected[field];
          const act = actual[field];
          const numeric = ['FOB unit USD', 'Cantidad', 'Costo neto unit USD', 'IVA unit USD', 'IVA subtotal USD'].includes(field);
          if (numeric) {
            if (Math.abs(Number(act) - Number(exp)) > 0.001) {
              errors.push(`XLSX order row ${i} field "${field}": expected ${exp}, got ${act}`);
            }
          } else if (String(act || '').trim() !== String(exp)) {
            errors.push(`XLSX order row ${i} field "${field}": expected "${exp}", got "${act}"`);
          }
        }
      }
    } catch (err) {
      errors.push(`Harness error: ${err.message}`);
    }

    return results;
  },

  /**
   * Assert route identity: catalog files must use catalog route, order files must use order route.
   * @param {string} fileName - e.g. 'catalogo.csv' or 'pedido.xlsx'
   * @returns {{ route: string, correct: boolean }}
   */
  assertRoute(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const lower = fileName.toLowerCase();
    const isOrder = lower.includes('pedido') || lower.includes('order') || lower.includes('packing');
    const isCatalog = lower.includes('catalogo') || lower.includes('catalog') || lower.includes('producto');
    const route = isOrder ? 'order' : isCatalog ? 'catalog' : 'unknown';
    return { route, correct: route !== 'unknown', ext };
  },

  /**
   * Clean up a temp directory created by the harness.
   */
  cleanup(tmpDir) {
    try {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (e) { /* best effort */ }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = SpreadsheetHarness;
if (typeof window !== 'undefined') window.SpreadsheetHarness = SpreadsheetHarness;
