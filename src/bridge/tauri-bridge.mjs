// ============================================
// Mambo Pedidos - Tauri plugin bridge
// ============================================
// El frontend se sirve con <script src> clásicos y build-frontend.js compila
// con bundle:false, así que los plugins de Tauri v2 (que sólo se publican como
// módulos ESM: @tauri-apps/plugin-fs, @tauri-apps/plugin-store) NO son
// alcanzables desde el código browser-global. `withGlobalTauri: true` inyecta
// core/event/window/path, pero nunca las APIs de plugin: por eso
// window.__TAURI__.store y window.__TAURI__.fs dan undefined y la app caía
// siempre a localStorage.
//
// Este archivo es la única excepción ESM del bundle: build-frontend.js lo
// compila aparte (format:'iife') a dist/vendor/tauri-bridge.js y lo expone
// como window.MamboTauriBridge. Se carga ANTES de js/storage.js.
//
// Todo lo que toca __TAURI_INTERNALS__ es perezoso (dentro de las funciones),
// así que importar este módulo fuera de Tauri es seguro; `inTauri` es la
// puerta que usa AppStorage para decidir si puede confiar en el puente.
// ============================================

import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readFile,
  remove,
  writeFile,
} from '@tauri-apps/plugin-fs';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { appDataDir } from '@tauri-apps/api/path';

const global = typeof window !== 'undefined' ? window : globalThis;

// En Tauri v2 toda ruta relativa necesita baseDir explícito o la niega el
// scope. Fijamos AppData ($APPDATA/com.mambo.pedidos) una sola vez acá para
// que el resto del código hable en rutas relativas legibles ('images/x.png').
const BASE = BaseDirectory.AppData;

global.MamboTauriBridge = {
  // true sólo dentro del runtime real: fuera de Tauri las llamadas reventarían.
  inTauri: !!(global.__TAURI_INTERNALS__ || global.__TAURI__),

  fs: {
    baseDir: BASE,
    // El contrato v2 es readFile/writeFile; el código anterior usaba los
    // nombres de v1 (readBinaryFile/writeBinaryFile), que ya no existen.
    writeBytes: (rel, bytes) => writeFile(rel, bytes, { baseDir: BASE }),
    readBytes: (rel) => readFile(rel, { baseDir: BASE }),
    ensureDir: (rel) => mkdir(rel, { recursive: true, baseDir: BASE }),
    list: (rel) => readDir(rel, { baseDir: BASE }),
    remove: (rel) => remove(rel, { recursive: true, baseDir: BASE }),
    exists: (rel) => exists(rel, { baseDir: BASE }),
    // Ruta absoluta real de $APPDATA, para mensajes de error accionables.
    appDataDir: () => appDataDir(),
  },

  // Store.load() persiste el archivo JSON dentro de app_data_dir.
  store: {
    load: (fileName) => loadStore(fileName),
  },
};
