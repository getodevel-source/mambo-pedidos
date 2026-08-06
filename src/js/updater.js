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
  CURRENT_VERSION: '1.9.2',
  REPO_URL: 'https://github.com/getodevel-source/mambo-pedidos',
  latestVersion: null,
  latestNotes: null,
  isChecking: false,
  _updateHandle: null,

  async syncVersionFromRust() {
    try {
      const ver = await this.withTimeout(this._invoke('get_app_version', {}), 5000, 'Timeout leyendo versión');
      if (ver && typeof ver === 'string' && ver.length >= 3) {
        this.CURRENT_VERSION = ver;
        const badge = document.getElementById('appVersionBadge');
        if (badge) {
          badge.textContent = `v${ver}`;
        }
        return ver;
      }
    } catch { }
    return this.CURRENT_VERSION;
  },

  getCurrentVersion() {
    return this.CURRENT_VERSION || '1.9.1';
  },

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

  withTimeout(promise, timeoutMs, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
    const result = await this.withTimeout(this._invoke('plugin:updater|check', {}), 15000, 'Timeout verificando actualización oficial');
    return result;
  },

  async checkUpdate(userInitiated = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    await this.syncVersionFromRust();

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

      const currentVer = this.getCurrentVersion();

      if (updateInfo?.available && this.isValidVersion(updateInfo.version) && this.isNewerVersion(updateInfo.version, currentVer)) {
        this.latestVersion = updateInfo.version;
        this.latestNotes = updateInfo.body || 'Correcciones y mejoras generales.';
        this._updateHandle = updateInfo;

        this.showSidebarBadge(updateInfo.version);
        this.showModal(updateInfo.version, this.latestNotes);

        if (userInitiated) {
          toast(`🚀 ¡Nueva versión v${updateInfo.version} disponible!`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${currentVer})`, 'success');
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
      await this.syncVersionFromRust();
      const activeVer = this.getCurrentVersion();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(`${this.REPO_URL.replace('github.com', 'api.github.com/repos')}/releases/latest`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);

      const release = await res.json();
      const latestVersion = release.tag_name?.replace(/^v/, '') || '';

      if (this.isValidVersion(latestVersion) && this.isNewerVersion(latestVersion, activeVer)) {
        this.latestVersion = latestVersion;
        this.latestNotes = release.body || 'Correcciones y mejoras generales.';

        this.showSidebarBadge(latestVersion);
        this.showModal(latestVersion, this.latestNotes);

        if (userInitiated) {
          toast(`🚀 ¡Nueva versión v${latestVersion} disponible!`, 'success');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${activeVer})`, 'success');
      }
    } catch (err) {
      console.error('GitHub API fallback error:', err);
      if (userInitiated) {
        toast(`ℹ️ Sin conexión para verificar actualizaciones (v${this.getCurrentVersion()})`, 'info');
      }
    }
  },

  isNewerVersion(latest, current) {
    if (!latest || !current) return false;
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

  isValidVersion(version) {
    return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version);
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
    return text ? String(text) : 'Se publicaron arreglos y optimizaciones.';
  },

  showModal(version, notes) {
    const modal = document.getElementById('updateModal');
    const verEl = document.getElementById('updateModalVersion');
    const notesEl = document.getElementById('updateModalNotes');
    const btnEl = document.getElementById('updateModalBtn');
    const linkAnchor = document.getElementById('updateModalLinkAnchor');
    const directLink = document.getElementById('updateModalDirectLink');

    if (verEl) verEl.textContent = `Versión v${version} disponible (tenés la v${this.CURRENT_VERSION})`;
    if (notesEl) notesEl.textContent = this.formatNotes(notes);
    if (linkAnchor) {
      const releaseUrl = `${this.REPO_URL}/releases/tag/v${version}`;
      linkAnchor.href = releaseUrl;
      linkAnchor.textContent = releaseUrl;
    }
    // El enlace manual a GitHub es el último recurso: oculto por defecto y
    // se muestra únicamente si falla la instalación automática 1-Click.
    if (directLink) directLink.style.display = 'none';
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

  openInBrowser(url) {
    const targetUrl = url || (this.latestVersion ? `${this.REPO_URL}/releases/tag/v${this.latestVersion}` : `${this.REPO_URL}/releases/latest`);
    this.openExternal(targetUrl);
  },

  /**
   * Punto de entrada del botón "Instalar Actualización".
   * Usa el plugin nativo de Tauri v2: descarga el artefacto firmado,
   * verifica la firma criptográfica minisign, reemplaza in-place y relanza.
   * Requiere el resource `rid` devuelto por el check + un Channel de progreso.
   */
  async startDirectDownload() {
    const progressWrap = document.getElementById('updateProgressWrap');
    const progressText = document.getElementById('updateProgressText');
    const progressBarInner = document.getElementById('updateProgressBarInner');
    const btn = document.getElementById('updateModalBtn');
    const directLink = document.getElementById('updateModalDirectLink');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBarInner) progressBarInner.style.width = '5%';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Descargando actualización...'; }
    if (progressText) progressText.textContent = '🔐 Verificando firma y descargando...';
    if (directLink) directLink.style.display = 'none';

    try {
      // Camino principal: plugin oficial de Tauri v2 (con verificación de firma minisign)
      const update = this._updateHandle;
      if (!update || typeof update.rid !== 'number') {
        throw new Error('No hay una actualización verificada para instalar. Ejecutá primero la búsqueda de actualizaciones.');
      }

      await new Promise((resolve, reject) => {
        let channel = null;
        let timeout = null;

        const cleanup = () => {
          if (channel) { try { channel.onmessage = null; } catch { } channel = null; }
          if (timeout) { clearTimeout(timeout); timeout = null; }
        };

        // Channel de progreso del plugin v2: recibe { event, data } con
        // Started / Progress (chunkLength) / Finished.
        try {
          if (window.__TAURI__?.core?.Channel) {
            channel = new window.__TAURI__.core.Channel();
            channel.onmessage = (e) => {
              const ev = e && e.event;
              if (ev === 'Started') {
                if (progressText) progressText.textContent = '⬇️ Descargando actualización firmada...';
                if (progressBarInner) progressBarInner.style.width = '15%';
              } else if (ev === 'Progress') {
                const chunk = (e && e.data && e.data.chunkLength) || 0;
                const pct = Math.min(90, Math.max(15, Math.round(chunk / 1024)));
                if (progressBarInner) progressBarInner.style.width = pct + '%';
                if (progressText) progressText.textContent = '⬇️ Descargando... ' + pct + '%';
              } else if (ev === 'Finished') {
                if (progressBarInner) progressBarInner.style.width = '95%';
                if (progressText) progressText.textContent = '🔧 Instalando actualización...';
              }
            };
          }
        } catch {
          channel = null;
        }

        // Timeout de seguridad: si en 5 min no hay respuesta, abortar
        timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Timeout de descarga (5 min)'));
        }, 300000);

        this._invoke('plugin:updater|download_and_install', {
          rid: update.rid,
          onEvent: channel,
        })
          .then(() => { clearTimeout(timeout); timeout = null; resolve(); })
          .catch(err => { clearTimeout(timeout); cleanup(); reject(err); });
      });

      // Éxito: el plugin descargó, verificó la firma e instaló
      if (progressText) progressText.textContent = '✅ Actualización instalada. Reiniciando...';
      if (progressBarInner) progressBarInner.style.width = '100%';
      toast('✅ Actualización instalada. La app se reiniciará.', 'success');

      // Relanzar la app
      setTimeout(() => {
        this._invoke('plugin:process|restart', {}).catch(() => {
          window.location.reload();
        });
      }, 1500);

      return;
    } catch (pluginErr) {
      const msg = (pluginErr && pluginErr.message) ? pluginErr.message : String(pluginErr);
      console.error('Updater oficial firmado falló:', msg);

      if (progressText) progressText.textContent = '❌ ' + msg;
      if (progressBarInner) progressBarInner.style.width = '100%';
      if (btn) { btn.disabled = false; btn.textContent = 'Reintentar actualización'; }
      // Último recurso manual: mostrar el enlace al release en GitHub
      if (directLink) directLink.style.display = 'block';
      toast('❌ No se pudo instalar la actualización automática.', 'error');
    }
  },

  openExternal(url) {
    if (!url || !this.isAllowedExternalUrl(url)) return;
    this._invoke('open_external_url', { url }).catch(() => { window.open(url, '_blank'); });
  },

  isAllowedExternalUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) &&
        ['github.com', 'www.github.com', 'instagram.com', 'www.instagram.com'].includes(parsed.hostname);
    } catch {
      return false;
    }
  },

  /**
   * Validate updater configuration at startup.
   * Checks endpoint reachability format and rejects placeholder public keys.
   * @returns {{ valid: boolean, warnings: string[] }}
   */
  validateConfig() {
    const warnings = [];
    const PLACEHOLDER_PATTERNS = ['PLACEHOLDER', 'YOUR_', 'REPLACE_ME', 'INSERT_', 'PASTE_'];

    // Check pubkey from Tauri config (embedded at build time)
    try {
      const conf = window.__TAURI_INTERNALS__?.config?.plugins?.updater
        || window.__TAURI__?.config?.plugins?.updater;
      if (conf) {
        const pubkey = conf.pubkey || '';
        if (!pubkey || pubkey.length < 20) {
          warnings.push('Updater public key is missing or too short');
        } else {
          const upper = pubkey.toUpperCase();
          for (const p of PLACEHOLDER_PATTERNS) {
            if (upper.includes(p)) {
              warnings.push(`Updater public key contains placeholder pattern "${p}"`);
              break;
            }
          }
        }
        const endpoints = conf.endpoints || [];
        if (!endpoints.length) {
          warnings.push('No updater endpoints configured');
        } else {
          for (const ep of endpoints) {
            if (!ep.startsWith('https://')) {
              warnings.push(`Updater endpoint is not HTTPS: ${ep}`);
            }
          }
        }
      }
    } catch (e) {
      warnings.push(`Could not read updater config: ${e.message}`);
    }

    return { valid: warnings.length === 0, warnings };
  },

  /**
   * Detect placeholder signatures in a release manifest (latest.json).
   * @param {Object} manifest - Parsed latest.json
   * @returns {{ clean: boolean, placeholders: string[] }}
   */
  detectPlaceholderSignatures(manifest) {
    const placeholders = [];
    if (!manifest || !manifest.platforms) return { clean: true, placeholders };
    for (const [platform, info] of Object.entries(manifest.platforms)) {
      const sig = (info.signature || '').toUpperCase();
      if (!sig || sig.includes('PLACEHOLDER') || sig.includes('YOUR_') || sig.length < 20) {
        placeholders.push(platform);
      }
    }
    return { clean: placeholders.length === 0, placeholders };
  }
};

window.AppUpdater = AppUpdater;
if (typeof module !== 'undefined') module.exports = AppUpdater;


