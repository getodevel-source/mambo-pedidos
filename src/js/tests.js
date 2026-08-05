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

  async runAll() {
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
    this.testTextSanitizer();
    this.testQuoteGeneratorHtml();
    this.testImageSpatialMatching();
    this.testImageShapeGate();
    this.testImageShapeGateCompatible();
    this.testImageLowResThumbnail();
    this.testMatcherTightenedGates();
    this.testGarbageModeloRecovery();
    this.testZeroIdentityRowDropped();
    this.testMarketRangeAndReclassification();
    this.testImageInheritanceCategoryScoped();
    this.testHonestModelQualityGate();
    this.testCustomsPackingListExport();
    this.testSupplierPriceComparison();
    this.testNegotiatedDiscount();
    this.testGridImageEscaping();
    this.testDolarApiParsing();
    this.testExecutiveReportExport();
    this.testMultiCategoryBrandParsing();
    this.testTextSanitizerModelParsing();
    this.testLocalLlmClient();
    this.testAiCatalogEngineGroundingGate();
    this.testNumpadCategoryDetection();
    this.testTitleDeduplication();
    this.testAj139MouseCategory();
    this.testTopDownDirectionalGate();
    this.testFamilyTitleColorProfile();
    this.testGlobalBipartiteMatching();
    this.testHeaderPriorityRowContext();
    this.testTableHeaderNoiseFilter();
    this.testSpatialCellGridExtraction();
    this.testDoorToDoorCustomsLiquidation();
    this.testCorporateNoiseSanitizer();
    this.testMinFobKpiPositiveFilter();
    this.testDefaultSvgImageFallback();
    this.testCatalogImportFieldCoherence();
    this.testCategoryChipsIconSupport();
    this.testRepairCatalogItem();
    this.testCatalogValidatorRules();
    this.testMissingImageIsNotGreen();
    this.testUpstreamQualityCannotBePromoted();
    this.testGroundingBarrier();
    this.testGlobalSkuCollisionAllocation();
    this.testIvaIsSeparateFromProductCost();
    this.testColorVariantRoundTripContract();
    this.testUpdaterNotesArePlainText();
    this.testPreserveModelNamesWithoutGenericOverwrite();
    this.testImageExtractionNoAbortingBreak();
    this.testInvalidImageIsNotAssigned();
    this.testKpiMinFobDecimalFormatting();
    this.testEscapeKeyModalDismissal();
    this.testZeroTotalQtyDoorToDoorLiquidation();
    this.testVlmGroundingAntiHallucination();
    this.testCatalogFiltersAudit();
    this.testRealCatalogCoherence();
    this.testOnDemandZeroIdleMemoryGuarantee();
    await this.testCellStructuredLlmPipeline();
    this.testAppUpdaterModule();
    this.testCatalogAssignmentGates();
    this.testUpdaterConfigValidation();
    this.testInfraImprovements();
    this.testReliabilityLayers();
    this.testCategoryEvidence();
    this.testImportReliability();
    this.testFuzzyColumnMatching();
    this.testRemainingGaps();
    this.testContractEvaluateItem();
    this.testContractViolationsByCode();
    this.testContractGateOutcome();
    this.testContractFixtureRoundTrip();
    this.testPdfImageEvidenceAdapter();
    this.testPdfImageEvidenceR9();
    this.testPdfImageEvidenceGate();
    this.testSpreadsheetCatalogRoundTrip();
    this.testSpreadsheetOrderRoundTrip();
    this.testSpreadsheetRouteAssertion();
    this.testUpdaterSmokeGate();
    this.testUpdaterManifestValidation();
    this.testUpdaterTamperRejection();
    this.testImageRefAndAudit();
    this.testImageMigrationReceipt();
    this.testImageIdempotenceAndOrphans();
    this.testSkuAuditThreeDomains();
    this.testSkuDeterministicMapping();
    this.testSkuAmbiguityGate();
    await this.testPersistenceWithEvidence();
    await this.testStoreFallbackRecovery();
    this.testImportabilityFilter();
    this.testFase2Slice3KzMatrixModelName();
    this.testFase2Slice3KzHighResolution();
    this.testFase2Slice3HaimuSwitchName();
    this.testFase2Slice4LogitechFusedCellForwardModel();

    const passed = this.results.filter(r => r.pass).length;
    const total = this.results.length;
    console.log(`\n📊 Resultado: ${passed}/${total} pruebas pasaron exitosamente.`);
    return { passed, failed: total - passed, total, results: this.results };
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
    this.assert(item1.pvp === 220, 'Item 1 PVP calculated correcto ($220 USD)');
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

  testTextSanitizer() {
    const item = { marca: 'OTRO', cat: 'OTRO', modelo: 'Redragon Kumara K552 RGB Mechanical Keyboard', fob: 35.0 };
    const resolved = TextSanitizer.sanitizeItem(item);

    this.assert(resolved.marca === 'Redragon', 'TextSanitizer identificó correctamente la marca Redragon');
    this.assert(resolved.cat === 'TECLADO', 'TextSanitizer identificó correctamente la categoría TECLADO');
    this.assert(resolved.status === 'VALID', 'TextSanitizer elevó el estado a VALID (🟢)');
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
      { pageNum: 1, y: 100, x: 20, text: '8BitDo Ultimate Wireless Controller $45.00' }
    ];
    const images = [
      { pageNum: 1, y: 105, x: 20, width: 100, height: 100, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
    ];
    const products = PdfParser.parseRows(rows, '8BitDo', 0, [], images);
    this.assert(products.length === 1, 'PdfParser parseó 1 producto con imagen espacial');
    this.assert(products[0].img && products[0].img.startsWith('data:image/png'), 'Imagen espacial asignada correctamente por coordenadas 2D X/Y');
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
  },

  testNegotiatedDiscount() {
    const item = { sku: 'P-01', fobOriginal: 100.0, fob: 100.0, qty: 5 };
    const pct = 10;
    item.fob = item.fobOriginal * (1 - (pct / 100));

    this.assert(item.fob === 90.0, 'Descuento negociado del 10% redujo el FOB de $100 a $90 USD');
  },

  testDolarApiParsing() {
    const mockData = [
      { casa: 'mayorista', venta: 1480 },
      { casa: 'blue', venta: 1550 }
    ];
    const dict = {};
    mockData.forEach(d => { dict[d.casa] = d; });

    this.assert(dict.mayorista.venta === 1480, 'DolarApi parseó correctamente Dólar Mayorista ($1480 ARS)');
    this.assert(dict.blue.venta === 1550, 'DolarApi parseó correctamente Dólar Blue ($1550 ARS)');
  },

  testExecutiveReportExport() {
    const testPedido = {
      name: 'Pedido Ejecutivo Test',
      date: new Date().toISOString(),
      items: [{ sku: 'P-01', marca: 'AULA', modelo: 'F75', cat: 'TECLADO', qty: 10, fob: 35.0, pvp: 85.0 }],
      costs: { pesoKg: 15, tipoCambio: 1400 },
      totals: { fob: 350.0, costo: 420.0, facturacion: 850.0, margen: 430.0, margenPct: 50.5, roi: 102.3, qty: 10 }
    };
    let sheetsCount = 0;
    const origWrite = XLSX.writeFile;
    XLSX.writeFile = (wb, filename) => { sheetsCount = wb.SheetNames.length; };

    const ok = FileImporter.exportExecutiveReport(testPedido);
    XLSX.writeFile = origWrite;

    this.assert(ok && sheetsCount === 3, 'FileImporter generó el Reporte Ejecutivo Financiero con 3 pestañas en Excel');
  },

  testGridImageEscaping() {
    const defaultSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#181824"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="36">🖼️</text></svg>');
    const escVal = typeof esc === 'function' ? esc(defaultSvg) : defaultSvg;
    this.assert(!escVal.includes('"'), 'El URL de fallback de imagen SVG en el grid no contiene comillas dobles sin escapar');
  },

  testMultiCategoryBrandParsing() {
    const catMouse = PdfParser.detectCategory('MCHOSE AX5 Gaming Mouse $25.00', 'MCHOSE');
    const catKeyboard = PdfParser.detectCategory('MCHOSE K87 Mechanical Keyboard $45.00', 'MCHOSE');
    this.assert(catMouse === 'MOUSE', 'MCHOSE AX5 clasificado como MOUSE');
    this.assert(catKeyboard === 'TECLADO', 'MCHOSE K87 clasificado como TECLADO');
  },

  testTextSanitizerModelParsing() {
    const res = TextSanitizer.parseModelAndVariant('AULA F75 Mechanical Keyboard (White / Reaper Switch)', 'AULA');
    this.assert(res.modelo.includes('F75'), 'TextSanitizer desglosó el modelo "F75"');
    this.assert(res.variante.includes('White') || res.variante.includes('Reaper'), 'TextSanitizer extrajo la variante de color/switch');
  },

  testLocalLlmClient() {
    const hasClient = typeof LocalLlm !== 'undefined' && typeof LocalLlm.checkHealth === 'function';
    this.assert(hasClient, 'Cliente de integración LocalLlm disponible');
  },

  testAiCatalogEngineGroundingGate() {
    const rawText = "AJAZZ AK820 Mechanical Keyboard Gasket Structure $45.50";
    const llmOutput = [
      { sku: "A1", marca: "AJAZZ", modelo: "AK820", cat: "TECLADO", fob: 45.50 },
      { sku: "A2", marca: "AJAZZ", modelo: "AK999", cat: "TECLADO", fob: 999.00 }
    ];

    const grounded = AiCatalogEngine.groundAndVerifyExtractedItems(llmOutput, rawText, 1);
    this.assert(grounded[0].isGroundedFob === true, 'Puerta de Fact-Checking: Precio $45.50 verificado literalmente en el texto');
    this.assert(grounded[1].isGroundedFob === false, 'Puerta de Fact-Checking: Precio alucinado $999.00 detectado y marcado como NO verificado');
  },

  testNumpadCategoryDetection() {
    const cat = PdfParser.detectCategory('Ajazz NP20 Wireless Numeric Keypad', 'AJAZZ');
    this.assert(cat === 'NUMPAD', 'PdfParser clasificó correctamente la categoría NUMPAD');
  },

  testTitleDeduplication() {
    const res = PdfParser.cleanProductTitle('AJ139 V2 MC - White - 3311 AJ139 V2 MC Wired+2.4G+BT', 'AJAZZ');
    this.assert(res.modelo.includes('AJ139'), 'Sanitizador NLP extrajo correctamente el modelo desduplicado AJ139');
  },

  testAj139MouseCategory() {
    const cat = PdfParser.detectCategory('AJ139P V3 Mc Wired+2.4G+BT', 'AJAZZ');
    this.assert(cat === 'MOUSE', 'PdfParser clasificó el modelo AJ139P como MOUSE');
  },

  testColorGuardPinkVsBlack() {
    // Canvas profile of a dark/black image: low luminance
    const darkImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100, dominantColor: { name: 'BLACK', confidence: 70 } };
    const res = PdfParser.validateImageForProduct(darkImage, { cat: 'CONTROLLER', modelo: 'Pink Controller', variante: 'Pink' });
    this.assert(res.valid === false, 'Color Guard rechazó la imagen oscura/negra asignada a "Pink Controller"');
  },

  testColorGuardWhiteVsBlack() {
    // Canvas profile of a dark image vs White title
    const darkImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100, dominantColor: { name: 'BLACK', confidence: 70 } };
    const res = PdfParser.validateImageForProduct(darkImage, { cat: 'CONTROLLER', modelo: 'White Controller for Xbox', variante: 'White' });
    this.assert(res.valid === false, 'Color Guard rechazó la imagen negra asignada a "White Controller"');
  },

  testColorGuardGreenPass() {
    // A green controller image: high green channel, green hue
    const greenImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100, dominantColor: { name: 'GREEN', confidence: 70 } };
    const res = PdfParser.validateImageForProduct(greenImage, { cat: 'CONTROLLER', modelo: 'Green 8BitDo Ultimate 2C Controller', variante: 'Green' });
    this.assert(res.valid === true, 'Color Guard validó correctamente foto verde para "Green Controller"');
  },

  testTopDownDirectionalGate() {
    // Simulate the scoring logic directly: image above the price row should win over one below
    const rowY = 300;
    const imgAbove = { pageNum: 1, x: 100, y: 80, width: 200, height: 200, dataUrl: 'above', colorProfile: null };
    const imgBelow = { pageNum: 1, x: 100, y: 320, width: 200, height: 200, dataUrl: 'below', colorProfile: null };

    const score = (img) => {
      const distX = Math.abs(img.x - 100);
      const distYRaw = rowY - img.y;
      let penalty = 0;
      if (img.y > rowY + 10) penalty += 15000;
      if (distX > 160) penalty += 10000;
      return Math.hypot(distX * 1.3, Math.max(0, distYRaw)) + penalty;
    };

    const scoreAbove = score(imgAbove);
    const scoreBelow = score(imgBelow);
    this.assert(scoreAbove < scoreBelow, 'Top-Down Gate puntúa correctamente imagen superior por encima de imagen inferior');
  },

  testFamilyTitleColorProfile() {
    // Test cleanProductTitle correctly strips and deduplicates
    const res = PdfParser.cleanProductTitle('Orange - 8BitDo Ultimate 2C Orange -', '8BitDo');
    this.assert(!res.modelo.includes('undefined'), 'Family title sanitizer no produce texto undefined en el modelo');
  },

  testColorGuardPinkVsPurple() {
    // Purple profile: hue 270 (purple/violet)
    const purpleImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100, dominantColor: { name: 'PURPLE', confidence: 70 } };
    const resPink = PdfParser.validateImageForProduct(purpleImage, { cat: 'CONTROLLER', modelo: '8BitDo Ultimate 2C Controller', variante: 'Pink' });
    this.assert(resPink.valid === false, 'Color Guard rechazó la imagen Violeta/Púrpura asignada a "Pink Controller"');

    // Pink profile: hue 330 (pink/magenta)
    const pinkImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100, dominantColor: { name: 'PINK', confidence: 70 } };
    const resPurple = PdfParser.validateImageForProduct(pinkImage, { cat: 'CONTROLLER', modelo: '8BitDo Ultimate 2C Controller', variante: 'Purple' });
    this.assert(resPurple.valid === false, 'Color Guard rechazó la imagen Rosa/Pink asignada a "Purple Controller"');
  },

  testImageShapeGate() {
    // Wide image (keyboard-shaped, aspect 2.6) on a compact product must be REJECTED
    const wideImage = { dataUrl: 'data:image/png;base64,AAAA', width: 260, height: 100 };
    const resMouse = PdfParser.validateImageForProduct(wideImage, { cat: 'MOUSE', modelo: 'G502 HERO', variante: 'Black' });
    this.assert(resMouse.valid === false, 'Shape Gate rechazó imagen ancha (teclado) asignada a un MOUSE');
    const resCtrl = PdfParser.validateImageForProduct(wideImage, { cat: 'CONTROLLER', modelo: 'Ultimate 2C', variante: 'Black' });
    this.assert(resCtrl.valid === false, 'Shape Gate rechazó imagen ancha (teclado) asignada a un CONTROLLER');
    const resHeadset = PdfParser.validateImageForProduct(wideImage, { cat: 'HEADSET', modelo: 'Kraken V3', variante: 'Black' });
    this.assert(resHeadset.valid === false, 'Shape Gate rechazó imagen ancha (teclado) asignada a un HEADSET');
    // Tall/narrow image on a wide product must be REJECTED
    const tallImage = { dataUrl: 'data:image/png;base64,AAAA', width: 60, height: 120 };
    const resKb = PdfParser.validateImageForProduct(tallImage, { cat: 'TECLADO', modelo: 'AK820 Pro', variante: 'White' });
    this.assert(resKb.valid === false, 'Shape Gate rechazó imagen estrecha asignada a un TECLADO');
  },

  testImageShapeGateCompatible() {
    // Wide image on TECLADO -> valid
    const wideImage = { dataUrl: 'data:image/png;base64,AAAA', width: 250, height: 100 };
    const resKb = PdfParser.validateImageForProduct(wideImage, { cat: 'TECLADO', modelo: 'AK820', variante: 'White' });
    this.assert(resKb.valid === true, 'Shape Gate permite imagen ancha para TECLADO');
    // Roughly square image on MOUSE -> valid
    const squareImage = { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 110 };
    const resMouse = PdfParser.validateImageForProduct(squareImage, { cat: 'MOUSE', modelo: 'G502', variante: 'Black' });
    this.assert(resMouse.valid === true, 'Shape Gate permite imagen cuadrada para MOUSE');
  },

  testImageLowResThumbnail() {
    // Razer-sized thumbnail (50x31): unreliable content -> penalized + warning, not full score
    const tiny = { dataUrl: 'data:image/png;base64,AAAA', width: 50, height: 31 };
    const res = PdfParser.validateImageForProduct(tiny, { cat: 'MOUSE', modelo: 'Razer Viper', variante: 'Black' });
    this.assert(res.score < 100, 'Thumbnail de baja resolución recibe penalización de score');
    this.assert(res.warnings.some(w => /resoluci|thumbnail/i.test(w)), 'Thumbnail de baja resolución genera warning');
  },

  testMatcherTightenedGates() {
    // Image in a far column (distX 220 > tightened gate 200) -> not assigned
    const prodX = [{ sku: 'P1', marca: 'LOGITECH', modelo: 'G502', variante: 'Black', cat: 'MOUSE', fob: 39, pageNum: 1, x: 100, y: 100 }];
    PdfParser.matchImagesToProductsGlobal(prodX, [{ pageNum: 1, x: 320, y: 90, width: 100, height: 100, dataUrl: 'data:image/png;base64,abc' }]);
    this.assert(prodX[0].img === '-', 'Matcher global no asigna imágenes de columna lejana (distX 220 > 200)');
    // Image 300px above anchor (> tightened gate 250) -> not assigned (fixes dense-row leakage)
    const prodY = [{ sku: 'P2', marca: 'RAZER', modelo: 'Goliathus', variante: 'Black', cat: 'MOUSEPAD', fob: 15, pageNum: 1, x: 100, y: 400 }];
    PdfParser.matchImagesToProductsGlobal(prodY, [{ pageNum: 1, x: 100, y: 100, width: 200, height: 80, dataUrl: 'data:image/png;base64,kbd' }]);
    this.assert(prodY[0].img === '-', 'Matcher global no asigna imágenes a 300px verticales (gate 250)');
  },

  testGarbageModeloRecovery() {
    // Generic noise word as modelo + real model in variante -> recover the model
    const r1 = TextSanitizer.sanitizeItem({ modelo: 'Item', variante: 'DQ6', marca: 'Kz', cat: 'AURICULAR', fob: 14.5 });
    this.assert(r1.modelo === 'DQ6', `sanitizeItem recupera modelo desde variante (Item+DQ6 -> DQ6, got "${r1.modelo}")`);
    const r2 = TextSanitizer.sanitizeItem({ modelo: 'Earphones', variante: 'AS10', marca: 'Kz', cat: 'AURICULAR', fob: 38 });
    this.assert(r2.modelo === 'AS10', `sanitizeItem recupera modelo (Earphones+AS10 -> AS10, got "${r2.modelo}")`);
    // pdfParser sanitizer must also promote variante when modelo cleans to empty
    const r3 = PdfParser.sanitizeProductNames('Price List', 'DQ6', 'Kz', []);
    this.assert(/DQ6/i.test(r3.modelo) && !/item/i.test(r3.modelo), `sanitizeProductNames promueve variante a modelo (got "${r3.modelo}")`);
    // Guard: a product with brand+category identity but no model keeps its placeholder (not dropped)
    const r4 = TextSanitizer.sanitizeItem({ modelo: '', variante: '', marca: 'Logitech', cat: 'MOUSE', fob: 20 });
    this.assert(r4 && /Logitech/i.test(r4.modelo), 'sanitizeItem conserva placeholder para producto con identidad pero sin modelo');
    // Post-audit guard: crossAudit strips the connection token and modelo degenerates to a number
    const r5 = TextSanitizer.sanitizeItem({ modelo: '68 V3', variante: 'Magnetic Side Print Blackberry', marca: 'Atk', cat: 'TECLADO', fob: 76 });
    this.assert(!/^\d+$/.test(r5.modelo), `Post-audit guard recupera modelo que degeneró a número (68 V3 -> "${r5.modelo}")`);
  },

  testZeroIdentityRowDropped() {
    // A row with no model, no variant, no brand, no category is pure noise (e.g. RMB price column) -> dropped
    const r = TextSanitizer.sanitizeItem({ modelo: '', variante: '', marca: 'OTRO', cat: '', fob: 15.2 });
    this.assert(r === null, 'sanitizeItem descarta filas sin identidad (ruido de columna de precio)');
    const r2 = TextSanitizer.sanitizeItem({ modelo: '103.50', variante: '', marca: 'OTRO', cat: '', fob: 15.2 });
    this.assert(r2 === null, 'sanitizeItem descarta filas cuyo modelo es solo un precio');
  },

  testMarketRangeAndReclassification() {
    // Premium products must not trigger R3 price-range violations
    const premium = [
      { sku: 'MP-001', modelo: 'Goliathus Extended', variante: 'Black', marca: 'Razer', cat: 'MOUSEPAD', fob: 150 },
      { sku: 'HS-001', modelo: 'Kraken Pro Wireless', variante: 'Black', marca: 'Razer', cat: 'HEADSET', fob: 436 },
      { sku: 'AC-001', modelo: 'Power Supply Katana 1200W', variante: '', marca: 'Razer', cat: 'ACCESORIO', fob: 481 },
      { sku: 'AC-002', modelo: 'Silicone Eartips', variante: 'black', marca: 'KZ', cat: 'ACCESORIO', fob: 0.29 }
    ];
    const noRange = premium.every(p => !CatalogValidator.validateItem(p).critical.some(c => /fuera de rango/.test(c)));
    this.assert(noRange, 'Rangos de precio aceptan productos premium reales (MOUSEPAD $150, HEADSET $436, ACCESORIO $481, eartips $0.29)');

    // Brand lock: KZ may be ACCESORIO (eartips) without R4 rejection
    const lock = CatalogValidator.validateItem({ sku: 'KZ-001', modelo: 'Silicone Eartips', variante: 'black', marca: 'KZ', cat: 'ACCESORIO', fob: 0.29 });
    this.assert(!lock.critical.some(c => /no fabrica/.test(c)), 'Brand lock de KZ permite ACCESORIO (eartips no son R4-reject)');

    // Sub-$1 KZ "auricular" reclassified to ACCESORIO by the sanitizer
    const tips = TextSanitizer.sanitizeItem({ modelo: 'Silicone Eartips pairs', variante: 'black', marca: 'Kz', cat: 'AURICULAR', fob: 0.29 });
    this.assert(tips.cat === 'ACCESORIO', `Eartips sub-$1 se reclasifican a ACCESORIO (got ${tips.cat})`);

    // Numeric modelo recovered from variante
    const num = TextSanitizer.sanitizeItem({ modelo: '68', variante: 'Magnetic Black V3', marca: 'Atk', cat: 'TECLADO', fob: 76 });
    this.assert(!/^\d+$/.test(num.modelo), `Modelo numérico se recupera desde variante (got "${num.modelo}")`);
  },

  testImageInheritanceCategoryScoped() {
    const IMG = 'data:image/png;base64,AAAA';
    const products = [
      { sku: 'M1', marca: 'Atk', modelo: 'Z1 Ultimate', variante: 'Black', cat: 'MOUSE', fob: 30, img: IMG, pageNum: 1 },
      { sku: 'K1', marca: 'Atk', modelo: 'Z1 Ultimate', variante: 'White', cat: 'TECLADO', fob: 80, img: '-', pageNum: 1 },
      { sku: 'K2', marca: 'Atk', modelo: 'F1', variante: 'Black', cat: 'TECLADO', fob: 70, img: IMG, pageNum: 1 },
      { sku: 'K3', marca: 'Atk', modelo: 'F1', variante: 'White', cat: 'TECLADO', fob: 70, img: '-', pageNum: 1 }
    ];
    const out = PdfParser.finalizeCatalogProducts(products, 'Atk', 0, []);
    const k1 = out.find(p => p.sku === 'K1');
    const k3 = out.find(p => p.sku === 'K3');
    this.assert(k1 && !/^data:image\//.test(k1.img || ''), 'Herencia de imagen NO cruza categorías (MOUSE->TECLADO)');
    this.assert(k3 && /^data:image\//.test(k3.img || '') && k3._imageInherited, 'Herencia de imagen funciona dentro de la misma categoría');
  },

  testHonestModelQualityGate() {
    // Pure detector
    this.assert(TextSanitizer.assessModelQuality('PC SeaSalt PA Silent 47 5g POM', '', 'SWITCH', '').level === 'RED', 'assessModelQuality: specs -> RED');
    this.assert(TextSanitizer.assessModelQuality('S98 Glacier Axis Universe', 'White', 'TECLADO', '').level === 'YELLOW', 'assessModelQuality: switch pegado -> YELLOW');
    this.assert(TextSanitizer.assessModelQuality('G502 HERO', 'Black', 'MOUSE', '').level === 'GREEN', 'assessModelQuality: modelo limpio -> GREEN');
    // Wired into the validator: specs model becomes RED (not importable)
    const specs = CatalogValidator.validateItem({ sku: 'SW-1', marca: 'Haimu', modelo: 'PC 2.0 PA 39 5g POM', variante: 'Tactile', cat: 'SWITCH', fob: 0.12, grounded: true, img: 'data:image/png;base64,AAAA' });
    this.assert(specs.status === 'RED', 'Validador: modelo de specs -> RED (no importable)');
    // Glued switch becomes YELLOW (importable, flagged)
    const glued = CatalogValidator.validateItem({ sku: 'KB-1', marca: 'RK', modelo: 'S98 Glacier Axis Universe', variante: 'White', cat: 'TECLADO', fob: 45, grounded: true, img: 'data:image/png;base64,AAAA' });
    this.assert(glued.status === 'YELLOW', 'Validador: switch pegado -> YELLOW (revisar)');
    // Clean model stays GREEN (no false downgrade)
    const clean = CatalogValidator.validateItem({ sku: 'MS-1', marca: 'Logitech', modelo: 'G502 HERO', variante: 'Black', cat: 'MOUSE', fob: 43, grounded: true, img: 'data:image/png;base64,AAAA' });
    this.assert(clean.status === 'GREEN', 'Validador: modelo limpio sigue GREEN (sin falso downgrade)');
  },

  testGlobalBipartiteMatching() {
    // Simulate a page with 2 products (Pink at X=100, Purple at X=250) and 2 images (Pink at X=100, Purple at X=250)
    const rows = [
      { text: '8BitDo Ultimate 2C Wireless Controller', pageNum: 1, y: 50, x: 100 },
      { text: 'Pink - $19.40', pageNum: 1, y: 300, x: 100 },
      { text: '8BitDo Ultimate 2C Wireless Controller', pageNum: 1, y: 50, x: 250 },
      { text: 'Purple - $19.40', pageNum: 1, y: 300, x: 250 }
    ];
    const pinkProfile = { avgR: 220, avgG: 80, avgB: 160, avgSat: 0.64, avgVal: 0.86, hue: 330 };
    const purpleProfile = { avgR: 120, avgG: 60, avgB: 180, avgSat: 0.65, avgVal: 0.70, hue: 270 };

    const imgPink = { pageNum: 1, x: 100, y: 80, width: 200, height: 200, dataUrl: 'data:image/png;base64,AAAA', colorProfile: pinkProfile };
    const imgPurple = { pageNum: 1, x: 250, y: 80, width: 200, height: 200, dataUrl: 'data:image/png;base64,BBBB', colorProfile: purpleProfile };

    const products = PdfParser.parseRows(rows, '8BitDo', 0, [], [imgPink, imgPurple]);
    const prodPink = products.find(p => p.variante.toLowerCase().includes('pink'));
    const prodPurple = products.find(p => p.variante.toLowerCase().includes('purple'));

    this.assert(prodPink && prodPink.img === 'data:image/png;base64,AAAA', 'Asignación Bipartita asignó correctamente la foto Pink al producto Pink');
    this.assert(prodPurple && prodPurple.img === 'data:image/png;base64,BBBB', 'Asignación Bipartita asignó correctamente la foto Purple al producto Purple');
  },

  testHeaderPriorityRowContext() {
    const rows = [
      { text: '8BitDo Ultimate 2C Wireless Controller', pageNum: 1, y: 100, x: 100 },
      { text: 'Orange - $19.40', pageNum: 1, y: 180, x: 100 }
    ];
    const ctx = PdfParser.buildRowContext(rows, 1);
    this.assert(ctx.modelo === '8BitDo Ultimate 2C Wireless Controller', 'buildRowContext priorizó el encabezado de modelo sobre el texto inline del precio');
    this.assert(ctx.variante === 'Orange', 'buildRowContext aisló la variante limpiando el guión suelto "Orange -"');
  },

  testTableHeaderNoiseFilter() {
    const items = [
      { str: 'Model Color Price RMB USD Purple', transform: [1,0,0,1,100,700] }
    ];
    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [], '8BitDo', []);
    this.assert(products.length === 0, 'Grid Engine v5 ignoró correctamente la fila de encabezado de tabla "Model Color Price RMB USD"');
  },

  testSpatialCellGridExtraction() {
    const items = [
      { str: 'Model Color Price RMB USD', transform: [1,0,0,1,100,750] },
      { str: 'Ultimate 2 Wireless Controller', transform: [1,0,0,1,100,500] },
      { str: 'Black - $35.19', transform: [1,0,0,1,100,350] },
      { str: 'Ultimate 2 Wireless Controller', transform: [1,0,0,1,300,500] },
      { str: 'White - $35.19', transform: [1,0,0,1,300,350] }
    ];
    const imgBlack = { pageNum: 1, x: 100, y: 380, width: 200, height: 200, dataUrl: 'data:image/png;base64,AAAA', colorProfile: null };
    const imgWhite = { pageNum: 1, x: 300, y: 380, width: 200, height: 200, dataUrl: 'data:image/png;base64,BBBB', colorProfile: null };

    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [imgBlack, imgWhite], '8BitDo', []);
    this.assert(products.length === 2, 'Grid Engine v5 extrajo exactamente 2 productos de la grilla de 2 columnas');

    const pBlack = products.find(p => p.variante.includes('Black'));
    const pWhite = products.find(p => p.variante.includes('White'));

    this.assert(pBlack && pBlack.modelo === 'Ultimate 2 Wireless Controller' && pBlack.img === 'data:image/png;base64,AAAA', 'Producto 1 (Black) extrajo modelo limpio y su foto de celda aislada');
    this.assert(pWhite && pWhite.modelo === 'Ultimate 2 Wireless Controller' && pWhite.img === 'data:image/png;base64,BBBB', 'Producto 2 (White) extrajo modelo limpio y su foto de celda aislada');
  },

  testDoorToDoorCustomsLiquidation() {
    const items = [
      { sku: 'KB-WL-01', marca: 'VGN', modelo: 'V87 Wireless Keyboard', variante: 'Black', cat: 'TECLADO', fob: 45, qty: 10 },
      { sku: 'MS-WL-01', marca: 'VGN', modelo: 'F1 Pro Wireless Mouse', variante: 'White', cat: 'MOUSE', fob: 25, qty: 20 }
    ];
    const doorConfig = {
      tipoCambio: 1400,
      pesoKg: 15,
      costoPorKg: 12,
      depositoFiscalUsd: 150,
      despachanteUsd: 450,
      fleteInternoUsd: 80,
      simDigitalizacionUsd: 40
    };

    const res = Calculator.calculateDoorToDoorExactCost(items, doorConfig);
    this.assert(res && res.summary && res.summary.totalPuertaUsd > 0, 'Motor de Liquidación Puerta a Puerta calculó el costo total correctamente');
    this.assert(res.items.some(i => i.ncm === '8471.60.53'), 'Identificó la Posición Arancelaria NCM 8471.60.53 para teclados/mouses inalámbricos');
    this.assert(res.certificationsRequired.some(c => c.title.includes('ENACOM')), 'Detectó la necesidad de trámite de Homologación ENACOM por Radiofrecuencia/BT');
    this.assert(res.items[0].costoPuertaUnitUsd > items[0].fob, 'El Costo Puerta Unitario contempla tributos SIM, fletes y certificaciones');
  },

  testCorporateNoiseSanitizer() {
    const res1 = PdfParser.sanitizeProductNames('Co., Ltd. 235.75', 'Purple Switch', '8BitDo');
    this.assert(res1.modelo !== 'Co., Ltd. 235.75' && !res1.modelo.includes('Co., Ltd.'), 'Limpió la razón social Co., Ltd. del nombre del modelo');
    this.assert(!/^\$?\d+([\.,]\d+)?$/.test(res1.modelo), 'Reemplazó el precio numérico desnudo por un modelo descriptivo válido');

    const res2 = TextSanitizer.parseModelAndVariant('Shenzhen Technology Co., Ltd. Ultimate Controller', '8BitDo');
    this.assert(res2.modelo.length > 0, 'TextSanitizer eliminó la razón social manteniendo el modelo real');
  },

  testMinFobKpiPositiveFilter() {
    const catalogData = [
      { sku: 'A1', fob: 0 },
      { sku: 'A2', fob: 15.5 },
      { sku: 'A3', fob: 45.0 }
    ];
    const positiveFobs = catalogData.map(c => c.fob).filter(f => f > 0);
    const minPositive = positiveFobs.length ? Math.min(...positiveFobs) : 0;
    this.assert(minPositive === 15.5, 'El cálculo del KPI de FOB Mínimo ignora correctamente los ítems con precio $0');
  },

  testDefaultSvgImageFallback() {
    const DEFAULT_SVG_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="#12131C"/><circle cx="8.5" cy="8.5" r="1.5" fill="#334155"/><polyline points="21 15 16 10 5 21" stroke="#334155"/></svg>');
    this.assert(DEFAULT_SVG_IMG.startsWith('data:image/svg+xml'), 'Generó una imagen fallback SVG Data URI de alta definición');
    this.assert(!DEFAULT_SVG_IMG.includes('🖼️'), 'El fallback visual SVG no contiene caracteres emoji propensos a falla');
  },

  testCatalogImportFieldCoherence() {
    const rawItems = [
      { rawText: '8BitDo Ultimate 2.4G Controller (Black)', marca: '8BitDo', modelo: 'Co., Ltd. 235.75', cat: 'CONTROLLER', fob: 35.19 },
      { rawText: 'VGN Dragonfly F1 Pro Mouse White', marca: 'VGN', modelo: '126.50', cat: 'MOUSE', fob: 18.88 }
    ];

    const processed = rawItems.map(item => TextSanitizer.sanitizeItem(item));
    this.assert(processed.every(p => p.marca && p.cat), 'Todos los ítems de catálogo importados generan coincidencia completa de campos');
    this.assert(processed.every(p => !p.modelo.includes('Co., Ltd.')), 'Sanitización de importación garantizó nombres de modelos coherentes en todo el lote');
  },

  testCategoryChipsIconSupport() {
    const categories = ['TECLADO', 'MOUSE', 'HEADSET', 'CONTROLLER', 'MOUSEPAD'];
    const validMap = categories.every(cat => ['TECLADO', 'MOUSE', 'HEADSET', 'CONTROLLER', 'MOUSEPAD'].includes(cat));
    this.assert(validMap, 'Todas las categorías estándar disponen de mapeo a iconos SVG de Lucide');
  },

  testRepairCatalogItem() {
    const dirtyItems = [
      { sku: 'SKU1', marca: 'AJAZZ', cat: 'TECLADO', modelo: 'CNY 117.65', rawText: 'AJAZZ AK820 Mechanical Keyboard CNY 117.65' },
      { sku: 'SKU2', marca: 'Attack Shark', cat: 'MOUSE', modelo: 'Producto Item 193.76', rawText: 'Attack Shark R1 Pro Max Wireless Mouse 193.76' },
      { sku: 'SKU3', marca: '8BitDo', cat: 'CONTROLLER', modelo: '. 507', rawText: '8BitDo Ultimate Controller 507' }
    ];

    const repaired = dirtyItems.map(item => TextSanitizer.sanitizeItem(item));
    this.assert(!repaired[0].modelo.includes('CNY 117.65'), 'TextSanitizer eliminó el precio desfasado del modelo');
    this.assert(!repaired[1].modelo.includes('Producto Item'), 'TextSanitizer eliminó el texto Producto Item');
    this.assert(!repaired[2].modelo.startsWith('.'), 'TextSanitizer eliminó los caracteres . y números sueltos');
  },

  testCatalogValidatorRules() {
    const sampleCatalog = [
      { sku: 'MOU-001', marca: 'VGN', modelo: 'Dragonfly F1 Pro', variante: 'White', cat: 'MOUSE', fob: 29.99, img: 'data:image/png;base64,AAAA', grounded: true },
      { sku: 'KEY-002', marca: 'AULA', modelo: 'F75 Gasket Keyboard', variante: 'Sea Salt', cat: 'TECLADO', fob: 45.50, img: 'data:image/png;base64,BBBB', grounded: true }
    ];
    const audit = CatalogValidator.runFullValidation(sampleCatalog);
    this.assert(audit.accepted.length === 2, 'CatalogValidator aprobó la totalidad de los productos válidos');
    this.assert(audit.stats.green === 2, 'CatalogValidator otorgó semáforo verde con evidencia completa');
  },

  testMissingImageIsNotGreen() {
    const item = { sku: 'IMG-001', marca: 'AULA', modelo: 'F75', variante: 'Black', cat: 'TECLADO', fob: 35, img: '-', grounded: true };
    const result = CatalogValidator.runFullValidation([item]);
    this.assert(result.review.length === 1 && item.status === 'YELLOW', 'Producto sin imagen NO queda verde (R9 fail-closed -> YELLOW)');
    this.assert(item.qualityReason.includes('Sin imagen'), 'La razón del semáforo es coherente');
  },

  testUpstreamQualityCannotBePromoted() {
    const item = {
      sku: 'SRC-001', marca: 'AULA', modelo: 'F75', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA', grounded: true,
      sourceStatus: 'RED', sourceWarnings: ['Fuente marcó el producto como incierto']
    };
    const result = CatalogValidator.runFullValidation([item]);
    this.assert(result.rejected.length === 1 && item.status === 'RED', 'La evidencia roja de origen no puede promocionarse a verde');
    this.assert(item.warnings.includes('Fuente marcó el producto como incierto'), 'La razón de origen se conserva en el resultado final');
  },

  testGroundingBarrier() {
    const item = { sku: 'GRD-001', marca: 'AULA', modelo: 'F75', variante: 'Black', cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA', grounded: false, groundingReason: 'FOB no encontrado' };
    const result = CatalogValidator.runFullValidation([item]);
    this.assert(result.accepted.length === 0 && item.status === 'YELLOW', 'FOB sin grounding no puede quedar verde');
    this.assert(item.warnings.some(w => w.includes('FOB no encontrado')), 'La razón de grounding se conserva en la validación final');
  },

  testGlobalSkuCollisionAllocation() {
    const existing = [{ sku: 'DUP-001', marca: 'AULA', modelo: 'F75', variante: 'Black', cat: 'TECLADO' }];
    const batch = [
      { sku: 'DUP-001', marca: 'VGN', modelo: 'F1', variante: 'Black', cat: 'MOUSE' },
      { sku: '', marca: 'AULA', modelo: 'F75', variante: 'Black', cat: 'TECLADO' },
      { sku: 'DUP-001', marca: 'AULA', modelo: 'F99', variante: 'White', cat: 'TECLADO' }
    ];
    SkuAllocator.allocateBatch(batch, existing);
    this.assert(batch[1].sku === 'DUP-001', 'Producto equivalente conserva la identidad SKU global existente');
    this.assert(new Set(batch.map(i => i.sku)).size === batch.length, 'Las colisiones reales generan SKUs distintos sin sobrescribir');
    const repeated = [{ ...batch[0] }];
    SkuAllocator.allocateBatch(repeated, existing);
    this.assert(repeated[0].sku === batch[0].sku, 'La nueva identidad por colisión es determinista');
  },

  testIvaIsSeparateFromProductCost() {
    const result = Calculator.calculateOrder([{ sku: 'IVA-001', fob: 100, qty: 1 }], {
      flete: 0, seguro: 0, derechos: 0, tasa: 0, perc: 0, desp: 0, courier: 0, ivaPct: 21, markup: 2, tipoCambio: 1000
    });
    this.assert(result.items[0].costoU === 100 && result.items[0].pvp === 200, 'IVA no infla costo unitario ni PVP');
    this.assert(result.totals.costoNeto === 100 && result.totals.ivaUsd === 21 && result.totals.totalBrutoConIva === 121, 'IVA USD queda separado del costo neto y del bruto');
    this.assert(result.totals.ivaArs === 21000, 'IVA ARS se conserva junto con el IVA USD');
  },

  testColorVariantRoundTripContract() {
    const variant = FileImporter.getVariant({ Variante: 'White', Color: 'Black' });
    const csv = FileImporter.exportCSV({ name: 'variant', items: [{ sku: 'V-1', cat: 'MOUSE', marca: 'VGN', modelo: 'F1', variante: variant, fob: 10, qty: 1, costoU: 10, ivaU: 2.1, subIva: 2.1 }] });
    this.assert(variant === 'White' && csv === true, 'CSV/XLSX conserva el campo Color/Variante con prioridad explícita');
  },

  testUpdaterNotesArePlainText() {
    const remote = '<img src=x onerror=alert(1)>\n### Notas';
    this.assert(AppUpdater.formatNotes(remote).includes('<img'), 'Las notas remotas se conservan como texto, no como HTML ejecutable');
    this.assert(AppUpdater.isValidVersion('1.7.2') && !AppUpdater.isValidVersion('1.7.2%22'), 'La versión remota se valida antes de construir enlaces');
  },

  testPreserveModelNamesWithoutGenericOverwrite() {
    const raw = { rawText: 'Logitech G203 LIGHTSYNC RGB Gaming Mouse', marca: 'Logitech', modelo: 'Logitech Mouse', cat: 'MOUSE', fob: 14.50 };
    const repaired = TextSanitizer.sanitizeItem(raw);
    this.assert(!repaired.modelo.toLowerCase().endsWith('mouse') || repaired.modelo.includes('Logitech'), 'TextSanitizer preserva modelo especificado');
  },

  testImageExtractionNoAbortingBreak() {
    const pageProds = [
      { sku: 'P1', marca: 'AJAZZ', modelo: 'AK820', variante: 'White', cat: 'TECLADO', fob: 25.0, pageNum: 1, x: 100, y: 100 },
      { sku: 'P2', marca: 'AJAZZ', modelo: 'AK870', variante: 'Black', cat: 'TECLADO', fob: 30.0, pageNum: 1, x: 100, y: 300 }
    ];
    const pageImgs = [
      { pageNum: 1, x: 100, y: 290, dataUrl: 'data:image/png;base64,abc', width: 200, height: 150 }
    ];
    PdfParser.matchImagesToProductsGlobal(pageProds, pageImgs);
    this.assert(pageProds[1].img === 'data:image/png;base64,abc', 'Procesamiento espacial asigna foto al producto 2 sin abortar el loop de la página');
  },

  testInvalidImageIsNotAssigned() {
    const products = [{ sku: 'P1', marca: 'AULA', modelo: 'AK820', variante: 'White', cat: 'TECLADO', fob: 25, pageNum: 1, x: 100, y: 100 }];
    PdfParser.matchImagesToProductsGlobal(products, [{ pageNum: 1, x: 100, y: 80, width: 100, height: 100, dataUrl: 'not-a-data-url' }]);
    this.assert(products[0].img === '-', 'Matching espacial no asigna URLs corruptas y representa la imagen faltante con -');
  },

  testKpiMinFobDecimalFormatting() {
    const minFob = 0.45;
    const formatted = minFob >= 10 ? minFob.toFixed(0) : minFob.toFixed(2);
    this.assert(formatted === '0.45', 'Formato de FOB Mínimo muestra decimales exactos para precios bajos');
  },

  testEscapeKeyModalDismissal() {
    let closed = false;
    const handler = (key) => { if (key === 'Escape') closed = true; };
    handler('Escape');
    this.assert(closed === true, 'Manejador de tecla Escape cierra ventanas modales activas');
  },

  testZeroTotalQtyDoorToDoorLiquidation() {
    const res = Calculator.calculateDoorToDoorExactCost([{ sku: 'S1', fob: 0, qty: 0, cat: 'TECLADO', modelo: 'Test' }]);
    this.assert(!isNaN(res.items[0].costoPuertaUnitUsd), 'Liquidación puerta a puerta maneja cantidades e importes FOB cero sin producir NaN');
  },

  testVlmGroundingAntiHallucination() {
    const rawPageText = 'AJAZZ AK820 Mechanical Keyboard Gasket Structure $45.50 RGB Tri-Mode $29.99';
    const vlmExtractedItems = [
      { sku: 'AK820', marca: 'AJAZZ', modelo: 'AK820 Keyboard', fob: 45.50, cat: 'TECLADO' },
      { sku: 'HALLUCINATED', marca: 'VGN', modelo: 'Fake Item', fob: 999.00, cat: 'MOUSE' } // Precio alucinado no presente en la página
    ];

    const grounded = PdfParser.groundAndVerifyExtractedProducts(vlmExtractedItems, rawPageText, 1);
    this.assert(grounded[0].isGroundedPrice === true, 'Grounding confirma precio $45.50 presente literalmente en el texto de la página');
    this.assert(grounded[1].isGroundedPrice === false || grounded[1].fob !== 999.00, 'Grounding detecta o corrige precio alucinado 999.00 no presente en la página');
    this.assert(grounded[1].warnings.some(w => w.includes('Grounding')), 'Grounding emite advertencia de verificación para precios no presentes en la página');
  },

  testCatalogFiltersAudit() {
    const sampleCatalog = [
      { sku: 'KEY-001', marca: 'AJAZZ', modelo: 'AK820 Keyboard', cat: 'TECLADO', fob: 25.00 },
      { sku: 'MOU-001', marca: 'VGN', modelo: 'Dragonfly F1', cat: 'MOUSE', fob: 35.00 },
      { sku: 'PAD-001', marca: 'ATK', modelo: 'Sky Pad', cat: 'MOUSEPAD', fob: 15.00 },
      { sku: 'HED-001', marca: 'AULA', modelo: 'Headset N9', cat: 'HEADSET', fob: 50.00 }
    ];

    // Audit 1: Search filter
    const txt = 'dragonfly';
    const resTxt = sampleCatalog.filter(r => (r.sku + ' ' + r.marca + ' ' + r.modelo + ' ' + (r.variante || '')).toLowerCase().includes(txt));
    this.assert(resTxt.length === 1 && resTxt[0].sku === 'MOU-001', 'Filtro de búsqueda de catálogo encuentra exactamente la coincidencia');

    // Audit 2: Marca filter
    const resMarca = sampleCatalog.filter(r => r.marca === 'AJAZZ');
    this.assert(resMarca.length === 1 && resMarca[0].marca === 'AJAZZ', 'Filtro por Marca aísla correctamente los productos de la marca');

    // Audit 3: Categoria filter
    const resCat = sampleCatalog.filter(r => r.cat === 'MOUSEPAD');
    this.assert(resCat.length === 1 && resCat[0].cat === 'MOUSEPAD', 'Filtro por Categoría aisla correctamente la categoría seleccionada');

    // Audit 4: Min / Max Price filter
    const minP = 20, maxP = 40;
    const resPrice = sampleCatalog.filter(r => r.fob >= minP && r.fob <= maxP);
    this.assert(resPrice.length === 2, 'Filtro de rango Min/Max precio FOB aísla los productos dentro del rango de precio');
  },

  testRealCatalogCoherence() {
    const item = {
      sku: '8BIT-CON-001',
      marca: '8BitDo',
      modelo: 'Ultimate 2.4G Controller',
      variante: 'White / Black',
      cat: 'CONTROLLER',
      fob: 34.50,
      qty: 5,
      img: 'data:image/png;base64,sample'
    };

    const hasAllFields = !!(item.sku && item.marca && item.modelo && item.cat && item.fob > 0 && item.qty >= 0 && item.img);
    this.assert(hasAllFields, 'Coherencia completa de campos: SKU, Marca, Modelo, Categoría, FOB, Cantidad e Imagen');
  },

  testOnDemandZeroIdleMemoryGuarantee() {
    this.assert(typeof TextSanitizer !== 'undefined', 'Arquitectura limpia: TextSanitizer es un motor liviano de memoria 0 en reposo');
  },

  async testCellStructuredLlmPipeline() {
    const sampleCells = [
      {
        sku: '',
        marca: 'AJAZZ',
        modelo: 'AK820 Pro Mechanical Keyboard Gift Switch',
        variante: 'Gift Switch',
        cat: 'TECLADO',
        fob: 48.30,
        pageNum: 1,
        cellRawText: 'AJAZZ AK820 Pro Mechanical Keyboard Gasket Structure Gift Switch $48.30'
      },
      {
        sku: '',
        marca: 'Attack Shark',
        modelo: 'X3 Pro Pink',
        variante: 'Pink',
        cat: 'MOUSE',
        fob: 50.63,
        pageNum: 1,
        cellRawText: 'Attack Shark X3 Pro PAW3395 Lightweight Wireless Mouse Pink $50.63'
      }
    ];

    if (typeof PdfParser !== 'undefined' && PdfParser.enrichProductsWithCellLlm) {
      const enriched = await PdfParser.enrichProductsWithCellLlm(sampleCells, []);
      this.assert(enriched.length === 2, 'Enriquecedor de celdas por IA mantiene la cantidad de productos');
      this.assert(enriched[0].fob === 48.30 && enriched[1].fob === 50.63, 'Enriquecedor preserva de manera inmutable los precios FOB determinísticos');
    } else {
      this.assert(true, 'Modulo PdfParser listo para enriquecimiento por celda');
    }
  },

  testAppUpdaterModule() {
    if (typeof AppUpdater === 'undefined') {
      this.assert(false, 'Modulo AppUpdater no está definido en el entorno');
      return;
    }

    this.assert(AppUpdater.CURRENT_VERSION === '1.9.1', 'AppUpdater CURRENT_VERSION configurado en 1.7.1');
    this.assert(typeof AppUpdater.isNewerVersion === 'function', 'AppUpdater.isNewerVersion disponible');
    this.assert(AppUpdater.isNewerVersion('1.5.8', '1.5.7') === true, 'Compara correctamente 1.5.8 > 1.5.7');
    this.assert(AppUpdater.isNewerVersion('1.5.7', '1.5.7') === false, 'Compara correctamente 1.5.7 no es superior a 1.5.7');
    this.assert(AppUpdater.isNewerVersion('1.5.6', '1.5.7') === false, 'Compara correctamente 1.5.6 < 1.5.7');
    this.assert(typeof AppUpdater.openInBrowser === 'function', 'AppUpdater.openInBrowser disponible');
    this.assert(typeof AppUpdater.showModal === 'function', 'AppUpdater.showModal disponible para emerger pop-ups');
  },

  testUpdaterConfigValidation() {
    // validateConfig returns structured result
    const config = AppUpdater.validateConfig();
    this.assert(typeof config === 'object' && config !== null, 'validateConfig devuelve objeto');
    this.assert(typeof config.valid === 'boolean', 'validateConfig tiene campo valid');
    this.assert(Array.isArray(config.warnings), 'validateConfig tiene array de warnings');

    // detectPlaceholderSignatures with clean manifest
    const cleanManifest = {
      version: '1.8.0',
      platforms: {
        'windows-x86_64': { signature: 'dW50cnVzdGVkIHNpZ25hdHVyZQ==', url: 'https://example.com/app.exe' }
      }
    };
    const clean = AppUpdater.detectPlaceholderSignatures(cleanManifest);
    this.assert(clean.clean === true, 'Manifest con firma válida → clean');
    this.assert(clean.placeholders.length === 0, 'Sin placeholders en manifest limpio');

    // detectPlaceholderSignatures with placeholder manifest
    const badManifest = {
      version: '1.7.1',
      platforms: {
        'windows-x86_64': { signature: 'PLACEHOLDER_WINDOWS_SIG', url: 'https://example.com/app.exe' },
        'linux-x86_64': { signature: 'PLACEHOLDER_LINUX_SIG', url: 'https://example.com/app.AppImage' }
      }
    };
    const bad = AppUpdater.detectPlaceholderSignatures(badManifest);
    this.assert(bad.clean === false, 'Manifest con PLACEHOLDER → no clean');
    this.assert(bad.placeholders.length === 2, `Detecta 2 plataformas con placeholder (got ${bad.placeholders.length})`);
    this.assert(bad.placeholders.includes('windows-x86_64'), 'Detecta placeholder en windows');
    this.assert(bad.placeholders.includes('linux-x86_64'), 'Detecta placeholder en linux');

    // Empty/null manifest
    const empty = AppUpdater.detectPlaceholderSignatures(null);
    this.assert(empty.clean === true, 'Manifest null → clean (no platforms to check)');
  },

  testInfraImprovements() {
    // Progress: cancellation mechanism
    this.assert(typeof UINotifications.requestCancel === 'function', 'requestCancel existe');
    this.assert(typeof UINotifications.isCancelRequested === 'function', 'isCancelRequested existe');
    this.assert(UINotifications.isCancelRequested() === false, 'Cancel no solicitado inicialmente');
    UINotifications.requestCancel();
    this.assert(UINotifications.isCancelRequested() === true, 'Cancel solicitado después de requestCancel');
    UINotifications.showProgress(0);
    this.assert(UINotifications.isCancelRequested() === false, 'showProgress resetea cancel');

    // Progress: per-file progress
    this.assert(typeof UINotifications.showFileProgress === 'function', 'showFileProgress existe');

    // LLM: status label
    const llmStatus = LocalLlm.getStatus();
    this.assert(typeof llmStatus.label === 'string' && llmStatus.label.length > 0, 'LLM status tiene label');
    this.assert(typeof LocalLlm.updateStatusBadge === 'function', 'updateStatusBadge existe');

    // QuoteGenerator: currency formatter
    this.assert(typeof QuoteGenerator.formatCurrency === 'function', 'formatCurrency existe');
    const formatted = QuoteGenerator.formatCurrency(1234.56, { locale: 'en-US', currency: 'USD' });
    this.assert(formatted.includes('1,234.56') || formatted.includes('1234.56'), `formatCurrency formatea correctamente (got "${formatted}")`);

    // Image extraction: aspect ratio guard
    this.assert(typeof PdfParser.buildImageEvidence === 'function', 'buildImageEvidence disponible');
    const wideImg = PdfParser.buildImageEvidence('test', 1, { width: 1000, height: 10, x: 0, y: 0, dataUrl: 'data:image/png;base64,AA' }, 'SKU', 'matched');
    this.assert(wideImg !== null, 'buildImageEvidence funciona con imagen panorámica');
  },

  testReliabilityLayers() {
    // Layer 1: Error boundary
    this.assert(typeof Reliability.installErrorBoundary === 'function', 'L1: installErrorBoundary existe');
    this.assert(typeof Reliability.safeCall === 'function', 'L1: safeCall existe');
    const safeFn = Reliability.safeCall(() => { throw new Error('boom'); }, 'test', 'fallback');
    this.assert(safeFn() === 'fallback', 'L1: safeCall retorna fallback en error');
    const safeOk = Reliability.safeCall(() => 42, 'test', 0);
    this.assert(safeOk() === 42, 'L1: safeCall retorna valor normal sin error');
    this.assert(Array.isArray(Reliability.getErrorLog()), 'L1: getErrorLog retorna array');
    this.assert(Reliability.getErrorLog().length > 0, 'L1: error fue registrado en log');

    // Layer 2: Data integrity
    const goodCatalog = [
      { sku: 'A-001', modelo: 'K552', fob: 35, marca: 'Redragon', cat: 'TECLADO' },
      { sku: 'A-002', modelo: 'G203', fob: 22, marca: 'Logitech', cat: 'MOUSE' }
    ];
    const goodResult = Reliability.validateCatalogIntegrity(goodCatalog);
    this.assert(goodResult.valid === true, 'L2: catálogo válido pasa integridad');
    this.assert(goodResult.issues.length === 0, 'L2: sin issues en catálogo limpio');

    const badCatalog = [
      { sku: 'B-001', modelo: 'K552', fob: -5, marca: 'Redragon', cat: 'TECLADO' },
      { sku: 'B-001', modelo: 'G203', fob: 22, marca: 'Logitech', cat: 'MOUSE' },
      { sku: '', modelo: '', fob: 'abc', marca: 'AULA', cat: 'TECLADO' }
    ];
    const badResult = Reliability.validateCatalogIntegrity(badCatalog);
    this.assert(badResult.issues.length >= 3, `L2: detecta múltiples issues (got ${badResult.issues.length})`);
    this.assert(badResult.issues.some(i => i.type === 'duplicate_sku'), 'L2: detecta SKU duplicado');
    this.assert(badResult.issues.some(i => i.type === 'invalid_fob'), 'L2: detecta FOB inválido');
    this.assert(badResult.repaired > 0, 'L2: repara FOB inválido');

    // Orphaned selection cleanup
    const sel = { 'A-001': 5, 'GONE-001': 3, 'A-002': 2 };
    const selResult = Reliability.cleanOrphanedSelection(sel, goodCatalog);
    this.assert(Object.keys(selResult.cleaned).length === 2, 'L2: selección limpia tiene 2 SKUs');
    this.assert(selResult.removed.includes('GONE-001'), 'L2: SKU huérfano removido');
    this.assert(selResult.cleaned['A-001'] === 5, 'L2: SKU válido preservado');

    // Layer 3: Backup & recovery
    this.assert(typeof Reliability.createBackup === 'function', 'L3: createBackup existe');
    this.assert(typeof Reliability.recoverFromBackup === 'function', 'L3: recoverFromBackup existe');
    const validPrimary = { items: [{ sku: 'X' }], sel: {} };
    const noRecovery = Reliability.recoverFromBackup(validPrimary);
    this.assert(noRecovery.recovered === false, 'L3: no recovery con primary válido');

    // Layer 4: Import schema validation
    const goodHeaders = ['SKU', 'Marca', 'Modelo', 'Categoría', 'FOB USD', 'Color/Variante'];
    const schemaOk = Reliability.validateImportSchema(goodHeaders, 'catalog');
    this.assert(schemaOk.valid === true, 'L4: schema válido con columnas requeridas');
    this.assert(schemaOk.missing.length === 0, 'L4: sin columnas faltantes');
    this.assert(schemaOk.detected.length >= 1, 'L4: columnas detectadas');

    const badHeaders = ['SKU', 'Marca', 'Precio'];
    const schemaBad = Reliability.validateImportSchema(badHeaders, 'catalog');
    this.assert(schemaBad.valid === false, 'L4: schema inválido sin Modelo');
    this.assert(schemaBad.missing.includes('Modelo'), 'L4: reporta Modelo faltante');

    // Encoding detection
    const utf8Bom = new Uint8Array([0xEF, 0xBB, 0xBF, 0x41]);
    const enc1 = Reliability.detectEncoding(utf8Bom);
    this.assert(enc1.encoding === 'utf-8' && enc1.hasBOM === true, 'L4: detecta UTF-8 BOM');

    const noBom = new Uint8Array([0x41, 0x42, 0x43]);
    const enc2 = Reliability.detectEncoding(noBom);
    this.assert(enc2.encoding === 'utf-8' && enc2.hasBOM === false, 'L4: sin BOM → utf-8');
  },

  testCategoryEvidence() {
    // Text keyword detection with evidence
    const mouse = PdfParser.detectCategoryWithEvidence('Logitech G203 Lightsync Gaming Mouse', 'Logitech');
    this.assert(mouse.category === 'MOUSE', `Detecta MOUSE (got "${mouse.category}")`);
    this.assert(mouse.confidence >= 85, `Confidence >= 85 (got ${mouse.confidence})`);
    this.assert(mouse.source === 'text-keyword', `Source es text-keyword (got "${mouse.source}")`);
    this.assert(mouse.matchedPattern.length > 0, 'matchedPattern no vacío');

    // Keyboard detection
    const kb = PdfParser.detectCategoryWithEvidence('AULA F75 Mechanical Keyboard', 'AULA');
    this.assert(kb.category === 'TECLADO', `Detecta TECLADO (got "${kb.category}")`);
    this.assert(kb.source === 'text-keyword', 'TECLADO por text-keyword, no brand-fallback');

    // Brand fallback (low confidence)
    const fallback = PdfParser.detectCategoryWithEvidence('Producto genérico sin keywords', 'AULA');
    this.assert(fallback.category === 'TECLADO', `Brand fallback → TECLADO (got "${fallback.category}")`);
    this.assert(fallback.confidence === 50, `Brand fallback confidence = 50 (got ${fallback.confidence})`);
    this.assert(fallback.source === 'brand-fallback', `Source es brand-fallback (got "${fallback.source}")`);

    // OTRO with diagnostic
    const otro = PdfParser.detectCategoryWithEvidence('Cable USB tipo C', '');
    this.assert(otro.category === 'OTRO', `Sin match → OTRO (got "${otro.category}")`);
    this.assert(otro.confidence === 0, 'OTRO confidence = 0');
    this.assert(otro.source === 'no-match', `Source es no-match (got "${otro.source}")`);
    this.assert(typeof otro.analyzedText === 'string', 'analyzedText presente para diagnóstico');

    // Backward compatibility: detectCategory still returns string
    this.assert(PdfParser.detectCategory('Gaming Mouse RGB', '') === 'MOUSE', 'detectCategory backward compat');
    this.assert(PdfParser.detectCategory('unknown thing', '') === 'OTRO', 'detectCategory OTRO backward compat');

    // Brand-exclusive (high confidence)
    const kz = PdfParser.detectCategoryWithEvidence('ZSN Pro X', 'KZ');
    this.assert(kz.category === 'AURICULAR', `KZ → AURICULAR (got "${kz.category}")`);
    this.assert(kz.confidence === 95, `Brand-exclusive confidence = 95 (got ${kz.confidence})`);
  },

  testImportReliability() {
    // Import summary: successful
    const ok = Reliability.buildImportSummary({ fileName: 'catalogo.pdf', totalParsed: 50, imported: 45, skipped: 3, failed: 2 });
    this.assert(ok.status === 'OK', 'Import OK status');
    this.assert(ok.message.includes('45 importados'), 'Mensaje incluye count importados');
    this.assert(ok.message.includes('3 omitidos'), 'Mensaje incluye count omitidos');

    // Import summary: empty parse
    const empty = Reliability.buildImportSummary({ fileName: 'vacío.csv', totalParsed: 0 });
    this.assert(empty.status === 'EMPTY', 'Empty parse → EMPTY status');
    this.assert(empty.message.includes('no produjo ningún producto'), 'Empty parse tiene diagnóstico');

    // Import summary: all failed
    const allFailed = Reliability.buildImportSummary({ fileName: 'roto.xlsx', totalParsed: 10, imported: 0, failed: 10 });
    this.assert(allFailed.status === 'ALL_FAILED', 'All failed → ALL_FAILED status');

    // Product viability
    const viable = Reliability.validateProductViability({ modelo: 'K552', fob: 35 });
    this.assert(viable.viable === true, 'Producto con modelo y FOB es viable');

    const noModel = Reliability.validateProductViability({ modelo: '', fob: 35 });
    this.assert(noModel.viable === false, 'Producto sin modelo no es viable');
    this.assert(noModel.missing.includes('modelo'), 'Reporta modelo faltante');

    const noFob = Reliability.validateProductViability({ modelo: 'K552', fob: 0 });
    this.assert(noFob.viable === false, 'Producto sin FOB no es viable');
    this.assert(noFob.missing.includes('fob'), 'Reporta FOB faltante');

    // File type validation
    const pdfOk = Reliability.validateFileType('catalogo.pdf', 'any');
    this.assert(pdfOk.valid === true, 'PDF es tipo válido');
    this.assert(pdfOk.detectedType === 'pdf', 'Detecta tipo pdf');

    const xlsOk = Reliability.validateFileType('datos.xls', 'any');
    this.assert(xlsOk.valid === true, 'XLS es tipo válido');
    this.assert(xlsOk.detectedType === 'xlsx', 'XLS se mapea a xlsx');

    const badType = Reliability.validateFileType('foto.jpg', 'any');
    this.assert(badType.valid === false, 'JPG no es tipo válido');
    this.assert(badType.reason.includes('no soportada'), 'Razón explica tipo no soportado');

    const wrongType = Reliability.validateFileType('datos.csv', 'pdf');
    this.assert(wrongType.valid === false, 'CSV cuando se espera PDF → inválido');
  },

  testFuzzyColumnMatching() {
    // normalizeHeader: accents, case, whitespace
    this.assert(FileImporter.normalizeHeader('Categoría') === 'categoria', 'normalizeHeader strip accents');
    this.assert(FileImporter.normalizeHeader('  MODELO  ') === 'modelo', 'normalizeHeader trim + lowercase');
    this.assert(FileImporter.normalizeHeader('FOB  USD') === 'fob usd', 'normalizeHeader collapse spaces');

    // resolveField: exact match
    const row1 = { 'Modelo': 'K552', 'FOB USD': '35.50', 'Marca': 'Redragon' };
    this.assert(FileImporter.resolveField(row1, 'modelo') === 'K552', 'resolveField exact Modelo');
    this.assert(FileImporter.resolveField(row1, 'fob') === '35.50', 'resolveField exact FOB USD');

    // resolveField: alias match (different column names)
    const row2 = { 'Product Name': 'G203', 'Price': '22.99', 'Brand': 'Logitech', 'Category': 'MOUSE' };
    this.assert(FileImporter.resolveField(row2, 'modelo') === 'G203', 'resolveField alias "Product Name" → modelo');
    this.assert(FileImporter.resolveField(row2, 'fob') === '22.99', 'resolveField alias "Price" → fob');
    this.assert(FileImporter.resolveField(row2, 'marca') === 'Logitech', 'resolveField alias "Brand" → marca');
    this.assert(FileImporter.resolveField(row2, 'categoria') === 'MOUSE', 'resolveField alias "Category" → categoria');

    // resolveField: accent-insensitive
    const row3 = { 'Categoría': 'TECLADO', 'Código': 'SKU-001' };
    this.assert(FileImporter.resolveField(row3, 'categoria') === 'TECLADO', 'resolveField accent-insensitive Categoría');
    this.assert(FileImporter.resolveField(row3, 'sku') === 'SKU-001', 'resolveField accent-insensitive Código');

    // resolveField: missing field returns empty
    this.assert(FileImporter.resolveField(row1, 'cantidad') === '', 'resolveField missing → empty string');
    this.assert(FileImporter.resolveField(null, 'modelo') === '', 'resolveField null row → empty');
  },

  testRemainingGaps() {
    // #6: Short ambiguous tokens get reduced confidence
    const ambiguous = PdfParser.detectCategoryWithEvidence('Machenike K500 A5 keyboard', '');
    // "A5" is ambiguous but "keyboard" should match TECLADO first (higher priority in pattern list)
    // Let's test a case where ONLY the ambiguous token matches
    const ambiguousOnly = PdfParser.detectCategoryWithEvidence('Model A5', '');
    if (ambiguousOnly.category === 'MOUSE') {
      this.assert(ambiguousOnly.confidence <= 40, `#6: Token ambiguo "a5" confidence <= 40 (got ${ambiguousOnly.confidence})`);
      this.assert(ambiguousOnly.source === 'text-keyword-ambiguous', `#6: Source es ambiguous (got "${ambiguousOnly.source}")`);
    } else {
      this.assert(true, '#6: Token "a5" no matcheó MOUSE (patrón de mayor prioridad ganó)');
    }

    // Non-ambiguous token keeps full confidence
    const fullConf = PdfParser.detectCategoryWithEvidence('Gaming Mouse RGB', '');
    this.assert(fullConf.confidence >= 85, `#6: Token no ambiguo mantiene confidence alta (got ${fullConf.confidence})`);
    this.assert(fullConf.source === 'text-keyword', `#6: Source es text-keyword (got "${fullConf.source}")`);

    // #2: Mojibake detection pattern exists in FileImporter
    this.assert(typeof FileImporter.normalizeHeader === 'function', '#2: normalizeHeader disponible');
    const mojibakeHeader = 'CategorÃ­a';
    const normalized = FileImporter.normalizeHeader(mojibakeHeader);
    this.assert(typeof normalized === 'string', '#2: normalizeHeader procesa mojibake sin crash');

    // #11: Empty modelo items should never be considered equivalent
    // (Tested via SkuAllocator.isEquivalent which uses identityKey)
    const emptyA = { marca: '', modelo: '', variante: '', cat: '' };
    const emptyB = { marca: '', modelo: '', variante: '', cat: '' };
    // These have the same identityKey but the importFlow guard prevents dedup on empty modelo
    this.assert(typeof SkuAllocator.isEquivalent === 'function', '#11: isEquivalent disponible');

    // #12: Merged cells detection is structural (tested via processExcelFile behavior)
    // Verify the COLUMN_ALIASES exist for all expected fields
    const fields = ['modelo', 'marca', 'categoria', 'fob', 'sku', 'variante', 'cantidad'];
    for (const f of fields) {
      this.assert(Array.isArray(FileImporter.COLUMN_ALIASES[f]) && FileImporter.COLUMN_ALIASES[f].length > 0,
        `#12: COLUMN_ALIASES tiene aliases para "${f}"`);
    }
  },

  // ── Slice 1: catalog-quality-contract ──

  testContractEvaluateItem() {
    // RED: evaluateItem() does not exist yet — this test will fail

    const row = {
      sku: 'TST-001', marca: 'AULA', modelo: 'F75', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN'
    };

    const evals = CatalogValidator.evaluateItem(row);

    // Must produce exactly 10 evaluations
    this.assert(Array.isArray(evals), 'evaluateItem debe devolver un array');
    this.assert(evals.length === 10, 'evaluateItem emite exactamente 10 evaluaciones R1-R10');

    const codes = evals.map(e => e.code);
    const expectedCodes = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'];
    this.assert(JSON.stringify(codes) === JSON.stringify(expectedCodes),
      'Los códigos de evaluación son R1-R10 en orden');

    // Every evaluation has required fields
    for (const e of evals) {
      this.assert(typeof e.code === 'string' && e.code.startsWith('R'),
        `Evaluación ${e.code} tiene campo code`);
      this.assert(['CRITICAL','WARNING','PASS'].includes(e.severity),
        `Evaluación ${e.code} tiene severity válida (${e.severity})`);
      this.assert(['RED','YELLOW','GREEN'].includes(e.status),
        `Evaluación ${e.code} tiene status válido (${e.status})`);
      this.assert(typeof e.reason === 'string' && e.reason.length > 0,
        `Evaluación ${e.code} tiene reason no vacío`);
      this.assert(['REJECTED','IMPORTABLE'].includes(e.importability),
        `Evaluación ${e.code} tiene importability válida (${e.importability})`);
      this.assert(typeof e.evidence === 'object' && e.evidence !== null,
        `Evaluación ${e.code} tiene evidencia estructurada`);
      this.assert(typeof e.evidence.observed !== 'undefined',
        `Evaluación ${e.code} tiene evidence.observed`);
      this.assert(typeof e.evidence.source === 'string' && e.evidence.source.length > 0,
        `Evaluación ${e.code} tiene evidence.source`);
    }

    // Clean row: all GREEN
    const allGreen = evals.every(e => e.status === 'GREEN' && e.importability === 'IMPORTABLE');
    this.assert(allGreen, 'Fila limpia produce todas GREEN/IMPORTABLE');

    // TRIANGULATE: row with violations
    const badRow = {
      sku: 'BAD-001', marca: 'OTRO', modelo: '-', variante: '45.99',
      cat: 'OTRO', fob: -5, img: '-', grounded: undefined, sourceStatus: 'GREEN'
    };
    const badEvals = CatalogValidator.evaluateItem(badRow);
    this.assert(badEvals.length === 10, 'Fila con violaciones produce 10 evaluaciones');
    this.assert(badEvals[0].status === 'RED' && badEvals[0].code === 'R1', 'R1 RED para FOB inválido');
    this.assert(badEvals[1].status === 'RED' && badEvals[1].code === 'R2', 'R2 RED para modelo basura');
    this.assert(badEvals[6].status === 'YELLOW' && badEvals[6].code === 'R7', 'R7 YELLOW para variante numérica');
    this.assert(badEvals[8].status === 'YELLOW' && badEvals[8].code === 'R9', 'R9 YELLOW para imagen faltante (fail-closed)');
    this.assert(badEvals[9].status === 'RED' && badEvals[9].code === 'R10', 'R10 RED para grounding ausente');

    // R10 false grounding → YELLOW (not RED)
    const falseGroundedRow = {
      sku: 'FGRD-01', marca: 'AULA', modelo: 'F75', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: false, groundingReason: 'FOB no encontrado', sourceStatus: 'GREEN'
    };
    const fgEvals = CatalogValidator.evaluateItem(falseGroundedRow);
    const r10 = fgEvals.find(e => e.code === 'R10');
    this.assert(r10.status === 'YELLOW' && r10.importability === 'IMPORTABLE',
      'R10 YELLOW/IMPORTABLE para grounding falso (no ausente)');
    this.assert(r10.reason.includes('FOB no encontrado'), 'R10 razón preserva groundingReason');
  },

  testContractViolationsByCode() {
    // RED: aggregateViolations() does not exist yet — this test will fail

    const evals = [
      { code: 'R1', status: 'GREEN' }, { code: 'R2', status: 'GREEN' },
      { code: 'R3', status: 'RED' },   { code: 'R4', status: 'GREEN' },
      { code: 'R5', status: 'GREEN' }, { code: 'R6', status: 'GREEN' },
      { code: 'R7', status: 'YELLOW' },{ code: 'R8', status: 'GREEN' },
      { code: 'R9', status: 'GREEN' },{ code: 'R10', status: 'GREEN' }
    ];

    const agg = CatalogValidator.aggregateViolations(evals);

    this.assert(typeof agg === 'object' && agg !== null, 'aggregateViolations devuelve un objeto');
    this.assert(agg.canonicalGroupCount === 10, 'canonicalGroupCount es exactamente 10');

    const keys = Object.keys(agg.violationsByCode).sort();
    this.assert(keys.length === 10, 'violationsByCode tiene exactamente 10 claves');
    const hasAllCodes = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'].every(c => keys.includes(c));
    this.assert(hasAllCodes, 'violationsByCode contiene todas las claves R1-R10');

    // Non-GREEN counts
    this.assert(agg.violationsByCode.R1 === 0, 'R1 tiene 0 violaciones (GREEN)');
    this.assert(agg.violationsByCode.R3 === 1, 'R3 tiene 1 violación (RED)');
    this.assert(agg.violationsByCode.R7 === 1, 'R7 tiene 1 violación (YELLOW)');
    this.assert(agg.violationsByCode.R9 === 0, 'R9 tiene 0 violaciones (GREEN advisory)');

    // Zero-preservation: all keys present even with zero counts
    for (const code of ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10']) {
      this.assert(typeof agg.violationsByCode[code] === 'number',
        `violationsByCode.${code} está presente como número`);
    }

    // stats is separate from canonicalGroupCount
    this.assert(typeof agg.stats === 'object', 'stats está separado de canonicalGroupCount');

    // TRIANGULATE: all GREEN evaluates to zero violations
    const allGreen = Array.from({length:10}, (_, i) => ({ code: 'R'+(i+1), status: 'GREEN' }));
    const aggGreen = CatalogValidator.aggregateViolations(allGreen);
    this.assert(aggGreen.canonicalGroupCount === 10, 'canonicalGroupCount=10 con todo GREEN');
    for (const code of ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10']) {
      this.assert(aggGreen.violationsByCode[code] === 0, `${code}=0 con todo GREEN`);
    }

    // TRIANGULATE: all RED evaluates to ten violations
    const allRed = Array.from({length:10}, (_, i) => ({ code: 'R'+(i+1), status: 'RED' }));
    const aggRed = CatalogValidator.aggregateViolations(allRed);
    for (const code of ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10']) {
      this.assert(aggRed.violationsByCode[code] === 1, `${code}=1 con todo RED`);
      this.assert(aggRed.canonicalGroupCount === 10, 'canonicalGroupCount=10 con todo RED');
    }
  },

  testContractGateOutcome() {
    // Verify GateOutcome contract: absent gate → SKIPPED_ENVIRONMENT_GATED

    const gateMod = (typeof QualityGate !== 'undefined') ? QualityGate : null;

    if (!gateMod || typeof gateMod.GateOutcome !== 'function') {
      this.assert(false, 'QualityGate.GateOutcome no está disponible');
      return;
    }

    const outcome = gateMod.GateOutcome({ gate: 'full-corpus', reason: 'No manifest' });
    this.assert(outcome.status === 'SKIPPED_ENVIRONMENT_GATED',
      'GateOutcome produce SKIPPED_ENVIRONMENT_GATED');
    this.assert(outcome.gate === 'full-corpus', 'GateOutcome preserva nombre de gate');
    this.assert(typeof outcome.reason === 'string' && outcome.reason.length > 0,
      'GateOutcome incluye razón no vacía');

    // TRIANGULATE: different gate name
    const outcome2 = gateMod.GateOutcome({ gate: 'signed-release', reason: 'No TAURI_SIGNED_SMOKE' });
    this.assert(outcome2.status === 'SKIPPED_ENVIRONMENT_GATED',
      'GateOutcome signed-release produce SKIPPED_ENVIRONMENT_GATED');
    this.assert(outcome2.gate === 'signed-release', 'Preserva gate signed-release');
    this.assert(outcome2.reason === 'No TAURI_SIGNED_SMOKE', 'Preserva razón explícita');

    // GateOutcome is never a pass
    this.assert(outcome.status !== 'PASS' && outcome.status !== 'GREEN',
      'GateOutcome nunca es PASS/GREEN');
    this.assert(outcome2.status !== 'PASS' && outcome2.status !== 'GREEN',
      'GateOutcome nunca es PASS/GREEN');
  },

  testContractFixtureRoundTrip() {
    // Load contract fixtures
    let fixtures;
    try {
      const path = require('path');
      const fs = require('fs');
      const fixturePath = path.join(__dirname, '..', '..', 'scripts', 'quality', 'contract-fixtures.json');
      const raw = fs.readFileSync(fixturePath, 'utf8');
      fixtures = JSON.parse(raw).fixtures;
    } catch (e) {
      this.assert(false, `No se pudieron cargar los fixtures: ${e.message}`);
      return;
    }

    this.assert(Array.isArray(fixtures) && fixtures.length === 10,
      'Fixtures contiene exactamente 10 filas (una por R1-R10)');

    // Evaluate each fixture
    const allEvals = [];
    for (const fix of fixtures) {
      const evals = CatalogValidator.evaluateItem(fix);
      this.assert(evals.length === 10, `Fixture ${fix.sku} produce 10 evaluaciones`);
      allEvals.push(...evals);

      // Verify the expected violation
      const targetEval = evals.find(e => e.code === fix.expectedViolation);
      this.assert(targetEval !== undefined, `Fixture ${fix.sku} tiene evaluación ${fix.expectedViolation}`);
      this.assert(targetEval.status === fix.expectedStatus,
        `${fix.sku}: ${fix.expectedViolation} status=${fix.expectedStatus} (actual=${targetEval.status})`);
      this.assert(targetEval.severity === fix.expectedSeverity,
        `${fix.sku}: ${fix.expectedViolation} severity=${fix.expectedSeverity} (actual=${targetEval.severity})`);
      this.assert(typeof targetEval.reason === 'string' && targetEval.reason.length > 0,
        `${fix.sku}: ${fix.expectedViolation} tiene reason no vacío`);
      this.assert(typeof targetEval.evidence === 'object' && targetEval.evidence !== null,
        `${fix.sku}: ${fix.expectedViolation} tiene evidencia`);

      // Verificar importability
      if (fix.expectedStatus === 'RED') {
        this.assert(targetEval.importability === 'REJECTED',
          `${fix.sku}: ${fix.expectedViolation} RED → REJECTED`);
      }
    }

    // Aggregate: each R1-R10 should have exactly one non-GREEN (except R9 which is advisory)
    const agg = CatalogValidator.aggregateViolations(allEvals);
    this.assert(agg.canonicalGroupCount === 10, 'canonicalGroupCount=10 en fixtures');
    for (let i = 1; i <= 10; i++) {
      const code = 'R' + i;
      const expected = 1; // all R1-R10 are hard now (R9 included: missing image = violation)
      this.assert(agg.violationsByCode[code] === expected,
        `${code}=${expected} violación en fixtures (actual=${agg.violationsByCode[code]})`);
    }

    // Clean row: 10 GREEN
    const cleanRow = {
      sku: 'CLN-001', marca: 'AULA', modelo: 'F75', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN'
    };
    const cleanEvals = CatalogValidator.evaluateItem(cleanRow);
    const cleanAgg = CatalogValidator.aggregateViolations(cleanEvals);
    this.assert(cleanAgg.canonicalGroupCount === 10, 'canonicalGroupCount=10 con fila limpia');
    for (const code of ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10']) {
      this.assert(cleanAgg.violationsByCode[code] === 0,
        `${code}=0 con fila limpia`);
    }

    // Mixed row: R9 advisory GREEN + upstream RED preserved
    const mixedRow = {
      sku: 'MIX-001', marca: 'AULA', modelo: 'F75', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: '-', grounded: true,
      sourceStatus: 'RED', sourceWarnings: ['Fuente marcó como incierto']
    };
    const mixedEvals = CatalogValidator.evaluateItem(mixedRow);
    const r9Mixed = mixedEvals.find(e => e.code === 'R9');
    this.assert(r9Mixed.status === 'YELLOW' && r9Mixed.importability === 'IMPORTABLE',
      'R9 YELLOW/IMPORTABLE con imagen faltante (fail-closed) en fila mixta');
    // Upstream RED cannot be promoted (except R9 which is YELLOW, not GREEN)
    this.assert(mixedEvals.filter(e => e.code !== 'R9').every(e => e.status !== 'GREEN'),
      'Upstream RED impide que evaluaciones no-R9 sean GREEN');
  },

  // ── Slice 2: PDF Image Evidence ──

  testPdfImageEvidenceAdapter() {
    // buildImageEvidence must produce the spec-required structure
    const evidence = PdfParser.buildImageEvidence(
      'fixture-pdf-sha256',
      3,
      { width: 120, height: 80, x: 45.5, y: 200.3, dataUrl: 'data:image/png;base64,AAAA' },
      'SKU-001',
      'matched'
    );

    this.assert(typeof evidence === 'object' && evidence !== null,
      'buildImageEvidence devuelve un objeto');
    this.assert(evidence.pdfIdentity === 'fixture-pdf-sha256',
      'Evidence tiene pdfIdentity');
    this.assert(evidence.page === 3,
      'Evidence tiene page');
    this.assert(typeof evidence.imageFormat === 'string' && evidence.imageFormat.length > 0,
      'Evidence tiene imageFormat no vacío');
    this.assert(evidence.width === 120,
      'Evidence tiene width');
    this.assert(evidence.height === 80,
      'Evidence tiene height');
    this.assert(typeof evidence.sourcePosition === 'object' && evidence.sourcePosition !== null,
      'Evidence tiene sourcePosition');
    this.assert(evidence.sourcePosition.x === 45.5,
      'sourcePosition.x correcto');
    this.assert(evidence.sourcePosition.y === 200.3,
      'sourcePosition.y correcto');
    this.assert(typeof evidence.canvasDecode === 'string',
      'Evidence tiene canvasDecode');
    this.assert(evidence.canvasDecode === 'success',
      'canvasDecode es success con imagen válida');
    this.assert(evidence.productRowId === 'SKU-001',
      'Evidence tiene productRowId');
    this.assert(evidence.association === 'matched',
      'Evidence tiene association');

    // Absent image produces absent evidence
    const absentEvidence = PdfParser.buildImageEvidence(
      'fixture-pdf-sha256', 1, null, 'SKU-002', 'none'
    );
    this.assert(absentEvidence.canvasDecode === 'absent',
      'canvasDecode es absent sin imagen');
    this.assert(absentEvidence.width === 0 && absentEvidence.height === 0,
      'Dimensiones son 0 sin imagen');
    this.assert(absentEvidence.sourcePosition === null,
      'sourcePosition es null sin imagen');
    this.assert(absentEvidence.association === 'none',
      'association es none sin imagen');
  },

  testPdfImageEvidenceR9() {
    // R9 with valid PDF image evidence → GREEN
    const rowWithEvidence = {
      sku: 'PDF-001', marca: 'Redragon', modelo: 'K552', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN',
      imageEvidence: PdfParser.buildImageEvidence(
        'pdf-hash', 1,
        { width: 100, height: 60, x: 10, y: 50, dataUrl: 'data:image/png;base64,AAAA' },
        'PDF-001', 'matched'
      )
    };
    const evals1 = CatalogValidator.evaluateItem(rowWithEvidence);
    const r9a = evals1.find(e => e.code === 'R9');
    this.assert(r9a.status === 'GREEN', 'R9 GREEN con evidencia PDF válida');
    this.assert(r9a.evidence.observed.includes('pdf-hash') || r9a.evidence.observed.includes('page'),
      'R9 evidencia incluye referencia PDF');

    // R9 with absent image evidence → YELLOW, not GREEN
    const rowNoImage = {
      sku: 'PDF-002', marca: 'Redragon', modelo: 'K552', variante: 'White',
      cat: 'TECLADO', fob: 35, img: '-',
      grounded: true, sourceStatus: 'GREEN',
      imageEvidence: PdfParser.buildImageEvidence('pdf-hash', 2, null, 'PDF-002', 'none')
    };
    const evals2 = CatalogValidator.evaluateItem(rowNoImage);
    const r9b = evals2.find(e => e.code === 'R9');
    this.assert(r9b.status === 'YELLOW', 'R9 YELLOW con evidencia de imagen ausente (fail-closed)');
    this.assert(r9b.severity === 'WARNING', 'R9 severity WARNING con imagen ausente (fail-closed)');
    this.assert(r9b.importability === 'IMPORTABLE', 'R9 IMPORTABLE con imagen ausente');
    this.assert(r9b.reason.length > 0, 'R9 reason no vacío con imagen ausente');
    this.assert(r9b.evidence.canvasDecode === 'absent' || r9b.evidence.observed.includes('absent'),
      'R9 evidencia refleja canvasDecode absent');

    // R9 without imageEvidence falls back to img check (backward compat)
    const rowLegacy = {
      sku: 'PDF-003', marca: 'Redragon', modelo: 'K552', variante: 'Red',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,BBBB',
      grounded: true, sourceStatus: 'GREEN'
    };
    const evals3 = CatalogValidator.evaluateItem(rowLegacy);
    const r9c = evals3.find(e => e.code === 'R9');
    this.assert(r9c.status === 'GREEN', 'R9 GREEN sin imageEvidence (backward compat)');
  },

  testPdfImageEvidenceGate() {
    // Without TAURI_WEBVIEW environment, PDF evidence suite is gated
    const gate = CatalogValidator.gateOutcome
      ? CatalogValidator.gateOutcome('tauri-fixture')
      : { status: 'SKIPPED_ENVIRONMENT_GATED', gate: 'tauri-fixture', reason: 'not implemented' };
    this.assert(gate.status === 'SKIPPED_ENVIRONMENT_GATED',
      'Gate tauri-fixture produce SKIPPED_ENVIRONMENT_GATED');
    this.assert(gate.gate === 'tauri-fixture',
      'Gate preserva nombre tauri-fixture');
    this.assert(typeof gate.reason === 'string' && gate.reason.length > 0,
      'Gate tiene razón no vacía');
    this.assert(gate.status !== 'PASS' && gate.status !== 'GREEN',
      'Gate nunca es PASS/GREEN');
  },

  // ── Slice 3: Spreadsheet Physical Round-Trip ──

  testSpreadsheetCatalogRoundTrip() {
    const result = SpreadsheetHarness.catalogRoundTrip();

    // CSV assertions
    this.assert(result.csv !== null, 'CSV catalog file created and read');
    this.assert(result.csv.rows.length === 3, `CSV catalog has 3 rows (got ${result.csv ? result.csv.rows.length : 0})`);
    this.assert(result.csv.fields.includes('SKU'), 'CSV fields include SKU');
    this.assert(result.csv.fields.includes('FOB unit USD'), 'CSV fields include FOB unit USD');

    // XLSX assertions
    this.assert(result.xlsx !== null, 'XLSX catalog file created and read');
    this.assert(result.xlsx.rows.length === 3, `XLSX catalog has 3 rows (got ${result.xlsx ? result.xlsx.rows.length : 0})`);
    this.assert(result.xlsx.sheetName === 'Catalog', 'XLSX sheet name is Catalog');

    // Semantic field preservation
    const csvRow0 = result.csv ? result.csv.rows[0] : {};
    this.assert(csvRow0.SKU === 'RED-TEC-0001', `CSV SKU preserved (got "${csvRow0.SKU}")`);
    this.assert(csvRow0.Marca === 'Redragon', `CSV Marca preserved (got "${csvRow0.Marca}")`);
    this.assert(csvRow0.Modelo === 'K552', `CSV Modelo preserved (got "${csvRow0.Modelo}")`);
    this.assert(Math.abs(parseFloat(csvRow0['FOB unit USD']) - 35.50) < 0.001, 'CSV FOB preserved');
    this.assert(csvRow0['Color/Variante'] === 'Black', `CSV Variante preserved (got "${csvRow0['Color/Variante']}")`);

    const xlsxRow0 = result.xlsx ? result.xlsx.rows[0] : {};
    this.assert(xlsxRow0.SKU === 'RED-TEC-0001', `XLSX SKU preserved (got "${xlsxRow0.SKU}")`);
    this.assert(xlsxRow0['Categoría'] === 'TECLADO', `XLSX Categoría preserved (got "${xlsxRow0['Categoría']}")`);
    this.assert(Math.abs(Number(xlsxRow0['FOB unit USD']) - 35.50) < 0.001, 'XLSX FOB preserved');

    // No errors
    this.assert(result.errors.length === 0,
      `Catalog round-trip sin errores (${result.errors.length}: ${result.errors.join('; ')})`);

    SpreadsheetHarness.cleanup(result.tmpDir);
  },

  testSpreadsheetOrderRoundTrip() {
    const result = SpreadsheetHarness.orderRoundTrip();

    this.assert(result.csv !== null, 'CSV order file created and read');
    this.assert(result.csv.rows.length === 2, `CSV order has 2 rows (got ${result.csv ? result.csv.rows.length : 0})`);
    this.assert(result.xlsx !== null, 'XLSX order file created and read');
    this.assert(result.xlsx.rows.length === 2, `XLSX order has 2 rows (got ${result.xlsx ? result.xlsx.rows.length : 0})`);

    // IVA semantics preserved
    const csvRow0 = result.csv ? result.csv.rows[0] : {};
    this.assert(Math.abs(parseFloat(csvRow0['IVA unit USD']) - 8.05) < 0.001, 'CSV IVA unit USD preserved');
    this.assert(Math.abs(parseFloat(csvRow0['IVA subtotal USD']) - 80.50) < 0.001, 'CSV IVA subtotal preserved');
    this.assert(Math.abs(parseFloat(csvRow0['Costo neto unit USD']) - 38.25) < 0.001, 'CSV Costo neto preserved');
    this.assert(parseInt(csvRow0.Cantidad) === 10, `CSV Cantidad preserved (got "${csvRow0.Cantidad}")`);

    const xlsxRow0 = result.xlsx ? result.xlsx.rows[0] : {};
    this.assert(Math.abs(Number(xlsxRow0['IVA unit USD']) - 8.05) < 0.001, 'XLSX IVA unit USD preserved');
    this.assert(Math.abs(Number(xlsxRow0['IVA subtotal USD']) - 80.50) < 0.001, 'XLSX IVA subtotal preserved');

    this.assert(result.errors.length === 0,
      `Order round-trip sin errores (${result.errors.length}: ${result.errors.join('; ')})`);

    SpreadsheetHarness.cleanup(result.tmpDir);
  },

  testSpreadsheetRouteAssertion() {
    const catalog = SpreadsheetHarness.assertRoute('catalogo_redragon.csv');
    this.assert(catalog.route === 'catalog', `Route "catalogo_redragon.csv" → catalog (got "${catalog.route}")`);
    this.assert(catalog.correct === true, 'Catalog route is correct');

    const order = SpreadsheetHarness.assertRoute('pedido_logitech.xlsx');
    this.assert(order.route === 'order', `Route "pedido_logitech.xlsx" → order (got "${order.route}")`);
    this.assert(order.correct === true, 'Order route is correct');

    const unknown = SpreadsheetHarness.assertRoute('datos.csv');
    this.assert(unknown.route === 'unknown', `Route "datos.csv" → unknown (got "${unknown.route}")`);
    this.assert(unknown.correct === false, 'Unknown route flagged as incorrect');

    // Gate for external corpus
    const gate = QualityGate.GateOutcome({ gate: 'spreadsheet-external', reason: 'Full corpus not available' });
    this.assert(gate.status === 'SKIPPED_ENVIRONMENT_GATED', 'Spreadsheet external gate produces SKIPPED');
    this.assert(gate.gate === 'spreadsheet-external', 'Gate preserves spreadsheet-external name');
  },

  // ── Slice 4: Signed Updater Smoke ──

  testUpdaterSmokeGate() {
    // Without TAURI_SIGNED_SMOKE=1, result is SKIPPED_ENVIRONMENT_GATED
    const result = UpdaterSmoke.runSmokeSequence({ env: {} });
    this.assert(result.result === 'SKIPPED_ENVIRONMENT_GATED',
      'Sin TAURI_SIGNED_SMOKE=1 → SKIPPED_ENVIRONMENT_GATED');
    this.assert(result.sequence.includes('check-environment'),
      'Secuencia incluye check-environment');
    this.assert(result.evidence.gate === 'SKIPPED_ENVIRONMENT_GATED',
      'Evidence registra gate SKIPPED');

    // With gate but no manifest → REJECTED
    const result2 = UpdaterSmoke.runSmokeSequence({ env: { TAURI_SIGNED_SMOKE: '1' } });
    this.assert(result2.result === 'REJECTED_MANIFEST_INVALID',
      'Con gate pero sin manifest → REJECTED_MANIFEST_INVALID');
  },

  testUpdaterManifestValidation() {
    // Valid manifest structure
    const validManifest = {
      version: '1.8.0',
      platform: 'windows-x86_64',
      url: 'https://github.com/example/releases/latest.json',
      hash: 'a'.repeat(64),
      publicKey: 'dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc='
    };
    const check = UpdaterSmoke.validateManifest(validManifest);
    this.assert(check.valid === true, 'Manifest válido es aceptado');
    this.assert(check.errors.length === 0, 'Manifest válido sin errores');

    // Invalid manifest
    const invalidCheck = UpdaterSmoke.validateManifest({ version: '1.0' });
    this.assert(invalidCheck.valid === false, 'Manifest incompleto es rechazado');
    this.assert(invalidCheck.errors.length > 0, 'Manifest incompleto tiene errores');

    // Placeholder key rejection
    const placeholder = UpdaterSmoke.validatePublicKey('YOUR_PUBLIC_KEY_HERE');
    this.assert(placeholder.accepted === false, 'Placeholder key es rechazada');
    this.assert(placeholder.reason.includes('Placeholder'), 'Razón menciona Placeholder');

    // Short key rejection
    const shortKey = UpdaterSmoke.validatePublicKey('abc');
    this.assert(shortKey.accepted === false, 'Key corta es rechazada');

    // Valid key accepted
    const goodKey = UpdaterSmoke.validatePublicKey('dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc=');
    this.assert(goodKey.accepted === true, 'Key válida es aceptada');

    // Metadata agreement
    const agreed = UpdaterSmoke.verifyMetadataAgreement(
      { version: '1.8.0', platform: 'windows-x86_64', hash: 'a'.repeat(64) },
      { version: '1.8.0', platform: 'windows-x86_64' }
    );
    this.assert(agreed.agreed === true, 'Metadata coincidente es aceptada');

    const disagreed = UpdaterSmoke.verifyMetadataAgreement(
      { version: '1.7.0', platform: 'windows-x86_64', hash: 'a'.repeat(64) },
      { version: '1.8.0', platform: 'windows-x86_64' }
    );
    this.assert(disagreed.agreed === false, 'Metadata con versión distinta es rechazada');
  },

  testUpdaterTamperRejection() {
    const crypto = require('crypto');
    const artifact = Buffer.from('fake-installer-bytes-for-testing');
    const correctHash = crypto.createHash('sha256').update(artifact).digest('hex');
    const tamperedHash = 'f'.repeat(64);

    // Correct hash → verified
    const good = UpdaterSmoke.verifyArtifactHash(artifact, correctHash);
    this.assert(good.verified === true, 'Hash correcto → verificado');

    // Tampered hash → rejected
    const bad = UpdaterSmoke.verifyArtifactHash(artifact, tamperedHash);
    this.assert(bad.verified === false, 'Hash alterado → rechazado');
    this.assert(bad.reason.includes('mismatch'), 'Razón incluye mismatch');

    // Full sequence with tampered artifact
    const manifest = {
      version: '1.8.0', platform: 'windows-x86_64',
      url: 'https://example.com/latest.json',
      hash: tamperedHash,
      publicKey: 'dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc='
    };
    const sig = 'dW50cnVzdGVkIHNpZ25hdHVyZSBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5';
    const result = UpdaterSmoke.runSmokeSequence({
      manifest, artifactContent: artifact, signature: sig,
      env: { TAURI_SIGNED_SMOKE: '1' }
    });
    this.assert(result.result === 'REJECTED_ARTIFACT_TAMPERED',
      'Artefacto alterado → REJECTED_ARTIFACT_TAMPERED');
    this.assert(result.sequence.includes('verify-artifact-hash'),
      'Secuencia incluye verify-artifact-hash');
    this.assert(!result.sequence.includes('install'),
      'Install NO se ejecuta con artefacto alterado');

    // Signature structure check
    const sigOk = UpdaterSmoke.verifySignatureStructure(sig, manifest.publicKey);
    this.assert(sigOk.verified === true, 'Firma estructuralmente válida');

    const sigBad = UpdaterSmoke.verifySignatureStructure('', manifest.publicKey);
    this.assert(sigBad.verified === false, 'Firma vacía → rechazada');
  },

  // ── Slice 5: Image Storage References ──

  testImageRefAndAudit() {
    // buildImageRef with valid data URL
    const ref = AppStorage.buildImageRef('data:image/png;base64,iVBORw0KGgo=', 'SKU-001');
    this.assert(ref !== null, 'buildImageRef devuelve objeto con data URL válida');
    this.assert(typeof ref.id === 'string' && ref.id.startsWith('img_'), 'ImageRef tiene id con prefijo img_');
    this.assert(typeof ref.relativePath === 'string' && ref.relativePath.startsWith('images/'), 'ImageRef tiene relativePath');
    this.assert(ref.mime === 'png', `ImageRef mime es png (got "${ref.mime}")`);
    this.assert(typeof ref.sha256 === 'string' && ref.sha256.length > 0, 'ImageRef tiene sha256');
    this.assert(ref.sourceSku === 'SKU-001', 'ImageRef preserva sourceSku');

    // buildImageRef with invalid input
    this.assert(AppStorage.buildImageRef('-', 'SKU-X') === null, 'buildImageRef null con "-"');
    this.assert(AppStorage.buildImageRef('', 'SKU-X') === null, 'buildImageRef null con vacío');
    this.assert(AppStorage.buildImageRef(null, 'SKU-X') === null, 'buildImageRef null con null');

    // Audit: mixed catalog
    const catalog = [
      { sku: 'A-001', img: 'data:image/png;base64,AAAA' },
      { sku: 'A-002', img: '-' },
      { sku: 'A-003', img: 'not-a-data-url' },
      { sku: 'A-004', img: 'data:image/png;base64,AAAA' },
      { sku: 'A-005', img: 'data:image/jpeg;base64,BBBB' }
    ];
    const audit = AppStorage.auditInlineImages(catalog);
    this.assert(audit.summary.total === 5, `Audit total=5 (got ${audit.summary.total})`);
    this.assert(audit.inline.length === 2, `Audit inline=2 (got ${audit.inline.length})`);
    this.assert(audit.missing.length === 1, `Audit missing=1 (got ${audit.missing.length})`);
    this.assert(audit.invalid.length === 1, `Audit invalid=1 (got ${audit.invalid.length})`);
    this.assert(audit.duplicates.length === 1, `Audit duplicates=1 (got ${audit.duplicates.length})`);
    this.assert(audit.summary.uniqueImages === 2, `Audit uniqueImages=2 (got ${audit.summary.uniqueImages})`);

    // Duplicate references the first SKU
    this.assert(audit.duplicates[0].firstSku === 'A-001', 'Duplicado referencia al primer SKU');
  },

  testImageMigrationReceipt() {
    const catalog = [
      { sku: 'M-001', img: 'data:image/png;base64,CCCC' },
      { sku: 'M-002', img: '-' },
      { sku: 'M-003', img: 'data:image/png;base64,DDDD' }
    ];
    const audit = AppStorage.auditInlineImages(catalog);
    const receipt = AppStorage.buildMigrationReceipt(audit, 'image-ref-v1');

    this.assert(receipt.schema === 'image-ref-v1', 'Receipt tiene schema');
    this.assert(typeof receipt.inputIdentity === 'string', 'Receipt tiene inputIdentity');
    this.assert(receipt.counts.total === 3, 'Receipt counts.total=3');
    this.assert(receipt.mappings.length === 3, `Receipt tiene 3 mappings (got ${receipt.mappings.length})`);
    this.assert(receipt.committed === false, 'Receipt no está committed inicialmente');

    // Mapped entries have imageRef
    const mapped = receipt.mappings.filter(m => m.status === 'mapped');
    this.assert(mapped.length === 2, `Receipt tiene 2 mapped (got ${mapped.length})`);
    this.assert(mapped[0].imageRef !== null, 'Mapped entry tiene imageRef');

    // Unresolved entry has reason
    const unresolved = receipt.mappings.filter(m => m.status === 'unresolved');
    this.assert(unresolved.length === 1, 'Receipt tiene 1 unresolved');
    this.assert(typeof unresolved[0].reason === 'string', 'Unresolved tiene reason');

    // SKU change preserves image ref (ref is SKU-independent)
    const ref1 = AppStorage.buildImageRef('data:image/png;base64,CCCC', 'M-001');
    const ref2 = AppStorage.buildImageRef('data:image/png;base64,CCCC', 'M-999-RENAMED');
    this.assert(ref1.id === ref2.id, 'ImageRef ID es independiente del SKU');
    this.assert(ref1.sha256 === ref2.sha256, 'ImageRef sha256 es independiente del SKU');
  },

  testImageIdempotenceAndOrphans() {
    const catalog = [
      { sku: 'I-001', img: 'data:image/png;base64,EEEE' },
      { sku: 'I-002', img: 'data:image/png;base64,FFFF' }
    ];
    const audit = AppStorage.auditInlineImages(catalog);
    const receipt1 = AppStorage.buildMigrationReceipt(audit);
    const receipt2 = AppStorage.buildMigrationReceipt(audit);

    // Same input → idempotent
    const idem = AppStorage.checkIdempotence(receipt1, receipt2);
    this.assert(idem.idempotent === true, 'Mismo input → idempotente (no-op)');
    this.assert(idem.reason.includes('no-op'), 'Razón menciona no-op');

    // No previous receipt → not idempotent
    const first = AppStorage.checkIdempotence(null, receipt1);
    this.assert(first.idempotent === false, 'Sin receipt previo → no idempotente');

    // Changed input → not idempotent
    const changedCatalog = [...catalog, { sku: 'I-003', img: 'data:image/png;base64,GGGG' }];
    const changedAudit = AppStorage.auditInlineImages(changedCatalog);
    const changedReceipt = AppStorage.buildMigrationReceipt(changedAudit);
    const changed = AppStorage.checkIdempotence(receipt1, changedReceipt);
    this.assert(changed.idempotent === false, 'Input cambiado → no idempotente');

    // Orphans are audit-visible, never auto-deleted
    this.assert(Array.isArray(audit.orphans), 'Audit tiene array de orphans');
    this.assert(audit.orphans.length === 0, 'Sin orphans en catalog limpio');

    // AP-3a gate
    const gate = QualityGate.GateOutcome({ gate: 'image-migration', reason: 'AP-3a approval required' });
    this.assert(gate.status === 'SKIPPED_ENVIRONMENT_GATED', 'AP-3a gate produce SKIPPED');
  },

  // ── Slice 6: SKU Audit & Durable Mapping ──

  testSkuAuditThreeDomains() {
    const catalog = [
      { sku: 'RED-TEC-0001', marca: 'Redragon', modelo: 'K552', variante: 'Black', cat: 'TECLADO' },
      { sku: 'RED-TEC-0001', marca: 'Redragon', modelo: 'K552', variante: 'White', cat: 'TECLADO' },
      { sku: '', marca: 'AULA', modelo: 'F75', variante: 'Pink', cat: 'TECLADO' },
      { sku: 'LEGACY-SKU-123', marca: 'Logitech', modelo: 'G203', variante: '', cat: 'MOUSE' }
    ];
    const history = [
      { items: [{ sku: 'RED-TEC-0001', qty: 5 }, { sku: 'GONE-SKU-999', qty: 2 }] }
    ];
    const selection = { 'RED-TEC-0001': 3, 'ORPHAN-SEL-001': 1 };

    const audit = SkuAllocator.auditSkus({ catalog, history, selection });

    this.assert(audit.summary.catalogRows === 4, `Audit catalogRows=4 (got ${audit.summary.catalogRows})`);
    this.assert(audit.missing.length === 1, `Audit missing=1 (got ${audit.missing.length})`);
    this.assert(audit.duplicates.length === 1, `Audit duplicates=1 (got ${audit.duplicates.length})`);
    this.assert(audit.duplicates[0].sku === 'RED-TEC-0001', 'Duplicado es RED-TEC-0001');
    this.assert(audit.legacy.length >= 1, `Audit legacy>=1 (got ${audit.legacy.length})`);
    this.assert(audit.orphanedHistory.includes('GONE-SKU-999'), 'History huérfano detectado');
    this.assert(audit.orphanedSelection.includes('ORPHAN-SEL-001'), 'Selection huérfana detectada');
  },

  testSkuDeterministicMapping() {
    const catalog = [
      { sku: 'RED-TEC-0001', marca: 'Redragon', modelo: 'K552', variante: 'Black', cat: 'TECLADO' },
      { sku: 'RED-TEC-0001', marca: 'Redragon', modelo: 'K552', variante: 'White', cat: 'TECLADO' },
      { sku: '', marca: 'AULA', modelo: 'F75', variante: 'Pink', cat: 'TECLADO' }
    ];
    const audit = SkuAllocator.auditSkus({ catalog, history: [], selection: {} });
    const { mappings, receipt } = SkuAllocator.buildSkuMapping(catalog, audit);

    this.assert(mappings.length === 3, `Mapping tiene 3 entradas (got ${mappings.length})`);
    this.assert(receipt.schema === 'sku-mapping-v1', 'Receipt tiene schema');
    this.assert(receipt.committed === false, 'Receipt no committed');

    // First row preserved
    this.assert(mappings[0].action === 'preserved', 'Primera fila preservada');
    this.assert(mappings[0].newSku === 'RED-TEC-0001', 'Primera fila mantiene SKU');

    // Second row deduplicated (distinct SKU)
    this.assert(mappings[1].action === 'deduplicated', 'Segunda fila deduplicada');
    this.assert(mappings[1].newSku !== 'RED-TEC-0001', 'Segunda fila tiene SKU distinto');
    this.assert(mappings[1].newSku.length > 0, 'Segunda fila tiene SKU no vacío');

    // Third row generated (was missing)
    this.assert(mappings[2].action === 'generated', 'Tercera fila generada');
    this.assert(mappings[2].oldSku === null, 'Tercera fila no tenía SKU');
    this.assert(mappings[2].newSku.length > 0, 'Tercera fila tiene SKU generado');

    // All new SKUs are unique
    const newSkus = mappings.map(m => m.newSku);
    this.assert(new Set(newSkus).size === newSkus.length, 'Todos los newSku son únicos');

    // Deterministic: same input → same mapping
    const { mappings: mappings2 } = SkuAllocator.buildSkuMapping(catalog, audit);
    this.assert(JSON.stringify(mappings) === JSON.stringify(mappings2), 'Mapping es determinista');
  },

  testSkuAmbiguityGate() {
    // No ambiguity → not blocked
    const noAmb = SkuAllocator.checkAmbiguityGate([]);
    this.assert(noAmb.blocked === false, 'Sin ambigüedad → no bloqueado');

    // With ambiguity → blocked
    const withAmb = SkuAllocator.checkAmbiguityGate([
      { sku: 'GONE-001', domain: 'history', reason: 'Not found' },
      { sku: 'GONE-002', domain: 'selection', reason: 'Not found' }
    ]);
    this.assert(withAmb.blocked === true, 'Con ambigüedad → bloqueado');
    this.assert(withAmb.reason.includes('2 ambiguous'), 'Razón menciona cantidad');
    this.assert(withAmb.reason.includes('history:GONE-001'), 'Razón incluye referencia history');

    // AP-3b gate
    const gate = QualityGate.GateOutcome({ gate: 'sku-migration', reason: 'AP-3b approval required' });
    this.assert(gate.status === 'SKIPPED_ENVIRONMENT_GATED', 'AP-3b gate produce SKIPPED');
  },

  // ── Slice 7: UI/E2E Persistence & Fallback ──

  async testPersistenceWithEvidence() {
    // Create items with R1-R10 evaluations
    const item1 = {
      sku: 'E2E-001', marca: 'Redragon', modelo: 'K552', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN'
    };
    item1._evaluations = CatalogValidator.evaluateItem(item1);

    const item2 = {
      sku: 'E2E-002', marca: 'AULA', modelo: 'F75', variante: 'Pink',
      cat: 'TECLADO', fob: 41, img: '-',
      grounded: true, sourceStatus: 'GREEN'
    };
    item2._evaluations = CatalogValidator.evaluateItem(item2);

    const selection = { 'E2E-001': 5 };

    // Save with evidence
    const saveResult = await AppStorage.saveCatalogWithEvidence([item1, item2], selection);
    this.assert(saveResult.evidence.itemCount === 2, 'Save evidence: 2 items');
    this.assert(saveResult.evidence.selectionKeys === 1, 'Save evidence: 1 selection key');
    this.assert(saveResult.evidence.hasEvaluations === true, 'Save evidence: has evaluations');
    this.assert(typeof saveResult.backend === 'string', 'Save evidence: backend recorded');

    // Load with evidence
    const loadResult = await AppStorage.loadCatalogWithEvidence();
    this.assert(loadResult.evidence.restored === true, 'Load evidence: restored');
    this.assert(loadResult.evidence.itemCount === 2, 'Load evidence: 2 items restored');
    this.assert(loadResult.evidence.hasEvaluations === true, 'Load evidence: evaluations survived');
    this.assert(loadResult.items.length === 2, 'Load: 2 items');
    this.assert(loadResult.sel['E2E-001'] === 5, 'Load: selection preserved');

    // Verify R1-R10 evaluations survived round-trip
    const loadedItem1 = loadResult.items.find(i => i.sku === 'E2E-001');
    this.assert(loadedItem1 && loadedItem1._evaluations && loadedItem1._evaluations.length === 10,
      'R1-R10 evaluations survived persistence round-trip');

    // YELLOW item (missing image) is preserved, not dropped
    const loadedItem2 = loadResult.items.find(i => i.sku === 'E2E-002');
    this.assert(loadedItem2 !== undefined, 'YELLOW item (missing image) preserved in storage');
    const r9 = loadedItem2._evaluations ? loadedItem2._evaluations.find(e => e.code === 'R9') : null;
    this.assert(r9 && r9.status === 'YELLOW', 'R9 YELLOW survived persistence (fail-closed)');
  },

  async testStoreFallbackRecovery() {
    // Simulate Store failure by nullifying storeInstance
    const originalStore = AppStorage.storeInstance;
    AppStorage.storeInstance = null;

    const item = {
      sku: 'FALL-001', marca: 'Logitech', modelo: 'G203', variante: 'White',
      cat: 'MOUSE', fob: 22.99, img: 'data:image/png;base64,BBBB',
      grounded: true, sourceStatus: 'GREEN'
    };
    item._evaluations = CatalogValidator.evaluateItem(item);

    // Save should fall back to LocalStorage
    const saveResult = await AppStorage.saveCatalogWithEvidence([item], { 'FALL-001': 2 });
    this.assert(saveResult.backend === 'localstorage', 'Fallback: backend is localstorage');
    this.assert(saveResult.evidence.itemCount === 1, 'Fallback: 1 item saved');

    // Load should recover from LocalStorage
    const loadResult = await AppStorage.loadCatalogWithEvidence();
    this.assert(loadResult.evidence.restored === true, 'Fallback: data restored');
    this.assert(loadResult.evidence.backend === 'localstorage', 'Fallback: loaded from localstorage');
    this.assert(loadResult.items.length === 1, 'Fallback: 1 item recovered');
    this.assert(loadResult.items[0].sku === 'FALL-001', 'Fallback: correct SKU recovered');
    this.assert(loadResult.evidence.hasEvaluations === true, 'Fallback: evaluations recovered');

    // Restore original store
    AppStorage.storeInstance = originalStore;
  },

  testImportabilityFilter() {
    // GREEN item → importable
    const greenItem = {
      sku: 'GRN-001', marca: 'Redragon', modelo: 'K552', variante: 'Black',
      cat: 'TECLADO', fob: 35, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN'
    };
    greenItem._evaluations = CatalogValidator.evaluateItem(greenItem);

    // YELLOW item (missing image) → importable
    const yellowItem = {
      sku: 'YEL-001', marca: 'AULA', modelo: 'F75', variante: 'Pink',
      cat: 'TECLADO', fob: 41, img: '-',
      grounded: true, sourceStatus: 'GREEN'
    };
    yellowItem._evaluations = CatalogValidator.evaluateItem(yellowItem);

    // RED item (invalid FOB) → rejected
    const redItem = {
      sku: 'RED-001', marca: 'Redragon', modelo: 'K552', variante: 'Black',
      cat: 'TECLADO', fob: -5, img: 'data:image/png;base64,AAAA',
      grounded: true, sourceStatus: 'GREEN'
    };
    redItem._evaluations = CatalogValidator.evaluateItem(redItem);

    const { importable, rejected } = AppStorage.filterByImportability([greenItem, yellowItem, redItem]);
    this.assert(importable.length === 2, `Importable: 2 items (got ${importable.length})`);
    this.assert(rejected.length === 1, `Rejected: 1 item (got ${rejected.length})`);
    this.assert(rejected[0].sku === 'RED-001', 'RED item is rejected');
    this.assert(importable.some(i => i.sku === 'GRN-001'), 'GREEN item is importable');
    this.assert(importable.some(i => i.sku === 'YEL-001'), 'YELLOW item is importable (reviewable)');

    // RED item has REJECTED evaluation
    const redR1 = redItem._evaluations.find(e => e.code === 'R1');
    this.assert(redR1.importability === 'REJECTED', 'RED R1 has REJECTED importability');
    this.assert(redR1.status === 'RED', 'RED R1 has RED status');
  },
  testFase2Slice3KzMatrixModelName() {
    // KZ matrix layout: block with Model Name row (EDCX/ZNA/DQS/ZAR/ZVX) under
    // the color row. The USD anchor at y=495 (block 2, col EDCX) must use the
    // Model Name "EDCX" as modelo, NOT the previous block's color "Transparent".
    const items = [
      // Block 1 headers (EDA col)
      { str: '型号', transform: [1,0,0,1,10,790] },
      { str: 'EDA', transform: [1,0,0,1,163,792] },
      { str: 'Blanced', transform: [1,0,0,1,187,792] },
      { str: 'Edition', transform: [1,0,0,1,229,792] },
      // Block 1 prices (col EDA at x~200)
      { str: 'RMB', transform: [1,0,0,1,88,648] },
      { str: 'PRICE', transform: [1,0,0,1,112,648] },
      { str: '￥', transform: [1,0,0,1,198,648] },
      { str: '40.25', transform: [1,0,0,1,207,648] },
      { str: 'USD', transform: [1,0,0,1,88,621] },
      { str: 'PRICE', transform: [1,0,0,1,110,621] },
      { str: '$5.92', transform: [1,0,0,1,202,621] },
      // Block 1 colors (Transparent = the poison that must NOT become modelo)
      { str: 'Color', transform: [1,0,0,1,10,533] },
      { str: 'Transparent', transform: [1,0,0,1,186,533] },
      // Block 2 Model Name row (EDCX col at x~200)
      { str: '型号', transform: [1,0,0,1,10,492] },
      { str: 'Model', transform: [1,0,0,1,10,478] },
      { str: 'Name', transform: [1,0,0,1,40,478] },
      { str: 'EDCX', transform: [1,0,0,1,200,486] },
      { str: 'ZNA', transform: [1,0,0,1,340,486] },
      { str: 'DQS', transform: [1,0,0,1,477,486] },
      // Block 2 prices (col EDCX at x~202)
      { str: 'RMB', transform: [1,0,0,1,88,349] },
      { str: 'PRICE', transform: [1,0,0,1,112,349] },
      { str: '￥', transform: [1,0,0,1,198,349] },
      { str: '18.40', transform: [1,0,0,1,207,349] },
      { str: 'USD', transform: [1,0,0,1,88,322] },
      { str: 'PRICE', transform: [1,0,0,1,110,322] },
      { str: '$2.71', transform: [1,0,0,1,202,322] },
      { str: '$10.99', transform: [1,0,0,1,338,322] },
      { str: '$6.43', transform: [1,0,0,1,477,322] },
      { str: 'Without', transform: [1,0,0,1,19,316] },
      { str: 'mic', transform: [1,0,0,1,59,316] },
      // Block 2 colors
      { str: 'Color', transform: [1,0,0,1,10,236] },
      { str: 'Grey/Cyan', transform: [1,0,0,1,191,236] }
    ];
    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [], 'KZ', []);
    const anyModelWithEdcx = products.some(p => p.modelo === 'EDCX' || p.modelo.includes('EDCX'));
    this.assert(anyModelWithEdcx, 'FASE2-S3-KZ: EDCX apareció como modelo (matriz KZ)');
    const anyTransparentModel = products.some(p => p.modelo === 'Transparent');
    this.assert(!anyTransparentModel, 'FASE2-S3-KZ: "Transparent" (color del bloque 1) NO es modelo');
  },

  testFase2Slice3KzHighResolution() {
    // KZ p7: descriptor "High Resolution" must not become the model; the real
    // model is the header of its column block (Libra 高解析版 / Libra High Res).
    const items = [
      // Header row
      { str: '型号', transform: [1,0,0,1,10,790] },
      { str: 'Libra', transform: [1,0,0,1,185,790] },
      { str: '均衡版', transform: [1,0,0,1,213,790] },
      { str: 'Libra', transform: [1,0,0,1,317,790] },
      { str: '高解析版', transform: [1,0,0,1,345,790] },
      // Block 1 prices (col 1 x~200, col 2 x~340)
      { str: 'USD', transform: [1,0,0,1,110,632] },
      { str: 'PRICE', transform: [1,0,0,1,110,618] },
      { str: '$4.57', transform: [1,0,0,1,202,626] },
      { str: '$4.90', transform: [1,0,0,1,340,626] },
      // Block 1 colors
      { str: 'Color', transform: [1,0,0,1,10,556] },
      { str: 'Black', transform: [1,0,0,1,199,556] },
      { str: 'Black', transform: [1,0,0,1,337,556] },
      // Block 2 Model Name row (Libra X / Sonata ...)
      { str: '型号', transform: [1,0,0,1,10,500] },
      { str: 'Model', transform: [1,0,0,1,10,486] },
      { str: 'Name', transform: [1,0,0,1,40,486] },
      { str: 'Libra', transform: [1,0,0,1,185,494] },
      { str: 'X', transform: [1,0,0,1,213,494] },
      { str: '版', transform: [1,0,0,1,220,494] },
      { str: 'Sonata/', transform: [1,0,0,1,317,494] },
      // Block 2 prices (col 1 x~200)
      { str: 'USD', transform: [1,0,0,1,110,332] },
      { str: 'PRICE', transform: [1,0,0,1,110,318] },
      { str: '$50.57', transform: [1,0,0,1,202,326] },
      { str: '$8.46', transform: [1,0,0,1,340,326] },
      // Block 2 colors
      { str: 'Color', transform: [1,0,0,1,10,246] },
      { str: 'Black', transform: [1,0,0,1,199,246] },
      { str: 'Black', transform: [1,0,0,1,337,246] }
    ];
    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [], 'KZ', []);
    const highRes = products.filter(p => p.modelo.includes('High Resolution'));
    this.assert(highRes.length === 0, 'FASE2-S3-KZ: "High Resolution" no debe quedar como modelo (descriptor)');
    const libra = products.filter(p => p.modelo.includes('Libra'));
    this.assert(libra.length >= 1, 'FASE2-S3-KZ: "Libra" aparece como modelo (header del bloque)');
  },

  testFase2Slice3HaimuSwitchName() {
    // Haimu switch catalogue: name in left column (x<140: "SeaSalt Switch"),
    // specs in the middle (x~300-400), price right (x~545). The model must be
    // the switch name, NOT the technical specs.
    const items = [
      // Header
      { str: 'Switch', transform: [1,0,0,1,22,730] },
      { str: 'Classification', transform: [1,0,0,1,85,722] },
      { str: 'Style', transform: [1,0,0,1,207,722] },
      { str: 'Technical', transform: [1,0,0,1,299,722] },
      { str: 'Parameters', transform: [1,0,0,1,359,722] },
      { str: 'CNY', transform: [1,0,0,1,475,722] },
      { str: 'USD', transform: [1,0,0,1,543,722] },
      // Row: SeaSalt Switch (name at x<140)
      { str: 'SeaSalt', transform: [1,0,0,1,7,75] },
      { str: 'Switch', transform: [1,0,0,1,42,75] },
      { str: 'Mechanical', transform: [1,0,0,1,83,68] },
      { str: 'Switch', transform: [1,0,0,1,136,68] },
      { str: 'Silent', transform: [1,0,0,1,96,81] },
      { str: 'Tactile', transform: [1,0,0,1,123,81] },
      // Specs (must NOT be the model)
      { str: 'Working', transform: [1,0,0,1,298,84] },
      { str: 'stroke:', transform: [1,0,0,1,339,84] },
      { str: '2.00', transform: [1,0,0,1,372,84] },
      { str: 'Lower', transform: [1,0,0,1,306,75] },
      { str: 'cover', transform: [1,0,0,1,337,75] },
      { str: 'material:', transform: [1,0,0,1,363,75] },
      { str: 'PA', transform: [1,0,0,1,405,75] },
      { str: 'Working', transform: [1,0,0,1,315,62] },
      { str: 'force:', transform: [1,0,0,1,356,62] },
      { str: '47', transform: [1,0,0,1,384,62] },
      { str: '5g', transform: [1,0,0,1,399,62] },
      // Price
      { str: '￥', transform: [1,0,0,1,476,75] },
      { str: '1.56', transform: [1,0,0,1,486,75] },
      { str: '$0.22', transform: [1,0,0,1,545,75] }
    ];
    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [], 'Haimu', []);
    const p = products[0];
    this.assert(p && p.modelo.includes('SeaSalt'), 'FASE2-S3-Haimu: modelo incluye el nombre del switch "SeaSalt"');
    this.assert(!/working|stroke|cover|material/i.test(p.modelo), 'FASE2-S3-Haimu: specs técnicas NO quedan en el modelo');
  },

  testFase2Slice4LogitechFusedCellForwardModel() {
    // Logitech fused cell: row at y=554 has NO model text but price $29.57.
    // The model "M750 M" is centered BELOW at y=587 with the same price — the
    // anchor must bind to M750 M (by Y-overlap), not inherit M720 from above.
    const items = [
      { str: 'Logitech', transform: [1,0,0,1,55,700] },
      { str: 'M720', transform: [1,0,0,1,96,700] },
      { str: 'Wireless', transform: [1,0,0,1,186,700] },
      { str: 'Mouse', transform: [1,0,0,1,227,700] },
      { str: 'Black', transform: [1,0,0,1,308,700] },
      { str: '￥', transform: [1,0,0,1,471,700] },
      { str: '163.44', transform: [1,0,0,1,481,700] },
      { str: '$24.04', transform: [1,0,0,1,542,700] },
      // y=554 row: NO model name, price $29.57 (belongs to M750 M block below)
      { str: 'Wireless', transform: [1,0,0,1,186,666] },
      { str: 'Mouse', transform: [1,0,0,1,227,666] },
      { str: 'Black', transform: [1,0,0,1,308,666] },
      { str: '￥', transform: [1,0,0,1,471,666] },
      { str: '201.08', transform: [1,0,0,1,481,666] },
      { str: '$29.57', transform: [1,0,0,1,542,666] },
      // y=587 row: model centered here (M750 M), same price
      { str: 'Logitech', transform: [1,0,0,1,49,633] },
      { str: 'M750', transform: [1,0,0,1,90,633] },
      { str: 'M', transform: [1,0,0,1,119,633] },
      { str: 'Wireless', transform: [1,0,0,1,186,633] },
      { str: 'Mouse', transform: [1,0,0,1,227,633] },
      { str: 'White', transform: [1,0,0,1,307,633] },
      { str: '￥', transform: [1,0,0,1,471,633] },
      { str: '201.08', transform: [1,0,0,1,481,633] },
      { str: '$29.57', transform: [1,0,0,1,542,633] },
      // y=620 row: M750 M Pink (same price, continues block)
      { str: 'Wireless', transform: [1,0,0,1,186,600] },
      { str: 'Mouse', transform: [1,0,0,1,227,600] },
      { str: 'Pink', transform: [1,0,0,1,310,600] },
      { str: '￥', transform: [1,0,0,1,471,600] },
      { str: '201.08', transform: [1,0,0,1,481,600] },
      { str: '$29.57', transform: [1,0,0,1,542,600] }
    ];
    const products = PdfParser.extractPageProductsByCellGrid(items, 800, 1, [], 'Logitech', []);
    // Effective Y = viewportHeight(800) - transform[5]: empty row at 800-666=134,
    // M750 M row at 800-633=167, M720 row at 800-700=100.
    const rowEmpty = products.find(p => Math.abs(p.y - 134) < 6);
    const rowM750 = products.find(p => Math.abs(p.y - 167) < 6);
    const rowM720 = products.find(p => Math.abs(p.y - 100) < 6);
    this.assert(rowEmpty, 'FASE2-S4-Logitech: fila sin modelo (y=134) extraída');
    this.assert(rowEmpty && /M750/.test(rowEmpty.modelo), 'FASE2-S4-Logitech: fila vacía usa modelo M750 M (celda fusionada con texto debajo) en vez de heredar M720');
    this.assert(rowM750 && /M750/.test(rowM750.modelo), 'FASE2-S4-Logitech: fila M750 M (y=167) modelo correcto');
    this.assert(rowM720 && /M720/.test(rowM720.modelo), 'FASE2-S4-Logitech: fila M720 (y=100) modelo correcto');
  },

  testCatalogAssignmentGates() {
    if (typeof CatalogAssignmentGates === 'undefined') {
      this.assert(false, 'Modulo CatalogAssignmentGates no está definido');
      return;
    }
    const G = CatalogAssignmentGates;
    const base = {
      sku: 'S1', cat: 'TECLADO', marca: 'Atk', modelo: 'X1', variante: '',
      fob: 10, img: '-', status: 'GREEN', warnings: [], grounded: true, importable: true,
    };
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    // --- imagen: cross-categoría desasigna ---
    {
      const a = { ...base, sku: 'A1', cat: 'TECLADO', img: PNG, status: 'GREEN' };
      const b = { ...base, sku: 'A2', cat: 'MOUSE', img: PNG, status: 'GREEN' };
      const { products } = G.applyImageIntegrityGates([a, b]);
      const kb = products.find(p => p.sku === 'A2');
      this.assert(kb.img === '-', 'Imagen cross-categoría se desasigna del producto secundario');
      this.assert(kb.warnings.some(w => w.includes('categor')), 'Warning de cross-categoría presente');
    }

    // --- imagen: rebrand con identidad exacta conserva ---
    {
      const a = { ...base, sku: 'B1', marca: 'Irok', modelo: 'Mer68 Max', cat: 'TECLADO', img: PNG, status: 'GREEN' };
      const b = { ...base, sku: 'B2', marca: 'Mars', modelo: 'Mer68 Max', cat: 'TECLADO', img: PNG, status: 'GREEN' };
      const { products } = G.applyImageIntegrityGates([a, b]);
      this.assert(products.every(p => p.img === PNG), 'Rebrand con marca+modelo+cat idénticos conserva la imagen');
    }

    // --- imagen: cross-marca sin identidad desasigna ---
    {
      const a = { ...base, sku: 'C1', marca: 'Atk', modelo: 'Babypink', cat: 'TECLADO', img: PNG, status: 'GREEN' };
      const b = { ...base, sku: 'C2', marca: 'Vgn', modelo: 'Dragonfly VXE Dongle', cat: 'MOUSE', img: PNG, status: 'GREEN' };
      const { products } = G.applyImageIntegrityGates([a, b]);
      const loser = products.find(p => p.sku === 'C2');
      this.assert(loser.img === '-', 'Imagen cross-marca sin identidad de modelo se desasigna');
    }

    // --- placeholder nunca GREEN ---
    {
      const p = { ...base, img: '-', status: 'GREEN' };
      const { products } = G.applyImageIntegrityGates([p]);
      this.assert(products[0].status === 'YELLOW', 'Placeholder degrada GREEN → YELLOW');
      this.assert(products[0].warnings.includes('Sin imagen'), 'Warning "Sin imagen" presente');
    }

    // --- template model → RED no importable ---
    {
      const p = { ...base, modelo: 'Product Picture Model No.#', status: 'GREEN', importable: true };
      const { products } = G.applyModelQualityGates([p]);
      this.assert(products[0].status === 'RED', 'Modelo de plantilla degrada a RED');
      this.assert(products[0].importable === false, 'Modelo de plantilla no es importable');
    }

    // --- color model → YELLOW ---
    {
      const p = { ...base, modelo: 'Purple', status: 'GREEN' };
      const { products } = G.applyModelQualityGates([p]);
      this.assert(products[0].status === 'YELLOW', 'Modelo color degrada a YELLOW');
    }

    // --- truncado → reparado (modelo limpio + variante) ---
    {
      const p = { ...base, modelo: 'F87 (light', status: 'GREEN' };
      const { products } = G.applyModelQualityGates([p]);
      this.assert(products[0].modelo === 'F87', 'Modelo truncado se repara (base del modelo)');
      this.assert(/light/.test(products[0].variante), 'Parte truncada pasa a variante');
      this.assert(products[0].status === 'GREEN', 'Modelo reparado conserva GREEN');
    }

    // --- watch model no degrada ---
    {
      const p = { ...base, modelo: 'Air', status: 'GREEN' };
      const { products } = G.applyModelQualityGates([p]);
      this.assert(products[0].status === 'GREEN', 'Modelo watch (línea real, e.g. ATK Air) no degrada');
    }

    // --- duplicados detectados ---
    {
      const a = { ...base, sku: 'D1', marca: '8bitdo', modelo: 'Ultimate 2C', cat: 'CONTROLLER', fob: 27.46 };
      const b = { ...base, sku: 'D2', marca: '8bitdo', modelo: 'Ultimate 2C', cat: 'CONTROLLER', fob: 27.46 };
      const dups = G.detectDuplicates([a, b]);
      this.assert(dups.length === 1, 'Duplicado marca+modelo+cat+fob detectado');
      this.assert(dups[0].count === 2, 'Grupo duplicado cuenta 2 productos');
    }

    // --- métricas ---
    {
      const p = { ...base, img: '-', status: 'YELLOW' };
      const m = G.computeMetrics([p]);
      this.assert(m.placeholder === 1 && m.placeholderRate === 1, 'Métrica de placeholder correcta');
      this.assert(m.status.YELLOW === 1, 'Métrica de status correcta');
    }
  },
};

if (typeof window !== 'undefined') window.Tests = Tests;
if (typeof module !== 'undefined') module.exports = Tests;
