// ============================================
//  Mambo Pedidos - Smoke Tests de la Capa de UI (jsdom)
// ============================================
// Suite de humo sobre src/js/ui/* (notifications, catalogView, modals, importFlow)
// con DOM REAL via jsdom 29 (devDependency). NO modifica ningun archivo de src/js/:
// todos los modulos de UI se cargan en modo SOLO LECTURA via require.
//
// Ejecucion:
//   node scripts/quality/ui-smoke-tests.js   (desde la raiz del repo)
// Exit code 0 si todos los checks pasan.
//
// NOTA: este archivo NO usa 'use strict' a proposito: en Node 21+ `global.navigator`
// es getter-only y asignarlo lanza TypeError. Los modulos de UI no necesitan navigator.
// ============================================

const path = require('path');

const jsPath = file => path.join(__dirname, '..', '..', 'src', 'js', file);

// ─────────────────────────────────────────────
//  DOM real (jsdom) — url con origen http para que localStorage funcione
// ─────────────────────────────────────────────
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <!-- notifications -->
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

  <!-- modals -->
  <div id="imageZoomModal"><img id="imageZoomSrc"><div id="imageZoomCaption"></div></div>
  <div id="supplierCompareModal"><div id="supplierCompareBody"></div></div>
  <div id="sensitivitySimulatorModal"></div>
  <div id="breakEvenModal"></div>
  <div id="doorToDoorModal"></div>
  <div id="brandManagerModal"></div>
  <input id="productImageFileInput">

  <!-- importFlow -->
  <div id="importPreviewModal">
    <div id="badgeValidCount"></div>
    <div id="badgeWarnCount"></div>
    <div id="badgeErrCount"></div>
    <div id="pvCountAll"></div>
    <div id="importPreviewSummary"></div>
    <div id="importPreviewBody"></div>
    <div id="pvGridWrap"><div id="pvConfirmBtn"></div></div>
    <input id="batchBrandInput">
    <select id="batchCatSelect"></select>
  </div>

  <!-- historyView -->
  <div id="historialSubtitle"></div>
  <div id="historialList"></div>

  <!-- importsView -->
  <div id="importsSubtitle"></div>
  <div id="importsList"></div>
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
  console.error('❌ FAIL: sección ' + section + ' lanzó una excepción: ' + (err && err.message ? err.message : err));
}

// ─────────────────────────────────────────────
//  Globals de la app (los mismos que usa app.js en el browser)
// ─────────────────────────────────────────────
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function hasCatalogImage(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(value.trim());
}

const AppStore = {
  _listeners: [],
  subscribe(fn) { this._listeners.push(fn); return () => {}; },
  commit(mutator) { mutator(); this.notify(); },
  notify() { this._listeners.slice().forEach(fn => { try { fn(); } catch { /* listener noop */ } }); }
};

function updateBadges() {}
function scheduleCatalogSave() {}
function toast() {}
function toastUndo() {}
async function showConfirm() { return true; }

Object.assign(global, {
  esc, escJs, hasCatalogImage,
  AppStore, updateBadges, scheduleCatalogSave, toast, toastUndo, showConfirm
});

// Modulos ligeros puros — cargados REALES, igual que scripts/run-tests.js
global.Validations = require(jsPath('validations.js'));
global.SkuAllocator = require(jsPath('skuAllocator.js'));
global.TextSanitizer = require(jsPath('textSanitizer.js'));
global.CatalogValidator = require(jsPath('catalogValidator.js'));
global.ImportsTracker = require(jsPath('importsTracker.js'));

// Backends pesados / en edicion paralela (pdfParser.js NO se toca y NO se carga):
// se stubean para aislar el smoke test en la capa de UI.
global.PdfParser = { processPdfFile: async () => ({ products: [] }) };
// P17 opción 2: lazy-loaders resuelven directo si el global ya existe.
// En jsdom el script NO se ejecuta (sin runScripts), así que stubeamos las libs
// para que ensurePdfLib/ensureXlsxLib tomen el camino "ya cargado" (idempotente).
// OJO: lazyLoaders.js corre en Node (require) → sus free variables (pdfjsLib/XLSX)
// resuelven a globalThis, NO a dom.window → definir en AMBOS al mismo objeto.
global.pdfjsLib = dom.window.pdfjsLib = { GlobalWorkerOptions: {} };
global.XLSX = dom.window.XLSX = {};
let _historial = [];
let _imports = { records: [], counter: 0 };
global.AppStorage = {
  KEYS: { CATALOG: 'mambo_catalog_v2', BRANDS: 'mambo_brands_v1', IMPORTS: 'mambo_imports_v1' },
  loadBrands: async () => [],
  saveCatalog: async () => {},
  saveBrands: async () => {},
  getItem: async (k, d) => d,
  setItem: async () => {},
  removeItem: async () => {},
  loadHistorial: async () => _historial,
  saveHistorial: async (list) => { _historial = list; },
  loadImports: async () => _imports,
  saveImports: async (payload) => { _imports = payload; }
};

// Modulos UI (solo lectura)
const UINotifications = require(jsPath('ui/notifications.js'));
const UIModals = require(jsPath('ui/modals.js'));
require(jsPath('ui/glossary.js')); // define window.tip (tooltips) usado por las vistas
global.tip = global.window.tip;    // las vistas llaman a `tip` como global libre en Node
const CatalogView = require(jsPath('ui/catalogView.js'));
const ImportFlow = require(jsPath('ui/importFlow.js'));

// P17 opción 2: lazy-loaders de librerías pesadas (pdf.js / xlsx)
require(jsPath('lazyLoaders.js')); // define window.ensurePdfLib / ensureXlsxLib
// Puente window -> globalThis (mismo patrón que BRIDGE_GLOBALS más abajo)
if (typeof dom.window.ensurePdfLib === 'function') global.ensurePdfLib = dom.window.ensurePdfLib;
if (typeof dom.window.ensureXlsxLib === 'function') global.ensureXlsxLib = dom.window.ensureXlsxLib;

// En el browser `window` ES el objeto global; aca globalThis !== dom.window, asi que
// los bridges que los modulos hacen en `window.X = ...` no crean variables libres
// globales por si solos. Propagamos los bridges de window -> globalThis para que la
// resolucion de free variables (showProgress, renderCatalog, toast, etc.) funcione
// igual que en el browser.
const BRIDGE_GLOBALS = [
  'UINotifications', 'toast', 'showProgress', 'hideProgress', 'showDropOverlay', 'hideDropOverlay',
  'CatalogView', 'showCatalogContent', 'populateCatalogFilters', 'prevPage', 'nextPage', 'adjustQty',
  'setCatChip', 'clearCatalogFilters', 'renderCatalog', 'debouncedRenderCatalog', 'toggleItem', 'setQty',
  'toggleSelectAll', 'removeItem', 'addCatalogItem', 'resetCatalog', 'updateField', 'setCatalogViewMode',
  'UIModals', 'zoomImage', 'zoomImageByUrl', 'closeImageZoomModal', 'triggerImageUpload',
  'openSupplierCompareModal', 'closeSupplierCompareModal', 'openSensitivitySimulatorModal',
  'closeSensitivitySimulatorModal', 'runSensitivitySimulation', 'openBreakEvenModal', 'closeBreakEvenModal',
  'runBreakEvenCalculation', 'openDoorToDoorModal', 'closeDoorToDoorModal', 'runDoorToDoorCalculation',
  'handleProductImageFile', 'triggerCleanBackground', 'openBrandManagerModal', 'closeBrandManagerModal',
  'addCustomBrand', 'deleteCustomBrand',
  'ImportFlow', 'processFiles', 'renderImportPreviewModal', 'setPreviewFilter', 'setPreviewSearch',
  'updateConfirmCount', 'updatePreviewItem', 'toggleSelectAllPreview', 'applyBatchBrand', 'applyBatchCat',
  'autoCorrectPreview', 'removePreviewItem', 'closeImportPreviewModal', 'confirmImportPreview'
];
for (const k of BRIDGE_GLOBALS) {
  if (typeof dom.window[k] !== 'undefined') global[k] = dom.window[k];
}

// ─────────────────────────────────────────────
//  Fixture de catalogo (modelo / color / precio / imagen)
// ─────────────────────────────────────────────
const IMG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG_JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

global.catalog = [
  { sku: 'KBD-001', marca: 'Logitech', modelo: 'G Pro X Keyboard', variante: 'Negro', cat: 'TECLADO', fob: 89.5, img: IMG_PNG, status: 'GREEN' },
  { sku: 'MSE-002', marca: 'Razer', modelo: 'DeathAdder V3', variante: 'Blanco', cat: 'MOUSE', fob: 64, img: '-', status: 'YELLOW', warnings: ['Imagen faltante'] },
  { sku: 'HPS-003', marca: 'HyperX', modelo: 'Cloud III', variante: 'Rojo', cat: 'HEADSET', fob: 120.25, img: IMG_JPG, status: 'GREEN' }
];
global.selection = {};

// ============================================
//  1) UINotifications — toast, progreso, drop overlay
// ============================================
function testNotifications() {
  UINotifications.toast('Pedido guardado', 'success');
  check('notifications.toast: escribe el mensaje en #toast',
    document.getElementById('toast').textContent === 'Pedido guardado');
  check('notifications.toast: agrega clases show + tipo',
    /(^|\s)show(\s|$)/.test(document.getElementById('toast').className) &&
    /(^|\s)success(\s|$)/.test(document.getElementById('toast').className));

  UINotifications.showProgress(42, 'Procesando archivos...', 'Archivo 1 de 3');
  check('notifications.showProgress: overlay visible (flex)',
    document.getElementById('loadingOverlay').style.display === 'flex');
  check('notifications.showProgress: barra interna al 42%',
    document.getElementById('progressBarInner').style.width === '42%');
  check('notifications.showProgress: porcentaje renderizado',
    document.getElementById('progressPctText').textContent === '42%');
  check('notifications.showProgress: titulo de estado renderizado',
    document.getElementById('progressTitleText').textContent === 'Procesando archivos...');

  UINotifications.showFileProgress(0, 3, 'catalogo.pdf', 50);
  check('notifications.showFileProgress: overall 17% para (0,3,50)',
    document.getElementById('progressPctText').textContent === '17%');

  UINotifications.showDropOverlay();
  check('notifications.showDropOverlay: dropOverlay visible',
    document.getElementById('dropOverlay').style.display === 'flex');
  UINotifications.hideDropOverlay();
  check('notifications.hideDropOverlay: dropOverlay oculto',
    document.getElementById('dropOverlay').style.display === 'none');
}

// ============================================
//  2) CatalogView — render de catalogo fixture, seleccion, grid
// ============================================
function testCatalogView() {
  CatalogView.renderCatalog();
  const bodyHtml = document.getElementById('catalogBody').innerHTML;

  check('catalogView.renderCatalog: no lanza y pinta modelo del producto 1',
    bodyHtml.includes('G Pro X Keyboard'));
  check('catalogView.renderCatalog: pinta modelo del producto 2 (YELLOW con warning)',
    bodyHtml.includes('DeathAdder V3'));
  check('catalogView.renderCatalog: pinta modelo del producto 3',
    bodyHtml.includes('Cloud III'));
  check('catalogView.renderCatalog: subtitulo "3 de 3 productos · 3 marcas"',
    document.getElementById('catalogSubtitle').textContent === '3 de 3 productos · 3 marcas');
  check('catalogView.renderCatalog: KPI total = 3',
    document.getElementById('catKpiTotal').textContent === '3');
  check('catalogView.renderCatalog: indicador "Página 1 de 1"',
    document.getElementById('pageIndicator').textContent === 'Página 1 de 1');
  check('catalogView.renderCatalog: imagen data-URI del item 1 en el HTML',
    bodyHtml.includes('data:image/png'));
  check('catalogView.renderCatalog: fallback SVG para item sin imagen',
    bodyHtml.includes('data:image/svg+xml'));

  CatalogView.populateCatalogFilters();
  const marcaOpts = document.getElementById('catFilterMarca').querySelectorAll('option');
  check('catalogView.populateCatalogFilters: 4 opciones de marca (placeholder + 3)',
    marcaOpts.length === 4);

  CatalogView.toggleItem('KBD-001', true);
  check('catalogView.toggleItem: agrega KBD-001 a selection',
    global.selection['KBD-001'] === 1);
  check('catalogView.toggleItem: re-render con checkbox checked',
    document.getElementById('catalogBody').innerHTML.includes('checked'));
  check('catalogView.toggleItem: sticky bar visible con 1 producto',
    document.getElementById('stickyOrderBar').style.display === 'flex');
  check('catalogView.toggleItem: sticky count "1 producto"',
    document.getElementById('stickySelCount').textContent === '1 producto');
  check('catalogView.toggleItem: hint guiado oculto con seleccion',
    document.getElementById('catalogNextStepHint').style.display === 'none');

  CatalogView.setCatalogViewMode('grid');
  check('catalogView.setCatalogViewMode(grid): grid contiene el modelo',
    document.getElementById('catalogGrid').innerHTML.includes('G Pro X Keyboard'));
  check('catalogView.setCatalogViewMode(grid): tabla oculta',
    document.getElementById('catalogTableWrap').style.display === 'none');
  CatalogView.setCatalogViewMode('table');
  check('catalogView.setCatalogViewMode(table): tabla visible',
    document.getElementById('catalogTableWrap').style.display === 'block');
}

// ============================================
//  3) UIModals — abrir/cerrar zoom y supplier compare
// ============================================
function testModals() {
  UIModals.zoomImage('KBD-001');
  check('modals.zoomImage: modal de zoom visible',
    document.getElementById('imageZoomModal').style.display === 'flex');
  check('modals.zoomImage: src con imagen data-URI del producto',
    document.getElementById('imageZoomSrc').src.indexOf('data:image/png') === 0);
  check('modals.zoomImage: caption "marca modelo (sku)"',
    document.getElementById('imageZoomCaption').textContent === 'Logitech G Pro X Keyboard (KBD-001)');
  UIModals.closeImageZoomModal();
  check('modals.closeImageZoomModal: modal oculto',
    document.getElementById('imageZoomModal').style.display === 'none');
  check('modals.closeImageZoomModal: activeZoomSku reseteado',
    UIModals.activeZoomSku === null);

  // Sin modelos duplicados -> empty state
  UIModals.openSupplierCompareModal();
  check('modals.openSupplierCompareModal: empty state sin duplicados',
    document.getElementById('supplierCompareBody').innerHTML.includes('Sin productos coincidentes'));
  UIModals.closeSupplierCompareModal();
  check('modals.closeSupplierCompareModal: modal oculto',
    document.getElementById('supplierCompareModal').style.display === 'none');

  // Con un modelo duplicado -> tabla de comparacion
  global.catalog.push({ sku: 'KBD-099', marca: 'OtroProveedor', modelo: 'G Pro X Keyboard', variante: 'Negro', cat: 'TECLADO', fob: 82.0, img: '-', status: 'GREEN' });
  UIModals.openSupplierCompareModal();
  const scBody = document.getElementById('supplierCompareBody').innerHTML;
  check('modals.openSupplierCompareModal: detecta duplicado por modelo',
    scBody.includes('G Pro X Keyboard'));
  check('modals.openSupplierCompareModal: marca MEJOR PRECIO',
    scBody.includes('MEJOR PRECIO'));
  UIModals.closeSupplierCompareModal();
  check('modals.closeSupplierCompareModal: oculta el modal de comparacion',
    document.getElementById('supplierCompareModal').style.display === 'none');
}

// ============================================
//  4) ImportFlow — importar con datos falsos sin crash
// ============================================
async function testImportFlow() {
  global.PdfParser.processPdfFile = async () => ({
    products: [
      { sku: 'X1', marca: 'TestBrand', modelo: 'Teclado Pro', variante: 'Negro', cat: 'TECLADO', fob: 45, img: IMG_PNG, status: 'GREEN' }
    ]
  });

  await ImportFlow.processFiles([{ name: 'catalogo.pdf' }]);

  check('importFlow.processFiles: 1 producto en pendingPreviewItems',
    ImportFlow.pendingPreviewItems.length === 1);
  check('importFlow.processFiles: modal de preview visible',
    document.getElementById('importPreviewModal').style.display === 'flex');
  check('importFlow.processFiles: summary con "1 productos detectados"',
    document.getElementById('importPreviewSummary').textContent.includes('1 productos detectados'));
  const previewModelo = ImportFlow.pendingPreviewItems[0].modelo;
  check('importFlow.processFiles: card del preview contiene el modelo (post-sanitización: "' + previewModelo + '")',
    previewModelo && document.getElementById('importPreviewBody').innerHTML.includes(previewModelo));

  const badgeSum =
    parseInt(document.getElementById('badgeValidCount').textContent || '0', 10) +
    parseInt(document.getElementById('badgeWarnCount').textContent || '0', 10) +
    parseInt(document.getElementById('badgeErrCount').textContent || '0', 10);
  check('importFlow.processFiles: badges de semaforo suman 1 (producto evaluado)',
    badgeSum === 1);

  const btnText = document.getElementById('pvConfirmBtn').textContent;
  check('importFlow.processFiles: boton de confirmar formateado ("Importar N seleccionados")',
    /^Importar \d+ seleccionados$/.test(btnText));

  ImportFlow.closeImportPreviewModal();
  check('importFlow.closeImportPreviewModal: modal oculto y cola limpia',
    document.getElementById('importPreviewModal').style.display === 'none' &&
    ImportFlow.pendingPreviewItems.length === 0);
}

async function testHistoryView() {
  const HistoryView = require(jsPath('ui/historyView.js'));

  // Empty state
  _historial = [];
  await HistoryView.render();
  check('historyView.render: empty state "Sin pedidos guardados"',
    document.getElementById('historialList').innerHTML.includes('Sin pedidos guardados'));
  check('historyView.render: subtítulo "0 pedidos guardados"',
    document.getElementById('historialSubtitle').textContent.includes('0 pedidos'));

  // Lista poblada + XSS escapado
  _historial = [
    {
      name: 'Pedido <script>XSS</script>',
      items: [{ sku: 'A1', qty: 2 }, { sku: 'A2', qty: 1 }],
      date: '2026-08-01T00:00:00Z',
      totals: { qty: 3, fob: 100, costo: 150, facturacion: 300, margen: 150 }
    },
    {
      name: 'Pedido Dos',
      items: [{ sku: 'B1', qty: 1 }],
      date: '2026-08-02T00:00:00Z',
      totals: { qty: 1, fob: 50 }
    }
  ];
  await HistoryView.render();
  check('historyView.render: subtítulo "2 pedidos guardados"',
    document.getElementById('historialSubtitle').textContent.includes('2 pedidos'));
  const html = document.getElementById('historialList').innerHTML;
  check('historyView.render: XSS escapado (script no crudo en el HTML)',
    !html.includes('<script>') && html.includes('&lt;script&gt;'));
  check('historyView.render: card con SKUs y FOB formateado',
    html.includes('2 SKUs') && html.includes('$100'));
  check('historyView.render: dos cards renderizadas',
    (html.match(/card-title/g) || []).length === 2);
}

// ============================================
//  5b) ImportsView — dashboard agrupado por estado (import-tracker Slice B)
// ============================================
async function testImportsView() {
  const ImportsView = require(jsPath('ui/importsView.js'));

  // Empty state (precondición: sin registros)
  _imports = { records: [], counter: 0 };
  await ImportsView.render();
  check('importsView.render: empty state "Sin importaciones registradas"',
    document.getElementById('importsList').innerHTML.includes('Sin importaciones registradas'));
  check('importsView.render: subtítulo "0 importaciones"',
    document.getElementById('importsSubtitle').textContent.includes('0 importaciones'));

  // Status board poblado: in_transit + delivered, XSS, ROI "—", rollups
  _imports = {
    records: [
      {
        id: 'r1', number: 'IMP-0001', supplier: 'AliExpress', description: 'Teclado <script>XSS</script>',
        courier: 'DHL', status: 'in_transit',
        dates: { ordered: '2026-08-01T00:00:00Z', in_transit: '2026-08-05T00:00:00Z', in_customs: null, cleared: null, delivered: null },
        finalLandedCostUsd: 100, localPriceUsd: null, tipoCambio: 1400
      },
      {
        id: 'r2', number: 'IMP-0002', supplier: 'Amazon', description: 'Mouse G Pro',
        courier: 'FedEx', status: 'delivered',
        dates: { ordered: '2026-07-10T00:00:00Z', in_transit: null, in_customs: null, cleared: '2026-07-20T00:00:00Z', delivered: '2026-07-25T00:00:00Z' },
        finalLandedCostUsd: 60, localPriceUsd: 90, tipoCambio: 1400
      }
    ],
    counter: 2
  };
  await ImportsView.render();
  const html = document.getElementById('importsList').innerHTML;
  check('importsView.render: subtítulo "2 importaciones"',
    document.getElementById('importsSubtitle').textContent.includes('2 importaciones'));
  check('importsView.render: agrupa por estado — header "En tránsito"',
    html.includes('En tránsito'));
  check('importsView.render: agrupa por estado — header "Entregado"',
    html.includes('Entregado'));
  check('importsView.render: IMP-0001 renderizado bajo su grupo',
    html.includes('IMP-0001'));
  check('importsView.render: IMP-0002 renderizado bajo su grupo',
    html.includes('IMP-0002'));
  check('importsView.render: costo final del registro 1 ($100 USD)',
    html.includes('$100 USD'));
  check('importsView.render: ROI "—" cuando no hay precio local',
    html.includes('>—<'));
  check('importsView.render: ROI 50% con precio local (60 → 90)',
    html.includes('50%'));
  check('importsView.render: couriers renderizados (DHL / FedEx)',
    html.includes('DHL') && html.includes('FedEx'));
  const expectedDate = new Date('2026-08-05T00:00:00Z').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  check('importsView.render: fecha del estado renderizada (' + expectedDate + ')',
    html.includes(expectedDate));
  check('importsView.render: XSS escapado (script no crudo en el HTML)',
    !html.includes('<script>') && html.includes('&lt;script&gt;'));
  check('importsView.render: rollups — total invertido $160 USD',
    html.includes('$160 USD'));
  check('importsView.render: rollups — ganancia $30 USD (solo registros con precio local)',
    html.includes('$30 USD'));
}

// ============================================
//  6) Lazy Loaders (P17 opción 2) — pdf.js / xlsx bajo demanda
// ============================================
function testLazyLoaders() {
  // Caso 1: pdfjsLib presente (stub inicial) → resuelve directo, setea workerSrc, NO inyecta
  return global.ensurePdfLib().then((lib) => {
    check('lazyLoaders.ensurePdfLib: con pdfjsLib presente resuelve sin inyectar script',
      lib === dom.window.pdfjsLib &&
      document.head.querySelectorAll('script[src="vendor/pdf.min.js"]').length === 0);
    check('lazyLoaders.ensurePdfLib: setea workerSrc al worker local',
      dom.window.pdfjsLib.GlobalWorkerOptions.workerSrc === 'vendor/pdf.worker.min.js');

    // Caso 2: XLSX presente (stub inicial) → resuelve directo sin inyectar
    return global.ensureXlsxLib().then((xlib) => {
      check('lazyLoaders.ensureXlsxLib: con XLSX presente resuelve sin inyectar script',
        xlib === dom.window.XLSX &&
        document.head.querySelectorAll('script[src="vendor/xlsx.full.min.js"]').length === 0);

      // Caso 3: XLSX ausente → inyecta UN script y la 2da llamada NO duplica
      delete global.XLSX;
      delete dom.window.XLSX;
      const p1 = global.ensureXlsxLib();
      const p2 = global.ensureXlsxLib();
      const tags = document.head.querySelectorAll('script[src="vendor/xlsx.full.min.js"]');
      check('lazyLoaders.ensureXlsxLib: inyecta exactamente UN tag (idempotente)',
        tags.length === 1 && p1 === p2);
      check('lazyLoaders.ensureXlsxLib: el tag apunta al vendor local',
        tags[0].getAttribute('src') === 'vendor/xlsx.full.min.js');

      // Restauramos el stub para no contaminar otros tests
      global.XLSX = dom.window.XLSX = {};
      document.head.querySelectorAll('script[src="vendor/xlsx.full.min.js"]').forEach(s => s.remove());
      return global.ensureXlsxLib();
    });
  });
}

// ============================================
//  Runner + resumen
// ============================================
(async () => {
  console.log('🧪 Smoke Tests de la Capa de UI (jsdom) — Mambo Pedidos');
  console.log('   Modulos bajo prueba: ui/notifications.js, ui/catalogView.js, ui/modals.js, ui/importFlow.js, ui/historyView.js');
  console.log('');

  try { testNotifications(); } catch (e) { failSection('UINotifications', e); }
  try { testCatalogView(); } catch (e) { failSection('CatalogView', e); }
  try { testModals(); } catch (e) { failSection('UIModals', e); }
  try { await testImportFlow(); } catch (e) { failSection('ImportFlow', e); }
  try { await testHistoryView(); } catch (e) { failSection('HistoryView', e); }
  try { await testImportsView(); } catch (e) { failSection('ImportsView', e); }
  try { await testLazyLoaders(); } catch (e) { failSection('LazyLoaders', e); }

  const total = results.pass + results.fail;
  console.log('');
  console.log(`📊 Resumen: ${results.pass}/${total} PASS · ${results.fail} FAIL` +
    (skipped.length ? ` · ${skipped.length} SKIP` : ''));
  if (skipped.length) {
    console.log('   Skipeados:');
    skipped.forEach(s => console.log(`   ⏭️  ${s.name}: ${s.reason}`));
  }

  dom.window.close();
  process.exit(results.fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('❌ FAIL: la suite lanzó una excepción no capturada: ' + err);
  process.exit(1);
});
