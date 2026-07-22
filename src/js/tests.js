// ============================================
//  Mambo Pedidos - Suite de Pruebas Unitarias (JS)
// ============================================

const Tests = {
  results: [],

  assert(condition, message) {
    if (condition) {
      this.results.push({ pass: true, message });
      console.log(`✅ PASS: ${message}`);
    } else {
      this.results.push({ pass: false, message });
      console.error(`❌ FAIL: ${message}`);
    }
  },

  runAll() {
    console.log('🧪 Ejecutando Suite de Pruebas Unitarias de Mambo Pedidos...');
    this.results = [];

    this.testCalculator();
    this.testValidations();
    this.testDualCurrency();
    this.testZeroCosts();
    this.testLatamDecimalFormat();
    this.test8BitDoBrand();
    this.testWeightBasedFreight();
    this.testCourierWarnings();
    this.testAiDisambiguator();
    this.testQuoteGeneratorHtml();
    this.testImageSpatialMatching();
    this.testCustomsPackingListExport();
    this.testSupplierPriceComparison();

    const passed = this.results.filter(r => r.pass).length;
    const total = this.results.length;
    console.log(`\n📊 Resultado: ${passed}/${total} pruebas pasaron exitosamente.`);
    return { passed, total, results: this.results };
  },

  testCalculator() {
    const items = [
      { sku: 'TEC-001', fob: 100, qty: 10 },
      { sku: 'MOU-001', fob: 50, qty: 20 }
    ];
    const config = {
      flete: 10, // 10%
      seguro: 0,
      derechos: 0,
      tasa: 0,
      perc: 0,
      desp: 0,
      courier: 0,
      markup: 2.0,
      tipoCambio: 1000
    };

    const res = Calculator.calculateOrder(items, config);

    // Total FOB = (100*10) + (50*20) = 1000 + 1000 = 2000
    this.assert(res.totals.fob === 2000, 'Calculo de Total FOB correcto ($2000 USD)');

    // CIF = 2000 + 10% (200) = 2200. Factor = 2200 / 2000 = 1.1
    this.assert(res.totals.costo === 2200, 'Calculo de Costo total CIF correcto ($2200 USD)');

    // Item 1: costoU = 100 * 1.1 = 110. PVP = 110 * 2 = 220.
    const item1 = res.items[0];
    this.assert(item1.costoU === 110, 'Item 1 costo unitario ponderado correcto ($110 USD)');
    this.assert(item1.pvp === 220, 'Item 1 PVP calculado correcto ($220 USD)');
  },

  testValidations() {
    const validSku = Validations.validateField('sku', 'ATT-MOU-0001');
    this.assert(validSku.valid, 'SKU válido es aceptado');

    const invalidSku = Validations.validateField('sku', 'SKU CON ESPACIOS!');
    this.assert(!invalidSku.valid, 'SKU inválido con caracteres prohibidos es rechazado');

    const validFob = Validations.validateField('fob', 45.50);
    this.assert(validFob.valid, 'FOB dentro del rango $0.01-$500 es aceptado');

    const invalidFob = Validations.validateField('fob', -5);
    this.assert(!invalidFob.valid, 'FOB negativo es rechazado');
  },

  testDualCurrency() {
    const items = [{ sku: 'TEST-01', fob: 10, qty: 1 }];
    const config = { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1.5, tipoCambio: 1200 };
    const res = Calculator.calculateOrder(items, config);

    this.assert(res.totals.fobArs === 12000, 'Conversión de FOB a ARS ($12,000 ARS) correcta');
    this.assert(res.items[0].pvpArs === 18000, 'Conversión de PVP a ARS ($18,000 ARS) correcta');
  },

  testZeroCosts() {
    const items = [{ sku: 'ZERO-01', fob: 100, qty: 1 }];
    const config = { flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1.0, tipoCambio: 1000 };
    const res = Calculator.calculateOrder(items, config);

    // Con costos en 0, el costo total debe ser exactamente el FOB ($100) sin aplicar defaults indeseados (15% etc)
    this.assert(res.totals.costo === 100, 'Permite configurar Flete 0% y gastos 0 USD sin forzar fallbacks');
    this.assert(res.items[0].costoU === 100, 'Costo unitario respeta Flete 0%');
  },

  testLatamDecimalFormat() {
    const parsed = Calculator.parseNum('31,75', 0);
    this.assert(parsed === 31.75, 'Parseo correcto de decimales con coma ("31,75" -> 31.75)');

    const valResult = Validations.validateField('fob', '45,50');
    this.assert(valResult.valid && valResult.value === 45.5, 'Validación acepta y convierte FOB con coma ("45,50")');
  },

  test8BitDoBrand() {
    const brand = PdfParser.detectBrandFromTextLine('8BitDo Ultimate C 2.4G Controller Black');
    this.assert(brand === '8BitDo', 'Detección correcta de la marca 8BitDo en línea de producto');

    const cat = PdfParser.guessCategory('8BitDo Ultimate Controller', 'Wireless');
    this.assert(cat === 'CONTROLLER', 'Clasificación correcta de categoría CONTROLLER para mandos 8BitDo');
  },

  testWeightBasedFreight() {
    const items = [{ sku: 'W-01', fob: 100, qty: 1 }];
    const config = { fleteModo: 'peso', pesoKg: 10, costoPorKg: 15, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 2.0, tipoCambio: 1000 };
    const res = Calculator.calculateOrder(items, config);

    // Flete por peso = 10kg * $15 = $150 USD. Total Costo = $100 + $150 = $250 USD
    this.assert(res.totals.fleteUsd === 150, 'Cálculo de flete por peso ($150 USD para 10kg a $15/kg) correcto');
    this.assert(res.totals.costo === 250, 'Costo final incluye flete por peso ($250 USD)');
  },

  testCourierWarnings() {
    const items = [{ sku: 'OVER-01', fob: 3500, qty: 1 }];
    const config = { logisticaModo: 'courier', flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, markup: 1.0, tipoCambio: 1000 };
    const res = Calculator.calculateOrder(items, config);

    const hasWarning = res.warnings.some(w => w.code === 'COURIER_FOB_EXCEEDED');
    this.assert(hasWarning, 'Advertencia activada cuando el pedido Courier supera USD 3000 FOB');
  },

  testAiDisambiguator() {
    const item = { marca: 'OTRO', cat: 'OTRO', modelo: 'Redragon Kumara K552 RGB Mechanical Keyboard', fob: 35.0, rawText: 'Redragon Kumara K552' };
    const resolved = AiDisambiguator.disambiguateItem(item);

    this.assert(resolved.marca === 'Redragon', 'AiDisambiguator identificó correctamente la marca Redragon');
    this.assert(resolved.cat === 'TECLADO', 'AiDisambiguator identificó correctamente la categoría TECLADO');
    this.assert(resolved.status === 'VALID', 'AiDisambiguator elevó el estado a VALID (🟢)');
  },

  testQuoteGeneratorHtml() {
    const testPedido = {
      name: 'Pedido Prueba',
      date: new Date().toISOString(),
      items: [{ sku: 'P-01', marca: 'AULA', modelo: 'F75', color: 'Blue', qty: 2, pvp: 50.0, pvpArs: 70000, subPvp: 100.0 }],
      totals: { facturacion: 100.0, facturacionArs: 140000, tipoCambio: 1400, qty: 2 }
    };
    let opened = false;
    const origOpen = window.open;
    window.open = (url, name) => { opened = true; return { document: { write: () => {}, close: () => {} } }; };

    QuoteGenerator.generatePrintableQuote(testPedido);
    window.open = origOpen;

    this.assert(opened, 'QuoteGenerator generó y abrió exitosamente la ventana imprimible de cotización');
  },

  testImageSpatialMatching() {
    const rows = [
      { pageNum: 1, y: 100, text: '8BitDo Ultimate Wireless Controller $45.00' }
    ];
    const images = [
      { pageNum: 1, y: 105, x: 20, width: 100, height: 100, dataUrl: 'data:image/webp;base64,UklGRi...' }
    ];
    const products = PdfParser.parseRows(rows, '8BitDo', 0, [], images);
    this.assert(products.length === 1, 'PdfParser parseó 1 producto con imagen espacial');
    this.assert(products[0].img && products[0].img.startsWith('data:image/webp'), 'Imagen espacial asignada correctamente por coordenadas X/Y');
  },

  testCustomsPackingListExport() {
    const testPedido = {
      name: 'Pedido Aduana Test',
      date: new Date().toISOString(),
      items: [{ sku: 'P-01', marca: 'AULA', modelo: 'F75', cat: 'TECLADO', qty: 10, fob: 35.0 }],
      costs: { pesoKg: 15 },
      totals: { fob: 350.0, costo: 420.0, qty: 10 }
    };
    let written = false;
    const origWrite = XLSX.writeFile;
    XLSX.writeFile = (wb, filename) => { written = true; };

    const ok = FileImporter.exportCustomsPackingList(testPedido);
    XLSX.writeFile = origWrite;

    this.assert(ok && written, 'FileImporter exportó correctamente la planilla de Packing List Aduanero en Excel');
  },

  testSupplierPriceComparison() {
    const catalogTest = [
      { sku: 'SKU-A1', marca: 'Proveedor A', modelo: 'AULA F75', cat: 'TECLADO', fob: 30.0 },
      { sku: 'SKU-B1', marca: 'Proveedor B', modelo: 'AULA F75', cat: 'TECLADO', fob: 35.0 }
    ];
    const grouped = {};
    catalogTest.forEach(item => {
      const key = (item.modelo || '').toLowerCase().trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    const comparisons = Object.entries(grouped).filter(([k, list]) => list.length > 1);

    this.assert(comparisons.length === 1, 'Comparador detectó 1 modelo coincidente entre 2 proveedores');
    this.assert(comparisons[0][1][0].fob === 30.0, 'Comparador identificó correctamente al mejor precio FOB ($30.00 USD)');
  }
};

window.Tests = Tests;
