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
  }
};

window.Tests = Tests;
