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
    iibbJurisdiccion: 'cab', iibbPctCustom: 0.025,
    ncmOverrides: {}
  },
  CACHE_KEY: 'mamboImportWizardState',
  PROJECT_KEY: 'mamboImportProyecto',
  // IIBB por jurisdicción (olmoscomex: CABA ~2.5%, PBA más alto). Configurable.
  IIBB_JURISDICCIONES: { cab: 0.025, pba: 0.035, otra: null },

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
          <input type="number" step="0.001" class="input" value="${s.seguro}" onchange="ImportWizard.state.seguro=Number(this.value)/100" oninput="ImportWizard.state.seguro=Number(this.value)/100"></div>
        ${s.fleteModo==='peso'
          ? `<div><label class="wz-lbl">Peso total (kg)</label><input type="number" class="input" value="${s.pesoKg}" onchange="ImportWizard.state.pesoKg=Number(this.value)" oninput="ImportWizard.state.pesoKg=Number(this.value)"></div>
             <div><label class="wz-lbl">Costo por kg (USD)</label><input type="number" class="input" value="${s.costoPorKg}" onchange="ImportWizard.state.costoPorKg=Number(this.value)" oninput="ImportWizard.state.costoPorKg=Number(this.value)"></div>`
          : `<div><label class="wz-lbl">Flete (% del FOB)</label><input type="number" step="0.01" class="input" value="${s.fletePct*100}" onchange="ImportWizard.state.fletePct=Number(this.value)/100" oninput="ImportWizard.state.fletePct=Number(this.value)/100"></div>
             <div></div>`}
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">El seguro suele ser 1-2% del FOB. Si no declarás, Aduana aplica un porcentaje presunto.</p>
    </div>`;
  },

  // ---- impuestos + aduana ----
  _render_impuestos() {
    const matrix = (typeof Calculator !== 'undefined' && Calculator.NCM_MATRIX) ? Calculator.NCM_MATRIX : {};
    const s = ImportWizard.state;
    const ii = ImportWizard._iibbPct();
    const rows = Object.entries(matrix).map(([k, r]) => {
      const ov = ImportWizard.state.ncmOverrides && ImportWizard.state.ncmOverrides[k];
      const di = (ov && ov.derechos != null) ? ov.derechos : r.derechos;
      return `<tr>
        <td style="padding:6px 8px;font-size:12px;">${ImportWizard._esc(k)}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:var(--font-mono);">${r.ncm}</td>
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
      <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:10px 12px;font-size:12px;color:#fde047;margin-bottom:10px;">⚠️ Alícuotas verificadas a <strong>2026</strong>. Revisá actualizaciones de ARCA antes de despachar (la matriz no se actualiza sola).</div>
      <div style="display:flex;gap:12px;align-items:end;margin-bottom:10px;">
        <div><label class="wz-lbl">Jurisdicción IIBB</label>
          <select class="select" onchange="ImportWizard.state.iibbJurisdiccion=this.value;ImportWizard.render()">
            <option value="cab" ${s.iibbJurisdiccion==='cab'?'selected':''}>CABA (2.5%)</option>
            <option value="pba" ${s.iibbJurisdiccion==='pba'?'selected':''}>PBA (3.5%)</option>
            <option value="otra" ${s.iibbJurisdiccion==='otra'?'selected':''}>Otra — configurar</option>
          </select></div>
        ${s.iibbJurisdiccion==='otra'
          ? `<div><label class="wz-lbl">IIBB %</label><input type="number" step="0.1" class="input" style="width:90px;" value="${Math.round((s.iibbPctCustom||0.025)*1000)/10}" onchange="ImportWizard.state.iibbPctCustom=Number(this.value)/100;ImportWizard.render()"></div>`
          : ''}
      </div>
      <div class="iw-search" style="display:flex;gap:10px;align-items:end;margin-bottom:10px;flex-wrap:wrap;">
        <div><label class="wz-lbl">Buscar NCM (base completa ARCA)</label>
          <input id="iwNcmSearch" type="text" class="input" style="width:240px;" placeholder="ej: impresora, lavadora, 8471..." oninput="ImportWizard._ncmSearch(this.value)"></div>
        <div><label class="wz-lbl">Aplicar a categoría</label>
          <select id="iwNcmCat" class="select">${Object.keys(matrix).map(k=>`<option value="${k}">${k}</option>`).join('')}</select></div>
        <div id="iwNcmResults" style="display:none;width:100%;background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:8px;max-height:180px;overflow:auto;padding:6px;"></div>
      </div>
      <div class="table-scroll"><table><thead><tr><th>Categoría</th><th>NCM</th><th>Derecho</th><th>Tasa</th><th>IVA</th><th>IVA adic</th><th>Gan</th><th>IIBB</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  },

  // IT23: busca NCM en la base completa y muestra resultados para reasignar.
  _ncmSearch(q) {
    const box = document.getElementById('iwNcmResults');
    if (!box || typeof NcmDatabase === 'undefined' || !NcmDatabase._db) return;
    q = (q || '').trim();
    if (q.length < 2) { box.style.display = 'none'; return; }
    const res = NcmDatabase.search(q, 10);
    const catSel = document.getElementById('iwNcmCat');
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
    const recupera = s.recuperaCredito;
    const neto = recupera ? sum.costoNetoRealUsd : sum.totalPuertaConIvaUsd;

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
        <div><div class="iw-kpi-lbl">FOB</div><div class="iw-kpi">$${Math.round(fobTotal).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">CIF (con flete+seguro)</div><div class="iw-kpi">$${Math.round(sum.cifTotalUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">Caja (lo que sale)</div><div class="iw-kpi">$${Math.round(sum.totalPuertaConIvaUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl" style="color:var(--green-hover);">Costo neto real</div><div class="iw-kpi" style="color:var(--green-hover);">$${Math.round(neto).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl" style="color:var(--blue);">Crédito fiscal a favor</div><div class="iw-kpi" style="color:var(--blue);">$${Math.round(sum.totalRecuperableUsd).toLocaleString()}</div></div>
        <div><div class="iw-kpi-lbl">Multiplicador (caja/FOB)</div><div class="iw-kpi">${(sum.totalPuertaConIvaUsd / fobTotal).toFixed(2)}x</div></div>
      </div>
      <div class="table-scroll" style="margin-top:14px;"><table><thead><tr><th>Producto</th><th>NCM</th><th>Qty</th><th>Tributos</th><th>Costo unit+IVA</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="display:flex;gap:10px;margin-top:16px;">
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
    { q: '¿Qué impuestos pago al importar periféricos?', a: 'Los periféricos (teclados, mouse, auriculares, controllers) pagan: Derechos de Importación (12-20% según NCM), Tasa de Estadística (3% CIF), IVA (21%), IVA adicional (20% — pago a cuenta), Percepción Ganancias (6% inscripto) e IIBB (2.5% según jurisdicción). El Impuesto PAIS fue ELIMINADO.' },
    { q: '¿Cuál es la base imponible?', a: 'Todos los tributos se calculan sobre la base = CIF + Derechos + Tasa de Estadística. CIF = FOB + Flete + Seguro.' },
    { q: '¿Qué es el crédito fiscal y por qué importa?', a: 'El IVA (21%), el IVA adicional (20%), Ganancias (6%) e IIBB (2.5%) son pagos a cuenta RECUPERABLES si revendés como responsable inscripto. Tu costo REAL neto descuenta eso; solo DI + TE son costo definitivo. Por eso el precio de venta se calcula sobre el costo neto real, no sobre la caja.' },
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