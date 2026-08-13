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
global.ImageTextGates = require(jsPath('imageTextGates.js'));
global.ImportGates = require(jsPath('importGates.js'));
global.FileImporter = require(jsPath('fileImporter.js'));
global.QuoteGenerator = require(jsPath('quoteGenerator.js'));
global.ImportsTracker = require(jsPath('importsTracker.js'));
global.AppUpdater = require(jsPath('updater.js'));
global.CatalogAssignmentGates = require(jsPath('catalogAssignmentGates.js'));
global.UINotifications = require(jsPath('ui/notifications.js'));
global.Reliability = require(jsPath('reliability.js'));
global.ImageQuality = require(jsPath('imageQuality.js'));
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

  // IT40: regresión de llamadas DINÁMICAS — el wizard renderiza vía
  // ImportWizard['_render_' + step.id]() (notación de corchete, nombre computado).
  // El escáner de referencias textuales NO lo detecta; un borrado dejaría el
  // wizard roto sin que los tests (que mockean DOM a null) lo cachen. Este
  // check verifica que cada step tenga su método _render_X.
  (function checkDynamicRenderMethods() {
    const src = _fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'ui', 'importWizard.js'), 'utf8');
    const ids = [...src.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
    const missing = ids.filter(id => !new RegExp(`_render_${id}\\s*\\(`).test(src));
    if (missing.length) {
      console.error('❌ Wizard dynamic render FAILED — faltan métodos _render_ para: ' + missing.join(', '));
      process.exitCode = 1;
    } else {
      console.log(`✅ Wizard dynamic render OK (${ids.length} pasos con su _render_*)`);
    }
  })();

  // Browser-runtime: ningún archivo de src/js puede referenciar `process.` sin
  // guarda. `process` existe en Node (donde corren los tests/auditorías) pero NO
  // en WebView2 (runtime real de la app). Un `process.env.X` sin guard en el
  // parser hacía que importar los 13 PDFs diera 0 productos ("process is not
  // defined") mientras todos los tests en Node pasaban verde. Este check pinne
  // la clase entera del bug.
  (function checkNoUnguardedProcessRefs() {
    const dir = path.join(__dirname, '..', 'src', 'js');
    const hits = [];
    const walk = (d) => {
      for (const ent of _fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.js')) {
          const lines = _fs.readFileSync(p, 'utf8').split('\n');
          lines.forEach((ln, i) => {
            // Ignora la línea del propio guard (envFlag) y typeof-guards.
            if (/envFlag\(/.test(ln)) return;
            if (/typeof\s+process\s*!==/.test(ln)) return;
            if (/\bprocess\./.test(ln)) hits.push(path.relative(dir, p) + ':' + (i + 1) + '  ' + ln.trim().slice(0, 80));
          });
        }
      }
    };
    walk(dir);
    if (hits.length) {
      console.error('❌ Browser-runtime FAILED — referencias a `process.` sin guarda (rompen en WebView2):');
      hits.forEach(h => console.error('   ' + h));
      process.exitCode = 1;
    } else {
      console.log('✅ Browser-runtime OK: src/js no referencia `process.` sin guarda');
    }
  })();

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
