/**
 * AppUpdater — Tauri 2.0 Native Plugin-Updater
 *
 * Usa el plugin oficial @tauri-apps/plugin-updater que hace delta updates:
 * descarga el artefacto firmado (.nsis.zip.sig), verifica la firma criptográfica,
 * reemplaza el binario in-place y relanza la app. Sin desinstalar, sin navegador.
 *
 * Flujo:
 *   1. check()         → llama al endpoint latest.json en GitHub Releases
 *   2. downloadAndInstall() → descarga el .zip firmado, verifica .sig, parchea in-place
 *   3. relaunch()      → cierra y vuelve a abrir la app actualizada
 */

const AppUpdater = {
  CURRENT_VERSION: '1.2.4',
  REPO_URL: 'https://github.com/getodevel-source/mambo-pedidos',
  latestVersion: null,
  latestNotes: null,
  isChecking: false,
  _updateHandle: null, // Guardamos el objeto update de Tauri para reusar en install

  /**
   * Resuelve la función invoke de Tauri independientemente de la versión del webview bundle.
   */
  _invoke(cmd, args) {
    if (window.__TAURI_INTERNALS__?.invoke) {
      return window.__TAURI_INTERNALS__.invoke(cmd, args);
    }
    if (window.__TAURI__?.core?.invoke) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    return Promise.reject(new Error('Tauri IPC no disponible'));
  },

  /**
   * Resuelve el objeto updater del plugin oficial de Tauri 2.0.
   * El plugin expone su API a través de window.__TAURI__.updater o
   * directamente importable como @tauri-apps/plugin-updater.
   * En runtime del webview, usamos IPC directo al comando Rust.
   */
  async _tauriCheck() {
    // La API oficial del plugin-updater en Tauri 2.0 se invoca via IPC commands:
    // "plugin:updater|check" → devuelve { available, currentVersion, version, date, body }
    const result = await this._invoke('plugin:updater|check', {});
    return result;
  },

  async _tauriDownloadAndInstall(onProgress) {
    // El plugin descarga el artefacto firmado y lo instala in-place
    // "plugin:updater|download_and_install" con callback de progreso via evento
    return new Promise((resolve, reject) => {
      // Registrar listener de eventos de progreso
      const unlisten = window.__TAURI__?.event?.listen
        ? window.__TAURI__.event.listen('tauri://update-status', (event) => {
            if (onProgress) onProgress(event.payload);
            if (event.payload?.status === 'DONE') {
              if (unlisten) unlisten.then?.(fn => fn?.());
              resolve();
            } else if (event.payload?.status === 'ERROR') {
              if (unlisten) unlisten.then?.(fn => fn?.());
              reject(new Error(event.payload?.error || 'Error de actualización'));
            }
          })
        : Promise.resolve(null);

      this._invoke('plugin:updater|download_and_install', {}).catch(reject);
    });
  },

  async checkUpdate(userInitiated = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    if (userInitiated) {
      toast('🔄 Buscando actualizaciones...', 'info');
    }

    try {
      // Intentar via plugin nativo de Tauri primero
      const updateInfo = await this._tauriCheck();

      if (updateInfo?.currentVersion) {
        this.CURRENT_VERSION = updateInfo.currentVersion;
        const badge = document.getElementById('appVersionBadge');
        if (badge) badge.textContent = `v${updateInfo.currentVersion}`;
      }

      if (updateInfo?.available && this.isNewerVersion(updateInfo.version, this.CURRENT_VERSION)) {
        this.latestVersion = updateInfo.version;
        this.latestNotes = updateInfo.body || 'Correcciones y mejoras generales.';
        this._updateHandle = updateInfo;

        this.showSidebarBadge(updateInfo.version);
        this.showModal(updateInfo.version, this.latestNotes);

        if (userInitiated) {
          toast(`🚀 ¡Nueva versión v${updateInfo.version} disponible!`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${this.CURRENT_VERSION})`, 'success');
      }
    } catch (tauriErr) {
      // Fallback: GitHub API para mostrar modal informativo (sin descarga automática)
      console.warn('Tauri plugin-updater check failed, using GitHub API fallback:', tauriErr.message || tauriErr);
      await this._checkViaGitHubApi(userInitiated);
    } finally {
      this.isChecking = false;
    }
  },

  async _checkViaGitHubApi(userInitiated) {
    try {
      const res = await fetch('https://api.github.com/repos/getodevel-source/mambo-pedidos/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);

      const release = await res.json();
      const latestVersion = release.tag_name?.replace(/^v/, '') || '';

      if (latestVersion && this.isNewerVersion(latestVersion, this.CURRENT_VERSION)) {
        this.latestVersion = latestVersion;
        this.latestNotes = release.body || 'Correcciones y mejoras generales.';

        this.showSidebarBadge(latestVersion);
        this.showModal(latestVersion, this.latestNotes);

        if (userInitiated) {
          toast(`🚀 ¡Nueva versión v${latestVersion} disponible!`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${this.CURRENT_VERSION})`, 'success');
      }
    } catch (err) {
      console.error('GitHub API fallback error:', err);
      if (userInitiated) {
        toast(`ℹ️ Sin conexión para verificar actualizaciones (v${this.CURRENT_VERSION})`, 'info');
      }
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

  showSidebarBadge(version) {
    const badge = document.getElementById('updateSidebarBadge');
    const verSpan = document.getElementById('updateSidebarVersion');
    if (badge && verSpan) {
      verSpan.textContent = version;
      badge.style.display = 'block';
    }
  },

  showCurrentModal() {
    if (this.latestVersion) {
      this.showModal(this.latestVersion, this.latestNotes);
    } else {
      this.checkUpdate(true);
    }
  },

  formatNotes(text) {
    if (!text) return 'Se publicaron arreglos y optimizaciones.';
    return text
      .replace(/^### (.*$)/gim, '<strong style="color: #818cf8; display: block; margin-top: 6px;">$1</strong>')
      .replace(/^\* (.*$)/gim, '• $1')
      .replace(/^- (.*$)/gim, '• $1')
      .replace(/\n/g, '<br>');
  },

  showModal(version, notes) {
    const modal = document.getElementById('updateModal');
    const verEl = document.getElementById('updateModalVersion');
    const notesEl = document.getElementById('updateModalNotes');
    const btnEl = document.getElementById('updateModalBtn');

    if (verEl) verEl.textContent = `Versión v${version} disponible (tenés la v${this.CURRENT_VERSION})`;
    if (notesEl) notesEl.innerHTML = this.formatNotes(notes);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = '⚡ Instalar Actualización';
    }

    const progressWrap = document.getElementById('updateProgressWrap');
    if (progressWrap) progressWrap.style.display = 'none';

    if (modal) modal.style.display = 'flex';
  },

  closeModal() {
    const modal = document.getElementById('updateModal');
    if (modal) modal.style.display = 'none';
  },

  /**
   * Punto de entrada del botón "Instalar Actualización".
   * Usa el plugin nativo de Tauri 2.0: descarga el .nsis.zip.sig,
   * verifica la firma criptográfica, reemplaza el binario in-place y relanza.
   * SIN desinstalar. SIN navegador. SIN full installer.
   */
  async startDirectDownload() {
    const progressWrap = document.getElementById('updateProgressWrap');
    const progressText = document.getElementById('updateProgressText');
    const progressBar = document.getElementById('updateProgressBarInner');
    const btn = document.getElementById('updateModalBtn');

    if (progressWrap) progressWrap.style.display = 'block';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Instalando actualización...'; }

    // Estrategia 1: Plugin nativo Tauri 2.0 — delta update real (in-place, firmado)
    try {
      if (progressText) progressText.textContent = '🔍 Verificando actualización firmada...';

      // Re-check para obtener el handle si no lo tenemos
      let updateHandle = this._updateHandle;
      if (!updateHandle) {
        updateHandle = await this._tauriCheck();
      }

      if (updateHandle?.available) {
        let downloaded = 0;
        let contentLength = 0;

        await updateHandle.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              if (progressText) progressText.textContent = '⬇️ Descargando actualización firmada...';
              break;
            case 'Progress':
              downloaded += event.data.chunkLength || 0;
              if (contentLength > 0) {
                const pct = Math.round((downloaded / contentLength) * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressText) progressText.textContent = `⬇️ Descargando... ${pct}% (${(downloaded / (1024 * 1024)).toFixed(1)} MB de ${(contentLength / (1024 * 1024)).toFixed(1)} MB)`;
              } else {
                if (progressText) progressText.textContent = `⬇️ Descargando... (${(downloaded / (1024 * 1024)).toFixed(1)} MB)`;
              }
              break;
            case 'Finished':
              if (progressBar) progressBar.style.width = '100%';
              if (progressText) progressText.textContent = '✅ Actualización aplicada. Reiniciando Mambo Pedidos...';
              break;
          }
        });

        toast('⚡ Mambo Pedidos actualizado. Reiniciando...', 'success');

        // Relaunch — app se cierra y reabre con la nueva versión
        await this._invoke('plugin:process|relaunch', {}).catch(() => {
          // fallback si el plugin process no está disponible
          window.__TAURI__?.process?.relaunch?.();
        });
        return;
      }
    } catch (nativeErr) {
      console.warn('Tauri native in-place updater error:', nativeErr?.message || nativeErr);
    }

    // Estrategia 2: Rust IPC — descarga el .exe e instala en silencio
    // (fallback para versiones antiguas donde createUpdaterArtifacts aún no generó latest.json)
    try {
      const release = await fetch('https://api.github.com/repos/getodevel-source/mambo-pedidos/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store'
      }).then(r => r.json());

      const exeAsset = (release.assets || []).find(a => a.name?.endsWith('.exe') || a.name?.endsWith('.msi'));
      if (exeAsset?.browser_download_url) {
        if (progressText) progressText.textContent = '⏳ Descargando instalador nativo (sin CORS)...';

        await this._invoke('download_and_install_update', { url: exeAsset.browser_download_url });
        return;
      }
    } catch (ipcErr) {
      console.warn('Rust IPC fallback error:', ipcErr?.message || ipcErr);
    }

    // Estrategia 3: Abrir la página de release en el navegador (último recurso)
    if (progressText) progressText.textContent = '⚠️ Abriendo descarga en navegador...';
    if (btn) { btn.disabled = false; btn.textContent = '🌐 Abrir descarga manual'; }
    toast('ℹ️ Abriendo página de descarga en el navegador.', 'info');
    this._invoke('open_external_url', { url: `${this.REPO_URL}/releases/latest` });
    this.closeModal();
  },

  openExternal(url) {
    if (!url) return;
    this._invoke('open_external_url', { url }).catch(() => { window.open(url, '_blank'); });
  }
};

window.AppUpdater = AppUpdater;

