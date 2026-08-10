// ============================================
// Mambo Pedidos - Asistente de Importación (IT20)
// Wizard guiado de 6 pasos: catálogo → pedido → flete/seguro →
// impuestos+aduna (NCM) → gastos destino → resumen (caja vs costo neto).
// Reutiliza Calculator.calculateDoorToDoorExactCost (basado validado IT19).
// ============================================

const ImportWizard = {
  steps: [
    { id: 'catalogo', title: '1 · Catálogo', desc: 'Cargá los PDFs de tus proveedores' },
    { id: 'pedido', title: '2 · Pedido', desc: 'Seleccioná productos y cantidades' },
    { id: 'flete', title: '3 · Flete + Seguro', desc: 'Definí el transporte y el valor CIF' },
    { id: 'impuestos', title: '4 · Impuestos + Aduana', desc: 'NCM, DI, IVA, anticipos (auditado)' },
    { id: 'gastos', title: '5 · Gastos de destino', desc: 'Depósito, despachante, SIM, acarreo' },
    { id: 'resumen', title: '6 · Resumen', desc: 'Caja vs costo neto real + crédito fiscal' }
  ],
  step: 0,
  state: {
    fleteModo: 'peso', pesoKg: 15, costoPorKg: 12, fletePct: 0.15, seguro: 0.015,
    transporte: 'maritimo', regimen: 'importador',
    depositoFiscalUsd: 150, despachanteUsd: 450, simDigitalizacionUsd: 40, fleteInternoUsd: 80,
    recuperaCredito: true,
    iibbJurisdiccion: 'santa_fe', iibbPctCustom: 0.03,
    ncmOverrides: {}
  },
  CACHE_KEY: 'mamboImportWizardState',
  PROJECT_KEY: 'mamboImportProyecto',
  // IIBB por jurisdicción (olmoscomex: CABA ~2.5%, PBA más alto). Configurable.
  IIBB_JURISDICCIONES: { cab: 0.025, pba: 0.035, santa_fe: 0.03, otra: null },

  _iibbPct() {
    const j = ImportWizard.state.iibbJurisdiccion;
    const base = ImportWizard.IIBB_JURISDICCIONES[j];
    return base != null ? base : (ImportWizard.state.iibbPctCustom || 0.025);
  },

  open() {
    const saved = localStorage.getItem(ImportWizard.CACHE_KEY);
    if (saved) { try { ImportWizard.state = Object.assign(ImportWizard.state, JSON.parse(saved)); } catch (e) {} }
    // IT20: restaurar proyecto guardado (pedido + paso) si existe
    const proy = localStorage.getItem(ImportWizard.PROJECT_KEY);
    if (proy) { try { const p = JSON.parse(proy); if (p.step != null) ImportWizard.step = p.step; } catch (e) {} }
    ImportWizard._loadNcmDb();
    const modal = document.getElementById('importWizardModal');
    if (modal) modal.style.display = 'flex';
    ImportWizard.render();
  },

  // IT23: carga la base NCM (ARCA) y construye los DI autoritativos por categoría.
  async _loadNcmDb() {
    if (typeof NcmDatabase === 'undefined') return;
    // IT31: la base de datos (872KB) se carga LAZY vía ensureNcmDbLib() solo acá,
    // no en el arranque. Si ya está cacheada en localStorage, load() la usa.
    if (typeof ensureNcmDbLib === 'function' && !NcmDatabase.load()) {
      try { await ensureNcmDbLib(); } catch (e) {}
    }
    if (!NcmDatabase.load()) await NcmDatabase.loadFromFile();
    if (!NcmDatabase._db || !Calculator || !Calculator.NCM_MATRIX) return;
    // Override del DI de cada categoría con el valor autoritativo de ARCA.
    Object.entries(Calculator.NCM_MATRIX).forEach(([key, info]) => {
      const db = NcmDatabase.byCode(info.ncm);
      if (db && db.di != null) {
        ImportWizard.state.ncmOverrides[key] = { derechos: db.di };
      }
    });
    ImportWizard.render();
  },

  // Guarda el proyecto completo (pedido + paso + inputs) para retomar.
  saveProject() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items.map(i => ({ sku: i.sku, qty: i.qty })) : [];
    try {
      localStorage.setItem(ImportWizard.PROJECT_KEY, JSON.stringify({
        step: ImportWizard.step, items, state: ImportWizard.state, guardado: Date.now()
      }));
    } catch (e) {}
    if (typeof toast === 'function') toast('Proyecto de importación guardado', 'success');
  },

  clearProject() {
    try { localStorage.removeItem(ImportWizard.PROJECT_KEY); } catch (e) {}
  },

  close() {
    const modal = document.getElementById('importWizardModal');
    if (modal) modal.style.display = 'none';
  },

  goTo(i) {
    ImportWizard.step = Math.max(0, Math.min(ImportWizard.steps.length - 1, i));
    ImportWizard.render();
  },

  prev() { ImportWizard.goTo(ImportWizard.step - 1); },
  next() { ImportWizard.goTo(ImportWizard.step + 1); },

  _save() {
    try { localStorage.setItem(ImportWizard.CACHE_KEY, JSON.stringify(ImportWizard.state)); } catch (e) {}
  },

  _esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  render() {
    const stepsEl = document.getElementById('iwSteps');
    const body = document.getElementById('importWizardBody');
    const prevBtn = document.getElementById('iwPrevBtn');
    const nextBtn = document.getElementById('iwNextBtn');
    const prog = document.getElementById('iwProgress');
    if (!stepsEl || !body) return;

    stepsEl.innerHTML = ImportWizard.steps.map((s, i) => {
      const active = i === ImportWizard.step;
      const done = i < ImportWizard.step;
      const cls = active ? 'iw-step active' : done ? 'iw-step done' : 'iw-step';
      return `<button class="${cls}" onclick="ImportWizard.goTo(${i})" title="${ImportWizard._esc(s.desc)}">${done ? '✓ ' : ''}${ImportWizard._esc(s.title)}</button>`;
    }).join('');

    body.innerHTML = ImportWizard['_render_' + ImportWizard.steps[ImportWizard.step].id]();

    const isLast = ImportWizard.step === ImportWizard.steps.length - 1;
    prevBtn.style.visibility = ImportWizard.step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = isLast ? 'Finalizar' : 'Siguiente →';
    nextBtn.onclick = isLast ? () => ImportWizard._finish() : () => ImportWizard.next();
    nextBtn.innerHTML = isLast ? 'Finalizar ✓' : 'Siguiente →';
    prog.textContent = `Paso ${ImportWizard.step + 1} de ${ImportWizard.steps.length}`;
    ImportWizard._save();
  },

  // Exporta el resumen del proyecto a CSV (descarga).
  exportCsv() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    if (!items.length) { if (typeof toast === 'function') toast('No hay pedido para exportar', 'error'); return; }
    const s = ImportWizard.state;
    const pesoKg = s.fleteModo === 'peso' ? s.pesoKg : 0;
    const costoPorKg = s.fleteModo === 'peso' ? s.costoPorKg : 0;
    const fletePct = s.fleteModo === 'pct' ? s.fletePct : 0.15;
    const res = Calculator.calculateDoorToDoorExactCost(items, {
      tipoCambio: 1400, pesoKg, costoPorKg, fletePct, seguroPct: s.seguro,
      regimen: s.regimen,
      iibbPct: ImportWizard._iibbPct(), ncmOverrides: s.ncmOverrides,
      depositoFiscalUsd: s.depositoFiscalUsd, despachanteUsd: s.despachanteUsd,
      simDigitalizacionUsd: s.simDigitalizacionUsd, fleteInternoUsd: s.fleteInternoUsd
    });
    const sum = res.summary;
    const sep = ',';
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [
      ['Concepto', 'Valor USD'].join(sep),
      ['FOB', sum.fobTotalUsd],
      ['Flete', sum.fleteTotalUsd],
      ['Seguro', sum.seguroTotalUsd],
      ['CIF', sum.cifTotalUsd],
      ['Derechos + Tasa + Anticipos', sum.totalTributosAduanaUsd],
      ['IVA', sum.totalIvaAduanaUsd],
      ['Gastos destino', sum.totalGastosFijosDestinoUsd],
      ['Caja (todo lo que sale)', sum.totalPuertaConIvaUsd],
      ['Costo neto real', sum.costoNetoRealUsd],
      ['Crédito fiscal a favor', sum.totalRecuperableUsd],
      [], ['SKU', 'NCM', 'Cantidad', 'Tributos USD', 'Costo unit+IVA USD']
    ].map(r => r.length ? r.map(x => q(x)).join(sep) : '');
    res.items.forEach(i => lines.push([i.sku, i.ncm, i.qty, Math.round(i.derechosUsd + i.tasaUsd + i.ivaAddUsd + i.percGanUsd + i.iibbUsd), Math.round(i.costoRealItemUsd + i.ivaUsd)].map(x => q(x)).join(sep)));
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'importacion-mambo.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof toast === 'function') toast('Resumen exportado a CSV', 'success');
  },

  _finish() {
    ImportWizard._save();
    ImportWizard.close();
    if (typeof toast === 'function') toast('Importación calculada. Guardá el proyecto en Historial.', 'success');
  },

  // ---- Guía Fiscal FAQ (IT21) ----
  FAQ_ITEMS: [
    { q: '¿Qué impuestos pago al importar periféricos?', a: 'Depende del NCM. Teclados/mouse/monitores/celulares son BIENES BIT → Derecho de Importación 0% y Tasa de Estadística 0% (Decreto 557/23 + 1140/24, vigente hasta 31/12/2028/2027). Auriculares (20%) y controllers (20%) pagan DI. Todos pagan IVA 21%, IVA adicional 20% (pago a cuenta), Percepción Ganancias 6% (inscripto) e IIBB (según jurisdicción: Santa Fe 3%). El Impuesto PAIS fue ELIMINADO.' },
    { q: '¿Cuál es la base imponible?', a: 'Todos los tributos se calculan sobre la base = CIF + Derechos + Tasa de Estadística. CIF = FOB + Flete + Seguro.' },
    { q: '¿Qué es el crédito fiscal y por qué importa?', a: 'El IVA (21%), el IVA adicional (20%), Ganancias (6%) e IIBB (3% Santa Fe) son pagos a cuenta RECUPERABLES si revendés como responsable inscripto. Tu costo REAL neto descuenta eso; solo DI + TE son costo definitivo. Por eso el precio de venta se calcula sobre el costo neto real, no sobre la caja.' },
    { q: '¿Qué es la TE (Tasa de Estadística) y la exención BIT?', a: 'La TE es un tributo del 3% sobre el CIF (con tope por tramo: máx USD 180 hasta 10k, USD 3.000 hasta 100k, USD 30.000 hasta 1M, USD 150.000 sobre 1M). Está EXENTA (0%) para bienes BIT y BK nuevos (Decreto 1140/24). Por eso teclados/mouse/monitores/celulares no la pagan.' },
    { q: '¿Qué es RE y me aplica?', a: 'RE = Reintegros a la Exportación (recupero al EXPORTAR). Es una columna del NCM que NO aplica a tus importaciones — no es un costo de importación.' },
    { q: 'IIBB: ¿cuánto pago según mi provincia?', a: 'Ingresos Brutos sobre la importación varía por jurisdicción: Santa Fe 3%, CABA 2.5%, PBA 3.5%. Elegí tu provincia en el Paso 4 del asistente; es configurable.' },
    { q: '¿Régimen courier o importador?', a: 'Courier: ≤ USD 3.000 y 50kg. Primeros USD 400 exentos, arancel simplificado 50% sobre el excedente, IVA 21%, sin anticipos (Ganancias/IIBB/IVA adicional). Importador (despacho general): matriz NCM completa. Para revender en volumen conviene importador; courier solo para muestras o compras puntuales.' },
    { q: '¿La suspensión de IVA adicional y Ganancias (RG 5807) me aplica?', a: 'NO. La RG 5807 (vigente hasta 30/06/2026) suspende esas percepciones SOLO para canasta básica, medicamentos e insumos MiPyME con Certificado MiPyME. Los periféricos no están alcanzados: se pagan.' },
    { q: '¿Hay antidumping en periféricos de China?', a: 'Actualmente NO hay derechos antidumping vigentes sobre teclados, mouse, auriculares ni controllers de China (CNCE medidas vigentes). Pero hay "valores criterio": AFIP puede ajustar valores subdeclarados si el FOB va muy bajo.' },
    { q: '¿Qué gastos portuarios/operativos sumo?', a: 'Despachante de aduana (USD 300-800), depósito fiscal/TCA (USD 150-300), digitalización SIM, flete interno a depósito, THC portuario (USD 150-300) y certificaciones (ENACOM USD 350 para inalámbricos, S-Mark para monitores).' },
    { q: '¿Los NCM de mi catálogo son correctos?', a: 'La app autoclasifica por categoría: teclado 8471.60.52, mouse 8471.60.53, auriculares 8518.30.00, controllers 9504.50.00 (AEC 20%), mousepad 3926.90.90. Podés ajustar el derecho por categoría en el Paso 4 del asistente.' }
  ],

  showFaq() {
    const body = document.getElementById('faqBody');
    const modal = document.getElementById('faqModal');
    if (body) {
      body.innerHTML = ImportWizard.FAQ_ITEMS.map(f => `
        <details style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.02);">
          <summary style="font-size:13px;font-weight:700;color:var(--text);cursor:pointer;">${ImportWizard._esc(f.q)}</summary>
          <p style="font-size:12.5px;color:var(--text-muted);margin-top:8px;line-height:1.5;">${ImportWizard._esc(f.a)}</p>
        </details>`).join('');
    }
    if (modal) modal.style.display = 'flex';
  },

  closeFaq() {
    const modal = document.getElementById('faqModal');
    if (modal) modal.style.display = 'none';
  }
};

if (typeof window !== 'undefined') window.ImportWizard = ImportWizard;