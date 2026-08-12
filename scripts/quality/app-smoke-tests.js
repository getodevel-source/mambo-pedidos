// ============================================
//  Mambo Pedidos - Smoke Tests de app.js (jsdom)
// ============================================
// Suite de humo sobre el controlador principal src/js/app.js (877 LOC):
// switchView, updateBadges, recalc, syncMarkup, loadDemoCatalog, showConfirm,
// fetchLiveDolarRates, renderPedido, toggleDropdown, removePedItem,
// esc/escJs/hasCatalogImage y el resto de la capa de pedido/dólar/modales.
// NO modifica ningun archivo de src/js/: todo se carga en modo SOLO LECTURA.
//
// ENFOQUE: app.js es un script browser-global SIN exports; sus `let catalog`,
// `let selection` y `let currentPedido` son bindings LEXICOS del scope global
// del browser (no propiedades de window). Para replicarlo en Node se carga con
// vm.runInThisContext: los scripts asi ejecutados COMPARTEN el scope lexico
// global entre llamadas, de modo que catalog/selection/currentPedido de app.js
// son los MISMOS objetos que mutan ui/catalogView.js, ui/historyView.js,
// ui/modals.js y ui/notifications.js (cargados tambien con runInThisContext, en
// el mismo orden que src/index.html). Los modulos de logica pura (Validations,
// Calculator, AppStorage, SkuAllocator, ...) son CJS y se requieren REALES,
// igual que en scripts/run-tests.js. El estado lexico se lee/escribe con la
// helper ctx() (vm.runInThisContext), unica via a catalog/selection/currentPedido.
//
// Ejecucion:
//   node scripts/quality/app-smoke-tests.js   (desde la raiz del repo)
// Exit code 0 si todos los checks pasan.
//
// NOTA: este archivo NO usa 'use strict' a proposito: en Node 21+ `global.navigator`
// es getter-only y asignarlo lanza TypeError (mismo pitfall documentado en
// ui-smoke-tests.js). Tampoco se toca pdfParser.js ni tests.js.
// ============================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsPath = file => path.join(__dirname, '..', '..', 'src', 'js', file);

// ─────────────────────────────────────────────
//  DOM real (jsdom) — url con origen http para que localStorage funcione
//  Fixture con TODOS los IDs que consulta app.js (verificado contra el fuente)
// ─────────────────────────────────────────────
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <!-- nav + vistas (switchView) -->
  <nav>
    <div class="nav-item" data-view="catalogo">Catálogo <span id="navBadgeCat"></span></div>
    <div class="nav-item" data-view="pedido">Pedido <span id="navBadgePed"></span></div>
    <div class="nav-item" data-view="historial">Historial <span id="navBadgeHis"></span></div>
    <div class="nav-item" data-view="importaciones">Importaciones <span id="navBadgeImp"></span></div>
  </nav>
  <div class="view" id="view-catalogo"></div>
  <div class="view" id="view-pedido"></div>
  <div class="view" id="view-historial"></div>
  <div class="view" id="view-importaciones"><div id="importsSubtitle"></div><div id="importsList"></div></div>

  <!-- notifications (ui/notifications.js) -->
  <div id="toast"></div>
  <div id="progress"></div>
  <div id="progressBar"></div>
  <div id="loadingOverlay"></div>
  <div id="progressBarInner"></div>
  <div id="progressPctText"></div>
  <div id="progressTitleText"></div>
  <div id="progressSubText"></div>
  <div id="dropOverlay"></div>

  <!-- catalogView -->
  <div id="catalogEmpty"></div>
  <div id="catalogContent"></div>
  <div id="catalogActions"></div>
  <select id="catFilterMarca"></select>
  <select id="catFilterCat"></select>
  <input id="catSearch" value="">
  <input id="catFilterMinPrice" value="">
  <input id="catFilterMaxPrice" value="">
  <div id="catFilterChips"><button class="chip">Todas</button></div>
  <div id="pageIndicator"></div>
  <div id="catalogSubtitle"></div>
  <table><tbody id="catalogBody"></tbody></table>
  <div id="catalogGrid"></div>
  <div id="catalogTableWrap"></div>
  <button id="btnViewTable"></button>
  <button id="btnViewGrid"></button>
  <div id="stickyOrderBar"></div>
  <div id="stickySelCount"></div>
  <div id="stickySelFob"></div>
  <div id="catalogNextStepHint"></div>
  <div id="catKpiTotal"></div>
  <div id="catKpiMarcas"></div>
  <div id="catKpiMin"></div>
  <div id="catKpiMax"></div>
  <div id="catKpiAvg"></div>
  <div id="catKpiSel"></div>
  <div id="catKpiSelFob"></div>
  <input id="cMarkup" value="2.5">

  <!-- modals (ui/modals.js) -->
  <div id="imageZoomModal"><img id="imageZoomSrc"><div id="imageZoomCaption"></div></div>
  <div id="supplierCompareModal"></div>
  <div id="sensitivitySimulatorModal"></div>
  <div id="breakEvenModal"></div>
  <div id="doorToDoorModal"></div>
  <div id="brandManagerModal"></div>
  <input id="productImageFileInput">

  <!-- historyView -->
  <div id="historialSubtitle"></div>
  <div id="historialList"></div>

  <!-- pedido (app.js) -->
  <div id="pedidoEmpty" style="display:block"></div>
  <div id="pedidoContent" style="display:none"></div>
  <input id="pedidoName" value="">
  <div id="pedFob"></div>
  <div id="pedFobSub"></div>
  <div id="pedCosto"></div>
  <div id="pedCostoSub"></div>
  <div id="pedFact"></div>
  <div id="pedMargen"></div>
  <div id="pedMargenSub"></div>
  <div id="pedRoi"></div>
  <div id="pedIva"></div>
  <div id="pedIvaSub"></div>
  <div id="marginHealthBadge"></div>
  <div id="pedidoSubtitle"></div>
  <div id="pedidoMeta"></div>
  <div id="pedTableMeta"></div>
  <div id="orderWarningsContainer"></div>
  <table><tbody id="pedidoBody"></tbody></table>

  <!-- costos (getCostInputs / renderPedido / applyLogisticsVisibility / applyFiscalPreset) -->
  <div class="cost" id="wrapFlete"><input id="cFlete" value="15"></div>
  <div class="cost" id="wrapPesoKg"><input id="cPesoKg" value="0"></div>
  <div class="cost" id="wrapCostoPorKg"><input id="cCostoPorKg" value="12"></div>
  <div class="cost" id="wrapCourier"><input id="cCourier" value="8"></div>
  <div class="cost" id="wrapDesp"><input id="cDesp" value="500"></div>
  <input id="cSeguro" value="2">
  <input id="cDerechos" value="16">
  <input id="cTasa" value="3">
  <input id="cPerc" value="6">
  <input id="cIvaPct" value="21">
  <input id="cTasaCambio" value="1400">
  <input id="cMarkupRange" type="range" min="1" max="10" step="0.1" value="2.5">
  <input type="radio" name="rFleteModo" value="porcentaje" checked>
  <input type="radio" name="rFleteModo" value="peso">
  <input type="radio" name="rLogisticaModo" value="courier" checked>
  <input type="radio" name="rLogisticaModo" value="importador">
  <input type="radio" name="rTransporteModo" value="aereo" checked>
  <input type="radio" name="rTransporteModo" value="maritimo">
  <div id="cDescuentoNegociadoVal"></div>
  <div id="negotiationSavingsBadge"></div>

  <!-- premium UI (app.js) -->
  <div id="brandListContainer"></div>
  <div class="dropdown" id="ddWrap">
    <button id="ddBtn">Menú</button>
    <div class="dropdown-menu"><div class="dropdown-item">Opción 1</div></div>
  </div>
  <div id="outsideTarget"></div>
  <button id="advBtn" aria-expanded="false">Costos avanzados</button>
  <div id="advancedCostsPanel" style="display:none"></div>

  <!-- confirm modal (app.js) -->
  <div id="confirmModal" style="display:none">
    <div id="confirmIcon"></div>
    <div id="confirmTitle"></div>
    <div id="confirmMessage"></div>
    <button id="confirmOkBtn"></button>
  </div>

  <!-- dólar (app.js) -->
  <div id="topDolarBanner"></div>
  <div id="dolarRatesBadgeList"></div>
</body></html>`, { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

// ─────────────────────────────────────────────
//  Harness de aserciones (estilo src/js/tests.js)
// ─────────────────────────────────────────────
const results = { pass: 0, fail: 0 };
const skipped = [];

function check(name, cond) {
  if (cond) {
    results.pass++;
    console.log('✅ PASS: ' + name);
  } else {
    results.fail++;
    console.error('❌ FAIL: ' + name);
  }
}

function failSection(section, err) {
  results.fail++;
  console.error('❌ FAIL: sección ' + section + ' lanzó una excepción: ' + (err && err.stack ? err.stack : err));
}

// Lee/escribe el estado LEXICO de app.js (catalog, selection, currentPedido, ...).
// En el browser esos `let` viven en el scope global compartido; aca son bindings
// del contexto global de V8 que comparten todas las llamadas a runInThisContext.
function ctx(code) { return vm.runInThisContext(code); }

// ─────────────────────────────────────────────
//  Módulos de lógica pura (CJS reales, igual que scripts/run-tests.js)
// ─────────────────────────────────────────────
global.Validations = require(jsPath('validations.js'));
global.Calculator = require(jsPath('calculator.js'));
global.AppStorage = require(jsPath('storage.js'));   // fallback a localStorage en jsdom
global.SkuAllocator = require(jsPath('skuAllocator.js'));
global.TextSanitizer = require(jsPath('textSanitizer.js'));
global.CatalogValidator = require(jsPath('catalogValidator.js'));
global.QuoteGenerator = require(jsPath('quoteGenerator.js'));
global.FileImporter = require(jsPath('fileImporter.js'));
global.ImportsTracker = require(jsPath('importsTracker.js'));
global.DEMO_CATALOG = require(jsPath('demoCatalog.js'));

// Stubs mínimos que pueden tocar fileImporter/etc. (mismo set que run-tests.js)
global.Papa = { parse() { return { data: [] }; } };
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
global.pdfjsLib = { OPS: {} };

// ─────────────────────────────────────────────
//  fetch mock controlable (fetchLiveDolarRates)
// ─────────────────────────────────────────────
let fetchBehavior = { mode: 'fail', data: [] };
let fetchCalls = 0;
global.fetch = async (url, opts) => {
  fetchCalls++;
  if (fetchBehavior.mode === 'ok') return { ok: true, status: 200, json: async () => fetchBehavior.data };
  if (fetchBehavior.mode === 'http500') return { ok: false, status: 500, json: async () => ({}) };
  throw new Error('Mock fetch: sin conexión (modo fail)');
};

// ─────────────────────────────────────────────
//  Módulos UI browser-global: se cargan con runInThisContext (MISMO contexto
//  que app.js) para que catalog/selection/currentPedido/AppStore sean shared.
//  Orden de src/index.html.
// ─────────────────────────────────────────────
function loadBrowserScript(relPath) {
  vm.runInThisContext(fs.readFileSync(jsPath(relPath), 'utf8'), { filename: relPath });
}

loadBrowserScript('ui/notifications.js');
loadBrowserScript('ui/historyView.js');
loadBrowserScript('ui/importsView.js');
loadBrowserScript('ui/modals.js');
loadBrowserScript('ui/catalogView.js');
loadBrowserScript('app.js');

// Puente window -> globalThis (mismo patrón que BRIDGE_GLOBALS de ui-smoke-tests.js):
// los bridges de los módulos UI escriben en `window`, pero las free vars de app.js
// resuelven contra globalThis en Node.
const BRIDGE_GLOBALS = [
  'UINotifications', 'toast', 'showProgress', 'hideProgress', 'showDropOverlay', 'hideDropOverlay',
  'HistoryView', 'saveToHistorial', 'renderHistorial', 'loadFromHistorial', 'clonarPedido',
  'copiarResumenPedido', 'deleteFromHistorial',
  'ImportsView', 'renderImportaciones', 'invalidateImportsBadge',
  'UIModals', 'zoomImage', 'zoomImageByUrl', 'closeImageZoomModal', 'triggerImageUpload',
  'openSupplierCompareModal', 'closeSupplierCompareModal', 'openSensitivitySimulatorModal',
  'closeSensitivitySimulatorModal', 'runSensitivitySimulation', 'openBreakEvenModal',
  'closeBreakEvenModal', 'runBreakEvenCalculation', 'openDoorToDoorModal', 'closeDoorToDoorModal',
  'runDoorToDoorCalculation', 'handleProductImageFile', 'triggerCleanBackground',
  'openBrandManagerModal', 'closeBrandManagerModal', 'addCustomBrand', 'deleteCustomBrand',
  'CatalogView', 'showCatalogContent', 'populateCatalogFilters', 'prevPage', 'nextPage',
  'adjustQty', 'setCatChip', 'clearCatalogFilters', 'renderCatalog', 'debouncedRenderCatalog',
  'toggleItem', 'setQty', 'toggleSelectAll', 'removeItem', 'addCatalogItem', 'resetCatalog',
  'updateField', 'setCatalogViewMode'
];
for (const k of BRIDGE_GLOBALS) {
  if (typeof dom.window[k] !== 'undefined') global[k] = dom.window[k];
}

// ─────────────────────────────────────────────
//  Fixtures de datos
// ─────────────────────────────────────────────
const IMG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Payload de DólarAPI (casa -> cotización)
const DOLAR_OK = [
  { casa: 'mayorista', compra: 1290, venta: 1295 },
  { casa: 'oficial', compra: 1300, venta: 1310 },
  { casa: 'blue', compra: 1420, venta: 1435 },
  { casa: 'bolsa', compra: 1350, venta: 1365 },
  { casa: 'cripto', compra: 1340, venta: 1352 }
];
const DOLAR_CACHE_OLD = {
  mayorista: { casa: 'mayorista', venta: 1250 },
  blue: { casa: 'blue', venta: 1380 },
  oficial: { casa: 'oficial', venta: 1280 },
  bolsa: { casa: 'bolsa', venta: 1320 },
  cripto: { casa: 'cripto', venta: 1310 }
};

const $id = id => document.getElementById(id);
const fmtUsd = n => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' USD';
const fmtUsdRound = n => '$' + Math.round(n).toLocaleString() + ' USD';
const tick = (ms = 10) => new Promise(r => setTimeout(r, ms));
const setRadio = (name, val) => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => { r.checked = (r.value === val); });
};

// ============================================
//  1) Helpers puros: esc / escJs / hasCatalogImage
// ============================================
function testEscapeHelpers() {
  check('esc: escapa & < > "', global.esc('<b>&"x"</b>') === '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  check('esc: valor null/undefined -> cadena vacía', global.esc(null) === '' && global.esc(undefined) === '');
  check('escJs: escapa backslash y comilla simple', global.escJs("a\\b'c") === "a\\\\b\\'c");
  check('escJs: escapa comilla doble como &quot;', global.escJs('"q"') === '&quot;q&quot;');
  check('hasCatalogImage: acepta data:image/png;base64', global.hasCatalogImage(IMG_PNG) === true);
  check('hasCatalogImage: acepta data:image/jpeg', global.hasCatalogImage('data:image/jpeg;base64,AAAA') === true);
  check('hasCatalogImage: rechaza "-" / vacío / http', global.hasCatalogImage('-') === false && global.hasCatalogImage('') === false && global.hasCatalogImage('http://x/img.png') === false);
}

// ============================================
//  2) syncMarkup (input number <-> range) + recalc no-crash
// ============================================
function testSyncMarkup() {
  global.syncMarkup('3.5', 'range');
  check('syncMarkup(range): cMarkup se sincroniza con 2 decimales',
    $id('cMarkup').value === '3.50');
  global.syncMarkup('4', 'num');
  check('syncMarkup(num): cMarkupRange se sincroniza', $id('cMarkupRange').value === '4');
  global.syncMarkup('abc', 'range');
  check('syncMarkup: valor no numérico -> default 2.5 (clamp)', $id('cMarkup').value === '2.50');
  global.syncMarkup('2.5', 'num');
}

// ============================================
//  3) Premium UI: toggleDropdown / toggleAdvancedCosts / toggleFullscreen
// ============================================
function testPremiumUI() {
  const dd = $id('ddWrap');
  global.toggleDropdown($id('ddBtn'));
  check('toggleDropdown: abre el dropdown (clase open)', dd.classList.contains('open'));
  global.toggleDropdown($id('ddBtn'));
  check('toggleDropdown: segundo toggle cierra (era open)', !dd.classList.contains('open'));

  global.toggleDropdown($id('ddBtn'));
  $id('outsideTarget').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('toggleDropdown: click fuera cierra los dropdowns abiertos', !dd.classList.contains('open'));

  const advBtn = $id('advBtn');
  global.toggleAdvancedCosts(advBtn);
  check('toggleAdvancedCosts: abre panel y setea aria-expanded=true',
    $id('advancedCostsPanel').style.display === 'block' && advBtn.getAttribute('aria-expanded') === 'true');
  global.toggleAdvancedCosts(advBtn);
  check('toggleAdvancedCosts: cierra panel y vuelve aria-expanded=false',
    $id('advancedCostsPanel').style.display === 'none' && advBtn.getAttribute('aria-expanded') === 'false');

  // toggleFullscreen: sin fullscreen API en jsdom, no debe lanzar
  let threw = false;
  try { global.toggleFullscreen(); } catch { threw = true; }
  check('toggleFullscreen: no lanza sin Fullscreen API (jsdom)', threw === false);
}

// ============================================
//  4) renderBrandList (vacía y poblada)
// ============================================
function testRenderBrandList() {
  ctx('customBrandsList = []');
  global.renderBrandList();
  check('renderBrandList: empty state "No hay marcas personalizadas"',
    $id('brandListContainer').innerHTML.includes('No hay marcas personalizadas'));
  ctx('customBrandsList.push({ name: "NitroTech", pattern: "NITRO-*" })');
  global.renderBrandList();
  check('renderBrandList: pinta marca custom con su patrón (escapado)',
    $id('brandListContainer').innerHTML.includes('NitroTech') && $id('brandListContainer').innerHTML.includes('NITRO-*'));
}

// ============================================
//  5) loadDemoCatalog -> catálogo poblado + render + badges
// ============================================
async function testLoadDemoCatalog() {
  global.loadDemoCatalog();
  await tick();
  check('loadDemoCatalog: catalog con los items de DEMO_CATALOG (' + DEMO_CATALOG.length + ')',
    ctx('catalog.length') === DEMO_CATALOG.length);
  check('loadDemoCatalog: renderCatalog pintó modelos en #catalogBody',
    $id('catalogBody').innerHTML.includes('F75 Reaper Switch'));
  check('loadDemoCatalog: navBadgeCat = ' + DEMO_CATALOG.length + ' (updateBadges vía showCatalogContent)',
    $id('navBadgeCat').textContent === String(DEMO_CATALOG.length));
  check('loadDemoCatalog: toast "' + DEMO_CATALOG.length + ' productos demo cargados"',
    $id('toast').textContent === DEMO_CATALOG.length + ' productos demo cargados');
  check('loadDemoCatalog: catálogo visible (catalogContent block)',
    $id('catalogContent').style.display === 'block');

  // Guided hint visible con selección vacía
  check('loadDemoCatalog: hint guiado visible sin selección',
    $id('catalogNextStepHint').style.display === 'flex');
  global.dismissNextStepHint();
  check('dismissNextStepHint: oculta el hint y marca _nextStepDismissed',
    $id('catalogNextStepHint').style.display === 'none' && global.CatalogView._nextStepDismissed === true);
}

// ============================================
//  6) switchView (vistas + nav + renderHistorial)
// ============================================
async function testSwitchView() {
  global.switchView('pedido');
  check('switchView(pedido): view-pedido activa', $id('view-pedido').classList.contains('active'));
  check('switchView(pedido): otras vistas inactivas',
    !$id('view-catalogo').classList.contains('active') && !$id('view-historial').classList.contains('active'));
  check('switchView(pedido): nav-item correspondiente activo',
    document.querySelector('.nav-item[data-view="pedido"]').classList.contains('active'));

  global.switchView('historial');
  await tick();
  check('switchView(historial): renderHistorial corrió (subtítulo "0 pedidos guardados")',
    $id('historialSubtitle').textContent.includes('0 pedidos'));
  check('switchView(historial): view-historial activa + nav activo',
    $id('view-historial').classList.contains('active') && document.querySelector('.nav-item[data-view="historial"]').classList.contains('active'));

  // importaciones: seed + render hook (renderImportaciones vía switchView)
  await AppStorage.saveImports({
    records: [
      {
        id: 'imp-a', number: 'IMP-0001', supplier: 'AliExpress', description: 'Teclado mecánico',
        courier: 'DHL', status: 'in_transit',
        dates: { ordered: '2026-08-01T00:00:00Z', in_transit: '2026-08-05T00:00:00Z', in_customs: null, cleared: null, delivered: null },
        finalLandedCostUsd: 100, localPriceUsd: 150, tipoCambio: 1400
      },
      {
        id: 'imp-b', number: 'IMP-0002', supplier: 'Amazon', description: 'Mouse G Pro',
        courier: 'FedEx', status: 'delivered',
        dates: { ordered: '2026-07-10T00:00:00Z', in_transit: null, in_customs: null, cleared: '2026-07-20T00:00:00Z', delivered: '2026-07-25T00:00:00Z' },
        finalLandedCostUsd: 60, localPriceUsd: 90, tipoCambio: 1400
      }
    ],
    counter: 2
  });
  global.switchView('importaciones');
  await tick();
  check('switchView(importaciones): renderImportaciones corrió (subtítulo "2 importaciones")',
    $id('importsSubtitle').textContent.includes('2 importaciones'));
  check('switchView(importaciones): view-importaciones activa + nav activo',
    $id('view-importaciones').classList.contains('active') && document.querySelector('.nav-item[data-view="importaciones"]').classList.contains('active'));
  check('switchView(importaciones): dashboard agrupa por estado (En tránsito / Entregado)',
    $id('importsList').innerHTML.includes('En tránsito') && $id('importsList').innerHTML.includes('Entregado'));

  global.switchView('catalogo');
  check('switchView(catalogo): vuelve a catálogo', $id('view-catalogo').classList.contains('active'));
}

// ============================================
//  7) updateBadges + TTL del badge de historial (10s)
// ============================================
async function testUpdateBadges() {
  // Selección vacía + catálogo demo
  global.invalidateHistorialBadge();
  await AppStorage.saveHistorial([
    { name: 'Pedido A', items: [{ sku: 'A1', qty: 1 }], date: new Date().toISOString(), totals: { qty: 1, fob: 10, costo: 15, facturacion: 30, margen: 15 } }
  ]);
  await global.updateBadges();
  check('updateBadges: navBadgeCat = ' + DEMO_CATALOG.length + ' items del catálogo', $id('navBadgeCat').textContent === String(DEMO_CATALOG.length));
  check('updateBadges: navBadgePed = 0 unidades seleccionadas', $id('navBadgePed').textContent === '0');
  check('updateBadges: navBadgeHis = 1 pedido guardado (fetch real a AppStorage)', $id('navBadgeHis').textContent === '1');

  // TTL 10s: segundo loadHistorial NO debe dispararse (cache)
  await AppStorage.saveHistorial([
    { name: 'Pedido A', items: [{ sku: 'A1', qty: 1 }], date: new Date().toISOString(), totals: { qty: 1, fob: 10 } },
    { name: 'Pedido B', items: [{ sku: 'B1', qty: 1 }], date: new Date().toISOString(), totals: { qty: 1, fob: 20 } }
  ]);
  await global.updateBadges();
  check('updateBadges: TTL cache vigente -> sigue mostrando 1 (no re-lee historial)',
    $id('navBadgeHis').textContent === '1');

  // Expira el TTL (Date.now + 11s) -> re-lee y muestra 2
  const realNow = Date.now;
  Date.now = () => realNow() + 11000;
  try {
    await global.updateBadges();
  } finally {
    Date.now = realNow;
  }
  check('updateBadges: TTL expirado -> re-lee historial y muestra 2', $id('navBadgeHis').textContent === '2');

  // invalidateHistorialBadge fuerza refresh inmediato
  global.invalidateHistorialBadge();
  await global.updateBadges();
  check('updateBadges: invalidateHistorialBadge fuerza re-lectura', $id('navBadgeHis').textContent === '2');

  // Badge de importaciones: recuento de records + invalidación (patrón espejo del historial)
  global.invalidateImportsBadge();
  await AppStorage.saveImports({
    records: [
      { id: 'i1', number: 'IMP-0001', supplier: 'A', description: 'X', status: 'ordered', finalLandedCostUsd: 10, localPriceUsd: null, dates: { ordered: new Date().toISOString() } },
      { id: 'i2', number: 'IMP-0002', supplier: 'B', description: 'Y', status: 'in_transit', finalLandedCostUsd: 20, localPriceUsd: null, dates: { ordered: new Date().toISOString(), in_transit: new Date().toISOString() } },
      { id: 'i3', number: 'IMP-0003', supplier: 'C', description: 'Z', status: 'delivered', finalLandedCostUsd: 30, localPriceUsd: null, dates: { ordered: new Date().toISOString(), delivered: new Date().toISOString() } }
    ],
    counter: 3
  });
  await global.updateBadges();
  check('updateBadges: navBadgeImp = 3 importaciones guardadas', $id('navBadgeImp').textContent === '3');
}

// ============================================
//  8) validarYOarmarPedido: paths de error + panel de validación
// ============================================
async function testValidarYOarmarPedido() {
  // Sin selección -> toast error
  ctx('selection = {}');
  global.validarYOarmarPedido();
  await tick();
  check('validarYOarmarPedido: sin selección tosta "Seleccioná al menos un producto"',
    $id('toast').textContent === 'Seleccioná al menos un producto');

  // Selección con qty inválida (0) -> showValidationPanel
  ctx('selection = { "TEC-001": 0 }');
  await global.validarYOarmarPedido();
  const panel = $id('validationPanel');
  check('validarYOarmarPedido: qty inválida abre showValidationPanel con errores',
    panel !== null && panel.style.display === 'block' && panel.innerHTML.includes('errores encontrados'));
  global.hideValidationPanel();
  check('hideValidationPanel: oculta el panel', $id('validationPanel').style.display === 'none');
  ctx('selection = {}');
}

// ============================================
//  9) Selección real vía CatalogView + validarYOarmarPedido OK -> armarPedido
// ============================================
async function testArmarPedidoFlow() {
  global.toggleItem('TEC-001', true);   // selección 1
  global.setQty('TEC-001', 2);          // qty 2
  global.toggleItem('MOU-001', true);   // selección 1
  await tick();
  check('toggleItem/setQty: selection compartida con catalogView (TEC-001=2, MOU-001=1)',
    ctx('selection["TEC-001"] === 2 && selection["MOU-001"] === 1'));
  check('toggleItem: navBadgePed = 3 unidades seleccionadas', $id('navBadgePed').textContent === '3');

  // Items originales para calcular el total esperado con el Calculator REAL
  const expected = Calculator.calculateOrder(
    [
      { sku: 'TEC-001', cat: 'TECLADO', marca: 'AULA', modelo: 'F75 Reaper Switch', variante: 'Glacier Blue', color: 'Glacier Blue', fob: 31.75, img: '-', qty: 2 },
      { sku: 'MOU-001', cat: 'MOUSE', marca: 'ATK', modelo: 'X1 Ultimate 8KHz', variante: 'White', color: 'White', fob: 60.70, img: '-', qty: 1 }
    ],
    ctx('getCostInputs()')
  );

  await global.validarYOarmarPedido();
  check('validarYOarmarPedido: arma currentPedido con 2 items', ctx('currentPedido && currentPedido.items.length === 2'));
  check('validarYOarmarPedido: toast "Pedido armado: 2 SKUs"', $id('toast').textContent === 'Pedido armado: 2 SKUs');

  // switchView('pedido') + renderPedido + recalc
  check('armarPedido: view-pedido activa', $id('view-pedido').classList.contains('active'));
  check('armarPedido: pedidoName con nombre "Pedido ..."', $id('pedidoName').value.startsWith('Pedido '));
  check('recalc: pedFob = ' + fmtUsd(expected.totals.fob), $id('pedFob').textContent === fmtUsd(expected.totals.fob));
  check('recalc: pedCosto = ' + fmtUsdRound(expected.totals.costo), $id('pedCosto').textContent === fmtUsdRound(expected.totals.costo));
  check('recalc: pedFact = ' + fmtUsdRound(expected.totals.facturacion), $id('pedFact').textContent === fmtUsdRound(expected.totals.facturacion));
  check('recalc: pedMargen = ' + fmtUsdRound(expected.totals.margen), $id('pedMargen').textContent === fmtUsdRound(expected.totals.margen));
  check('recalc: pedRoi = ' + expected.totals.roiPct + '%', $id('pedRoi').textContent === expected.totals.roiPct + '%');
  check('recalc: pedIva = ' + fmtUsdRound(expected.totals.ivaUsd), $id('pedIva').textContent === fmtUsdRound(expected.totals.ivaUsd));
  check('recalc: pedidoSubtitle "2 SKUs · 3 unidades · TC: $1400/USD"',
    $id('pedidoSubtitle').textContent === '2 SKUs · 3 unidades · TC: $' + expected.totals.tipoCambio + '/USD');
  check('recalc: marginHealthBadge "Excelente Rentabilidad (>40%)"',
    $id('marginHealthBadge').textContent === 'Excelente Rentabilidad (>40%)');

  // renderPedidoTable
  const tbl = $id('pedidoBody').innerHTML;
  check('renderPedidoTable: fila TEC-001 con FOB 31.75', tbl.includes('TEC-001') && tbl.includes('31.75'));
  check('renderPedidoTable: qty input con valor 2', tbl.includes('value="2"'));
  check('renderPedidoTable: placeholder para items sin imagen', tbl.includes('opacity: 0.3'));

  // renderPedido restaura inputs de costo desde currentPedido.costs
  $id('cFlete').value = '22';
  setRadio('rLogisticaModo', 'importador');
  global.renderPedido();
  check('renderPedido: restaura cFlete desde costs (15)', $id('cFlete').value === '15');
  check('renderPedido: restaura radio rLogisticaModo=courier',
    document.querySelector('input[name="rLogisticaModo"]:checked').value === 'courier');

  // recalc con markup distinto (vía syncMarkup) -> facturación cambia
  const factBefore = $id('pedFact').textContent;
  global.syncMarkup('3', 'range');
  check('recalc: markup 3 cambia pedFact vs markup 2.5', $id('pedFact').textContent !== factBefore);
  check('syncMarkup: cMarkup quedó en 3.00', $id('cMarkup').value === '3.00');
}

// ============================================
//  10) syncDescuentoNegociado / applyFiscalPreset / applyLogisticsVisibility
// ============================================
function testNegociacionYPresets() {
  global.syncDescuentoNegociado(10);
  check('syncDescuentoNegociado: label "10%"', $id('cDescuentoNegociadoVal').textContent === '10%');
  check('syncDescuentoNegociado: badge de ahorro con -$ USD y "10% off list"',
    $id('negotiationSavingsBadge').innerHTML.includes('Ahorro por Negociación') &&
    $id('negotiationSavingsBadge').innerHTML.includes('-') &&
    $id('negotiationSavingsBadge').innerHTML.includes('10% off list'));
  check('syncDescuentoNegociado: fob del item 1 quedó por debajo del original (31.75)',
    ctx('currentPedido.items[0].fob') < 31.75);

  global.syncDescuentoNegociado(0);
  check('syncDescuentoNegociado: 0% vuelve fob al fobOriginal',
    ctx('currentPedido.items[0].fob') === ctx('currentPedido.items[0].fobOriginal'));
  check('syncDescuentoNegociado: 0% badge "Sin descuento negociado"',
    $id('negotiationSavingsBadge').textContent === 'Sin descuento negociado');

  global.applyFiscalPreset();
  check('applyFiscalPreset: aplica preset a cMarkup (2.5) y cTasaCambio (1400)',
    $id('cMarkup').value === '2.5' && $id('cTasaCambio').value === '1400');
  check('applyFiscalPreset: toast "Preset aplicado..."', $id('toast').textContent.startsWith('Preset aplicado'));

  // applyLogisticsVisibility: courier/porcentaje por default
  setRadio('rLogisticaModo', 'courier');
  setRadio('rFleteModo', 'porcentaje');
  global.applyLogisticsVisibility();
  check('applyLogisticsVisibility: courier visible / despachante oculto (default)',
    $id('wrapCourier').style.display === '' && $id('wrapDesp').style.display === 'none');
  // importador + peso
  setRadio('rLogisticaModo', 'importador');
  setRadio('rFleteModo', 'peso');
  global.applyLogisticsVisibility();
  check('applyLogisticsVisibility: modo importador+peso oculta courier/flete y muestra desp/kg',
    $id('wrapCourier').style.display === 'none' && $id('wrapFlete').style.display === 'none' &&
    $id('wrapPesoKg').style.display === '' && $id('wrapCostoPorKg').style.display === '' &&
    $id('wrapDesp').style.display === '');
  setRadio('rLogisticaModo', 'courier');
  setRadio('rFleteModo', 'porcentaje');
}

// ============================================
//  11) removePedItem (vacía el pedido)
// ============================================
function testRemovePedItem() {
  global.removePedItem(0); // quita TEC-001 -> queda MOU-001
  check('removePedItem: quita el item 0 (quedan 1)', ctx('currentPedido.items.length') === 1);
  check('removePedItem: re-render de tabla sin TEC-001', !$id('pedidoBody').innerHTML.includes('TEC-001'));
  global.removePedItem(0); // queda vacío -> currentPedido = null
  check('removePedItem: último item -> currentPedido null', ctx('currentPedido') === null);
  check('removePedItem: muestra pedidoEmpty y oculta pedidoContent',
    $id('pedidoEmpty').style.display === 'block' && $id('pedidoContent').style.display === 'none');
  check('removePedItem: pedidoSubtitle "No hay productos en el pedido"',
    $id('pedidoSubtitle').textContent === 'No hay productos en el pedido');
}

// ============================================
//  12) showConfirm / resolveConfirm / closeConfirmModal
// ============================================
async function testConfirmModal() {
  const p = global.showConfirm({ title: 'Borrar producto', message: '¿Seguro?', confirmText: 'Borrar', danger: true });
  check('showConfirm: setea título y mensaje', $id('confirmTitle').textContent === 'Borrar producto' && $id('confirmMessage').innerHTML === '¿Seguro?');
  check('showConfirm: botón con texto y clase btn-danger', $id('confirmOkBtn').textContent === 'Borrar' && $id('confirmOkBtn').className.includes('btn-danger'));
  check('showConfirm: icono danger inyecta SVG', $id('confirmIcon').innerHTML.includes('<svg'));
  check('showConfirm: modal visible (flex)', $id('confirmModal').style.display === 'flex');

  global.resolveConfirm(true);
  check('resolveConfirm: resuelve la promesa con true', (await p) === true);
  check('resolveConfirm: oculta el modal', $id('confirmModal').style.display === 'none');

  const p2 = global.showConfirm({ title: 'Sin peligro' });
  global.closeConfirmModal();
  check('closeConfirmModal: resuelve con false', (await p2) === false);
  check('closeConfirmModal: oculta el modal', $id('confirmModal').style.display === 'none');
}

// ============================================
//  13) toastUndo (botón Deshacer)
// ============================================
function testToastUndo() {
  let undone = false;
  global.toastUndo('Producto borrado', () => { undone = true; });
  const toastEl = $id('toast');
  check('toastUndo: mensaje + botón "Deshacer" en #toast',
    toastEl.querySelector('span').textContent === 'Producto borrado' && toastEl.querySelector('button.toast-undo').textContent === 'Deshacer');
  toastEl.querySelector('button.toast-undo').click();
  check('toastUndo: onclick ejecuta onUndo', undone === true);
  check('toastUndo: quita la clase show tras deshacer', !toastEl.classList.contains('show'));
}

// ============================================
//  14) fetchLiveDolarRates: fallback a cache, éxito, cache-skip, applyDolarRate
// ============================================
async function testDolarRates() {
  // --- Fallback offline: fetch falla + cache previo en localStorage ---
  fetchBehavior = { mode: 'fail', data: [] };
  localStorage.setItem('mambo_dolar_cache', JSON.stringify({ data: DOLAR_CACHE_OLD, ts: Date.now() - 2 * 60 * 60 * 1000 }));
  ctx('liveDolarData = null; _dolarLastFetch = 0;');
  await global.fetchLiveDolarRates(true);
  check('fetchLiveDolarRates: fetch falla -> restaura cache (5 chips renderizados)',
    $id('dolarRatesBadgeList').querySelectorAll('.dolar-chip').length === 5);
  check('fetchLiveDolarRates: cache renderiza valor viejo de blue ($1.380)',
    $id('dolarRatesBadgeList').innerHTML.includes('1.380'));
  check('fetchLiveDolarRates: muestra badge "guardado HH:MM" (stale)',
    $id('dolarStaleBadge') !== null && $id('dolarStaleBadge').textContent.includes('guardado'));
  check('fetchLiveDolarRates: toast "Sin conexión: mostrando cotizaciones guardadas"',
    $id('toast').textContent === 'Sin conexión: mostrando cotizaciones guardadas');

  // --- Éxito: fetch OK -> 5 chips fresh, badge stale removido, cache reescrito ---
  fetchBehavior = { mode: 'ok', data: DOLAR_OK };
  await global.fetchLiveDolarRates(true);
  const chips = $id('dolarRatesBadgeList').querySelectorAll('.dolar-chip');
  check('fetchLiveDolarRates: fetch OK renderiza 5 chips', chips.length === 5);
  check('fetchLiveDolarRates: chips Mayorista/Oficial/Blue/MEP/Cripto',
    ['Mayorista', 'Oficial', 'Blue', 'MEP', 'Cripto'].every(l => $id('dolarRatesBadgeList').innerHTML.includes(l)));
  check('fetchLiveDolarRates: oculta el badge stale tras éxito', $id('dolarStaleBadge') === null);
  const cached = JSON.parse(localStorage.getItem('mambo_dolar_cache'));
  check('cacheDolarRates: persiste liveDolarData en localStorage', cached && cached.data.blue.venta === 1435);
  check('fetchLiveDolarRates: toast "Cotizaciones Dólar actualizadas"',
    $id('toast').textContent === 'Cotizaciones Dólar actualizadas');

  // --- Cache-skip: sin userInitiated y < 5 min -> NO vuelve a fetchear ---
  const callsBefore = fetchCalls;
  global.fetchLiveDolarRates(false);
  check('fetchLiveDolarRates: cache de 5 min vigente -> no refetch', fetchCalls === callsBefore);

  // --- applyDolarRate ---
  global.applyDolarRate('blue');
  check('applyDolarRate: aplica blue a cTasaCambio (1435)',
    $id('cTasaCambio').value === '1435');
  check('applyDolarRate: toast "Tasa de cambio aplicada: Dólar BLUE"',
    $id('toast').textContent.includes('Dólar BLUE'));

  // --- applyDolarRate con key inexistente -> dispara refetch ---
  const callsBefore2 = fetchCalls;
  global.applyDolarRate('noexiste');
  check('applyDolarRate: key inexistente dispara fetchLiveDolarRates(true)', fetchCalls === callsBefore2 + 1);

  // --- showDolarStaleBadge / hideDolarStaleBadge directo ---
  global.showDolarStaleBadge(Date.now() - 3600000);
  check('showDolarStaleBadge: crea span dentro de topDolarBanner', $id('dolarStaleBadge') !== null);
  global.hideDolarStaleBadge();
  check('hideDolarStaleBadge: remueve el span', $id('dolarStaleBadge') === null);
}

// ============================================
//  15) updateProductImage (cambia img de un item del catálogo)
// ============================================
function testUpdateProductImage() {
  check('updateProductImage: precondición TEC-001 sin img (demo no trae key img)',
    ctx('catalog.find(r => r.sku === "TEC-001").img') === undefined);
  global.updateProductImage('TEC-001', IMG_PNG);
  check('updateProductImage: actualiza item.img del catálogo', ctx('catalog.find(r => r.sku === "TEC-001").img') === IMG_PNG);
  check('updateProductImage: re-render de catálogo con la data-URI', $id('catalogBody').innerHTML.includes('data:image/png'));
  check('updateProductImage: abre zoom con la imagen (imageZoomSrc)', $id('imageZoomSrc').src.startsWith('data:image/png'));
  check('updateProductImage: toast "Foto del producto actualizada"', $id('toast').textContent === 'Foto del producto actualizada');

  // Data URL inválida -> no cambia + toast de error
  const before = ctx('catalog.find(r => r.sku === "TEC-001").img');
  global.updateProductImage('TEC-001', 'https://ejemplo.com/x.png');
  check('updateProductImage: URL http inválida -> no cambia img',
    ctx('catalog.find(r => r.sku === "TEC-001").img') === before);
  check('updateProductImage: toast "La imagen seleccionada no es válida"',
    $id('toast').textContent === 'La imagen seleccionada no es válida');
}

// ============================================
//  16) Handlers globales: keydown (Escape / Ctrl+1 / Ctrl+F)
// ============================================
async function testKeydownHandlers() {
  const dispatchKey = (key, init = {}) => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  };

  // Escape cierra confirm modal pendiente (resuelve false) + dropdowns
  global.toggleDropdown($id('ddBtn'));
  const p = global.showConfirm({ title: 'Pendiente' });
  dispatchKey('Escape');
  check('keydown Escape: resuelve showConfirm con false', (await p) === false);
  check('keydown Escape: cierra confirmModal', $id('confirmModal').style.display === 'none');
  check('keydown Escape: cierra dropdowns abiertos', !$id('ddWrap').classList.contains('open'));

  // Ctrl+1 -> switchView('catalogo')
  global.switchView('pedido');
  dispatchKey('1', { ctrlKey: true });
  check('keydown Ctrl+1: cambia a vista catálogo', $id('view-catalogo').classList.contains('active'));

  // Ctrl+4 -> switchView('importaciones')
  global.switchView('pedido');
  dispatchKey('4', { ctrlKey: true });
  await tick();
  check('keydown Ctrl+4: cambia a vista importaciones', $id('view-importaciones').classList.contains('active'));

  // Ctrl+F -> foco en catSearch
  dispatchKey('f', { ctrlKey: true });
  check('keydown Ctrl+F: enfoca catSearch', document.activeElement === $id('catSearch'));

  // Ctrl+Enter sobre catálogo sin selección -> validarYOarmarPedido (toast error, sin crash)
  global.switchView('catalogo');   // el bloque Ctrl+4 pudo dejar otra vista activa
  ctx('selection = {}');
  dispatchKey('Enter', { ctrlKey: true });
  await tick();
  check('keydown Ctrl+Enter: valida pedido vacío sin crash (toast error)', $id('toast').textContent === 'Seleccioná al menos un producto');
}

// ============================================
//  17) showValidationPanel / hideValidationPanel (directo)
// ============================================
function testValidationPanelDirect() {
  global.showValidationPanel(
    [{ field: 'sku', message: 'SKU inválido' }],
    [{ field: 'fob', message: 'FOB alto' }]
  );
  const panel = $id('validationPanel');
  check('showValidationPanel: 1 error + 1 advertencia renderizados y escapados',
    panel.innerHTML.includes('1 errores encontrados') && panel.innerHTML.includes('SKU inválido') &&
    panel.innerHTML.includes('1 advertencias') && panel.innerHTML.includes('FOB alto'));
  check('showValidationPanel: panel visible', panel.style.display === 'block');
  global.hideValidationPanel();
  check('hideValidationPanel: oculta el panel', $id('validationPanel').style.display === 'none');
}

// ============================================
//  18) index.html — shell de importaciones (nav-item + badge + view + script tag)
// ============================================
function testIndexHtmlImportsShell() {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'index.html'), 'utf8');
  check('index.html: nav-item data-view="importaciones" presente',
    html.includes('data-view="importaciones"'));
  check('index.html: badge #navBadgeImp presente',
    html.includes('id="navBadgeImp"'));
  check('index.html: contenedor #view-importaciones presente',
    html.includes('id="view-importaciones"'));
  check('index.html: script src="js/ui/importsView.js" presente (script-integrity)',
    html.includes('src="js/ui/importsView.js"'));
}

// ============================================
//  Runner + resumen
// ============================================
(async () => {
  console.log('🧪 Smoke Tests de app.js (jsdom) — Mambo Pedidos');
  console.log('   Módulo bajo prueba: src/js/app.js (877 LOC) + módulos UI reales compartiendo scope');
  console.log('');

  try { testEscapeHelpers(); } catch (e) { failSection('esc/escJs/hasCatalogImage', e); }
  try { testSyncMarkup(); } catch (e) { failSection('syncMarkup', e); }
  try { testPremiumUI(); } catch (e) { failSection('Premium UI', e); }
  try { testRenderBrandList(); } catch (e) { failSection('renderBrandList', e); }
  try { await testLoadDemoCatalog(); } catch (e) { failSection('loadDemoCatalog', e); }
  try { await testSwitchView(); } catch (e) { failSection('switchView', e); }
  try { await testUpdateBadges(); } catch (e) { failSection('updateBadges', e); }
  try { await testValidarYOarmarPedido(); } catch (e) { failSection('validarYOarmarPedido', e); }
  try { await testArmarPedidoFlow(); } catch (e) { failSection('armarPedido/renderPedido/recalc', e); }
  try { testNegociacionYPresets(); } catch (e) { failSection('syncDescuentoNegociado/presets', e); }
  try { testRemovePedItem(); } catch (e) { failSection('removePedItem', e); }
  try { await testConfirmModal(); } catch (e) { failSection('showConfirm/resolveConfirm', e); }
  try { testToastUndo(); } catch (e) { failSection('toastUndo', e); }
  try { await testDolarRates(); } catch (e) { failSection('fetchLiveDolarRates/dólar', e); }
  try { testUpdateProductImage(); } catch (e) { failSection('updateProductImage', e); }
  try { await testKeydownHandlers(); } catch (e) { failSection('keydown handlers', e); }
  try { testValidationPanelDirect(); } catch (e) { failSection('showValidationPanel/hideValidationPanel', e); }
  try { testIndexHtmlImportsShell(); } catch (e) { failSection('index.html shell importaciones', e); }

  const total = results.pass + results.fail;
  console.log('');
  console.log(`📊 Resumen: ${results.pass}/${total} PASS · ${results.fail} FAIL` +
    (skipped.length ? ` · ${skipped.length} SKIP` : ''));

  dom.window.close();
  process.exit(results.fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('❌ FAIL: la suite lanzó una excepción no capturada: ' + err);
  process.exit(1);
});
