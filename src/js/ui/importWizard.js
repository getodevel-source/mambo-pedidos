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
    body.innerHTML = ImportWizard._ratesBanner() + ImportWizard['_render_' + ImportWizard.steps[ImportWizard.step].id]();

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

  // ---- pedido ----
  _render_pedido() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    const count = items.length;
    const ok = count > 0;
    const rows = items.map(it => `<tr>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.marca || '')}</td>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.modelo || it.sku)}</td>
      <td style="padding:5px 8px;font-size:12px;">${ImportWizard._esc(it.variante || '')}</td>
      <td style="padding:5px 8px;font-size:12px;text-align:right;">${it.qty}</td>
      <td style="padding:5px 8px;font-size:12px;text-align:right;">$${Math.round((it.fob||0)*100)/100}</td>
    </tr>`).join('');
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 2 — Tu pedido (${count} productos)</div>
      ${ok
        ? `<div class="table-scroll"><table><thead><tr><th>Marca</th><th>Modelo</th><th>Variante</th><th>Qty</th><th>FOB</th></tr></thead><tbody>${rows}</tbody></table></div>
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

  // ---- resumen ----
  _render_resumen() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    const s = ImportWizard.state;
    if (!items.length) {
      return `<div class="card" style="padding:18px;"><div style="font-weight:700;">No hay pedido.</div><p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Volvé al paso 2 y armá el pedido desde el catálogo.</p></div>`;
    }
    const fobTotal = items.reduce((a, i) => a + (i.fob || 0) * (i.qty || 0), 0);
    const res = Calculator.calculateDoorToDoorExactCost(items, ImportWizard._doorConfig());
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
        <button class="btn btn-primary btn-sm" onclick="ImportWizard.exportCsv()">⬇ Exportar resumen CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="ImportWizard.saveProject()">💾 Guardar proyecto</button>
        <button class="btn btn-ghost btn-sm" onclick="ImportWizard.clearProject()">Descartar proyecto</button>
      </div>
    </div>`;
  },

  // Exporta el resumen del proyecto a CSV (descarga).
  exportCsv() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
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
    const pesoKg = s.fleteModo === 'peso' ? s.pesoKg : 0;
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
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    return items.reduce((a, i) => a + (i.fob || 0) * (i.qty || 0), 0);
  },

  // Mismo criterio que el motor: flete por peso (kg × USD/kg) o % del FOB.
  _estimateFlete() {
    const s = ImportWizard.state;
    const fob = ImportWizard._currentFobTotal();
    if (s.fleteModo === 'peso') return (s.pesoKg || 0) * (s.costoPorKg || 0);
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
  async saveAsImport() {
    const items = (typeof currentPedido !== 'undefined' && currentPedido && currentPedido.items) ? currentPedido.items : [];
    if (!items.length) {
      if (typeof toast === 'function') toast('No hay pedido para guardar', 'error');
      return;
    }
    const s = ImportWizard.state;
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