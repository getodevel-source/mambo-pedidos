// ============================================
// Mambo Pedidos - Custom Selects (UI)
// ============================================
// Combobox con búsqueda para los selectores que "admiten escritura"
// (marca, categoría) — reemplaza el dropdown nativo por uno hecho a medida
// de la UI (dark theme, búsqueda, teclado). El select NATIVO queda oculto
// como FUENTE DE VALOR: toda la lógica existente (reads a .value, onchange,
// populateCatalogFilters) sigue funcionando sin cambios.
// Los demás selects de la app se estilizan por CSS (tier 1).
// ============================================

(function (global) {
  'use strict';

  const CustomSelects = {
    _instances: new Map(), // selectId -> { select, trigger, panel, search, list, options[] }

    init() {
      document.querySelectorAll('select[data-combobox]').forEach((sel) => {
        if (this._instances.has(sel.id)) return;
        this._build(sel);
      });
    },

    _chevron() {
      return '<svg class="mb-combo-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    },

    _build(sel) {
      const id = sel.id || 'mbcombo-' + Math.random().toString(36).slice(2, 8);

      // wrapper: reemplaza al select en el flujo visual
      const wrap = document.createElement('div');
      wrap.className = 'mb-combo';
      wrap.dataset.for = id;
      sel.classList.add('mb-combo-native'); // oculto visualmente, fuente de valor
      sel.setAttribute('aria-hidden', 'true');

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'mb-combo-trigger';
      trigger.innerHTML = '<span class="mb-combo-label"></span>' + this._chevron();

      const panel = document.createElement('div');
      panel.className = 'mb-combo-panel';
      panel.style.display = 'none';
      panel.innerHTML =
        '<div class="mb-combo-search"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg>' +
        '<input type="text" class="mb-combo-search-input" placeholder="Buscar..." autocomplete="off"></div>' +
        '<ul class="mb-combo-list" role="listbox"></ul>';

      const inst = { select: sel, trigger, panel, search: panel.querySelector('.mb-combo-search-input'), list: panel.querySelector('.mb-combo-list'), options: [] };

      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      wrap.appendChild(trigger);
      wrap.appendChild(panel);
      this._instances.set(id, inst);
      if (sel.id) this._instances.set(sel.id, inst);

      const refreshOptions = () => this._syncOptions(inst);
      refreshOptions();
      // las opciones se reconstruyen en runtime (populateCatalogFilters):
      new MutationObserver(refreshOptions).observe(sel, { childList: true, subtree: true });

      this._wire(inst);
    },

    _syncOptions(inst) {
      const sel = inst.select;
      const options = Array.from(sel.options || []).map((o) => ({
        value: o.value,
        text: o.textContent || o.value,
      }));
      inst.options = options;
      const selText = sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]
        ? sel.options[sel.selectedIndex].textContent
        : '';
      inst.trigger.querySelector('.mb-combo-label').textContent = selText || '';
      if (!inst.panel.dataset.open) this._renderList(inst, '');
    },

    _renderList(inst, query) {
      const q = (query || '').toLowerCase().trim();
      const frag = document.createDocumentFragment();
      let shown = 0;
      for (const opt of inst.options) {
        if (q && !String(opt.text).toLowerCase().includes(q)) continue;
        const li = document.createElement('li');
        li.className = 'mb-combo-option';
        li.setAttribute('role', 'option');
        li.textContent = opt.text;
        li.dataset.value = opt.value;
        if (inst.select.value === opt.value) li.classList.add('selected');
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // no robar foco del search
          this._pick(inst, opt);
        });
        frag.appendChild(li);
        shown++;
      }
      inst.list.innerHTML = '';
      if (!shown) {
        const li = document.createElement('li');
        li.className = 'mb-combo-option mb-combo-empty';
        li.textContent = 'Sin resultados';
        inst.list.appendChild(li);
      } else {
        inst.list.appendChild(frag);
      }
    },

    _pick(inst, opt) {
      const sel = inst.select;
      // sincronizar el valor SIN romper el contrato existente (onchange etc.)
      if (sel.value !== opt.value) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      inst.trigger.querySelector('.mb-combo-label').textContent = opt.text;
      inst.panel.dataset.preventClose = '1';
      this.close(inst);
      this._renderList(inst, '');
    },

    _wire(inst) {
      inst.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inst.panel.dataset.open) this.close(inst);
        else this.open(inst);
      });

      inst.search.addEventListener('input', () => {
        this._renderList(inst, inst.search.value);
      });

      inst.search.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this._move(inst, 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this._move(inst, -1); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          const active = inst.list.querySelector('.mb-combo-option:not(.mb-combo-empty)');
          if (active) this._pick(inst, inst.options.find((o) => o.value === active.dataset.value) || { value: active.dataset.value, text: active.textContent });
        } else if (e.key === 'Escape') { this.close(inst); }
      });

      inst.list.addEventListener('mousemove', (e) => {
        const li = e.target.closest('.mb-combo-option');
        inst.list.querySelectorAll('.mb-combo-option').forEach((o) => o.classList.remove('active'));
        if (li) li.classList.add('active');
      });

      // cerrar al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (inst.panel.dataset.open && !inst.wrapEl?.contains(e.target)) this.close(inst);
      });
    },

    _move(inst, dir) {
      const items = Array.from(inst.list.querySelectorAll('.mb-combo-option:not(.mb-combo-empty)'));
      if (!items.length) return;
      let idx = items.findIndex((o) => o.classList.contains('active'));
      idx = idx === -1 ? 0 : Math.min(items.length - 1, Math.max(0, idx + dir));
      items.forEach((o, i) => o.classList.toggle('active', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    },

    open(inst) {
      const selText = inst.select.selectedIndex >= 0 && inst.select.options[inst.select.selectedIndex]
        ? inst.select.options[inst.select.selectedIndex].textContent
        : '';
      inst.trigger.querySelector('.mb-combo-label').textContent = selText || '';
      inst.panel.dataset.open = '1';
      inst.panel.style.display = 'block';
      inst.search.value = '';
      this._renderList(inst, '');
      inst.search.focus();
    },

    close(inst) {
      delete inst.panel.dataset.open;
      inst.panel.style.display = 'none';
      inst.panel.dataset.preventClose = '0';
    },

    // Para refresco externo (si algo pisa el valor por JS sin evento change)
    refresh(id) {
      const inst = this._instances.get(id);
      if (!inst) return;
      this._syncOptions(inst);
      const sel = inst.select;
      const selText = sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]
        ? sel.options[sel.selectedIndex].textContent
        : '';
      inst.trigger.querySelector('.mb-combo-label').textContent = selText || '';
      this._renderList(inst, inst.search ? inst.search.value : '');
    },

    closeAll() {
      for (const inst of this._instances.values()) this.close(inst);
    },
  };

  // el wrapper de cada instancia para el click-outside: guardarlo al construir
  const origBuild = CustomSelects._build;
  CustomSelects._build = function (sel) {
    origBuild.call(this, sel);
    const id = sel.id;
    const inst = this._instances.get(id) || this._instances.get(sel.dataset.for || '');
    if (inst) inst.wrapEl = sel.parentNode;
  };

  global.CustomSelects = CustomSelects;
  if (typeof module !== 'undefined') module.exports = CustomSelects;

  const boot = () => CustomSelects.init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);