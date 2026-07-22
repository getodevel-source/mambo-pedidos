// ============================================
//  Mambo Pedidos - Módulo de Auto-Actualizaciones & GitHub Releases
//  Desarrollado por @geto_dev
// ============================================

const AppUpdater = {
  CURRENT_VERSION: '0.4.0',
  REPO_URL: 'https://github.com/getodevel-source/mambo-pedidos',
  latestReleaseUrl: null,
  isChecking: false,

  async checkUpdate(userInitiated = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    if (userInitiated) {
      toast('🔄 Buscando actualizaciones...', 'info');
    }

    try {
      const res = await fetch('https://api.github.com/repos/getodevel-source/mambo-pedidos/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const release = await res.json();
      const latestVersion = release.tag_name ? release.tag_name.replace(/^v/, '') : '';

      if (latestVersion && this.isNewerVersion(latestVersion, this.CURRENT_VERSION)) {
        this.latestReleaseUrl = release.html_url || `${this.REPO_URL}/releases/tag/v${latestVersion}`;

        // Preferir el ejecutable .exe de Windows si está en los assets
        const exeAsset = (release.assets || []).find(a => a.name && (a.name.endsWith('.exe') || a.name.endsWith('.msi')));
        if (exeAsset && exeAsset.browser_download_url) {
          this.latestReleaseUrl = exeAsset.browser_download_url;
        }

        this.showModal(latestVersion, release.body || 'Correcciones y mejoras generales.');
        if (userInitiated) {
          toast(`🚀 ¡Nueva versión v${latestVersion} disponible!`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${this.CURRENT_VERSION})`, 'success');
      }
    } catch (err) {
      console.error('Error al buscar actualizaciones:', err);
      if (userInitiated) {
        toast(`ℹ️ No se pudo conectar a GitHub (Versión v${this.CURRENT_VERSION})`, 'info');
      }
    } finally {
      this.isChecking = false;
    }
  },

  isNewerVersion(latest, current) {
    const lParts = latest.split('.').map(n => parseInt(n, 10) || 0);
    const cParts = current.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  },

  showModal(version, notes) {
    const modal = document.getElementById('updateModal');
    const verEl = document.getElementById('updateModalVersion');
    const notesEl = document.getElementById('updateModalNotes');
    const btnEl = document.getElementById('updateModalBtn');

    if (verEl) verEl.textContent = `Versión v${version} disponible (tenés la v${this.CURRENT_VERSION})`;
    if (notesEl) notesEl.textContent = notes || 'Se publicaron arreglos y optimizaciones.';
    if (btnEl) btnEl.textContent = `📥 Descargar v${version}`;

    if (modal) {
      modal.style.display = 'flex';
    }
  },

  closeModal() {
    const modal = document.getElementById('updateModal');
    if (modal) modal.style.display = 'none';
  },

  openExternal(url) {
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      window.__TAURI__.core.invoke('open_external_url', { url }).catch(() => {
        window.open(url, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
  },

  downloadLatest() {
    const url = this.latestReleaseUrl || `${this.REPO_URL}/releases/latest`;
    this.openExternal(url);
    this.closeModal();
  }
};

window.AppUpdater = AppUpdater;


