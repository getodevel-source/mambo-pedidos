const fs = require('fs');
const path = require('path');

global.window = global;
global.navigator = {};
global.Image = class {};
global.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); }
};
global.document = {
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
  getElementById() { return null; },
  createElement() {
    return {
      style: {},
      click() {},
      setAttribute() {},
      appendChild() {},
      getContext() { return null; }
    };
  },
  body: { appendChild() {}, removeChild() {} }
};

global.Papa = { parse() {} };
global.XLSX = {
  utils: {
    aoa_to_sheet(data) { return { data }; },
    book_new() { return { SheetNames: [], Sheets: {} }; },
    book_append_sheet(wb, sheet, name) { wb.SheetNames.push(name); wb.Sheets[name] = sheet; },
    sheet_to_json() { return []; },
    sheet_to_csv() { return ''; }
  },
  writeFile() {}
};

const jsPath = file => path.join(__dirname, '..', 'src', 'js', file);
global.Validations = require(jsPath('validations.js'));
global.Calculator = require(jsPath('calculator.js'));
global.AppStorage = require(jsPath('storage.js'));
global.SkuAllocator = require(jsPath('skuAllocator.js'));
global.TextSanitizer = require(jsPath('textSanitizer.js'));
global.pdfjsLib = { OPS: {} };
global.PdfParser = require(jsPath('pdfParser.js'));
global.LocalLlm = require(jsPath('localLlm.js'));
global.AiCatalogEngine = require(jsPath('aiCatalogEngine.js'));
global.CatalogValidator = require(jsPath('catalogValidator.js'));
global.FileImporter = require(jsPath('fileImporter.js'));
global.QuoteGenerator = require(jsPath('quoteGenerator.js'));
global.AppUpdater = require(jsPath('updater.js'));
global.CatalogAssignmentGates = require(jsPath('catalogAssignmentGates.js'));
global.UINotifications = require(jsPath('ui/notifications.js'));
global.Reliability = require(jsPath('reliability.js'));
global.QualityGate = require(path.join(__dirname, 'quality', 'gate.js'));
global.SpreadsheetHarness = require(path.join(__dirname, 'quality', 'spreadsheet-harness.js'));
global.UpdaterSmoke = require(path.join(__dirname, 'quality', 'updater-smoke.js'));
global.esc = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
global.Tests = require(jsPath('tests.js'));

(async () => {
  const result = await Tests.runAll();
  if (result.failed > 0) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
