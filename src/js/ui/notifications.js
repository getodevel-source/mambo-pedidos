// ============================================
// Mambo Pedidos - UI Notifications Module
// Toast, progress overlay, drop overlay
// ============================================

const UINotifications = {
  toast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 3500);
  },

  showProgress(pct, statusText = 'Procesando archivos...', subText = '') {
    const p = document.getElementById('progress');
    const b = document.getElementById('progressBar');
    if (p && b) {
      p.style.display = 'block';
      b.style.width = `${pct}%`;
    }

    const overlay = document.getElementById('loadingOverlay');
    const progressBar = document.getElementById('progressBarInner');
    const progressPct = document.getElementById('progressPctText');
    const progressTitle = document.getElementById('progressTitleText');
    const progressSub = document.getElementById('progressSubText');

    const cleanPct = Math.min(100, Math.max(0, Math.round(pct)));

    if (overlay) overlay.style.display = 'flex';
    if (progressBar) progressBar.style.width = `${cleanPct}%`;
    if (progressPct) progressPct.textContent = `${cleanPct}%`;
    if (progressTitle && statusText) progressTitle.textContent = statusText;
    if (progressSub && subText) progressSub.textContent = subText;
  },

  hideProgress() {
    const p = document.getElementById('progress');
    if (p) p.style.display = 'none';

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      this.showProgress(100, '¡Carga completada al 100%!', 'Abriendo vista previa...');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 450);
    }
  },

  showDropOverlay() {
    if (document.getElementById('dropOverlay')) return;
    const d = document.createElement('div');
    d.id = 'dropOverlay';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(255,87,34,0.15);backdrop-filter:blur(8px);z-index:999998;display:flex;align-items:center;justify-content:center;pointer-events:none;';
    d.innerHTML = '<div style="text-align:center;color:#fff;font-size:24px;font-weight:800;text-shadow:0 2px 12px rgba(0,0,0,0.5);">📂 Soltá los archivos acá</div>';
    document.body.appendChild(d);
  },

  hideDropOverlay() {
    const e = document.getElementById('dropOverlay');
    if (e) e.remove();
  }
};

// Browser-global bridge: keep existing function names working
if (typeof window !== 'undefined') {
  window.UINotifications = UINotifications;
  window.toast = (msg, type) => UINotifications.toast(msg, type);
  window.showProgress = (pct, s, sub) => UINotifications.showProgress(pct, s, sub);
  window.hideProgress = () => UINotifications.hideProgress();
  window.showDropOverlay = () => UINotifications.showDropOverlay();
  window.hideDropOverlay = () => UINotifications.hideDropOverlay();
}
if (typeof module !== 'undefined') module.exports = UINotifications;
