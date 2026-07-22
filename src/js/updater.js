const AppUpdater = {
  CURRENT_VERSION: '0.8.0',
  REPO_URL: 'https://github.com/getodevel-source/mambo-pedidos',
  latestReleaseUrl: null,
  latestVersion: null,
  latestNotes: null,
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
        this.latestVersion = latestVersion;
        this.latestNotes = release.body || 'Correcciones y mejoras generales.';
        this.latestReleaseUrl = release.html_url || `${this.REPO_URL}/releases/tag/v${latestVersion}`;

        // Preferir ejecutable de Windows (.exe / .msi)
        const exeAsset = (release.assets || []).find(a => a.name && (a.name.endsWith('.exe') || a.name.endsWith('.msi')));
        if (exeAsset && exeAsset.browser_download_url) {
          this.latestReleaseUrl = exeAsset.browser_download_url;
        }

        this.showSidebarBadge(latestVersion);
        this.showModal(latestVersion, this.latestNotes);

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
    let html = text
      .replace(/^### (.*$)/gim, '<strong style="color: #818cf8; display: block; margin-top: 6px;">$1</strong>')
      .replace(/^\* (.*$)/gim, '• $1')
      .replace(/^- (.*$)/gim, '• $1')
      .replace(/\n/g, '<br>');
    return html;
  },

  showModal(version, notes) {
    const modal = document.getElementById('updateModal');
    const verEl = document.getElementById('updateModalVersion');
    const notesEl = document.getElementById('updateModalNotes');
    const btnEl = document.getElementById('updateModalBtn');
    const linkAnchor = document.getElementById('updateModalLinkAnchor');

    const downloadUrl = this.latestReleaseUrl || `${this.REPO_URL}/releases/tag/v${version}`;

    if (verEl) verEl.textContent = `Versión v${version} disponible (tenés la v${this.CURRENT_VERSION})`;
    if (notesEl) notesEl.innerHTML = this.formatNotes(notes);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = `⚡ Actualización Rápida 1-Click`;
    }
    if (linkAnchor) {
      linkAnchor.textContent = downloadUrl;
      linkAnchor.href = downloadUrl;
    }

    const progressWrap = document.getElementById('updateProgressWrap');
    if (progressWrap) progressWrap.style.display = 'none';

    if (modal) {
      modal.style.display = 'flex';
    }
  },

  closeModal() {
    const modal = document.getElementById('updateModal');
    if (modal) modal.style.display = 'none';
  },

  openInBrowser() {
    const url = this.latestReleaseUrl || `${this.REPO_URL}/releases/latest`;
    this.openExternal(url);
    this.closeModal();
  },

  openExternal(url) {
    if (!url) return;

    // Intento 1: Tauri 2.0 Internals invoke
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
      window.__TAURI_INTERNALS__.invoke('open_external_url', { url }).catch(() => {
        window.location.href = url;
      });
      return;
    }

    // Intento 2: Tauri Core invoke
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      window.__TAURI__.core.invoke('open_external_url', { url }).catch(() => {
        window.location.href = url;
      });
      return;
    }

    // Intento 3: Direct location navigation
    window.location.href = url;
  },

  async startDirectDownload() {
    const url = this.latestReleaseUrl || `${this.REPO_URL}/releases/latest`;
    const progressWrap = document.getElementById('updateProgressWrap');
    const progressText = document.getElementById('updateProgressText');
    const progressBar = document.getElementById('updateProgressBarInner');
    const btn = document.getElementById('updateModalBtn');

    if (progressWrap) progressWrap.style.display = 'block';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Instalando en segundo plano...'; }

    // Intento 1: Tauri 2.0 Native Auto-Updater (Descarga silenciosa in-app y reinicio automático)
    try {
      const updater = window.__TAURI__?.updater || window.__TAURI_PLUGIN_UPDATER__;
      if (updater && typeof updater.check === 'function') {
        const update = await updater.check();
        if (update && update.available) {
          let downloaded = 0;
          let contentLength = 0;
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0;
                if (progressText) progressText.textContent = 'Iniciando descarga nativa...';
                break;
              case 'Progress':
                downloaded += event.data.chunkLength || 0;
                if (contentLength > 0) {
                  const pct = Math.round((downloaded / contentLength) * 100);
                  if (progressBar) progressBar.style.width = `${pct}%`;
                  if (progressText) progressText.textContent = `Actualizando en segundo plano... ${pct}% (${(downloaded / (1024*1024)).toFixed(1)} MB / ${(contentLength / (1024*1024)).toFixed(1)} MB)`;
                } else {
                  if (progressText) progressText.textContent = `Descargando... (${(downloaded / (1024*1024)).toFixed(1)} MB)`;
                }
                break;
              case 'Finished':
                if (progressText) progressText.textContent = '✅ Actualización completada. Reiniciando app...';
                break;
            }
          });
          toast('⚡ Instalación nativa completada. Reiniciando Mambo Pedidos...', 'success');
          if (typeof update.relaunch === 'function') {
            await update.relaunch();
          }
          return;
        }
      }
    } catch (nativeErr) {
      console.warn('Tauri native updater error, falling back to direct stream:', nativeErr);
    }

    // Intento 2: Direct Stream Downloader Fallback
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let receivedBytes = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const pct = Math.round((receivedBytes / totalBytes) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = `Descargando actualización... ${pct}% (${(receivedBytes / (1024*1024)).toFixed(1)} MB / ${(totalBytes / (1024*1024)).toFixed(1)} MB)`;
        } else {
          if (progressText) progressText.textContent = `Descargando actualización... (${(receivedBytes / (1024*1024)).toFixed(1)} MB)`;
        }
      }

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);

      const fileName = `mambo-pedidos_v${this.latestVersion || 'nueva'}.exe`;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = '✅ ¡Descarga completada! Abrí el instalador generado.';
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Abrir / Ejecutar Instalador';
        btn.onclick = () => { this.openExternal(url); };
      }
      toast('✅ Instalador descargado con éxito. Ejecutalo para actualizar.', 'success');
    } catch (e) {
      console.warn('Direct download stream error, falling back to openExternal:', e);
      this.openExternal(url);
      this.closeModal();
    }
  }
};

window.AppUpdater = AppUpdater;









