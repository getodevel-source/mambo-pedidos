const _fs = require('fs');
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

// IT38: integridad de scripts — todo archivo JS de la app debe estar referenciado
// en index.html. IT31 (0446fa7) borró js/fileImporter.js por accidente y los
// botones import/export quedaron muertos (FileImporter undefined) sin que
// ninguna suite lo detectara. Este check corta esa clase de bug.
(function checkScriptIntegrity() {
  const html = _fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  const loaded = new Set();
  for (const m of html.matchAll(/src="(js\/[^"]+\.js)"/g)) loaded.add(m[1]);
  const appDir = path.join(__dirname, '..', 'src', 'js');
  const missing = [];
  const walk = (dir) => {
    for (const ent of _fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const rel = 'js/' + path.relative(appDir, full).replace(/\\/g, '/');
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.js') && !ent.name.endsWith('.min.js')) {
        if (!loaded.has(rel) && !['tests.js', 'catalogAssignmentGates.js'].includes(ent.name)) missing.push(rel);
      }
    }
  };
  walk(appDir);
  if (missing.length) {
    console.error('❌ Script integrity FAILED — archivos de app no cargados en index.html: ' + missing.join(', '));
    process.exitCode = 1;
  } else {
    console.log('✅ Script integrity OK: todos los módulos de src/js están en index.html');
  }
})();

(async () => {
  const result = await Tests.runAll();
  if (result.failed > 0) process.exitCode = 1;

  // Suite de UI (jsdom) — integrada al runner oficial (loop de calidad)
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, 'quality', 'ui-smoke-tests.js')], { stdio: 'inherit' });
  } catch (uiErr) {
    console.error('❌ UI smoke tests FAILED: ' + (uiErr.message || uiErr));
    process.exitCode = 1;
  }

  // Suite de lógica de negocio (Calculator/Quote/SKU/Storage) — loop de calidad
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, 'quality', 'logic-tests.js')], { stdio: 'inherit' });
  } catch (logicErr) {
    console.error('❌ Logic tests FAILED: ' + (logicErr.message || logicErr));
    process.exitCode = 1;
  }

  // Suite de app.js (controlador principal UI) — loop de calidad IT6 (P8)
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, 'quality', 'app-smoke-tests.js')], { stdio: 'inherit' });
  } catch (appErr) {
    console.error('❌ app.js smoke tests FAILED: ' + (appErr.message || appErr));
    process.exitCode = 1;
  }
  // Suite de build frontend (P17) — dist/ espeja src/ minificado y más chico
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, 'build-frontend.js')], { stdio: 'inherit' });
  } catch (buildErr) {
    console.error('❌ Build frontend FAILED: ' + (buildErr.message || buildErr));
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
