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
    // Etapa A (d1): propósito del envío — personal usa el simplificado courier;
    // reventa muestra el aviso honesto de régimen fiscal (verificación d1).
    proposito: 'personal',
    // Etapa A (d3): origen de la mercadería (default China) — dato del checklist
    // documental; TODO es editable y recalcula en vivo.
    origen: 'China',
    // Titular de la homologación ENACOM (fabricante con transferencia o trámite propio).
    enacomTitular: null,
    // Overrides por ítem (Etapa A, d3/d4): FOB y peso editable SIN tocar el catálogo.
    itemEdits: {},
    // Checklist del plan de importación (Etapa A, A4): pasos marcados completos.
    checks: {},
    depositoFiscalUsd: 150, despachanteUsd: 450, simDigitalizacionUsd: 40, fleteInternoUsd: 80,
    recuperaCredito: true,
    iibbJurisdiccion: 'santa_fe', iibbPctCustom: 0.03,
    ncmOverrides: {},
    // IT41: override de NCM/DI por SKU (gana sobre el de categoría).
    ncmBySku: {},
    // Slice C (landed-cost-verdict): precio local de referencia, percepción BP y
    // seguro explícito en USD (override del %). Persisten en mamboImportWizardState.
    precioLocalUsd: null,
    bpPct: 0,
    seguroUsdOverride: null
  },
  CACHE_KEY: 'mamboImportWizardState',
  // persistence-fix: clave del state auto-guardado. CACHE_KEY queda solo como
  // origen de la migración (los drafts vivos de usuarios no se pierden).
  PROJECT_KEY: 'mamboImportProyecto',
  // IIBB por jurisdicción (olmoscomex: CABA ~2.5%, PBA más alto). Configurable.
  IIBB_JURISDICCIONES: { cab: 0.025, pba: 0.035, santa_fe: 0.03, otra: null },

  _iibbPct() {
    const j = ImportWizard.state.iibbJurisdiccion;
    const base = ImportWizard.IIBB_JURISDICCIONES[j];
    return base != null ? base : (ImportWizard.state.iibbPctCustom || 0.025);
  },

  open() {
    // persistence-fix: leer el state es async ahora (vive en AppStorage, que en
    // desktop escribe en $APPDATA). Se pinta con los defaults y _restoreState
    // repinta si trajo un state guardado; open() sigue sincronico para el onclick.
    const restoringState = ImportWizard._restoreState();
    ImportWizard._loadNcmDb();
    const modal = document.getElementById('importWizardModal');
    if (modal) modal.style.display = 'flex';
    ImportWizard.render();
    // IT20 + persistence-fix: restaurar proyecto guardado (pedido + paso). La
    // lectura ahora es async (el draft vive en AppStorage, no en localStorage
    // crudo), asi que se pinta primero con el state sincronico y
    // _restoreProject repinta si el draft trae otro paso. open() sigue siendo
    // sincronico para el onclick.
    const restoringProject = ImportWizard._restoreProject();
    // Awaitable opcional: el onclick lo ignora, los tests lo usan para esperar
    // el state/proyecto restaurado antes de afirmar.
    return Promise.all([restoringState, restoringProject]);
  },

  // ── draft del proyecto de importacion (persistence-fix) ──
  // Clave logica: KEYS.PROJECT en AppStorage (store en $APPDATA dentro de Tauri,
  // localStorage fuera). PROJECT_KEY queda solo como origen de la migracion.
  // Aviso de vigencia de la matriz de alícuotas. Devuelve '' cuando está
  // vigente, para que no ocupe espacio en ningún paso.
  _ratesBanner() {
    if (typeof Calculator === 'undefined' || typeof Calculator.ratesStatus !== 'function') return '';
    let st;
    try {
      st = Calculator.ratesStatus();
    } catch (e) {
      console.warn('No se pudo leer la vigencia de la matriz:', e);
      return '<div class="alert-banner warning" style="margin:0 0 12px;">No se pudo verificar la vigencia de la matriz de alícuotas.</div>';
    }
    if (!st || st.severity === 'ok' || !st.message) return '';
    const kind = st.severity === 'vencida' ? 'danger' : 'warning';
    return `<div class="alert-banner ${kind}" style="margin:0 0 12px;">${ImportWizard._esc(st.message)}</div>`;
  },

  // ── export del resumen a documento imprimible / PDF ──
  // guided-import-wizard: "Export del resumen (PDF/CSV) desde el Paso 6". El CSV
  // estaba; el PDF no existia. No se duplica la logica de numeros: se recalcula con
  // el mismo Calculator.calculateDoorToDoorExactCost + _doorConfig que pinta el paso
  // 6, asi el documento no puede desincronizarse de lo que el usuario ve. Reusa el
  // camino del generador de cotizaciones (ventana + "Imprimir" del navegador, que
  // ofrece Guardar como PDF) en vez de traer una libreria de PDF.
  summaryDocument(res, sum, state) {
    const cfg = (typeof QuoteGenerator !== 'undefined' && typeof QuoteGenerator.getConfig === 'function')
      ? QuoteGenerator.getConfig()
      : {};
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const meta = (typeof Calculator !== 'undefined' && Calculator.RATES_META) ? Calculator.RATES_META : {};
    const items = (res && Array.isArray(res.items)) ? res.items : [];
    const totalQty = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const rows = items.map((it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(it.marca || '')} ${esc(it.modelo || it.sku)}</td>
        <td>${esc(it.variante || '')}</td>
        <td class="num">${esc(it.qty)}</td>
        <td class="mono">${esc(it.ncm || '')}</td>
        <td class="num">${money(it.fob)}</td>
        <td class="num">${money((it.derechosUsd || 0) + (it.tasaUsd || 0) + (it.ivaAddUsd || 0) + (it.percGanUsd || 0) + (it.iibbUsd || 0) + (it.bpUsd || 0))}</td>
        <td class="num">${money(it.costoPuertaTotalUsd != null ? it.costoPuertaTotalUsd : it.costoRealItemUsd)}</td>
      </tr>`).join('');
    const fila = (label, valor, extra) => `<div${extra || ''}><span>${label}</span><span>${valor}</span></div>`;
    return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Resumen de importación · ${esc(cfg.companyName || 'Mambo Pedidos')}</title>
    <style>
      body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .sub { color: #666; font-size: 13px; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; }
      .totals { margin-top: 18px; }
      .totals div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 13px; }
      .totals .big { font-weight: 700; font-size: 15px; border-bottom: 2px solid #111; }
      .note { margin-top: 18px; font-size: 11px; color: #666; line-height: 1.5; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    <h1>Resumen de importación</h1>
    <div class="sub">${esc(cfg.companyName || 'Mambo Pedidos')}${cfg.clientName ? ' · cliente ' + esc(cfg.clientName) : ''} · generado ${esc(new Date().toLocaleDateString('es-AR'))}</div>
    <table>
      <thead><tr><th>#</th><th>Producto</th><th>Variante</th><th class="num">Cant</th><th>NCM</th><th class="num">FOB unit</th><th class="num">Tributos</th><th class="num">Costo puerta</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      ${fila('FOB total', money(sum.fobTotalUsd))}
      ${fila('Flete + seguro', money((sum.fleteTotalUsd || 0) + (sum.seguroTotalUsd || 0)))}
      ${fila('CIF', money(sum.cifTotalUsd))}
      ${fila('Tributos de aduana (DI, TE, IVA adicional, anticipos)', money(sum.totalTributosAduanaUsd))}
      ${fila('IVA en aduana', money(sum.totalIvaAduanaUsd))}
      ${fila('Gastos fijos de destino', money(sum.totalGastosFijosDestinoUsd))}
      ${fila('Certificaciones', money(sum.totalCertsCostUsd))}
      ${fila('Caja total (con IVA)', money(sum.totalPuertaConIvaUsd), ' class="big"')}
      ${fila('Costo neto real' + (state && state.recuperaCredito ? ' (recuperando crédito fiscal)' : ''), money(state && state.recuperaCredito ? sum.costoNetoRealUsd : sum.totalPuertaConIvaUsd))}
      ${fila('Costo puerta por unidad', money(totalQty ? sum.totalPuertaConIvaUsd / totalQty : 0))}
      ${fila('Crédito fiscal (ARS)', money(sum.creditoFiscalArs))}
      ${fila('En pesos (TC ' + esc(sum.tipoCambio) + ')', money(sum.totalPuertaConIvaArs))}
    </div>
    <div class="note">
      Estimación sobre la matriz de alícuotas ${esc(meta.fuentes || 'ARCA/AFIP')}, vigente hasta
      <strong>${esc(meta.vigenciaHasta || 'sin fecha')}</strong> y verificada por última vez el
      ${esc(meta.actualizada || 'fecha desconocida')}. Los valores de certificaciones,
      logística y gastos de destino son los cargados en el asistente. Confirmar con el
      despachante antes de despachar: este documento es una estimación, no una
      declaración jurada.
    </div>
  </body>
</html>`;
  },

  // Devuelve el HTML tambien cuando no hay ventana, para poder probarlo.
  exportSummaryPdf() {
    const items = ImportWizard._effectiveItems();
    if (!items.length) {
      if (typeof toast === 'function') toast('No hay productos en el pedido para exportar el resumen.', 'error');
      return null;
    }
    if (typeof Calculator === 'undefined') return null;
    const s = ImportWizard.state;
    const res = Calculator.calculateDoorToDoorExactCost(items, ImportWizard._doorConfig());
    if (!res || !res.summary) {
      if (typeof toast === 'function') toast('El motor no devolvió un resumen para exportar.', 'error');
      return null;
    }
    const html = ImportWizard.summaryDocument(res, res.summary, s);
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      const win = window.open('', '_blank');
      if (!win) {
        if (typeof toast === 'function') toast('Permití las ventanas emergentes para abrir el resumen', 'warning');
        return html;
      }
      win.document.write(html);
      win.document.close();
      if (typeof toast === 'function') toast('Resumen abierto: usá "Imprimir → Guardar como PDF"', 'success');
    }
    return html;
  },

  _projectKey() {
    return (typeof AppStorage !== 'undefined' && AppStorage.KEYS && AppStorage.KEYS.PROJECT) || ImportWizard.PROJECT_KEY;
  },

  async _writeProject(payload) {
    if (typeof AppStorage !== 'undefined' && typeof AppStorage.setItem === 'function') {
      await AppStorage.setItem(ImportWizard._projectKey(), payload);
    } else {
      localStorage.setItem(ImportWizard._projectKey(), JSON.stringify(payload));
    }
  },

  async _readProject() {
    let proj;
    if (typeof AppStorage !== 'undefined' && typeof AppStorage.getItem === 'function') {
      proj = await AppStorage.getItem(ImportWizard._projectKey(), null);
    } else {
      const raw = localStorage.getItem(ImportWizard._projectKey());
      try { proj = raw ? JSON.parse(raw) : null; } catch { proj = null; }
    }
    if (proj) return proj;
    // Migracion: todavia queda draft en la clave vieja (localStorage crudo)? se
    // usa, se copia a la nueva y SOLO ENTONCES se borra la vieja: si el write
    // nuevo falla el usuario no pierde nada.
    const legacy = localStorage.getItem(ImportWizard.PROJECT_KEY);
    if (!legacy) return null;
    try { proj = JSON.parse(legacy); } catch { return null; }
    try {
      await ImportWizard._writeProject(proj);
      localStorage.removeItem(ImportWizard.PROJECT_KEY);
    } catch {}
    return proj;
  },

  async _restoreProject() {
    let proj;
    try { proj = await ImportWizard._readProject(); } catch { return; }
    if (proj && proj.step != null) {
      ImportWizard.step = proj.step;
      ImportWizard.render();
    }
  },

  // Guarda el proyecto completo (pedido + paso + inputs) para retomar.
  // Antes: localStorage crudo dentro de try{}catch{} y toast de exito igual
  // (nadie se enteraba de un draft perdido). Ahora pasa por AppStorage y un
  // fallo real se avisa como error, nunca como exito falso.
  async saveProject() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items.map(i => ({ sku: i.sku, qty: i.qty })) : [];
    const payload = { step: ImportWizard.step, items, state: ImportWizard.state, guardado: Date.now() };
    let err = null;
    try {
      await ImportWizard._writeProject(payload);
    } catch (e) { err = e; }
    if (typeof toast === 'function') {
      if (err) toast('No se pudo guardar el proyecto de importación: ' + ((err && err.message) || err), 'error');
      else toast('Proyecto de importación guardado', 'success');
    }
    return !err;
  },

  async clearProject() {
    try { localStorage.removeItem(ImportWizard.PROJECT_KEY); } catch {}
    try {
      if (typeof AppStorage !== 'undefined' && typeof AppStorage.removeItem === 'function') await AppStorage.removeItem(ImportWizard._projectKey());
      else localStorage.removeItem(ImportWizard._projectKey());
    } catch {}
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

  _stateKey() {
    return (typeof AppStorage !== 'undefined' && AppStorage.KEYS && AppStorage.KEYS.WIZARD) || ImportWizard.CACHE_KEY;
  },

  // Un aviso por sesion: _save() corre en cada change e input, y spamear toasts
  // haria intratable el wizard.
  _stateSaveError(e) {
    console.error('No se pudo guardar el estado del asistente:', e);
    if (ImportWizard._stateWarned) return;
    ImportWizard._stateWarned = true;
    if (typeof toast === 'function') {
      toast('No se pudo guardar el estado del asistente: ' + ((e && e.message) || e) + '. Los cambios siguen visibles pero no se conservaran.', 'error');
    }
  },

  // Lee el state guardado (nueva clave, o migra la vieja) y lo aplica.
  async _restoreState() {
    let saved = null;
    try {
      if (typeof AppStorage !== 'undefined' && typeof AppStorage.getItem === 'function') {
        saved = await AppStorage.getItem(ImportWizard._stateKey(), null);
      } else {
        const raw = localStorage.getItem(ImportWizard._stateKey());
        try { saved = raw ? JSON.parse(raw) : null; } catch { saved = null; }
      }
      if (!saved) {
        const legacy = localStorage.getItem(ImportWizard.CACHE_KEY);
        if (!legacy) return;
        try { saved = JSON.parse(legacy); } catch { return; }
        // Se copia a la clave nueva y SOLO ENTONCES se borra la vieja: si el
        // write falla el usuario conserva su state en la clave original.
        try {
          if (typeof AppStorage !== 'undefined' && typeof AppStorage.setItem === 'function') {
            await AppStorage.setItem(ImportWizard._stateKey(), saved);
          } else {
            localStorage.setItem(ImportWizard._stateKey(), JSON.stringify(saved));
          }
          localStorage.removeItem(ImportWizard.CACHE_KEY);
        } catch (e) { ImportWizard._stateSaveError(e); }
      }
    } catch (e) { ImportWizard._stateSaveError(e); return; }
    if (!saved || typeof saved !== 'object') return;
    ImportWizard.state = Object.assign(ImportWizard.state, saved);
    const modal = document.getElementById('importWizardModal');
    if (modal && modal.style.display !== 'none') ImportWizard.render();
  },

  _save() {
    // Fire-and-forget: _save() se llama desde render() y desde onchange; esperar
    // aca cortaria la edicion. El fallo se propaga a _stateSaveError.
    if (typeof AppStorage !== 'undefined' && typeof AppStorage.setItem === 'function') {
      AppStorage.setItem(ImportWizard._stateKey(), ImportWizard.state).catch((e) => ImportWizard._stateSaveError(e));
      return;
    }
    try {
      localStorage.setItem(ImportWizard._stateKey(), JSON.stringify(ImportWizard.state));
    } catch (e) { ImportWizard._stateSaveError(e); }
  },

  _esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  // ── Etapa A / A3: ítems efectivos con overrides editables (FOB, peso) ──
  // El catálogo no se toca: el override vive en state.itemEdits y viaja a todos
  // los cálculos (motor, resumen, export, plan). Editar en cualquier momento
  // recalcula TODO (d3/d4).
  _itemByIndex(i) {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    return items[Number(i)] || null;
  },

  _effectiveItems() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    const edits = ImportWizard.state.itemEdits || {};
    return items.map((it) => {
      const o = edits[String((it && it.sku) || '').trim()];
      if (!o) return it;
      const out = Object.assign({}, it);
      if (o.fob != null) out.fob = o.fob;
      if (o.weightKg != null) out.weightKg = o.weightKg;
      return out;
    });
  },

  setItemEditByIndex(i, field, value) {
    const it = ImportWizard._itemByIndex(i);
    if (!it) return;
    const sku = String((it.sku || '').trim());
    if (!sku) return;
    const s = ImportWizard.state;
    s.itemEdits = s.itemEdits || {};
    const cur = Object.assign({}, s.itemEdits[sku] || {});
    const v = Number(value);
    if (value === '' || value == null || !Number.isFinite(v) || v < 0) delete cur[field];
    else cur[field] = v;
    if (cur.fob == null && cur.weightKg == null) delete s.itemEdits[sku];
    else s.itemEdits[sku] = cur;
    ImportWizard._save();
  },

  // ── Etapa A / A2: validación fail-closed (checkpoints) ──
  // Devuelve { faltantes: [{paso, queFalta, impacto, blocking}], avisos, plan }.
  // Blocking: sin pedido, régimen courier fuera de límites, flete en cero.
  // Los faltantes no-blocking se muestran en rojo igual (nunca silencioso).
  validate() {
    const items = ImportWizard._effectiveItems();
    const faltantes = [];
    const avisos = [];
    const s = ImportWizard.state || {};
    let plan = null;

    if (!items.length) {
      faltantes.push({ paso: 'pedido', queFalta: 'No hay pedido', impacto: 'sin pedido no hay importación que planificar ni guardar', blocking: true });
    }
    if (typeof ImportGuide !== 'undefined' && typeof ImportGuide.planFor === 'function') {
      plan = ImportGuide.planFor(items, ImportWizard.state, ImportWizard._doorConfig());
      (plan.bloqueantes || []).forEach((b) => {
        faltantes.push({ paso: 'flete', queFalta: b.queFalta, impacto: b.impacto, blocking: true });
      });
      (plan.avisos || []).forEach((a) => avisos.push(a));
      (plan.pasos || []).forEach((p) => {
        const mapa = { 'orden-compra': 'pedido', flete: 'flete', tributos: 'flete', enacom: 'impuestos' };
        const pasoWizard = mapa[p.id];
        if (!pasoWizard) return;
        (p.faltantes || []).forEach((f) => {
          faltantes.push({ paso: pasoWizard, queFalta: f.queFalta, impacto: f.impacto, blocking: false });
        });
      });
    }
    if (s.fleteModo === 'pct' && Number(s.fletePct) <= 0) {
      faltantes.push({ paso: 'flete', queFalta: 'Flete en 0%', impacto: 'sin flete el CIF y todos los tributos dejan de ser reales', blocking: true });
    }
    if (s.fleteModo === 'peso' && !(Number(s.pesoKg) > 0)) {
      avisos.push('Peso total en 0: el motor usa el % de flete por default (15%) y el costo NO es el real. Cargá el peso total o usá el estimado de tus productos.');
    }
    if (Number(s.seguro) <= 0 && s.seguroUsdOverride == null) {
      avisos.push('Seguro en 0%: el envío no está asegurado; si se pierde en tránsito no cobrás nada.');
    }
    if (s.iibbJurisdiccion === 'otra' && !(Number(s.iibbPctCustom) > 0)) {
      avisos.push('Jurisdicción IIBB configurada pero sin porcentaje: los tributos usan el default.');
    }
    return { faltantes, avisos, plan };
  },

  // Checkpoints por paso del asistente: rojo, nunca silencioso. El resumen
  // muestra TODO; los pasos intermedios solo lo que les toca.
  _checkpointsHtml(stepId) {
    const v = ImportWizard.validate();
    const faltantes = stepId === 'resumen' ? v.faltantes : v.faltantes.filter((f) => f.paso === stepId);
    const avisos = (stepId === 'resumen' || stepId === 'flete') ? v.avisos : [];
    const bloq = faltantes.filter((f) => f.blocking);
    const noBloq = faltantes.filter((f) => !f.blocking);
    let html = '';
    bloq.forEach((f) => {
      html += `<div class="alert-banner danger" style="margin:0 0 8px;">⛔ <b>Falta:</b> ${ImportWizard._esc(f.queFalta)} — ${ImportWizard._esc(f.impacto)}</div>`;
    });
    noBloq.forEach((f) => {
      html += `<div class="alert-banner warning" style="margin:0 0 8px;">⚠️ <b>Falta:</b> ${ImportWizard._esc(f.queFalta)} — ${ImportWizard._esc(f.impacto)}</div>`;
    });
    avisos.forEach((a) => {
      const ya = html.includes(ImportWizard._esc(a.slice(0, 40)));
      if (!ya) html += `<div class="alert-banner warning" style="margin:0 0 8px;">ℹ️ ${ImportWizard._esc(a)}</div>`;
    });
    return html;
  },

  // ── Etapa A / A4: vista Plan + Seguimiento (checklist) ──
  _pendientesDe(plan, checks) {
    return (plan && plan.pasos ? plan.pasos : []).filter((p) => !(checks && checks[p.id]));
  },

  _planHtml(plan, isRecord, checks, recordNumber) {
    const lblReg = plan.regimen === 'courier' ? 'Courier' : 'Marítimo (despacho general)';
    const lblProp = plan.proposito === 'reventa' ? 'Reventa' : 'Uso personal';
    const checksSrc = checks || {};
    const pendientes = ImportWizard._pendientesDe(plan, checksSrc);
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
      <div style="font-size:13px;"><b>${lblReg}</b> · ${lblProp} · ${plan.pasos.length} pasos · <span style="color:var(--text-muted);">${pendientes.length} pendientes</span></div>
      ${recordNumber ? `<div style="font-size:12px;color:var(--text-muted);">${ImportWizard._esc(recordNumber)}</div>` : ''}
    </div>`;
    if (!plan.valido) {
      html += (plan.bloqueantes || []).map((b) => `<div class="alert-banner danger" style="margin:0 0 8px;">⛔ ${ImportWizard._esc(b.queFalta)} — ${ImportWizard._esc(b.impacto)}</div>`).join('');
    }
    (plan.avisos || []).forEach((a) => {
      html += `<div class="alert-banner warning" style="margin:0 0 8px;">ℹ️ ${ImportWizard._esc(a)}</div>`;
    });
    const primerPendiente = plan.pasos.findIndex((p) => !checksSrc[p.id]);
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    plan.pasos.forEach((p, i) => {
      const checked = !!checksSrc[p.id];
      const faltan = (p.faltantes && p.faltantes.length) ? p.faltantes : null;
      const costo = Number(p.costoUsd) > 0 ? '$' + Math.round(p.costoUsd) + ' USD' : '';
      const onclick = isRecord ? `ImportWizard.toggleRecordCheck('${p.id}')` : `ImportWizard.toggleCheck('${p.id}')`;
      html += `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:8px;background:${checked ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)'};border:1px solid ${checked ? 'rgba(34,197,94,0.25)' : 'var(--border)'};">
        <input type="checkbox" style="margin-top:2px;" ${checked ? 'checked' : ''} onchange="${onclick}">
        <div style="flex:1;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:${checked ? '400' : '700'};${checked ? 'color:var(--text-muted);text-decoration:line-through;' : ''}">${i + 1}. ${ImportWizard._esc(p.titulo)}</span>
            ${i === primerPendiente ? '<span class="badge" style="background:var(--primary);color:#000;">PRÓXIMO PASO</span>' : ''}
            ${faltan ? '<span class="badge" style="background:rgba(239,68,68,0.2);color:var(--red, #ef4444);">falta dato</span>' : ''}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;line-height:1.45;">${ImportWizard._esc(p.descripcion)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">👤 ${ImportWizard._esc(p.responsable)}${p.fuente ? ' · ' + ImportWizard._esc(p.fuente) : ''}${p.plazo ? ' · ⏱ ' + ImportWizard._esc(p.plazo) : ''}${costo ? ' · 💰 ' + costo : ''}</div>
          ${faltan ? `<div style="font-size:11px;color:#ef4444;margin-top:4px;">Falta: ${faltan.map((f) => ImportWizard._esc(f.queFalta)).join('; ')} — ${ImportWizard._esc(faltan[0].impacto)}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:12px;">Cada paso se guarda automáticamente. Los costos y valores marcados con ⚠️ son estimados: verificá con el despachante o el courier antes de despachar.</div>';
    return html;
  },

  openPlan() {
    const modal = document.getElementById('importPlanModal');
    if (modal) modal.style.display = 'flex';
    ImportWizard.renderPlan();
  },

  renderPlan() {
    const body = document.getElementById('importPlanBody');
    if (!body) return;
    if (typeof ImportGuide === 'undefined' || !ImportGuide.planFor) {
      body.innerHTML = '<div class="alert-banner danger">El motor de plan no está disponible.</div>';
      return;
    }
    const plan = ImportGuide.planFor(ImportWizard._effectiveItems(), ImportWizard.state, ImportWizard._doorConfig());
    body.innerHTML = ImportWizard._planHtml(plan, false, ImportWizard.state.checks || {}, null);
  },

  toggleCheck(id) {
    const s = ImportWizard.state;
    s.checks = s.checks || {};
    s.checks[id] = !s.checks[id];
    ImportWizard._save();
    ImportWizard.renderPlan();
  },

  // Plan guardado en un registro IMP-xxxx (Tracker): se marca y persiste al
  // registro mismo (mismo patrón AppStorage), no al state del wizard.
  async openPlanFromRecord(number) {
    let payload;
    try {
      payload = await AppStorage.loadImports();
    } catch (e) { return; }
    const rec = (payload.records || []).find((r) => r.number === number);
    if (!rec || !rec.plan) {
      if (typeof toast === 'function') toast('Este registro no tiene plan (guardalo desde el asistente de importación).', 'warning');
      return;
    }
    ImportWizard._planRecordNumber = number;
    const modal = document.getElementById('importPlanModal');
    if (modal) modal.style.display = 'flex';
    const body = document.getElementById('importPlanBody');
    if (body) body.innerHTML = ImportWizard._planHtml(rec.plan, true, rec.plan.checks || {}, number);
  },

  async toggleRecordCheck(id) {
    const number = ImportWizard._planRecordNumber;
    if (!number) return;
    let payload;
    try {
      payload = await AppStorage.loadImports();
    } catch (e) { return; }
    const rec = (payload.records || []).find((r) => r.number === number);
    if (!rec || !rec.plan) return;
    rec.plan.checks = rec.plan.checks || {};
    rec.plan.checks[id] = !rec.plan.checks[id];
    try {
      await AppStorage.saveImports(payload);
    } catch (e) {
      if (typeof toast === 'function') toast('No se pudo guardar el avance del plan: ' + ((e && e.message) || e), 'error');
      return;
    }
    const body = document.getElementById('importPlanBody');
    if (body) body.innerHTML = ImportWizard._planHtml(rec.plan, true, rec.plan.checks, number);
    if (typeof renderImportaciones === 'function') renderImportaciones();
  },

  closePlan() {
    const modal = document.getElementById('importPlanModal');
    if (modal) modal.style.display = 'none';
  },

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

    // Un solo punto de inserción: la vigencia aplica a todos los pasos, y
    // duplicar el banner en cada _render_ garantiza que alguno se olvide.
    body.innerHTML = ImportWizard._ratesBanner() + ImportWizard._checkpointsHtml(ImportWizard.steps[ImportWizard.step].id) + ImportWizard['_render_' + ImportWizard.steps[ImportWizard.step].id]();

    const isLast = ImportWizard.step === ImportWizard.steps.length - 1;
    prevBtn.style.visibility = ImportWizard.step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = isLast ? 'Finalizar' : 'Siguiente →';
    nextBtn.onclick = isLast ? () => ImportWizard._finish() : () => ImportWizard.next();
    nextBtn.innerHTML = isLast ? 'Finalizar ✓' : 'Siguiente →';
    prog.textContent = `Paso ${ImportWizard.step + 1} de ${ImportWizard.steps.length}`;
    ImportWizard._save();
  },

  // ---- catálogo ----
  _render_catalogo() {
    const count = (typeof catalog !== 'undefined' && catalog) ? catalog.length : 0;
    const ok = count > 0;
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 1 — ¿Ya tenés un catálogo cargado?</div>
      <div style="font-size:16px;font-weight:700;">${ok ? '✅ Sí' : '⚠️ No'} — ${ok ? count + ' productos' : 'todavía no'}</div>
      <p style="font-size:13px;color:var(--text-muted);margin-top:10px;">${ok ? 'Podés avanzar al pedido. Si querés actualizarlo, cargá los PDFs desde el menú lateral.' : 'Cargá los PDFs o Excel de tus proveedores desde el botón "Cargar Carpeta / PDFs" del menú lateral, y volvé a abrir este asistente.'}</p>
      ${ok ? '' : '<button class="btn btn-secondary btn-sm" onclick="ImportWizard.close(); document.getElementById(\'folderInput\').click()">Cargar catálogo ahora</button>'}
    </div>`;
  },

  // ---- pedido (Etapa A/A3: FOB y peso editables por ítem, ENACOM visible) ----
  _render_pedido() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    const eff = ImportWizard._effectiveItems();
    const count = items.length;
    const ok = count > 0;
    const s = ImportWizard.state;
    const hayWireless = ok && (typeof ImportGuide !== 'undefined') && ImportGuide.tieneInalambricos(eff);
    const rows = items.map((it, i) => {
      const e = eff[i] || it;
      const sku = String(it.sku || '').trim();
      const wireless = (typeof ImportGuide !== 'undefined') && ImportGuide.esInalambrico(it);
      const peso = (typeof ImportGuide !== 'undefined') ? ImportGuide.pesoItemKg(e) : '';
      return `<tr>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.marca || '')}</td>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.modelo || it.sku)}${wireless ? ' <span class="badge" style="background:rgba(234,179,8,0.15);color:#eab308;">📡 inalámbrico</span>' : ''}</td>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.variante || '')}</td>
      <td style="padding:5px 8px;font-size:12px;text-align:right;">${it.qty}</td>
      <td style="padding:5px 8px;font-size:12px;"><input type="number" step="0.01" min="0" style="width:76px;font-size:12px;" value="${e.fob == null ? '' : e.fob}" oninput="ImportWizard.setItemEditByIndex(${i},'fob',this.value);ImportWizard.render()" onchange="ImportWizard.setItemEditByIndex(${i},'fob',this.value);ImportWizard.render()" title="FOB del producto — editable sin tocar el catálogo"></td>
      <td style="padding:5px 8px;font-size:12px;"><input type="number" step="0.01" min="0" style="width:64px;font-size:12px;" value="${peso}" oninput="ImportWizard.setItemEditByIndex(${i},'weightKg',this.value);ImportWizard.render()" onchange="ImportWizard.setItemEditByIndex(${i},'weightKg',this.value);ImportWizard.render()" title="Peso por unidad (default de categoría si no lo editás)"> kg</td>
    </tr>`;
    }).join('');
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 2 — Tu pedido (${count} productos) · TODO editable y recalculado en vivo</div>
      ${ok
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
             <div><label class="wz-lbl">Origen de la mercadería</label><input type="text" class="input" value="${ImportWizard._esc(s.origen || 'China')}" onchange="ImportWizard.state.origen=this.value;ImportWizard._save()"></div>
             ${hayWireless ? `<div><label class="wz-lbl">Homologación ENACOM — titular</label>
               <select class="select" onchange="ImportWizard.state.enacomTitular=this.value;ImportWizard.render()">
                 <option value="" ${!s.enacomTitular ? 'selected' : ''}>Todavía no definido</option>
                 <option value="fabricante" ${s.enacomTitular === 'fabricante' ? 'selected' : ''}>Certificado del fabricante (transferencia)</option>
                 <option value="propia" ${s.enacomTitular === 'propia' ? 'selected' : ''}>Trámite propio (semanas)</option>
               </select>
               <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Los inalámbricos necesitan ENACOM para venderse. El costo se suma automáticamente.</div></div>` : ''}
           </div>
           <div class="table-scroll"><table><thead><tr><th>Marca</th><th>Modelo</th><th>Variante</th><th>Qty</th><th>FOB USD${ImportWizard._tip('FOB')}</th><th>Peso/ud</th></tr></thead><tbody>${rows}</tbody></table></div>
           <div style="display:flex;gap:10px;margin-top:12px;">
             <button class="btn btn-secondary btn-sm" onclick="ImportWizard.close(); switchView('catalogo')">Ajustar pedido</button>
             <button class="btn btn-primary btn-sm" onclick="ImportWizard.next()">Siguiente →</button>
           </div>`
        : `<div style="font-size:15px;font-weight:700;">⚠️ Todavía no armaste tu pedido</div>
           <p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Seleccioná productos en el catálogo y tocá "Armar pedido". Este asistente te acompaña desde el catálogo hasta el depósito.</p>
           <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="ImportWizard.close(); switchView('catalogo')">Ir a armar pedido</button>`}
    </div>`;
  },

  // ---- flete + seguro ----
  _render_flete() {
    const s = ImportWizard.state;
    const fobTotal = ImportWizard._currentFobTotal();
    const sugerencia = ImportWizard.suggestedInsuranceUsd();
    const sugeridoTxt = fobTotal > 0 && sugerencia > 0
      ? '~$' + (Math.round(sugerencia * 100) / 100) + ' USD'
      : '— (armá el pedido primero)';
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 3 — Régimen, transporte y seguro (define tu valor CIF)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label class="wz-lbl">Propósito del envío (Etapa A, d1)</label>
          <select class="select" onchange="ImportWizard.state.proposito=this.value;ImportWizard.render()">
            <option value="personal" ${s.proposito==='personal'?'selected':''}>Uso personal / compra puntual</option>
            <option value="reventa" ${s.proposito==='reventa'?'selected':''}>Reventa / uso comercial</option>
          </select>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.proposito==='reventa' ? '⚠️ El régimen simplificado courier es de consumidor final: si revendés, los tributos reales son los de la matriz completa ("por cuenta y orden", en verificación de fuente). La guía te avisa en cada paso.' : 'El régimen simplificado courier (USD 400 exento + 50% del excedente) aplica a consumo final.'}</div></div>
        <div><label class="wz-lbl">Régimen de importación</label>
          <select class="select" onchange="ImportWizard.state.regimen=this.value;if(this.value==='courier'){ImportWizard.state.transporte='courier';ImportWizard.state.fleteModo='peso';}ImportWizard.render()">
            <option value="importador" ${s.regimen==='importador'?'selected':''}>Importador (despacho general)</option>
            <option value="courier" ${s.regimen==='courier'?'selected':''}>Courier (≤ USD 3.000 / 50kg)</option>
          </select>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.regimen==='courier' ? 'Simplificado: USD 400 exento + 50% arancel + IVA, sin anticipos.' : 'Matriz NCM completa: DI + TE + IVA + anticipos (auditado 2026).'}</div></div>
        <div><label class="wz-lbl">Transporte</label>
          <select class="select" onchange="ImportWizard.state.transporte=this.value;ImportWizard.render()">
            <option value="maritimo" ${s.transporte==='maritimo'?'selected':''}>Marítimo (LCL/FCL)</option>
            <option value="aereo" ${s.transporte==='aereo'?'selected':''}>Aéreo</option>
            ${s.regimen==='courier' ? '<option value="courier" selected>Courier (DHL/FedEx)</option>' : ''}
          </select>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.transporte==='maritimo'?'USD 80-150/CBM · aéreo USD 4-8/kg · courier USD 30-80/kg':s.transporte==='aereo'?'USD 4-8/kg (rápido, caro)':'Servicio puerta a puerta'}</div></div>
        <div><label class="wz-lbl">Modo de flete</label>
          <select id="iwFleteModo" class="select" onchange="ImportWizard.state.fleteModo=this.value;ImportWizard.render()">
            <option value="peso" ${s.fleteModo==='peso'?'selected':''}>Por peso (USD/kg)</option>
            <option value="pct" ${s.fleteModo==='pct'?'selected':''}>% del FOB</option>
          </select></div>
        <div><label class="wz-lbl">Seguro (% del FOB)</label>
          <input type="number" step="0.001" class="input" value="${s.seguro}" onchange="ImportWizard.state.seguro=Number(this.value)/100;ImportWizard.state.seguroUsdOverride=null;ImportWizard.render()" oninput="ImportWizard.state.seguro=Number(this.value)/100;ImportWizard.state.seguroUsdOverride=null"></div>
        ${s.fleteModo==='peso'
          ? `<div><label class="wz-lbl">Peso total (kg)</label><input type="number" class="input" value="${s.pesoKg}" onchange="ImportWizard.state.pesoKg=Number(this.value)" oninput="ImportWizard.state.pesoKg=Number(this.value)"></div>
             <div><label class="wz-lbl">Costo por kg (USD)</label><input type="number" class="input" value="${s.costoPorKg}" onchange="ImportWizard.state.costoPorKg=Number(this.value)" oninput="ImportWizard.state.costoPorKg=Number(this.value)"></div>`
          : `<div><label class="wz-lbl">Flete (% del FOB)</label><input type="number" step="0.01" class="input" value="${s.fletePct*100}" onchange="ImportWizard.state.fletePct=Number(this.value)/100" oninput="ImportWizard.state.fletePct=Number(this.value)/100"></div>
             <div></div>`}
      </div>
      <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Sugerencia de seguro: ~1.1% de FOB + flete</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:14px;font-weight:700;">${sugeridoTxt}</span>
          <button class="btn btn-secondary btn-sm" onclick="ImportWizard.applyInsurancePreset()">Aplicar sugerencia</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          <div><label class="wz-lbl">Seguro en USD (opcional — reemplaza el %)</label>
            <input type="number" step="0.01" class="input" value="${s.seguroUsdOverride != null ? Math.round(s.seguroUsdOverride * 100) / 100 : ''}" oninput="ImportWizard._setSeguroUsd(this.value)" onchange="ImportWizard._setSeguroUsd(this.value);ImportWizard.render()"></div>
          <div><label class="wz-lbl">Precio local de referencia (USD)</label>
            <input type="number" step="0.01" class="input" value="${s.precioLocalUsd != null ? s.precioLocalUsd : ''}" oninput="ImportWizard.state.precioLocalUsd=this.value!==''?Number(this.value):null" onchange="ImportWizard.state.precioLocalUsd=this.value!==''?Number(this.value):null;ImportWizard.render()"></div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">El seguro suele ser 1-2% del FOB. Si no declarás, Aduana aplica un porcentaje presunto.</p>
    </div>`;
  },

  // ---- impuestos + aduana ----
  _render_impuestos() {
    const matrix = (typeof Calculator !== 'undefined' && Calculator.NCM_MATRIX) ? Calculator.NCM_MATRIX : {};
    const s = ImportWizard.state;
    const ii = ImportWizard._iibbPct();
    const rm = (typeof Calculator !== 'undefined' && Calculator.RATES_META) ? Calculator.RATES_META : {};
    const rows = Object.entries(matrix).map(([k, r]) => {
          const ov = ImportWizard.state.ncmOverrides && ImportWizard.state.ncmOverrides[k];
          const di = (ov && ov.derechos != null) ? ov.derechos : r.derechos;
          const shownNcm = (ov && ov.ncm) ? ov.ncm : r.ncm;
          return `<tr>
            <td style="padding:6px 8px;font-size:12px;">${ImportWizard._esc(k)}</td>
            <td style="padding:6px 8px;font-size:12px;font-family:var(--font-mono);">${shownNcm}</td>
            <td style="padding:6px 8px;font-size:12px;">DI <input type="number" step="0.01" style="width:60px;font-size:12px;" value="${Math.round(di*100)}" onchange="ImportWizard.state.ncmOverrides['${k}']={derechos:Number(this.value)/100};ImportWizard.render()">%</td>
            <td style="padding:6px 8px;font-size:12px;">TE ${Math.round(r.tasa*100)}%</td>
            <td style="padding:6px 8px;font-size:12px;">IVA ${Math.round(r.iva*100)}%</td>
            <td style="padding:6px 8px;font-size:12px;">+${Math.round(r.ivaAdd*100)}%</td>
            <td style="padding:6px 8px;font-size:12px;">Gan ${Math.round(r.percGan*100)}%</td>
            <td style="padding:6px 8px;font-size:12px;">IIBB ${Math.round(ii*1000)/10}%</td>
          </tr>`;
        }).join('');
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:8px;">Paso 4 — Tributos por NCM (matriz auditada 2026: ARCA, AFIP, Decreto 333/25)</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Matriz: ${ImportWizard._esc(rm.fuentes || 'ARCA/AFIP')} · vigente hasta <strong>${ImportWizard._esc(rm.vigenciaHasta || 'sin fecha')}</strong> · última verificación ${ImportWizard._esc(rm.actualizada || '?')}. El aviso de vencimiento lo calcula Calculator.ratesStatus().</div>
      <div style="display:flex;gap:12px;align-items:end;margin-bottom:10px;">
        <div><label class="wz-lbl">Jurisdicción IIBB</label>
          <select class="select" onchange="ImportWizard.state.iibbJurisdiccion=this.value;ImportWizard.render()">
            <option value="cab" ${s.iibbJurisdiccion==='cab'?'selected':''}>CABA (2.5%)</option>
            <option value="pba" ${s.iibbJurisdiccion==='pba'?'selected':''}>PBA (3.5%)</option>
            <option value="santa_fe" ${s.iibbJurisdiccion==='santa_fe'?'selected':''}>Santa Fe (3%)</option>
            <option value="otra" ${s.iibbJurisdiccion==='otra'?'selected':''}>Otra — configurar</option>
          </select></div>
        ${s.iibbJurisdiccion==='otra'
          ? `<div><label class="wz-lbl">IIBB %</label><input type="number" step="0.1" class="input" style="width:90px;" value="${Math.round((s.iibbPctCustom||0.025)*1000)/10}" onchange="ImportWizard.state.iibbPctCustom=Number(this.value)/100;ImportWizard.render()"></div>`
          : ''}
        <div><label class="wz-lbl">Percepción Bienes Personales</label>
          <input type="number" step="0.1" class="input" style="width:90px;" value="${Math.round((s.bpPct || 0) * 1000) / 10}" oninput="ImportWizard.state.bpPct=Number(this.value)/100" onchange="ImportWizard.state.bpPct=Number(this.value)/100;ImportWizard.render()">
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">% — opcional, aditiva al total</div></div>
      </div>
      <div class="iw-search" style="display:flex;gap:10px;align-items:end;margin-bottom:10px;flex-wrap:wrap;">
        <div><label class="wz-lbl">Buscar NCM (base completa ARCA)</label>
          <input id="iwNcmSearch" type="text" class="input" style="width:240px;" placeholder="ej: impresora, lavadora, 8471..." oninput="ImportWizard._ncmSearch(this.value)"></div>
        <div><label class="wz-lbl">Aplicar a categoría</label>
          <select id="iwNcmCat" class="select">${Object.keys(matrix).map(k=>`<option value="${k}">${k}</option>`).join('')}</select></div>
        <div id="iwNcmResults" style="display:none;width:100%;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:8px;max-height:180px;overflow:auto;padding:6px;"></div>
      </div>
      <div class="table-scroll"><table><thead><tr><th>Categoría</th><th>NCM</th><th>Derecho ${ImportWizard._tip('DI')}</th><th>Tasa ${ImportWizard._tip('TE')}</th><th>IVA ${ImportWizard._tip('IVA')}</th><th>IVA adic ${ImportWizard._tip('IVAD')}</th><th>Gan ${ImportWizard._tip('GAN')}</th><th>IIBB ${ImportWizard._tip('IIBB')}</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${ImportWizard._renderSkuOverrides()}
    </div>`;
  },

      // ── override de NCM por producto (guided-import-wizard / ncm-totality) ──
      // Antes el único override era por categoría (state.ncmOverrides[cat]) y el
      // motor lo resolvía por ncmKeyFor(item): en un catálogo mixto un producto
      // clasificado mal pagaba el arancel de su categoría supuesta y no había
      // forma de corregirlo sin romper a los demás de esa categoría. La clave por
      // SKU gana sobre la de categoría, y ninguna de las dos cambia el resultado
      // cuando no se usa (los números pinificados de IT23/IT33 siguen igual).
      _skuOverrideList() {
        const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items)
          ? currentPedido.items
          : [];
        const seen = new Set();
        const out = [];
        for (const it of items) {
          const sku = String((it && it.sku) || '').trim();
          if (!sku || seen.has(sku)) continue;
          seen.add(sku);
          out.push(it);
        }
        return out;
      },

      // Indice -> sku: el markup pasa índices, no SKUs, para no armar cadenas de
      // JS con comillas dentro de un atributo.
      _skuByIndex(i) {
        const it = ImportWizard._skuOverrideList()[Number(i)];
        return it ? String(it.sku || '').trim() : null;
      },

      setSkuNcm(index, field, value) {
        const sku = ImportWizard._skuByIndex(index);
        if (!sku) return;
        const s = ImportWizard.state;
        s.ncmBySku = s.ncmBySku || {};
        const cur = Object.assign({}, s.ncmBySku[sku] || {});
        if (field === 'ncm') {
          if (value) cur.ncm = String(value);
          else delete cur.ncm;
        } else if (field === 'di') {
          if (value !== '' && value != null && !Number.isNaN(Number(value))) cur.derechos = Number(value) / 100;
          else delete cur.derechos;
        }
        if (cur.ncm == null && cur.derechos == null) delete s.ncmBySku[sku];
        else s.ncmBySku[sku] = cur;
        ImportWizard._save();
      },

      clearSkuNcm(index) {
        const sku = ImportWizard._skuByIndex(index);
        if (!sku) return;
        const s = ImportWizard.state;
        if (s.ncmBySku) delete s.ncmBySku[sku];
        ImportWizard._save();
        ImportWizard.render();
      },

      _renderSkuOverrides() {
        const matrix = (typeof Calculator !== 'undefined' && Calculator.NCM_MATRIX) ? Calculator.NCM_MATRIX : {};
        const items = ImportWizard._skuOverrideList();
        if (!items.length) {
          return '<div style="font-size:12px;color:var(--text-muted);">Todavía no hay productos en el pedido: cargalos en el paso 2 para poder corregir el NCM de uno solo.</div>';
        }
        const bySku = (ImportWizard.state.ncmBySku || {});
        const ncms = [...new Set(Object.values(matrix).map((r) => r.ncm))];
        const rows = items.map((it, i) => {
          const sku = String(it.sku || '').trim();
          const autoKey = (typeof Calculator !== 'undefined' && Calculator.ncmKeyFor) ? Calculator.ncmKeyFor(it) : '';
          const auto = matrix[autoKey] || matrix['OTRO'] || {};
          const ov = bySku[sku] || {};
          const ncm = ov.ncm || auto.ncm || '';
          const di = ov.derechos != null ? ov.derechos : auto.derechos;
          const touched = !!(ov.ncm || ov.derechos != null);
          const opts = ['<option value="">auto (' + (auto.ncm || '-') + ')</option>']
            .concat(ncms.map((n) => `<option value="${n}"${n === ncm && ov.ncm ? ' selected' : ''}>${n}</option>`))
            .join('');
          return `<tr>
            <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.marca || '')} ${ImportWizard._esc(it.modelo || sku)}</td>
            <td style="padding:5px 8px;font-size:12px;color:var(--text-muted);">${ImportWizard._esc(it.variante || '')}</td>
            <td style="padding:5px 8px;font-size:12px;font-family:var(--font-mono);">${ImportWizard._esc(autoKey || '-')}</td>
            <td style="padding:5px 8px;font-size:12px;"><select class="select" style="font-size:12px;padding:2px 6px;" onchange="ImportWizard.setSkuNcm(${i},'ncm',this.value);ImportWizard.render()">${opts}</select></td>
            <td style="padding:5px 8px;font-size:12px;">DI <input type="number" step="0.1" style="width:64px;font-size:12px;" value="${di == null ? '' : Math.round(di * 1000) / 10}" onchange="ImportWizard.setSkuNcm(${i},'di',this.value);ImportWizard.render()">%</td>
            <td style="padding:5px 8px;font-size:12px;">${touched ? '<span style="color:var(--yellow);">corregido</span>' : '<span style="color:var(--text-muted);">auto</span>'} <button class="btn btn-secondary btn-sm" style="padding:1px 6px;font-size:11px;" onclick="ImportWizard.clearSkuNcm(${i})"${touched ? '' : ' disabled'}>limpiar</button></td>
          </tr>`;
        }).join('');
        return `<div style="margin-top:14px;">
          <div class="page-sub" style="color:var(--text-muted);margin-bottom:6px;">Override por producto (${items.length} en el pedido) — gana sobre el de categoría; solo este ítem cambia de NCM</div>
          <div class="table-scroll"><table><thead><tr><th>Producto</th><th>Variante</th><th>Categoría inf.</th><th>NCM</th><th>Derecho de importación</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>`;
      },

  // IT23: busca NCM en la base completa y muestra resultados para reasignar.
  _ncmSearch(q) {
    const box = document.getElementById('iwNcmResults');
    if (!box || typeof NcmDatabase === 'undefined' || !NcmDatabase._db) return;
    q = (q || '').trim();
    if (q.length < 2) { box.style.display = 'none'; return; }
    const res = NcmDatabase.search(q, 10);
    box.innerHTML = res.map(r => `<div style="padding:5px 8px;cursor:pointer;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)" onmousedown="event.preventDefault();ImportWizard._setNcmOverride('${r.ncm}','${String(r.di||0)}')">${r.ncm} · ${ImportWizard._esc(String(r.desc||'').slice(0,60))} · <b>DI ${Math.round((r.di!=null?r.di:0)*100)}%</b></div>`).join('');
    box.style.display = 'block';
  },

  _setNcmOverride(ncm, diPct) {
    const cat = document.getElementById('iwNcmCat').value;
    ImportWizard.state.ncmOverrides[cat] = { ncm, derechos: parseFloat(diPct) };
    const box = document.getElementById('iwNcmResults'); if (box) box.style.display = 'none';
    ImportWizard.render();
    if (typeof toast === 'function') toast(`NCM ${ncm} asignado a ${cat}`, 'success');
  },

  // ---- Glosario de términos técnicos (tooltip "i") — usa el global tip() ----
  _tip(term) {
    return (typeof window !== 'undefined' && window.tip) ? window.tip(term) : '';
  },

  // ---- gastos destino ----
  _render_gastos() {
    const s = ImportWizard.state;
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 5 — Gastos fijos de destino</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label class="wz-lbl">Depósito fiscal / TCA (USD)</label><input type="number" class="input" value="${s.depositoFiscalUsd}" oninput="ImportWizard.state.depositoFiscalUsd=Number(this.value)"></div>
        <div><label class="wz-lbl">Honorarios despachante (USD)</label><input type="number" class="input" value="${s.despachanteUsd}" oninput="ImportWizard.state.despachanteUsd=Number(this.value)"></div>
        <div><label class="wz-lbl">Digitalización SIM (USD)</label><input type="number" class="input" value="${s.simDigitalizacionUsd}" oninput="ImportWizard.state.simDigitalizacionUsd=Number(this.value)"></div>
        <div><label class="wz-lbl">Flete interno a depósito (USD)</label><input type="number" class="input" value="${s.fleteInternoUsd}" oninput="ImportWizard.state.fleteInternoUsd=Number(this.value)"></div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">Rangos típicos: despachante USD 300-800, depósito USD 150-300, THC portuario USD 150-300.</p>
    </div>`;
  },

  // ---- resumen (Etapa A: checkpoints completos + plan) ----
  _render_resumen() {
    const items = ImportWizard._effectiveItems();
    const s = ImportWizard.state;
    if (!items.length) {
      return `<div class="card" style="padding:18px;"><div style="font-weight:700;">No hay pedido.</div><p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Volvé al paso 2 y armá el pedido desde el catálogo.</p></div>`;
    }
    const fobTotal = items.reduce((a, i) => a + (i.fob || 0) * (i.qty || 0), 0);
    const res = Calculator.calculateDoorToDoorExactCost(items, ImportWizard._doorConfig());
    const planLive = (typeof ImportGuide !== 'undefined' && ImportGuide.planFor) ? ImportGuide.planFor(items, s, ImportWizard._doorConfig()) : null;
    const planPendientes = planLive ? planLive.pasos.filter((x) => !(s.checks && s.checks[x.id])).length : 0;
    const sum = res.summary;
    const recupera = s.recuperaCredito;
    const neto = recupera ? sum.costoNetoRealUsd : sum.totalPuertaConIvaUsd;

    // Slice C: desglose PAIS 0% (fuente única getPaisLine) + percepción BP + veredicto
    const bpUsd = sum.bpUsd || 0;
    const paisLine = (typeof Calculator !== 'undefined' && typeof Calculator.getPaisLine === 'function') ? Calculator.getPaisLine() : null;
    const precioLocal = s.precioLocalUsd;
    let verdictHtml = '';
    if (precioLocal != null && precioLocal > 0 && typeof Calculator !== 'undefined' && typeof Calculator.compareVsLocal === 'function') {
      const v = Calculator.compareVsLocal(sum.totalPuertaConIvaUsd, precioLocal, sum.tipoCambio);
      if (v.available) {
        const labels = {
          cheaper: '✅ Comprar afuera es más barato',
          more_expensive: '⚠️ Comprar local es más barato',
          break_even: '⚖️ Empate — mismo costo'
        };
        const signTxt = v.verdict === 'cheaper' ? 'Ahorrás' : v.verdict === 'more_expensive' ? 'Pagás' : 'Diferencia';
        verdictHtml = `<div style="margin-top:14px;padding:12px;border-radius:8px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.3);">
          <div style="font-size:13px;font-weight:700;">${labels[v.verdict] || v.verdict}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${signTxt} $${Math.abs(v.diffUsd).toFixed(2)} USD (${v.diffPct >= 0 ? '+' : ''}${v.diffPct.toFixed(1)}% vs precio local)</div>
          <div style="font-size:12px;color:var(--text-muted);">En pesos: $${Math.abs(v.diffArs).toFixed(2)} ARS</div>
        </div>`;
      }
    }

    const rows = res.items.map(i => `<tr>
      <td style="padding:6px 8px;font-size:12px;">${ImportWizard._esc(i.modelo || i.sku)}</td>
      <td style="padding:6px 8px;font-size:12px;font-family:var(--font-mono);">${i.ncm}</td>
      <td style="padding:6px 8px;font-size:12px;">${i.qty}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:right;">$${Math.round(i.derechosUsd + i.tasaUsd + i.ivaAddUsd + i.percGanUsd + i.iibbUsd).toLocaleString()}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:right;">$${Math.round(i.costoRealItemUsd + i.ivaUsd).toLocaleString()}</td>
    </tr>`).join('');

    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 6 — Resumen financiero</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <label style="font-size:12px;color:var(--text-muted);">¿Recuperás crédito fiscal (responsable inscripto)?</label>
        <select class="select" style="width:auto;" onchange="ImportWizard.state.recuperaCredito=this.value==='si';ImportWizard.render()">
          <option value="si" ${recupera?'selected':''}>Sí — revendo y compenso</option>
          <option value="no" ${!recupera?'selected':''}>No — calculé como costo</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <div><div class="iw-kpi-lbl">FOB ${ImportWizard._tip('FOB')}</div><div class="iw-kpi">$${Math.round(fobTotal).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">CIF ${ImportWizard._tip('CIF')}</div><div class="iw-kpi">$${Math.round(sum.cifTotalUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">Caja (lo que sale)</div><div class="iw-kpi">$${Math.round(sum.totalPuertaConIvaUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl" style="color:var(--green-hover);">Costo neto real ${ImportWizard._tip('CRED')}</div><div class="iw-kpi" style="color:var(--green-hover);">$${Math.round(neto).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl" style="color:var(--blue);">Crédito fiscal ${ImportWizard._tip('CRED')}</div><div class="iw-kpi" style="color:var(--blue);">$${Math.round(sum.totalRecuperableUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">Multiplicador (caja/FOB)</div><div class="iw-kpi">${(sum.totalPuertaConIvaUsd / fobTotal).toFixed(2)}x</div></div>
      </div>
      <div class="iw-kpi-lbl" style="margin-top:14px;">Desglose de tributos</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text-muted);">
        <span>Derechos + Tasa + Anticipos: $${Math.round(sum.totalTributosAduanaUsd).toLocaleString()}</span>
        <span>IVA: $${Math.round(sum.totalIvaAduanaUsd).toLocaleString()}</span>
        ${bpUsd > 0 ? `<span>Percepción BP: $${Math.round(bpUsd * 100) / 100}</span>` : ''}
        ${paisLine ? `<span>${paisLine.label}: ${paisLine.ratePct}% — ${paisLine.status === 'eliminated' ? 'eliminado (no se paga)' : ''}</span>` : ''}
      </div>
      ${verdictHtml}
      <div class="table-scroll" style="margin-top:14px;"><table><thead><tr><th>Producto</th><th>NCM</th><th>Qty</th><th>Tributos</th><th>Costo unit+IVA</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="ImportWizard.saveAsImport()">💾 Guardar como importación</button>
        <button class="btn btn-primary btn-sm" onclick="ImportWizard.openPlan()">📋 Ver plan completo (${planPendientes} pendientes)</button>
        <button class="btn btn-primary btn-sm" onclick="ImportWizard.exportCsv()">⬇ Exportar resumen CSV</button>
        <button class="btn btn-primary btn-sm" onclick="ImportWizard.exportSummaryPdf()">🖨 Exportar resumen PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="ImportWizard.saveProject()">💾 Guardar proyecto</button>
        <button class="btn btn-ghost btn-sm" onclick="ImportWizard.clearProject()">Descartar proyecto</button>
      </div>
    </div>`;
  },

  // Exporta el resumen del proyecto a CSV (descarga).
  exportCsv() {
    const items = ImportWizard._effectiveItems();
    if (!items.length) { if (typeof toast === 'function') toast('No hay pedido para exportar', 'error'); return; }
    const res = Calculator.calculateDoorToDoorExactCost(items, ImportWizard._doorConfig());
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

  // ---- Slice C: preset de seguro, veredicto y bridge al tracker ----

  // Config del motor puerta a puerta con los inputs del asistente (incluye BP).
  _doorConfig() {
    const s = ImportWizard.state;
    // Etapa A (A3): si no hay peso manual, se usa el peso REAL calculado de los
    // ítems (defaults por categoría + overrides editables). Así el flete courier
    // y el chequeo de 50kg/3.000 USD describen el pedido, no un default ciego.
    const pesoItems = (typeof ImportGuide !== 'undefined' && ImportGuide.pesoTotalKg) ? ImportGuide.pesoTotalKg(ImportWizard._effectiveItems()) : 0;
    const pesoKg = s.fleteModo === 'peso' ? (Number(s.pesoKg) > 0 ? s.pesoKg : pesoItems) : 0;
    const costoPorKg = s.fleteModo === 'peso' ? s.costoPorKg : 0;
    const fletePct = s.fleteModo === 'pct' ? s.fletePct : 0.15;
    return {
      tipoCambio: 1400, pesoKg, costoPorKg, fletePct, seguroPct: s.seguro,
      regimen: s.regimen, bpPct: s.bpPct,
      iibbPct: ImportWizard._iibbPct(), ncmOverrides: s.ncmOverrides, ncmBySku: s.ncmBySku || {},
      depositoFiscalUsd: s.depositoFiscalUsd, despachanteUsd: s.despachanteUsd,
      simDigitalizacionUsd: s.simDigitalizacionUsd, fleteInternoUsd: s.fleteInternoUsd
    };
  },

  _currentFobTotal() {
    const items = ImportWizard._effectiveItems();
    return items.reduce((a, i) => a + (i.fob || 0) * (i.qty || 0), 0);
  },

  // Mismo criterio que el motor: flete por peso (kg × USD/kg) o % del FOB.
  _estimateFlete() {
    const s = ImportWizard.state;
    const fob = ImportWizard._currentFobTotal();
    if (s.fleteModo === 'peso') {
      const peso = Number(s.pesoKg) > 0 ? Number(s.pesoKg) : ((typeof ImportGuide !== 'undefined' && ImportGuide.pesoTotalKg) ? ImportGuide.pesoTotalKg(ImportWizard._effectiveItems()) : 0);
      return peso * (s.costoPorKg || 0);
    }
    return fob * (s.fletePct != null ? s.fletePct : 0.15);
  },

  suggestedInsuranceUsd() {
    const fob = ImportWizard._currentFobTotal();
    if (fob <= 0) return 0;
    const flete = ImportWizard._estimateFlete();
    return (typeof Calculator !== 'undefined' && typeof Calculator.suggestInsuranceUsd === 'function')
      ? Calculator.suggestInsuranceUsd(fob, flete) : 0;
  },

  // Convierte un monto explícito de seguro al equivalente seguroPct = amount / fobTotal
  // (el motor no cambia: sigue recibiendo la fracción del FOB). '' limpia el override.
  _setSeguroUsd(raw) {
    const s = ImportWizard.state;
    if (raw === '' || raw === null || raw === undefined) {
      s.seguroUsdOverride = null;
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return;
    s.seguroUsdOverride = v;
    const fob = ImportWizard._currentFobTotal();
    if (fob > 0) s.seguro = v / fob;
  },

  applyInsurancePreset() {
    const amt = Math.round(ImportWizard.suggestedInsuranceUsd() * 100) / 100;
    if (amt <= 0) {
      if (typeof toast === 'function') toast('Armá el pedido primero para estimar el seguro', 'error');
      return;
    }
    ImportWizard._setSeguroUsd(String(amt));
    ImportWizard.render();
    if (typeof toast === 'function') toast(`Seguro sugerido: $${amt} USD aplicado`, 'success');
  },

  // Bridge "Guardar como importación" (spec import-tracker / Wizard Save Bridge):
  // crea un registro IMP-xxxx en `ordered` con snapshot del costo final (caja).
  // DECLINED → no crea registro, no muta estado ni flujo.
  // Etapa A (A2): fail-closed — con faltantes blocking NO se guarda y el aviso
  // dice QUÉ falta. Etapa A (A4): el registro lleva su PLAN adjunto + checks.
  async saveAsImport() {
    const items = ImportWizard._effectiveItems();
    if (!items.length) {
      if (typeof toast === 'function') toast('No hay pedido para guardar', 'error');
      return;
    }
    const s = ImportWizard.state;
    // Gate fail-closed (A2): bloquea con faltantes blocking y lo dice.
    const v = ImportWizard.validate();
    const blocking = (v.faltantes || []).filter((f) => f.blocking);
    if (blocking.length) {
      if (typeof toast === 'function') {
        toast('No se puede guardar: ' + blocking.map((b) => b.queFalta).join(' · '), 'error');
      }
      return;
    }
    const res = Calculator.calculateDoorToDoorExactCost(items, ImportWizard._doorConfig());
    const sum = res.summary;
    let ok = true;
    if (typeof confirm === 'function') {
      ok = confirm(`¿Guardar esta importación en el tracker? Costo final (caja): $${Math.round(sum.totalPuertaConIvaUsd * 100) / 100} USD`);
    }
    if (!ok) {
      if (typeof toast === 'function') toast('No se guardó la importación', 'info');
      return;
    }
    let supplier = '';
    if (typeof prompt === 'function') {
      supplier = prompt('Proveedor de esta importación:', '');
      if (supplier === null) return; // prompt cancelado → no guardar
      supplier = supplier.trim();
    }
    if (typeof ImportsTracker === 'undefined') {
      if (typeof toast === 'function') toast('Tracker no disponible', 'error');
      return;
    }
    const payload = (typeof AppStorage !== 'undefined' && AppStorage.loadImports)
      ? await AppStorage.loadImports()
      : { records: [], counter: 0 };
    const desc = items.map(i => i.modelo || i.sku).filter(Boolean).slice(0, 4).join(', ');
    const result = ImportsTracker.createRecord(payload, {
      supplier,
      description: desc,
      fobTotalUsd: sum.fobTotalUsd
    });
    // Snapshot de costo + inputs del asistente: createRecord deja los defaults en
    // estos campos; el bridge los completa con la salida del motor (no toca Slice A).
    const rec = result.record;
    rec.freightUsd = sum.fleteTotalUsd;
    rec.insuranceUsd = sum.seguroTotalUsd;
    rec.courier = s.regimen === 'courier' ? 'Courier' : (s.transporte || '');
    rec.finalLandedCostUsd = sum.totalPuertaConIvaUsd;
    rec.localPriceUsd = (s.precioLocalUsd != null && s.precioLocalUsd > 0) ? s.precioLocalUsd : null;
    rec.tipoCambio = sum.tipoCambio;
    // Etapa A (A4): el plan queda adjunto al registro para seguirlo desde el Tracker.
    if (v.plan) {
      rec.plan = {
        generado: new Date().toISOString(),
        regimen: v.plan.regimen,
        proposito: v.plan.proposito,
        checks: Object.assign({}, s.checks || {}),
        pasos: v.plan.pasos.map((p) => ({
          id: p.id, titulo: p.titulo, descripcion: p.descripcion,
          responsable: p.responsable, costoUsd: p.costoUsd || 0,
          plazo: p.plazo || '', fuente: p.fuente || '',
          completo: !!p.completo,
          pendiente: !!(p.faltantes && p.faltantes.length)
        }))
      };
    }
    rec.notes = 'Creado desde el asistente de importación (paso 6)';
    if (typeof AppStorage !== 'undefined' && AppStorage.saveImports) {
      await AppStorage.saveImports(result.payload);
    }
    if (typeof toast === 'function') toast(`Importación ${rec.number} guardada`, 'success');
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