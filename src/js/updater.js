/**
 * AppUpdater — Tauri 2.0 Native Plugin-Updater
 *
 * Usa el plugin oficial @tauri-apps/plugin-updater (descarga completa firmada):
 * descarga el artefacto firmado (.nsis.zip.sig), verifica la firma criptográfica,
 * reemplaza el binario in-place y relanza la app. Sin desinstalar, sin navegador.
 *
 * Flujo:
 *   1. check()         → llama al endpoint latest.json en GitHub Releases
 *   2. downloadAndInstall() → descarga el .zip firmado, verifica .sig, parchea in-place
 *   3. relaunch()      → cierra y vuelve a abrir la app actualizada
 */

const AppUpdater = {
  CURRENT_VERSION: '2.2.7',
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
    return this.CURRENT_VERSION || '2.2.7';
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

      // El plugin v2 devuelve { rid, currentVersion, version, date, body, rawJson }
      // SIN campo `available`. Antes se guardaba con `updateInfo?.available`, que
      // es undefined → el if nunca entraba y la app decía "estás al día" aunque
      // el plugin sí hubiera encontrado una versión nueva. La disponibilidad se
      // infiere de que exista un `version` más nuevo (isNewerVersion ya lo valida).
      if (updateInfo?.version && this.isValidVersion(updateInfo.version) && this.isNewerVersion(updateInfo.version, currentVer)) {
        this.latestVersion = updateInfo.version;
        this.latestNotes = updateInfo.body || 'Correcciones y mejoras generales.';
        this._updateHandle = updateInfo;

        // IT37: el auto-check del ARRANQUE (userInitiated=false) NO abre el modal:
        // un backdrop de modal abierto solo cubre la app y mata todos los clics
        // (reporte de usuario: "ningún botón funciona"). Solo badge + toast sutil.
        this.showSidebarBadge(updateInfo.version);
        if (userInitiated) {
          this.showModal(updateInfo.version, this.latestNotes);
          toast(`🚀 ¡Nueva versión v${updateInfo.version} disponible!`, 'success');
        } else {
          toast(`📦 Nueva versión v${updateInfo.version} disponible — tocá "Buscar actualización" para verla.`, 'info');
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
        // IT36: usar el manifiesto latest.json (URL directa de descarga, sin
        // rate-limit de api.github.com) — el mismo endpoint que usa el plugin.
        res = await fetch(`${this.REPO_URL}/releases/latest/download/latest.json`, {
          cache: 'no-store',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`latest.json HTTP ${res.status}`);

      const manifest = await res.json();
      const latestVersion = String(manifest.version || '').replace(/^v/, '');

      if (this.isValidVersion(latestVersion) && this.isNewerVersion(latestVersion, activeVer)) {
        this.latestVersion = latestVersion;
        this.latestNotes = manifest.notes || 'Correcciones y mejoras generales.';
        this._fallbackManifest = manifest;

        this.showSidebarBadge(latestVersion);
        // IT37: el modal solo se abre en check manual (mismo criterio que el plugin).
        if (userInitiated) {
          this.showModal(latestVersion, this.latestNotes);
          toast(`🚀 ¡Nueva versión v${latestVersion} disponible!`, 'success');
        } else {
          toast(`📦 Nueva versión v${latestVersion} disponible — tocá "Buscar actualización" para verla.`, 'info');
        }
      } else if (userInitiated) {
        toast(`✅ Estás en la versión más reciente (v${activeVer})`, 'success');
      }
    } catch (err) {
      console.error('latest.json fallback error:', err);
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
    // El enlace manual a GitHub es el último recurso: oculto por defecto y se
    // muestra solo si la actualización vino por el fallback (sin update del
    // plugin verificable). IT37: no exigir rid — el plugin v2 trae el handle
    // sin ese campo; startDirectDownload ya resuelve el caso sin plugin.
    const hasPluginUpdate = !!this._updateHandle;
    if (directLink) directLink.style.display = hasPluginUpdate ? 'none' : 'block';
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = hasPluginUpdate ? '⚡ Instalar Actualización' : '⬇️ Descargar manualmente (GitHub)';
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
    // IT36: si la actualización vino por el fallback (sin rid verificado del
    // plugin), no hay instalación 1-Click — abrimos la release en el navegador.
    if (!this._updateHandle || typeof this._updateHandle.rid !== 'number') {
      toast('⬇️ Abriendo la descarga manual en el navegador...', 'info');
      this.openInBrowser();
      return;
    }
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
        let downloadedBytes = 0;

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
                if (progressBarInner) progressBarInner.style.width = '10%';
              } else if (ev === 'Progress') {
                const chunk = (e && e.data && e.data.chunkLength) || 0;
                downloadedBytes += chunk;
                // El plugin no da el total → barra indeterminada honesta: crece
                // logarítmicamente hacia 90% y se muestra el MB acumulado real.
                const mb = (downloadedBytes / 1048576).toFixed(1);
                const pct = Math.min(90, 10 + Math.log10(downloadedBytes + 1) * 8);
                if (progressBarInner) progressBarInner.style.width = pct + '%';
                if (progressText) progressText.textContent = `⬇️ Descargando... ${mb} MB`;
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


