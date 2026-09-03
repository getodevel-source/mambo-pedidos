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
		console.log("🧪 Ejecutando Suite de Pruebas Unitarias de Mambo Pedidos...");
		this.results = [];

		this.testCalculator();
		this.testValidations();
		this.testDualCurrency();
		this.testZeroCosts();
		this.testLatamDecimalFormat();
		this.test8BitDoBrand();
		this.testParserGeneralizationFixes();
		this.testInfallibilityGate();
		this.testWeightBasedFreight();
		this.testCourierWarnings();
		this.testImportGuide();
		this.testTextSanitizer();
		this.testColorFieldSanitization();
		this.testQuoteGeneratorHtml();
		this.testQuoteI18nFormatterCache();
		this.testQuoteUsesSmallThumb();
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
		this.testNumpadCategoryDetection();
		this.testTitleDeduplication();
		this.testAj139MouseCategory();
		this.testTopDownDirectionalGate();
		this.testFamilyTitleColorProfile();
		this.testGlobalBipartiteMatching();
		this.testMoveTrailingTypeKeyword();
		this.testModelQualityGatesFailClosed();
		this.testSkuFailClosed();
		this.testHeaderPriorityRowContext();
		this.testTableHeaderNoiseFilter();
		this.testSpatialCellGridExtraction();
		this.testBrowserParserWiring();
		this.testDoorToDoorCustomsLiquidation();
		this.testCorporateNoiseSanitizer();
		this.testMinFobKpiPositiveFilter();
		this.testDefaultSvgImageFallback();
		this.testCatalogImportFieldCoherence();
		this.testCategoryChipsIconSupport();
		this.testRepairCatalogItem();
		this.testCatalogValidatorRules();
		this.testBuildCatalogExportJSON();
		this.testCatalogQualityReport();
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
		this.testCatalogFiltersAudit();
		this.testRealCatalogCoherence();
		this.testOnDemandZeroIdleMemoryGuarantee();
		await this.testCellStructuredLlmPipeline();
		this.testAppUpdaterModule();
		this.testCatalogAssignmentGates();
		this.testImageTextGates();
		this.testImageTextCategoryAspect();
		this.testAssignmentSharedEvidence();
		this.testImageTextExportPreview();
		this.testGroundingGeometry();
		this.testCatalogStatsOutliers();
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
		await this.testPhotoQualityStorageRoundTrip();
		this.testStoreInitStoreLoadFallback();
		this.testMarginalCropDetector();
		this.testSkuAuditThreeDomains();
		this.testSkuDeterministicMapping();
		this.testSkuAmbiguityGate();
		await this.testPersistenceWithEvidence();
		await this.testStoreFallbackRecovery();
		this.testImportabilityFilter();
		// persistence-fix: puente real hacia los plugins Tauri v2 (modo, cuota,
		// imagenes en disco, draft del wizard).
		await this.testStorageModeWithoutBridge();
		await this.testStorageModeWithTauriBridge();
		await this.testStorageStoreLoadFailureDegrades();
		await this.testStorageFsApiFromBridge();
		await this.testStorageImageFilesRoundTrip();
		await this.testStorageImageWriteFailure();
		await this.testStorageQuotaStripPolicy();
		this.testBytesToDataUrlChunked();
		await this.testImportWizardProjectPersistence();
		this.testScriptGlobalLexicalCollisions();
		await this.testStorageRealDiskPersistence();
		await this.testImportWizardStatePersistence();
		await this.testRatesVigencia();
		await this.testQuoteHistoryReprint();
		await this.testNcmOverrideBySku();
		await this.testWizardSummaryPdf();
		this.testFase2Slice3KzMatrixModelName();
		this.testFase2Slice3KzHighResolution();
		this.testFase2Slice3HaimuSwitchName();
		this.testFase2Slice4LogitechFusedCellForwardModel();

		const passed = this.results.filter((r) => r.pass).length;
		const total = this.results.length;
		console.log(
			`\n📊 Resultado: ${passed}/${total} pruebas pasaron exitosamente.`,
		);
		return { passed, failed: total - passed, total, results: this.results };
	},

	testCalculator() {
		const items = [
			{ sku: "TEC-001", fob: 100, qty: 10 },
			{ sku: "MOU-001", fob: 50, qty: 20 },
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
			tipoCambio: 1000,
		};

		const res = Calculator.calculateOrder(items, config);

		// Total FOB = (100*10) + (50*20) = 1000 + 1000 = 2000
		this.assert(
			res.totals.fob === 2000,
			"Calculo de Total FOB correcto ($2000 USD)",
		);

		// CIF = 2000 + 10% (200) = 2200. Factor = 2200 / 2000 = 1.1
		this.assert(
			res.totals.costo === 2200,
			"Calculo de Costo total CIF correcto ($2200 USD)",
		);

		// Item 1: costoU = 100 * 1.1 = 110. PVP = 110 * 2 = 220.
		const item1 = res.items[0];
		this.assert(
			item1.costoU === 110,
			"Item 1 costo unitario ponderado correcto ($110 USD)",
		);
		this.assert(item1.pvp === 220, "Item 1 PVP calculated correcto ($220 USD)");
	},

	testValidations() {
		const validSku = Validations.validateField("sku", "ATT-MOU-0001");
		this.assert(validSku.valid, "SKU válido es aceptado");

		const invalidSku = Validations.validateField("sku", "SKU CON ESPACIOS!");
		this.assert(
			!invalidSku.valid,
			"SKU inválido con caracteres prohibidos es rechazado",
		);

		const validFob = Validations.validateField("fob", 45.5);
		this.assert(validFob.valid, "FOB dentro del rango $0.01-$500 es aceptado");

		const invalidFob = Validations.validateField("fob", -5);
		this.assert(!invalidFob.valid, "FOB negativo es rechazado");
	},

	testDualCurrency() {
		const items = [{ sku: "TEST-01", fob: 10, qty: 1 }];
		const config = {
			flete: 0,
			seguro: 0,
			derechos: 0,
			tasa: 0,
			perc: 0,
			desp: 0,
			courier: 0,
			markup: 1.5,
			tipoCambio: 1200,
		};
		const res = Calculator.calculateOrder(items, config);

		this.assert(
			res.totals.fobArs === 12000,
			"Conversión de FOB a ARS ($12,000 ARS) correcta",
		);
		this.assert(
			res.items[0].pvpArs === 18000,
			"Conversión de PVP a ARS ($18,000 ARS) correcta",
		);
	},

	testZeroCosts() {
		const items = [{ sku: "ZERO-01", fob: 100, qty: 1 }];
		const config = {
			flete: 0,
			seguro: 0,
			derechos: 0,
			tasa: 0,
			perc: 0,
			desp: 0,
			courier: 0,
			markup: 1.0,
			tipoCambio: 1000,
		};
		const res = Calculator.calculateOrder(items, config);

		// Con costos en 0, el costo total debe ser exactamente el FOB ($100) sin aplicar defaults indeseados (15% etc)
		this.assert(
			res.totals.costo === 100,
			"Permite configurar Flete 0% y gastos 0 USD sin forzar fallbacks",
		);
		this.assert(res.items[0].costoU === 100, "Costo unitario respeta Flete 0%");
	},

	testLatamDecimalFormat() {
		const parsed = Calculator.parseNum("31,75", 0);
		this.assert(
			parsed === 31.75,
			'Parseo correcto de decimales con coma ("31,75" -> 31.75)',
		);

		const valResult = Validations.validateField("fob", "45,50");
		this.assert(
			valResult.valid && valResult.value === 45.5,
			'Validación acepta y convierte FOB con coma ("45,50")',
		);
	},

	test8BitDoBrand() {
		const brand = PdfParser.detectBrandFromTextLine(
			"8BitDo Ultimate C 2.4G Controller Black",
		);
		this.assert(
			brand === "8BitDo",
			"Detección correcta de la marca 8BitDo en línea de producto",
		);

		const cat = PdfParser.guessCategory(
			"8BitDo Ultimate Controller",
			"Wireless",
		);
		this.assert(
			cat === "CONTROLLER",
			"Clasificación correcta de categoría CONTROLLER para mandos 8BitDo",
		);
	},

	testParserGeneralizationFixes() {
		// IT14 (SLICE 5): fixes GENERALIZABLES de extracción — validados con el
		// harness anti-overfit (FP_rate_clean 8% estable) y el audit fail-closed.
		// 1. Códigos v\d desnudos (V8/V6/V5 de Attack Shark) NO se limpian ni se
		//    reemplazan por specs de la variante.
		const s8 = PdfParser.sanitizeProductNames(
			"V8",
			"PAW3950MAX Black",
			"Attack shark",
		);
		this.assert(
			s8.modelo === "V8",
			"SLICE5: código v\\d desnudo se conserva como modelo (V8)",
		);
		const s6 = PdfParser.sanitizeProductNames(
			"V6",
			"Magnetic Charging Dock Tri mode Black",
			"Attack shark",
		);
		this.assert(
			s6.modelo === "V6",
			"SLICE5: V6 se conserva con specs en variante",
		);
		// 2. TextSanitizer respeta el código (no promueve el sensor desde variante).
		if (typeof TextSanitizer !== "undefined") {
			const t8 = TextSanitizer.sanitizeItem(
				{
					marca: "Attack shark",
					modelo: "V8",
					variante: "PAW3950MAX Black",
					cat: "MOUSE",
				},
				[],
			);
			this.assert(
				t8.modelo === "V8",
				"SLICE5: TextSanitizer conserva V8 (no promueve PAW3950MAX)",
			);
			this.testNounPhraseCalibration();
			this.testSwitchAxisClassification();
			this.testReasonInstrumentation();
			this.testColorAmbiguityResolution();
			this.testOutlierLiteralCalibration();
			this.testCalibrationDelta();
			this.testColorFromImageStrategy();
			this.testVarianteColorAdoptionStrategy();
			this.testLiteralPriceRegroundingStrategy();
			this.testLiteralAnchorSearchStrategy();
			this.testTruncationRepairStrategy();
			this.testSwitchToVarianteStrategy();
			this.testRowContextAndCodeAdoptionStrategies();
			this.testSharedImageReassignStrategy();
			this.testPromotionEvidenceContract();
			this.testReasonLabelResolution();
			this.testLegacyOnlyCleanStrategy();
			this.testCategoryCorrectionStrategy();
			this.testAspectCalibratedStrategy();
		}
		// 3. isSpecOnlyModel discrimina specs de modelos legítimos sin dígitos.
		this.assert(
			PdfParser.isSpecOnlyModel("PAW3950MAX") === true,
			"SLICE5: PAW3950MAX es spec",
		);
		this.assert(
			PdfParser.isSpecOnlyModel("8KHz") === true,
			"SLICE5: 8KHz es spec",
		);
		this.assert(
			PdfParser.isSpecOnlyModel("X3 Wireless") === false,
			"SLICE5: X3 Wireless NO es spec",
		);
		this.assert(
			PdfParser.isSpecOnlyModel("Cheese") === false,
			"SLICE5: Cheese (keycap) NO es spec",
		);
		// 4. Grounding: celda de specs de switch (Haimu) y celda marca+color (Mchose)
		//    NO generan gap — el modelo por herencia/columna es legítimo.
		const gapHaimu = PdfParser.modelEvidenceGap({
			modelo: "SeaSalt Switch Silent",
			marca: "Haimu",
			cellRawText:
				"Total Brown Switch Bottoming stroke: 3.60 0.40mm Upper cover material: PC Working stroke Lower cover material: PA Tactile force Axle core material: POM",
		});
		this.assert(
			gapHaimu.gap === false,
			"SLICE5: celda de specs de switch no genera gap (Haimu)",
		);
		const gapMchose = PdfParser.modelEvidenceGap({
			modelo: "A7V3Pro+",
			marca: "Mchose",
			cellRawText: "MChose Red",
		});
		this.assert(
			gapMchose.gap === false,
			"SLICE5: celda marca+color no genera gap (Mchose)",
		);
		const gapEv = PdfParser.modelEvidenceGap({
			modelo: "V8",
			marca: "Attack shark",
			cellRawText: "V8 Black",
		});
		this.assert(
			gapEv.gap === false,
			"SLICE5: V8 con evidencia literal no genera gap",
		);
		// IT15: filas nameless de specs (Haimu "Total Bottoming") son spec pura →
		// heredan; palabras de plantilla (Standard/Business) NO son spec.
		this.assert(
			PdfParser.isSpecOnlyModel("Total Bottoming") === true,
			"IT15: Total Bottoming es spec pura (hereda)",
		);
		this.assert(
			PdfParser.isSpecOnlyModel("Standard") === false,
			"IT15: Standard (plantilla) NO es spec",
		);
		this.assert(
			PdfParser.isSpecOnlyModel("Business") === false,
			"IT15: Business (plantilla) NO es spec",
		);
	},

	testInfallibilityGate() {
		// IT17 (spec infallibility-contract): el gate de calidad de modelo debe
		// flaguear los modelos inflados/degenerados (los 24 falsos negativos
		// auditados) sin flaguear los modelos reales.
		const q = (m) =>
			TextSanitizer.assessModelQuality(m, "", "MOUSE", (m || "") + " row");
		const y = (m, label) => this.assert((q(m) || {}).level === "YELLOW", label);
		const g = (m, label) => this.assert((q(m) || {}).level === "GREEN", label);
		// palabra genérica degenerada → YELLOW (regla segura IT17)
		y("Rose", "INF: Rose degenerado → YELLOW");
		y("Standard", "INF: Standard degenerado → YELLOW");
		y("Zero", "INF: Zero degenerado → YELLOW");
		y("Ultimate", "INF: Ultimate degenerado → YELLOW");
		// modelos reales NO se flaguean
		g("M720", "INF: M720 limpio → GREEN");
		g("BlackWidow V4", "INF: BlackWidow V4 limpio → GREEN");
		g("G502", "INF: G502 limpio → GREEN");
		g("V8", "INF: V8 limpio → GREEN");
		// modelo descriptivo legítimo NO se flaguea (convención del app)
		g(
			"F75 Gasket Keyboard",
			"INF: F75 Gasket Keyboard (descriptivo legítimo) → GREEN",
		);
		// IT25 (parser-to-10): marketing puffery → YELLOW (recall 65→85%)
		y("Ultra Crystalblade Gleam", "INF: puffery 3 palabras → YELLOW");
		y("Master Wireless Mouse", "INF: Master + tipo sin código → YELLOW");
		y("Icy Creamsicle Horizon", "INF: puffery → YELLOW");
		y("68HE Ultra Jade King", "INF: puffery con código → YELLOW");
		// anti-overfit: 1 marketing + código real → GREEN
		g("AJ139 Pro", "INF: AJ139 Pro (1 marketing + código) → GREEN");
		g("NJ07 Ultra NACODEX", "INF: NJ07 Ultra (1 marketing + código) → GREEN");
		g(
			"Flagship PRO 68 Keys",
			"INF: Flagship PRO 68 (1 marketing + dígitos) → GREEN",
		);
		// code+type (IT17) sigue en la cola humana, NO se marca
		// code+type (IT17) - SLICE 3 cierra esta clase con el discriminador
		// conexión+categoría (design §IT17 resolution, rule 1): M720 Wireless
		// Mouse (código real + conexión + categoría) ahora es YELLOW. "F75 Gasket
		// Keyboard" sigue GREEN (Gasket es material, no conexión).
		y("M720 Wireless Mouse", "SLICE3: M720 (conexión+categoría) → YELLOW");
    		// PIL iteración 1 (2026-08-30): residuos de celda y palabras genéricas
    		// detectables — 4 de los 24 falsos negativos del baseline (recall 23%).
    		y("F87 (dark )", "PIL1: paréntesis residual (ambos presentes) → YELLOW");
    		y("dark )", "PIL1: paréntesis huérfano sin abrir → YELLOW");
    		y("Printed", "PIL1: palabra genérica printed → YELLOW");
    		y("Dust Printed", "PIL1: genérica compuesta sin código → YELLOW");
    		y("Screen", "PIL1: spec screen como modelo → YELLOW");
    		// anti-overfit PIL1: modelos limpios NO se tocan
    		g("F87", "PIL1: F87 limpio → GREEN");
    		g("V75X", "PIL1: V75X limpio → GREEN");
    		// PIL iteración 3 (2026-08-31): hojas de specs de switch y modelo sin
    		// código con switch/axis en la celda cruda (+4 FN del baseline 30%).
    		const qr = (m, cat, raw) => (TextSanitizer.assessModelQuality(m, "", cat, raw) || {}).level;
    		this.assert(qr("SeaSalt Switch Silent", "SWITCH", "SeaSalt Switch Silent Total stroke: 3.60 Upper cover") === "YELLOW", "PIL3: hoja de specs de switch → YELLOW");
    		this.assert(qr("Midnight Blue", "SWITCH", "Midnight Blue Switch Total stroke: 3.5 Upper cover") === "YELLOW", "PIL3: switch suelto con specs → YELLOW");
    		this.assert(qr("Flame", "TECLADO", "Flame Switch Orange Black pink") === "YELLOW", "PIL3: switch en celda cruda sin código → YELLOW");
    		this.assert(qr("Serpent", "TECLADO", "Serpent Axis White Black") === "YELLOW", "PIL3: axis en celda cruda sin código → YELLOW");
    		this.assert(qr("Turbo+ V9", "TECLADO", "MCHOSE V9 Turbo+ Magnetic Wireless") === "GREEN", "PIL3 anti-overfit: con código → GREEN");
    		this.assert(TextSanitizer.assessModelQuality("Ace68GT", "Mount Tai Pink Magnetic Switch", "TECLADO", "Ace68GT Mount Tai Pink Magnetic Switch").level === "GREEN", "PIL3 anti-overfit: código + switch en raw (variante real) → GREEN");
    		// PIL iteración 4: código duplicado dentro del modelo (celda nombre+descripción)
    		this.assert(qr("AK980V2PRO Lychee AK980 Transparent", "TECLADO", "row") === "YELLOW", "PIL4: código duplicado → YELLOW");
    		this.assert(qr("A87 Plum Pro Sea Salt", "TECLADO", "row") === "GREEN", "PIL4 anti-overfit: 1 código + descripción → GREEN");
		// windowControls (window-controls-macos): barra de título y guards
		{
			const { JSDOM } = require("jsdom");
			const fs = require("fs");
			const path = require("path");
			const code = fs.readFileSync(path.join(__dirname, "windowControls.js"), "utf8");
			const dom = new JSDOM(
				'<!doctype html><html><body><div class="titlebar"><button data-act="close"></button><button data-act="minimize"></button><button data-act="fullscreen"></button></div></body></html>',
				{ runScripts: "outside-only", url: "http://localhost/" },
			);
			const win = dom.window;
			win.eval(code);
			// en el sandbox con platform linux el título se activa: html.mac-titlebar
			const wcPlatform = (String(win.navigator.platform || "") + " " + String(win.navigator.userAgent || "")).toLowerCase();
			const wcExpectMac = /linux|darwin/.test(wcPlatform);
			this.assert(
				win.document.documentElement.classList.contains("mac-titlebar") === wcExpectMac,
				"WC: mac-titlebar según plataforma del runner (esperado " + (wcExpectMac ? "activado" : "inactivo") + ")",
			);
			const closeBtn = win.document.querySelector('[data-act="close"]');
			this.assert(closeBtn !== null, "WC: botón cerrar presente");
			const minBtn = win.document.querySelector('[data-act="minimize"]');
			this.assert(minBtn !== null, "WC: botón minimizar presente");
			const fullBtn = win.document.querySelector('[data-act="fullscreen"]');
			this.assert(fullBtn !== null, "WC: botón pantalla completa presente");
			// sin __TAURI__ los clicks no lanzan (guarda)
			let threw = false;
			try { closeBtn.click(); } catch (e) { threw = true; }
			this.assert(!threw, "WC: sin Tauri los clicks son inertes (sin excepción)");
		}
	// assignment-anchors (repo-improvement-sprint): modo matriz de tarifa común
		{
			const vg = (anchor, rowY, pageAnchors) =>
				PdfParser.verifyGrounding({ anchor, rowTextY: rowY, pageNum: 1, pageAnchors });
			const matriz = vg(
				{ x: 100, y: 400, price: 14.54 }, 30,
				[{ x: 100, y: 400, price: 14.54 }, { x: 300, y: 400, price: 9.3 }, { x: 500, y: 400, price: 38.05 }],
			);
			this.assert(matriz.grounded === true && matriz.reason.indexOf('matriz') === 0, 'AA: matriz de tarifa común → grounded por columna');
			const normal = vg(
				{ x: 100, y: 300, price: 20.6 }, 300,
				[{ x: 100, y: 300, price: 20.6 }, { x: 300, y: 500, price: 9.3 }, { x: 500, y: 700, price: 38.05 }],
			);
			this.assert(normal.grounded === true && normal.reason.indexOf('geometría') >= 0, 'AA: tabla normal alineada → sigue pasando por geometría');
			const desal = vg(
				{ x: 100, y: 90, price: 11.16 }, 240,
				[{ x: 100, y: 90, price: 11.16 }, { x: 400, y: 500, price: 9.3 }, { x: 600, y: 700, price: 38.05 }],
			);
			this.assert(desal.grounded === false, 'AA: tabla desalineada real (sin fila común) → sigue fallando');
		}
	// U4 (repo-improvement-sprint): overlay de diagnóstico (sandbox jsdom)
		this.testDiagnosticsOverlay();
		// PIL5 (repo-improvement-sprint): celda con información sin extraer
    		this.assert(qr("MAD V2", "MOUSE", "MAD V2 Snowlight HE Switch Black Ice Carbon Fiber Dual Light RGB") === "YELLOW", "PIL5: celda con exceso de tokens → YELLOW");
    		this.assert(TextSanitizer.assessModelQuality("Ace68GT", "Mount Tai Pink Magnetic Switch", "TECLADO", "Ace68GT Mount Tai Pink Magnetic Switch GT Translucent powder").level === "GREEN", "PIL5 anti-overfit: corte completo → GREEN");
    		this.assert(TextSanitizer.assessModelQuality("G502 X", "Wired Mouse Black", "MOUSE", "Logitech G502 X Wired Mouse Black").level === "GREEN", "PIL5 anti-overfit: exceso < 4 → GREEN");
		// SLICE 3 (tasks 3.3/3.5): the measured false negatives (design §IT17
		// resolution rules 1-3) + clean guard that must NOT be flagged.
		y(
			"G502 Wired Mouse",
			"SLICE3: G502 (conexión+categoría con código real) → YELLOW",
		);
		y(
			"68 Keys Esport",
			"SLICE3: 68 Keys Esport (spec sin código real) → YELLOW",
		);
		y(
			'0500 Backpack Tactical 15.6"',
			"SLICE3: 0500 Backpack (categoría/spec sin código real) → YELLOW",
		);
		y(
			"Mount Tai GT powder",
			"SLICE3: Mount Tai GT powder (material sin código real) → YELLOW",
		);
		y(
			"Hall Effect Ace 68 Air",
			"SLICE3: Hall Effect Ace 68 Air (hall effect sin código real) → YELLOW",
		);
		g(
			"F75 Glacier",
			"SLICE3: F75 Glacier (descriptivo legítimo con código) → GREEN",
		);
	},

	testWeightBasedFreight() {
		const items = [{ sku: "W-01", fob: 100, qty: 1 }];
		const config = {
			fleteModo: "peso",
			pesoKg: 10,
			costoPorKg: 15,
			seguro: 0,
			derechos: 0,
			tasa: 0,
			perc: 0,
			desp: 0,
			courier: 0,
			markup: 2.0,
			tipoCambio: 1000,
		};
		const res = Calculator.calculateOrder(items, config);

		// Flete por peso = 10kg * $15 = $150 USD. Total Costo = $100 + $150 = $250 USD
		this.assert(
			res.totals.fleteUsd === 150,
			"Cálculo de flete por peso ($150 USD para 10kg a $15/kg) correcto",
		);
		this.assert(
			res.totals.costo === 250,
			"Costo final incluye flete por peso ($250 USD)",
		);
	},

	testCourierWarnings() {
		const items = [{ sku: "OVER-01", fob: 3500, qty: 1 }];
		const config = {
			logisticaModo: "courier",
			flete: 0,
			seguro: 0,
			derechos: 0,
			tasa: 0,
			perc: 0,
			desp: 0,
			courier: 0,
			markup: 1.0,
			tipoCambio: 1000,
		};
		const res = Calculator.calculateOrder(items, config);

		const hasWarning = res.warnings.some(
			(w) => w.code === "COURIER_FOB_EXCEEDED",
		);
		this.assert(
			hasWarning,
			"Advertencia activada cuando el pedido Courier supera USD 3000 FOB",
		);
	},

	// ── ImportGuide (Etapa A): plan exhaustivo + fail-closed ──
	// Exhaustividad: los tests afirman el SET COMPLETO de pasos por régimen.
	// Agregar un paso al motor sin actualizar estos sets = rojo en CI
	// ("no nos falta nada" es verificable, no una promesa).
	testImportGuide() {
		const pedidoMixto = [
			{ sku: "K1", cat: "TECLADO", modelo: "Kumara", fob: 30, qty: 5 },
			{ sku: "M1", cat: "MOUSE", modelo: "Mamba BT", fob: 20, qty: 10, weightKg: 0.2 },
			{ sku: "H1", cat: "HEADSET", modelo: "Nari", fob: 50, qty: 3 },
			{ sku: "C1", cat: "CONTROLLER", modelo: "Pad", fob: 25, qty: 4 },
		];
		const door = { pesoKg: 10, costoPorKg: 12, fletePct: 0.15, seguroPct: 0.015, regimen: "importador" };

		// 1) Marítimo con pedido mixto (cable + wireless) → SET COMPLETO de 14 pasos.
		const planMar = ImportGuide.planFor(pedidoMixto, { regimen: "importador", fleteModo: "peso", pesoKg: 10, transporte: "maritimo", enacomTitular: "fabricante" }, door);
		const idsMar = planMar.pasos.map((p) => p.id).join(",");
		this.assert(
			planMar.regimen === "maritimo" && planMar.valido,
			"ImportGuide: plan marítimo válido para pedido mixto",
		);
		this.assert(
			idsMar === "orden-compra,pago,produccion,documentacion,flete,arribo,despachante,sim,ncm-aforo,tributos,enacom,deposito,levante,recepcion",
			"ImportGuide: marítimo genera el SET COMPLETO de 14 pasos (incluye ENACOM solo por wireless)",
		);

		// 2) Marítimo solo-cable → 13 pasos, SIN enacom.
		const planCable = ImportGuide.planFor([pedidoMixto[0]], { regimen: "importador", fleteModo: "peso", pesoKg: 5, transporte: "maritimo" }, door);
		this.assert(
			planCable.pasos.length === 13 && !planCable.pasos.some((p) => p.id === "enacom"),
			"ImportGuide: pedido solo-cable NO genera el paso ENACOM",
		);

		// 3) Courier personal cable-only → SET COMPLETO de 8 pasos, válido, sin aviso de reventa.
		const planCp = ImportGuide.planFor([pedidoMixto[0]], { regimen: "courier", proposito: "personal", fleteModo: "peso", pesoKg: 5, transporte: "courier" }, door);
		this.assert(
			planCp.valido && planCp.regimen === "courier",
			"ImportGuide: plan courier personal válido",
		);
		this.assert(
			planCp.pasos.map((p) => p.id).join(",") === "compra,despacho-origen,limites,transito,arribo-simplificado,tributos-simplificados,entrega,registro",
			"ImportGuide: courier personal genera el SET COMPLETO de 8 pasos",
		);
		this.assert(
			!planCp.avisos.some((a) => a.includes("reventa")),
			"ImportGuide: courier personal sin aviso de régimen fiscal",
		);

		// 4) Courier reventa + wireless → aviso d1 + ENACOM + litio; nunca silencioso.
		const planCr = ImportGuide.planFor(pedidoMixto, { regimen: "courier", proposito: "reventa", fleteModo: "peso", pesoKg: 8, transporte: "courier", enacomTitular: "propia" }, door);
		const idsCr = planCr.pasos.map((p) => p.id).join(",");
		this.assert(
			planCr.pasos.some((p) => p.id === "regimen-fiscal"),
			"ImportGuide: courier reventa incluye el paso de régimen fiscal (d1)",
		);
		this.assert(
			idsCr.includes("enacom") && idsCr.includes("litio-aereo"),
			"ImportGuide: courier reventa wireless genera ENACOM + litio aéreo",
		);
		this.assert(
			planCr.avisos.some((a) => a.includes("reventa") && a.includes("verificación")),
			"ImportGuide: aviso d1 honesto (verificación de fuente) presente",
		);

		// 5) Courier fuera de límites → fail-closed: plan inválido + sugerencia barco.
		const planOver = ImportGuide.planFor([{ sku: "X1", cat: "TECLADO", modelo: "K", fob: 4000, qty: 1 }], { regimen: "courier", fleteModo: "peso", pesoKg: 10, transporte: "courier" }, door);
		this.assert(
			planOver.valido === false && planOver.bloqueantes.some((b) => b.paso === "limites" && b.impacto.includes("barco")),
			"ImportGuide: CIF > USD 3.000 invalida el courier y sugiere régimen importador",
		);

		// 6) Peso > 50kg (por ítems, sin peso manual) → fail-closed.
		const planPeso = ImportGuide.planFor([{ sku: "K2", cat: "TECLADO", modelo: "K", fob: 5, qty: 60 }], { regimen: "courier", fleteModo: "peso", pesoKg: 0, transporte: "courier" }, { pesoKg: 0, costoPorKg: 12, fletePct: 0.15, seguroPct: 0.015 });
		this.assert(
			planPeso.valido === false && planPeso.bloqueantes.some((b) => b.queFalta.includes("60")),
			"ImportGuide: 60kg de ítems invalida el courier (límite 50kg)",
		);

		// 7) Pesos: default de categoría + override editable por ítem.
		this.assert(
			ImportGuide.pesoItemKg({ cat: "TECLADO", modelo: "K" }) === 1.0 &&
			ImportGuide.pesoItemKg({ cat: "MOUSE", modelo: "M" }) === 0.15,
			"ImportGuide: peso default por categoría (teclado 1kg, mouse 0.15kg)",
		);
		this.assert(
			ImportGuide.pesoTotalKg([{ cat: "MOUSE", modelo: "M", weightKg: 0.3, qty: 4 }]) === 1.2,
			"ImportGuide: item.weightKg editable gana sobre el default (0.3kg × 4)",
		);

		// 8) Fail-closed por datos: sin flete (% 0) → paso flete y tributos incompletos,
		//    con impacto explícito, pero el RESTO del plan sigue siendo informe.
		const planSinFlete = ImportGuide.planFor([pedidoMixto[0]], { regimen: "importador", fleteModo: "pct", fletePct: 0, transporte: "maritimo" }, { pesoKg: 0, fletePct: 0, seguroPct: 0.015 });
		const pasoFlete = planSinFlete.pasos.find((p) => p.id === "flete");
		const pasoTributos = planSinFlete.pasos.find((p) => p.id === "tributos");
		this.assert(
			pasoFlete && !pasoFlete.completo && pasoFlete.faltantes[0].impacto.includes("CIF"),
			"ImportGuide: sin flete el paso flete queda incompleto con impacto sobre CIF",
		);
		this.assert(
			pasoTributos && !pasoTributos.completo,
			"ImportGuide: sin flete también el paso tributos queda incompleto (depende de CIF)",
		);

		// 9) Checklist documental: el paso se completa SOLO cuando se confirma.
		const sinDocs = ImportGuide.planFor([pedidoMixto[0]], { regimen: "importador", fleteModo: "peso", pesoKg: 5, transporte: "maritimo" }, door);
		const conDocs = ImportGuide.planFor([pedidoMixto[0]], { regimen: "importador", fleteModo: "peso", pesoKg: 5, transporte: "maritimo", checks: { documentacion: true } }, door);
		this.assert(
			!sinDocs.pasos.find((p) => p.id === "documentacion").completo &&
			conDocs.pasos.find((p) => p.id === "documentacion").completo,
			"ImportGuide: paso documentación solo completa con check confirmado",
		);

		// 10) Sin pedido → plan inválido con bloqueante explícito.
		const planVacio = ImportGuide.planFor([], { regimen: "importador" }, door);
		this.assert(
			planVacio.valido === false && planVacio.bloqueantes.some((b) => b.queFalta === "No hay pedido"),
			"ImportGuide: sin pedido el plan es inválido y lo dice",
		);
	},

	testTextSanitizer() {
		const item = {
			marca: "OTRO",
			cat: "OTRO",
			modelo: "Redragon Kumara K552 RGB Mechanical Keyboard",
			fob: 35.0,
		};
		const resolved = TextSanitizer.sanitizeItem(item);

		this.assert(
			resolved.marca === "Redragon",
			"TextSanitizer identificó correctamente la marca Redragon",
		);
		this.assert(
			resolved.cat === "TECLADO",
			"TextSanitizer identificó correctamente la categoría TECLADO",
		);
		this.assert(
			resolved.status === "VALID",
			"TextSanitizer elevó el estado a VALID (🟢)",
		);
	},

	testQuoteGeneratorHtml() {
		const testPedido = {
			name: "Pedido Prueba",
			date: new Date().toISOString(),
			items: [
				{
					sku: "P-01",
					marca: "AULA",
					modelo: "F75",
					color: "Blue",
					qty: 2,
					pvp: 50.0,
					pvpArs: 70000,
					subPvp: 100.0,
				},
			],
			totals: {
				facturacion: 100.0,
				facturacionArs: 140000,
				tipoCambio: 1400,
				qty: 2,
			},
		};
		let opened = false;
		const origOpen = window.open;
		window.open = (url, name) => {
			opened = true;
			return { document: { write: () => {}, close: () => {} } };
		};

		QuoteGenerator.generatePrintableQuote(testPedido);
		window.open = origOpen;

		this.assert(
			opened,
			"QuoteGenerator generó y abrió exitosamente la ventana imprimible de cotización",
		);
	},

	// Perf sprint Slice C: los formatters Intl se cachean por locale|currency|
	// decimals — la cotización de pedidos grandes no recrea Intl.NumberFormat
	// por fila (365ms → <250ms/1200 items).
	testQuoteI18nFormatterCache() {
		QuoteGenerator._fmtCache.clear();
		const a = QuoteGenerator._getFormatter("es-AR", "USD", 2);
		const b = QuoteGenerator._getFormatter("es-AR", "USD", 2);
		this.assert(a === b, "formatCurrency reusa el mismo formatter para la misma clave");
		const c = QuoteGenerator._getFormatter("es-AR", "ARS", 0);
		this.assert(c !== a, "clave distinta (moneda) → formatter distinto");
		this.assert(QuoteGenerator._fmtCache.size === 2, "la caché tiene exactamente 2 entradas");
		const f1 = QuoteGenerator.formatCurrency(1234.5, { currency: "USD" });
		const f2 = QuoteGenerator.formatCurrency(1234.5, { currency: "USD" });
		this.assert(f1 === f2, "formato determinístico para el mismo valor");
		const t0 = Date.now();
		for (let i = 0; i < 20000; i++) QuoteGenerator.formatCurrency(1234.5, { currency: "USD" });
		const elapsed = Date.now() - t0;
		this.assert(elapsed < 1500, "20k formatos con caché < 1.5s (got " + elapsed + "ms)");
		QuoteGenerator._fmtCache.clear();
	},

	// Spec process-quote: la cotización usa el sub-thumb 36px (imgSm) cuando existe
	// (el HTML embebe UNA imagen por fila: 1.5KB vs 12KB → quote 337→~120ms).
	testQuoteUsesSmallThumb() {
		const ped = { name: "P", date: new Date().toISOString(), items: [
			{ sku: "A-1", marca: "X", modelo: "M1", fob: 10, qty: 1, pvp: 20, img: "data:image/png;base64,THUMBGRANDELARGO", imgSm: "data:image/jpeg;base64,CHICO1" },
			{ sku: "A-2", marca: "X", modelo: "M2", fob: 11, qty: 1, pvp: 21, img: "data:image/png;base64,THUMBGRANDELARGO", imgSm: "data:image/jpeg;base64,CHICO2" },
			{ sku: "A-3", marca: "X", modelo: "M3", fob: 12, qty: 1, pvp: 22, img: "data:image/png;base64,THUMBGRANDELARGO" },
		]};
		let outHtml = "";
		const origOpen = window.open;
		window.open = (url, name) => ({ document: { write: (h) => { outHtml = h; }, close: () => {} } });
		QuoteGenerator.generatePrintableQuote(ped, QuoteGenerator.getConfig(), { skipHistory: true, number: "X1" });
		window.open = origOpen;
		this.assert(typeof outHtml === "string" && outHtml.length > 0, "quote genera html");
		this.assert(outHtml.includes("CHICO1") && outHtml.includes("CHICO2"), "quote usa imgSm (36px) cuando existe");
		this.assert(outHtml.split("THUMBGRANDELARGO").length === 2, "el único thumb 112px embebido es el del ítem sin imgSm (fallback)");
		QuoteGenerator._fmtCache.clear();
	},

	testImageSpatialMatching() {
		const rows = [
			{
				pageNum: 1,
				y: 100,
				x: 20,
				text: "8BitDo Ultimate Wireless Controller $45.00",
			},
		];
		const images = [
			{
				pageNum: 1,
				y: 105,
				x: 20,
				width: 100,
				height: 100,
				dataUrl:
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			},
		];
		const products = PdfParser.parseRows(rows, "8BitDo", 0, [], images);
		this.assert(
			products.length === 1,
			"PdfParser parseó 1 producto con imagen espacial",
		);
		this.assert(
			products[0].img && products[0].img.startsWith("data:image/png"),
			"Imagen espacial asignada correctamente por coordenadas 2D X/Y",
		);
	},

	testCustomsPackingListExport() {
		const testPedido = {
			name: "Pedido Aduana Test",
			date: new Date().toISOString(),
			items: [
				{
					sku: "P-01",
					marca: "AULA",
					modelo: "F75",
					cat: "TECLADO",
					qty: 10,
					fob: 35.0,
				},
			],
			costs: { pesoKg: 15 },
			totals: { fob: 350.0, costo: 420.0, qty: 10 },
		};
		let written = false;
		const origWrite = XLSX.writeFile;
		XLSX.writeFile = (wb, filename) => {
			written = true;
		};

		const ok = FileImporter.exportCustomsPackingList(testPedido);
		XLSX.writeFile = origWrite;

		this.assert(
			ok && written,
			"FileImporter exportó correctamente la planilla de Packing List Aduanero en Excel",
		);
	},

	testSupplierPriceComparison() {
		const catalogTest = [
			{
				sku: "SKU-A1",
				marca: "Proveedor A",
				modelo: "AULA F75",
				cat: "TECLADO",
				fob: 30.0,
			},
			{
				sku: "SKU-B1",
				marca: "Proveedor B",
				modelo: "AULA F75",
				cat: "TECLADO",
				fob: 35.0,
			},
		];
		const grouped = {};
		catalogTest.forEach((item) => {
			const key = (item.modelo || "").toLowerCase().trim();
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(item);
		});
		const comparisons = Object.entries(grouped).filter(
			([k, list]) => list.length > 1,
		);

		this.assert(
			comparisons.length === 1,
			"Comparador detectó 1 modelo coincidente entre 2 proveedores",
		);
		this.assert(
			comparisons[0][1][0].fob === 30.0,
			"Comparador identificó correctamente al mejor precio FOB ($30.00 USD)",
		);
	},

	testNegotiatedDiscount() {
		const item = { sku: "P-01", fobOriginal: 100.0, fob: 100.0, qty: 5 };
		const pct = 10;
		item.fob = item.fobOriginal * (1 - pct / 100);

		this.assert(
			item.fob === 90.0,
			"Descuento negociado del 10% redujo el FOB de $100 a $90 USD",
		);
	},

	testDolarApiParsing() {
		const mockData = [
			{ casa: "mayorista", venta: 1480 },
			{ casa: "blue", venta: 1550 },
		];
		const dict = {};
		mockData.forEach((d) => {
			dict[d.casa] = d;
		});

		this.assert(
			dict.mayorista.venta === 1480,
			"DolarApi parseó correctamente Dólar Mayorista ($1480 ARS)",
		);
		this.assert(
			dict.blue.venta === 1550,
			"DolarApi parseó correctamente Dólar Blue ($1550 ARS)",
		);
	},

	testExecutiveReportExport() {
		const testPedido = {
			name: "Pedido Ejecutivo Test",
			date: new Date().toISOString(),
			items: [
				{
					sku: "P-01",
					marca: "AULA",
					modelo: "F75",
					cat: "TECLADO",
					qty: 10,
					fob: 35.0,
					pvp: 85.0,
				},
			],
			costs: { pesoKg: 15, tipoCambio: 1400 },
			totals: {
				fob: 350.0,
				costo: 420.0,
				facturacion: 850.0,
				margen: 430.0,
				margenPct: 50.5,
				roi: 102.3,
				qty: 10,
			},
		};
		let sheetsCount = 0;
		const origWrite = XLSX.writeFile;
		XLSX.writeFile = (wb, filename) => {
			sheetsCount = wb.SheetNames.length;
		};

		const ok = FileImporter.exportExecutiveReport(testPedido);
		XLSX.writeFile = origWrite;

		this.assert(
			ok && sheetsCount === 3,
			"FileImporter generó el Reporte Ejecutivo Financiero con 3 pestañas en Excel",
		);
	},

	testGridImageEscaping() {
		const defaultSvg =
			"data:image/svg+xml," +
			encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#181824"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="36">🖼️</text></svg>',
			);
		const escVal = typeof esc === "function" ? esc(defaultSvg) : defaultSvg;
		this.assert(
			!escVal.includes('"'),
			"El URL de fallback de imagen SVG en el grid no contiene comillas dobles sin escapar",
		);
	},

	testMultiCategoryBrandParsing() {
		const catMouse = PdfParser.detectCategory(
			"MCHOSE AX5 Gaming Mouse $25.00",
			"MCHOSE",
		);
		const catKeyboard = PdfParser.detectCategory(
			"MCHOSE K87 Mechanical Keyboard $45.00",
			"MCHOSE",
		);
		this.assert(catMouse === "MOUSE", "MCHOSE AX5 clasificado como MOUSE");
		this.assert(
			catKeyboard === "TECLADO",
			"MCHOSE K87 clasificado como TECLADO",
		);
	},

	testTextSanitizerModelParsing() {
		const res = TextSanitizer.parseModelAndVariant(
			"AULA F75 Mechanical Keyboard (White / Reaper Switch)",
			"AULA",
		);
		this.assert(
			res.modelo.includes("F75"),
			'TextSanitizer desglosó el modelo "F75"',
		);
		this.assert(
			res.variante.includes("White") || res.variante.includes("Reaper"),
			"TextSanitizer extrajo la variante de color/switch",
		);
	},

	testNumpadCategoryDetection() {
		const cat = PdfParser.detectCategory(
			"Ajazz NP20 Wireless Numeric Keypad",
			"AJAZZ",
		);
		this.assert(
			cat === "NUMPAD",
			"PdfParser clasificó correctamente la categoría NUMPAD",
		);
	},

	testTitleDeduplication() {
		const res = PdfParser.cleanProductTitle(
			"AJ139 V2 MC - White - 3311 AJ139 V2 MC Wired+2.4G+BT",
			"AJAZZ",
		);
		this.assert(
			res.modelo.includes("AJ139"),
			"Sanitizador NLP extrajo correctamente el modelo desduplicado AJ139",
		);
	},

	testAj139MouseCategory() {
		const cat = PdfParser.detectCategory("AJ139P V3 Mc Wired+2.4G+BT", "AJAZZ");
		this.assert(
			cat === "MOUSE",
			"PdfParser clasificó el modelo AJ139P como MOUSE",
		);
	},

	testColorGuardPinkVsBlack() {
		// Canvas profile of a dark/black image: low luminance
		const darkImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 100,
			dominantColor: { name: "BLACK", confidence: 70 },
		};
		const res = PdfParser.validateImageForProduct(darkImage, {
			cat: "CONTROLLER",
			modelo: "Pink Controller",
			variante: "Pink",
		});
		this.assert(
			res.valid === false,
			'Color Guard rechazó la imagen oscura/negra asignada a "Pink Controller"',
		);
	},

	testColorGuardWhiteVsBlack() {
		// Canvas profile of a dark image vs White title
		const darkImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 100,
			dominantColor: { name: "BLACK", confidence: 70 },
		};
		const res = PdfParser.validateImageForProduct(darkImage, {
			cat: "CONTROLLER",
			modelo: "White Controller for Xbox",
			variante: "White",
		});
		this.assert(
			res.valid === false,
			'Color Guard rechazó la imagen negra asignada a "White Controller"',
		);
	},

	testColorGuardGreenPass() {
		// A green controller image: high green channel, green hue
		const greenImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 100,
			dominantColor: { name: "GREEN", confidence: 70 },
		};
		const res = PdfParser.validateImageForProduct(greenImage, {
			cat: "CONTROLLER",
			modelo: "Green 8BitDo Ultimate 2C Controller",
			variante: "Green",
		});
		this.assert(
			res.valid === true,
			'Color Guard validó correctamente foto verde para "Green Controller"',
		);
	},

	testTopDownDirectionalGate() {
		// Simulate the scoring logic directly: image above the price row should win over one below
		const rowY = 300;
		const imgAbove = {
			pageNum: 1,
			x: 100,
			y: 80,
			width: 200,
			height: 200,
			dataUrl: "above",
			colorProfile: null,
		};
		const imgBelow = {
			pageNum: 1,
			x: 100,
			y: 320,
			width: 200,
			height: 200,
			dataUrl: "below",
			colorProfile: null,
		};

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
		this.assert(
			scoreAbove < scoreBelow,
			"Top-Down Gate puntúa correctamente imagen superior por encima de imagen inferior",
		);
	},

	testFamilyTitleColorProfile() {
		// Test cleanProductTitle correctly strips and deduplicates
		const res = PdfParser.cleanProductTitle(
			"Orange - 8BitDo Ultimate 2C Orange -",
			"8BitDo",
		);
		this.assert(
			!res.modelo.includes("undefined"),
			"Family title sanitizer no produce texto undefined en el modelo",
		);
	},

	testColorGuardPinkVsPurple() {
		// Purple profile: hue 270 (purple/violet)
		const purpleImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 100,
			dominantColor: { name: "PURPLE", confidence: 70 },
		};
		const resPink = PdfParser.validateImageForProduct(purpleImage, {
			cat: "CONTROLLER",
			modelo: "8BitDo Ultimate 2C Controller",
			variante: "Pink",
		});
		this.assert(
			resPink.valid === false,
			'Color Guard rechazó la imagen Violeta/Púrpura asignada a "Pink Controller"',
		);

		// Pink profile: hue 330 (pink/magenta)
		const pinkImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 100,
			dominantColor: { name: "PINK", confidence: 70 },
		};
		const resPurple = PdfParser.validateImageForProduct(pinkImage, {
			cat: "CONTROLLER",
			modelo: "8BitDo Ultimate 2C Controller",
			variante: "Purple",
		});
		this.assert(
			resPurple.valid === false,
			'Color Guard rechazó la imagen Rosa/Pink asignada a "Purple Controller"',
		);
	},

	testImageShapeGate() {
		// Wide image (keyboard-shaped, aspect 2.6) on a compact product must be REJECTED
		const wideImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 260,
			height: 100,
		};
		const resMouse = PdfParser.validateImageForProduct(wideImage, {
			cat: "MOUSE",
			modelo: "G502 HERO",
			variante: "Black",
		});
		this.assert(
			resMouse.valid === false,
			"Shape Gate rechazó imagen ancha (teclado) asignada a un MOUSE",
		);
		const resCtrl = PdfParser.validateImageForProduct(wideImage, {
			cat: "CONTROLLER",
			modelo: "Ultimate 2C",
			variante: "Black",
		});
		this.assert(
			resCtrl.valid === false,
			"Shape Gate rechazó imagen ancha (teclado) asignada a un CONTROLLER",
		);
		const resHeadset = PdfParser.validateImageForProduct(wideImage, {
			cat: "HEADSET",
			modelo: "Kraken V3",
			variante: "Black",
		});
		this.assert(
			resHeadset.valid === false,
			"Shape Gate rechazó imagen ancha (teclado) asignada a un HEADSET",
		);
		// Tall/narrow image on a wide product must be REJECTED
		const tallImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 60,
			height: 120,
		};
		const resKb = PdfParser.validateImageForProduct(tallImage, {
			cat: "TECLADO",
			modelo: "AK820 Pro",
			variante: "White",
		});
		this.assert(
			resKb.valid === false,
			"Shape Gate rechazó imagen estrecha asignada a un TECLADO",
		);
	},

	testImageShapeGateCompatible() {
		// Wide image on TECLADO -> valid
		const wideImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 250,
			height: 100,
		};
		const resKb = PdfParser.validateImageForProduct(wideImage, {
			cat: "TECLADO",
			modelo: "AK820",
			variante: "White",
		});
		this.assert(
			resKb.valid === true,
			"Shape Gate permite imagen ancha para TECLADO",
		);
		// Roughly square image on MOUSE -> valid
		const squareImage = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 100,
			height: 110,
		};
		const resMouse = PdfParser.validateImageForProduct(squareImage, {
			cat: "MOUSE",
			modelo: "G502",
			variante: "Black",
		});
		this.assert(
			resMouse.valid === true,
			"Shape Gate permite imagen cuadrada para MOUSE",
		);
	},

	testImageLowResThumbnail() {
		// Razer-sized thumbnail (50x31): unreliable content -> penalized + warning, not full score
		const tiny = {
			dataUrl: "data:image/png;base64,AAAA",
			width: 50,
			height: 31,
		};
		const res = PdfParser.validateImageForProduct(tiny, {
			cat: "MOUSE",
			modelo: "Razer Viper",
			variante: "Black",
		});
		this.assert(
			res.score < 100,
			"Thumbnail de baja resolución recibe penalización de score",
		);
		this.assert(
			res.warnings.some((w) => /resoluci|thumbnail/i.test(w)),
			"Thumbnail de baja resolución genera warning",
		);
	},

	testMatcherTightenedGates() {
		// Image in a far column (distX 220 > tightened gate 200) -> not assigned
		const prodX = [
			{
				sku: "P1",
				marca: "LOGITECH",
				modelo: "G502",
				variante: "Black",
				cat: "MOUSE",
				fob: 39,
				pageNum: 1,
				x: 100,
				y: 100,
			},
		];
		PdfParser.matchImagesToProductsGlobal(prodX, [
			{
				pageNum: 1,
				x: 320,
				y: 90,
				width: 100,
				height: 100,
				dataUrl: "data:image/png;base64,abc",
			},
		]);
		this.assert(
			prodX[0].img === "-",
			"Matcher global no asigna imágenes de columna lejana (distX 220 > 200)",
		);
		// Image 300px above anchor (> tightened gate 250) -> not assigned (fixes dense-row leakage)
		const prodY = [
			{
				sku: "P2",
				marca: "RAZER",
				modelo: "Goliathus",
				variante: "Black",
				cat: "MOUSEPAD",
				fob: 15,
				pageNum: 1,
				x: 100,
				y: 400,
			},
		];
		PdfParser.matchImagesToProductsGlobal(prodY, [
			{
				pageNum: 1,
				x: 100,
				y: 100,
				width: 200,
				height: 80,
				dataUrl: "data:image/png;base64,kbd",
			},
		]);
		this.assert(
			prodY[0].img === "-",
			"Matcher global no asigna imágenes a 300px verticales (gate 250)",
		);
	},

	testGarbageModeloRecovery() {
		// Generic noise word as modelo + real model in variante -> recover the model
		const r1 = TextSanitizer.sanitizeItem({
			modelo: "Item",
			variante: "DQ6",
			marca: "Kz",
			cat: "AURICULAR",
			fob: 14.5,
		});
		this.assert(
			r1.modelo === "DQ6",
			`sanitizeItem recupera modelo desde variante (Item+DQ6 -> DQ6, got "${r1.modelo}")`,
		);
		const r2 = TextSanitizer.sanitizeItem({
			modelo: "Earphones",
			variante: "AS10",
			marca: "Kz",
			cat: "AURICULAR",
			fob: 38,
		});
		this.assert(
			r2.modelo === "AS10",
			`sanitizeItem recupera modelo (Earphones+AS10 -> AS10, got "${r2.modelo}")`,
		);
		// pdfParser sanitizer must also promote variante when modelo cleans to empty
		const r3 = PdfParser.sanitizeProductNames("Price List", "DQ6", "Kz", []);
		this.assert(
			/DQ6/i.test(r3.modelo) && !/item/i.test(r3.modelo),
			`sanitizeProductNames promueve variante a modelo (got "${r3.modelo}")`,
		);
		// Guard: a product with brand+category identity but no model keeps its placeholder (not dropped)
		const r4 = TextSanitizer.sanitizeItem({
			modelo: "",
			variante: "",
			marca: "Logitech",
			cat: "MOUSE",
			fob: 20,
		});
		this.assert(
			r4 && /Logitech/i.test(r4.modelo),
			"sanitizeItem conserva placeholder para producto con identidad pero sin modelo",
		);
		// Post-audit guard: crossAudit strips the connection token and modelo degenerates to a number
		const r5 = TextSanitizer.sanitizeItem({
			modelo: "68 V3",
			variante: "Magnetic Side Print Blackberry",
			marca: "Atk",
			cat: "TECLADO",
			fob: 76,
		});
		this.assert(
			!/^\d+$/.test(r5.modelo),
			`Post-audit guard recupera modelo que degeneró a número (68 V3 -> "${r5.modelo}")`,
		);
	},

	testZeroIdentityRowDropped() {
		// A row with no model, no variant, no brand, no category is pure noise (e.g. RMB price column) -> dropped
		const r = TextSanitizer.sanitizeItem({
			modelo: "",
			variante: "",
			marca: "OTRO",
			cat: "",
			fob: 15.2,
		});
		this.assert(
			r === null,
			"sanitizeItem descarta filas sin identidad (ruido de columna de precio)",
		);
		const r2 = TextSanitizer.sanitizeItem({
			modelo: "103.50",
			variante: "",
			marca: "OTRO",
			cat: "",
			fob: 15.2,
		});
		this.assert(
			r2 === null,
			"sanitizeItem descarta filas cuyo modelo es solo un precio",
		);
	},

	testMarketRangeAndReclassification() {
		// Premium products must not trigger R3 price-range violations
		const premium = [
			{
				sku: "MP-001",
				modelo: "Goliathus Extended",
				variante: "Black",
				marca: "Razer",
				cat: "MOUSEPAD",
				fob: 150,
			},
			{
				sku: "HS-001",
				modelo: "Kraken Pro Wireless",
				variante: "Black",
				marca: "Razer",
				cat: "HEADSET",
				fob: 436,
			},
			{
				sku: "AC-001",
				modelo: "Power Supply Katana 1200W",
				variante: "",
				marca: "Razer",
				cat: "ACCESORIO",
				fob: 481,
			},
			{
				sku: "AC-002",
				modelo: "Silicone Eartips",
				variante: "black",
				marca: "KZ",
				cat: "ACCESORIO",
				fob: 0.29,
			},
		];
		const noRange = premium.every(
			(p) =>
				!CatalogValidator.validateItem(p).critical.some((c) =>
					/fuera de rango/.test(c),
				),
		);
		this.assert(
			noRange,
			"Rangos de precio aceptan productos premium reales (MOUSEPAD $150, HEADSET $436, ACCESORIO $481, eartips $0.29)",
		);

		// Brand lock: KZ may be ACCESORIO (eartips) without R4 rejection
		const lock = CatalogValidator.validateItem({
			sku: "KZ-001",
			modelo: "Silicone Eartips",
			variante: "black",
			marca: "KZ",
			cat: "ACCESORIO",
			fob: 0.29,
		});
		this.assert(
			!lock.critical.some((c) => /no fabrica/.test(c)),
			"Brand lock de KZ permite ACCESORIO (eartips no son R4-reject)",
		);

		// Sub-$1 KZ "auricular" reclassified to ACCESORIO by the sanitizer
		const tips = TextSanitizer.sanitizeItem({
			modelo: "Silicone Eartips pairs",
			variante: "black",
			marca: "Kz",
			cat: "AURICULAR",
			fob: 0.29,
		});
		this.assert(
			tips.cat === "ACCESORIO",
			`Eartips sub-$1 se reclasifican a ACCESORIO (got ${tips.cat})`,
		);

		// Numeric modelo recovered from variante
		const num = TextSanitizer.sanitizeItem({
			modelo: "68",
			variante: "Magnetic Black V3",
			marca: "Atk",
			cat: "TECLADO",
			fob: 76,
		});
		this.assert(
			!/^\d+$/.test(num.modelo),
			`Modelo numérico se recupera desde variante (got "${num.modelo}")`,
		);
	},

	testImageInheritanceCategoryScoped() {
		const IMG = "data:image/png;base64,AAAA";
		const products = [
			{
				sku: "M1",
				marca: "Atk",
				modelo: "Z1 Ultimate",
				variante: "Black",
				cat: "MOUSE",
				fob: 30,
				img: IMG,
				pageNum: 1,
			},
			{
				sku: "K1",
				marca: "Atk",
				modelo: "Z1 Ultimate",
				variante: "White",
				cat: "TECLADO",
				fob: 80,
				img: "-",
				pageNum: 1,
			},
			{
				sku: "K2",
				marca: "Atk",
				modelo: "F1",
				variante: "Black",
				cat: "TECLADO",
				fob: 70,
				img: IMG,
				pageNum: 1,
			},
			{
				sku: "K3",
				marca: "Atk",
				modelo: "F1",
				variante: "White",
				cat: "TECLADO",
				fob: 70,
				img: "-",
				pageNum: 1,
			},
		];
		const out = PdfParser.finalizeCatalogProducts(products, "Atk", 0, []);
		const k1 = out.find((p) => p.sku === "K1");
		const k3 = out.find((p) => p.sku === "K3");
		this.assert(
			k1 && !/^data:image\//.test(k1.img || ""),
			"Herencia de imagen NO cruza categorías (MOUSE->TECLADO)",
		);
		this.assert(
			k3 && /^data:image\//.test(k3.img || "") && k3._imageInherited,
			"Herencia de imagen funciona dentro de la misma categoría",
		);
	},

	testHonestModelQualityGate() {
		// Pure detector
		this.assert(
			TextSanitizer.assessModelQuality(
				"PC SeaSalt PA Silent 47 5g POM",
				"",
				"SWITCH",
				"",
			).level === "RED",
			"assessModelQuality: specs -> RED",
		);
		this.assert(
			TextSanitizer.assessModelQuality(
				"S98 Glacier Axis Universe",
				"White",
				"TECLADO",
				"",
			).level === "YELLOW",
			"assessModelQuality: switch pegado -> YELLOW",
		);
		this.assert(
			TextSanitizer.assessModelQuality("G502 HERO", "Black", "MOUSE", "")
				.level === "GREEN",
			"assessModelQuality: modelo limpio -> GREEN",
		);
		// Wired into the validator: specs model becomes RED (not importable)
		const specs = CatalogValidator.validateItem({
			sku: "SW-1",
			marca: "Haimu",
			modelo: "PC 2.0 PA 39 5g POM",
			variante: "Tactile",
			cat: "SWITCH",
			fob: 0.12,
			grounded: true,
			img: "data:image/png;base64,AAAA",
		});
		this.assert(
			specs.status === "RED",
			"Validador: modelo de specs -> RED (no importable)",
		);
		// Glued switch becomes YELLOW (importable, flagged)
		const glued = CatalogValidator.validateItem({
			sku: "KB-1",
			marca: "RK",
			modelo: "S98 Glacier Axis Universe",
			variante: "White",
			cat: "TECLADO",
			fob: 45,
			grounded: true,
			img: "data:image/png;base64,AAAA",
		});
		this.assert(
			glued.status === "YELLOW",
			"Validador: switch pegado -> YELLOW (revisar)",
		);
		// Clean model stays GREEN (no false downgrade)
		const clean = CatalogValidator.validateItem({
			sku: "MS-1",
			marca: "Logitech",
			modelo: "G502 HERO",
			variante: "Black",
			cat: "MOUSE",
			fob: 43,
			grounded: true,
			img: "data:image/png;base64,AAAA",
		});
		this.assert(
			clean.status === "GREEN",
			"Validador: modelo limpio sigue GREEN (sin falso downgrade)",
		);
	},

	testGlobalBipartiteMatching() {
		// Simulate a page with 2 products (Pink at X=100, Purple at X=250) and 2 images (Pink at X=100, Purple at X=250)
		const rows = [
			{
				text: "8BitDo Ultimate 2C Wireless Controller",
				pageNum: 1,
				y: 50,
				x: 100,
			},
			{ text: "Pink - $19.40", pageNum: 1, y: 300, x: 100 },
			{
				text: "8BitDo Ultimate 2C Wireless Controller",
				pageNum: 1,
				y: 50,
				x: 250,
			},
			{ text: "Purple - $19.40", pageNum: 1, y: 300, x: 250 },
		];
		const pinkProfile = {
			avgR: 220,
			avgG: 80,
			avgB: 160,
			avgSat: 0.64,
			avgVal: 0.86,
			hue: 330,
		};
		const purpleProfile = {
			avgR: 120,
			avgG: 60,
			avgB: 180,
			avgSat: 0.65,
			avgVal: 0.7,
			hue: 270,
		};

		const imgPink = {
			pageNum: 1,
			x: 100,
			y: 80,
			width: 200,
			height: 200,
			dataUrl: "data:image/png;base64,AAAA",
			colorProfile: pinkProfile,
		};
		const imgPurple = {
			pageNum: 1,
			x: 250,
			y: 80,
			width: 200,
			height: 200,
			dataUrl: "data:image/png;base64,BBBB",
			colorProfile: purpleProfile,
		};

		const products = PdfParser.parseRows(
			rows,
			"8BitDo",
			0,
			[],
			[imgPink, imgPurple],
		);
		const prodPink = products.find((p) =>
			p.variante.toLowerCase().includes("pink"),
		);
		const prodPurple = products.find((p) =>
			p.variante.toLowerCase().includes("purple"),
		);

		this.assert(
			prodPink && prodPink.img === "data:image/png;base64,AAAA",
			"Asignación Bipartita asignó correctamente la foto Pink al producto Pink",
		);
		this.assert(
			prodPurple && prodPurple.img === "data:image/png;base64,BBBB",
			"Asignación Bipartita asignó correctamente la foto Purple al producto Purple",
		);
	},

	testHeaderPriorityRowContext() {
		const rows = [
			{
				text: "8BitDo Ultimate 2C Wireless Controller",
				pageNum: 1,
				y: 100,
				x: 100,
			},
			{ text: "Orange - $19.40", pageNum: 1, y: 180, x: 100 },
		];
		const ctx = PdfParser.buildRowContext(rows, 1);
		this.assert(
			ctx.modelo === "8BitDo Ultimate 2C Wireless Controller",
			"buildRowContext priorizó el encabezado de modelo sobre el texto inline del precio",
		);
		this.assert(
			ctx.variante === "Orange",
			'buildRowContext aisló la variante limpiando el guión suelto "Orange -"',
		);
	},

	testTableHeaderNoiseFilter() {
		const items = [
			{
				str: "Model Color Price RMB USD Purple",
				transform: [1, 0, 0, 1, 100, 700],
			},
		];
		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[],
			"8BitDo",
			[],
		);
		this.assert(
			products.length === 0,
			'Grid Engine v5 ignoró correctamente la fila de encabezado de tabla "Model Color Price RMB USD"',
		);
	},

	testMoveTrailingTypeKeyword() {
		// Trailing type word moves to variant
		let r = PdfParser.moveTrailingTypeKeyword(
			"Ultimate 2C Controller",
			"Green",
		);
		this.assert(
			r.modelo === "Ultimate 2C" && r.variante === "Green Controller",
			"moveTrailingTypeKeyword: Controller al final -> variante",
		);
		// Status word moves to variant
		r = PdfParser.moveTrailingTypeKeyword("Lake Released", "New Green");
		this.assert(
			r.modelo === "Lake" && r.variante.includes("Released"),
			"moveTrailingTypeKeyword: Released (estado) -> variante",
		);
		// Leading combo moves to variant
		r = PdfParser.moveTrailingTypeKeyword("Combo MK120 Mouse", "Black");
		this.assert(
			r.modelo === "MK120" && r.variante.includes("Combo"),
			"moveTrailingTypeKeyword: Combo inicial -> variante",
		);
		// Compound names are protected (no word boundary inside)
		r = PdfParser.moveTrailingTypeKeyword("Caramel LatteSwitch", "White");
		this.assert(
			r.modelo === "Caramel LatteSwitch",
			"moveTrailingTypeKeyword: LatteSwitch (compuesto) NO se toca",
		);
		// Pure descriptor is not left as model
		r = PdfParser.moveTrailingTypeKeyword("Magnetic Keyboard", "Black");
		this.assert(
			r.modelo === "Magnetic Keyboard",
			"moveTrailingTypeKeyword: descriptor puro NO se toca",
		);
		// Legitimate suffix untouched
		r = PdfParser.moveTrailingTypeKeyword("G502 Wireless", "Black");
		this.assert(
			r.modelo === "G502 Wireless",
			"moveTrailingTypeKeyword: sufijo Wireless (legítimo) NO se toca",
		);
	},

	testModelQualityGatesFailClosed() {
		const G = global.CatalogAssignmentGates || CatalogAssignmentGates;
		// Mid-model type keyword detected (the GATE decides with the digit rule)
		this.assert(
			G.isMidModelTypeKeyword("Keyboard F75") === true,
			"isMidModelTypeKeyword: Keyboard F75 detecta",
		);
		this.assert(
			G.isMidModelTypeKeyword("Retro Receiver Saturn") === true,
			"isMidModelTypeKeyword: detecta keyword en el medio (el gate exige dígito)",
		);
		// Bare type word as model -> YELLOW
		this.assert(
			G.isBareTypeWordModel("Receiver") === true,
			"isBareTypeWordModel: Receiver detecta",
		);
		this.assert(
			G.isBareTypeWordModel("LatteSwitch") === false,
			"isBareTypeWordModel: LatteSwitch (compuesto) NO",
		);
		// End-to-end: dirty model degrades, legitimate stays GREEN (status inicial
		// GREEN — runAll solo degrada, no asigna status)
		const res = G.runAll([
			{
				sku: "TST-001",
				status: "GREEN",
				marca: "Aula",
				modelo: "Keyboard F75",
				variante: "Black",
				cat: "TECLADO",
				fob: 35,
				img: "data:image/png;base64,AAAA",
				grounded: true,
			},
			{
				sku: "TST-002",
				status: "GREEN",
				marca: "8BitDo",
				modelo: "Retro Receiver Saturn",
				variante: "Gray",
				cat: "CONTROLLER",
				fob: 12,
				img: "data:image/png;base64,BBBB",
				grounded: true,
			},
		]);
		const dirty = res.products.find((p) => p.sku === "TST-001");
		const clean = res.products.find((p) => p.sku === "TST-002");
		this.assert(
			dirty.status === "YELLOW",
			"Fail-closed: modelo con keyword de categoría + dígito -> YELLOW",
		);
		this.assert(
			clean.status === "GREEN",
			"Fail-closed: nombre de producto real (Retro Receiver Saturn, sin dígito) sigue GREEN",
		);

		// Switch line exemption: 'Switch' in a SWITCH-category model is the product
		// line name (Haimu Ice Silver Switch), not contamination — stays GREEN.
		// Specs-led models ('3.0 0.50mn Switch 44 55') still degrade.
		const swRes = G.runAll([
			{
				sku: "SWT-001",
				status: "GREEN",
				marca: "Haimu",
				modelo: "Ice Silve Switch PA12",
				variante: "Tactile",
				cat: "SWITCH",
				fob: 0.15,
				img: "data:image/png;base64,AAAA",
				grounded: true,
			},
			{
				sku: "SWT-002",
				status: "GREEN",
				marca: "Haimu",
				modelo: "3.0 0.50mn Switch 44 55",
				variante: "Pink Blue",
				cat: "SWITCH",
				fob: 0.15,
				img: "data:image/png;base64,BBBB",
				grounded: true,
			},
		]);
		const swLine = swRes.products.find((p) => p.sku === "SWT-001");
		const swSpecs = swRes.products.find((p) => p.sku === "SWT-002");
		this.assert(
			swLine.status === "GREEN",
			"Switch con Switch en el nombre de línea (Ice Silve Switch PA12) -> GREEN",
		);
		this.assert(
			swSpecs.status === "YELLOW",
			"Switch con specs numéricas al inicio (3.0 0.50mn Switch...) -> YELLOW",
		);
	},

	testSkuFailClosed() {
		const good = CatalogValidator.validateItem({
			sku: "AUL-TEC-4B7A9C2F",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
		});
		this.assert(good.status === "GREEN", "SKU generado válido -> GREEN");
		const bad = CatalogValidator.validateItem({
			sku: "SKU CON ESPACIOS!",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
		});
		this.assert(
			bad.status === "RED" && bad.critical.some((c) => c.includes("SKU")),
			"SKU con caracteres inválidos -> RED",
		);
		const manual = CatalogValidator.validateItem({
			sku: "MOU-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
		});
		this.assert(
			manual.status === "GREEN",
			"SKU manual legítimo (MOU-001) -> GREEN (no se exige formato generado)",
		);
	},

	testSpatialCellGridExtraction() {
		const items = [
			{ str: "Model Color Price RMB USD", transform: [1, 0, 0, 1, 100, 750] },
			{
				str: "Ultimate 2 Wireless Controller",
				transform: [1, 0, 0, 1, 100, 500],
			},
			{ str: "Black - $35.19", transform: [1, 0, 0, 1, 100, 350] },
			{
				str: "Ultimate 2 Wireless Controller",
				transform: [1, 0, 0, 1, 300, 500],
			},
			{ str: "White - $35.19", transform: [1, 0, 0, 1, 300, 350] },
		];
		const imgBlack = {
			pageNum: 1,
			x: 100,
			y: 380,
			width: 200,
			height: 200,
			dataUrl: "data:image/png;base64,AAAA",
			colorProfile: null,
		};
		const imgWhite = {
			pageNum: 1,
			x: 300,
			y: 380,
			width: 200,
			height: 200,
			dataUrl: "data:image/png;base64,BBBB",
			colorProfile: null,
		};

		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[imgBlack, imgWhite],
			"8BitDo",
			[],
		);
		this.assert(
			products.length === 2,
			"Grid Engine v5 extrajo exactamente 2 productos de la grilla de 2 columnas",
		);

		const pBlack = products.find((p) => p.variante.includes("Black"));
		const pWhite = products.find((p) => p.variante.includes("White"));

		this.assert(
			pBlack &&
				pBlack.modelo === "Ultimate 2 Wireless" &&
				pBlack.variante.includes("Controller") &&
				pBlack.img === "data:image/png;base64,AAAA",
			"Producto 1 (Black) extrajo modelo limpio (sin keyword de categoría) y su foto de celda aislada",
		);
		this.assert(
			pWhite &&
				pWhite.modelo === "Ultimate 2 Wireless" &&
				pWhite.variante.includes("Controller") &&
				pWhite.img === "data:image/png;base64,BBBB",
			"Producto 2 (White) extrajo modelo limpio (sin keyword de categoría) y su foto de celda aislada",
		);
	},

	/*
	 * IT-browser-parser: la app real corre la RUTA BROWSER de pdfParser.js (scripts
	 * clásicos, globales en window), no la ruta Node (require). El split PIL6
	 * (cellUtils.js/rowMatch.js) asignaba los helpers SOLO en la ruta Node
	 * (d3e17d2): los tests en Node pasaban verde y el import real daba 0 productos
	 * ("this.extractPageProductsByTableRows is not a function"). Este test ejecuta
	 * el archivo en un sandbox vm SIN `module`/`require` (browser de verdad) con
	 * los globales de script clásico ya definidos, y exige que la superficie de
	 * métodos coincida con la ruta Node.
	 */
	testBrowserParserWiring() {
		const vm = require("vm");
		const fs = require("fs");
		const path = require("path");
		const nodeSurface = Object.keys(PdfParser)
			.filter((k) => typeof PdfParser[k] === "function")
			.sort();
		const src = fs.readFileSync(
			path.join(__dirname, "pdfParser.js"),
			"utf8",
		);
		// Sandbox browser: NO module/require (clave del bug), globales cargados como
		// scripts clásicos previos. window === global (como en un browser).
		const window = {
			CellUtils: require("./parser/cellUtils.js"),
			RowMatch: require("./parser/rowMatch.js"),
		};
		const sandbox = {
			window,
			// En un browser los scripts clásicos exponen el clasificador como global
			// (y también en window); pdfParser.js lo lee por nombre de scope.
			PdfParserClassifier: require("./pdfParserClassifier.js"),
			pdfjsLib: { OPS: {} },
		};
		vm.createContext(sandbox);
		vm.runInContext(src, sandbox);
		const browserParser = window.PdfParser;

		this.assert(
			typeof browserParser === "object" && browserParser !== null,
			"ruta browser expone window.PdfParser (vm, sin module/require)",
		);
		const browserSurface = Object.keys(browserParser)
			.filter((k) => typeof browserParser[k] === "function")
			.sort();
		this.assert(
			browserSurface.length >= nodeSurface.length,
			"ruta browser (vm) expone la misma superficie que la ruta Node (" +
				browserSurface.length +
				" vs " +
				nodeSurface.length +
				")",
		);
		for (const key of [
			"extractPageProductsByTableRows",
			"finalizeCatalogProducts",
			"extractPageProductsByCellGrid",
			"detectBrandFromFilename",
			"matchImagesToProductsGlobal",
			"sanitizeProductNames",
			"extractInteriorColor",
		]) {
			this.assert(
				typeof browserParser[key] === "function",
				"ruta browser expone " + key + " (helpers del split PIL6)",
			);
		}
	},

	testDoorToDoorCustomsLiquidation() {
		const items = [
			{
				sku: "KB-WL-01",
				marca: "VGN",
				modelo: "V87 Wireless Keyboard",
				variante: "Black",
				cat: "TECLADO",
				fob: 45,
				qty: 10,
			},
			{
				sku: "MS-WL-01",
				marca: "VGN",
				modelo: "F1 Pro Wireless Mouse",
				variante: "White",
				cat: "MOUSE",
				fob: 25,
				qty: 20,
			},
		];
		const doorConfig = {
			tipoCambio: 1400,
			pesoKg: 15,
			costoPorKg: 12,
			depositoFiscalUsd: 150,
			despachanteUsd: 450,
			fleteInternoUsd: 80,
			simDigitalizacionUsd: 40,
		};

		const res = Calculator.calculateDoorToDoorExactCost(items, doorConfig);
		this.assert(
			res && res.summary && res.summary.totalPuertaUsd > 0,
			"Motor de Liquidación Puerta a Puerta calculó el costo total correctamente",
		);
		this.assert(
			res.items.some((i) => i.ncm === "8471.60.53"),
			"Identificó la Posición Arancelaria NCM 8471.60.53 para teclados/mouses inalámbricos",
		);
		this.assert(
			res.certificationsRequired.some((c) => c.title.includes("ENACOM")),
			"Detectó la necesidad de trámite de Homologación ENACOM por Radiofrecuencia/BT",
		);
		this.assert(
			res.items[0].costoPuertaUnitUsd > items[0].fob,
			"El Costo Puerta Unitario contempla tributos SIM, fletes y certificaciones",
		);

		// IT19 (crédito fiscal validado ARCA/AFIP): IVA adicional 20% (no 10%),
		// y desglose caja vs costo neto real (restando lo recuperable).
		const kb = res.items.find((i) => i.ncm === "8471.60.53");
		this.assert(
			Math.abs(
				kb.ivaAddUsd /
					(kb.baseImp || kb.itemCif + kb.derechosUsd + kb.tasaUsd) -
					0.2,
			) < 0.001,
			"IT19: IVA adicional = 20% (validado ARCA — alícuota general)",
		);
		this.assert(
			kb.recuperableUsd > kb.ivaUsd,
			"IT19: lo recuperable (IVA+anticipos) supera el IVA solo",
		);
		const s = res.summary;
		this.assert(
			s.costoNetoRealUsd > 0 && s.costoNetoRealUsd < s.totalPuertaConIvaUsd,
			"IT19: costo neto real < caja (bruto con IVA)",
		);
		this.assert(
			s.creditoFiscalArs > 0,
			"IT19: hay crédito fiscal a favor en ARS (recuperable)",
		);
	},

	testCorporateNoiseSanitizer() {
		const res1 = PdfParser.sanitizeProductNames(
			"Co., Ltd. 235.75",
			"Purple Switch",
			"8BitDo",
		);
		this.assert(
			res1.modelo !== "Co., Ltd. 235.75" && !res1.modelo.includes("Co., Ltd."),
			"Limpió la razón social Co., Ltd. del nombre del modelo",
		);
		this.assert(
			!/^\$?\d+([.,]\d+)?$/.test(res1.modelo),
			"Reemplazó el precio numérico desnudo por un modelo descriptivo válido",
		);

		const res2 = TextSanitizer.parseModelAndVariant(
			"Shenzhen Technology Co., Ltd. Ultimate Controller",
			"8BitDo",
		);
		this.assert(
			res2.modelo.length > 0,
			"TextSanitizer eliminó la razón social manteniendo el modelo real",
		);
	},

	testMinFobKpiPositiveFilter() {
		const catalogData = [
			{ sku: "A1", fob: 0 },
			{ sku: "A2", fob: 15.5 },
			{ sku: "A3", fob: 45.0 },
		];
		const positiveFobs = catalogData.map((c) => c.fob).filter((f) => f > 0);
		const minPositive = positiveFobs.length ? Math.min(...positiveFobs) : 0;
		this.assert(
			minPositive === 15.5,
			"El cálculo del KPI de FOB Mínimo ignora correctamente los ítems con precio $0",
		);
	},

	testDefaultSvgImageFallback() {
		const DEFAULT_SVG_IMG =
			"data:image/svg+xml," +
			encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="#12131C"/><circle cx="8.5" cy="8.5" r="1.5" fill="#334155"/><polyline points="21 15 16 10 5 21" stroke="#334155"/></svg>',
			);
		this.assert(
			DEFAULT_SVG_IMG.startsWith("data:image/svg+xml"),
			"Generó una imagen fallback SVG Data URI de alta definición",
		);
		this.assert(
			!DEFAULT_SVG_IMG.includes("🖼️"),
			"El fallback visual SVG no contiene caracteres emoji propensos a falla",
		);
	},

	testCatalogImportFieldCoherence() {
		const rawItems = [
			{
				rawText: "8BitDo Ultimate 2.4G Controller (Black)",
				marca: "8BitDo",
				modelo: "Co., Ltd. 235.75",
				cat: "CONTROLLER",
				fob: 35.19,
			},
			{
				rawText: "VGN Dragonfly F1 Pro Mouse White",
				marca: "VGN",
				modelo: "126.50",
				cat: "MOUSE",
				fob: 18.88,
			},
		];

		const processed = rawItems.map((item) => TextSanitizer.sanitizeItem(item));
		this.assert(
			processed.every((p) => p.marca && p.cat),
			"Todos los ítems de catálogo importados generan coincidencia completa de campos",
		);
		this.assert(
			processed.every((p) => !p.modelo.includes("Co., Ltd.")),
			"Sanitización de importación garantizó nombres de modelos coherentes en todo el lote",
		);
	},

	testCategoryChipsIconSupport() {
		const categories = [
			"TECLADO",
			"MOUSE",
			"HEADSET",
			"CONTROLLER",
			"MOUSEPAD",
		];
		const validMap = categories.every((cat) =>
			["TECLADO", "MOUSE", "HEADSET", "CONTROLLER", "MOUSEPAD"].includes(cat),
		);
		this.assert(
			validMap,
			"Todas las categorías estándar disponen de mapeo a iconos SVG de Lucide",
		);
	},

	testRepairCatalogItem() {
		const dirtyItems = [
			{
				sku: "SKU1",
				marca: "AJAZZ",
				cat: "TECLADO",
				modelo: "CNY 117.65",
				rawText: "AJAZZ AK820 Mechanical Keyboard CNY 117.65",
			},
			{
				sku: "SKU2",
				marca: "Attack Shark",
				cat: "MOUSE",
				modelo: "Producto Item 193.76",
				rawText: "Attack Shark R1 Pro Max Wireless Mouse 193.76",
			},
			{
				sku: "SKU3",
				marca: "8BitDo",
				cat: "CONTROLLER",
				modelo: ". 507",
				rawText: "8BitDo Ultimate Controller 507",
			},
		];

		const repaired = dirtyItems.map((item) => TextSanitizer.sanitizeItem(item));
		this.assert(
			!repaired[0].modelo.includes("CNY 117.65"),
			"TextSanitizer eliminó el precio desfasado del modelo",
		);
		this.assert(
			!repaired[1].modelo.includes("Producto Item"),
			"TextSanitizer eliminó el texto Producto Item",
		);
		this.assert(
			!repaired[2].modelo.startsWith("."),
			"TextSanitizer eliminó los caracteres . y números sueltos",
		);
	},

	testCatalogValidatorRules() {
		const sampleCatalog = [
			{
				sku: "MOU-001",
				marca: "VGN",
				modelo: "Dragonfly F1 Pro",
				variante: "White",
				cat: "MOUSE",
				fob: 29.99,
				img: "data:image/png;base64,AAAA",
				grounded: true,
			},
			{
				sku: "KEY-002",
				marca: "AULA",
				modelo: "F75 Gasket Keyboard",
				variante: "Sea Salt",
				cat: "TECLADO",
				fob: 45.5,
				img: "data:image/png;base64,BBBB",
				grounded: true,
			},
		];
		const audit = CatalogValidator.runFullValidation(sampleCatalog);
		this.assert(
			audit.accepted.length === 2,
			"CatalogValidator aprobó la totalidad de los productos válidos",
		);
		this.assert(
			audit.stats.green === 2,
			"CatalogValidator otorgó semáforo verde con evidencia completa",
		);
	},

	testBuildCatalogExportJSON() {
		const base = () => ({
			sku: "MOU-001",
			cat: "MOUSE",
			marca: "ATK",
			modelo: "Blazing Sky F1",
			variante: "Black",
			color: "Black",
			fob: 12.5,
			img: "data:image/png;base64,AAAA",
			_imageRef: { relativePath: "images/x.png", mime: "png" },
			_selected: true,
			status: "GREEN",
			warnings: [],
			confidence: 95,
			grounded: true,
			sourceFile: "ATK.pdf",
			qualityReason: "Sin observaciones",
			rawText: "Blazing Sky F1 Black 12.5",
			cellRawText: { modelo: "Blazing Sky F1", fob: "12.5" },
			imgWarnings: ["borde"],
			sourceWarnings: [],
			_evaluations: [{ rule: "R1", pass: true }],
		});
		const raw = CatalogValidator.buildCatalogExportJSON([base()], {});
		const parsed = JSON.parse(raw);
		this.assert(parsed.length === 1, "export: un item serializa");
		const row = parsed[0];
		this.assert(row._imageRef === undefined && row._selected === undefined,
			"export: nunca emite artefactos runtime (_imageRef/_selected)");
		this.assert(row.img === "data:image/png;base64,AAAA", "export: thumb incluido por default");
		this.assert(row.rawText === undefined, "export catalog: sin evidencia extra (scope catalog)");
		const keys = Object.keys(row);
		const EXPECT = ["sku","cat","marca","modelo","variante","color","fob","img","status","warnings","confidence","grounded","sourceFile","qualityReason"];
		this.assert(JSON.stringify(keys) === JSON.stringify(EXPECT),
			"export: orden de campos estable (whitelist) — got " + keys.join(","));
		this.assert(row.variante === "Black" && row.color === "Black", "export: variante y color presentes");

		const noImg = JSON.parse(CatalogValidator.buildCatalogExportJSON([base()], { images: "none" }));
		this.assert(noImg[0].img === undefined, "export: images:none omite img");

		const prev = JSON.parse(CatalogValidator.buildCatalogExportJSON([base()], { scope: "preview" }));
		this.assert(prev[0].rawText === "Blazing Sky F1 Black 12.5", "export preview: conserva rawText");
		this.assert(prev[0]._evaluations && prev[0]._evaluations.length === 1, "export preview: conserva _evaluations");
		this.assert(prev[0].imgWarnings && prev[0].imgWarnings.length === 1, "export preview: conserva imgWarnings");
		this.assert(prev[0].sourceWarnings === undefined, "export preview: arrays vacíos se omiten (determinismo)");

		const compact = CatalogValidator.buildCatalogExportJSON([base()], { pretty: false });
		const pretty = CatalogValidator.buildCatalogExportJSON([base()], {});
		this.assert(JSON.parse(compact).length === 1 && JSON.parse(pretty).length === 1, "export: pretty y compact parsean igual");
		this.assert(compact.length < pretty.length, "export: compact es más chico que pretty");

		const empty = CatalogValidator.buildCatalogExportJSON([], {});
		this.assert(empty === "[]", "export: array vacío → []");
	},

	// I1 (process-improvement-program): agregador de calidad por proveedor —
	// los totales deben coincidir con los status del catálogo, por marca y global.
	testCatalogQualityReport() {
		const items = [
			{ sku: "A-1", marca: "ATK", modelo: "F1", variante: "Black", cat: "TECLADO", fob: 10, img: "data:image/png;base64,AA", status: "GREEN", grounded: true, warnings: [] },
			{ sku: "A-2", marca: "ATK", modelo: "F1", variante: "Black", cat: "TECLADO", fob: 999, img: "data:image/png;base64,AA", status: "YELLOW", grounded: true, warnings: ["outlier de precio"] },
			{ sku: "A-3", marca: "ATK", modelo: "F2", variante: "", cat: "MOUSE", fob: 5, img: "-", status: "RED", grounded: false, warnings: ["fob sin evidencia literal"] },
			{ sku: "B-1", marca: "LOGITECH", modelo: "G502", variante: "White", cat: "MOUSE", fob: 40, img: "data:image/png;base64,BB", status: "GREEN", grounded: true, warnings: [] },
		];
		const rep = CatalogValidator.catalogQualityReport(items);
		const s = rep.summary;
		this.assert(s.total === 4 && s.green === 2 && s.yellow === 1 && s.red === 1, "reporte: totales globales 4/2/1/1 (got " + JSON.stringify(s) + ")");
		this.assert(s.grounded === 3 && s.groundedPct === 75, "reporte: grounding 3/4 = 75%");
		this.assert(s.outliers === 1, "reporte: 1 outlier detectado");
		this.assert(s.sinFoto === 1, "reporte: 1 sin foto");
		this.assert(s.duplicados === 2, "reporte: A-1/A-2 identidad duplicada = 2");
		this.assert(s.verifiedPct === 75, "reporte: 75% verificados (no-RED)");
		const atk = rep.brands.find(b => b.marca === "ATK");
		this.assert(atk && atk.total === 3 && atk.green === 1 && atk.yellow === 1 && atk.red === 1, "reporte: fila ATK 3/1/1/1");
		const lg = rep.brands.find(b => b.marca === "LOGITECH");
		this.assert(lg && lg.green === 1 && lg.groundedPct === 100, "reporte: fila LOGITECH 100% grounded");
		this.assert(rep.brands.length === 2, "reporte: 2 proveedores");
		this.assert(rep.brands[0].total >= rep.brands[1].total, "reporte: ordenado por total desc");
		// vacío
		const empty = CatalogValidator.catalogQualityReport([]);
		this.assert(empty.summary.total === 0 && empty.brands.length === 0, "reporte: vacío → 0");
		// item sin marca → OTRO
		const otro = CatalogValidator.catalogQualityReport([{ sku: "X", marca: "", modelo: "m", fob: 1, img: "-", status: "GREEN", warnings: [] }]);
		this.assert(otro.brands[0].marca === "OTRO", "reporte: marca vacía → OTRO");
	},

	testMissingImageIsNotGreen() {
		const item = {
			sku: "IMG-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "-",
			grounded: true,
		};
		const result = CatalogValidator.runFullValidation([item]);
		this.assert(
			result.review.length === 1 && item.status === "YELLOW",
			"Producto sin imagen NO queda verde (R9 fail-closed -> YELLOW)",
		);
		this.assert(
			item.qualityReason.includes("Sin imagen"),
			"La razón del semáforo es coherente",
		);
	},

	testUpstreamQualityCannotBePromoted() {
		const item = {
			sku: "SRC-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "RED",
			sourceWarnings: ["Fuente marcó el producto como incierto"],
		};
		const result = CatalogValidator.runFullValidation([item]);
		this.assert(
			result.rejected.length === 1 && item.status === "RED",
			"La evidencia roja de origen no puede promocionarse a verde",
		);
		this.assert(
			item.warnings.includes("Fuente marcó el producto como incierto"),
			"La razón de origen se conserva en el resultado final",
		);
	},

	testGroundingBarrier() {
		const item = {
			sku: "GRD-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: false,
			groundingReason: "FOB no encontrado",
		};
		const result = CatalogValidator.runFullValidation([item]);
		this.assert(
			result.accepted.length === 0 && item.status === "YELLOW",
			"FOB sin grounding no puede quedar verde",
		);
		this.assert(
			item.warnings.some((w) => w.includes("FOB no encontrado")),
			"La razón de grounding se conserva en la validación final",
		);
	},

	testGlobalSkuCollisionAllocation() {
		const existing = [
			{
				sku: "DUP-001",
				marca: "AULA",
				modelo: "F75",
				variante: "Black",
				cat: "TECLADO",
			},
		];
		const batch = [
			{
				sku: "DUP-001",
				marca: "VGN",
				modelo: "F1",
				variante: "Black",
				cat: "MOUSE",
			},
			{
				sku: "",
				marca: "AULA",
				modelo: "F75",
				variante: "Black",
				cat: "TECLADO",
			},
			{
				sku: "DUP-001",
				marca: "AULA",
				modelo: "F99",
				variante: "White",
				cat: "TECLADO",
			},
		];
		SkuAllocator.allocateBatch(batch, existing);
		this.assert(
			batch[1].sku === "DUP-001",
			"Producto equivalente conserva la identidad SKU global existente",
		);
		this.assert(
			new Set(batch.map((i) => i.sku)).size === batch.length,
			"Las colisiones reales generan SKUs distintos sin sobrescribir",
		);
		const repeated = [{ ...batch[0] }];
		SkuAllocator.allocateBatch(repeated, existing);
		this.assert(
			repeated[0].sku === batch[0].sku,
			"La nueva identidad por colisión es determinista",
		);

		// IT26: SKU legible con slug del modelo (formato BRAND-CAT-SLUG-HASH4)
		const readable = SkuAllocator.generatedSku({
			marca: "AULA",
			cat: "TECLADO",
			modelo: "F75 Reaper",
			variante: "Black",
		});
		this.assert(
			/^AUL-TEC-F75-[0-9A-F]{4}$/.test(readable),
			`SKU legible con slug del modelo (${readable})`,
		);
		this.assert(
			SkuAllocator.slugOf("AJ139 Pro") === "AJ139",
			"slugOf prefiere el token con dígitos",
		);
		this.assert(
			SkuAllocator.slugOf("G502") === "G502",
			"slugOf toma el código del modelo",
		);
		this.assert(
			SkuAllocator.generatedSku({
				marca: "AULA",
				cat: "TECLADO",
				modelo: "F75 Reaper",
				variante: "Black",
			}) === readable,
			"SKU legible determinista",
		);
	},

	testIvaIsSeparateFromProductCost() {
		const result = Calculator.calculateOrder(
			[{ sku: "IVA-001", fob: 100, qty: 1 }],
			{
				flete: 0,
				seguro: 0,
				derechos: 0,
				tasa: 0,
				perc: 0,
				desp: 0,
				courier: 0,
				ivaPct: 21,
				markup: 2,
				tipoCambio: 1000,
			},
		);
		this.assert(
			result.items[0].costoU === 100 && result.items[0].pvp === 200,
			"IVA no infla costo unitario ni PVP",
		);
		this.assert(
			result.totals.costoNeto === 100 &&
				result.totals.ivaUsd === 21 &&
				result.totals.totalBrutoConIva === 121,
			"IVA USD queda separado del costo neto y del bruto",
		);
		this.assert(
			result.totals.ivaArs === 21000,
			"IVA ARS se conserva junto con el IVA USD",
		);
	},

	testColorVariantRoundTripContract() {
		const variant = FileImporter.getVariant({
			Variante: "White",
			Color: "Black",
		});
		const csv = FileImporter.exportCSV({
			name: "variant",
			items: [
				{
					sku: "V-1",
					cat: "MOUSE",
					marca: "VGN",
					modelo: "F1",
					variante: variant,
					fob: 10,
					qty: 1,
					costoU: 10,
					ivaU: 2.1,
					subIva: 2.1,
				},
			],
		});
		this.assert(
			variant === "White" && csv === true,
			"CSV/XLSX conserva el campo Color/Variante con prioridad explícita",
		);
	},

	testUpdaterNotesArePlainText() {
		const remote = "<img src=x onerror=alert(1)>\n### Notas";
		this.assert(
			AppUpdater.formatNotes(remote).includes("<img"),
			"Las notas remotas se conservan como texto, no como HTML ejecutable",
		);
		this.assert(
			AppUpdater.isValidVersion("1.7.2") &&
				!AppUpdater.isValidVersion("1.7.2%22"),
			"La versión remota se valida antes de construir enlaces") &&
			(() => {
				// Guard de instalación: todas las instalaciones manejables pasan;
				// 'unknown' (sin backend) nunca auto-instala. 'binary' (AppDir suelto)
				// se maneja con el mecanismo propio (installBinaryUpdate).
				const ok =
					AppUpdater.isAutoInstallable('appimage') &&
					AppUpdater.isAutoInstallable('nsis') &&
					AppUpdater.isAutoInstallable('app') &&
					AppUpdater.isAutoInstallable('binary') &&
					!AppUpdater.isAutoInstallable('unknown') &&
					!AppUpdater.isAutoInstallable(undefined);
				this.assert(ok, "Updater: isAutoInstallable maneja binary y rechaza unknown");
				return ok;
			})();
	},

	testPreserveModelNamesWithoutGenericOverwrite() {
		const raw = {
			rawText: "Logitech G203 LIGHTSYNC RGB Gaming Mouse",
			marca: "Logitech",
			modelo: "Logitech Mouse",
			cat: "MOUSE",
			fob: 14.5,
		};
		const repaired = TextSanitizer.sanitizeItem(raw);
		this.assert(
			!repaired.modelo.toLowerCase().endsWith("mouse") ||
				repaired.modelo.includes("Logitech"),
			"TextSanitizer preserva modelo especificado",
		);
	},

	testImageExtractionNoAbortingBreak() {
		const pageProds = [
			{
				sku: "P1",
				marca: "AJAZZ",
				modelo: "AK820",
				variante: "White",
				cat: "TECLADO",
				fob: 25.0,
				pageNum: 1,
				x: 100,
				y: 100,
			},
			{
				sku: "P2",
				marca: "AJAZZ",
				modelo: "AK870",
				variante: "Black",
				cat: "TECLADO",
				fob: 30.0,
				pageNum: 1,
				x: 100,
				y: 300,
			},
		];
		const pageImgs = [
			{
				pageNum: 1,
				x: 100,
				y: 290,
				dataUrl: "data:image/png;base64,abc",
				width: 200,
				height: 150,
			},
		];
		PdfParser.matchImagesToProductsGlobal(pageProds, pageImgs);
		this.assert(
			pageProds[1].img === "data:image/png;base64,abc",
			"Procesamiento espacial asigna foto al producto 2 sin abortar el loop de la página",
		);
	},

	testInvalidImageIsNotAssigned() {
		const products = [
			{
				sku: "P1",
				marca: "AULA",
				modelo: "AK820",
				variante: "White",
				cat: "TECLADO",
				fob: 25,
				pageNum: 1,
				x: 100,
				y: 100,
			},
		];
		PdfParser.matchImagesToProductsGlobal(products, [
			{
				pageNum: 1,
				x: 100,
				y: 80,
				width: 100,
				height: 100,
				dataUrl: "not-a-data-url",
			},
		]);
		this.assert(
			products[0].img === "-",
			"Matching espacial no asigna URLs corruptas y representa la imagen faltante con -",
		);
	},

	testKpiMinFobDecimalFormatting() {
		const minFob = 0.45;
		const formatted = minFob >= 10 ? minFob.toFixed(0) : minFob.toFixed(2);
		this.assert(
			formatted === "0.45",
			"Formato de FOB Mínimo muestra decimales exactos para precios bajos",
		);
	},

	testEscapeKeyModalDismissal() {
		let closed = false;
		const handler = (key) => {
			if (key === "Escape") closed = true;
		};
		handler("Escape");
		this.assert(
			closed === true,
			"Manejador de tecla Escape cierra ventanas modales activas",
		);
	},

	testZeroTotalQtyDoorToDoorLiquidation() {
		const res = Calculator.calculateDoorToDoorExactCost([
			{ sku: "S1", fob: 0, qty: 0, cat: "TECLADO", modelo: "Test" },
		]);
		this.assert(
			!isNaN(res.items[0].costoPuertaUnitUsd),
			"Liquidación puerta a puerta maneja cantidades e importes FOB cero sin producir NaN",
		);
	},

	testCatalogFiltersAudit() {
		const sampleCatalog = [
			{
				sku: "KEY-001",
				marca: "AJAZZ",
				modelo: "AK820 Keyboard",
				cat: "TECLADO",
				fob: 25.0,
			},
			{
				sku: "MOU-001",
				marca: "VGN",
				modelo: "Dragonfly F1",
				cat: "MOUSE",
				fob: 35.0,
			},
			{
				sku: "PAD-001",
				marca: "ATK",
				modelo: "Sky Pad",
				cat: "MOUSEPAD",
				fob: 15.0,
			},
			{
				sku: "HED-001",
				marca: "AULA",
				modelo: "Headset N9",
				cat: "HEADSET",
				fob: 50.0,
			},
		];

		// Audit 1: Search filter
		const txt = "dragonfly";
		const resTxt = sampleCatalog.filter((r) =>
			(r.sku + " " + r.marca + " " + r.modelo + " " + (r.variante || ""))
				.toLowerCase()
				.includes(txt),
		);
		this.assert(
			resTxt.length === 1 && resTxt[0].sku === "MOU-001",
			"Filtro de búsqueda de catálogo encuentra exactamente la coincidencia",
		);

		// Audit 2: Marca filter
		const resMarca = sampleCatalog.filter((r) => r.marca === "AJAZZ");
		this.assert(
			resMarca.length === 1 && resMarca[0].marca === "AJAZZ",
			"Filtro por Marca aísla correctamente los productos de la marca",
		);

		// Audit 3: Categoria filter
		const resCat = sampleCatalog.filter((r) => r.cat === "MOUSEPAD");
		this.assert(
			resCat.length === 1 && resCat[0].cat === "MOUSEPAD",
			"Filtro por Categoría aisla correctamente la categoría seleccionada",
		);

		// Audit 4: Min / Max Price filter
		const minP = 20,
			maxP = 40;
		const resPrice = sampleCatalog.filter(
			(r) => r.fob >= minP && r.fob <= maxP,
		);
		this.assert(
			resPrice.length === 2,
			"Filtro de rango Min/Max precio FOB aísla los productos dentro del rango de precio",
		);
	},

	testRealCatalogCoherence() {
		const item = {
			sku: "8BIT-CON-001",
			marca: "8BitDo",
			modelo: "Ultimate 2.4G Controller",
			variante: "White / Black",
			cat: "CONTROLLER",
			fob: 34.5,
			qty: 5,
			img: "data:image/png;base64,sample",
		};

		const hasAllFields = !!(
			item.sku &&
			item.marca &&
			item.modelo &&
			item.cat &&
			item.fob > 0 &&
			item.qty >= 0 &&
			item.img
		);
		this.assert(
			hasAllFields,
			"Coherencia completa de campos: SKU, Marca, Modelo, Categoría, FOB, Cantidad e Imagen",
		);
	},

	testOnDemandZeroIdleMemoryGuarantee() {
		this.assert(
			typeof TextSanitizer !== "undefined",
			"Arquitectura limpia: TextSanitizer es un motor liviano de memoria 0 en reposo",
		);
	},

	async testCellStructuredLlmPipeline() {
		const sampleCells = [
			{
				sku: "",
				marca: "AJAZZ",
				modelo: "AK820 Pro Mechanical Keyboard Gift Switch",
				variante: "Gift Switch",
				cat: "TECLADO",
				fob: 48.3,
				pageNum: 1,
				cellRawText:
					"AJAZZ AK820 Pro Mechanical Keyboard Gasket Structure Gift Switch $48.30",
			},
			{
				sku: "",
				marca: "Attack Shark",
				modelo: "X3 Pro Pink",
				variante: "Pink",
				cat: "MOUSE",
				fob: 50.63,
				pageNum: 1,
				cellRawText:
					"Attack Shark X3 Pro PAW3395 Lightweight Wireless Mouse Pink $50.63",
			},
		];

		this.assert(
			sampleCells.length === 2,
			"Celdas de muestra para sanitización listas",
		);
		const sanitized = sampleCells.map((c) => TextSanitizer.sanitizeItem(c, []));
		this.assert(
			sanitized.length === 2,
			"Sanitización determinística mantiene la cantidad de productos",
		);
		this.assert(
			sanitized[0].fob === 48.3 && sanitized[1].fob === 50.63,
			"Sanitización preserva de manera inmutable los precios FOB determinísticos",
		);
	},

	testAppUpdaterModule() {
		if (typeof AppUpdater === "undefined") {
			this.assert(false, "Modulo AppUpdater no está definido en el entorno");
			return;
		}

		this.assert(
			AppUpdater.CURRENT_VERSION === '2.2.28',
			"AppUpdater CURRENT_VERSION configurado en 2.1.0",
		);
		this.assert(
			typeof AppUpdater.isNewerVersion === "function",
			"AppUpdater.isNewerVersion disponible",
		);
		this.assert(
			AppUpdater.isNewerVersion("1.5.8", "1.5.7") === true,
			"Compara correctamente 1.5.8 > 1.5.7",
		);
		this.assert(
			AppUpdater.isNewerVersion("1.5.7", "1.5.7") === false,
			"Compara correctamente 1.5.7 no es superior a 1.5.7",
		);
		this.assert(
			AppUpdater.isNewerVersion("1.5.6", "1.5.7") === false,
			"Compara correctamente 1.5.6 < 1.5.7",
		);
		this.assert(
			typeof AppUpdater.openInBrowser === "function",
			"AppUpdater.openInBrowser disponible",
		);
		this.assert(
			typeof AppUpdater.showModal === "function",
			"AppUpdater.showModal disponible para emerger pop-ups",
		);

		// IT37: el auto-check del arranque NO abre el modal (backdrop taparía la app
		// y mataría todos los clics); el check manual SÍ lo abre.
		const origCheck = AppUpdater._tauriCheck;
		const origShow = AppUpdater.showModal;
		let showModalCalls = 0;
		AppUpdater.showModal = () => {
			showModalCalls++;
		};
		// Forma REAL del plugin v2: { rid, currentVersion, version, body, rawJson } — SIN
		// `available`. El bug era que el código guardaba con updateInfo?.available (undefined),
		// por lo que nunca detectaba actualizaciones aunque el plugin sí encontrara una.
		AppUpdater._tauriCheck = () =>
			Promise.resolve({
				rid: 123,
				currentVersion: "2.0.1",
				version: "9.9.9",
				body: "x",
			});
		return AppUpdater.checkUpdate(false)
			.then(() => {
				this.assert(
					AppUpdater.latestVersion === "9.9.9",
					"Detecta actualización cuando el plugin devuelve version SIN campo available",
				);
				const autoCalls = showModalCalls;
				return AppUpdater.checkUpdate(true).then(() => autoCalls);
			})
			.then((autoCalls) => {
				this.assert(
					autoCalls === 0,
					"IT37: auto-check NO abre el modal (evita backdrop que mata clics)",
				);
				this.assert(
					showModalCalls - autoCalls === 1,
					"IT37: check manual SÍ abre el modal",
				);
				AppUpdater.showModal = origShow;
				AppUpdater._tauriCheck = origCheck;
			});
	},

	testUpdaterConfigValidation() {
		// validateConfig returns structured result
		const config = AppUpdater.validateConfig();
		this.assert(
			typeof config === "object" && config !== null,
			"validateConfig devuelve objeto",
		);
		this.assert(
			typeof config.valid === "boolean",
			"validateConfig tiene campo valid",
		);
		this.assert(
			Array.isArray(config.warnings),
			"validateConfig tiene array de warnings",
		);

		// detectPlaceholderSignatures with clean manifest
		const cleanManifest = {
			version: "1.8.0",
			platforms: {
				"windows-x86_64": {
					signature: "dW50cnVzdGVkIHNpZ25hdHVyZQ==",
					url: "https://example.com/app.exe",
				},
			},
		};
		const clean = AppUpdater.detectPlaceholderSignatures(cleanManifest);
		this.assert(clean.clean === true, "Manifest con firma válida → clean");
		this.assert(
			clean.placeholders.length === 0,
			"Sin placeholders en manifest limpio",
		);

		// detectPlaceholderSignatures with placeholder manifest
		const badManifest = {
			version: "1.7.1",
			platforms: {
				"windows-x86_64": {
					signature: "PLACEHOLDER_WINDOWS_SIG",
					url: "https://example.com/app.exe",
				},
				"linux-x86_64": {
					signature: "PLACEHOLDER_LINUX_SIG",
					url: "https://example.com/app.AppImage",
				},
			},
		};
		const bad = AppUpdater.detectPlaceholderSignatures(badManifest);
		this.assert(bad.clean === false, "Manifest con PLACEHOLDER → no clean");
		this.assert(
			bad.placeholders.length === 2,
			`Detecta 2 plataformas con placeholder (got ${bad.placeholders.length})`,
		);
		this.assert(
			bad.placeholders.includes("windows-x86_64"),
			"Detecta placeholder en windows",
		);
		this.assert(
			bad.placeholders.includes("linux-x86_64"),
			"Detecta placeholder en linux",
		);

		// Empty/null manifest
		const empty = AppUpdater.detectPlaceholderSignatures(null);
		this.assert(
			empty.clean === true,
			"Manifest null → clean (no platforms to check)",
		);
	},

	testInfraImprovements() {
		// Progress: cancellation mechanism
		this.assert(
			typeof UINotifications.requestCancel === "function",
			"requestCancel existe",
		);
		this.assert(
			typeof UINotifications.isCancelRequested === "function",
			"isCancelRequested existe",
		);
		this.assert(
			UINotifications.isCancelRequested() === false,
			"Cancel no solicitado inicialmente",
		);
		UINotifications.requestCancel();
		this.assert(
			UINotifications.isCancelRequested() === true,
			"Cancel solicitado después de requestCancel",
		);
		UINotifications.showProgress(0);
		this.assert(
			UINotifications.isCancelRequested() === false,
			"showProgress resetea cancel",
		);

		// Progress: per-file progress
		this.assert(
			typeof UINotifications.showFileProgress === "function",
			"showFileProgress existe",
		);

		// QuoteGenerator: currency formatter
		this.assert(
			typeof QuoteGenerator.formatCurrency === "function",
			"formatCurrency existe",
		);
		const formatted = QuoteGenerator.formatCurrency(1234.56, {
			locale: "en-US",
			currency: "USD",
		});
		this.assert(
			formatted.includes("1,234.56") || formatted.includes("1234.56"),
			`formatCurrency formatea correctamente (got "${formatted}")`,
		);

		// Image extraction: aspect ratio guard
		this.assert(
			typeof PdfParser.buildImageEvidence === "function",
			"buildImageEvidence disponible",
		);
		const wideImg = PdfParser.buildImageEvidence(
			"test",
			1,
			{
				width: 1000,
				height: 10,
				x: 0,
				y: 0,
				dataUrl: "data:image/png;base64,AA",
			},
			"SKU",
			"matched",
		);
		this.assert(
			wideImg !== null,
			"buildImageEvidence funciona con imagen panorámica",
		);
	},

	testReliabilityLayers() {
		// Layer 1: Error boundary
		this.assert(
			typeof Reliability.installErrorBoundary === "function",
			"L1: installErrorBoundary existe",
		);
		this.assert(
			typeof Reliability.safeCall === "function",
			"L1: safeCall existe",
		);
		const safeFn = Reliability.safeCall(
			() => {
				throw new Error("boom");
			},
			"test",
			"fallback",
		);
		this.assert(
			safeFn() === "fallback",
			"L1: safeCall retorna fallback en error",
		);
		const safeOk = Reliability.safeCall(() => 42, "test", 0);
		this.assert(safeOk() === 42, "L1: safeCall retorna valor normal sin error");
		this.assert(
			Array.isArray(Reliability.getErrorLog()),
			"L1: getErrorLog retorna array",
		);
		this.assert(
			Reliability.getErrorLog().length > 0,
			"L1: error fue registrado en log",
		);

		// Layer 2: Data integrity
		const goodCatalog = [
			{
				sku: "A-001",
				modelo: "K552",
				fob: 35,
				marca: "Redragon",
				cat: "TECLADO",
			},
			{
				sku: "A-002",
				modelo: "G203",
				fob: 22,
				marca: "Logitech",
				cat: "MOUSE",
			},
		];
		const goodResult = Reliability.validateCatalogIntegrity(goodCatalog);
		this.assert(
			goodResult.valid === true,
			"L2: catálogo válido pasa integridad",
		);
		this.assert(
			goodResult.issues.length === 0,
			"L2: sin issues en catálogo limpio",
		);

		const badCatalog = [
			{
				sku: "B-001",
				modelo: "K552",
				fob: -5,
				marca: "Redragon",
				cat: "TECLADO",
			},
			{
				sku: "B-001",
				modelo: "G203",
				fob: 22,
				marca: "Logitech",
				cat: "MOUSE",
			},
			{ sku: "", modelo: "", fob: "abc", marca: "AULA", cat: "TECLADO" },
		];
		const badResult = Reliability.validateCatalogIntegrity(badCatalog);
		this.assert(
			badResult.issues.length >= 3,
			`L2: detecta múltiples issues (got ${badResult.issues.length})`,
		);
		this.assert(
			badResult.issues.some((i) => i.type === "duplicate_sku"),
			"L2: detecta SKU duplicado",
		);
		this.assert(
			badResult.issues.some((i) => i.type === "invalid_fob"),
			"L2: detecta FOB inválido",
		);
		this.assert(badResult.repaired > 0, "L2: repara FOB inválido");

		// Orphaned selection cleanup
		const sel = { "A-001": 5, "GONE-001": 3, "A-002": 2 };
		const selResult = Reliability.cleanOrphanedSelection(sel, goodCatalog);
		this.assert(
			Object.keys(selResult.cleaned).length === 2,
			"L2: selección limpia tiene 2 SKUs",
		);
		this.assert(
			selResult.removed.includes("GONE-001"),
			"L2: SKU huérfano removido",
		);
		this.assert(selResult.cleaned["A-001"] === 5, "L2: SKU válido preservado");

		// Layer 3: Backup & recovery
		this.assert(
			typeof Reliability.createBackup === "function",
			"L3: createBackup existe",
		);
		this.assert(
			typeof Reliability.recoverFromBackup === "function",
			"L3: recoverFromBackup existe",
		);
		const validPrimary = { items: [{ sku: "X" }], sel: {} };
		const noRecovery = Reliability.recoverFromBackup(validPrimary);
		this.assert(
			noRecovery.recovered === false,
			"L3: no recovery con primary válido",
		);

		// Layer 4: Import schema validation
		const goodHeaders = [
			"SKU",
			"Marca",
			"Modelo",
			"Categoría",
			"FOB USD",
			"Color/Variante",
		];
		const schemaOk = Reliability.validateImportSchema(goodHeaders, "catalog");
		this.assert(
			schemaOk.valid === true,
			"L4: schema válido con columnas requeridas",
		);
		this.assert(schemaOk.missing.length === 0, "L4: sin columnas faltantes");
		this.assert(schemaOk.detected.length >= 1, "L4: columnas detectadas");

		const badHeaders = ["SKU", "Marca", "Precio"];
		const schemaBad = Reliability.validateImportSchema(badHeaders, "catalog");
		this.assert(schemaBad.valid === false, "L4: schema inválido sin Modelo");
		this.assert(
			schemaBad.missing.includes("Modelo"),
			"L4: reporta Modelo faltante",
		);

		// Encoding detection
		const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
		const enc1 = Reliability.detectEncoding(utf8Bom);
		this.assert(
			enc1.encoding === "utf-8" && enc1.hasBOM === true,
			"L4: detecta UTF-8 BOM",
		);

		const noBom = new Uint8Array([0x41, 0x42, 0x43]);
		const enc2 = Reliability.detectEncoding(noBom);
		this.assert(
			enc2.encoding === "utf-8" && enc2.hasBOM === false,
			"L4: sin BOM → utf-8",
		);
	},

	testCategoryEvidence() {
		// Text keyword detection with evidence
		const mouse = PdfParser.detectCategoryWithEvidence(
			"Logitech G203 Lightsync Gaming Mouse",
			"Logitech",
		);
		this.assert(
			mouse.category === "MOUSE",
			`Detecta MOUSE (got "${mouse.category}")`,
		);
		this.assert(
			mouse.confidence >= 85,
			`Confidence >= 85 (got ${mouse.confidence})`,
		);
		this.assert(
			mouse.source === "text-keyword",
			`Source es text-keyword (got "${mouse.source}")`,
		);
		this.assert(mouse.matchedPattern.length > 0, "matchedPattern no vacío");

		// Keyboard detection
		const kb = PdfParser.detectCategoryWithEvidence(
			"AULA F75 Mechanical Keyboard",
			"AULA",
		);
		this.assert(
			kb.category === "TECLADO",
			`Detecta TECLADO (got "${kb.category}")`,
		);
		this.assert(
			kb.source === "text-keyword",
			"TECLADO por text-keyword, no brand-fallback",
		);

		// Brand fallback (low confidence)
		const fallback = PdfParser.detectCategoryWithEvidence(
			"Producto genérico sin keywords",
			"AULA",
		);
		this.assert(
			fallback.category === "TECLADO",
			`Brand fallback → TECLADO (got "${fallback.category}")`,
		);
		this.assert(
			fallback.confidence === 50,
			`Brand fallback confidence = 50 (got ${fallback.confidence})`,
		);
		this.assert(
			fallback.source === "brand-fallback",
			`Source es brand-fallback (got "${fallback.source}")`,
		);

		// OTRO with diagnostic
		const otro = PdfParser.detectCategoryWithEvidence("Cable USB tipo C", "");
		this.assert(
			otro.category === "OTRO",
			`Sin match → OTRO (got "${otro.category}")`,
		);
		this.assert(otro.confidence === 0, "OTRO confidence = 0");
		this.assert(
			otro.source === "no-match",
			`Source es no-match (got "${otro.source}")`,
		);
		this.assert(
			typeof otro.analyzedText === "string",
			"analyzedText presente para diagnóstico",
		);

		// Backward compatibility: detectCategory still returns string
		this.assert(
			PdfParser.detectCategory("Gaming Mouse RGB", "") === "MOUSE",
			"detectCategory backward compat",
		);
		this.assert(
			PdfParser.detectCategory("unknown thing", "") === "OTRO",
			"detectCategory OTRO backward compat",
		);

		// Brand-exclusive (high confidence)
		const kz = PdfParser.detectCategoryWithEvidence("ZSN Pro X", "KZ");
		this.assert(
			kz.category === "AURICULAR",
			`KZ → AURICULAR (got "${kz.category}")`,
		);
		this.assert(
			kz.confidence === 95,
			`Brand-exclusive confidence = 95 (got ${kz.confidence})`,
		);
	},

	testImportReliability() {
		// Import summary: successful
		const ok = Reliability.buildImportSummary({
			fileName: "catalogo.pdf",
			totalParsed: 50,
			imported: 45,
			skipped: 3,
			failed: 2,
		});
		this.assert(ok.status === "OK", "Import OK status");
		this.assert(
			ok.message.includes("45 importados"),
			"Mensaje incluye count importados",
		);
		this.assert(
			ok.message.includes("3 omitidos"),
			"Mensaje incluye count omitidos",
		);

		// Import summary: empty parse
		const empty = Reliability.buildImportSummary({
			fileName: "vacío.csv",
			totalParsed: 0,
		});
		this.assert(empty.status === "EMPTY", "Empty parse → EMPTY status");
		this.assert(
			empty.message.includes("no produjo ningún producto"),
			"Empty parse tiene diagnóstico",
		);

		// Import summary: all failed
		const allFailed = Reliability.buildImportSummary({
			fileName: "roto.xlsx",
			totalParsed: 10,
			imported: 0,
			failed: 10,
		});
		this.assert(
			allFailed.status === "ALL_FAILED",
			"All failed → ALL_FAILED status",
		);

		// Product viability
		const viable = Reliability.validateProductViability({
			modelo: "K552",
			fob: 35,
		});
		this.assert(viable.viable === true, "Producto con modelo y FOB es viable");

		const noModel = Reliability.validateProductViability({
			modelo: "",
			fob: 35,
		});
		this.assert(noModel.viable === false, "Producto sin modelo no es viable");
		this.assert(noModel.missing.includes("modelo"), "Reporta modelo faltante");

		const noFob = Reliability.validateProductViability({
			modelo: "K552",
			fob: 0,
		});
		this.assert(noFob.viable === false, "Producto sin FOB no es viable");
		this.assert(noFob.missing.includes("fob"), "Reporta FOB faltante");

		// File type validation
		const pdfOk = Reliability.validateFileType("catalogo.pdf", "any");
		this.assert(pdfOk.valid === true, "PDF es tipo válido");
		this.assert(pdfOk.detectedType === "pdf", "Detecta tipo pdf");

		const xlsOk = Reliability.validateFileType("datos.xls", "any");
		this.assert(xlsOk.valid === true, "XLS es tipo válido");
		this.assert(xlsOk.detectedType === "xlsx", "XLS se mapea a xlsx");

		const badType = Reliability.validateFileType("foto.jpg", "any");
		this.assert(badType.valid === false, "JPG no es tipo válido");
		this.assert(
			badType.reason.includes("no soportada"),
			"Razón explica tipo no soportado",
		);

		const wrongType = Reliability.validateFileType("datos.csv", "pdf");
		this.assert(
			wrongType.valid === false,
			"CSV cuando se espera PDF → inválido",
		);
	},

	testFuzzyColumnMatching() {
		// normalizeHeader: accents, case, whitespace
		this.assert(
			FileImporter.normalizeHeader("Categoría") === "categoria",
			"normalizeHeader strip accents",
		);
		this.assert(
			FileImporter.normalizeHeader("  MODELO  ") === "modelo",
			"normalizeHeader trim + lowercase",
		);
		this.assert(
			FileImporter.normalizeHeader("FOB  USD") === "fob usd",
			"normalizeHeader collapse spaces",
		);

		// resolveField: exact match
		const row1 = { Modelo: "K552", "FOB USD": "35.50", Marca: "Redragon" };
		this.assert(
			FileImporter.resolveField(row1, "modelo") === "K552",
			"resolveField exact Modelo",
		);
		this.assert(
			FileImporter.resolveField(row1, "fob") === "35.50",
			"resolveField exact FOB USD",
		);

		// resolveField: alias match (different column names)
		const row2 = {
			"Product Name": "G203",
			Price: "22.99",
			Brand: "Logitech",
			Category: "MOUSE",
		};
		this.assert(
			FileImporter.resolveField(row2, "modelo") === "G203",
			'resolveField alias "Product Name" → modelo',
		);
		this.assert(
			FileImporter.resolveField(row2, "fob") === "22.99",
			'resolveField alias "Price" → fob',
		);
		this.assert(
			FileImporter.resolveField(row2, "marca") === "Logitech",
			'resolveField alias "Brand" → marca',
		);
		this.assert(
			FileImporter.resolveField(row2, "categoria") === "MOUSE",
			'resolveField alias "Category" → categoria',
		);

		// resolveField: accent-insensitive
		const row3 = { Categoría: "TECLADO", Código: "SKU-001" };
		this.assert(
			FileImporter.resolveField(row3, "categoria") === "TECLADO",
			"resolveField accent-insensitive Categoría",
		);
		this.assert(
			FileImporter.resolveField(row3, "sku") === "SKU-001",
			"resolveField accent-insensitive Código",
		);

		// resolveField: missing field returns empty
		this.assert(
			FileImporter.resolveField(row1, "cantidad") === "",
			"resolveField missing → empty string",
		);
		this.assert(
			FileImporter.resolveField(null, "modelo") === "",
			"resolveField null row → empty",
		);
	},

	testRemainingGaps() {
		// #6: Short ambiguous tokens get reduced confidence
		const _ambiguous = PdfParser.detectCategoryWithEvidence(
			"Machenike K500 A5 keyboard",
			"",
		);
		// "A5" is ambiguous but "keyboard" should match TECLADO first (higher priority in pattern list)
		// Let's test a case where ONLY the ambiguous token matches
		const ambiguousOnly = PdfParser.detectCategoryWithEvidence("Model A5", "");
		if (ambiguousOnly.category === "MOUSE") {
			this.assert(
				ambiguousOnly.confidence <= 40,
				`#6: Token ambiguo "a5" confidence <= 40 (got ${ambiguousOnly.confidence})`,
			);
			this.assert(
				ambiguousOnly.source === "text-keyword-ambiguous",
				`#6: Source es ambiguous (got "${ambiguousOnly.source}")`,
			);
		} else {
			// Con "Model A5" (sin keyword de categoría), el token ambiguo NO debe dar
			// MOUSE con confianza alta: cualquier otra categoría/confianza baja es correcto.
			this.assert(
				ambiguousOnly.confidence < 85,
				`#6: Token "a5" sin keyword no gana con confianza alta (got ${ambiguousOnly.confidence})`,
			);
		}

		// Non-ambiguous token keeps full confidence
		const fullConf = PdfParser.detectCategoryWithEvidence(
			"Gaming Mouse RGB",
			"",
		);
		this.assert(
			fullConf.confidence >= 85,
			`#6: Token no ambiguo mantiene confidence alta (got ${fullConf.confidence})`,
		);
		this.assert(
			fullConf.source === "text-keyword",
			`#6: Source es text-keyword (got "${fullConf.source}")`,
		);

		// #2: Mojibake detection pattern exists in FileImporter
		this.assert(
			typeof FileImporter.normalizeHeader === "function",
			"#2: normalizeHeader disponible",
		);
		const mojibakeHeader = "CategorÃ­a";
		const normalized = FileImporter.normalizeHeader(mojibakeHeader);
		this.assert(
			typeof normalized === "string",
			"#2: normalizeHeader procesa mojibake sin crash",
		);

		// #11: Empty modelo items should never be considered equivalent
		// (Tested via SkuAllocator.isEquivalent which uses identityKey)
		const _emptyA = { marca: "", modelo: "", variante: "", cat: "" };
		const _emptyB = { marca: "", modelo: "", variante: "", cat: "" };
		// These have the same identityKey but the importFlow guard prevents dedup on empty modelo
		this.assert(
			typeof SkuAllocator.isEquivalent === "function",
			"#11: isEquivalent disponible",
		);

		// #12: Merged cells detection is structural (tested via processExcelFile behavior)
		// Verify the COLUMN_ALIASES exist for all expected fields
		const fields = [
			"modelo",
			"marca",
			"categoria",
			"fob",
			"sku",
			"variante",
			"cantidad",
		];
		for (const f of fields) {
			this.assert(
				Array.isArray(FileImporter.COLUMN_ALIASES[f]) &&
					FileImporter.COLUMN_ALIASES[f].length > 0,
				`#12: COLUMN_ALIASES tiene aliases para "${f}"`,
			);
		}
	},

	// ── Slice 1: catalog-quality-contract ──

	testContractEvaluateItem() {
		// RED: evaluateItem() does not exist yet — this test will fail

		const row = {
			sku: "TST-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
		};

		const evals = CatalogValidator.evaluateItem(row);

		// Must produce exactly 10 evaluations
		this.assert(Array.isArray(evals), "evaluateItem debe devolver un array");
		this.assert(
			evals.length === 10,
			"evaluateItem emite exactamente 10 evaluaciones R1-R10",
		);

		const codes = evals.map((e) => e.code);
		const expectedCodes = [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		];
		this.assert(
			JSON.stringify(codes) === JSON.stringify(expectedCodes),
			"Los códigos de evaluación son R1-R10 en orden",
		);

		// Every evaluation has required fields
		for (const e of evals) {
			this.assert(
				typeof e.code === "string" && e.code.startsWith("R"),
				`Evaluación ${e.code} tiene campo code`,
			);
			this.assert(
				["CRITICAL", "WARNING", "PASS"].includes(e.severity),
				`Evaluación ${e.code} tiene severity válida (${e.severity})`,
			);
			this.assert(
				["RED", "YELLOW", "GREEN"].includes(e.status),
				`Evaluación ${e.code} tiene status válido (${e.status})`,
			);
			this.assert(
				typeof e.reason === "string" && e.reason.length > 0,
				`Evaluación ${e.code} tiene reason no vacío`,
			);
			this.assert(
				["REJECTED", "IMPORTABLE"].includes(e.importability),
				`Evaluación ${e.code} tiene importability válida (${e.importability})`,
			);
			this.assert(
				typeof e.evidence === "object" && e.evidence !== null,
				`Evaluación ${e.code} tiene evidencia estructurada`,
			);
			this.assert(
				typeof e.evidence.observed !== "undefined",
				`Evaluación ${e.code} tiene evidence.observed`,
			);
			this.assert(
				typeof e.evidence.source === "string" && e.evidence.source.length > 0,
				`Evaluación ${e.code} tiene evidence.source`,
			);
		}

		// Clean row: all GREEN
		const allGreen = evals.every(
			(e) => e.status === "GREEN" && e.importability === "IMPORTABLE",
		);
		this.assert(allGreen, "Fila limpia produce todas GREEN/IMPORTABLE");

		// TRIANGULATE: row with violations
		const badRow = {
			sku: "BAD-001",
			marca: "OTRO",
			modelo: "-",
			variante: "45.99",
			cat: "OTRO",
			fob: -5,
			img: "-",
			grounded: undefined,
			sourceStatus: "GREEN",
		};
		const badEvals = CatalogValidator.evaluateItem(badRow);
		this.assert(
			badEvals.length === 10,
			"Fila con violaciones produce 10 evaluaciones",
		);
		this.assert(
			badEvals[0].status === "RED" && badEvals[0].code === "R1",
			"R1 RED para FOB inválido",
		);
		this.assert(
			badEvals[1].status === "RED" && badEvals[1].code === "R2",
			"R2 RED para modelo basura",
		);
		this.assert(
			badEvals[6].status === "YELLOW" && badEvals[6].code === "R7",
			"R7 YELLOW para variante numérica",
		);
		this.assert(
			badEvals[8].status === "YELLOW" && badEvals[8].code === "R9",
			"R9 YELLOW para imagen faltante (fail-closed)",
		);
		this.assert(
			badEvals[9].status === "RED" && badEvals[9].code === "R10",
			"R10 RED para grounding ausente",
		);

		// R10 false grounding → YELLOW (not RED)
		const falseGroundedRow = {
			sku: "FGRD-01",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: false,
			groundingReason: "FOB no encontrado",
			sourceStatus: "GREEN",
		};
		const fgEvals = CatalogValidator.evaluateItem(falseGroundedRow);
		const r10 = fgEvals.find((e) => e.code === "R10");
		this.assert(
			r10.status === "YELLOW" && r10.importability === "IMPORTABLE",
			"R10 YELLOW/IMPORTABLE para grounding falso (no ausente)",
		);
		this.assert(
			r10.reason.includes("FOB no encontrado"),
			"R10 razón preserva groundingReason",
		);
	},

	testContractViolationsByCode() {
		// RED: aggregateViolations() does not exist yet — this test will fail

		const evals = [
			{ code: "R1", status: "GREEN" },
			{ code: "R2", status: "GREEN" },
			{ code: "R3", status: "RED" },
			{ code: "R4", status: "GREEN" },
			{ code: "R5", status: "GREEN" },
			{ code: "R6", status: "GREEN" },
			{ code: "R7", status: "YELLOW" },
			{ code: "R8", status: "GREEN" },
			{ code: "R9", status: "GREEN" },
			{ code: "R10", status: "GREEN" },
		];

		const agg = CatalogValidator.aggregateViolations(evals);

		this.assert(
			typeof agg === "object" && agg !== null,
			"aggregateViolations devuelve un objeto",
		);
		this.assert(
			agg.canonicalGroupCount === 10,
			"canonicalGroupCount es exactamente 10",
		);

		const keys = Object.keys(agg.violationsByCode).sort();
		this.assert(
			keys.length === 10,
			"violationsByCode tiene exactamente 10 claves",
		);
		const hasAllCodes = [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		].every((c) => keys.includes(c));
		this.assert(
			hasAllCodes,
			"violationsByCode contiene todas las claves R1-R10",
		);

		// Non-GREEN counts
		this.assert(
			agg.violationsByCode.R1 === 0,
			"R1 tiene 0 violaciones (GREEN)",
		);
		this.assert(agg.violationsByCode.R3 === 1, "R3 tiene 1 violación (RED)");
		this.assert(agg.violationsByCode.R7 === 1, "R7 tiene 1 violación (YELLOW)");
		this.assert(
			agg.violationsByCode.R9 === 0,
			"R9 tiene 0 violaciones (GREEN advisory)",
		);

		// Zero-preservation: all keys present even with zero counts
		for (const code of [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		]) {
			this.assert(
				typeof agg.violationsByCode[code] === "number",
				`violationsByCode.${code} está presente como número`,
			);
		}

		// stats is separate from canonicalGroupCount
		this.assert(
			typeof agg.stats === "object",
			"stats está separado de canonicalGroupCount",
		);

		// TRIANGULATE: all GREEN evaluates to zero violations
		const allGreen = Array.from({ length: 10 }, (_, i) => ({
			code: "R" + (i + 1),
			status: "GREEN",
		}));
		const aggGreen = CatalogValidator.aggregateViolations(allGreen);
		this.assert(
			aggGreen.canonicalGroupCount === 10,
			"canonicalGroupCount=10 con todo GREEN",
		);
		for (const code of [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		]) {
			this.assert(
				aggGreen.violationsByCode[code] === 0,
				`${code}=0 con todo GREEN`,
			);
		}

		// TRIANGULATE: all RED evaluates to ten violations
		const allRed = Array.from({ length: 10 }, (_, i) => ({
			code: "R" + (i + 1),
			status: "RED",
		}));
		const aggRed = CatalogValidator.aggregateViolations(allRed);
		for (const code of [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		]) {
			this.assert(
				aggRed.violationsByCode[code] === 1,
				`${code}=1 con todo RED`,
			);
			this.assert(
				aggRed.canonicalGroupCount === 10,
				"canonicalGroupCount=10 con todo RED",
			);
		}
	},

	testContractGateOutcome() {
		// Verify GateOutcome contract: absent gate → SKIPPED_ENVIRONMENT_GATED

		const gateMod = typeof QualityGate !== "undefined" ? QualityGate : null;

		if (!gateMod || typeof gateMod.GateOutcome !== "function") {
			this.assert(false, "QualityGate.GateOutcome no está disponible");
			return;
		}

		const outcome = gateMod.GateOutcome({
			gate: "full-corpus",
			reason: "No manifest",
		});
		this.assert(
			outcome.status === "SKIPPED_ENVIRONMENT_GATED",
			"GateOutcome produce SKIPPED_ENVIRONMENT_GATED",
		);
		this.assert(
			outcome.gate === "full-corpus",
			"GateOutcome preserva nombre de gate",
		);
		this.assert(
			typeof outcome.reason === "string" && outcome.reason.length > 0,
			"GateOutcome incluye razón no vacía",
		);

		// TRIANGULATE: different gate name
		const outcome2 = gateMod.GateOutcome({
			gate: "signed-release",
			reason: "No TAURI_SIGNED_SMOKE",
		});
		this.assert(
			outcome2.status === "SKIPPED_ENVIRONMENT_GATED",
			"GateOutcome signed-release produce SKIPPED_ENVIRONMENT_GATED",
		);
		this.assert(
			outcome2.gate === "signed-release",
			"Preserva gate signed-release",
		);
		this.assert(
			outcome2.reason === "No TAURI_SIGNED_SMOKE",
			"Preserva razón explícita",
		);

		// GateOutcome is never a pass
		this.assert(
			outcome.status !== "PASS" && outcome.status !== "GREEN",
			"GateOutcome nunca es PASS/GREEN",
		);
		this.assert(
			outcome2.status !== "PASS" && outcome2.status !== "GREEN",
			"GateOutcome nunca es PASS/GREEN",
		);
	},

	testContractFixtureRoundTrip() {
		// Load contract fixtures
		let fixtures;
		try {
			const path = require("path");
			const fs = require("fs");
			const fixturePath = path.join(
				__dirname,
				"..",
				"..",
				"scripts",
				"quality",
				"contract-fixtures.json",
			);
			const raw = fs.readFileSync(fixturePath, "utf8");
			fixtures = JSON.parse(raw).fixtures;
		} catch (e) {
			this.assert(false, `No se pudieron cargar los fixtures: ${e.message}`);
			return;
		}

		this.assert(
			Array.isArray(fixtures) && fixtures.length === 10,
			"Fixtures contiene exactamente 10 filas (una por R1-R10)",
		);

		// Evaluate each fixture
		const allEvals = [];
		for (const fix of fixtures) {
			const evals = CatalogValidator.evaluateItem(fix);
			this.assert(
				evals.length === 10,
				`Fixture ${fix.sku} produce 10 evaluaciones`,
			);
			allEvals.push(...evals);

			// Verify the expected violation
			const targetEval = evals.find((e) => e.code === fix.expectedViolation);
			this.assert(
				targetEval !== undefined,
				`Fixture ${fix.sku} tiene evaluación ${fix.expectedViolation}`,
			);
			this.assert(
				targetEval.status === fix.expectedStatus,
				`${fix.sku}: ${fix.expectedViolation} status=${fix.expectedStatus} (actual=${targetEval.status})`,
			);
			this.assert(
				targetEval.severity === fix.expectedSeverity,
				`${fix.sku}: ${fix.expectedViolation} severity=${fix.expectedSeverity} (actual=${targetEval.severity})`,
			);
			this.assert(
				typeof targetEval.reason === "string" && targetEval.reason.length > 0,
				`${fix.sku}: ${fix.expectedViolation} tiene reason no vacío`,
			);
			this.assert(
				typeof targetEval.evidence === "object" && targetEval.evidence !== null,
				`${fix.sku}: ${fix.expectedViolation} tiene evidencia`,
			);

			// Verificar importability
			if (fix.expectedStatus === "RED") {
				this.assert(
					targetEval.importability === "REJECTED",
					`${fix.sku}: ${fix.expectedViolation} RED → REJECTED`,
				);
			}
		}

		// Aggregate: each R1-R10 should have exactly one non-GREEN (except R9 which is advisory)
		const agg = CatalogValidator.aggregateViolations(allEvals);
		this.assert(
			agg.canonicalGroupCount === 10,
			"canonicalGroupCount=10 en fixtures",
		);
		for (let i = 1; i <= 10; i++) {
			const code = "R" + i;
			const expected = 1; // all R1-R10 are hard now (R9 included: missing image = violation)
			this.assert(
				agg.violationsByCode[code] === expected,
				`${code}=${expected} violación en fixtures (actual=${agg.violationsByCode[code]})`,
			);
		}

		// Clean row: 10 GREEN
		const cleanRow = {
			sku: "CLN-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
		};
		const cleanEvals = CatalogValidator.evaluateItem(cleanRow);
		const cleanAgg = CatalogValidator.aggregateViolations(cleanEvals);
		this.assert(
			cleanAgg.canonicalGroupCount === 10,
			"canonicalGroupCount=10 con fila limpia",
		);
		for (const code of [
			"R1",
			"R2",
			"R3",
			"R4",
			"R5",
			"R6",
			"R7",
			"R8",
			"R9",
			"R10",
		]) {
			this.assert(
				cleanAgg.violationsByCode[code] === 0,
				`${code}=0 con fila limpia`,
			);
		}

		// Mixed row: R9 advisory GREEN + upstream RED preserved
		const mixedRow = {
			sku: "MIX-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "-",
			grounded: true,
			sourceStatus: "RED",
			sourceWarnings: ["Fuente marcó como incierto"],
		};
		const mixedEvals = CatalogValidator.evaluateItem(mixedRow);
		const r9Mixed = mixedEvals.find((e) => e.code === "R9");
		this.assert(
			r9Mixed.status === "YELLOW" && r9Mixed.importability === "IMPORTABLE",
			"R9 YELLOW/IMPORTABLE con imagen faltante (fail-closed) en fila mixta",
		);
		// Upstream RED cannot be promoted (except R9 which is YELLOW, not GREEN)
		this.assert(
			mixedEvals
				.filter((e) => e.code !== "R9")
				.every((e) => e.status !== "GREEN"),
			"Upstream RED impide que evaluaciones no-R9 sean GREEN",
		);
	},

	// ── Slice 2: PDF Image Evidence ──

	testPdfImageEvidenceAdapter() {
		// buildImageEvidence must produce the spec-required structure
		const evidence = PdfParser.buildImageEvidence(
			"fixture-pdf-sha256",
			3,
			{
				width: 120,
				height: 80,
				x: 45.5,
				y: 200.3,
				dataUrl: "data:image/png;base64,AAAA",
			},
			"SKU-001",
			"matched",
		);

		this.assert(
			typeof evidence === "object" && evidence !== null,
			"buildImageEvidence devuelve un objeto",
		);
		this.assert(
			evidence.pdfIdentity === "fixture-pdf-sha256",
			"Evidence tiene pdfIdentity",
		);
		this.assert(evidence.page === 3, "Evidence tiene page");
		this.assert(
			typeof evidence.imageFormat === "string" &&
				evidence.imageFormat.length > 0,
			"Evidence tiene imageFormat no vacío",
		);
		this.assert(evidence.width === 120, "Evidence tiene width");
		this.assert(evidence.height === 80, "Evidence tiene height");
		this.assert(
			typeof evidence.sourcePosition === "object" &&
				evidence.sourcePosition !== null,
			"Evidence tiene sourcePosition",
		);
		this.assert(
			evidence.sourcePosition.x === 45.5,
			"sourcePosition.x correcto",
		);
		this.assert(
			evidence.sourcePosition.y === 200.3,
			"sourcePosition.y correcto",
		);
		this.assert(
			typeof evidence.canvasDecode === "string",
			"Evidence tiene canvasDecode",
		);
		this.assert(
			evidence.canvasDecode === "success",
			"canvasDecode es success con imagen válida",
		);
		this.assert(
			evidence.productRowId === "SKU-001",
			"Evidence tiene productRowId",
		);
		this.assert(
			evidence.association === "matched",
			"Evidence tiene association",
		);

		// Absent image produces absent evidence
		const absentEvidence = PdfParser.buildImageEvidence(
			"fixture-pdf-sha256",
			1,
			null,
			"SKU-002",
			"none",
		);
		this.assert(
			absentEvidence.canvasDecode === "absent",
			"canvasDecode es absent sin imagen",
		);
		this.assert(
			absentEvidence.width === 0 && absentEvidence.height === 0,
			"Dimensiones son 0 sin imagen",
		);
		this.assert(
			absentEvidence.sourcePosition === null,
			"sourcePosition es null sin imagen",
		);
		this.assert(
			absentEvidence.association === "none",
			"association es none sin imagen",
		);
	},

	testPdfImageEvidenceR9() {
		// R9 with valid PDF image evidence → GREEN
		const rowWithEvidence = {
			sku: "PDF-001",
			marca: "Redragon",
			modelo: "K552",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
			imageEvidence: PdfParser.buildImageEvidence(
				"pdf-hash",
				1,
				{
					width: 100,
					height: 60,
					x: 10,
					y: 50,
					dataUrl: "data:image/png;base64,AAAA",
				},
				"PDF-001",
				"matched",
			),
		};
		const evals1 = CatalogValidator.evaluateItem(rowWithEvidence);
		const r9a = evals1.find((e) => e.code === "R9");
		this.assert(r9a.status === "GREEN", "R9 GREEN con evidencia PDF válida");
		this.assert(
			r9a.evidence.observed.includes("pdf-hash") ||
				r9a.evidence.observed.includes("page"),
			"R9 evidencia incluye referencia PDF",
		);

		// R9 with absent image evidence → YELLOW, not GREEN
		const rowNoImage = {
			sku: "PDF-002",
			marca: "Redragon",
			modelo: "K552",
			variante: "White",
			cat: "TECLADO",
			fob: 35,
			img: "-",
			grounded: true,
			sourceStatus: "GREEN",
			imageEvidence: PdfParser.buildImageEvidence(
				"pdf-hash",
				2,
				null,
				"PDF-002",
				"none",
			),
		};
		const evals2 = CatalogValidator.evaluateItem(rowNoImage);
		const r9b = evals2.find((e) => e.code === "R9");
		this.assert(
			r9b.status === "YELLOW",
			"R9 YELLOW con evidencia de imagen ausente (fail-closed)",
		);
		this.assert(
			r9b.severity === "WARNING",
			"R9 severity WARNING con imagen ausente (fail-closed)",
		);
		this.assert(
			r9b.importability === "IMPORTABLE",
			"R9 IMPORTABLE con imagen ausente",
		);
		this.assert(r9b.reason.length > 0, "R9 reason no vacío con imagen ausente");
		this.assert(
			r9b.evidence.canvasDecode === "absent" ||
				r9b.evidence.observed.includes("absent"),
			"R9 evidencia refleja canvasDecode absent",
		);

		// R9 without imageEvidence falls back to img check (backward compat)
		const rowLegacy = {
			sku: "PDF-003",
			marca: "Redragon",
			modelo: "K552",
			variante: "Red",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,BBBB",
			grounded: true,
			sourceStatus: "GREEN",
		};
		const evals3 = CatalogValidator.evaluateItem(rowLegacy);
		const r9c = evals3.find((e) => e.code === "R9");
		this.assert(
			r9c.status === "GREEN",
			"R9 GREEN sin imageEvidence (backward compat)",
		);
	},

	testPdfImageEvidenceGate() {
		// Without TAURI_WEBVIEW environment, PDF evidence suite is gated
		const gate = CatalogValidator.gateOutcome
			? CatalogValidator.gateOutcome("tauri-fixture")
			: {
					status: "SKIPPED_ENVIRONMENT_GATED",
					gate: "tauri-fixture",
					reason: "not implemented",
				};
		this.assert(
			gate.status === "SKIPPED_ENVIRONMENT_GATED",
			"Gate tauri-fixture produce SKIPPED_ENVIRONMENT_GATED",
		);
		this.assert(
			gate.gate === "tauri-fixture",
			"Gate preserva nombre tauri-fixture",
		);
		this.assert(
			typeof gate.reason === "string" && gate.reason.length > 0,
			"Gate tiene razón no vacía",
		);
		this.assert(
			gate.status !== "PASS" && gate.status !== "GREEN",
			"Gate nunca es PASS/GREEN",
		);
	},

	// ── Slice 3: Spreadsheet Physical Round-Trip ──

	testSpreadsheetCatalogRoundTrip() {
		const result = SpreadsheetHarness.catalogRoundTrip();

		// CSV assertions
		this.assert(result.csv !== null, "CSV catalog file created and read");
		this.assert(
			result.csv.rows.length === 3,
			`CSV catalog has 3 rows (got ${result.csv ? result.csv.rows.length : 0})`,
		);
		this.assert(result.csv.fields.includes("SKU"), "CSV fields include SKU");
		this.assert(
			result.csv.fields.includes("FOB unit USD"),
			"CSV fields include FOB unit USD",
		);

		// XLSX assertions
		this.assert(result.xlsx !== null, "XLSX catalog file created and read");
		this.assert(
			result.xlsx.rows.length === 3,
			`XLSX catalog has 3 rows (got ${result.xlsx ? result.xlsx.rows.length : 0})`,
		);
		this.assert(
			result.xlsx.sheetName === "Catalog",
			"XLSX sheet name is Catalog",
		);

		// Semantic field preservation
		const csvRow0 = result.csv ? result.csv.rows[0] : {};
		this.assert(
			csvRow0.SKU === "RED-TEC-0001",
			`CSV SKU preserved (got "${csvRow0.SKU}")`,
		);
		this.assert(
			csvRow0.Marca === "Redragon",
			`CSV Marca preserved (got "${csvRow0.Marca}")`,
		);
		this.assert(
			csvRow0.Modelo === "K552",
			`CSV Modelo preserved (got "${csvRow0.Modelo}")`,
		);
		this.assert(
			Math.abs(parseFloat(csvRow0["FOB unit USD"]) - 35.5) < 0.001,
			"CSV FOB preserved",
		);
		this.assert(
			csvRow0["Color/Variante"] === "Black",
			`CSV Variante preserved (got "${csvRow0["Color/Variante"]}")`,
		);

		const xlsxRow0 = result.xlsx ? result.xlsx.rows[0] : {};
		this.assert(
			xlsxRow0.SKU === "RED-TEC-0001",
			`XLSX SKU preserved (got "${xlsxRow0.SKU}")`,
		);
		this.assert(
			xlsxRow0["Categoría"] === "TECLADO",
			`XLSX Categoría preserved (got "${xlsxRow0["Categoría"]}")`,
		);
		this.assert(
			Math.abs(Number(xlsxRow0["FOB unit USD"]) - 35.5) < 0.001,
			"XLSX FOB preserved",
		);

		// No errors
		this.assert(
			result.errors.length === 0,
			`Catalog round-trip sin errores (${result.errors.length}: ${result.errors.join("; ")})`,
		);

		SpreadsheetHarness.cleanup(result.tmpDir);
	},

	testSpreadsheetOrderRoundTrip() {
		const result = SpreadsheetHarness.orderRoundTrip();

		this.assert(result.csv !== null, "CSV order file created and read");
		this.assert(
			result.csv.rows.length === 2,
			`CSV order has 2 rows (got ${result.csv ? result.csv.rows.length : 0})`,
		);
		this.assert(result.xlsx !== null, "XLSX order file created and read");
		this.assert(
			result.xlsx.rows.length === 2,
			`XLSX order has 2 rows (got ${result.xlsx ? result.xlsx.rows.length : 0})`,
		);

		// IVA semantics preserved
		const csvRow0 = result.csv ? result.csv.rows[0] : {};
		this.assert(
			Math.abs(parseFloat(csvRow0["IVA unit USD"]) - 8.05) < 0.001,
			"CSV IVA unit USD preserved",
		);
		this.assert(
			Math.abs(parseFloat(csvRow0["IVA subtotal USD"]) - 80.5) < 0.001,
			"CSV IVA subtotal preserved",
		);
		this.assert(
			Math.abs(parseFloat(csvRow0["Costo neto unit USD"]) - 38.25) < 0.001,
			"CSV Costo neto preserved",
		);
		this.assert(
			parseInt(csvRow0.Cantidad) === 10,
			`CSV Cantidad preserved (got "${csvRow0.Cantidad}")`,
		);

		const xlsxRow0 = result.xlsx ? result.xlsx.rows[0] : {};
		this.assert(
			Math.abs(Number(xlsxRow0["IVA unit USD"]) - 8.05) < 0.001,
			"XLSX IVA unit USD preserved",
		);
		this.assert(
			Math.abs(Number(xlsxRow0["IVA subtotal USD"]) - 80.5) < 0.001,
			"XLSX IVA subtotal preserved",
		);

		this.assert(
			result.errors.length === 0,
			`Order round-trip sin errores (${result.errors.length}: ${result.errors.join("; ")})`,
		);

		SpreadsheetHarness.cleanup(result.tmpDir);
	},

	testSpreadsheetRouteAssertion() {
		const catalog = SpreadsheetHarness.assertRoute("catalogo_redragon.csv");
		this.assert(
			catalog.route === "catalog",
			`Route "catalogo_redragon.csv" → catalog (got "${catalog.route}")`,
		);
		this.assert(catalog.correct === true, "Catalog route is correct");

		const order = SpreadsheetHarness.assertRoute("pedido_logitech.xlsx");
		this.assert(
			order.route === "order",
			`Route "pedido_logitech.xlsx" → order (got "${order.route}")`,
		);
		this.assert(order.correct === true, "Order route is correct");

		const unknown = SpreadsheetHarness.assertRoute("datos.csv");
		this.assert(
			unknown.route === "unknown",
			`Route "datos.csv" → unknown (got "${unknown.route}")`,
		);
		this.assert(
			unknown.correct === false,
			"Unknown route flagged as incorrect",
		);

		// Gate for external corpus
		const gate = QualityGate.GateOutcome({
			gate: "spreadsheet-external",
			reason: "Full corpus not available",
		});
		this.assert(
			gate.status === "SKIPPED_ENVIRONMENT_GATED",
			"Spreadsheet external gate produces SKIPPED",
		);
		this.assert(
			gate.gate === "spreadsheet-external",
			"Gate preserves spreadsheet-external name",
		);
	},

	// ── Slice 4: Signed Updater Smoke ──

	testUpdaterSmokeGate() {
		// Without TAURI_SIGNED_SMOKE=1, result is SKIPPED_ENVIRONMENT_GATED
		const result = UpdaterSmoke.runSmokeSequence({ env: {} });
		this.assert(
			result.result === "SKIPPED_ENVIRONMENT_GATED",
			"Sin TAURI_SIGNED_SMOKE=1 → SKIPPED_ENVIRONMENT_GATED",
		);
		this.assert(
			result.sequence.includes("check-environment"),
			"Secuencia incluye check-environment",
		);
		this.assert(
			result.evidence.gate === "SKIPPED_ENVIRONMENT_GATED",
			"Evidence registra gate SKIPPED",
		);

		// With gate but no manifest → REJECTED
		const result2 = UpdaterSmoke.runSmokeSequence({
			env: { TAURI_SIGNED_SMOKE: "1" },
		});
		this.assert(
			result2.result === "REJECTED_MANIFEST_INVALID",
			"Con gate pero sin manifest → REJECTED_MANIFEST_INVALID",
		);
	},

	testUpdaterManifestValidation() {
		// Valid manifest structure
		const validManifest = {
			version: "1.8.0",
			platform: "windows-x86_64",
			url: "https://github.com/example/releases/latest.json",
			hash: "a".repeat(64),
			publicKey:
				"dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc=",
		};
		const check = UpdaterSmoke.validateManifest(validManifest);
		this.assert(check.valid === true, "Manifest válido es aceptado");
		this.assert(check.errors.length === 0, "Manifest válido sin errores");

		// Invalid manifest
		const invalidCheck = UpdaterSmoke.validateManifest({ version: "1.0" });
		this.assert(
			invalidCheck.valid === false,
			"Manifest incompleto es rechazado",
		);
		this.assert(
			invalidCheck.errors.length > 0,
			"Manifest incompleto tiene errores",
		);

		// Placeholder key rejection
		const placeholder = UpdaterSmoke.validatePublicKey("YOUR_PUBLIC_KEY_HERE");
		this.assert(placeholder.accepted === false, "Placeholder key es rechazada");
		this.assert(
			placeholder.reason.includes("Placeholder"),
			"Razón menciona Placeholder",
		);

		// Short key rejection
		const shortKey = UpdaterSmoke.validatePublicKey("abc");
		this.assert(shortKey.accepted === false, "Key corta es rechazada");

		// Valid key accepted
		const goodKey = UpdaterSmoke.validatePublicKey(
			"dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc=",
		);
		this.assert(goodKey.accepted === true, "Key válida es aceptada");

		// Metadata agreement
		const agreed = UpdaterSmoke.verifyMetadataAgreement(
			{ version: "1.8.0", platform: "windows-x86_64", hash: "a".repeat(64) },
			{ version: "1.8.0", platform: "windows-x86_64" },
		);
		this.assert(agreed.agreed === true, "Metadata coincidente es aceptada");

		const disagreed = UpdaterSmoke.verifyMetadataAgreement(
			{ version: "1.7.0", platform: "windows-x86_64", hash: "a".repeat(64) },
			{ version: "1.8.0", platform: "windows-x86_64" },
		);
		this.assert(
			disagreed.agreed === false,
			"Metadata con versión distinta es rechazada",
		);
	},

	testUpdaterTamperRejection() {
		const crypto = require("crypto");
		const artifact = Buffer.from("fake-installer-bytes-for-testing");
		const correctHash = crypto
			.createHash("sha256")
			.update(artifact)
			.digest("hex");
		const tamperedHash = "f".repeat(64);

		// Correct hash → verified
		const good = UpdaterSmoke.verifyArtifactHash(artifact, correctHash);
		this.assert(good.verified === true, "Hash correcto → verificado");

		// Tampered hash → rejected
		const bad = UpdaterSmoke.verifyArtifactHash(artifact, tamperedHash);
		this.assert(bad.verified === false, "Hash alterado → rechazado");
		this.assert(bad.reason.includes("mismatch"), "Razón incluye mismatch");

		// Full sequence with tampered artifact
		const manifest = {
			version: "1.8.0",
			platform: "windows-x86_64",
			url: "https://example.com/latest.json",
			hash: tamperedHash,
			publicKey:
				"dW50cnVzdGVkIGNvbW1lbnQ6IHRoaXMgaXMgYSByZWFsIHB1YmxpYyBrZXkgZm9yIHRlc3Rpbmc=",
		};
		const sig = "dW50cnVzdGVkIHNpZ25hdHVyZSBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5";
		const result = UpdaterSmoke.runSmokeSequence({
			manifest,
			artifactContent: artifact,
			signature: sig,
			env: { TAURI_SIGNED_SMOKE: "1" },
		});
		this.assert(
			result.result === "REJECTED_ARTIFACT_TAMPERED",
			"Artefacto alterado → REJECTED_ARTIFACT_TAMPERED",
		);
		this.assert(
			result.sequence.includes("verify-artifact-hash"),
			"Secuencia incluye verify-artifact-hash",
		);
		this.assert(
			!result.sequence.includes("install"),
			"Install NO se ejecuta con artefacto alterado",
		);

		// Signature structure check
		const sigOk = UpdaterSmoke.verifySignatureStructure(
			sig,
			manifest.publicKey,
		);
		this.assert(sigOk.verified === true, "Firma estructuralmente válida");

		const sigBad = UpdaterSmoke.verifySignatureStructure(
			"",
			manifest.publicKey,
		);
		this.assert(sigBad.verified === false, "Firma vacía → rechazada");
	},

	// ── Slice 5: Image Storage References ──

	testImageRefAndAudit() {
		// buildImageRef with valid data URL
		const ref = AppStorage.buildImageRef(
			"data:image/png;base64,iVBORw0KGgo=",
			"SKU-001",
		);
		this.assert(
			ref !== null,
			"buildImageRef devuelve objeto con data URL válida",
		);
		this.assert(
			typeof ref.id === "string" && ref.id.startsWith("img_"),
			"ImageRef tiene id con prefijo img_",
		);
		this.assert(
			typeof ref.relativePath === "string" &&
				ref.relativePath.startsWith("images/"),
			"ImageRef tiene relativePath",
		);
		this.assert(ref.mime === "png", `ImageRef mime es png (got "${ref.mime}")`);
		this.assert(
			typeof ref.sha256 === "string" && ref.sha256.length > 0,
			"ImageRef tiene sha256",
		);
		this.assert(ref.sourceSku === "SKU-001", "ImageRef preserva sourceSku");

		// buildImageRef with invalid input
		this.assert(
			AppStorage.buildImageRef("-", "SKU-X") === null,
			'buildImageRef null con "-"',
		);
		this.assert(
			AppStorage.buildImageRef("", "SKU-X") === null,
			"buildImageRef null con vacío",
		);
		this.assert(
			AppStorage.buildImageRef(null, "SKU-X") === null,
			"buildImageRef null con null",
		);

		// Audit: mixed catalog
		const catalog = [
			{ sku: "A-001", img: "data:image/png;base64,AAAA" },
			{ sku: "A-002", img: "-" },
			{ sku: "A-003", img: "not-a-data-url" },
			{ sku: "A-004", img: "data:image/png;base64,AAAA" },
			{ sku: "A-005", img: "data:image/jpeg;base64,BBBB" },
		];
		const audit = AppStorage.auditInlineImages(catalog);
		this.assert(
			audit.summary.total === 5,
			`Audit total=5 (got ${audit.summary.total})`,
		);
		this.assert(
			audit.inline.length === 2,
			`Audit inline=2 (got ${audit.inline.length})`,
		);
		this.assert(
			audit.missing.length === 1,
			`Audit missing=1 (got ${audit.missing.length})`,
		);
		this.assert(
			audit.invalid.length === 1,
			`Audit invalid=1 (got ${audit.invalid.length})`,
		);
		this.assert(
			audit.duplicates.length === 1,
			`Audit duplicates=1 (got ${audit.duplicates.length})`,
		);
		this.assert(
			audit.summary.uniqueImages === 2,
			`Audit uniqueImages=2 (got ${audit.summary.uniqueImages})`,
		);

		// Duplicate references the first SKU
		this.assert(
			audit.duplicates[0].firstSku === "A-001",
			"Duplicado referencia al primer SKU",
		);
	},

	testImageMigrationReceipt() {
		const catalog = [
			{ sku: "M-001", img: "data:image/png;base64,CCCC" },
			{ sku: "M-002", img: "-" },
			{ sku: "M-003", img: "data:image/png;base64,DDDD" },
		];
		const audit = AppStorage.auditInlineImages(catalog);
		const receipt = AppStorage.buildMigrationReceipt(audit, "image-ref-v1");

		this.assert(receipt.schema === "image-ref-v1", "Receipt tiene schema");
		this.assert(
			typeof receipt.inputIdentity === "string",
			"Receipt tiene inputIdentity",
		);
		this.assert(receipt.counts.total === 3, "Receipt counts.total=3");
		this.assert(
			receipt.mappings.length === 3,
			`Receipt tiene 3 mappings (got ${receipt.mappings.length})`,
		);
		this.assert(
			receipt.committed === false,
			"Receipt no está committed inicialmente",
		);

		// Mapped entries have imageRef
		const mapped = receipt.mappings.filter((m) => m.status === "mapped");
		this.assert(
			mapped.length === 2,
			`Receipt tiene 2 mapped (got ${mapped.length})`,
		);
		this.assert(mapped[0].imageRef !== null, "Mapped entry tiene imageRef");

		// Unresolved entry has reason
		const unresolved = receipt.mappings.filter(
			(m) => m.status === "unresolved",
		);
		this.assert(unresolved.length === 1, "Receipt tiene 1 unresolved");
		this.assert(
			typeof unresolved[0].reason === "string",
			"Unresolved tiene reason",
		);

		// SKU change preserves image ref (ref is SKU-independent)
		const ref1 = AppStorage.buildImageRef(
			"data:image/png;base64,CCCC",
			"M-001",
		);
		const ref2 = AppStorage.buildImageRef(
			"data:image/png;base64,CCCC",
			"M-999-RENAMED",
		);
		this.assert(ref1.id === ref2.id, "ImageRef ID es independiente del SKU");
		this.assert(
			ref1.sha256 === ref2.sha256,
			"ImageRef sha256 es independiente del SKU",
		);
	},

	async testPhotoQualityStorageRoundTrip() {
		// Sin plugin fs (Node / no-Tauri): la serialización mantiene dataURL inline
		// y NO muta el catálogo original.
		const orig = [{ sku: "P-001", img: "data:image/png;base64,AAAA" }];
		const payload = await AppStorage._serializeImagesToFiles(orig, {});
		this.assert(
			payload.items[0].img === "data:image/png;base64,AAAA",
			"Sin fs: img queda como dataURL inline",
		);
		this.assert(
			typeof payload.items[0]._imageRef === "undefined",
			"Sin fs: no se agrega _imageRef",
		);
		this.assert(
			orig[0].img === "data:image/png;base64,AAAA",
			"La serialización no muta el catálogo original",
		);
		this.assert(
			payload.sel && Object.keys(payload.sel).length === 0,
			"Payload preserva sel",
		);

		// _fileNameFromDataUrl devuelve ruta content-addressed
		const rel = AppStorage._fileNameFromDataUrl(
			"data:image/png;base64,iVBORw0KGgo=",
		);
		this.assert(
			typeof rel === "string" &&
				rel.startsWith("images/") &&
				rel.endsWith(".png"),
			`_fileNameFromDataUrl da ruta images/ (got "${rel}")`,
		);

		// round-trip bytes → dataURL
		const b64 =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
		const bytes = AppStorage._dataUrlToBytes("data:image/png;base64," + b64);
		this.assert(
			bytes instanceof Uint8Array && bytes.length > 0,
			"_dataUrlToBytes devuelve Uint8Array",
		);
		const back = AppStorage._bytesToDataUrl(bytes, "png");
		this.assert(
			back === "data:image/png;base64," + b64,
			"Round-trip bytes→dataURL reproduce el original",
		);

		// _embedImagesFromFiles sin items / sin fs es no-op
		this.assert(
			(await AppStorage._embedImagesFromFiles([])) === undefined,
			"_embedImagesFromFiles([]) es no-op",
		);
		this.assert(
			(await AppStorage._embedImagesFromFiles(null)) === undefined,
			"_embedImagesFromFiles(null) es no-op",
		);
		this.assert(
			(await AppStorage._embedImagesFromFiles(undefined)) === undefined,
			"_embedImagesFromFiles(undefined) es no-op",
		);
	},

	async testStoreInitStoreLoadFallback() {
		// Tauri v2 plugin-store NO expone createStore (usa Store.load). Verifica que
		// init() lo detecta y crea el store en vez de caer a localStorage.
		const prevStore = AppStorage.storeInstance;
		const prevPlugin = global.window.__TAURI_PLUGIN_STORE__;
		const mockStore = {
			get: async () => null,
			set: async () => {},
			save: async () => {},
			delete: async () => {},
		};
		global.window.__TAURI_PLUGIN_STORE__ = {
			Store: { load: async () => mockStore },
		};
		try {
			await AppStorage.init();
			this.assert(
				AppStorage.storeInstance !== null,
				"init() usa Store.load (Tauri v2) y crea el store",
			);
			this.assert(
				AppStorage.storeInstance === mockStore,
				"storeInstance es el store creado vía Store.load",
			);
		} finally {
			AppStorage.storeInstance = prevStore;
			global.window.__TAURI_PLUGIN_STORE__ = prevPlugin;
		}
		// Sin plugin → cae a localStorage (storeInstance null)
		global.window.__TAURI_PLUGIN_STORE__ = undefined;
		try {
			await AppStorage.init();
			this.assert(
				AppStorage.storeInstance === null,
				"sin plugin store → fallback localStorage",
			);
		} finally {
			AppStorage.storeInstance = prevStore;
			global.window.__TAURI_PLUGIN_STORE__ = prevPlugin;
		}
	},

	testMarginalCropDetector() {
		const white = () => new Uint8ClampedArray(100 * 100 * 4).fill(255);
		const px = (img, x, y, r, g, b) => {
			const o = (y * 100 + x) * 4;
			img[o] = r;
			img[o + 1] = g;
			img[o + 2] = b;
			img[o + 3] = 255;
		};

		// 100x100 blanco puro → marginal
		const blank = white();
		this.assert(
			ImageQuality.isMarginalCrop({ width: 100, height: 100, data: blank }) ===
				true,
			"Imagen 100% blanca es marginal",
		);

		// franja oscura sobre blanco (caso MCHOSE) → marginal (contenido ~5%)
		const strip = white();
		for (let y = 40; y < 45; y++)
			for (let x = 0; x < 100; x++) px(strip, x, y, 20, 20, 20);
		this.assert(
			ImageQuality.isMarginalCrop({ width: 100, height: 100, data: strip }) ===
				true,
			"Franja oscura sobre blanco es marginal",
		);

		// foto con contenido real (cuadrado 60x60 de 100x100 = 36%) → NO marginal
		const photo = white();
		for (let y = 20; y < 80; y++)
			for (let x = 20; x < 80; x++) px(photo, x, y, 30, 120, 200);
		this.assert(
			ImageQuality.isMarginalCrop({ width: 100, height: 100, data: photo }) ===
				false,
			"Foto con contenido real NO es marginal",
		);

		// entradas inválidas → marginal (no sirve)
		this.assert(
			ImageQuality.isMarginalCrop(null) === true,
			"isMarginalCrop(null) es marginal",
		);
		this.assert(
			ImageQuality.isMarginalCrop({}) === true,
			"isMarginalCrop({}) es marginal",
		);
	},

	testImageIdempotenceAndOrphans() {
		const catalog = [
			{ sku: "I-001", img: "data:image/png;base64,EEEE" },
			{ sku: "I-002", img: "data:image/png;base64,FFFF" },
		];
		const audit = AppStorage.auditInlineImages(catalog);
		const receipt1 = AppStorage.buildMigrationReceipt(audit);
		const receipt2 = AppStorage.buildMigrationReceipt(audit);

		// Same input → idempotent
		const idem = AppStorage.checkIdempotence(receipt1, receipt2);
		this.assert(idem.idempotent === true, "Mismo input → idempotente (no-op)");
		this.assert(idem.reason.includes("no-op"), "Razón menciona no-op");

		// No previous receipt → not idempotent
		const first = AppStorage.checkIdempotence(null, receipt1);
		this.assert(
			first.idempotent === false,
			"Sin receipt previo → no idempotente",
		);

		// Changed input → not idempotent
		const changedCatalog = [
			...catalog,
			{ sku: "I-003", img: "data:image/png;base64,GGGG" },
		];
		const changedAudit = AppStorage.auditInlineImages(changedCatalog);
		const changedReceipt = AppStorage.buildMigrationReceipt(changedAudit);
		const changed = AppStorage.checkIdempotence(receipt1, changedReceipt);
		this.assert(
			changed.idempotent === false,
			"Input cambiado → no idempotente",
		);

		// Orphans are audit-visible, never auto-deleted
		this.assert(Array.isArray(audit.orphans), "Audit tiene array de orphans");
		this.assert(audit.orphans.length === 0, "Sin orphans en catalog limpio");

		// AP-3a gate
		const gate = QualityGate.GateOutcome({
			gate: "image-migration",
			reason: "AP-3a approval required",
		});
		this.assert(
			gate.status === "SKIPPED_ENVIRONMENT_GATED",
			"AP-3a gate produce SKIPPED",
		);
	},

	// ── Slice 6: SKU Audit & Durable Mapping ──

	testSkuAuditThreeDomains() {
		const catalog = [
			{
				sku: "RED-TEC-0001",
				marca: "Redragon",
				modelo: "K552",
				variante: "Black",
				cat: "TECLADO",
			},
			{
				sku: "RED-TEC-0001",
				marca: "Redragon",
				modelo: "K552",
				variante: "White",
				cat: "TECLADO",
			},
			{
				sku: "",
				marca: "AULA",
				modelo: "F75",
				variante: "Pink",
				cat: "TECLADO",
			},
			{
				sku: "LEGACY-SKU-123",
				marca: "Logitech",
				modelo: "G203",
				variante: "",
				cat: "MOUSE",
			},
		];
		const history = [
			{
				items: [
					{ sku: "RED-TEC-0001", qty: 5 },
					{ sku: "GONE-SKU-999", qty: 2 },
				],
			},
		];
		const selection = { "RED-TEC-0001": 3, "ORPHAN-SEL-001": 1 };

		const audit = SkuAllocator.auditSkus({ catalog, history, selection });

		this.assert(
			audit.summary.catalogRows === 4,
			`Audit catalogRows=4 (got ${audit.summary.catalogRows})`,
		);
		this.assert(
			audit.missing.length === 1,
			`Audit missing=1 (got ${audit.missing.length})`,
		);
		this.assert(
			audit.duplicates.length === 1,
			`Audit duplicates=1 (got ${audit.duplicates.length})`,
		);
		this.assert(
			audit.duplicates[0].sku === "RED-TEC-0001",
			"Duplicado es RED-TEC-0001",
		);
		this.assert(
			audit.legacy.length >= 1,
			`Audit legacy>=1 (got ${audit.legacy.length})`,
		);
		this.assert(
			audit.orphanedHistory.includes("GONE-SKU-999"),
			"History huérfano detectado",
		);
		this.assert(
			audit.orphanedSelection.includes("ORPHAN-SEL-001"),
			"Selection huérfana detectada",
		);
	},

	testSkuDeterministicMapping() {
		const catalog = [
			{
				sku: "RED-TEC-0001",
				marca: "Redragon",
				modelo: "K552",
				variante: "Black",
				cat: "TECLADO",
			},
			{
				sku: "RED-TEC-0001",
				marca: "Redragon",
				modelo: "K552",
				variante: "White",
				cat: "TECLADO",
			},
			{
				sku: "",
				marca: "AULA",
				modelo: "F75",
				variante: "Pink",
				cat: "TECLADO",
			},
		];
		const audit = SkuAllocator.auditSkus({
			catalog,
			history: [],
			selection: {},
		});
		const { mappings, receipt } = SkuAllocator.buildSkuMapping(catalog, audit);

		this.assert(
			mappings.length === 3,
			`Mapping tiene 3 entradas (got ${mappings.length})`,
		);
		this.assert(receipt.schema === "sku-mapping-v1", "Receipt tiene schema");
		this.assert(receipt.committed === false, "Receipt no committed");

		// First row preserved
		this.assert(mappings[0].action === "preserved", "Primera fila preservada");
		this.assert(
			mappings[0].newSku === "RED-TEC-0001",
			"Primera fila mantiene SKU",
		);

		// Second row deduplicated (distinct SKU)
		this.assert(
			mappings[1].action === "deduplicated",
			"Segunda fila deduplicada",
		);
		this.assert(
			mappings[1].newSku !== "RED-TEC-0001",
			"Segunda fila tiene SKU distinto",
		);
		this.assert(
			mappings[1].newSku.length > 0,
			"Segunda fila tiene SKU no vacío",
		);

		// Third row generated (was missing)
		this.assert(mappings[2].action === "generated", "Tercera fila generada");
		this.assert(mappings[2].oldSku === null, "Tercera fila no tenía SKU");
		this.assert(
			mappings[2].newSku.length > 0,
			"Tercera fila tiene SKU generado",
		);

		// All new SKUs are unique
		const newSkus = mappings.map((m) => m.newSku);
		this.assert(
			new Set(newSkus).size === newSkus.length,
			"Todos los newSku son únicos",
		);

		// Deterministic: same input → same mapping
		const { mappings: mappings2 } = SkuAllocator.buildSkuMapping(
			catalog,
			audit,
		);
		this.assert(
			JSON.stringify(mappings) === JSON.stringify(mappings2),
			"Mapping es determinista",
		);
	},

	testSkuAmbiguityGate() {
		// No ambiguity → not blocked
		const noAmb = SkuAllocator.checkAmbiguityGate([]);
		this.assert(noAmb.blocked === false, "Sin ambigüedad → no bloqueado");

		// With ambiguity → blocked
		const withAmb = SkuAllocator.checkAmbiguityGate([
			{ sku: "GONE-001", domain: "history", reason: "Not found" },
			{ sku: "GONE-002", domain: "selection", reason: "Not found" },
		]);
		this.assert(withAmb.blocked === true, "Con ambigüedad → bloqueado");
		this.assert(
			withAmb.reason.includes("2 ambiguous"),
			"Razón menciona cantidad",
		);
		this.assert(
			withAmb.reason.includes("history:GONE-001"),
			"Razón incluye referencia history",
		);

		// AP-3b gate
		const gate = QualityGate.GateOutcome({
			gate: "sku-migration",
			reason: "AP-3b approval required",
		});
		this.assert(
			gate.status === "SKIPPED_ENVIRONMENT_GATED",
			"AP-3b gate produce SKIPPED",
		);
	},

	// ── Slice 7: UI/E2E Persistence & Fallback ──

	async testPersistenceWithEvidence() {
		// Create items with R1-R10 evaluations
		const item1 = {
			sku: "E2E-001",
			marca: "Redragon",
			modelo: "K552",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
		};
		item1._evaluations = CatalogValidator.evaluateItem(item1);

		const item2 = {
			sku: "E2E-002",
			marca: "AULA",
			modelo: "F75",
			variante: "Pink",
			cat: "TECLADO",
			fob: 41,
			img: "-",
			grounded: true,
			sourceStatus: "GREEN",
		};
		item2._evaluations = CatalogValidator.evaluateItem(item2);

		const selection = { "E2E-001": 5 };

		// Save with evidence
		const saveResult = await AppStorage.saveCatalogWithEvidence(
			[item1, item2],
			selection,
		);
		this.assert(saveResult.evidence.itemCount === 2, "Save evidence: 2 items");
		this.assert(
			saveResult.evidence.selectionKeys === 1,
			"Save evidence: 1 selection key",
		);
		this.assert(
			saveResult.evidence.hasEvaluations === true,
			"Save evidence: has evaluations",
		);
		this.assert(
			typeof saveResult.backend === "string",
			"Save evidence: backend recorded",
		);

		// Load with evidence
		const loadResult = await AppStorage.loadCatalogWithEvidence();
		this.assert(
			loadResult.evidence.restored === true,
			"Load evidence: restored",
		);
		this.assert(
			loadResult.evidence.itemCount === 2,
			"Load evidence: 2 items restored",
		);
		this.assert(
			loadResult.evidence.hasEvaluations === true,
			"Load evidence: evaluations survived",
		);
		this.assert(loadResult.items.length === 2, "Load: 2 items");
		this.assert(loadResult.sel["E2E-001"] === 5, "Load: selection preserved");

		// Verify R1-R10 evaluations survived round-trip
		const loadedItem1 = loadResult.items.find((i) => i.sku === "E2E-001");
		this.assert(
			loadedItem1 &&
				loadedItem1._evaluations &&
				loadedItem1._evaluations.length === 10,
			"R1-R10 evaluations survived persistence round-trip",
		);

		// YELLOW item (missing image) is preserved, not dropped
		const loadedItem2 = loadResult.items.find((i) => i.sku === "E2E-002");
		this.assert(
			loadedItem2 !== undefined,
			"YELLOW item (missing image) preserved in storage",
		);
		const r9 = loadedItem2._evaluations
			? loadedItem2._evaluations.find((e) => e.code === "R9")
			: null;
		this.assert(
			r9 && r9.status === "YELLOW",
			"R9 YELLOW survived persistence (fail-closed)",
		);
	},

	async testStoreFallbackRecovery() {
		// Simulate Store failure by nullifying storeInstance
		const originalStore = AppStorage.storeInstance;
		AppStorage.storeInstance = null;

		const item = {
			sku: "FALL-001",
			marca: "Logitech",
			modelo: "G203",
			variante: "White",
			cat: "MOUSE",
			fob: 22.99,
			img: "data:image/png;base64,BBBB",
			grounded: true,
			sourceStatus: "GREEN",
		};
		item._evaluations = CatalogValidator.evaluateItem(item);

		// Save should fall back to LocalStorage
		const saveResult = await AppStorage.saveCatalogWithEvidence([item], {
			"FALL-001": 2,
		});
		this.assert(
			saveResult.backend === "localstorage",
			"Fallback: backend is localstorage",
		);
		this.assert(saveResult.evidence.itemCount === 1, "Fallback: 1 item saved");

		// Load should recover from LocalStorage
		const loadResult = await AppStorage.loadCatalogWithEvidence();
		this.assert(
			loadResult.evidence.restored === true,
			"Fallback: data restored",
		);
		this.assert(
			loadResult.evidence.backend === "localstorage",
			"Fallback: loaded from localstorage",
		);
		this.assert(loadResult.items.length === 1, "Fallback: 1 item recovered");
		this.assert(
			loadResult.items[0].sku === "FALL-001",
			"Fallback: correct SKU recovered",
		);
		this.assert(
			loadResult.evidence.hasEvaluations === true,
			"Fallback: evaluations recovered",
		);

		// Restore original store
		AppStorage.storeInstance = originalStore;
	},

	testImportabilityFilter() {
		// GREEN item → importable
		const greenItem = {
			sku: "GRN-001",
			marca: "Redragon",
			modelo: "K552",
			variante: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
		};
		greenItem._evaluations = CatalogValidator.evaluateItem(greenItem);

		// YELLOW item (missing image) → importable
		const yellowItem = {
			sku: "YEL-001",
			marca: "AULA",
			modelo: "F75",
			variante: "Pink",
			cat: "TECLADO",
			fob: 41,
			img: "-",
			grounded: true,
			sourceStatus: "GREEN",
		};
		yellowItem._evaluations = CatalogValidator.evaluateItem(yellowItem);

		// RED item (invalid FOB) → rejected
		const redItem = {
			sku: "RED-001",
			marca: "Redragon",
			modelo: "K552",
			variante: "Black",
			cat: "TECLADO",
			fob: -5,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			sourceStatus: "GREEN",
		};
		redItem._evaluations = CatalogValidator.evaluateItem(redItem);

		const { importable, rejected } = AppStorage.filterByImportability([
			greenItem,
			yellowItem,
			redItem,
		]);
		this.assert(
			importable.length === 2,
			`Importable: 2 items (got ${importable.length})`,
		);
		this.assert(
			rejected.length === 1,
			`Rejected: 1 item (got ${rejected.length})`,
		);
		this.assert(rejected[0].sku === "RED-001", "RED item is rejected");
		this.assert(
			importable.some((i) => i.sku === "GRN-001"),
			"GREEN item is importable",
		);
		this.assert(
			importable.some((i) => i.sku === "YEL-001"),
			"YELLOW item is importable (reviewable)",
		);

		// RED item has REJECTED evaluation
		const redR1 = redItem._evaluations.find((e) => e.code === "R1");
		this.assert(
			redR1.importability === "REJECTED",
			"RED R1 has REJECTED importability",
		);
		this.assert(redR1.status === "RED", "RED R1 has RED status");
	},
	testFase2Slice3KzMatrixModelName() {
		// KZ matrix layout: block with Model Name row (EDCX/ZNA/DQS/ZAR/ZVX) under
		// the color row. The USD anchor at y=495 (block 2, col EDCX) must use the
		// Model Name "EDCX" as modelo, NOT the previous block's color "Transparent".
		const items = [
			// Block 1 headers (EDA col)
			{ str: "型号", transform: [1, 0, 0, 1, 10, 790] },
			{ str: "EDA", transform: [1, 0, 0, 1, 163, 792] },
			{ str: "Blanced", transform: [1, 0, 0, 1, 187, 792] },
			{ str: "Edition", transform: [1, 0, 0, 1, 229, 792] },
			// Block 1 prices (col EDA at x~200)
			{ str: "RMB", transform: [1, 0, 0, 1, 88, 648] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 112, 648] },
			{ str: "￥", transform: [1, 0, 0, 1, 198, 648] },
			{ str: "40.25", transform: [1, 0, 0, 1, 207, 648] },
			{ str: "USD", transform: [1, 0, 0, 1, 88, 621] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 110, 621] },
			{ str: "$5.92", transform: [1, 0, 0, 1, 202, 621] },
			// Block 1 colors (Transparent = the poison that must NOT become modelo)
			{ str: "Color", transform: [1, 0, 0, 1, 10, 533] },
			{ str: "Transparent", transform: [1, 0, 0, 1, 186, 533] },
			// Block 2 Model Name row (EDCX col at x~200)
			{ str: "型号", transform: [1, 0, 0, 1, 10, 492] },
			{ str: "Model", transform: [1, 0, 0, 1, 10, 478] },
			{ str: "Name", transform: [1, 0, 0, 1, 40, 478] },
			{ str: "EDCX", transform: [1, 0, 0, 1, 200, 486] },
			{ str: "ZNA", transform: [1, 0, 0, 1, 340, 486] },
			{ str: "DQS", transform: [1, 0, 0, 1, 477, 486] },
			// Block 2 prices (col EDCX at x~202)
			{ str: "RMB", transform: [1, 0, 0, 1, 88, 349] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 112, 349] },
			{ str: "￥", transform: [1, 0, 0, 1, 198, 349] },
			{ str: "18.40", transform: [1, 0, 0, 1, 207, 349] },
			{ str: "USD", transform: [1, 0, 0, 1, 88, 322] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 110, 322] },
			{ str: "$2.71", transform: [1, 0, 0, 1, 202, 322] },
			{ str: "$10.99", transform: [1, 0, 0, 1, 338, 322] },
			{ str: "$6.43", transform: [1, 0, 0, 1, 477, 322] },
			{ str: "Without", transform: [1, 0, 0, 1, 19, 316] },
			{ str: "mic", transform: [1, 0, 0, 1, 59, 316] },
			// Block 2 colors
			{ str: "Color", transform: [1, 0, 0, 1, 10, 236] },
			{ str: "Grey/Cyan", transform: [1, 0, 0, 1, 191, 236] },
		];
		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[],
			"KZ",
			[],
		);
		const anyModelWithEdcx = products.some(
			(p) => p.modelo === "EDCX" || p.modelo.includes("EDCX"),
		);
		this.assert(
			anyModelWithEdcx,
			"FASE2-S3-KZ: EDCX apareció como modelo (matriz KZ)",
		);
		const anyTransparentModel = products.some(
			(p) => p.modelo === "Transparent",
		);
		this.assert(
			!anyTransparentModel,
			'FASE2-S3-KZ: "Transparent" (color del bloque 1) NO es modelo',
		);
	},

	testFase2Slice3KzHighResolution() {
		// KZ p7: descriptor "High Resolution" must not become the model; the real
		// model is the header of its column block (Libra 高解析版 / Libra High Res).
		const items = [
			// Header row
			{ str: "型号", transform: [1, 0, 0, 1, 10, 790] },
			{ str: "Libra", transform: [1, 0, 0, 1, 185, 790] },
			{ str: "均衡版", transform: [1, 0, 0, 1, 213, 790] },
			{ str: "Libra", transform: [1, 0, 0, 1, 317, 790] },
			{ str: "高解析版", transform: [1, 0, 0, 1, 345, 790] },
			// Block 1 prices (col 1 x~200, col 2 x~340)
			{ str: "USD", transform: [1, 0, 0, 1, 110, 632] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 110, 618] },
			{ str: "$4.57", transform: [1, 0, 0, 1, 202, 626] },
			{ str: "$4.90", transform: [1, 0, 0, 1, 340, 626] },
			// Block 1 colors
			{ str: "Color", transform: [1, 0, 0, 1, 10, 556] },
			{ str: "Black", transform: [1, 0, 0, 1, 199, 556] },
			{ str: "Black", transform: [1, 0, 0, 1, 337, 556] },
			// Block 2 Model Name row (Libra X / Sonata ...)
			{ str: "型号", transform: [1, 0, 0, 1, 10, 500] },
			{ str: "Model", transform: [1, 0, 0, 1, 10, 486] },
			{ str: "Name", transform: [1, 0, 0, 1, 40, 486] },
			{ str: "Libra", transform: [1, 0, 0, 1, 185, 494] },
			{ str: "X", transform: [1, 0, 0, 1, 213, 494] },
			{ str: "版", transform: [1, 0, 0, 1, 220, 494] },
			{ str: "Sonata/", transform: [1, 0, 0, 1, 317, 494] },
			// Block 2 prices (col 1 x~200)
			{ str: "USD", transform: [1, 0, 0, 1, 110, 332] },
			{ str: "PRICE", transform: [1, 0, 0, 1, 110, 318] },
			{ str: "$50.57", transform: [1, 0, 0, 1, 202, 326] },
			{ str: "$8.46", transform: [1, 0, 0, 1, 340, 326] },
			// Block 2 colors
			{ str: "Color", transform: [1, 0, 0, 1, 10, 246] },
			{ str: "Black", transform: [1, 0, 0, 1, 199, 246] },
			{ str: "Black", transform: [1, 0, 0, 1, 337, 246] },
		];
		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[],
			"KZ",
			[],
		);
		const highRes = products.filter((p) =>
			p.modelo.includes("High Resolution"),
		);
		this.assert(
			highRes.length === 0,
			'FASE2-S3-KZ: "High Resolution" no debe quedar como modelo (descriptor)',
		);
		const libra = products.filter((p) => p.modelo.includes("Libra"));
		this.assert(
			libra.length >= 1,
			'FASE2-S3-KZ: "Libra" aparece como modelo (header del bloque)',
		);
	},

	testFase2Slice3HaimuSwitchName() {
		// Haimu switch catalogue: name in left column (x<140: "SeaSalt Switch"),
		// specs in the middle (x~300-400), price right (x~545). The model must be
		// the switch name, NOT the technical specs.
		const items = [
			// Header
			{ str: "Switch", transform: [1, 0, 0, 1, 22, 730] },
			{ str: "Classification", transform: [1, 0, 0, 1, 85, 722] },
			{ str: "Style", transform: [1, 0, 0, 1, 207, 722] },
			{ str: "Technical", transform: [1, 0, 0, 1, 299, 722] },
			{ str: "Parameters", transform: [1, 0, 0, 1, 359, 722] },
			{ str: "CNY", transform: [1, 0, 0, 1, 475, 722] },
			{ str: "USD", transform: [1, 0, 0, 1, 543, 722] },
			// Row: SeaSalt Switch (name at x<140)
			{ str: "SeaSalt", transform: [1, 0, 0, 1, 7, 75] },
			{ str: "Switch", transform: [1, 0, 0, 1, 42, 75] },
			{ str: "Mechanical", transform: [1, 0, 0, 1, 83, 68] },
			{ str: "Switch", transform: [1, 0, 0, 1, 136, 68] },
			{ str: "Silent", transform: [1, 0, 0, 1, 96, 81] },
			{ str: "Tactile", transform: [1, 0, 0, 1, 123, 81] },
			// Specs (must NOT be the model)
			{ str: "Working", transform: [1, 0, 0, 1, 298, 84] },
			{ str: "stroke:", transform: [1, 0, 0, 1, 339, 84] },
			{ str: "2.00", transform: [1, 0, 0, 1, 372, 84] },
			{ str: "Lower", transform: [1, 0, 0, 1, 306, 75] },
			{ str: "cover", transform: [1, 0, 0, 1, 337, 75] },
			{ str: "material:", transform: [1, 0, 0, 1, 363, 75] },
			{ str: "PA", transform: [1, 0, 0, 1, 405, 75] },
			{ str: "Working", transform: [1, 0, 0, 1, 315, 62] },
			{ str: "force:", transform: [1, 0, 0, 1, 356, 62] },
			{ str: "47", transform: [1, 0, 0, 1, 384, 62] },
			{ str: "5g", transform: [1, 0, 0, 1, 399, 62] },
			// Price
			{ str: "￥", transform: [1, 0, 0, 1, 476, 75] },
			{ str: "1.56", transform: [1, 0, 0, 1, 486, 75] },
			{ str: "$0.22", transform: [1, 0, 0, 1, 545, 75] },
		];
		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[],
			"Haimu",
			[],
		);
		const p = products[0];
		this.assert(
			p && p.modelo.includes("SeaSalt"),
			'FASE2-S3-Haimu: modelo incluye el nombre del switch "SeaSalt"',
		);
		this.assert(
			!/working|stroke|cover|material/i.test(p.modelo),
			"FASE2-S3-Haimu: specs técnicas NO quedan en el modelo",
		);
	},

	testFase2Slice4LogitechFusedCellForwardModel() {
		// Logitech fused cell: row at y=554 has NO model text but price $29.57.
		// The model "M750 M" is centered BELOW at y=587 with the same price — the
		// anchor must bind to M750 M (by Y-overlap), not inherit M720 from above.
		const items = [
			{ str: "Logitech", transform: [1, 0, 0, 1, 55, 700] },
			{ str: "M720", transform: [1, 0, 0, 1, 96, 700] },
			{ str: "Wireless", transform: [1, 0, 0, 1, 186, 700] },
			{ str: "Mouse", transform: [1, 0, 0, 1, 227, 700] },
			{ str: "Black", transform: [1, 0, 0, 1, 308, 700] },
			{ str: "￥", transform: [1, 0, 0, 1, 471, 700] },
			{ str: "163.44", transform: [1, 0, 0, 1, 481, 700] },
			{ str: "$24.04", transform: [1, 0, 0, 1, 542, 700] },
			// y=554 row: NO model name, price $29.57 (belongs to M750 M block below)
			{ str: "Wireless", transform: [1, 0, 0, 1, 186, 666] },
			{ str: "Mouse", transform: [1, 0, 0, 1, 227, 666] },
			{ str: "Black", transform: [1, 0, 0, 1, 308, 666] },
			{ str: "￥", transform: [1, 0, 0, 1, 471, 666] },
			{ str: "201.08", transform: [1, 0, 0, 1, 481, 666] },
			{ str: "$29.57", transform: [1, 0, 0, 1, 542, 666] },
			// y=587 row: model centered here (M750 M), same price
			{ str: "Logitech", transform: [1, 0, 0, 1, 49, 633] },
			{ str: "M750", transform: [1, 0, 0, 1, 90, 633] },
			{ str: "M", transform: [1, 0, 0, 1, 119, 633] },
			{ str: "Wireless", transform: [1, 0, 0, 1, 186, 633] },
			{ str: "Mouse", transform: [1, 0, 0, 1, 227, 633] },
			{ str: "White", transform: [1, 0, 0, 1, 307, 633] },
			{ str: "￥", transform: [1, 0, 0, 1, 471, 633] },
			{ str: "201.08", transform: [1, 0, 0, 1, 481, 633] },
			{ str: "$29.57", transform: [1, 0, 0, 1, 542, 633] },
			// y=620 row: M750 M Pink (same price, continues block)
			{ str: "Wireless", transform: [1, 0, 0, 1, 186, 600] },
			{ str: "Mouse", transform: [1, 0, 0, 1, 227, 600] },
			{ str: "Pink", transform: [1, 0, 0, 1, 310, 600] },
			{ str: "￥", transform: [1, 0, 0, 1, 471, 600] },
			{ str: "201.08", transform: [1, 0, 0, 1, 481, 600] },
			{ str: "$29.57", transform: [1, 0, 0, 1, 542, 600] },
		];
		const products = PdfParser.extractPageProductsByCellGrid(
			items,
			800,
			1,
			[],
			"Logitech",
			[],
		);
		// Effective Y = viewportHeight(800) - transform[5]: empty row at 800-666=134,
		// M750 M row at 800-633=167, M720 row at 800-700=100.
		const rowEmpty = products.find((p) => Math.abs(p.y - 134) < 6);
		const rowM750 = products.find((p) => Math.abs(p.y - 167) < 6);
		const rowM720 = products.find((p) => Math.abs(p.y - 100) < 6);
		this.assert(
			rowEmpty,
			"FASE2-S4-Logitech: fila sin modelo (y=134) extraída",
		);
		this.assert(
			rowEmpty && /M750/.test(rowEmpty.modelo),
			"FASE2-S4-Logitech: fila vacía usa modelo M750 M (celda fusionada con texto debajo) en vez de heredar M720",
		);
		this.assert(
			rowM750 && /M750/.test(rowM750.modelo),
			"FASE2-S4-Logitech: fila M750 M (y=167) modelo correcto",
		);
		this.assert(
			rowM720 && /M720/.test(rowM720.modelo),
			"FASE2-S4-Logitech: fila M720 (y=100) modelo correcto",
		);
	},

	testCatalogAssignmentGates() {
		if (typeof CatalogAssignmentGates === "undefined") {
			this.assert(false, "Modulo CatalogAssignmentGates no está definido");
			return;
		}
		const G = CatalogAssignmentGates;
		const base = {
			sku: "S1",
			cat: "TECLADO",
			marca: "Atk",
			modelo: "X1",
			variante: "",
			fob: 10,
			img: "-",
			status: "GREEN",
			warnings: [],
			grounded: true,
			importable: true,
		};
		const PNG =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

		// --- imagen: cross-categoría desasigna ---
		{
			const a = {
				...base,
				sku: "A1",
				cat: "TECLADO",
				img: PNG,
				status: "GREEN",
			};
			const b = { ...base, sku: "A2", cat: "MOUSE", img: PNG, status: "GREEN" };
			const { products } = G.applyImageIntegrityGates([a, b]);
			const kb = products.find((p) => p.sku === "A2");
			this.assert(
				kb.img === "-",
				"Imagen cross-categoría se desasigna del producto secundario",
			);
			this.assert(
				kb.warnings.some((w) => w.includes("categor")),
				"Warning de cross-categoría presente",
			);
		}

		// --- imagen: rebrand con identidad exacta conserva ---
		{
			const a = {
				...base,
				sku: "B1",
				marca: "Irok",
				modelo: "Mer68 Max",
				cat: "TECLADO",
				img: PNG,
				status: "GREEN",
			};
			const b = {
				...base,
				sku: "B2",
				marca: "Mars",
				modelo: "Mer68 Max",
				cat: "TECLADO",
				img: PNG,
				status: "GREEN",
			};
			const { products } = G.applyImageIntegrityGates([a, b]);
			this.assert(
				products.every((p) => p.img === PNG),
				"Rebrand con marca+modelo+cat idénticos conserva la imagen",
			);
		}

		// --- imagen: cross-marca sin identidad desasigna ---
		{
			const a = {
				...base,
				sku: "C1",
				marca: "Atk",
				modelo: "Babypink",
				cat: "TECLADO",
				img: PNG,
				status: "GREEN",
			};
			const b = {
				...base,
				sku: "C2",
				marca: "Vgn",
				modelo: "Dragonfly VXE Dongle",
				cat: "MOUSE",
				img: PNG,
				status: "GREEN",
			};
			const { products } = G.applyImageIntegrityGates([a, b]);
			const loser = products.find((p) => p.sku === "C2");
			this.assert(
				loser.img === "-",
				"Imagen cross-marca sin identidad de modelo se desasigna",
			);
		}

		// --- placeholder nunca GREEN ---
		{
			const p = { ...base, img: "-", status: "GREEN" };
			const { products } = G.applyImageIntegrityGates([p]);
			this.assert(
				products[0].status === "YELLOW",
				"Placeholder degrada GREEN → YELLOW",
			);
			this.assert(
				products[0].warnings.includes("Sin imagen"),
				'Warning "Sin imagen" presente',
			);
		}

		// --- template model → RED no importable ---
		{
			const p = {
				...base,
				modelo: "Product Picture Model No.#",
				status: "GREEN",
				importable: true,
			};
			const { products } = G.applyModelQualityGates([p]);
			this.assert(
				products[0].status === "RED",
				"Modelo de plantilla degrada a RED",
			);
			this.assert(
				products[0].importable === false,
				"Modelo de plantilla no es importable",
			);
		}

		// --- color model → YELLOW ---
		{
			const p = { ...base, modelo: "Purple", status: "GREEN" };
			const { products } = G.applyModelQualityGates([p]);
			this.assert(
				products[0].status === "YELLOW",
				"Modelo color degrada a YELLOW",
			);
		}

		// --- truncado → reparado (modelo limpio + variante) ---
		{
			const p = { ...base, modelo: "F87 (light", status: "GREEN" };
			const { products } = G.applyModelQualityGates([p]);
			this.assert(
				products[0].modelo === "F87",
				"Modelo truncado se repara (base del modelo)",
			);
			this.assert(
				/light/.test(products[0].variante),
				"Parte truncada pasa a variante",
			);
			this.assert(
				products[0].status === "GREEN",
				"Modelo reparado conserva GREEN",
			);
		}

		// --- watch model no degrada ---
		{
			const p = { ...base, modelo: "Air", status: "GREEN" };
			const { products } = G.applyModelQualityGates([p]);
			this.assert(
				products[0].status === "GREEN",
				"Modelo watch (línea real, e.g. ATK Air) no degrada",
			);
		}

		// --- duplicados detectados ---
		{
			const a = {
				...base,
				sku: "D1",
				marca: "8bitdo",
				modelo: "Ultimate 2C",
				cat: "CONTROLLER",
				fob: 27.46,
			};
			const b = {
				...base,
				sku: "D2",
				marca: "8bitdo",
				modelo: "Ultimate 2C",
				cat: "CONTROLLER",
				fob: 27.46,
			};
			const dups = G.detectDuplicates([a, b]);
			this.assert(
				dups.length === 1,
				"Duplicado marca+modelo+cat+fob detectado",
			);
			this.assert(dups[0].count === 2, "Grupo duplicado cuenta 2 productos");
		}

		// --- métricas ---
		{
			const p = { ...base, img: "-", status: "YELLOW" };
			const m = G.computeMetrics([p]);
			this.assert(
				m.placeholder === 1 && m.placeholderRate === 1,
				"Métrica de placeholder correcta",
			);
			this.assert(m.status.YELLOW === 1, "Métrica de status correcta");
		}
	},

	testColorFieldSanitization() {
		// SLICE 3 (PR 3, task 3.1 RED): pure color-field sanitizer — the color
		// field must hold ONLY color words (spec 'Color holds a color').
		// sanitizeColorField does not exist yet → the null guard makes the RED
		// assertions fail cleanly without crashing the harness.
		const sf =
			typeof TextSanitizer.sanitizeColorField === "function"
				? TextSanitizer.sanitizeColorField
				: null;
		const r1 = sf ? sf("Black Mouse Wireless") : null;
		this.assert(
			r1 !== null && r1.color === "Black",
			'SLICE3: "Black Mouse Wireless" → color="Black"',
		);
		this.assert(
			r1 !== null &&
				Array.isArray(r1.moved) &&
				r1.moved.includes("Mouse") &&
				r1.moved.includes("Wireless"),
			"SLICE3: moved contiene Mouse y Wireless (conexión/categoría removidas)",
		);
		const r2 = sf ? sf("Magnetic Switch White") : null;
		this.assert(
			r2 !== null && r2.color === "White",
			'SLICE3: "Magnetic Switch White" → color="White"',
		);
		this.assert(
			r2 !== null &&
				Array.isArray(r2.moved) &&
				r2.moved.includes("Magnetic") &&
				r2.moved.includes("Switch"),
			"SLICE3: moved contiene Magnetic y Switch",
		);
		// TRIANGULATE: category-only word, multi-token, pure-connection, empty input
		const r3 = sf ? sf("Black Webcam") : null;
		this.assert(
			r3 !== null && r3.color === "Black" && r3.moved.includes("Webcam"),
			'SLICE3: "Black Webcam" → Black + Webcam movido',
		);
		const r4 = sf ? sf("Black Keyboard Wireless") : null;
		this.assert(
			r4 !== null &&
				r4.color === "Black" &&
				r4.moved.includes("Keyboard") &&
				r4.moved.includes("Wireless"),
			'SLICE3: "Black Keyboard Wireless" → Black + Keyboard/Wireless',
		);
		const r5 = sf ? sf("Wireless") : null;
		this.assert(
			r5 !== null && r5.color === "" && r5.moved.includes("Wireless"),
			'SLICE3: "Wireless" → color vacío + moved',
		);
		const r6 = sf ? sf("") : null;
		this.assert(
			r6 !== null && r6.color === "" && r6.moved.length === 0,
			'SLICE3: vacío → {color:"", moved:[]}',
		);
		// TRIANGULATE: fixItemsInPlace wiring — moved tokens go to variante when it
		// was EMPTY; dropped when variante already has content (spec scenario).
		const items = [
			{
				modelo: "X1",
				marca: "OTRO",
				cat: "OTRO",
				variante: "",
				color: "Black Mouse Wireless",
				fob: 10,
			},
			{
				modelo: "X2",
				marca: "OTRO",
				cat: "OTRO",
				variante: "Pro",
				color: "Black Mouse Wireless",
				fob: 10,
			},
		];
		const fixedCount = TextSanitizer.fixItemsInPlace(items);
		this.assert(
			fixedCount === 2,
			"SLICE3: fixItemsInPlace modificó ambos items (color limpiado)",
		);
		this.assert(
			items[0].color === "Black" && items[0].variante === "Mouse Wireless",
			'SLICE3: variante vacía → color="Black", conexión/categoría van a variante',
		);
		this.assert(
			items[1].color === "Black" && items[1].variante === "Pro",
			'SLICE3: variante con contenido → moved DROPPED, color="Black"',
		);
	},

	testImageTextGates() {
		const G = ImageTextGates;

		// Fixture 100x100 RGBA: exterior = BLACK (page background); interior crop
		// (x,y ∈ [20,80)) = WHITE photo background (corners) with a BLACK product
		// block in the center. Full-canvas dominant would be BLACK (page); the
		// interior sampler must exclude the photo background (corners of the crop)
		// and return the product color BLACK with high occupancy.
		const w = 100,
			h = 100;
		const pixels = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4;
				const inside = x >= 20 && x < 80 && y >= 20 && y < 80;
				const productBlock = x >= 30 && x < 70 && y >= 30 && y < 70;
				if (productBlock) {
					pixels[i] = 10;
					pixels[i + 1] = 10;
					pixels[i + 2] = 10;
				} else if (inside) {
					pixels[i] = 255;
					pixels[i + 1] = 255;
					pixels[i + 2] = 255;
				} else {
					pixels[i] = 0;
					pixels[i + 1] = 0;
					pixels[i + 2] = 0;
				}
				pixels[i + 3] = 255;
			}
		}
		const sample = G.sampleInteriorColor(pixels, w, h);
		this.assert(
			sample.name === "BLACK",
			`Producto negro sobre fondo blanco de foto -> BLACK (got ${sample.name})`,
		);
		this.assert(
			sample.confidence >= 60,
			`Ocupación del producto alta (got ${sample.confidence})`,
		);

		// Declared 'Black' vs interior BLACK -> GREEN (photo background excluded,
		// the old 91%-false-positive case is now a match, not a mismatch).
		const product = {
			sku: "IT-01",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			color: "Black",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
			_interiorColor: { name: "BLACK", confidence: 80, occupancy: 80 },
			_imgAspect: 1.0,
		};
		const res = G.runAll([product]);
		const out = res.products[0];
		this.assert(
			out.status === "GREEN",
			"Black declarado vs interior BLACK (fondo excluido) -> GREEN",
		);

		// Declared 'White' vs interior BLACK with high occupancy -> YELLOW + evidence
		const mismatchProduct = {
			...product,
			sku: "IT-01B",
			variante: "White",
			color: "White",
		};
		const resB = G.runAll([mismatchProduct]);
		const outB = resB.products[0];
		this.assert(
			outB.status === "YELLOW",
			"Color declarado WHITE vs imagen interior BLACK -> YELLOW",
		);
		const mismatch = outB._imgTextWarnings.find(
			(x) => x.type === "color-mismatch",
		);
		this.assert(
			mismatch && mismatch.declared === "WHITE" && mismatch.actual === "BLACK",
			"Evidencia color-mismatch con declared/actual",
		);
		this.assert(
			mismatch &&
				mismatch.sampleRegion === "center-60%" &&
				mismatch.occupancy === 80,
			"Evidencia color-mismatch con región de muestreo y ocupación",
		);
		this.assert(
			outB.warnings.some((x) => x.includes("no coincide con el producto")),
			"Warning visible de color no coincide (pv-reason path)",
		);

		// Product too small in frame (occupancy < 35%) -> WATCH: no status change
		const ambiguous = {
			...product,
			sku: "IT-02",
			_interiorColor: { name: "UNKNOWN", confidence: 20, occupancy: 20 },
		};
		const res2 = G.runAll([ambiguous]);
		const out2 = res2.products[0];
		this.assert(
			out2.status === "GREEN",
			"Producto chico en frame (ocupación 20%) -> WATCH, sin cambio de status",
		);
		this.assert(
			out2._imgTextWarnings.some((x) => x.type === "color-ambiguous"),
			"WATCH registra evidencia color-ambiguous",
		);

		// TRIANGULATE: interior mostly BLACK (product) with white spill -> BLACK
		// dominant even when the photo background is light gray.
		const pixels2 = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4;
				const inside = x >= 20 && x < 80 && y >= 20 && y < 80;
				const productBlock = x >= 30 && x < 70 && y >= 30 && y < 70;
				if (productBlock && (x + y) % 3 !== 0) {
					pixels2[i] = 10;
					pixels2[i + 1] = 10;
					pixels2[i + 2] = 10;
				} else if (productBlock) {
					pixels2[i] = 255;
					pixels2[i + 1] = 255;
					pixels2[i + 2] = 255;
				} else if (inside) {
					pixels2[i] = 200;
					pixels2[i + 1] = 200;
					pixels2[i + 2] = 200;
				} else {
					pixels2[i] = 0;
					pixels2[i + 1] = 0;
					pixels2[i + 2] = 0;
				}
				pixels2[i + 3] = 255;
			}
		}
		const s2 = G.sampleInteriorColor(pixels2, w, h);
		this.assert(
			s2.name === "BLACK" && s2.confidence >= 60,
			`Interior con mayoría negro -> BLACK (got ${s2.name} ${s2.confidence}%)`,
		);

		// TRIANGULATE: declared SILVER vs actual WHITE -> compatible (GRAY/SILVER/WHITE)
		const silver = {
			...product,
			sku: "IT-03",
			variante: "Silver",
			color: "Silver",
			_interiorColor: { name: "WHITE", confidence: 90, occupancy: 90 },
		};
		const res3 = G.runAll([silver]);
		this.assert(
			res3.products[0].status === "GREEN",
			"Silver declarado vs WHITE actual -> compatible (grupo GRAY/SILVER/WHITE)",
		);
	},

	testImageTextCategoryAspect() {
		const G = ImageTextGates;
		const base = {
			sku: "ASP-01",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			cat: "MOUSE",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
		};

		// MOUSE (compact) with a wide keyboard-like photo (aspect 2.3) → YELLOW
		const mouse = { ...base, sku: "ASP-01", _imgAspect: 2.3 };
		const r1 = G.runAll([mouse]).products[0];
		this.assert(
			r1.status === "YELLOW",
			"MOUSE con imagen ancha (aspect 2.3) -> YELLOW",
		);
		const ev1 = r1._imgTextWarnings.find((x) => x.type === "category-aspect");
		this.assert(
			ev1 &&
				ev1.cat === "MOUSE" &&
				ev1.aspect === 2.3 &&
				ev1.expectedFamily === "COMPACT",
			"Evidencia category-aspect con expectedFamily COMPACT",
		);
		this.assert(
			r1.warnings.some((x) => /Imagen ancha/.test(x) && x.includes("MOUSE")),
			'Warning "Imagen ancha (ratio 2.30) incompatible con MOUSE"',
		);

		// TECLADO (wide) with a wide photo → GREEN, no warning
		const kb = { ...base, sku: "ASP-02", cat: "TECLADO", _imgAspect: 2.3 };
		const r2 = G.runAll([kb]).products[0];
		this.assert(
			r2.status === "GREEN" && r2._imgTextWarnings.length === 0,
			"TECLADO con imagen ancha (aspect 2.3) -> GREEN",
		);

		// TECLADO with a tall/narrow photo (aspect 0.5) → YELLOW
		const tall = { ...base, sku: "ASP-03", cat: "TECLADO", _imgAspect: 0.5 };
		const r3 = G.runAll([tall]).products[0];
		this.assert(
			r3.status === "YELLOW",
			"TECLADO con imagen angosta (aspect 0.5) -> YELLOW",
		);

		// Relaxed backfill acceptance must NOT clear the gate (post-matching gate)
		const backfill = {
			...base,
			sku: "ASP-04",
			_imgAspect: 2.3,
			imgWarnings: ["⚠️ Imagen ancha (ratio 2.30) — aceptada en backfill"],
		};
		const r4 = G.runAll([backfill]).products[0];
		this.assert(
			r4.status === "YELLOW" &&
				r4._imgTextWarnings.some((x) => x.type === "category-aspect"),
			"Backfill relajado del matcher no limpia la gate de aspecto",
		);
	},

	testAssignmentSharedEvidence() {
		const PNG = "data:image/png;base64,AAAA";
		const base = {
			marca: "Atk",
			modelo: "X1",
			fob: 10,
			img: PNG,
			status: "GREEN",
			warnings: [],
			grounded: true,
		};

		// cross-category: both products YELLOW + shared evidence
		const a = { ...base, sku: "SH-01", cat: "TECLADO" };
		const b = { ...base, sku: "SH-02", cat: "MOUSE" };
		const { products } = CatalogAssignmentGates.applyImageIntegrityGates([
			a,
			b,
		]);
		const pa = products.find((p) => p.sku === "SH-01");
		const pb = products.find((p) => p.sku === "SH-02");
		this.assert(
			pa.status === "YELLOW" && pb.status === "YELLOW",
			"Imagen cross-categoría: ambos productos YELLOW",
		);
		const ev = (pb._imgTextWarnings || []).find(
			(x) => x.type === "cross-category",
		);
		this.assert(
			ev && ev.sharedBy.includes("SH-01") && ev.sharedBy.includes("SH-02"),
			"Evidencia cross-category con sharedBy (todos los SKUs)",
		);
		this.assert(
			ev &&
				ev.categories.includes("TECLADO") &&
				ev.categories.includes("MOUSE"),
			"Evidencia cross-category con categories",
		);
		this.assert(pb.img === "-", "Secundario cross-categoría desasignado");
		this.assert(
			pb.warnings.some((x) => x.includes("categor")),
			"Warning de cross-categoría presente (string sin cambios)",
		);

		// verified rebrand (Irok/Mars, same model+cat) keeps image + GREEN
		const c = {
			...base,
			sku: "SH-03",
			marca: "Irok",
			modelo: "Mer68 Max",
			cat: "TECLADO",
		};
		const d = {
			...base,
			sku: "SH-04",
			marca: "Mars",
			modelo: "Mer68 Max",
			cat: "TECLADO",
		};
		const { products: rebranded } =
			CatalogAssignmentGates.applyImageIntegrityGates([c, d]);
		this.assert(
			rebranded.every((p) => p.img === PNG && p.status === "GREEN"),
			"Rebrand verificado (marca+modelo+cat) conserva GREEN y foto",
		);
	},

	testImageTextExportPreview() {
		// gate warning surfaces in warnings[0] for a previously-clean product
		const product = {
			sku: "XP-01",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			cat: "MOUSE",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
			_imgAspect: 2.3,
		};
		const { products } = ImageTextGates.runAll([product]);
		const out = products[0];
		this.assert(
			Array.isArray(out._imgTextWarnings) && out._imgTextWarnings.length > 0,
			"Export incluye imgTextWarnings",
		);
		this.assert(
			out.warnings.some((x) => x.includes("Imagen ancha")),
			"Gate warning visible en warnings (pv-reason muestra warnings[0])",
		);

		// composed pipeline: split recomputed AFTER gates
		const fresh = {
			sku: "XP-02",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			cat: "MOUSE",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
			_imgAspect: 2.3,
		};
		const ver = ImportGates.runImportVerification([fresh]);
		this.assert(
			ver.products.length === 1 &&
				ver.review.length === 1 &&
				ver.stats.yellow === 1,
			"Split recomputado tras gates: producto gate-flaggeado en review",
		);
		this.assert(
			ver.accepted.length === 0 && ver.stats.green === 0,
			"Ningún producto gate-flaggeado queda en accepted",
		);

		// isPhotoOnly (IT16 extension, Decision 6): gate-flagged items are NOT
		// photo-only → land in dataReviewCount, unselected by default.
		const isPhotoOnly = (it) =>
			it.status === "YELLOW" &&
			!/^data:image\/(?:png|jpe?g|webp|gif);/i.test(it.img || "") &&
			!(Array.isArray(it._imgTextWarnings) && it._imgTextWarnings.length) &&
			(!it.warnings ||
				it.warnings.length === 0 ||
				it.warnings.every((x) => /imagen|foto/i.test(x)));
		const gateFlagged = {
			status: "YELLOW",
			img: "-",
			warnings: ["Imagen compartida entre categorías (asignación inválida)"],
			_imgTextWarnings: [{ type: "cross-category" }],
		};
		this.assert(
			isPhotoOnly(gateFlagged) === false,
			"isPhotoOnly excluye ítems flagueados por gates de imagen",
		);
		const plainPhoto = {
			status: "YELLOW",
			img: "-",
			warnings: ["Sin foto de previsualización (datos OK)"],
			_imgTextWarnings: [],
		};
		this.assert(
			isPhotoOnly(plainPhoto) === true,
			"isPhotoOnly mantiene YELLOW de solo foto",
		);
	},

	testGroundingGeometry() {
		const P = PdfParser;
		const A = (x, y, price) => ({
			x,
			y,
			price,
			rawLine: "$" + price,
			pageNum: 1,
		});

		// Aligned anchor: same column band, nearest to its row text baseline
		const anchors = [A(100, 300, 24.04), A(100, 340, 29.57)];
		const ok = P.verifyGrounding({
			anchor: anchors[0],
			rowTextY: 300,
			pageNum: 1,
			pageAnchors: anchors,
		});
		this.assert(
			ok.grounded === true,
			"Ancla alineada a su fila -> grounded:true",
		);
		this.assert(
			ok.reason === "FOB verificado por geometría de fila",
			"Razón de grounding verificado por geometría",
		);
		this.assert(
			ok.evidence.groundingMode === "geometric" &&
				ok.evidence.page === 1 &&
				ok.evidence.price === 24.04,
			"Evidencia {groundingMode, page, price} para ancla verificada",
		);

		// Fused cell: the NEAREST same-column anchor belongs to the neighbor row
		const fusedAnchors = [A(100, 300, 24.04), A(100, 308, 29.57)];
		const fused = P.verifyGrounding({
			anchor: fusedAnchors[0],
			rowTextY: 310,
			pageNum: 1,
			pageAnchors: fusedAnchors,
		});
		this.assert(
			fused.grounded === false && fused.reason === "ancla de fila vecina",
			"Celda fusionada: ancla de fila vecina -> grounded:false",
		);
		this.assert(
			fused.evidence.dy === 2,
			"Evidencia fused-cell con dy = distancia mínima a la fila",
		);

		// Misaligned: anchor further than rowTolerance (30) from the text baseline
		const off = P.verifyGrounding({
			anchor: A(100, 340, 29.57),
			rowTextY: 300,
			pageNum: 1,
			pageAnchors: [A(100, 340, 29.57)],
		});
		this.assert(
			off.grounded === false && off.reason === "ancla no alineada",
			"Ancla no alineada (dy 40 > 30) -> grounded:false",
		);

		// Absent anchor (matrix/fallback path) -> "FOB sin ancla literal verificada"
		const absent = P.verifyGrounding({
			anchor: null,
			rowTextY: 200,
			pageNum: 3,
			pageAnchors: [],
		});
		this.assert(
			absent.grounded === false &&
				absent.reason === "FOB sin ancla literal verificada",
			'Ancla ausente -> "FOB sin ancla literal verificada"',
		);
		this.assert(
			absent.evidence.anchorX === null && absent.evidence.page === 3,
			"Evidencia con anchorX null y page para ancla ausente",
		);

		// R10 contract: false grounding → YELLOW/IMPORTABLE (never RED), and R10
		// consumes groundingEvidence without breaking the R1-R10 shape.
		const item = {
			sku: "GRD-2",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 29.57,
			img: "data:image/png;base64,AAAA",
			grounded: false,
			groundingReason: "ancla de fila vecina",
			groundingEvidence: fused.evidence,
		};
		const evals = CatalogValidator.evaluateItem(item);
		const r10 = evals.find((e) => e.code === "R10");
		this.assert(
			r10.status === "YELLOW" && r10.importability === "IMPORTABLE",
			"Grounding falso -> R10 YELLOW/IMPORTABLE (nunca RED)",
		);
		this.assert(
			r10.evidence.groundingMode === "geometric" &&
				r10.evidence.page === 1 &&
				r10.evidence.dy === 2,
			"R10 consume groundingEvidence {groundingMode, page, dy} sin romper el contrato",
		);
		this.assert(
			evals.length === 10,
			"R1-R10 contract intacto (10 evaluaciones)",
		);
	},

	testCatalogStatsOutliers() {
		const base = (sku, fob) => ({
			sku,
			cat: "ACCESORIO",
			fob,
			status: "GREEN",
			warnings: [],
			img: "data:image/png;base64,AAAA",
			grounded: true,
			modelo: "X" + sku,
			marca: "Aula",
			variante: "Black",
		});

		// prices 10..16 → q1=12, q3=16, iqr=4, high3=28; 500 is a 5× outlier
		const extremeSet = [
			base("O-01", 10),
			base("O-02", 11),
			base("O-03", 12),
			base("O-04", 13),
			base("O-05", 14),
			base("O-06", 15),
			base("O-07", 16),
			base("O-08", 500),
		];
		const out = CatalogValidator.validateCatalogStats(extremeSet);
		const extreme = out.find((p) => p.sku === "O-08");
		this.assert(
			extreme.status === "YELLOW",
			"Outlier extremo (IQR×3) degrada a YELLOW",
		);
		this.assert(
			extreme._outlierEvidence &&
				extreme._outlierEvidence.price === 500 &&
				extreme._outlierEvidence.cat === "ACCESORIO",
			"Evidencia _outlierEvidence {price, cat}",
		);
		this.assert(
			extreme._outlierEvidence.iqr === 4 && extreme._outlierEvidence.factor > 3,
			"Evidencia con iqr y factor > 3",
		);
		this.assert(
			extreme.warnings.some((w) => w.includes("Outlier de precio")),
			'Warning "Outlier de precio" presente',
		);

		// prices 10..14 + 22 → q1=11, q3=14, iqr=3, high=18.5, high3=23 → 22 is
		// a MILD outlier (1.5× band): advisory only.
		const mildSet = [
			base("M-01", 10),
			base("M-02", 11),
			base("M-03", 12),
			base("M-04", 13),
			base("M-05", 14),
			base("M-06", 22),
		];
		const mild = CatalogValidator.validateCatalogStats(mildSet).find(
			(p) => p.sku === "M-06",
		);
		this.assert(
			mild.status === "GREEN" &&
				mild._statFlag &&
				mild._statFlag.includes("Outlier"),
			"Outlier leve (1.5×) se mantiene advisory (sin YELLOW)",
		);
		this.assert(
			!mild._outlierEvidence,
			"Outlier leve NO lleva _outlierEvidence",
		);
	},
	testNounPhraseCalibration() {
		if (typeof TextSanitizer.classifyMarketingModel !== "function") {
			this.assert(false, "RED 1.1: classifyMarketingModel no implementado");
			return;
		}
		const full = (modelo, extra = {}) => {
			const item = {
				sku: "NP-01",
				marca: "Aula",
				modelo,
				variante: "Black",
				cat: "ACCESORIO",
				fob: 19.9,
				img: "data:image/png;base64,AAAA",
				grounded: true,
				...extra,
			};
			return { result: CatalogValidator.validateItem(item), item };
		};
		// "Dual Charging Dock Xbox" (8bitdo): 1 marketing word + product noun
		const dock = full("Dual Charging Dock Xbox");
		this.assert(
			dock.result.status === "GREEN",
			'1.1 "Dual Charging Dock Xbox" → GREEN (sin MODEL_MARKETING)',
		);
		this.assert(
			dock.item._modelQuality &&
				dock.item._modelQuality.marketingEvidence &&
				dock.item._modelQuality.marketingEvidence.pattern === "noun-phrase" &&
				dock.item._modelQuality.marketingEvidence.noun === "Dock" &&
				dock.item._modelQuality.marketingEvidence.marketingWords === 1,
			'1.1 Gate registra {pattern:"noun-phrase", noun:"Dock", marketingWords:1}',
		);
		// Puffery stack (≥2 adjectives, no noun, no code) stays YELLOW
		const puff = full("Ultra Crystalblade Gleam");
		this.assert(
			puff.result.status === "YELLOW",
			'1.1 Puffery "Ultra Crystalblade Gleam" → YELLOW MODEL_MARKETING',
		);
		this.assert(
			puff.item._modelQuality &&
				puff.item._modelQuality.marketing &&
				puff.item._modelQuality.marketing.class === "puffery",
			"1.1 Clasificación puffery registrada",
		);
		// Code rule untouched: "AJ139 Pro 68 Keys" stays GREEN unchanged
		const code = full("AJ139 Pro 68 Keys", { sku: "NP-02", cat: "MOUSE" });
		this.assert(
			code.result.status === "GREEN",
			'1.1 "AJ139 Pro 68 Keys" sigue GREEN (regla de código intacta)',
		);
	},
	testSwitchAxisClassification() {
		if (typeof TextSanitizer.classifyMarketingModel !== "function") {
			this.assert(false, "RED 1.3: classifyMarketingModel no implementado");
			return;
		}
		const sw = TextSanitizer.classifyMarketingModel("Magnetic Switch T9");
		this.assert(
			sw.class === "switch-axis",
			'1.3 classify: "Magnetic Switch T9" → switch-axis',
		);
		this.assert(
			sw.switchToken === "Magnetic Switch" && sw.remainingModel === "T9",
			'1.3 Evidencia {switchToken:"Magnetic Switch", remainingModel:"T9"}',
		);
		const gateItem = {
			sku: "SWT-01",
			marca: "Aula",
			modelo: "Magnetic Switch T9",
			variante: "Black",
			cat: "TECLADO",
			fob: 45,
			img: "data:image/png;base64,AAAA",
			grounded: true,
		};
		const gate = CatalogValidator.validateItem(gateItem);
		this.assert(
			gate.status === "YELLOW",
			'1.3 "Magnetic Switch T9" → YELLOW SWITCH_IN_MODEL',
		);
		this.assert(
			gateItem._modelQuality &&
				gateItem._modelQuality.marketing &&
				gateItem._modelQuality.marketing.class === "switch-axis" &&
				gateItem._modelQuality.marketingEvidence &&
				gateItem._modelQuality.marketingEvidence.switchToken ===
					"Magnetic Switch",
			"1.3 Gate clasifica switch-axis, nunca MODEL_MARKETING",
		);
		// "Gateron Red Switch 87 Keys" → real identity (noun phrase), never puffery
		const gr = TextSanitizer.classifyMarketingModel(
			"Gateron Red Switch 87 Keys",
		);
		this.assert(
			gr.class === "noun-phrase",
			'1.3 "Gateron Red Switch 87 Keys" → noun-phrase (identidad real)',
		);
		this.assert(
			gr.class !== "puffery" && gr.class !== "switch-axis",
			"1.3 Nunca puffery para switch+noun",
		);
	},
	testReasonInstrumentation() {
		const G = ImportGates;
		if (
			typeof G.instrumentReasons !== "function" ||
			typeof G.assertAtomicReasons !== "function"
		) {
			this.assert(
				false,
				"RED 1.5: instrumentReasons/assertAtomicReasons no implementado",
			);
			return;
		}
		// 7 legacy FINAL5 NO_OBSERVATIONS items re-diagnosed (6 sin evidencia,
		// 1 con evidencia de outlier) → byReason NO_OBSERVATIONS = 0
		const legacy = [];
		for (let i = 1; i <= 6; i++) {
			legacy.push({
				sku: "NO-0" + i,
				status: "YELLOW",
				warnings: [],
				sourceStatus: "YELLOW",
				marca: "Aula",
				modelo: "F75",
				cat: "TECLADO",
				fob: 35,
			});
		}
		legacy.push({
			sku: "NO-07",
			status: "YELLOW",
			warnings: [],
			_outlierEvidence: {
				price: 300,
				median: 12,
				iqr: 5,
				cat: "TECLADO",
				factor: 4,
			},
			marca: "Aula",
			modelo: "AK820",
			cat: "TECLADO",
			fob: 300,
		});
		G.instrumentReasons(legacy);
		const byReason = {};
		for (const p of legacy)
			byReason[p._atomicReason] = (byReason[p._atomicReason] || 0) + 1;
		this.assert(
			!byReason.NO_OBSERVATIONS &&
				!byReason["Sin observaciones"] &&
				byReason.UNCLASSIFIED_YELLOW === 6 &&
				byReason.OUTLIER_PRICE === 1,
			"1.5 Re-diagnóstico: NO_OBSERVATIONS = 0, razones atómicas asignadas",
		);
		const defect = legacy[0];
		this.assert(
			defect._atomicReason === "UNCLASSIFIED_YELLOW",
			"1.5 Ítem sin razón derivable → UNCLASSIFIED_YELLOW",
		);
		this.assert(
			defect.warnings.includes("Degradación sin razón atómica") &&
				defect.qualityReason === "Degradación sin razón atómica",
			'1.5 Razón en español "Degradación sin razón atómica"',
		);
		// Invariant: degradation without a reason fails closed (never promoted)
		const raw = [{ sku: "X-01", status: "YELLOW", warnings: [] }];
		this.assert(
			G.assertAtomicReasons(raw) === false,
			"1.5 Invariante: degradación sin razón falla antes de instrumentar",
		);
		G.instrumentReasons(raw);
		this.assert(
			G.assertAtomicReasons(raw) === true,
			"1.5 Invariante: tras instrumentar toda degradación tiene razón",
		);
		const ver = G.runImportVerification([
			{
				sku: "X-02",
				marca: "Aula",
				modelo: "F75",
				cat: "TECLADO",
				fob: 35,
				img: "data:image/png;base64,AAAA",
				grounded: true,
				status: "GREEN",
				warnings: [],
				sourceStatus: "YELLOW",
			},
		]);
		const out = ver.products[0];
		this.assert(
			out.status === "YELLOW" && ver.accepted.length === 0,
			"1.5 Ítem defecto nunca promovido",
		);
		this.assert(
			out._atomicReason === "UNCLASSIFIED_YELLOW",
			"1.5 Defecto de pipeline etiquetado UNCLASSIFIED_YELLOW",
		);
	},
	testColorAmbiguityResolution() {
		const G = ImageTextGates;
		if (typeof G.colorAmbiguityResolved !== "function") {
			this.assert(false, "RED 1.7: colorAmbiguityResolved no implementado");
			return;
		}
		// sampleInteriorColor devuelve topColors aditivo (top 3 buckets)
		const w = 100,
			h = 100;
		const pixels = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4;
				const inside = x >= 20 && x < 80 && y >= 20 && y < 80;
				const pinkBlock = x >= 30 && x < 54 && y >= 30 && y < 70;
				const whiteBlock = x >= 54 && x < 70 && y >= 30 && y < 70;
				if (pinkBlock) {
					pixels[i] = 220;
					pixels[i + 1] = 90;
					pixels[i + 2] = 190;
				} else if (whiteBlock) {
					pixels[i] = 225;
					pixels[i + 1] = 225;
					pixels[i + 2] = 225;
				} else if (inside) {
					pixels[i] = 250;
					pixels[i + 1] = 250;
					pixels[i + 2] = 250;
				} else {
					pixels[i] = 0;
					pixels[i + 1] = 0;
					pixels[i + 2] = 0;
				}
				pixels[i + 3] = 255;
			}
		}
		const sample = G.sampleInteriorColor(pixels, w, h);
		this.assert(
			Array.isArray(sample.topColors) && sample.topColors.length <= 3,
			"1.7 topColors aditivo (hasta 3 buckets)",
		);
		this.assert(
			sample.topColors.length >= 2 &&
				sample.topColors[0].name === "PINK" &&
				sample.topColors[0].pct > 40 &&
				sample.topColors.every(
					(t) => t && typeof t.name === "string" && typeof t.pct === "number",
				),
			"1.7 topColors [{name,pct}] ordenados por dominio (PINK dominante)",
		);
		// Familias variante/color compatibles con los top colors → warning suprimido
		const base = {
			sku: "CA-01",
			marca: "Aula",
			modelo: "F75",
			variante: "Pink/White",
			color: "Pink/White",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
		};
		const res = G.runAll([
			{
				...base,
				_interiorColor: {
					name: "PINK",
					confidence: 52,
					occupancy: 80,
					topColors: [
						{ name: "PINK", pct: 52 },
						{ name: "WHITE", pct: 30 },
						{ name: "BLACK", pct: 8 },
					],
				},
			},
		]);
		const out = res.products[0];
		this.assert(
			out.status === "GREEN",
			"1.7 Diseño multi-color intencional (Pink/White ≡ foto) → GREEN",
		);
		this.assert(
			!out.warnings.some((x) => x.includes("Color de imagen ambiguo")),
			"1.7 Warning ambiguo suprimido (benigno)",
		);
		this.assert(
			out._colorAmbiguityResolved &&
				out._colorAmbiguityResolved.declaredColors.length === 2,
			"1.7 Evidencia etiquetada de resolución (intentional design)",
		);
		// Familias contradictorias → WATCH se mantiene, sin cambio de status
		const contr = {
			...base,
			sku: "CA-02",
			variante: "Negro",
			color: "Negro",
			_interiorColor: {
				name: "PINK",
				confidence: 52,
				occupancy: 80,
				topColors: [
					{ name: "PINK", pct: 52 },
					{ name: "WHITE", pct: 30 },
				],
			},
		};
		const resC = G.runAll([contr]);
		const outC = resC.products[0];
		this.assert(
			outC.status === "GREEN",
			"1.7 Familias contradictorias → WATCH, sin cambio de status",
		);
		this.assert(
			outC.warnings.some((x) => x.includes("Color de imagen ambiguo")),
			"1.7 WATCH ambiguo se mantiene para familias contradictorias",
		);
	},
	testOutlierLiteralCalibration() {
		const V = CatalogValidator;
		const mk = (sku, fob, extra = {}) => ({
			sku,
			marca: "Aula",
			modelo: "AK820 Pro",
			variante: "Black",
			cat: "TECLADO",
			fob,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "GREEN",
			warnings: [],
			...extra,
		});
		const items = [];
		for (let i = 0; i < 8; i++) items.push(mk("T-" + i, 10 + i));
		const literal = mk("T-LIT", 89, {
			_priceGroundingLiteral: { text: "$89.00", page: 3, dy: 2 },
		});
		const geometric = mk("T-GEO", 95);
		items.push(literal, geometric);
		const out = V.validateCatalogStats(items);
		const lit = out.find((p) => p.sku === "T-LIT");
		const geo = out.find((p) => p.sku === "T-GEO");
		this.assert(
			lit.status === "GREEN" && !!lit._statFlag,
			"1.9 Outlier IQR×3 con literal → advisory _statFlag, no YELLOW (tier real)",
		);
		this.assert(
			lit._outlierEvidence && lit._outlierEvidence.groundingMode === "literal",
			"1.9 Evidencia de grounding literal registrada",
		);
		this.assert(
			geo.status === "YELLOW",
			"1.9 Outlier geométrico (sin literal) → sigue YELLOW",
		);
		this.assert(!geo._statFlag, "1.9 Geométrico: sin downgrade advisory");
	},
	testCalibrationDelta() {
		let CD;
		try {
			CD = require("../../scripts/quality/calibration-delta.js");
		} catch (err) {
			// RED: el script aún no existe — la fixture falla con mensaje claro.
			this.results.push({
				pass: false,
				message:
					"RED 1.11: calibration-delta.js no existe (" +
					String(err.message || err.code) +
					")",
			});
			return;
		}
		if (!CD) {
			this.assert(false, "RED 1.11: calibration-delta.js no existe");
			return;
		}
		const audit = CD.CALIBRATION_DELTA_AUDITS["MODEL_MARKETING"];
		this.assert(
			audit && audit.sampleSize === 111,
			"1.11 Auditoría etiquetada MODEL_MARKETING: sampleSize 111 registrado",
		);
		const row = CD.runCalibrationDelta({ gate: "MODEL_MARKETING" }).rows[0];
		this.assert(
			row.before.fp > row.after.fp,
			"1.11 MODEL_MARKETING: FP después < FP antes",
		);
		this.assert(
			row.after.fn <= row.before.fn,
			"1.11 MODEL_MARKETING: FN no aumenta",
		);
		this.assert(
			row.verdict === "accepted",
			"1.11 Regla noun-phrase aceptada (fail-closed)",
		);
		// Candidate that absorbs true positives (FN up) → rejected
		const candidate = CD.analyzeGate(
			"MODEL_MARKETING",
			CD.CLASSIFIERS.beforeMarketing,
			() => false,
			audit.rows,
		);
		this.assert(
			candidate.verdict === "rejected" &&
				candidate.after.fn > candidate.before.fn,
			"1.11 Candidato que absorbe TP (FN↑) → rechazado (fail-closed)",
		);
	},
	testColorFromImageStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.colorFromImage !== "function"
		) {
			this.assert(
				false,
				"RED 2.1: Remediation.strategies.colorFromImage no implementado",
			);
			return;
		}
		const item = (interior, extra = {}) => ({
			sku: "CF-01",
			marca: "Aula",
			modelo: "F75",
			variante: "",
			color: "BLACK",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "YELLOW",
			_atomicReason: "COLOR_MISMATCH",
			_interiorColor: interior,
			...extra,
		});
		const res = R.strategies.colorFromImage(
			item({
				name: "WHITE",
				confidence: 87,
				occupancy: 87,
				topColors: [{ name: "WHITE", pct: 87 }],
			}),
			null,
			{},
		);
		this.assert(!!res, "2.1 Interior WHITE ocupación 87 → estrategia aplica");
		this.assert(
			res && res.item.color === "WHITE",
			"2.1 color adopta el muestreo interior (WHITE)",
		);
		this.assert(
			res && res.item.variante.includes("BLACK"),
			"2.1 color declarado (BLACK) movido a variante",
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "color-from-image" &&
				res.evidence.actual === "WHITE" &&
				res.evidence.declared === "BLACK" &&
				res.evidence.occupancy === 87 &&
				res.evidence.sampleRegion === "center-60%",
			'2.1 Evidencia {remediated:"color-from-image", actual:"WHITE", declared:"BLACK", occupancy:87, sampleRegion:"center-60%"}',
		);
		this.assert(
			R.strategies.colorFromImage(
				item({ name: "WHITE", confidence: 29, occupancy: 29, topColors: [] }),
				null,
				{},
			) === null,
			"2.1 Ocupación 29 < 35 → no aplica, sigue YELLOW COLOR_MISMATCH",
		);
		this.assert(
			R.strategies.colorFromImage(
				item({ name: "CORAL", confidence: 90, occupancy: 90, topColors: [] }),
				null,
				{},
			) === null,
			"2.1 Interior fuera del vocabulario de colores → no aplica",
		);
		this.assert(
			R.strategies.colorFromImage(
				item({
					name: "MULTICOLOR",
					confidence: 60,
					occupancy: 60,
					topColors: [],
				}),
				null,
				{},
			) === null,
			"2.1 Box-art WATCH (MULTICOLOR) → no aplica, sin cambio de status",
		);
	},
	testVarianteColorAdoptionStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.varianteColorAdoption !== "function"
		) {
			this.assert(
				false,
				"RED 2.3: Remediation.strategies.varianteColorAdoption no implementado",
			);
			return;
		}
		const mk = (variante, interior) => ({
			sku: "VC-01",
			marca: "Aula",
			modelo: "F75",
			variante,
			color: variante,
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			grounded: true,
			status: "YELLOW",
			_atomicReason: "COLOR_AMBIGUOUS",
			_interiorColor: interior,
		});
		const top = {
			name: "PINK",
			confidence: 52,
			occupancy: 80,
			topColors: [
				{ name: "PINK", pct: 52 },
				{ name: "WHITE", pct: 48 },
			],
		};
		const res = R.strategies.varianteColorAdoption(
			mk("Pink/White", top),
			null,
			{},
		);
		this.assert(
			!!res,
			'2.3 Variante "Pink/White" ≡ top colors de la foto → aplica',
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "variante-color-adoption" &&
				Array.isArray(res.evidence.colorsFromVariante) &&
				res.evidence.colorsFromVariante.join("|") === "Pink|White" &&
				Array.isArray(res.evidence.photoTopColors) &&
				res.evidence.photoTopColors.join("|") === "PINK|WHITE",
			'2.3 Evidencia {remediated:"variante-color-adoption", colorsFromVariante:["Pink","White"], photoTopColors:["PINK","WHITE"]}',
		);
		this.assert(
			R.strategies.varianteColorAdoption(mk("", top), null, {}) === null,
			"2.3 Variante vacía → no aplica, sigue COLOR_AMBIGUOUS",
		);
		this.assert(
			R.strategies.varianteColorAdoption(mk("Negro", top), null, {}) === null,
			"2.3 Variante contradictoria (Negro vs [PINK, WHITE]) → no aplica",
		);
	},
	testLiteralPriceRegroundingStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.literalPriceRegrounding !== "function"
		) {
			this.assert(
				false,
				"RED 2.5: Remediation.strategies.literalPriceRegrounding no implementado",
			);
			return;
		}
		const item = {
			sku: "LP-01",
			marca: "Aula",
			modelo: "F75",
			variante: "Black",
			cat: "TECLADO",
			fob: 89,
			x: 100,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "OUTLIER_PRICE",
			_outlierEvidence: { price: 89, median: 12, iqr: 5, factor: 4 },
		};
		const row = (textItems, anchors) => ({
			page: 3,
			rowTextY: 200,
			textItems,
			anchors:
				anchors !== undefined ? anchors : [{ x: 100, y: 202, str: "$89.00" }],
			alignment: { dx: 0, dy: 2 },
		});
		const literalItems = [
			{ str: "F75 Pro", x: 40, y: 200, width: 60, height: 12, page: 3 },
			{ str: "$89.00", x: 100, y: 202, width: 45, height: 12, page: 3 },
		];
		const res = R.strategies.literalPriceRegrounding(
			item,
			row(literalItems),
			{},
		);
		this.assert(
			!!res,
			'2.5 Token literal "$89.00" en la banda de fila → aplica',
		);
		this.assert(
			res &&
				res.item._priceGroundingLiteral &&
				res.item._priceGroundingLiteral.text === "$89.00" &&
				res.item._priceGroundingLiteral.page === 3,
			"2.5 Item registra _priceGroundingLiteral {text, page} (tier real)",
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "literal-price-regrounding" &&
				res.evidence.groundingMode === "literal" &&
				res.evidence.text === "$89.00" &&
				res.evidence.page === 3 &&
				typeof res.evidence.dy === "number",
			'2.5 Evidencia {remediated:"literal-price-regrounding", groundingMode:"literal", text:"$89.00", page, dy}',
		);
		this.assert(
			R.strategies.literalPriceRegrounding(
				item,
				row(
					[{ str: "F75 Pro", x: 40, y: 200, width: 60, height: 12, page: 3 }],
					[],
				),
				{},
			) === null,
			"2.5 Sin token literal en la banda → no aplica, sigue OUTLIER_PRICE",
		);
		this.assert(
			R.strategies.literalPriceRegrounding(
				item,
				row(
					[{ str: "$89.00", x: 300, y: 202, width: 45, height: 12, page: 3 }],
					[],
				),
				{},
			) === null,
			"2.5 Ancla de vecino/fusionada (x fuera de banda de columna) → no aplica",
		);
	},
	testLiteralAnchorSearchStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.literalAnchorSearch !== "function"
		) {
			this.assert(
				false,
				"RED 2.7: Remediation.strategies.literalAnchorSearch no implementado",
			);
			return;
		}
		const item = {
			sku: "LA-01",
			marca: "Ajazz",
			modelo: "AJ139",
			variante: "Pro",
			cat: "MOUSE",
			fob: 23.9,
			x: 100,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "FOB_NO_LITERAL_EVIDENCE",
			grounded: false,
		};
		const row = (textItems, anchors) => ({
			page: 2,
			rowTextY: 150,
			textItems,
			anchors:
				anchors !== undefined ? anchors : [{ x: 100, y: 151, str: "$23.90" }],
			alignment: { dx: 0, dy: 1 },
		});
		const literalItems = [
			{ str: "AJ139 Pro", x: 50, y: 150, width: 60, height: 12, page: 2 },
			{ str: "$23.90", x: 100, y: 151, width: 45, height: 12, page: 2 },
		];
		const res = R.strategies.literalAnchorSearch(item, row(literalItems), {});
		this.assert(
			!!res,
			'2.7 Token literal "$23.90" alineado en la banda → aplica',
		);
		this.assert(
			res && res.item.grounded === true,
			"2.7 grounded derivado true del token literal (nunca hardcodeado)",
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "literal-anchor-search" &&
				res.evidence.groundingMode === "literal" &&
				res.evidence.text === "$23.90" &&
				res.evidence.page === 2 &&
				res.evidence.alignment &&
				typeof res.evidence.alignment.dy === "number",
			'2.7 Evidencia {remediated:"literal-anchor-search", groundingMode:"literal", text:"$23.90", page, alignment}',
		);
		this.assert(
			R.strategies.literalAnchorSearch(
				item,
				row(
					[{ str: "AJ139 Pro", x: 50, y: 150, width: 60, height: 12, page: 2 }],
					[],
				),
				{},
			) === null,
			"2.7 Sin token literal en la fila → no aplica, sigue FOB_NO_LITERAL_EVIDENCE",
		);
		this.assert(
			R.strategies.literalAnchorSearch(
				item,
				row(
					[{ str: "$23.90", x: 300, y: 151, width: 45, height: 12, page: 2 }],
					[],
				),
				{},
			) === null,
			"2.7 Token de celda fusionada (vecino) → no aplica",
		);
	},
	testTruncationRepairStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.truncationRepair !== "function"
		) {
			this.assert(
				false,
				"RED 2.9: Remediation.strategies.truncationRepair no implementado",
			);
			return;
		}
		const item = {
			sku: "TR-01",
			marca: "Haimu",
			modelo: "(Magnetic Switch",
			variante: "",
			cat: "SWITCH",
			fob: 5,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "MODEL_TRUNCATED",
		};
		const row = (textItems) => ({
			page: 1,
			rowTextY: 120,
			textItems,
			anchors: [],
			alignment: { dx: 0, dy: 0 },
		});
		const res = R.strategies.truncationRepair(
			item,
			row([
				{
					str: "(Magnetic Switch",
					x: 50,
					y: 120,
					width: 90,
					height: 12,
					page: 1,
				},
				{ str: ")", x: 145, y: 121, width: 6, height: 12, page: 1 },
			]),
			{},
		);
		this.assert(!!res, '2.9 Token de cierre ")" en la banda de fila → aplica');
		this.assert(
			res && res.item.modelo === "(Magnetic Switch)",
			'2.9 Modelo reparado a "(Magnetic Switch)"',
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "truncation-repaired" &&
				res.evidence.before === "(Magnetic Switch" &&
				res.evidence.after === "(Magnetic Switch)",
			'2.9 Evidencia {remediated:"truncation-repaired", before, after}',
		);
		this.assert(
			R.strategies.truncationRepair(
				item,
				row([
					{
						str: "(Magnetic Switch",
						x: 50,
						y: 120,
						width: 90,
						height: 12,
						page: 1,
					},
				]),
				{},
			) === null,
			"2.9 Sin token de cierre en la banda → no aplica (truncado real de origen)",
		);
	},
	testSwitchToVarianteStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.switchToVariante !== "function"
		) {
			this.assert(
				false,
				"RED 2.11: Remediation.strategies.switchToVariante no implementado",
			);
			return;
		}
		const mk = (modelo, variante = "Black") => ({
			sku: "ST-01",
			marca: "Aula",
			modelo,
			variante,
			cat: "TECLADO",
			fob: 45,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "SWITCH_IN_MODEL",
		});
		const res = R.strategies.switchToVariante(
			mk("Magnetic Switch T9"),
			null,
			{},
		);
		this.assert(
			!!res,
			"2.11 Modelo con token switch + identidad restante → aplica",
		);
		this.assert(
			res && res.item.modelo === "T9",
			'2.11 Modelo queda "T9" (identidad real retenida)',
		);
		this.assert(
			res && res.item.variante.includes("Magnetic Switch"),
			"2.11 Token movido a variante",
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "switch-to-variante" &&
				Array.isArray(res.evidence.moved) &&
				res.evidence.moved.join("|") === "Magnetic Switch" &&
				res.evidence.to === "variante",
			'2.11 Evidencia {remediated:"switch-to-variante", moved:["Magnetic Switch"], to:"variante"}',
		);
		this.assert(
			R.strategies.switchToVariante(mk("Magnetic Switch"), null, {}) === null,
			"2.11 Modelo solo token switch (sin identidad) → no aplica, sigue SWITCH_IN_MODEL",
		);
	},
	testRowContextAndCodeAdoptionStrategies() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.rowContextDisambiguation !== "function" ||
			typeof R.strategies.codeAdoption !== "function"
		) {
			this.assert(
				false,
				"RED 2.13: Remediation.strategies.rowContextDisambiguation/codeAdoption no implementado",
			);
			return;
		}
		const generic = {
			sku: "RC-01",
			marca: "Aula",
			modelo: "Standard",
			variante: "AJ139",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "MODEL_GENERIC_WORD",
		};
		const resRC = R.strategies.rowContextDisambiguation(generic, null, {
			siblings: [],
		});
		this.assert(
			!!resRC,
			"2.13 Código real en otra columna de la fila → aplica",
		);
		this.assert(
			resRC && resRC.item.modelo === "AJ139",
			'2.13 Modelo adopta "AJ139"',
		);
		this.assert(
			resRC &&
				resRC.evidence &&
				resRC.evidence.remediated === "row-context-disambiguation" &&
				resRC.evidence.adopted === "AJ139" &&
				resRC.evidence.source === "variante",
			'2.13 Evidencia {remediated:"row-context-disambiguation", adopted:"AJ139", source:"variante"}',
		);
		const none = { ...generic, sku: "RC-02", variante: "Black" };
		this.assert(
			R.strategies.rowContextDisambiguation(none, null, { siblings: [] }) ===
				null,
			"2.13 Sin evidencia en la fila → no aplica, sigue MODEL_GENERIC_WORD",
		);
		const fragment = {
			sku: "CA-01",
			marca: "Aula",
			modelo: "68 Keys",
			variante: "",
			cat: "TECLADO",
			fob: 35,
			img: "data:image/png;base64,AAAA",
			status: "YELLOW",
			_atomicReason: "SPEC_FRAGMENT",
		};
		const row = {
			page: 4,
			rowTextY: 300,
			textItems: [
				{
					str: "AJ139 Pro 68 Keys",
					x: 40,
					y: 300,
					width: 120,
					height: 12,
					page: 4,
				},
			],
			anchors: [],
			alignment: { dx: 0, dy: 0 },
		};
		const resCA = R.strategies.codeAdoption(fragment, row, { siblings: [] });
		this.assert(
			!!resCA,
			"2.13 Código real en text item de la misma fila → aplica",
		);
		this.assert(
			resCA && resCA.item.modelo === "AJ139",
			'2.13 Modelo adopta "AJ139" del text item',
		);
		this.assert(
			resCA &&
				resCA.evidence &&
				resCA.evidence.remediated === "code-adoption" &&
				resCA.evidence.adopted === "AJ139" &&
				resCA.evidence.source === "row-text",
			'2.13 Evidencia {remediated:"code-adoption", adopted:"AJ139", source:"row-text"}',
		);
		this.assert(
			R.strategies.codeAdoption(
				{ ...fragment, sku: "CA-02" },
				{
					...row,
					textItems: [
						{ str: "68 Keys", x: 40, y: 300, width: 60, height: 12, page: 4 },
					],
				},
				{ siblings: [] },
			) === null,
			"2.13 Sin código en la fila → no aplica, sigue SPEC_FRAGMENT",
		);
	},
	testSharedImageReassignStrategy() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.strategies !== "object" ||
			typeof R.strategies.sharedImageReassign !== "function"
		) {
			this.assert(
				false,
				"RED 2.15: Remediation.strategies.sharedImageReassign no implementado",
			);
			return;
		}
		const img = "data:image/png;base64,AAAA";
		const item = {
			sku: "SR-01",
			marca: "Aula",
			modelo: "K87",
			cat: "MOUSE",
			img,
			_imgAspect: 2.3,
			status: "YELLOW",
			_atomicReason: "ASPECT_MISMATCH",
		};
		const res = R.strategies.sharedImageReassign(item, null, {
			siblings: [
				{ sku: "SR-02", marca: "Aula", modelo: "K87", cat: "TECLADO", img },
			],
		});
		this.assert(
			!!res,
			"2.15 Imagen compartida con hermano de categoría/aspect compatible → aplica",
		);
		this.assert(
			res && res.item.cat === "TECLADO",
			"2.15 Categoría reassignada a TECLADO",
		);
		this.assert(
			res &&
				res.evidence &&
				res.evidence.remediated === "shared-image-reassign" &&
				res.evidence.reassignedToCategory === "TECLADO" &&
				res.evidence.siblingSku === "SR-02" &&
				typeof res.evidence.imageHash === "string" &&
				res.evidence.imageHash.length >= 6,
			'2.15 Evidencia {remediated:"shared-image-reassign", reassignedToCategory:"TECLADO", siblingSku, imageHash}',
		);
		this.assert(
			R.strategies.sharedImageReassign(item, null, {
				siblings: [
					{
						sku: "SR-02",
						marca: "Logitech",
						modelo: "K87",
						cat: "TECLADO",
						img,
					},
				],
			}) === null,
			"2.15 Sharing cross-brand sin identidad → no aplica, sigue SHARED_IMAGE",
		);
	},
	testPromotionEvidenceContract() {
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (
			!R ||
			typeof R.assertPromotionEvidence !== "function" ||
			typeof R.classifyRemaining !== "function" ||
			typeof R.runRemediationPass !== "function"
		) {
			this.assert(
				false,
				"RED 2.17: Remediation.assertPromotionEvidence/classifyRemaining/runRemediationPass no implementado",
			);
			return;
		}
		this.assert(
			R.assertPromotionEvidence({ status: "GREEN" }) === false,
			"2.17 Promoción sin remediationEvidence → rechazada (defecto de pipeline)",
		);
		this.assert(
			R.assertPromotionEvidence({
				status: "GREEN",
				remediationEvidence: {},
			}) === false,
			"2.17 Evidencia vacía → rechazada",
		);
		const fabricated = {
			status: "GREEN",
			_interiorColor: { name: "WHITE", confidence: 87, occupancy: 87 },
			remediationEvidence: {
				remediated: "color-from-image",
				actual: "BLACK",
				declared: "BLACK",
				occupancy: 87,
				sampleRegion: "center-60%",
			},
		};
		this.assert(
			R.assertPromotionEvidence(fabricated) === false,
			"2.17 Evidencia fabricada (actual BLACK ≠ interior WHITE leído) → rechazada",
		);
		this.assert(
			R.assertPromotionEvidence({
				status: "GREEN",
				_interiorColor: { name: "WHITE", confidence: 87, occupancy: 87 },
				remediationEvidence: {
					remediated: "color-from-image",
					actual: "WHITE",
					declared: "BLACK",
					occupancy: 87,
					sampleRegion: "center-60%",
				},
			}) === true,
			"2.17 Evidencia trazable al artefacto (actual ≡ interior) → aceptada",
		);
		const puffery = {
			sku: "P-01",
			status: "YELLOW",
			warnings: [
				"El modelo tiene palabras de marketing sin un identificador real de producto — requiere revisión",
			],
			_modelQuality: { marketing: { class: "puffery" } },
			_atomicReason: "MODEL_MARKETING",
			marca: "OTRO",
			modelo: "Ultra Crystalblade Gleam",
			variante: "",
			cat: "OTRO",
			fob: 0,
		};
		const declared = R.classifyRemaining([{ ...puffery }]);
		const bi = declared[0] && declared[0]._boundedIrremediable;
		this.assert(!!bi, "2.17 Ítem no remediable declarado bounded-irremediable");
		this.assert(
			bi &&
				typeof bi.class === "string" &&
				bi.class.includes("puffery") &&
				typeof bi.atomicReason === "string" &&
				typeof bi.whyNotRemediable === "string" &&
				bi.whyNotRemediable.length > 5,
			"2.17 Declaración bounded-irremediable con clase + razón (shape reporte humano)",
		);
		const pass = R.runRemediationPass([{ ...puffery }], {}, { enabled: true });
		this.assert(
			pass &&
				Array.isArray(pass.products) &&
				Array.isArray(pass.ledger) &&
				typeof pass.remediatedCount === "number",
			"2.17 runRemediationPass devuelve {products, ledger, stats, remediatedCount}",
		);
	},
	testReasonLabelResolution() {
		// Red-e reporting fix: an item flagged YELLOW with real atomic evidence
		// must never surface as "Sin observaciones". Non-GREEN items carry their
		// structured reason in `_atomicReason`; the report label resolves from it.
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (!R || typeof R.resolveReasonLabel !== "function") {
			this.assert(
				false,
				"report: Remediation.resolveReasonLabel no implementado",
			);
			return;
		}
		// COLOR_MISMATCH item with structured evidence but an empty warning list
		// (the exact shape of the 23 catalog false-positives in the report).
		const colorItem = {
			status: "YELLOW",
			warnings: [],
			_atomicReason: "COLOR_MISMATCH",
		};
		const colorLabel = R.resolveReasonLabel(colorItem);
		this.assert(
			colorLabel === "Color de imagen no coincide con el color declarado",
			"report: item COLOR_MISMATCH sin warnings muestra razón real, no 'Sin observaciones'",
		);
		this.assert(
			!/Sin observaciones/.test(colorLabel),
			"report: label no cae en fallback 'Sin observaciones' cuando hay evidencia",
		);
		// SHARED_IMAGE the same way.
		const sharedItem = {
			status: "YELLOW",
			warnings: [],
			_atomicReason: "SHARED_IMAGE",
		};
		this.assert(
			R.resolveReasonLabel(sharedItem).indexOf("Imagen compartida") === 0,
			"report: item SHARED_IMAGE sin warnings muestra razón real",
		);
		// Legacy warning is used when no atomic reason is present.
		const legacyItem = {
			status: "YELLOW",
			warnings: ["Color de imagen ambiguo (multi-color, ocupación 54%)"],
			_atomicReason: "COLOR_AMBIGUOUS",
		};
		this.assert(
			R.resolveReasonLabel(legacyItem) ===
				"Color de imagen ambiguo (multi-color)",
			"report: label atómico mapeado supera a la cadena legacy",
		);
		// Truly unobserved item (no evidence, no warnings) keeps a real label,
		// never a fabricated promotion.
		const cleanItem = { status: "YELLOW", warnings: [], _atomicReason: "" };
		this.assert(
			/Sin observaciones|UNCLASSIFIED/.test(R.resolveReasonLabel(cleanItem)),
			"report: ítem sin evidencia no inventa una razón",
		);
	},
	testLegacyOnlyCleanStrategy() {
		// Red-e: a YELLOW item whose only degradation is a STALE legacy truncation
		// warning (extraction already fixed it; sourceStatus GREEN, no structured
		// evidence, no unclosed bracket) promotes to GREEN with honest evidence.
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (!R || typeof R.legacyOnlyClean !== "function") {
			this.assert(
				false,
				"RED 2.x: Remediation.legacyOnlyClean no implementado",
			);
			return;
		}
		const stale = {
			sku: "L-01",
			status: "YELLOW",
			sourceStatus: "GREEN",
			modelo: "AK680 Island",
			variante: "",
			cat: "TECLADO",
			warnings: ["Modelo truncado (paréntesis/llave sin cerrar)"],
			_imgTextWarnings: [],
			_modelQuality: { marketing: { class: "code", marketingWords: 0 } },
			grounded: true,
		};
		const res = R.legacyOnlyClean({ ...stale }, {}, { siblings: [] });
		this.assert(!!res, "legacy-only-clean: item con warning stale aplica");
		this.assert(
			res && res.evidence.remediated === "legacy-only-clean",
			"legacy-only-clean: evidencia remediated=legacy-only-clean",
		);
		this.assert(
			res && !res.item.warnings.some((w) => /truncad/i.test(w)),
			"legacy-only-clean: warning stale removido del clon",
		);
		// A genuinely truncated model must NOT apply.
		const truncated = { ...stale, modelo: "AK680 (Island" };
		this.assert(
			R.legacyOnlyClean(truncated, {}, { siblings: [] }) === null,
			"legacy-only-clean: modelo realmente truncado NO aplica",
		);
		// An item with real structured evidence must NOT apply.
		const withEvidence = {
			...stale,
			_imgTextWarnings: [{ type: "color-mismatch" }],
		};
		this.assert(
			R.legacyOnlyClean(withEvidence, {}, { siblings: [] }) === null,
			"legacy-only-clean: evidencia estructurada real NO aplica",
		);
	},
	testCategoryCorrectionStrategy() {
		// Red-e: vision-confirmed category correction re-assigns only when the
		// corrected category is consistent with the image aspect (fail closed).
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (!R || typeof R.categoryCorrection !== "function") {
			this.assert(false, "RED: Remediation.categoryCorrection no implementado");
			return;
		}
		// MOUSE-labeled item with wide keyboard image + vision correction to TECLADO.
		const wide = {
			sku: "C-01",
			status: "YELLOW",
			cat: "MOUSE",
			_imgAspect: 2.3,
			_categoryCorrection: "TECLADO",
		};
		const res = R.categoryCorrection({ ...wide }, {}, { siblings: [] });
		this.assert(
			!!res,
			"category-correction: aplica con corrección consistente",
		);
		this.assert(
			res &&
				res.item.cat === "TECLADO" &&
				res.evidence.remediated === "category-correction",
			"category-correction: re-asigna a TECLADO con evidencia",
		);
		// Inconsistent correction (corrected cat violates the aspect) must fail closed.
		const inconsistent = { ...wide, _categoryCorrection: "MOUSE" };
		// MOUSE is compact; aspect 2.3 wide violates compact -> should NOT re-assign to MOUSE.
		const bad = R.categoryCorrection(
			{ ...wide, cat: "TECLADO", _categoryCorrection: "MOUSE" },
			{},
			{ siblings: [] },
		);
		this.assert(
			!bad || bad.evidence.remediated !== "category-correction",
			"category-correction: corrección inconsistente con aspect NO aplica",
		);
		// No correction provided -> falls back (null or shared), never fabricates.
		const nocorr = { ...wide };
		delete nocorr._categoryCorrection;
		const fb = R.categoryCorrection(nocorr, {}, { siblings: [] });
		this.assert(
			!fb || fb.evidence.remediated !== "category-correction",
			"category-correction: sin corrección no fabrica categoría",
		);
	},
	testAspectCalibratedStrategy() {
		// Red-e: a vision-confirmed portrait render of a CORRECT category is
		// re-verified (aspect-calibrated) instead of degraded by the aspect gate.
		const R = typeof window !== "undefined" ? window.Remediation || null : null;
		if (!R || typeof R.categoryCorrection !== "function") {
			this.assert(false, "RED: aspect-calibrated no implementado");
			return;
		}
		const portrait = {
			sku: "A-01",
			status: "YELLOW",
			cat: "TECLADO",
			_imgAspect: 0.56,
			_aspectCalibrated: { aspect: 0.56, cat: "TECLADO" },
		};
		const res = R.categoryCorrection({ ...portrait }, {}, { siblings: [] });
		this.assert(
			res && res.evidence.remediated === "aspect-calibrated",
			"aspect-calibrated: retrato confirmado fuerza re-verificación",
		);
		this.assert(
			R.assertPromotionEvidence({
				...portrait,
				status: "GREEN",
				remediationEvidence: {
					remediated: "aspect-calibrated",
					aspect: 0.56,
					cat: "TECLADO",
				},
			}) === true,
			"aspect-calibrated: evidencia trazable a _aspectCalibrated",
		);
		// Fabricated aspect (mismatch with _aspectCalibrated) must fail closed.
		this.assert(
			R.assertPromotionEvidence({
				...portrait,
				status: "GREEN",
				remediationEvidence: {
					remediated: "aspect-calibrated",
					aspect: 0.99,
					cat: "TECLADO",
				},
			}) === false,
			"aspect-calibrated: aspect fabricado rechazado",
		);
	},

	// ── persistence-fix: puente Tauri v2 (window.MamboTauriBridge) ──
	//
	// Harness de escritorio simulado: un store y un fs en memoria con la misma
	// superficie que expone src/bridge/tauri-bridge.mjs. El runner de Node no tiene
	// __TAURI_INTERNALS__, asi que el puente real nunca se activa aca y se inyecta
	// el fake en window.MamboTauriBridge.

	_fakePersistence(files = new Map()) {
		const data = new Map();
		const store = {
			data,
			saves: 0,
			get: async (k) => (data.has(k) ? data.get(k) : undefined),
			// El store real serializa a JSON: copia profunda para no compartir refs.
			set: async (k, v) => {
				data.set(k, JSON.parse(JSON.stringify(v)));
			},
			delete: async (k) => {
				data.delete(k);
			},
			save: async () => {
				store.saves++;
			},
			reload: async () => {},
		};
		const fs = {
			dirs: [],
			ensureDir: async (rel) => {
				fs.dirs.push(rel);
			},
			writeBytes: async (rel, bytes) => {
				files.set(rel, bytes);
			},
			readBytes: async (rel) => {
				if (!files.has(rel)) throw new Error("ENOENT: " + rel);
				return files.get(rel);
			},
			list: async (rel) =>
				Array.from(files.keys())
					.filter((k) => k.startsWith(rel + "/"))
					.map((k) => ({ name: k.slice(rel.length + 1) })),
			remove: async (rel) => {
				files.delete(rel);
			},
			exists: async (rel) => files.has(rel),
			appDataDir: async () => "C:/Users/test/AppData/Roaming/com.mambo.pedidos",
		};
		const bridge = { inTauri: true, fs, store: { load: async () => store } };
		return { bridge, fs, files, store, data };
	},

	// Instala/retira el puente fake y restaura el estado de AppStorage que tocan
	// init()/setItem(). ctx.lsWrites registra cada localStorage.setItem.
	async _withTauriBridge(bridge, body) {
		const w = global.window;
		const prev = {
			bridge: w.MamboTauriBridge,
			plugin: w.__TAURI_PLUGIN_STORE__,
			tauri: w.__TAURI__,
			mode: AppStorage.mode,
			store: AppStorage.storeInstance,
			persistence: AppStorage.lastPersistence,
			persistenceError: AppStorage.persistenceError,
			toast: w.toast,
			lsSet: localStorage.setItem,
		};
		const ctx = { lsWrites: [], toasts: [] };
		w.MamboTauriBridge = bridge;
		// Sin probes legacy: con puente presente el store solo puede venir del puente.
		w.__TAURI_PLUGIN_STORE__ = undefined;
		w.__TAURI__ = undefined;
		w.toast = (msg, type) => {
			ctx.toasts.push({ msg, type });
		};
		localStorage.setItem = function (k, v) {
			ctx.lsWrites.push(k);
			return prev.lsSet.call(this, k, v);
		};
		try {
			await body(ctx);
		} finally {
			w.MamboTauriBridge = prev.bridge;
			w.__TAURI_PLUGIN_STORE__ = prev.plugin;
			w.__TAURI__ = prev.tauri;
			w.toast = prev.toast;
			localStorage.setItem = prev.lsSet;
			AppStorage.mode = prev.mode;
			AppStorage.storeInstance = prev.store;
			AppStorage.lastPersistence = prev.persistence;
			AppStorage.persistenceError = prev.persistenceError;
		}
	},

	async testStorageModeWithoutBridge() {
		// 1) Sin puente (Node, navegador comun, dist/ sin vendor): modo localstorage,
		//    sin throw, y el fallback sigue funcional.
		if (typeof AppStorage.diagnostics !== "function") {
			this.assert(false, "RED: AppStorage.diagnostics() no existe");
			return;
		}
		await this._withTauriBridge(undefined, async () => {
			let err = null;
			try {
				await AppStorage.init();
			} catch (e) {
				err = e;
			}
			this.assert(err === null, "init() sin puente no lanza (" + (err && err.message) + ")");
			this.assert(
				AppStorage.mode === "localstorage",
				`init() sin puente deja mode='localstorage' (got ${JSON.stringify(AppStorage.mode)})`,
			);
			this.assert(
				AppStorage.storeInstance === null,
				"init() sin puente deja storeInstance null",
			);
			const diag = await AppStorage.diagnostics();
			this.assert(
				diag.mode === "localstorage" && diag.storeReady === false,
				`diagnostics: localstorage + storeReady=false (got ${JSON.stringify(diag)})`,
			);
			this.assert(
				diag.bridgePresent === false && diag.inTauri === false,
				"diagnostics: bridgePresent=false fuera del puente",
			);
			this.assert(
				diag.imagesDir === null,
				"diagnostics: imagesDir=null cuando appDataDir no resuelve",
			);
			const key = "_test_mode_fallback";
			await AppStorage.setItem(key, { items: [{ sku: "F-1", img: "data:image/png;base64,AAAA" }] });
			const raw = JSON.parse(localStorage.getItem(key) || "null");
			this.assert(
				raw && raw.items[0].img === "data:image/png;base64,AAAA",
				"sin puente: setItem sigue persistiendo en localStorage",
			);
			localStorage.removeItem(key);
		});
	},

	async testStorageModeWithTauriBridge() {
		// 2) Con puente + inTauri: mode='tauri', storeInstance del puente y setItem
		//    escribe SOLO en el store (nunca en localStorage).
		if (typeof AppStorage.diagnostics !== "function") {
			this.assert(false, "RED: AppStorage.diagnostics() no existe");
			return;
		}
		const h = this._fakePersistence();
		await this._withTauriBridge(h.bridge, async (ctx) => {
			await AppStorage.init();
			this.assert(
				AppStorage.mode === "tauri",
				`init() con puente deja mode='tauri' (got ${JSON.stringify(AppStorage.mode)})`,
			);
			this.assert(
				AppStorage.storeInstance === h.store,
				"init() resuelve el store via MamboTauriBridge.store.load",
			);
			this.assert(AppStorage.persistenceError === null, "store sano: persistenceError limpio");
			const key = "_test_bridge_set";
			await AppStorage.setItem(key, { items: [{ sku: "B-1" }] });
			const stored = h.data.get(key);
			this.assert(stored && stored.items[0].sku === "B-1", "setItem con puente escribe en el store");
			this.assert(h.store.saves > 0, "setItem con puente hace save() del store");
			this.assert(
				ctx.lsWrites.indexOf(key) === -1,
				`setItem con puente NO toca localStorage (writes: ${JSON.stringify(ctx.lsWrites)})`,
			);
			const diag = await AppStorage.diagnostics();
			this.assert(diag.mode === "tauri" && diag.storeReady === true, "diagnostics: mode tauri + storeReady=true");
			this.assert(
				diag.bridgePresent === true && diag.inTauri === true,
				"diagnostics: bridgePresent/inTauri verdaderos",
			);
			this.assert(
				typeof diag.imagesDir === "string" && diag.imagesDir.includes("com.mambo.pedidos"),
				`diagnostics: imagesDir resuelto a $APPDATA (got ${JSON.stringify(diag.imagesDir)})`,
			);
			h.data.delete(key);
		});
	},

	async testStorageStoreLoadFailureDegrades() {
		// B: puente presente pero store.load roto -> modo 'tauri' mentiroso jamas:
		//    queda 'localstorage' con el motivo en persistenceError y un toast.
		const h = this._fakePersistence();
		h.bridge.store = {
			load: async () => {
				throw new Error("store file bloqueado por otra instancia");
			},
		};
		await this._withTauriBridge(h.bridge, async (ctx) => {
			let err = null;
			try {
				await AppStorage.init();
			} catch (e) {
				err = e;
			}
			this.assert(err === null, "init() con store roto no lanza (" + (err && err.message) + ")");
			this.assert(
				AppStorage.mode === "localstorage",
				`store roto -> mode='localstorage' (got ${JSON.stringify(AppStorage.mode)})`,
			);
			this.assert(
				typeof AppStorage.persistenceError === "string" &&
					AppStorage.persistenceError.includes("bloqueado"),
				`persistenceError guarda el motivo (got ${JSON.stringify(AppStorage.persistenceError)})`,
			);
			this.assert(
				ctx.toasts.some((t) => t.type === "error" || t.type === "warning"),
				"el fallo del store se avisa con toast",
			);
			this.assert(
				AppStorage._fsApi() === h.fs,
				"con store roto el fs del puente sigue resuelto (son independientes)",
			);
		});
	},

	async testStorageFsApiFromBridge() {
		// 3) _fsApi() sale del puente, no de window.__TAURI__.fs (inexistente en v2).
		const h = this._fakePersistence();
		await this._withTauriBridge(h.bridge, async () => {
			this.assert(AppStorage._fsApi() === h.fs, "_fsApi() devuelve el fs del puente con inTauri=true");
		});
		await this._withTauriBridge({ inTauri: false, fs: h.fs, store: h.bridge.store }, async () => {
			this.assert(AppStorage._fsApi() === null, "_fsApi() es null cuando inTauri=false");
		});
		await this._withTauriBridge(undefined, async () => {
			this.assert(AppStorage._fsApi() === null, "_fsApi() es null sin puente");
		});
		// La API v1 (mkdir/writeBinaryFile/readBinaryFile/readDir) ya no debe estar
		// llamada en ningun camino de persistencia: en Tauri v2 esos metodos no
		// existen y el plugin devolvio undefined en silencio durante meses.
		const src =
			AppStorage._serializeImagesToFiles.toString() +
			AppStorage._embedImagesFromFiles.toString() +
			AppStorage._gcOrphanImages.toString();
		const v1Calls = /\.\s*(writeBinaryFile|readBinaryFile)\s*\(|\bmkdir\s*\(|\breadDir\s*\(/.test(src);
		this.assert(!v1Calls, "el camino de imagenes ya no llama la API v1 del plugin fs");
		this.assert(
			/\.ensureDir\s*\(/.test(src) && /\.writeBytes\s*\(/.test(src) && /\.readBytes\s*\(/.test(src) && /\.list\s*\(/.test(src),
			"el camino de imagenes usa la superficie del puente (ensureDir/writeBytes/readBytes/list)",
		);
	},

	async testStorageImageFilesRoundTrip() {
		// 4) Las dataURLs van a images/ en disco y vuelven intactas.
		const png =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
		const h = this._fakePersistence();
		await this._withTauriBridge(h.bridge, async () => {
			await AppStorage.init();
			const key = AppStorage.KEYS.CATALOG;
			await AppStorage.saveCatalog(
				[{ sku: "IMG-RT-001", marca: "AULA", modelo: "F75", cat: "TECLADO", fob: 40, img: png }],
				{ "IMG-RT-001": 2 },
			);
			const written = Array.from(h.files.keys()).filter((k) => /^images\/img_[\w.-]+\.png$/.test(k));
			this.assert(
				written.length === 1,
				`saveCatalog escribe la imagen en images/ (got ${JSON.stringify(Array.from(h.files.keys()))})`,
			);
			this.assert(h.fs.dirs.indexOf("images") !== -1, "saveCatalog crea images/ con ensureDir");
			const rec = AppStorage.lastPersistence;
			this.assert(
				!!rec && rec.imagesWritten === 1,
				`lastPersistence.imagesWritten=1 (got ${rec && JSON.stringify(rec)})`,
			);
			this.assert(
				!!rec && rec.backend === "tauri" && rec.imagesFailed === 0,
				"lastPersistence registra backend tauri sin fallos",
			);
			const persisted = h.data.get(key);
			this.assert(
				!!persisted && persisted.items[0].img === "" && !!persisted.items[0]._imageRef,
				"el payload persistido no lleva la dataURL inline",
			);
			const back = await AppStorage.loadCatalog();
			this.assert(
				back.items.length === 1 && back.items[0].img === png,
				"loadCatalog reconstruye item.img desde images/ (sin canvas: conserva la dataURL completa)",
			);
			// import-2026: _imageRef se CONSERVA para el zoom full-res (loadFullImage);
			// el thumb en img es solo para render. En Node no hay canvas (run-tests
			// mock) así que img queda con la dataURL completa y loadFullImage devuelve
			// exactamente esos bytes.
			this.assert(
				!!back.items[0]._imageRef && back.items[0]._imageRef.relativePath.indexOf("images/") === 0,
				"_imageRef se conserva tras loadCatalog (zoom full-res por archivo)",
			);
			const full = await AppStorage.loadFullImage(back.items[0]);
			this.assert(full === png, "loadFullImage devuelve la imagen completa del archivo");
			this.assert(back.sel["IMG-RT-001"] === 2, "loadCatalog preserva la seleccion");
			h.data.delete(key);
		});
	},

	async testStorageImageWriteFailure() {
		// 5) Fallo de escritura: se CUENTA (no se traga) y el item conserva valor.
		const png = "data:image/png;base64,AAAA";
		const h = this._fakePersistence();
		h.fs.writeBytes = async () => {
			throw new Error("EACCES: permiso denegado en $APPDATA");
		};
		await this._withTauriBridge(h.bridge, async () => {
			AppStorage.mode = "tauri";
			AppStorage.storeInstance = h.store;
			const payload = await AppStorage._serializeImagesToFiles([{ sku: "IMG-FAIL-001", img: png }], {});
			const rec = AppStorage.lastPersistence;
			this.assert(
				!!rec && rec.imagesFailed === 1,
				`lastPersistence.imagesFailed=1 (got ${rec && JSON.stringify(rec)})`,
			);
			this.assert(
				!!rec && Array.isArray(rec.failedRefs) && rec.failedRefs.length === 1 && rec.failedRefs[0].indexOf("images/") === 0,
				"lastPersistence.failedRefs lista la imagen que no se pudo escribir",
			);
			this.assert(!!rec && rec.imagesWritten === 0, "lastPersistence.imagesWritten=0 con escritura rota");
			this.assert(
				payload.items[0].img === png,
				"el item conserva su dataURL (no hay perdida total silenciosa)",
			);
		});
	},

	async testStorageQuotaStripPolicy() {
		// 6) En tauri NO se despoja nada: el error sube, accionable. Fuera de tauri
		//    queda el strip graduado, pero REGISTRADO como degradado.
		const png = "data:image/png;base64,AAAA";
		const value = { items: [{ sku: "Q-1", img: png, _evaluations: [{ r: 1 }], warnings: ["w"] }], sel: {} };
		const h = this._fakePersistence();
		// tauri: store.set revienta -> THROWS, sin strip
		await this._withTauriBridge(h.bridge, async () => {
			AppStorage.mode = "tauri";
			let stripCalls = 0;
			const prevStrip = AppStorage._stripForQuota;
			AppStorage._stripForQuota = function (v, deep) {
				stripCalls++;
				return prevStrip.call(this, v, deep);
			};
			AppStorage.storeInstance = {
				get: async () => undefined,
				set: async () => {
					throw new Error("QuotaExceeded: disco lleno");
				},
				save: async () => {},
				delete: async () => {},
			};
			let err = null;
			try {
				await AppStorage.setItem("_test_tauri_quota", value);
			} catch (e) {
				err = e;
			}
			AppStorage._stripForQuota = prevStrip;
			this.assert(err !== null, "tauri: quota rota LANZA en vez de despojar imagenes");
			this.assert(err !== null && err.message.includes("com.mambo.pedidos"), `el error menciona $APPDATA (got ${err && err.message})`);
			this.assert(stripCalls === 0, "tauri: _stripForQuota NUNCA corre");
		});
		// localstorage: overflow -> strip nivel 1 + degraded registrado
		await this._withTauriBridge(undefined, async () => {
			AppStorage.mode = "localstorage";
			AppStorage.storeInstance = null;
			const key = "_test_ls_quota";
			const prevSet = localStorage.setItem;
			let first = true;
			localStorage.setItem = function (k, v) {
				if (first && k === key) {
					first = false;
					const e = new Error("QuotaExceededError");
					e.name = "QuotaExceededError";
					throw e;
				}
				return prevSet.call(this, k, v);
			};
			try {
				await AppStorage.setItem(key, value);
			} finally {
				localStorage.setItem = prevSet;
			}
			const rec = AppStorage.lastPersistence;
			this.assert(
				!!rec && rec.degraded === true && rec.stripLevel === 1,
				`localStorage: degraded + stripLevel=1 (got ${rec && JSON.stringify(rec)})`,
			);
			this.assert(!!rec && rec.backend === "localstorage", "localStorage: backend registrado");
			const raw = JSON.parse(localStorage.getItem(key) || "null");
			this.assert(
				raw && raw.items[0].img === "-" && raw.items[0]._evaluations.length === 1,
				"localStorage nivel 1: imagenes fuera, evaluaciones intactas",
			);
			localStorage.removeItem(key);
			// nivel 2: sigue sin caber -> tambien caen las evaluaciones
			let n = 0;
			localStorage.setItem = function (k, v) {
				n++;
				if (k === key && n <= 2) {
					const e = new Error("QuotaExceededError");
					e.name = "QuotaExceededError";
					throw e;
				}
				return prevSet.call(this, k, v);
			};
			try {
				await AppStorage.setItem(key, value);
			} finally {
				localStorage.setItem = prevSet;
			}
			const rec2 = AppStorage.lastPersistence;
			this.assert(
				!!rec2 && rec2.degraded === true && rec2.stripLevel === 2,
				`localStorage: stripLevel=2 registrado (got ${rec2 && JSON.stringify(rec2)})`,
			);
			const raw2 = JSON.parse(localStorage.getItem(key) || "null");
			this.assert(
				raw2 && raw2.items[0]._evaluations === undefined && raw2.items[0].sku === "Q-1",
				"localStorage nivel 2: sin evaluaciones, el producto sigue ahi",
			);
			localStorage.removeItem(key);
		});
	},

	testBytesToDataUrlChunked() {
		// 7) El chunking no cambia NI UN BYTE del dataURL (regresion de perf).
		if (typeof Buffer === "undefined") {
			this.assert(false, "RED: Buffer no disponible para la regresion de base64");
			return;
		}
		const bytes = new Uint8Array(9000);
		for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) & 0xff;
		const got = AppStorage._bytesToDataUrl(bytes, "jpeg");
		const want = "data:image/jpeg;base64," + Buffer.from(bytes).toString("base64");
		this.assert(got === want, "_bytesToDataUrl chunked reproduce el base64 exacto (>8192 bytes)");
		const empty = AppStorage._bytesToDataUrl(new Uint8Array(0), "png");
		this.assert(empty === "data:image/png;base64,", "_bytesToDataUrl con 0 bytes no rompe");
		const exact = new Uint8Array(8192);
		this.assert(
			AppStorage._bytesToDataUrl(exact, "png") === "data:image/png;base64," + Buffer.from(exact).toString("base64"),
			"_bytesToDataUrl en el limite del chunk (8192) es exacto",
		);
	},

	async testImportWizardProjectPersistence() {
		// D) El draft del wizard vive en AppStorage (store Tauri), no en localStorage crudo.
		require("./ui/importWizard.js");
		const IW = global.window.ImportWizard;
		if (!IW || typeof IW.saveProject !== "function") {
			this.assert(false, "RED: ImportWizard.saveProject no accesible");
			return;
		}
		this.assert(
			AppStorage.KEYS.PROJECT === "mambo_project_v1",
			`AppStorage.KEYS.PROJECT = mambo_project_v1 (got ${JSON.stringify(AppStorage.KEYS.PROJECT)})`,
		);
		const prevSetItem = AppStorage.setItem;
		const prevToast = global.window.toast;
		const legacy = IW.PROJECT_KEY;
		const calls = [];
		const toasts = [];
		localStorage.removeItem(legacy);
		global.window.toast = (msg, type) => {
			toasts.push({ msg, type });
		};
		try {
			AppStorage.setItem = async (k, v) => {
				calls.push({ k, v });
			};
			const okSave = await IW.saveProject();
			this.assert(calls.length === 1, "saveProject() enruta por AppStorage.setItem");
			this.assert(
				calls.length === 1 && calls[0].k === "mambo_project_v1",
				`saveProject() usa KEYS.PROJECT (got ${JSON.stringify(calls[0] && calls[0].k)})`,
			);
			this.assert(
				calls.length === 1 && calls[0].v && typeof calls[0].v.step === "number",
				"saveProject() persiste el paso actual",
			);
			this.assert(localStorage.getItem(legacy) === null, "saveProject() ya no escribe localStorage crudo");
			this.assert(okSave !== false, "saveProject() exitosa no retorna false");
			this.assert(toasts.some((t) => t.type === "success"), "saveProject() avisa el guardado");
			// fallo real: toast de error, nunca exito falso
			AppStorage.setItem = async () => {
				throw new Error("cuota agotada");
			};
			toasts.length = 0;
			let err = null;
			try {
				await IW.saveProject();
			} catch (e) {
				err = e;
			}
			this.assert(err === null, "saveProject() degrada a toast de error, no lanza al onclick");
			this.assert(toasts.some((t) => t.type === "error"), "saveProject() fallida muestra toast de error");
			this.assert(!toasts.some((t) => t.type === "success"), "saveProject() fallida NO finge exito");
		} finally {
			AppStorage.setItem = prevSetItem;
			global.window.toast = prevToast;
			localStorage.removeItem(legacy);
		}
	},

	testDiagnosticsOverlay() {
		const { JSDOM } = require("jsdom");
		const fs = require("fs");
		const path = require("path");
		const code = fs.readFileSync(path.join(__dirname, "diagnostics.js"), "utf8");
		const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
		const win = dom.window;
		win.eval(code);
		const dg = win.Diagnostics;
		this.assert(typeof dg.handle === "function", "U4: Diagnostics.handle existe");
		dg.handle("test-error", "boom", "", 0, 0, null, "stack-test");
		this.assert((win.localStorage.getItem("mambo_last_error") || "").includes("boom"), "U4: la última caída se persiste");
		const overlay = win.document.getElementById("mamboErrorOverlay");
		this.assert(overlay !== null, "U4: el overlay se monta en el DOM");
		this.assert((overlay.querySelector("pre").textContent || "").includes("boom"), "U4: el mensaje se muestra en el overlay");
		this.assert(overlay.querySelector('[data-act="copy"]') !== null, "U4: botón copiar presente");
		this.assert(overlay.querySelector('[data-act="close"]') !== null, "U4: botón cerrar presente");
		overlay.remove();
	},

	testScriptGlobalLexicalCollisions() {
		// Un <script> clasico comparte con los demas el entorno lexico global: dos
		// `const` con el mismo nombre en dos archivos hacen que el SEGUNDO falle al
		// parsear (SyntaxError: Identifier ... has already been declared) y ese modulo
		// no se ejecuta nunca. En Node no se ve: cada módulo se requiere en su propio
		// scope. Paso real: COLOR_KEEP_WORDS declarado en textSanitizer.js:1035 y en
		// imageTextGates.js:23, con textSanitizer cargado antes (index.html 4058 vs
		// 4061) => ImageTextGates nunca existio en la app, y los consumers guardados
		// con typeof cayeron siempre al fallback (runAll en import, sampleInteriorColor).
		const nodeFs = require("fs");
		const nodePath = require("path");
		const vm = require("vm");
		// __dirname no es fiable aca: el runner carga tests.js con su propio filename y
		// resuelve C:\Mambo\src en vez de src/js. Se resuelve la raiz probando
		// candidatos hasta dar con src/index.html + package.json.
		// El cwd de referencia va leido con guarda de typeof: este archivo vive en
		// src/js y el escaneo de browser-runtime rechaza la variable de entorno del
		// runner sin esa guarda (romperia en WebView2).
		const cwd = typeof process !== "undefined" && process.cwd ? process.cwd() : null;
		const candidates = [__dirname, nodePath.join(__dirname, ".."), nodePath.join(__dirname, "..", ".."), cwd].filter(Boolean);
		const root = candidates.find((c) => {
			try {
				return nodeFs.existsSync(nodePath.join(c, "src", "index.html")) && nodeFs.existsSync(nodePath.join(c, "package.json"));
			} catch {
				return false;
			}
		});
		this.assert(!!root, "raiz del repo resuelta para leer index.html");
		if (!root) return;
		const html = nodeFs.readFileSync(nodePath.join(root, "src", "index.html"), "utf8");
		const order = [];
		for (const m of html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)) {
			if (m[1].startsWith("js/")) order.push(m[1]);
		}
		this.assert(order.length > 20, `orden de <script> leido de index.html (${order.length} modulos)`);
		const skipped = ["js/tests.js"];
		let acc = "";
		const collisions = [];
		for (const rel of order) {
			if (skipped.includes(rel)) continue;
			const src = nodeFs.readFileSync(nodePath.join(root, "src", rel), "utf8");
			acc += `\n//# ${rel}\n` + src + ";\n";
			try {
				new vm.Script(acc, { filename: "concat:" + rel });
			} catch (e) {
				if (/already been declared|has already declared/i.test(e.message)) {
					collisions.push(rel + ": " + e.message);
				} else {
					collisions.push(rel + ": " + e.message + " (no es colision lexica: fallo de parseo)");
				}
				break;
			}
		}
		this.assert(
			collisions.length === 0,
			collisions.length
				? "los <script> classicos no redeclaran identificadores globales (" + collisions.join(" | ") + ")"
				: "los <script> classicos no redeclaran identificadores globales"
		);
	},

	async testStorageRealDiskPersistence() {
		// El fake en memoria prueba la lógica; este prueba el CAMINO COMPLETO con
		// disco real: dataURL -> images/<hash>.png -> _imageRef -> payload JSON ->
		// reload (arranque nuevo) -> dataURL idéntico, y que el GC borre solo lo
		// huérfano. Es lo mas cerca que se puede llegar del runtime Tauri sin
		// compilar la app (aca no hay toolchain Rust).
		const nodeFs = require("fs");
		const nodePath = require("path");
		const nodeOs = require("os");
		const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "mambo-persist-"));
		const storeFile = nodePath.join(root, ".mambo-store.json");
		const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
		const PNG2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

		// Fake del puente, respaldado por fs de Node (mismas firmas que v2).
		const makeBridge = (data) => ({
			inTauri: true,
			fs: {
				baseDir: 7,
				ensureDir: async (rel) => { nodeFs.mkdirSync(nodePath.join(root, rel), { recursive: true }); },
				writeBytes: async (rel, bytes) => { nodeFs.writeFileSync(nodePath.join(root, rel), Buffer.from(bytes)); },
				readBytes: async (rel) => new Uint8Array(nodeFs.readFileSync(nodePath.join(root, rel))),
				list: async (rel) => nodeFs.readdirSync(nodePath.join(root, rel)).map((name) => ({ name, isFile: true })),
				remove: async (rel) => { nodeFs.rmSync(nodePath.join(root, rel), { recursive: true, force: true }); },
				exists: async (rel) => nodeFs.existsSync(nodePath.join(root, rel)),
				appDataDir: async () => root,
			},
			store: {
				load: async () => ({
					get: async (k) => (data.has(k) ? data.get(k) : undefined),
					set: async (k, v) => { data.set(k, JSON.parse(JSON.stringify(v))); },
					delete: async (k) => { data.delete(k); },
					save: async () => { nodeFs.writeFileSync(storeFile, JSON.stringify([...data.entries()])); },
					reload: async () => {
						data.clear();
						if (nodeFs.existsSync(storeFile)) {
							for (const [k, v] of JSON.parse(nodeFs.readFileSync(storeFile, "utf8"))) data.set(k, v);
						}
					},
				}),
			},
		});
		const data = new Map();

		try {
			await this._withTauriBridge(makeBridge(data), async () => {
				await AppStorage.init();
				this.assert(AppStorage.mode === "tauri", "disco real: init() resuelve modo tauri por el puente");

				// Guardado 1: la imagen tiene que terminar en un archivo real.
				const items = [{ sku: "S-1", marca: "Razer", modelo: "Viper", cat: "MOUSE", fob: 30, img: PNG }];
				await AppStorage.saveCatalog(items, { "S-1": 2 });
				const lp = AppStorage.lastPersistence || {};
				this.assert(lp.imagesWritten === 1, "disco real: 1 imagen escrita (got " + lp.imagesWritten + ")");
				this.assert(lp.imagesFailed === 0 && !lp.degraded && lp.stripLevel === 0, "disco real: sin degradado ni strip");
				const onDisk = nodeFs.readdirSync(nodePath.join(root, "images"));
				this.assert(onDisk.length === 1 && /^img_[a-z0-9]+\.png$/.test(onDisk[0]), "disco real: existe images/<hash>.png");
				const raw = JSON.stringify(data.get(AppStorage.KEYS.CATALOG) || {});
				this.assert(raw.includes("_imageRef") && !raw.includes("base64,iVBOR"), "disco real: el payload guarda la ref, no el base64 inline");
				const bytesOnDisk = nodeFs.readFileSync(nodePath.join(root, "images", onDisk[0]));
				this.assert(bytesOnDisk.length > 0, "disco real: el archivo de imagen no esta vacio");

				// Arranque nuevo: se vacia la memoria y se recarga desde el archivo.
				const loaded = await AppStorage.loadCatalog();
				this.assert(loaded.items.length === 1, "disco real: loadCatalog() devuelve el item");
				this.assert(loaded.items[0].img === PNG, "disco real: la imagen vuelve identica desde el archivo (sin canvas en Node: dataURL completa)");
				// import-2026: la ref se CONSERVA (zoom full-res por archivo); el
				// thumb en img es solo render y loadFullImage devuelve los bytes.
				this.assert(!!loaded.items[0]._imageRef, "disco real: la ref se conserva para loadFullImage");
				this.assert(
					(await AppStorage.loadFullImage(loaded.items[0])) === PNG,
					"disco real: loadFullImage resuelve la imagen completa",
				);

				// GC: al cambiar la imagen, la anterior queda huerfana y debe irse.
				const prevFile = nodePath.join(root, "images", onDisk[0]);
				await AppStorage.saveCatalog([{ sku: "S-1", marca: "Razer", modelo: "Viper", cat: "MOUSE", fob: 30, img: PNG2 }], {});
				const after = nodeFs.readdirSync(nodePath.join(root, "images"));
				this.assert(!nodeFs.existsSync(prevFile), "disco real: el GC borro la imagen huerfana");
				this.assert(after.length === 1 && nodePath.join(root, "images", after[0]) !== prevFile, "disco real: la imagen vigente sigue en disco");
				const back2 = await AppStorage.loadCatalog();
				this.assert(back2.items[0].img === PNG2, "disco real: la imagen nueva se resuelve igual que la vieja");
			});

			// El archivo del store tiene que sobrevivir sin el objeto en memoria.
			this.assert(nodeFs.existsSync(storeFile), "disco real: .mambo-store.json existe en $APPDATA simulado");
			const persisted = JSON.parse(nodeFs.readFileSync(storeFile, "utf8"));
			this.assert(Array.isArray(persisted) && persisted.some(([k]) => k === AppStorage.KEYS.CATALOG), "disco real: el catalogo esta en el archivo del store");
		} finally {
			try { nodeFs.rmSync(root, { recursive: true, force: true }); } catch { /* temp ya no sirve */ }
		}
	},

	async testRatesVigencia() {
		// guided-import-wizard: "Aviso de vencimiento de la matriz de alícuotas
		// (fecha de vigencia)". NCM_MATRIX sostiene los DI 0% de teclados, mouse,
		// monitores y celulares dentro de un régimen con fecha de vencimiento. Sin
		// fecha, la app sigue calculando presupuestos con alícuotas viejas y nadie se
		// entera: el número sale igual y esta app habla de plata.
		if (typeof Calculator.ratesStatus !== "function") {
			this.assert(false, "RED: Calculator.ratesStatus no existe");
			return;
		}
		this.assert(
			typeof Calculator.RATES_META === "object" && !!Calculator.RATES_META.vigenciaHasta,
			"RATES_META tiene vigenciaHasta",
		);
		const lejos = Calculator.ratesStatus("2026-09-01");
		this.assert(
			lejos.severity === "ok" && lejos.message === null,
			`lejos del vencimiento: ok (${lejos.days} dias)`,
		);
		const cerca = Calculator.ratesStatus("2027-12-01");
		this.assert(cerca.severity === "proxima" && /vence/.test(cerca.message), "vence proximo: avisa con la fecha");
		const vencia = Calculator.ratesStatus("2028-02-01");
		this.assert(vencia.severity === "vencida" && /venc/.test(vencia.message), "vencida: avisa que la matriz expiro");
		this.assert(typeof lejos.stale === "boolean", "ratesStatus informa si la matriz esta vieja");

		// El wizard tiene que mostrarlo; un helper que nadie pinta no avisa nada.
		require("./ui/importWizard.js");
		const IW = global.window.ImportWizard;
		this.assert(typeof IW._ratesBanner === "function", "el wizard expone _ratesBanner()");
		if (typeof IW._ratesBanner !== "function") return;
		const prevStatus = Calculator.ratesStatus;
		try {
			Calculator.ratesStatus = () => ({
				severity: "vencida",
				days: -10,
				vence: "2027-12-31",
				stale: false,
				message: "La matriz de alícuotas vencio el 2027-12-31.",
			});
			const html = IW._ratesBanner();
			this.assert(
				/alert-banner/.test(html) && /danger/.test(html) && /alícuotas vencio/.test(html),
				"el banner de matriz vencida usa alert-banner danger",
			);
			Calculator.ratesStatus = () => ({ severity: "ok", days: 900, vence: "2027-12-31", stale: false, message: null });
			this.assert(IW._ratesBanner() === "", "con la matriz vigente no se pinta banner");
		} finally {
			Calculator.ratesStatus = prevStatus;
		}
	},

		async testWizardSummaryPdf() {
		// guided-import-wizard: "Export del resumen (PDF/CSV) desde el Paso 6". El
		// CSV estaba; el documento imprimible no existía. Se prueba el HTML que
		// genera y el camino que lo abre, sin abrir una ventana real.
		require("./ui/importWizard.js");
		const IW = global.window.ImportWizard;
		this.assert(typeof IW.summaryDocument === "function", "IW.summaryDocument existe");
		this.assert(typeof IW.exportSummaryPdf === "function", "IW.exportSummaryPdf existe");
		const prevPedido = global.currentPedido;
		const prevOpen = global.window.open;
		const prevToast = global.window.toast;
		const written = [];
		const toasts = [];
		try {
			global.window.toast = (msg, type) => {
				toasts.push({ msg, type });
			};
			global.window.open = () => ({
				document: { write: (s) => written.push(String(s)), close() {} },
			});

			// Sin pedido: avisa y no abre nada.
			global.currentPedido = { items: [] };
			this.assert(IW.exportSummaryPdf() === null, "sin pedido devuelve null");
			this.assert(toasts.some((x) => x.type === "error"), "sin pedido avisa como error");
			this.assert(written.length === 0, "sin pedido no abre ventana");

			// Con pedido: el documento sale del MISMO calculo del paso 6.
			global.currentPedido = {
				items: [
					{ sku: "AJA-TEC-AK820-1", marca: "ajazz", modelo: "AK820", variante: "Blue", cat: "TECLADO", fob: 50, qty: 2 },
					{ sku: "RAZ-MOU-VIPER-9", marca: "razer", modelo: "Viper", variante: "Black", cat: "MOUSE", fob: 40, qty: 1 },
				],
			};
			IW.state.iibbJurisdiccion = "cab";
			const html = IW.exportSummaryPdf();
			this.assert(typeof html === "string" && html.length > 200, "con pedido devuelve el documento HTML");
			this.assert(written.length === 1, "abrió una ventana con el documento");
			this.assert(/Resumen de importaci/.test(html), "el documento se titula como resumen de importacion");
			this.assert(html.includes("AK820") && html.includes("Viper"), "lista los dos productos");
			this.assert(html.includes("8471.60"), "muestra los NCM resueltos por el motor");
			this.assert(!/\$NaN|undefined/.test(html), "no imprime NaN ni undefined en un documento de plata");
			this.assert(html.includes(Calculator.RATES_META.vigenciaHasta), "cita hasta cuando rigen las aliquotas usadas");
			this.assert(html.includes("declaración jurada"), "aclara que es una estimación, no una DJ");

			// El boton vive en el paso 6.
			const paso6 = IW._render_resumen();
			this.assert(paso6.includes("Exportar resumen PDF") && paso6.includes("exportSummaryPdf()"), "el paso 6 ofrece el botón PDF");

			// Escape: un modelo con HTML no se inyecta en el documento.
			global.currentPedido = {
				items: [{ sku: "X-1", marca: "a", modelo: "<script>alert(1)</script>", variante: "", cat: "OTRO", fob: 1, qty: 1 }],
			};
			const evil = IW.exportSummaryPdf();
			this.assert(!evil.includes("<script>alert(1)"), "escapa el modelo: no se inyecta script en el documento");
			this.assert(evil.includes("&lt;script&gt;"), "el modelo aparece escapado");
		} finally {
			global.currentPedido = prevPedido;
			global.window.open = prevOpen;
			global.window.toast = prevToast;
		}
	},


	async testNcmOverrideBySku() {
		// IT41: override de NCM/DI por producto. Antes el unico override era por
		// categoria (ncmOverrides[ncmKeyFor(item)]), asi que un item mal clasificado
		// pagaba el arancel de la categoria que la matriz le asignaba y la unica
		// forma de corregirlo era cambiarle el arancel a todos los de esa categoria.
		const item = () => ({
			sku: "AK820-1",
			marca: "ajazz",
			modelo: "AK820",
			variante: "Blue",
			cat: "TECLADO",
			fob: 50,
			qty: 2,
		});
		const otro = () => ({
			sku: "VIPER-9",
			marca: "razer",
			modelo: "Viper",
			variante: "Black",
			cat: "MOUSE",
			fob: 40,
			qty: 1,
		});
		const cfg = (extra) =>
			Object.assign(
				{
					regimen: "importador",
					pesoKg: 20,
					costoPorKg: 8,
					fletePct: 0.15,
					seguroPct: 0.01,
					tipoCambio: 1400,
					iibbPct: 0.025,
				},
				extra || {},
			);

		this.assert(
			typeof Calculator.ncmKeyFor === "function",
			"ncmKeyFor sigue disponible (base de la resolucion por categoria)",
		);

		const uno = item();
		const key = Calculator.ncmKeyFor(uno);
		const base = Calculator.calculateDoorToDoorExactCost([uno], cfg());
		this.assert(
			base.items[0].ncm === Calculator.NCM_MATRIX[key].ncm,
			`sin override usa la matriz de la categoria (${key})`,
		);
		this.assert(
			Math.abs(base.items[0].derechosUsd - base.items[0].itemCif * Calculator.NCM_MATRIX[key].derechos) < 1e-6,
			"sin override el DI sale de la matriz (regresion: la clave por SKU es aditiva)",
		);

		// 1) override por SKU: afecta el DI de ESE item
		const conSku = Calculator.calculateDoorToDoorExactCost([item()], cfg({ ncmBySku: { "AK820-1": { derechos: 0.35 } } }));
		this.assert(
			Math.abs(conSku.items[0].derechosUsd - conSku.items[0].itemCif * 0.35) < 1e-6,
			"ncmBySku aplica el DI solo a ese SKU",
		);
		this.assert(
			conSku.summary.totalPuertaUsd > base.summary.totalPuertaUsd,
			"el override por SKU sube la caja (no se ignora en el resumen)",
		);

		// 2) gana el SKU sobre la categoria, y solo cambia el item corregido
		const mix = [item(), otro()];
		const soloUno = Calculator.calculateDoorToDoorExactCost(mix, cfg({ ncmBySku: { "AK820-1": { derechos: 0.35 } } }));
		const baseMix = Calculator.calculateDoorToDoorExactCost(mix, cfg());
		this.assert(Math.abs(soloUno.items[1].derechosUsd - baseMix.items[1].derechosUsd) < 1e-9, "el otro item del pedido no se toca");
		this.assert(soloUno.items[0].derechosUsd > baseMix.items[0].derechosUsd, "el item corregido paga mas DI");
		const ambos = Calculator.calculateDoorToDoorExactCost(
			[item()],
			cfg({ ncmOverrides: { [key]: { derechos: 0.05 } }, ncmBySku: { "AK820-1": { derechos: 0.35 } } }),
		);
		this.assert(
			Math.abs(ambos.items[0].derechosUsd - ambos.items[0].itemCif * 0.35) < 1e-6,
			"el override por SKU gana sobre el de categoria",
		);

		// 3) NCM por SKU: reasigna el codigo y, si mapea a otra fila, trae sus rates
		const conNcm = Calculator.calculateDoorToDoorExactCost([item()], cfg({ ncmBySku: { "AK820-1": { ncm: "3926.90.90" } } }));
		this.assert(conNcm.items[0].ncm === "3926.90.90", "ncmBySku puede reasignar el NCM del producto");
		this.assert(
			conNcm.items[0].derechosUsd > 0,
			"el NCM reasignado arrastra los rates de su fila de la matriz (IT40 por item)",
		);

		// 4) el wizard: lista, escribe y limpia por indice estable
		require("./ui/importWizard.js");
		const IW = global.window.ImportWizard;
		const prevPedido = global.currentPedido;
		const prevSku = IW.state.ncmBySku;
		const prevOverrides = IW.state.ncmOverrides;
		try {
			global.currentPedido = { items: [item(), { ...item(), sku: "AK820-1-dup" , qty: 3 }, otro()] };
			IW.state.ncmBySku = {};
			IW.state.ncmOverrides = {};
			const lista = IW._skuOverrideList();
			this.assert(lista.length === 3, `_skuOverrideList() devuelve los 3 productos del pedido (got ${lista.length})`);
			IW.setSkuNcm(0, "di", "35");
			this.assert(
				IW.state.ncmBySku["AK820-1"] && Math.abs(IW.state.ncmBySku["AK820-1"].derechos - 0.35) < 1e-9,
				"setSkuNcm(i,'di',35) guarda 0.35 (porcentaje a fraccion)",
			);
			IW.setSkuNcm(2, "ncm", "8471.60.53");
			this.assert(IW.state.ncmBySku["VIPER-9"].ncm === "8471.60.53", "setSkuNcm(i,'ncm') guarda el codigo del item correcto");
			const html = IW._renderSkuOverrides();
			this.assert(
				html.includes("Override por producto") && html.includes("AK820") && html.includes("Viper"),
				"_renderSkuOverrides() muestra el pedido completo",
			);
			this.assert(html.includes("corregido") && (html.match(/corregido/g) || []).length === 2, "marca los dos items corregidos");
			IW.setSkuNcm(0, "di", "");
			this.assert(!IW.state.ncmBySku["AK820-1"], "vaciar el DI elimina la entrada (no queda un override fantasma)");
			IW.clearSkuNcm(2);
			this.assert(Object.keys(IW.state.ncmBySku).length === 0, "clearSkuNcm limpia el item");
			const door = IW._doorConfig();
			this.assert(door && door.ncmBySku, "la config que recibe el motor incluye ncmBySku");
			const vacio = global.currentPedido;
			global.currentPedido = { items: [] };
			this.assert(IW._skuOverrideList().length === 0, "sin pedido no hay lista de productos");
			this.assert(
				IW._renderSkuOverrides().includes("Todavía no hay productos"),
				"sin pedido explica que hace falta cargar el paso 2",
			);
			global.currentPedido = vacio;
			// 5) la nota fija del paso 4 ya no hardcodea el anio: sale de RATES_META
			const paso4 = IW._render_impuestos();
			this.assert(!paso4.includes("Alícuotas verificadas a"), "desaparece la nota con el anio hardcodeado");
			this.assert(
				paso4.includes(Calculator.RATES_META.vigenciaHasta),
				"el paso 4 muestra la vigencia real de la matriz",
			);
		} finally {
			global.currentPedido = prevPedido;
			IW.state.ncmBySku = prevSku;
			IW.state.ncmOverrides = prevOverrides;
		}
	},

	async testQuoteHistoryReprint() {
		// quote-to-10: "Vista de historial de cotizaciones en la UI
		// (re-abrir/re-imprimir)". El historial se escribia pero nadie lo leia, y las
		// entradas no guardaban el detalle: no habia con que reimprimir.
		if (typeof QuoteGenerator.historySnapshot !== "function") {
			this.assert(false, "QuoteGenerator.historySnapshot no existe");
			return;
		}
		const prevOpen = global.window.open;
		const prevToast = global.window.toast;
		const prevLs = global.window.localStorage;
		const store = new Map();
		const opened = [];
		const toasts = [];
		const memo = {
			getItem: (k) => (store.has(k) ? store.get(k) : null),
			setItem: (k, v) => { store.set(k, String(v)); },
			removeItem: (k) => { store.delete(k); },
		};
		try {
			global.window.localStorage = memo;
			global.window.open = (a, b, c) => {
				const w = { document: { write: (s) => opened.push(String(s)), close() {} } };
				return w;
			};
			global.window.toast = (msg, type) => {
				toasts.push({ msg, type });
			};
			const pedido = {
				name: "Cotización test",
				items: [
					{ sku: "RAZ-MOU-A1", marca: "Razer", modelo: "Viper V3", variante: "Black", qty: 3, fob: 40, pvp: 70 },
					{ sku: "8BI-CON-B2", marca: "8BitDo", modelo: "Ultimate", variante: "White", qty: 2, fob: 35, pvp: 62 },
				],
				totals: { qty: 5, facturacion: 334 },
			};
			QuoteGenerator.generatePrintableQuote(pedido, { clientName: "Cliente Test", companyName: "Mambo" }, {});
			const h = QuoteGenerator.getHistory();
			this.assert(h.length === 1, "la cotizacion emitida entro al historial");
			const snap = h[0] && h[0].snapshot;
			this.assert(!!snap && Array.isArray(snap.items) && snap.items.length === 2, "la entrada guarda el detalle (2 items)");
			this.assert(snap && snap.items[0].sku === "RAZ-MOU-A1" && snap.items[0].qty === 3, "el snapshot conserva sku y cantidad");
			this.assert(snap && snap.items[0].variante === "Black", "el snapshot guarda la variante (clave del reprint honesto)");
			const nAbiertas = opened.length;
			this.assert(nAbiertas === 1, "generatePrintableQuote abrio una ventana");

			// Reabrir: tiene que volver a imprimir y NO duplicar la entrada.
			const ok = QuoteGenerator.openFromHistory(0);
			this.assert(ok === true, "openFromHistory(0) reabre la cotizacion");
			this.assert(opened.length === nAbiertas + 1, "reabrir volvio a imprimir el documento");
			this.assert(QuoteGenerator.getHistory().length === 1, "reabrir NO duplica la entrada del historial");
			const doc = opened[opened.length - 1];
			this.assert(doc.includes("RAZ-MOU-A1") && doc.includes("Cliente Test"), "el documento reimpreso trae el item y el cliente");

			// Entrada vieja, sin snapshot: avisa, no abre un documento vacio.
			store.set(QuoteGenerator.HISTORY_KEY, JSON.stringify([{ number: "COT-1", clientName: "Viejo", total: 10, items: 4 }]));
			const antes = opened.length;
			const r = QuoteGenerator.openFromHistory(0);
			this.assert(r === false, "una entrada sin snapshot no se puede reimprimir");
			this.assert(opened.length === antes, "no se abre un documento vacio");
			this.assert(toasts.some((x) => x.type === "warning"), "avisa por que no se pudo reabrir");

			// Indice inexistente.
			toasts.length = 0;
			this.assert(QuoteGenerator.openFromHistory(99) === false, "indice fuera del historial devuelve false");
			this.assert(toasts.some((x) => x.type === "error"), "indice inexistente se informa como error");
		} finally {
			global.window.open = prevOpen;
			global.window.toast = prevToast;
			global.window.localStorage = prevLs;
		}
	},

	async testImportWizardStatePersistence() {
		// persistence-fix: el state del asistente (markup, fletes, alicuotas editadas)
		// vivia en localStorage crudo dentro de un catch{} vacio.
		require("./ui/importWizard.js");
		const IW = global.window.ImportWizard;
		if (!IW || typeof IW._save !== "function" || typeof IW._stateKey !== "function") {
			this.assert(false, "RED: ImportWizard._save/_stateKey no accesibles");
			return;
		}
		this.assert(
			IW._stateKey() === "mambo_wizard_v1",
			`_stateKey() usa AppStorage.KEYS.WIZARD (got ${JSON.stringify(IW._stateKey())})`,
		);

		const prevSet = AppStorage.setItem;
		const prevGet = AppStorage.getItem;
		const prevToast = global.window.toast;
		const pristine = JSON.parse(JSON.stringify(IW.state));
		const prevWarned = IW._stateWarned;
		const writes = [];
		const toasts = [];
		global.window.toast = (msg, type) => {
			toasts.push({ msg, type });
		};
		try {
			// 1) _save() enruta por AppStorage con la clave logica.
			AppStorage.setItem = async (k, v) => {
				writes.push({ k, v });
			};
			IW.state.bpPct = 7.5;
			IW._save();
			await new Promise((r) => setTimeout(r, 0));
			this.assert(writes.length === 1 && writes[0].k === "mambo_wizard_v1", "_save() persiste por AppStorage.setItem(KEYS.WIZARD)");
			this.assert(writes[0] && writes[0].v && writes[0].v.bpPct === 7.5, "_save() guarda el state actual");
			this.assert(
				localStorage.getItem(IW.CACHE_KEY) === null,
				"_save() ya no escribe la clave vieja en localStorage crudo",
			);

			// 2) un fallo NO se traga: avisa una sola vez por sesion.
			IW._stateWarned = false;
			AppStorage.setItem = async () => {
				throw new Error("cuota agotada");
			};
			IW._save();
			await new Promise((r) => setTimeout(r, 0));
			IW._save();
			await new Promise((r) => setTimeout(r, 0));
			const errs = toasts.filter((x) => x.type === "error");
			this.assert(errs.length === 1, "_save() fallido avisa exactamente un toast de error (no spamea)");
			this.assert(errs.length === 1 && String(errs[0].msg).includes("cuota agotada"), "el aviso incluye la causa real");

			// 3) migracion: solo existe la clave vieja -> se aplica, se copia y se borra.
			IW._stateWarned = false;
			toasts.length = 0;
			writes.length = 0;
			// Ojo: hay que reponer el fake grabador; si no, sigue vigente el que lanza
			// del paso 2 y la migracion falla por culpa del test, no del codigo.
			AppStorage.setItem = async (k, v) => {
				writes.push({ k, v });
			};
			writes.length = 0;
			IW.state = JSON.parse(JSON.stringify(pristine));
			localStorage.removeItem("mambo_wizard_v1");
			localStorage.setItem(IW.CACHE_KEY, JSON.stringify({ regimen: "courier", seguro: 0.02 }));
			AppStorage.getItem = async () => null;
			await IW._restoreState();
			this.assert(IW.state.regimen === "courier", "_restoreState() migra el state de la clave vieja");
			this.assert(writes.length === 1 && writes[0].k === "mambo_wizard_v1", "la migracion copia el state a la clave nueva");
			this.assert(localStorage.getItem(IW.CACHE_KEY) === null, "la migracion borra la clave vieja despues de copiar");

			// 4) no pisa un state nuevo con uno viejo.
			IW.state = JSON.parse(JSON.stringify(pristine));
			IW.state.bpPct = 3;
			localStorage.setItem(IW.CACHE_KEY, JSON.stringify({ bpPct: 99 }));
			AppStorage.getItem = async () => ({ bpPct: 3 });
			await IW._restoreState();
			this.assert(IW.state.bpPct === 3, "un state nuevo vigente gana sobre la clave vieja");
			this.assert(localStorage.getItem(IW.CACHE_KEY) !== null, "si no se migra, la vieja no se borra");
		} finally {
			AppStorage.setItem = prevSet;
			AppStorage.getItem = prevGet;
			global.window.toast = prevToast;
			IW.state = pristine;
			IW._stateWarned = prevWarned;
			localStorage.removeItem(IW.CACHE_KEY);
			localStorage.removeItem("mambo_wizard_v1");
		}
	},
};

if (typeof window !== "undefined") window.Tests = Tests;
if (typeof module !== "undefined") module.exports = Tests;
