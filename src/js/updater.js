// ============================================
//  Mambo Pedidos - Módulo de Auto-Actualizaciones & GitHub Releases
//  Desarrollado por @geto_dev
// ============================================

const AppUpdater = {
  CURRENT_VERSION: '0.3.3',
  REPO_URL: 'https://github.com/getodevel-source/mambo-pedidos',

  isChecking: false,

  async checkUpdate(userInitiated = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    if (userInitiated) {
      toast('🔄 Buscando actualizaciones en GitHub...', 'info');
    }

    try {
      // 1. Si estamos corriendo dentro de la app nativa de Tauri 2.0
      if (window.__TAURI__ && window.__TAURI__.updater) {
        const update = await window.__TAURI__.updater.check();
        if (update && update.available) {
          const confirmMsg = `🚀 ¡Nueva versión disponible (${update.version})!\n\n¿Querés descargar e instalar la actualización ahora?`;
          if (confirm(confirmMsg)) {
            await this.installUpdate(update);
            return;
          }
        }
      }

      // 2. Comprobación directa vía API de GitHub Releases
      const res = await fetch('https://api.github.com/repos/getodevel-source/mambo-pedidos/releases/latest');
      if (res.ok) {
        const release = await res.json();
        const latestVersion = release.tag_name ? release.tag_name.replace(/^v/, '') : '';

        if (latestVersion && this.isNewerVersion(latestVersion, this.CURRENT_VERSION)) {
          const confirmMsg = `🚀 ¡Nueva versión v${latestVersion} disponible en GitHub!\n\n¿Querés abrir la página de descarga para instalarla?`;
          if (confirm(confirmMsg)) {
            const url = release.html_url || `${this.REPO_URL}/releases/latest`;
            window.open(url, '_blank');
          }
        } else if (userInitiated) {
          toast(`✅ Estás en la última versión (v${this.CURRENT_VERSION})`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Versión v${this.CURRENT_VERSION} al día`, 'success');
      }
    } catch (err) {
      console.error('Error al buscar actualizaciones:', err);
      if (userInitiated) {
        toast(`ℹ️ Versión activa: v${this.CURRENT_VERSION}`, 'info');
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

  async installUpdate(update) {
    try {
      toast('📥 Descargando actualización...', 'info');
      if (typeof showProgress === 'function') showProgress(30);

      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          if (typeof showProgress === 'function') showProgress(50);
        } else if (event.event === 'Finished') {
          if (typeof showProgress === 'function') showProgress(100);
        }
      });

      toast('🎉 Actualización instalada. Reiniciando...', 'success');
      setTimeout(async () => {
        if (window.__TAURI__ && window.__TAURI__.process) {
          await window.__TAURI__.process.relaunch();
        } else {
          location.reload();
        }
      }, 1500);
    } catch (e) {
      console.error('Error instalando actualización:', e);
      toast('❌ Falló la instalación: ' + e.message, 'error');
      if (typeof hideProgress === 'function') hideProgress();
    }
  }
};

window.AppUpdater = AppUpdater;

