#!/usr/bin/env node
/**
 * Mambo Pedidos — E2E smoke test (Tauri/WebView2 real).
 *
 * Arranca la app real (o se conecta a una ya corriendo con
 * --remote-debugging-port=9222) y verifica por CDP las capas de integración
 * que los unit tests no cubren:
 *   1. Consola/excepciones limpias al load.
 *   2. Botones de navegación vivos (tamaño>0) y click real cambia la vista.
 *   3. Store real del plugin (no null, no fallback silencioso) + roundtrip.
 *   4. Puente de plugins (window.MamboTauriBridge), AppStorage.mode='tauri' y
 *      roundtrip de una imagen real por images/ en $APPDATA.
 *   5. Catálogo carga filas.
 *
 * Exit: 0 = todo OK; 1 = hay bugs; 2 = error de harness.
 * Uso:
 *   node scripts/e2e-smoke.js                 # abre/adjunta a :9222
 *   node scripts/e2e-smoke.js ws://.../target # target concreto
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const DEBUG_PORT = 9222;
const EXE = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'mambo-pedidos.exe');

// ── descubrimiento / lanzamiento del target CDP ─────────────────────────────
async function discoverWsUrl() {
  // 1) arg explícito
  const arg = process.argv[2];
  if (arg && arg.startsWith('ws://')) return arg;
  if (arg) throw new Error('Uso: node scripts/e2e-smoke.js [ws://target]');
  // 2) app ya corriendo en :9222
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
    const list = await res.json();
    const page = list.find(t => t.type === 'page');
    if (page) return page.webSocketDebuggerUrl;
  } catch {}
  // 3) no hay app → lanzarla con CDP habilitado y esperar el target
  if (!process.env.E2E_NO_LAUNCH) {
    if (!require('fs').existsSync(EXE)) throw new Error(`Sin build: ${EXE} (corré npm run e2e:build)`);
    // Los flags van en el WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS de abajo solo
    // como respaldo: wry construye el entorno de WebView2 pasando su propio
    // additionalBrowserArgs (--disable-features=msWebOOUI,msPdfOOUI,...) y cuando
    // esa opcion esta presente WebView2 IGNORA la variable de entorno. Por eso el
    // binario del smoke tiene que salir de `npm run e2e:build`, que fija los args
    // (incluidos los de wry) en src-tauri/tauri.e2e.conf.json. --remote-allow-
    // origins hace falta ademas: desde Chromium 111 el endpoint rechaza el upgrade
    // de WebSocket si el origen no esta permitido.
    const cdpArgs = `--remote-debugging-port=${DEBUG_PORT} --remote-allow-origins=*`;
    let child;
    try {
      child = spawn(EXE, [], { env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: cdpArgs }, detached: true, stdio: 'ignore' });
    } catch (e) {
      throw new Error(`No se pudo lanzar ${EXE}: ${e.message}`);
    }
    child.on('error', (e) => console.error(`spawn error en ${EXE}: ${e.message}`));
    child.unref();
    // En un runner frio la app puede tardar en levantar WebView2 (el defensor
    // escaneando un .exe de ~8 MB a primera ejecucion). 30s era poco y ademas no
    // decia nada: se reporta si el proceso sobrevivio y que respondio el endpoint
    // para distinguir "no arranco" de "arranco sin CDP".
    const tries = Number(process.env.E2E_LAUNCH_TRIES || 60);
    let lastErr = null;
    let lastStatus = 'nunca respondio';
    for (let i = 0; i < tries; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (child.exitCode !== null) {
        throw new Error(`${EXE} salio con code ${child.exitCode} antes de exponer CDP (segundos: ${i + 1})`);
      }
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
        lastStatus = `HTTP ${res.status}`;
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page) return page.webSocketDebuggerUrl;
        lastStatus = `HTTP ${res.status}, ${list.length} targets (ninguno type=page)`;
      } catch (e) {
        lastErr = e;
        lastStatus = `${e.code || 'fetch'}: ${e.message}`;
      }
    }
    const alive = child.exitCode === null;
    throw new Error(
      `No aparecio el target CDP en :${DEBUG_PORT} tras ${tries}s. ` +
      `proceso=${alive ? 'vivo' : 'muerto(code ' + child.exitCode + ')'} endpoint=${lastStatus}` +
      (alive
        ? '. Proceso vivo y puerto cerrado = el binario NO se construyo con los args'
          + ' de CDP: corré `npm run e2e:build` (ver src-tauri/tauri.e2e.conf.json)'
        : '') + (lastErr ? ` ultimo=${lastErr.message}` : '')
    );
  }
  throw new Error(`Sin target CDP en :${DEBUG_PORT}`);
}

// ── cliente WS minimalista ──────────────────────────────────────────────────
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onerror = e => reject(new Error('WS error: ' + (e.message || 'connect')));
    ws.onopen = () => {
      let id = 0;
      const pending = new Map();
      const logs = [];
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
        else if (m.method === 'Runtime.exceptionThrown') {
          logs.push({ type: 'exception', msg: (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text) });
        } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
          logs.push({ type: 'console.' + m.params.type, msg: m.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ').slice(0, 300) });
        }
      };
      const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
      resolve({ ws, send, logs });
    };
  });
}

// ── helper: evaluación con retorno by-value ─────────────────────────────────
function rc(client, expression) {
  return client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).then(r => r.result.value);
}

// ── espera por condición (poll): los sleeps fijos mienten en runners fríos ───
// El boot real tarda 7-8s en frío; medir el rect antes del primer layout da 0x0
// y voltea el gate sin que haya ningún bug. Todo lo que depende del render
// espera por condición con timeout; el mensaje de fallo no cambia.
async function waitFor(client, expr, timeoutMs = 15000, intervalMs = 250) {
  const t0 = Date.now();
  for (;;) {
    const v = await rc(client, expr).catch(() => null);
    if (v) return v;
    if (Date.now() - t0 >= timeoutMs) return null;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// ── click real en selector (mouse sintético, no JS) ─────────────────────────
async function realClick(client, sel) {
  const rectOf = `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`;
  const p = await waitFor(client, `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; const r = b.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null; return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  if (!p) {
    const q = await rc(client, rectOf).catch(() => null);
    return { clicked: false, w: (q && q.w) || 0, h: (q && q.h) || 0 };
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  return { clicked: true, x: p.x, y: p.y, w: p.w, h: p.h };
}

const fail = bugs => { console.error('\n❌ E2E FAIL — ' + bugs.length + ' bug(s):'); bugs.forEach(b => console.error('  • ' + b)); process.exit(1); };

// Un check de nav aislado (baja la complejidad de main y se puede leer solo).
async function checkNavView(client, view) {
  const before = await rc(client, `document.querySelector('.nav-item.active')?.dataset.view`);
  const click = await realClick(client, `.nav-item[data-view="${view}"]`);
  let after = await waitFor(client, `(() => { const el = document.querySelector('.nav-item.active'); const v = el ? el.dataset.view : null; return v === ${JSON.stringify(view)} ? v : null; })()`, 5000, 200);
  if (after === null) after = await rc(client, `document.querySelector('.nav-item.active')?.dataset.view`);
  if (!click.clicked) return { click, before, after, bug: `nav "${view}": botón invisible tras 15s (rect ${click.w || 0}x${click.h || 0})` };
  if (after !== view) return { click, before, after, bug: `nav "${view}": click terminó en "${after}" (esperado "${view}")` };
  return { click, before, after, bug: null };
}

async function main() {
  // El WebSocket global existe desde Node 22. Con 20 el harness descubre el
  // target y luego falla con un "WebSocket is not defined" que no dice nada
  // de la causa real, asi que se anuncia antes de intentarlo.
  if (typeof WebSocket === 'undefined') {
    throw new Error(
      `Este smoke necesita el WebSocket global (Node >= 22). Version actual: ${process.version}`
    );
  }

  const wsUrl = await discoverWsUrl();
  const client = await connect(wsUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 6000));

  const bugs = [];
  const logSkips = [];

  // 1) excepciones/errores al load
  const consoleClean = !client.logs.some(l => l.type === 'exception' || l.type === 'console.error');
  if (!consoleClean) bugs.push('excepciones/errores de consola al load: ' + JSON.stringify(client.logs.slice(0, 5)));

  // 2) botones de navegación vivos + cambio de vista
  const navStatus = {};
  for (const view of ['catalogo', 'pedido', 'historial']) {
    const s = await checkNavView(client, view);
    navStatus[view] = s;
    if (s.bug) bugs.push(s.bug);
    else logSkips.push(`nav "${view}" ok`);
  }
  await realClick(client, '.nav-item[data-view=catalogo]');

  // 3) puente de plugins + store real + roundtrip de imagen en images/
  const persist = await rc(client, `(async () => {
    const A = window.AppStorage, B = window.MamboTauriBridge;
    const fsOk = !!(B && B.fs && B.fs.ensureDir && B.fs.writeBytes && B.fs.readBytes && B.fs.remove && B.fs.exists);
    const out = { bridgePresent: !!B, inTauri: !!(B && B.inTauri), fsOk: fsOk, mode: A ? (A.mode || null) : null, storeNull: true, roundtrip: false, imageRoundtrip: false, imagesProbed: false, imagesDir: null, persistenceError: A ? (A.persistenceError || null) : null, err: null };
    if (!A) return out;
    try {
      await A.init();
      out.mode = A.mode || null;
      out.storeNull = !A.storeInstance;
      if (typeof A.diagnostics === 'function') { const d = await A.diagnostics(); out.imagesDir = d.imagesDir || null; out.inTauri = !!d.inTauri; out.persistenceError = A.persistenceError || null; }
      if (A.storeInstance && typeof A.storeInstance.set === 'function') {
        const k = '_e2e_probe_' + Date.now();
        await A.storeInstance.set(k, { ok: true });
        const read = await A.storeInstance.get(k);
        await A.storeInstance.save();
        await A.storeInstance.reload();
        const read2 = await A.storeInstance.get(k);
        await A.storeInstance.delete(k);
        await A.storeInstance.save();
        out.roundtrip = !!(read && read.ok && read2 && read2.ok);
      }
      // Imagen: el mismo camino real (dataURL -> bytes -> images/ -> bytes ->
      // dataURL). NO se usa saveCatalog a proposito: su garbage collect
      // borraria los archivos del catalogo verdadero del usuario.
      if (out.inTauri && fsOk) {
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const rel = 'images/_e2e_probe_' + Date.now() + '.png';
        out.imagesProbed = true;
        await B.fs.ensureDir('images');
        await B.fs.writeBytes(rel, A._dataUrlToBytes(png));
        const back = A._bytesToDataUrl(await B.fs.readBytes(rel), 'png');
        await B.fs.remove(rel);
        out.imageRoundtrip = back === png && !(await B.fs.exists(rel));
      }
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);
  if (!persist.bridgePresent) bugs.push('puente: window.MamboTauriBridge NO existe (falta dist/vendor/tauri-bridge.js o se cargo despues de js/storage.js)');
  else if (!persist.inTauri) bugs.push('puente: MamboTauriBridge.inTauri=false (el bridge se evaluo fuera del runtime Tauri)');
  if (!persist.fsOk) bugs.push('puente: MamboTauriBridge.fs no expone ensureDir/writeBytes/readBytes/remove/exists');
  if (persist.mode !== 'tauri') bugs.push('modo: AppStorage.mode=' + JSON.stringify(persist.mode) + ' (esperado "tauri": fallback silencioso a localStorage)' + (persist.persistenceError ? ' — ' + persist.persistenceError : ''));
  if (persist.storeNull) bugs.push('store: AppStorage.storeInstance es null (fallback silencioso a localStorage)');
  else if (!persist.roundtrip) bugs.push('store: roundtrip set/get/save/reload falló' + (persist.err ? ': ' + persist.err : ''));
  if (persist.imagesProbed && !persist.imageRoundtrip) bugs.push('imagenes: roundtrip por images/ en disco falló' + (persist.err ? ': ' + persist.err : ''));

  // 4) catálogo carga filas
  await rc(client, `(() => { try { typeof loadDemoCatalog === 'function' && loadDemoCatalog(); } catch(e){} })()`);
  const rows = await waitFor(client, `document.querySelectorAll('tbody tr').length`, 10000, 300);
  if (!rows) bugs.push('catálogo: 0 filas tras 10s de cargar demo');

  // reporte
  // boot-interactivity: marcas de arranque (performance.mark de app.js)
  let boot = null;
  try {
    boot = await rc(client, `(() => {
      const marks = (performance.getEntriesByType && performance.getEntriesByType('mark') || [])
        .filter(m => m.name && m.name.indexOf('boot:') === 0)
        .map(m => [m.name, Math.round(m.startTime)]);
      const map = {};
      for (const [n, t] of marks) map[n] = t;
      return { marks, map };
    })()`);
  } catch (e) { boot = null; }
  const bootTimes = boot && boot.map;
  const bootOk = bootTimes && !!bootTimes['boot:store-loaded'] &&
    bootTimes['boot:store-loaded'] <= 15000 &&
    (!bootTimes['boot:first-render'] || bootTimes['boot:first-render'] <= 15000);

  console.log('\n🔬 E2E SMOKE (Tauri/WebView2 vía CDP)');
  console.log('  consola limpia al load ........ ' + (consoleClean ? '✅' : '❌'));
  console.log('  boot dom-ready .............. ' + (bootTimes && 'boot:dom-ready' in bootTimes ? bootTimes['boot:dom-ready'] + 'ms' : '—'));
  console.log('  boot store-loaded ............ ' + (bootTimes && 'boot:store-loaded' in bootTimes ? bootTimes['boot:store-loaded'] + 'ms' : '—') + (bootOk ? ' ✅' : ' ❌'));
  console.log('  boot first-render ............ ' + (bootTimes && 'boot:first-render' in bootTimes ? bootTimes['boot:first-render'] + 'ms' : '— (sin catálogo restaurado)'));

  for (const v of Object.keys(navStatus)) {
    const s = navStatus[v];
    console.log(`  nav "${v}" ........................ ${s.click.clicked ? '✅' : '❌'} (${s.before}→${s.after})`);
  }
  console.log('  puente MamboTauriBridge ...... ' + (persist.bridgePresent ? (persist.inTauri ? '✅' : '❌ inTauri=false') : '❌ ausente'));
  console.log('  AppStorage.mode .............. ' + (persist.mode === 'tauri' ? '✅ tauri' : '❌ ' + JSON.stringify(persist.mode)));
  console.log('  store real (no null) ......... ' + (persist.storeNull ? '❌ null' : '✅'));
  console.log('  store roundtrip persist ...... ' + (persist.roundtrip ? '✅' : '❌'));
  console.log('  images/ roundtrip en disco ... ' + (!persist.imagesProbed ? '— (sin fs en el puente)' : (persist.imageRoundtrip ? '✅' : '❌')));
  console.log('  $APPDATA (base de images/) ... ' + (persist.imagesDir || '❌ sin resolver'));
  if (persist.persistenceError) console.log('  persistenceError ............. ' + persist.persistenceError);
  console.log('  catálogo carga filas ........... ' + (rows ? `✅ (${rows})` : '❌ 0'));
  if (logSkips.length) console.log('  (detalle: ' + logSkips.join('; ') + ')');

  const bootOkFinal = bootTimes === null || bootTimes === undefined ? true : bootOk !== false;
  if (bootOkFinal === false) bugs.push('boot fuera de umbral: store-loaded >15s o first-render >15s (runner frio: 5 mediciones, max 14,2s) (' + JSON.stringify(bootTimes) + ')');
  if (bugs.length) fail(bugs);
  console.log('\n✅ E2E PASS — 0 bugs de integración.');
  process.exit(0);
}

main().catch(e => { console.error('💥 e2e-smoke crashed:', e.message); process.exit(2); });