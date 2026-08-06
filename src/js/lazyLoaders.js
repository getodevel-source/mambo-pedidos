// ============================================
// Mambo Pedidos - Lazy Loaders (P17 opción 2)
// ============================================
// Carga diferida de librerías pesadas: pdf.js (316K + worker 1.1MB) y
// xlsx (864K) SOLO se descargan al primer uso real (import de PDF /
// import-export de planillas). Ahorra ~1.2MB de parseo en el arranque
// sin CDN y sin minificar (decisión usuario 05/08: golpes cortos).
//
// Uso (browser): ensurePdfLib() / ensureXlsxLib() devuelven Promise con
// el global ya cargado. Idempotente: la segunda llamada reusa la promesa.
// En Node (scripts de test) `window` no existe → cae a globalThis, y los
// guards de los callers (`typeof ensureXlsxLib === 'function'`) hacen que
// el comportamiento de los scripts sin DOM no cambie.
// ============================================

(function (global) {
  'use strict';

  let pdfPromise = null;
  let xlsxPromise = null;

  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }

  global.ensurePdfLib = function ensurePdfLib() {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      return Promise.resolve(pdfjsLib);
    }
    if (!pdfPromise) {
      pdfPromise = injectScript('vendor/pdf.min.js').then(function () {
        if (typeof pdfjsLib === 'undefined') {
          throw new Error('vendor/pdf.min.js no definió pdfjsLib');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        return pdfjsLib;
      });
    }
    return pdfPromise;
  };

  global.ensureXlsxLib = function ensureXlsxLib() {
    if (typeof XLSX !== 'undefined') {
      return Promise.resolve(XLSX);
    }
    if (!xlsxPromise) {
      xlsxPromise = injectScript('vendor/xlsx.full.min.js').then(function () {
        if (typeof XLSX === 'undefined') {
          throw new Error('vendor/xlsx.full.min.js no definió XLSX');
        }
        return XLSX;
      });
    }
    return xlsxPromise;
  };

})(typeof window !== 'undefined' ? window : globalThis);
