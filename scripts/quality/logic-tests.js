// ============================================
//  Mambo Pedidos - Tests de Lógica de Negocio (logic-tests.js)
// ============================================
// Suite de aserciones reales sobre la lógica pura del negocio:
//   src/js/calculator.js      (presupuestos: totales, cantidades, markup, límites courier)
//   src/js/quoteGenerator.js  (cotización imprimible: estructura, totales, escape de datos)
//   src/js/skuAllocator.js    (identidad global de SKU: unicidad, secuencia, reuso)
//   src/js/storage.js         (persistencia: round-trip, datos corruptos, recuperación)
//
// SOLO LECTURA sobre src/js/: ningún módulo se modifica.
// Complementa src/js/tests.js — NO duplica: cubre huecos de cobertura de
// Calculator/QuoteGenerator/SkuAllocator/AppStorage que tests.js no ejercita.
//
// Ejecución:
//   node scripts/quality/logic-tests.js   (desde la raíz del repo)
// Exit code 0 si todos los checks pasan. Salida: ✅ PASS / ❌ FAIL
// ============================================

const path = require('path');

// ─────────────────────────────────────────────
//  Setup de globals (réplica de scripts/run-tests.js: window=global, localStorage stub)
// ─────────────────────────────────────────────
global.window = global;
try { global.navigator = {}; } catch { /* Node 21+: navigator es getter-only */ }
global.Image = class {};
global.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); }
};

const jsPath = file => path.join(__dirname, '..', '..', 'src', 'js', file);
const Calculator = require(jsPath('calculator.js'));
const QuoteGenerator = require(jsPath('quoteGenerator.js'));
const SkuAllocator = require(jsPath('skuAllocator.js'));
const AppStorage = require(jsPath('storage.js'));

// ─────────────────────────────────────────────
//  Harness: assert + secciones
// ─────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✅ PASS ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`❌ FAIL ${message}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ============================================
//  Calculator — presupuesto, totales, markup, límites
// ============================================
function testCalculator() {
  section('Calculator');

  // parseNum: fallbacks y decimales con coma
  assert(Calculator.parseNum(null, 5) === 5, 'parseNum(null) retorna el default');
  assert(Calculator.parseNum(undefined, 5) === 5, 'parseNum(undefined) retorna el default');
  assert(Calculator.parseNum('', 5) === 5, 'parseNum("") retorna el default');
  assert(Calculator.parseNum('abc', 5) === 5, 'parseNum("abc") retorna el default');
  assert(Calculator.parseNum('1234,56', 0) === 1234.56, 'parseNum("1234,56") parsea decimales con coma');
  // Bug fix (loop 05/08): formatos con separador de miles
  assert(Calculator.parseNum('1.234,56', 0) === 1234.56, 'parseNum("1.234,56") formato AR (miles=punto, decimal=coma)');
  assert(Calculator.parseNum('1,234.56', 0) === 1234.56, 'parseNum("1,234.56") formato US (miles=coma, decimal=punto)');
  assert(Calculator.parseNum('12.5', 0) === 12.5, 'parseNum("12.5") decimal con punto intacto');
  assert(Calculator.parseNum(' 1.234,56 ', 0) === 1234.56, 'parseNum con espacios alrededor (trim)');

  // getCostConfig: defaults de negocio
  const cfg = Calculator.getCostConfig({});
  assert(cfg.fletePct === 0.15 && cfg.markup === 2.5, 'getCostConfig: defaults flete 15% y markup 2.5');
  assert(cfg.tipoCambio === 1400 && cfg.ivaPct === 0.21 && cfg.logisticaModo === 'courier', 'getCostConfig: defaults tipoCambio 1400, IVA 21%, courier');

  // Pedido vacío: sin NaN ni crash
  const empty = Calculator.calculateOrder([]);
  assert(empty.totals.fob === 0 && empty.totals.qty === 0 && empty.totals.costo === 0, 'calculateOrder([]): totales en cero sin NaN');
  assert(Array.isArray(empty.items) && empty.items.length === 0, 'calculateOrder([]): items vacío');

  // Markup: PVP = costoUnitario * markup; margen y ROI por ítem
  const mk = Calculator.calculateOrder([{ sku: 'MK-1', fob: 100, qty: 1 }], { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 2.5, tipoCambio: 1000 });
  assert(mk.items[0].pvp === 250, 'Markup 2.5 sobre costo 100 → PVP 250');
  assert(mk.items[0].margenPct === 60 && mk.items[0].roiPct === 150, 'margenPct 60% y roiPct 150% para markup 2.5');

  // IVA proporcional al FOB de cada ítem
  const iva = Calculator.calculateOrder(
    [{ sku: 'A', fob: 100, qty: 1 }, { sku: 'B', fob: 300, qty: 1 }],
    { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, ivaPct: 21, markup: 1, tipoCambio: 1000 }
  );
  assert(iva.totals.ivaUsd === 84, 'IVA total = 21% del CIF (400 → 84 USD)');
  assert(iva.items[0].subIva === 21 && iva.items[1].subIva === 63, 'IVA distribuido proporcional al FOB (100/300 → 21/63)');

  // Courier: costo por unidad según cantidad total
  const courier = Calculator.calculateOrder(
    [{ sku: 'C-1', fob: 10, qty: 10 }, { sku: 'C-2', fob: 10, qty: 20 }],
    { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 8, markup: 1, tipoCambio: 1000 }
  );
  assert(courier.totals.costo === 300 + 30 * 8, 'Courier: costo incluye 30 unidades × USD 8 (240)');
  assert(courier.totals.fob === 300, 'Courier: FOB total correcto (300 USD)');

  // Importador: despachante fijo en vez de courier por unidad
  const imp = Calculator.calculateOrder([{ sku: 'I-1', fob: 100, qty: 5 }], { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 500, courier: 8, logisticaModo: 'importador', markup: 1, tipoCambio: 1000 });
  assert(imp.totals.costo === 1000, 'Importador: costo = FOB (500) + despacho fijo (500), sin courier por unidad');

  // BUG P10 (IT2, fix 05/08): FOB=0 + flete por peso → el costo fijo NO se perdía
  // (subCosto 0 vs costo real 150). Regresión pinneada: flete por peso se
  // distribuye aunque el FOB total sea 0.
  const zeroFob = Calculator.calculateOrder(
    [{ sku: 'Z-1', fob: 0, qty: 3 }],
    { fleteModo: 'peso', pesoKg: 10, costoPorKg: 15, flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1, tipoCambio: 1000 }
  );
  assert(zeroFob.totals.fob === 0 && zeroFob.totals.costo === 150, 'FOB=0 + flete por peso (10kg × $15): costo total = 150 (el flete NO se pierde)');
  assert(zeroFob.items[0].costoU === 50, 'FOB=0 + flete por peso: costo unitario 150/3 = 50 (distribuido por qty)');
  assert(zeroFob.items[0].subCosto === 150, 'FOB=0 + flete por peso: subCosto = 150 (antes daba 0)');

  // Casos límite courier: especie >3 unidades y peso >50 kg
  const species = Calculator.calculateOrder([{ sku: 'SP-1', fob: 100, qty: 4 }], { logisticaModo: 'courier', flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1, tipoCambio: 1000 });
  assert(species.warnings.some(w => w.code === 'COURIER_SPECIES_WARNING'), 'Presunción de fin comercial cuando qty > 3');
  const weight = Calculator.calculateOrder([{ sku: 'W-1', fob: 100, qty: 1 }], { logisticaModo: 'courier', fleteModo: 'peso', pesoKg: 60, costoPorKg: 12, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1, tipoCambio: 1000 });
  assert(weight.warnings.some(w => w.code === 'COURIER_WEIGHT_EXCEEDED'), 'Warning de peso cuando flete por peso supera 50 kg');
  assert(weight.totals.fleteUsd === 720, 'Flete por peso = 60 kg × 12 USD/kg');

  // Límite FOB 3000: exactamente en el límite NO dispara warning; por encima sí
  const atLimit = Calculator.calculateOrder([{ sku: 'L-1', fob: 3000, qty: 1 }], { logisticaModo: 'courier', flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1, tipoCambio: 1000 });
  assert(!atLimit.warnings.some(w => w.code === 'COURIER_FOB_EXCEEDED'), 'FOB exactamente 3000 no dispara COURIER_FOB_EXCEEDED');
  const overLimit = Calculator.calculateOrder([{ sku: 'L-2', fob: 3000.01, qty: 1 }], { logisticaModo: 'courier', flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1, tipoCambio: 1000 });
  assert(overLimit.warnings.some(w => w.code === 'COURIER_FOB_EXCEEDED'), 'FOB 3000.01 dispara COURIER_FOB_EXCEEDED');

  // estimateItemFreightAndIva
  const est = Calculator.estimateItemFreightAndIva(100, 1000, 0.15, 0.21);
  assert(est.fleteEstUsd === 15 && est.fleteEstArs === 15000 && est.ivaEstUsd === 24.15 && est.ivaEstArs === 24150, 'estimateItemFreightAndIva: flete 15% e IVA 21% sobre CIF');

  // Liquidación puerta a puerta: totales exactos (caso sin gastos fijos)
  const d2d = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'D2D-1', fob: 100, qty: 1, cat: 'TECLADO', modelo: 'K552', variante: 'Black' }],
    { tipoCambio: 1000, pesoKg: 0, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(Math.abs(d2d.summary.totalPuertaUsd - 149.7025) < 1e-9, 'Puerta a puerta: total exacto 149.7025 USD (CIF 116.5 + tributos 33.20, teclado BIT DI 0%/TE 0%)');
  assert(Math.abs(d2d.summary.totalPuertaConIvaUsd - 174.1675) < 1e-9, 'Puerta a puerta: total con IVA 174.1675 USD');
  assert(Math.abs(d2d.summary.costoNetoRealUsd - 116.5) < 1e-9, 'Puerta a puerta: costo neto real = CIF + DI + TE (teclado BIT: DI 0%/TE 0%, sin anticipos recuperables)');
  assert(d2d.items[0].ncm === '8471.60.52', 'NCM 8471.60.52 para TECLADO con cable');
  assert(d2d.items[0].costoPuertaUnitUsd === d2d.summary.totalPuertaUsd, 'Costo unitario puerta == total (un solo ítem, sin gastos fijos)');

  // IT20 (wizard): fletePct y seguroPct configurables en el motor puerta a puerta
  const d2dPct = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'D2D-2', fob: 100, qty: 1, cat: 'MOUSE', modelo: 'G Pro', variante: 'Black' }],
    { tipoCambio: 1000, pesoKg: 0, fletePct: 0.20, seguroPct: 0.02, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(Math.abs(d2dPct.summary.cifTotalUsd - (100 + 20 + 2)) < 1e-9, 'IT20: CIF = FOB + flete 20% + seguro 2% cuando fleteModo=pct');

  // IT21: régimen courier — USD 400 exento, 50% sobre excedente, IVA, sin anticipos
  const courierCalc = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'C-1', fob: 1000, qty: 1, cat: 'MOUSE', modelo: 'X', variante: '' }],
    { tipoCambio: 1000, pesoKg: 0, fletePct: 0.10, seguroPct: 0.01, regimen: 'courier', depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  // CIF = 1000 + 100 + 10 = 1110; excedente = 1110-400 = 710; arancel 50%=355; IVA 1110*0.21=233.1
  assert(Math.abs(courierCalc.summary.cifTotalUsd - 1110) < 1e-9, 'IT21: courier CIF = 1110');
  assert(Math.abs(courierCalc.summary.totalIvaAduanaUsd - 233.1) < 1e-9, 'IT21: courier IVA 21% sobre CIF');
  assert(courierCalc.summary.totalAnticiposRecuperablesUsd === 0, 'IT21: courier NO tiene anticipos (Ganancias/IIBB/IVA adic)');
  assert(courierCalc.regimen === 'courier', 'IT21: resultado etiquetado como régimen courier');

  // IT23: base NCM ARCA cargada + clasificación compuesta (matriz → DI autoritativo)
  const NcmDatabase = require('../../src/js/ncmDatabase.js');
  const ncmDb = require('../../src/data/ncmDatabase.json');
  assert(ncmDb.registros.length > 9000, `IT23: base NCM completa (${ncmDb.registros.length} ≥ 9000)`);
  NcmDatabase._db = ncmDb; NcmDatabase._buildIndex();
  assert(NcmDatabase.byCode('8471.60.53') && NcmDatabase.byCode('8471.60.53').di === 0, 'IT23: mouse (BIT) DI 0% en ARCA');
  assert(NcmDatabase.byCode('8450.11.00') && Math.abs(NcmDatabase.byCode('8450.11.00').di - 0.2) < 1e-9, 'IT23: lavadora DI 20% en ARCA');
  assert(NcmDatabase.byCode('8517.13.00') && NcmDatabase.byCode('8517.13.00').di === 0, 'IT23: celular DI 0% (Decreto 333/25)');

  // Clasificador compuesto: categoria → ncmKey → NCM code + DI de la base
  const keyTecl = Calculator.ncmKeyFor({ cat: 'TECLADO', modelo: 'F75', variante: '' });
  const keyMouse = Calculator.ncmKeyFor({ cat: 'MOUSE', modelo: 'G Pro', variante: 'Wireless' });
  assert(keyTecl === 'TECLADO_CABLE' && Calculator.NCM_MATRIX[keyTecl].ncm === '8471.60.52', 'IT23: teclado → 8471.60.52');
  assert(keyMouse === 'MOUSE_WIRELESS' && Calculator.NCM_MATRIX[keyMouse].ncm === '8471.60.53', 'IT23: mouse wireless → 8471.60.53');
  assert(NcmDatabase.byCode(Calculator.NCM_MATRIX[keyTecl].ncm).di === 0, 'IT23: DI teclado 0% (autoritativo ARCA, no 12%)');
  // ponytail #14: ncmKeyFor unificado con el motor D2D (matriz directa + controladores) — fija el fix
  assert(Calculator.ncmKeyFor({ cat: 'CONTROLLER', modelo: 'Pro', variante: '' }) === 'CONTROLLER_WIRELESS', 'IT23-ncmKey: controlador → CONTROLLER_WIRELESS (no cae a OTRO)');
  assert(Calculator.ncmKeyFor({ cat: 'MONITOR', modelo: '27', variante: '' }) === 'MONITOR', 'IT23-ncmKey: monitor → MONITOR');
  assert(Calculator.ncmKeyFor({ cat: 'LAVADORA', modelo: 'X', variante: '' }) === 'LAVADORA' && Calculator.NCM_MATRIX.LAVADORA.ncm === '8450.11.00', 'IT23-ncmKey: lavadora cae a matriz directa 8450.11.00');
  assert(Calculator.ncmKeyFor({ cat: 'TV', modelo: '55', variante: '' }) === 'TV', 'IT23-ncmKey: TV → TV');
  const d2dLav = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'D2D-L', fob: 100, qty: 1, cat: 'LAVADORA', modelo: 'X', variante: '' }],
    { tipoCambio: 1000, pesoKg: 0, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(d2dLav.items[0].ncm === '8450.11.00' && Math.abs(d2dLav.items[0].derechosUsd / d2dLav.summary.cifTotalUsd - 0.20) < 1e-9, 'IT23-ncmKey: D2D lavadora usa la matriz directa (DI 20%), no OTRO');

  // IT30: default de derechos NCM-aware (teclado BIT → 0%, no 16% stale)
  const cfgTecl = Calculator.getCostConfig({}, [{ cat: 'TECLADO', modelo: 'F75', variante: '' }]);
  assert(Math.abs(cfgTecl.derechos - 0) < 1e-9, `IT30: default derechos para teclado BIT = 0% (got ${cfgTecl.derechos})`);
  const cfgStale = Calculator.getCostConfig({}, [{ cat: 'LAVADORA', modelo: 'X', variante: '' }]);
  assert(Math.abs(cfgStale.derechos - 0.2) < 1e-9, 'IT30: default derechos para lavadora = 20%');
  const cfgOverride = Calculator.getCostConfig({ derechos: 10 }, [{ cat: 'TECLADO', modelo: 'F75', variante: '' }]);
  assert(Math.abs(cfgOverride.derechos - 0.10) < 1e-9, 'IT30: override del usuario mantiene prioridad');

  // IT33: markup por categoría (precedencia override > matriz-default > global)
  assert(Math.abs(Calculator.getMarkup('CABLE', 2.5, null) - 2.0) < 1e-9, 'IT33: cable usa markup de matriz (2.0)');
  assert(Math.abs(Calculator.getMarkup('TECLADO', 2.0, null) - 2.0) < 1e-9, 'IT33: markup global explícito (2.0) gana sobre matriz');
  assert(Math.abs(Calculator.getMarkup('CABLE', 2.5, { CABLE: 3.0 }) - 3.0) < 1e-9, 'IT33: override por categoría gana');
  assert(Math.abs(Calculator.getMarkup('GATO', 2.5, null) - 2.5) < 1e-9, 'IT33: categoría desconocida usa default');
  const pvpCable = Calculator.getMarkup('CABLE', 2.5, null);
  const pvpTecl = Calculator.getMarkup('TECLADO', 2.5, null);
  assert(Math.abs(pvpCable - 2.0) < 1e-9 && Math.abs(pvpTecl - 2.5) < 1e-9, 'IT33: cable y teclado tienen márgenes distintos en default');

  // IT23: override de NCM por categoría (código + DI) se refleja en el motor
  const d2dOv = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'M-1', fob: 100, qty: 1, cat: 'MOUSE', modelo: 'X', variante: '' }],
    { tipoCambio: 1000, pesoKg: 0, fletePct: 0.1, seguroPct: 0.01, ncmOverrides: { MOUSE_CABLE: { ncm: '8471.60.53', derechos: 0.05 } }, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(d2dOv.items[0].ncm === '8471.60.53', 'IT23: motor usa el NCM override por categoría');
  assert(Math.abs(d2dOv.items[0].derechosUsd - (100 + 10 + 1) * 0.05) < 1e-9, 'IT23: motor usa el DI override (5%)');

  // IT40: override NCM con utilidad real — el código elegido reemplaza al de la
  // matriz y, si mapea a OTRA entrada (ej: NCM de mousepad en un teclado), se
  // usan sus rates completos.
  const d2dMatch = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'N-1', fob: 100, qty: 1, cat: 'TECLADO', modelo: 'Mecánico', variante: '' }],
    { tipoCambio: 1000, pesoKg: 0, fletePct: 0, seguroPct: 0, ncmOverrides: { TECLADO_CABLE: { ncm: '3926.90.90', derechos: 0.35 } }, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(d2dMatch.items[0].ncm === '3926.90.90', 'IT40: NCM override reemplaza al de la matriz en el resultado');
  assert(Math.abs(d2dMatch.items[0].tasaUsd - 100 * 0.03) < 1e-9, 'IT40: override mapea a MOUSEPAD → usa sus rates (TE 3%)');
  assert(Math.abs(d2dMatch.items[0].derechosUsd - 100 * 0.35) < 1e-9, 'IT40: DI del override (35%)');

  // IT40: NCM no mapeado a la matriz → se muestra en el resultado, mantiene los
  // rates estructurales de la categoría y usa el DI del override.
  const d2dNoMatch = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'NM-1', fob: 100, qty: 1, cat: 'TECLADO', modelo: 'X', variante: '' }],
    { tipoCambio: 1000, pesoKg: 0, fletePct: 0, seguroPct: 0, ncmOverrides: { TECLADO_CABLE: { ncm: '8517.62.00', derechos: 0.10 } }, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(d2dNoMatch.items[0].ncm === '8517.62.00', 'IT40: NCM no mapeado se muestra igual en el resultado');
  assert(Math.abs(d2dNoMatch.items[0].tasaUsd - 0) < 1e-9, 'IT40: NCM no mapeado mantiene rates estructurales (teclado TE 0%)');
  assert(Math.abs(d2dNoMatch.items[0].derechosUsd - 100 * 0.10) < 1e-9, 'IT40: DI del override no mapeado (10%)');

  // Puerta a puerta: certificaciones inalámbricas suman costo (ENACOM 350 + LITIO 75)
  const d2dW = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'D2D-W', fob: 100, qty: 1, cat: 'MOUSE', modelo: 'M185', variante: 'Wireless' }],
    { tipoCambio: 1000, pesoKg: 0, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 }
  );
  assert(d2dW.summary.totalCertsCostUsd === 425 && d2dW.certificationsRequired.length === 2, 'Certificaciones ENACOM(350) + LITIO(75) = 425 USD');
}

// ============================================
//  QuoteGenerator — cotización imprimible y escape
// ============================================
function testQuoteGenerator() {
  section('QuoteGenerator');

  // esc(): escape de HTML para datos de catálogo (XSS)
  assert(QuoteGenerator.esc('<script>"&') === '&lt;script&gt;&quot;&amp;', 'esc() escapa <, >, " y &');
  assert(QuoteGenerator.esc(null) === '' && QuoteGenerator.esc(undefined) === '', 'esc() tolera null/undefined');

  // formatCurrency: ceros, decimales y fallback de locale inválido
  assert(QuoteGenerator.formatCurrency(0).includes('0,00'), 'formatCurrency(0) muestra 0,00');
  assert(QuoteGenerator.formatCurrency(1.5, { locale: 'en-US', currency: 'USD', decimals: 0 }) === '$2', 'formatCurrency redondea con decimals=0');
  const badLocale = QuoteGenerator.formatCurrency(1234.56, { locale: 'xx-INVALID', currency: 'USD' });
  assert(typeof badLocale === 'string' && badLocale.includes('1.234,56') || typeof badLocale === 'string' && badLocale.includes('1234.56'), 'formatCurrency degrada sin crash con locale inválido (fallback de separadores)');

  // HTML generado: estructura, totales y datos escapados
  let opened = false;
  let writtenHtml = '';
  const fakeWin = { document: { write: (h) => { writtenHtml += h; }, close() {} } };
  const origOpen = window.open;
  window.open = () => { opened = true; return fakeWin; };

  const maliciousPedido = {
    name: 'Pedido <b>X</b>',
    date: new Date('2026-01-15T10:00:00').toISOString(),
    items: [{
      sku: 'SKU-<script>alert(1)</script>',
      marca: 'AULA',
      modelo: '<img src=x onerror=alert(1)>',
      color: 'Blue',
      qty: 2,
      pvp: 50.0,
      subPvp: 100.0
    }],
    totals: { facturacion: 100.0, facturacionArs: 140000, tipoCambio: 1400, qty: 2 }
  };

  try {
    QuoteGenerator.generatePrintableQuote(maliciousPedido);
  } finally {
    window.open = origOpen;
  }

  assert(opened, 'generatePrintableQuote abre la ventana imprimible');
  assert(writtenHtml.includes('COTIZACIÓN') && writtenHtml.includes('TOTAL FINAL'), 'HTML contiene encabezado COTIZACIÓN y bloque TOTAL FINAL');
  assert(/100[.,]00/.test(writtenHtml), 'HTML muestra el subtotal facturado (100.00/100,00 USD)');
  assert(writtenHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'HTML contiene el payload malicioso escapado');
  assert(!writtenHtml.includes('<script>alert(1)') && !writtenHtml.includes('<img src=x'), 'HTML NO contiene HTML crudo de los datos del ítem (XSS bloqueado)');
  assert(writtenHtml.includes('Pedido &lt;b&gt;X&lt;/b&gt;'), 'Nombre del pedido escapado en el título');
  assert(writtenHtml.includes('Cliente Mayorista') && writtenHtml.includes('Mambo Pedidos'), 'Defaults de cliente/empresa aplicados sin companyInfo');

  // IT24: número de cotización secuencial + config persistente
  const n1 = QuoteGenerator.nextNumber();
  const n2 = QuoteGenerator.nextNumber();
  assert(/^NQ-\d{4}$/.test(n1) && n2 > n1, `IT24: número secuencial incrementa (${n1} → ${n2})`);
  QuoteGenerator.saveConfig({ companyName: 'Mi Empresa', cuit: '30-12345678-9' });
  const cfg = QuoteGenerator.getConfig();
  assert(cfg.companyName === 'Mi Empresa' && cfg.cuit === '30-12345678-9', 'IT24: config de cotización persistida y recuperada');
  assert(typeof QuoteGenerator.exportCsv === 'function', 'IT24: exportCsv implementado');

  // Sin items: retorna sin abrir ventana
  let openedEmpty = false;
  const origOpen2 = window.open;
  window.open = () => { openedEmpty = true; return fakeWin; };
  try {
    const ret = QuoteGenerator.generatePrintableQuote({ name: 'Vacío', items: [] });
    QuoteGenerator.generatePrintableQuote(null);
    assert(ret === undefined && !openedEmpty, 'Pedido sin ítems (o null) retorna undefined sin abrir ventana');
  } finally {
    window.open = origOpen2;
  }
}

// ============================================
//  SkuAllocator — normalización, unicidad, secuencia, reuso
// ============================================
function testSkuAllocator() {
  section('SkuAllocator');

  // normalizeSku
  assert(SkuAllocator.normalizeSku('  Logitech G203  ') === 'LOGITECH-G203', 'normalizeSku: trim + uppercase + espacios a guión');
  assert(SkuAllocator.normalizeSku('Redragon K552!!! RGB') === 'REDRAGON-K552-RGB', 'normalizeSku: caracteres especiales a guión');
  assert(SkuAllocator.normalizeSku('--ABC--') === 'ABC', 'normalizeSku: limpia guiones iniciales/finales');
  assert(SkuAllocator.normalizeSku('A'.repeat(80)).length === 50, 'normalizeSku: trunca a 50 caracteres');

  // hash FNV-1a determinista
  assert(SkuAllocator.hash('') === '811C9DC5', 'hash FNV-1a de string vacío = 811C9DC5');
  assert(SkuAllocator.hash('a') !== SkuAllocator.hash('b'), 'hash distinto para inputs distintos');

  // generatedSku: formato BRAND-CAT-SLUG-HASH4 (legible), determinista, sensible al salt
  const gen = SkuAllocator.generatedSku({ marca: 'Logitech', modelo: 'G203', variante: 'Black', cat: 'MOUSE' }, '');
  assert(/^[A-Z]{1,3}-[A-Z]{1,3}-[A-Z0-9]{1,8}-[0-9A-F]{4}$/.test(gen) && gen.includes('G203'), `generatedSku formato legible con slug del modelo (got "${gen}")`);
  assert(SkuAllocator.generatedSku({ marca: 'Logitech', modelo: 'G203', variante: 'Black', cat: 'MOUSE' }, '') === gen, 'generatedSku es determinista para el mismo identity+salt');
  assert(SkuAllocator.generatedSku({ marca: 'AULA', modelo: 'F75', cat: 'TECLADO' }, '#1234') !== SkuAllocator.generatedSku({ marca: 'AULA', modelo: 'F75', cat: 'TECLADO' }, ''), 'Salt distinto → SKU generado distinto');

  // IT27: parseo DRY compartido (CSV y Excel producen los mismos items)
  const FileImporter = require('../../src/js/fileImporter.js');
  const parsed = FileImporter._parseItems([
    { 'Modelo': 'F75', 'Marca': 'AULA', 'Categoría': 'Teclado', 'FOB USD': '31.75', 'SKU': 'TEC-001' },
    { 'Modelo': 'G203', 'Marca': 'Logitech', 'Categoría': 'Mouse', 'FOB USD': '20.00' },
    { 'Marca': 'X', 'FOB USD': '10' },          // sin modelo → skip
    { 'Modelo': 'Y', 'Marca': 'Z', 'FOB USD': '' } // sin FOB → skip
  ], []);
  assert(parsed.items.length === 2, `IT27: _parseItems importa 2 filas válidas (got ${parsed.items.length})`);
  assert(parsed.items[0].sku === 'TEC-001' && parsed.items[0].fob === 31.75, 'IT27: SKU y FOB resueltos');
  assert(parsed.items[1].sku.length > 0, 'IT27: SKU auto-generado cuando falta');
  assert(parsed.skippedNoModel === 1 && parsed.skippedNoFob === 1, 'IT27: filas incompletas contadas');

  // IT29: error log persistido + exportable
  const Reliability = require('../../src/js/reliability.js');
  Reliability._loadPersistedErrors();
  const beforeCount = Reliability.getErrorLog().length;
  Reliability._recordError('test', 'error de prueba persistido');
  const after = Reliability.getErrorLog();
  assert(after.length === beforeCount + 1 && after[after.length - 1].message.includes('prueba'), 'IT29: _recordError persiste el error');
  assert(typeof Reliability.exportErrorLog === 'function', 'IT29: exportErrorLog disponible');

  // allocateBatch: entradas inválidas
  assert(Array.isArray(SkuAllocator.allocateBatch('nope', [])) && SkuAllocator.allocateBatch('nope', []).length === 0, 'allocateBatch con input no-array retorna []');
  const withNulls = [{ sku: '', marca: 'AULA', modelo: 'F75', cat: 'TECLADO' }, null, undefined, 'string'];
  SkuAllocator.allocateBatch(withNulls, []);
  assert(withNulls[0].sku.length > 0 && withNulls[1] === null, 'allocateBatch saltea entradas null/string sin crash');

  // Unicidad y secuencia: misma identidad → mismo SKU entre corridas
  const b1 = [{ marca: 'Logitech', modelo: 'G203', variante: 'Black', cat: 'MOUSE', sku: '' }];
  const b2 = [{ marca: 'Logitech', modelo: 'G203', variante: 'Black', cat: 'MOUSE', sku: '' }];
  SkuAllocator.allocateBatch(b1, []);
  SkuAllocator.allocateBatch(b2, []);
  assert(b1[0].sku === b2[0].sku, 'SKU generado es determinista entre corridas (misma identidad)');

  // Reuso: una identidad ya asignada en existing se reutiliza
  const b3 = [{ marca: 'Logitech', modelo: 'G203', variante: 'Black', cat: 'MOUSE', sku: '' }];
  SkuAllocator.allocateBatch(b3, [{ ...b1[0] }]);
  assert(b3[0].sku === b1[0].sku, 'Reuso: identidad existente conserva su SKU global (no regenera)');

  // Colisión dentro del mismo lote: SKU ajeno no se sobrescribe, queda registro
  const batch = [
    { sku: 'SHARED-1', marca: 'VGN', modelo: 'F1', variante: 'Black', cat: 'MOUSE' },
    { sku: 'SHARED-1', marca: 'AULA', modelo: 'F75', variante: 'White', cat: 'TECLADO' }
  ];
  SkuAllocator.allocateBatch(batch, []);
  assert(batch[0].sku === 'SHARED-1' && batch[1].sku !== 'SHARED-1', 'Colisión: el dueño conserva su SKU y el intruso recibe uno nuevo');
  assert(batch[1].skuCollision && batch[1].skuCollision.sourceSku === 'SHARED-1', 'Colisión: item intruso registra skuCollision.sourceSku');
  assert(Array.isArray(batch[1].warnings) && batch[1].warnings[0].includes('colisionó'), 'Colisión: warning legible agregado al ítem');
  assert(new Set(batch.map(i => i.sku)).size === 2, 'Colisión: todos los SKU asignados son únicos');
}

// ============================================
//  AppStorage — round-trip, datos corruptos, recuperación
// ============================================
async function testAppStorage() {
  section('AppStorage');

  // Round-trip básico
  await AppStorage.setItem('k-round', { a: 1, b: [2, 3] });
  const round = await AppStorage.getItem('k-round');
  assert(round && round.a === 1 && round.b.length === 2, 'setItem/getItem round-trip preserva el objeto');

  // Clave faltante → defaultValue
  assert((await AppStorage.getItem('k-missing', 'DEFAULT')) === 'DEFAULT', 'getItem de clave inexistente retorna defaultValue');

  // JSON corrupto en localStorage → defaultValue sin crash
  localStorage.setItem('k-broken', '{esto-no-es-json');
  assert((await AppStorage.getItem('k-broken', 'DEFAULT')) === 'DEFAULT', 'getItem con JSON corrupto retorna defaultValue');

  // removeItem
  await AppStorage.removeItem('k-round');
  assert((await AppStorage.getItem('k-round', null)) === null, 'removeItem elimina la clave');

  // Historial y marcas
  await AppStorage.saveHistorial([{ name: 'Pedido 1', qty: 5 }]);
  const hist = await AppStorage.loadHistorial();
  assert(Array.isArray(hist) && hist.length === 1 && hist[0].name === 'Pedido 1', 'saveHistorial/loadHistorial round-trip');
  await AppStorage.saveBrands(['AULA', 'Logitech']);
  const brands = await AppStorage.loadBrands();
  assert(Array.isArray(brands) && brands.length === 2 && brands[0] === 'AULA', 'saveBrands/loadBrands round-trip');

  // loadCatalog: JSON corrupto → default seguro
  localStorage.setItem(AppStorage.KEYS.CATALOG, '{corrupto');
  const corrupt = await AppStorage.loadCatalog();
  assert(Array.isArray(corrupt.items) && corrupt.items.length === 0 && corrupt.sel && typeof corrupt.sel === 'object', 'loadCatalog con JSON corrupto retorna {items:[], sel:{}}');

  // loadCatalog: saneo de items (fob inválido, img inválida, variante/color, cat mayúsculas, nulls)
  localStorage.setItem(AppStorage.KEYS.CATALOG, JSON.stringify({
    items: [
      { sku: 'x ', marca: 'logitech', modelo: '', cat: 'mouse', fob: 'abc', img: 'http://no-data-url', color: 'White' },
      null,
      { sku: 'OK-1', marca: 'AULA', modelo: 'F75', cat: 'TECLADO', fob: 40, img: '-' }
    ],
    sel: {}
  }));
  const sanitized = await AppStorage.loadCatalog();
  assert(sanitized.items.length === 2, 'loadCatalog descarta items null/no-objeto');
  const s0 = sanitized.items[0];
  assert(s0.sku === 'X' && s0.cat === 'MOUSE', 'loadCatalog normaliza sku (mayúsculas) y cat (uppercase)');
  assert(s0.fob === 0 && s0.img === '-', 'loadCatalog repara fob inválido (→0) e img inválida (→-)');
  assert(s0.variante === 'White' && s0.modelo === 'Producto', 'loadCatalog promueve color→variante y aplica modelo default');

  // loadCatalog: remapeo de selección por SKU (descarta huérfanos y qty 0)
  localStorage.setItem(AppStorage.KEYS.CATALOG, JSON.stringify({
    items: [
      { sku: 'S1', marca: 'AULA', modelo: 'M1', cat: 'TECLADO', fob: 10 },
      { sku: 'S2', marca: 'AULA', modelo: 'M2', cat: 'MOUSE', fob: 10 }
    ],
    sel: { S1: 3, S2: 0, GONE: 5 }
  }));
  const remapped = await AppStorage.loadCatalog();
  assert(remapped.sel.S1 === 3 && remapped.sel.S2 === undefined && remapped.sel.GONE === undefined, 'loadCatalog remapea selección: conserva qty>0, descarta huérfanos y qty 0');

  // _stripForQuota: nivel 1 (imágenes) y nivel deep (evaluaciones/warnings)
  const payload = {
    items: [{ sku: 'ST-1', img: 'data:image/png;base64,AAAA', _evaluations: [1, 2], warnings: ['w'], sourceWarnings: ['sw'], fob: 5 }]
  };
  const lvl1 = AppStorage._stripForQuota(payload);
  assert(lvl1.items[0].img === '-' && lvl1.items[0]._evaluations.length === 2, '_stripForQuota nivel 1: imágenes a "-", conserva evaluaciones');
  const deep = AppStorage._stripForQuota(payload, true);
  assert(deep.items[0]._evaluations === undefined && deep.items[0].warnings === undefined && deep.items[0].sourceWarnings === undefined, '_stripForQuota deep: elimina evaluaciones y warnings');
  assert(deep.items[0].fob === 5 && deep.items[0].sku === 'ST-1', '_stripForQuota no pierde datos esenciales');

  // saveCatalog/loadCatalog integración
  await AppStorage.saveCatalog(
    [{ sku: 'INT-001', marca: 'AULA', modelo: 'F75', cat: 'TECLADO', fob: 40 }],
    { 'INT-001': 3 }
  );
  const integrated = await AppStorage.loadCatalog();
  assert(integrated.items.length === 1 && integrated.items[0].sku === 'INT-001' && integrated.items[0].fob === 40, 'saveCatalog/loadCatalog round-trip de items');
  assert(integrated.sel['INT-001'] === 3, 'saveCatalog/loadCatalog conserva la selección');

  // loadCatalogWithEvidence: JSON corrupto → restaurado false, sin crash
  localStorage.setItem(AppStorage.KEYS.CATALOG, '{{{no-json');
  const ev = await AppStorage.loadCatalogWithEvidence();
  assert(ev.evidence.restored === false && Array.isArray(ev.items) && ev.items.length === 0, 'loadCatalogWithEvidence con datos corruptos → restored=false, items vacío');
}

// ============================================
//  Import Storage — round-trip, empty state, reload survival, isolation
// ============================================
async function testImportStorage() {
  section('Import Storage');

  // Round-trip: save payload with records + counter, load back intact
  const payload = {
    records: [
      { id: 'r1', number: 'IMP-0001', supplier: 'AliExpress', description: 'Teclado', status: 'ordered' },
      { id: 'r2', number: 'IMP-0002', supplier: 'Amazon', description: 'Mouse', status: 'in_transit' }
    ],
    counter: 2
  };
  await AppStorage.saveImports(payload);
  const loaded = await AppStorage.loadImports();
  assert(loaded !== null && typeof loaded === 'object', 'saveImports/loadImports: loaded payload is an object');
  assert(Array.isArray(loaded.records) && loaded.records.length === 2, 'saveImports/loadImports: 2 records loaded');
  assert(loaded.records[0].number === 'IMP-0001' && loaded.records[0].supplier === 'AliExpress', 'saveImports/loadImports: record 1 fields intact');
  assert(loaded.records[1].number === 'IMP-0002' && loaded.records[1].status === 'in_transit', 'saveImports/loadImports: record 2 fields intact');
  assert(loaded.counter === 2, 'saveImports/loadImports: counter preserved');

  // Empty state: load with no stored data returns default empty collection
  await AppStorage.removeItem(AppStorage.KEYS.IMPORTS);
  const empty = await AppStorage.loadImports();
  assert(empty !== null && typeof empty === 'object', 'loadImports on empty: returns an object');
  assert(Array.isArray(empty.records) && empty.records.length === 0, 'loadImports on empty: records is empty array');
  assert(empty.counter === 0, 'loadImports on empty: counter is 0');

  // Reload survival: save, then load again (simulating app restart)
  await AppStorage.saveImports({
    records: [{ id: 'r3', number: 'IMP-0003', supplier: 'MercadoLibre', description: 'Monitor', status: 'ordered' }],
    counter: 3
  });
  const reloaded = await AppStorage.loadImports();
  assert(reloaded.records.length === 1, 'reload survival: 1 record survives reload');
  assert(reloaded.records[0].number === 'IMP-0003' && reloaded.records[0].supplier === 'MercadoLibre', 'reload survival: record fields survive reload');
  assert(reloaded.counter === 3, 'reload survival: counter survives reload');

  // Storage isolation: IMPORTS key does not pollute HISTORIAL
  await AppStorage.saveImports({
    records: [{ id: 'iso1', number: 'IMP-0004', supplier: 'eBay', description: 'Auriculares', status: 'ordered' }],
    counter: 4
  });
  const hist = await AppStorage.loadHistorial();
  const importsInHist = hist.some(h => h.number && h.number.startsWith('IMP-'));
  assert(!importsInHist, 'storage isolation: no import record leaks into quote history');
  const imports = await AppStorage.loadImports();
  assert(imports.records.length === 1 && imports.records[0].number === 'IMP-0004', 'storage isolation: imports still loadable after checking history');
  assert(imports.records[0].supplier === 'eBay', 'storage isolation: import record fields intact after cross-read');
}

// ============================================
//  Import Tracker — numbering, status machine, profitability, rollups
// ============================================
function testImportTracker() {
  section('Import Tracker');

  const ImportsTracker = require('../../src/js/importsTracker.js');

  // ── Record creation defaults ──
  const r1 = ImportsTracker.createRecord({ counter: 0, records: [] }, {
    supplier: 'AliExpress', description: 'Teclado mecánico', fobTotalUsd: 50
  });
  assert(r1.record.number === 'IMP-0001', 'createRecord: first record gets IMP-0001');
  assert(r1.record.status === 'ordered', 'createRecord: default status is ordered');
  assert(r1.record.supplier === 'AliExpress' && r1.record.description === 'Teclado mecánico', 'createRecord: supplier and description preserved');
  assert(r1.record.fobTotalUsd === 50, 'createRecord: fobTotalUsd preserved');
  assert(r1.payload.counter === 1, 'createRecord: counter incremented to 1');
  assert(typeof r1.record.id === 'string' && r1.record.id.length > 0, 'createRecord: id is a non-empty string');
  assert(r1.record.freightUsd === 0, 'createRecord: freightUsd defaults to 0');
  assert(r1.record.insuranceUsd === 0, 'createRecord: insuranceUsd defaults to 0');
  assert(r1.record.courier === '', 'createRecord: courier defaults to empty string');
  assert(r1.record.finalLandedCostUsd === 0, 'createRecord: finalLandedCostUsd defaults to 0');
  assert(r1.record.localPriceUsd === null, 'createRecord: localPriceUsd defaults to null');
  assert(r1.record.tipoCambio === 0, 'createRecord: tipoCambio defaults to 0');
  assert(r1.record.notes === '', 'createRecord: notes defaults to empty string');
  assert(typeof r1.record.dates === 'object' && r1.record.dates.ordered !== null, 'createRecord: dates.ordered is set');

  // ── Sequential numbering, no reuse after deletion ──
  const s1 = ImportsTracker.createRecord({ counter: 0, records: [] }, { supplier: 'S1', description: 'Item 1', fobTotalUsd: 10 });
  const s2 = ImportsTracker.createRecord(s1.payload, { supplier: 'S2', description: 'Item 2', fobTotalUsd: 20 });
  assert(s1.record.number === 'IMP-0001', 'numbering: first is IMP-0001');
  assert(s2.record.number === 'IMP-0002', 'numbering: second is IMP-0002');

  // Delete IMP-0002 and create a new one — MUST be IMP-0003, not IMP-0002
  const afterDelete = {
    records: s2.payload.records.filter(r => r.number !== 'IMP-0002'),
    counter: s2.payload.counter
  };
  const s3 = ImportsTracker.createRecord(afterDelete, { supplier: 'S3', description: 'Item 3', fobTotalUsd: 30 });
  assert(s3.record.number === 'IMP-0003', 'numbering: after deletion, new record is IMP-0003 (no reuse)');
  assert(s3.payload.counter === 3, 'numbering: counter is 3 after deletion + new');

  // ── Status machine: valid transitions ──
  let rec = { ...s1.record };
  const advance = (to) => {
    const result = ImportsTracker.advanceStatus(rec, to);
    rec = result.record || rec;
    return result;
  };

  // ordered → in_transit
  const t1 = advance('in_transit');
  assert(t1.ok === true, 'status: ordered → in_transit is valid');
  assert(rec.status === 'in_transit', 'status: ordered → in_transit updated');
  assert(rec.dates.in_transit !== null, 'status: ordered → in_transit date set');

  // in_transit → in_customs
  const t2 = advance('in_customs');
  assert(t2.ok === true, 'status: in_transit → in_customs is valid');
  assert(rec.status === 'in_customs', 'status: in_transit → in_customs updated');
  assert(rec.dates.in_customs !== null, 'status: in_transit → in_customs date set');

  // in_customs → cleared
  const t3 = advance('cleared');
  assert(t3.ok === true, 'status: in_customs → cleared is valid');
  assert(rec.status === 'cleared', 'status: in_customs → cleared updated');
  assert(rec.dates.cleared !== null, 'status: in_customs → cleared date set');

  // cleared → delivered
  const t4 = advance('delivered');
  assert(t4.ok === true, 'status: cleared → delivered is valid');
  assert(rec.status === 'delivered', 'status: cleared → delivered updated');
  assert(rec.dates.delivered !== null, 'status: cleared → delivered date set');

  // ── Status machine: cancelled from non-terminal status ──
  let rec2 = { ...s1.record };
  const cancelFromOrdered = ImportsTracker.advanceStatus(rec2, 'cancelled');
  assert(cancelFromOrdered.ok === true, 'status: ordered → cancelled is valid');
  assert(cancelFromOrdered.record.status === 'cancelled', 'status: ordered → cancelled updated');
  rec2 = cancelFromOrdered.record;

  // ── Status machine: invalid transitions rejected without mutation ──
  let rec3 = { ...s1.record };
  const snapshot = JSON.stringify(rec3);
  const invalid1 = ImportsTracker.advanceStatus(rec3, 'delivered');
  assert(invalid1.ok === false, 'status: ordered → delivered is invalid');
  assert(rec3.status === 'ordered', 'status: invalid transition does not mutate status');
  assert(JSON.stringify(rec3) === snapshot, 'status: invalid transition does not mutate record at all');

  // ── Status machine: terminal states ──
  let delivered = { ...s1.record, status: 'delivered' };
  const fromDelivered = ImportsTracker.advanceStatus(delivered, 'in_transit');
  assert(fromDelivered.ok === false, 'status: delivered is terminal — cannot transition');
  assert(delivered.status === 'delivered', 'status: delivered unchanged after rejected transition');

  let cancelled = { ...s1.record, status: 'cancelled' };
  const fromCancelled = ImportsTracker.advanceStatus(cancelled, 'cleared');
  assert(fromCancelled.ok === false, 'status: cancelled is terminal — cannot transition');
  assert(cancelled.status === 'cancelled', 'status: cancelled unchanged after rejected transition');

  // ── Profitability: per-record ──
  const profitRec = {
    finalLandedCostUsd: 100, localPriceUsd: 150, tipoCambio: 1000
  };
  const prof = ImportsTracker.computeProfitability(profitRec);
  assert(prof.available === true, 'profitability: available when local price exists');
  assert(prof.profitUsd === 50, 'profitability: profit = 150 - 100 = 50');
  assert(Math.abs(prof.roiPct - 50) < 1e-9, 'profitability: ROI = 50/100 = 50%');
  assert(prof.profitArs === 50000, 'profitability: profitArs = 50 * 1000');
  assert(prof.landedCostUsd === 100, 'profitability: landedCostUsd preserved');
  assert(prof.localPriceUsd === 150, 'profitability: localPriceUsd preserved');

  // ── Profitability: break-even ──
  const beRec = { finalLandedCostUsd: 100, localPriceUsd: 100, tipoCambio: 1400 };
  const be = ImportsTracker.computeProfitability(beRec);
  assert(be.available === true, 'profitability break-even: available');
  assert(be.profitUsd === 0, 'profitability break-even: profit = 0');
  assert(be.roiPct === 0, 'profitability break-even: ROI = 0%');

  // ── Profitability: more expensive ──
  const expRec = { finalLandedCostUsd: 200, localPriceUsd: 150, tipoCambio: 1000 };
  const exp = ImportsTracker.computeProfitability(expRec);
  assert(exp.available === true, 'profitability more expensive: available');
  assert(exp.profitUsd === -50, 'profitability more expensive: profit = -50');
  assert(Math.abs(exp.roiPct - (-25)) < 1e-9, 'profitability more expensive: ROI = -25%');

  // ── Profitability: missing local price → {available:false}, never zero ──
  const noLocal = { finalLandedCostUsd: 100, localPriceUsd: null, tipoCambio: 1000 };
  const np = ImportsTracker.computeProfitability(noLocal);
  assert(np.available === false, 'profitability missing local: available is false');
  assert(np.profitUsd !== 0 || np.available === false, 'profitability missing local: never zero (available is false)');

  // ── Rollups ──
  const rollupRecords = [
    { id: 'a', status: 'delivered', finalLandedCostUsd: 100, localPriceUsd: 150, tipoCambio: 1000 },
    { id: 'b', status: 'in_transit', finalLandedCostUsd: 80, localPriceUsd: null, tipoCambio: 1000 },
    { id: 'c', status: 'cancelled', finalLandedCostUsd: 50, localPriceUsd: 60, tipoCambio: 1000 }
  ];
  const rollups = ImportsTracker.computeRollups(rollupRecords);
  assert(rollups.totalInvestedUsd === 230, 'rollups: total invested = 100 + 80 + 50 = 230');
  assert(rollups.totalProfitUsd === 60, 'rollups: total profit = (150-100) + 0 + (60-50) = 60 (c has local price, b missing local)');
  assert(rollups.activeCount === 1, 'rollups: active count = 1 (in_transit, not terminal)');
  assert(rollups.byStatus.ordered === 0, 'rollups: byStatus.ordered = 0');
  assert(rollups.byStatus.in_transit === 1, 'rollups: byStatus.in_transit = 1');
  assert(rollups.byStatus.in_customs === 0, 'rollups: byStatus.in_customs = 0');
  assert(rollups.byStatus.cleared === 0, 'rollups: byStatus.cleared = 0');
  assert(rollups.byStatus.delivered === 1, 'rollups: byStatus.delivered = 1');
  assert(rollups.byStatus.cancelled === 1, 'rollups: byStatus.cancelled = 1');

  // ── Rollups: empty collection ──
  const emptyRollups = ImportsTracker.computeRollups([]);
  assert(emptyRollups.totalInvestedUsd === 0, 'rollups empty: total invested = 0');
  assert(emptyRollups.totalProfitUsd === 0, 'rollups empty: total profit = 0');
  assert(emptyRollups.activeCount === 0, 'rollups empty: active count = 0');
}

// ============================================
//  Verdict Layer (Slice C) — compareVsLocal, PAIS 0%, insurance preset, BP
// ============================================
function testVerdictLayer() {
  section('Verdict Layer');

  // ── compareVsLocal: 3 verdicts + missing → {available:false} ──
  const vCheap = Calculator.compareVsLocal(100, 150, 1000);
  assert(vCheap.available === true, 'verdict: available cuando hay precio local');
  assert(vCheap.verdict === 'cheaper', 'verdict: landed 100 vs local 150 → cheaper');
  assert(vCheap.diffUsd === 50, 'verdict: diff absoluto 50 USD (local − landed)');
  assert(Math.abs(vCheap.diffPct - 33.3333333333) < 1e-6, 'verdict: diff 33.3% vs precio local');
  assert(vCheap.diffArs === 50000, 'verdict: diffArs = 50 × TC 1000 = 50000 (reportado en ARS)');
  assert(vCheap.landedUsd === 100 && vCheap.localPriceUsd === 150 && vCheap.tipoCambio === 1000, 'verdict: landed/local/TC preservados');

  const vExp = Calculator.compareVsLocal(200, 150, 1000);
  assert(vExp.available === true && vExp.verdict === 'more_expensive', 'verdict: landed 200 vs local 150 → more_expensive');
  assert(Math.abs(vExp.diffUsd) === 50, 'verdict: more_expensive diff absoluto 50 USD');
  assert(Math.abs(vExp.diffPct + 33.3333333333) < 1e-6, 'verdict: more_expensive diffPct −33.3%');
  assert(vExp.diffArs === -50000, 'verdict: more_expensive diffArs −50000 (TC 1000)');

  const vBe = Calculator.compareVsLocal(100, 100, 1400);
  assert(vBe.available === true && vBe.verdict === 'break_even', 'verdict: landed == local → break_even');
  assert(vBe.diffUsd === 0 && vBe.diffPct === 0 && vBe.diffArs === 0, 'verdict: break-even diferencias en cero');

  // ── Float tolerance: epsilon 1e-6 para break-even ──
  const vTol = Calculator.compareVsLocal(100 + 1e-9, 100, 1400);
  assert(vTol.verdict === 'break_even', 'verdict: |landed − local| < 1e-6 → break_even (tolerancia float)');
  assert(vTol.diffUsd === 0 && vTol.diffArs === 0, 'verdict: tolerancia float → diferencias en cero (no −1e-9)');

  // ── Missing local price → {available:false}, nunca asume, nunca lanza ──
  const vMiss1 = Calculator.compareVsLocal(100, null, 1000);
  assert(vMiss1.available === false && vMiss1.verdict === undefined, 'verdict: local null → available false sin verdict');
  const vMiss2 = Calculator.compareVsLocal(100, undefined, 1000);
  assert(vMiss2.available === false, 'verdict: local undefined → available false');
  const vMiss3 = Calculator.compareVsLocal(100, 'abc', 1000);
  assert(vMiss3.available === false, 'verdict: local no numérico → available false');
  const vMiss4 = Calculator.compareVsLocal(100, 0, 1000);
  assert(vMiss4.available === false, 'verdict: local 0 (sin referencia real) → available false');

  // ── getPaisLine: línea explícita 0% eliminado (nunca omitir) ──
  const pais = Calculator.getPaisLine();
  assert(pais.label === 'Impuesto PAIS', 'PAIS: label "Impuesto PAIS"');
  assert(pais.ratePct === 0 && pais.amountUsd === 0, 'PAIS: tasa 0% y monto 0');
  assert(pais.status === 'eliminated', 'PAIS: estado "eliminated" (línea informativa explícita)');

  // ── suggestInsuranceUsd: ~1.1% de FOB + flete ──
  assert(Math.abs(Calculator.suggestInsuranceUsd(1000, 200) - 13.2) < 1e-9, 'insur: 1.1% de (1000 + 200) = 13.2');
  assert(Math.abs(Calculator.suggestInsuranceUsd(500, 0) - 5.5) < 1e-9, 'insur: 1.1% de 500 sin flete = 5.5');
  assert(Calculator.suggestInsuranceUsd(0, 0) === 0, 'insur: sin FOB ni flete → 0');

  // ── BP regresión: bpPct=0 (default) NO altera totales (byte-identical) ──
  const teclado = [{ sku: 'BP-1', fob: 100, qty: 1, cat: 'TECLADO', modelo: 'K552', variante: 'Black' }];
  const baseCfg = { tipoCambio: 1000, pesoKg: 0, depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 };
  const bp0 = Calculator.calculateDoorToDoorExactCost(teclado, Object.assign({}, baseCfg, { bpPct: 0 }));
  const bpOm = Calculator.calculateDoorToDoorExactCost(teclado, baseCfg);
  assert(Math.abs(bp0.summary.totalPuertaUsd - 149.7025) < 1e-9, 'BP regresión: bpPct=0 → totalPuerta 149.7025 (pin legacy)');
  assert(Math.abs(bp0.summary.totalPuertaConIvaUsd - 174.1675) < 1e-9, 'BP regresión: bpPct=0 → totalConIva 174.1675 (pin legacy)');
  assert(JSON.stringify(bp0.summary) === JSON.stringify(bpOm.summary), 'BP regresión: summary byte-identical bpPct=0 vs omitido');
  assert(bp0.summary.bpUsd === 0, 'BP regresión: bpUsd 0 con bpPct=0');

  // ── BP: no-zero (1%) sube el total exactamente en baseImp × bpPct ──
  const bp1 = Calculator.calculateDoorToDoorExactCost(teclado, Object.assign({}, baseCfg, { bpPct: 0.01 }));
  assert(Math.abs(bp1.summary.bpUsd - 1.165) < 1e-9, 'BP 1%: bpUsd = 1.165 (1% de baseImp 116.5)');
  assert(Math.abs(bp1.summary.totalPuertaUsd - 150.8675) < 1e-9, 'BP 1%: totalPuerta sube a 150.8675 (149.7025 + 1.165)');
  assert(Math.abs(bp1.summary.totalPuertaConIvaUsd - 175.3325) < 1e-9, 'BP 1%: caja sube a 175.3325 (174.1675 + 1.165)');
  assert(Math.abs(bp1.items[0].totalTributosItemUsd - 34.3675) < 1e-9, 'BP 1%: tributos del ítem incluyen BP (33.2025 + 1.165)');
  assert(Math.abs(bp1.summary.costoNetoRealUsd - 117.665) < 1e-9, 'BP 1%: costo neto real sube a 117.665 (BP no recuperable)');

  // ── BP: régimen courier ignora bpPct (importador branch only) ──
  const courierCfg = { tipoCambio: 1000, pesoKg: 0, fletePct: 0.10, seguroPct: 0.01, regimen: 'courier', depositoFiscalUsd: 0, despachanteUsd: 0, simDigitalizacionUsd: 0, fleteInternoUsd: 0 };
  const courierBp = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'C-BP', fob: 1000, qty: 1, cat: 'MOUSE', modelo: 'X', variante: '' }],
    Object.assign({}, courierCfg, { bpPct: 0.05 })
  );
  const courierNoBp = Calculator.calculateDoorToDoorExactCost(
    [{ sku: 'C-BP', fob: 1000, qty: 1, cat: 'MOUSE', modelo: 'X', variante: '' }],
    courierCfg
  );
  assert(courierBp.summary.bpUsd === 0, 'BP courier: bpPct ignorado en régimen courier');
  assert(JSON.stringify(courierBp.summary) === JSON.stringify(courierNoBp.summary), 'BP courier: summary byte-identical con bpPct ignorado');
}

// ============================================
//  Main
// ============================================
(async () => {
  testCalculator();
  testQuoteGenerator();
  testSkuAllocator();
  await testAppStorage();
  await testImportStorage();
  testImportTracker();
  testVerdictLayer();

  console.log(`\n📊 Resultado: ${passed}/${passed + failed} pruebas pasaron exitosamente.`);
  if (failed > 0) {
    console.log(`\n❌ Fallaron ${failed} aserciones:`);
    failures.forEach(f => console.log(`   - ${f}`));
    process.exit(1);
  }
  process.exit(0);
})().catch(err => {
  console.error('💥 Error inesperado en logic-tests:', err);
  process.exit(1);
});
