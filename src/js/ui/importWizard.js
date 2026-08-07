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
    depositoFiscalUsd: 150, despachanteUsd: 450, simDigitalizacionUsd: 40, fleteInternoUsd: 80,
    recuperaCredito: true,
    ncmOverrides: {}
  },
  CACHE_KEY: 'mamboImportWizardState',

  open() {
    const saved = localStorage.getItem(ImportWizard.CACHE_KEY);
    if (saved) { try { ImportWizard.state = Object.assign(ImportWizard.state, JSON.parse(saved)); } catch (e) {} }
    const modal = document.getElementById('importWizardModal');
    if (modal) modal.style.display = 'flex';
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
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 2 — ¿Ya armaste tu pedido?</div>
      <div style="font-size:16px;font-weight:700;">${ok ? '✅ Sí' : '⚠️ No'} — ${ok ? count + ' productos en el pedido' : 'todavía no'}</div>
      <p style="font-size:13px;color:var(--text-muted);margin-top:10px;">${ok ? 'Bien. El siguiente paso calcula el flete y seguro sobre este pedido.' : 'Seleccioná productos en el catálogo y tocá "Armar pedido". Podés cerrar el asistente para armarlo y volver.'}</p>
      ${ok ? '' : '<button class="btn btn-secondary btn-sm" onclick="ImportWizard.close(); switchView(\'catalogo\')">Ir a armar pedido</button>'}
    </div>`;
  },

  // ---- flete + seguro ----
  _render_flete() {
    const s = ImportWizard.state;
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:12px;">Paso 3 — Transporte y seguro (define tu valor CIF)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
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
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">El flete marítimo LCL ronda USD 80-150/CBM; aéreo USD 4-8/kg; courier USD 30-80/kg. El seguro suele ser 1-2% del FOB.</p>
    </div>`;
  },

  // ---- impuestos + aduana ----
  _render_impuestos() {
    const matrix = (typeof Calculator !== 'undefined' && Calculator.NCM_MATRIX) ? Calculator.NCM_MATRIX : {};
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
        <td style="padding:6px 8px;font-size:12px;">IIBB ${Math.round(r.iibb*1000)/10}%</td>
      </tr>`;
    }).join('');
    return `<div class="card" style="padding:18px;">
      <div class="page-sub" style="color:var(--text-muted);margin-bottom:8px;">Paso 4 — Tributos por NCM (matriz auditada 2026: ARCA, AFIP, Decreto 333/25)</div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Base = CIF + Derechos + Tasa. IVA adicional 20% y anticipos (Ganancias 6%, IIBB 2.5%) son <strong>crédito fiscal recuperable</strong>. Podés ajustar el Derecho por categoría.</p>
      <div class="table-scroll"><table><thead><tr><th>Categoría</th><th>NCM</th><th>Derecho</th><th>Tasa</th><th>IVA</th><th>IVA adic</th><th>Gan</th><th>IIBB</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
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
    </div>`;
  },

  _finish() {
    ImportWizard._save();
    ImportWizard.close();
    if (typeof toast === 'function') toast('Importación calculada. Guardá el proyecto en Historial.', 'success');
  }
};

if (typeof window !== 'undefined') window.ImportWizard = ImportWizard;