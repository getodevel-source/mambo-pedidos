// ============================================
//  Mambo Pedidos - Módulo de Auto-Actualizaciones (Windows & Linux)
// ============================================

const AppUpdater = {
  isChecking: false,

  async checkUpdate(userInitiated = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    if (userInitiated) {
      toast('🔄 Buscando actualizaciones...', 'info');
    }

    try {
      // Verificar si la API de Tauri 2.0 Updater está disponible
      if (window.__TAURI__ && window.__TAURI__.updater) {
        const update = await window.__TAURI__.updater.check();
        if (update && update.available) {
          const confirmMsg = `🚀 ¡Nueva versión disponible (${update.version})!\n\n¿Querés descargar e instalar la actualización ahora?`;
          if (confirm(confirmMsg)) {
            await this.installUpdate(update);
          }
        } else if (userInitiated) {
          toast('✅ Tenés la última versión instalada (v0.1.0)', 'success');
        }
      } else {
        // En entorno web o dev sin cliente Tauri Updater empaquetado
        if (userInitiated) {
          toast('ℹ️ Estás en la versión v0.1.0 (Modo Dev / Web)', 'info');
        }
      }
    } catch (err) {
      console.error('Error al buscar actualizaciones:', err);
      if (userInitiated) {
        toast('❌ Error al buscar actualizaciones: ' + (err.message || 'Sin conexión'), 'error');
      }
    } finally {
      this.isChecking = false;
    }
  },

  async installUpdate(update) {
    try {
      toast('📥 Descargando e instalando actualización...', 'info');
      showProgress(10);

      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          showProgress(20);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength || 0;
          showProgress(50);
        } else if (event.event === 'Finished') {
          showProgress(100);
        }
      });

      toast('🎉 Actualización completada. Reiniciando...', 'success');
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
      hideProgress();
    }
  }
};

window.AppUpdater = AppUpdater;
