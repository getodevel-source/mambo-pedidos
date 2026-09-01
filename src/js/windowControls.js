// windowControls.js — controles de ventana estilo macOS para Linux/macOS.
// Windows conserva los controles nativos (decorations=true, este módulo no hace
// nada). Sin Tauri (browser/jsdom) los botones existen pero no ejecutan.
(function () {
  "use strict";

  // macOS: cruz a la izquierda + minimizar + pantalla completa (traffic lights).
  // Linux: mismo estilo por pedido del dueño (cruz / minimizar / fullscreen).
  var isMacLike = /linux|darwin/i.test(
    (typeof navigator !== "undefined" && (navigator.platform || navigator.userAgent)) || ""
  );
  if (!isMacLike || typeof document === "undefined") return;

  document.documentElement.classList.add("mac-titlebar");

  function win() {
    try {
      if (
        typeof window !== "undefined" &&
        window.__TAURI__ &&
        window.__TAURI__.window
      ) {
        return window.__TAURI__.window.getCurrentWindow();
      }
    } catch (e) {}
    return null;
  }

  function bind() {
    var bar = document.querySelector(".titlebar");
    if (!bar) return;
    var w = win();
    var closeBtn = bar.querySelector('[data-act="close"]');
    var minBtn = bar.querySelector('[data-act="minimize"]');
    var fullBtn = bar.querySelector('[data-act="fullscreen"]');

    var click = function (fn) {
      return function () {
        if (!w) return;
        fn().catch(function () {});
      };
    };
    if (closeBtn) closeBtn.addEventListener("click", click(function () { return w.close(); }));
    if (minBtn) minBtn.addEventListener("click", click(function () { return w.minimize(); }));
    if (fullBtn) fullBtn.addEventListener("click", click(function () { return w.isFullscreen().then(function (fs) { return fs ? w.setFullscreen(false) : w.setFullscreen(true); }); }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  // API para tests jsdom
  if (typeof window !== "undefined") window.WindowControls = { isMacLike: isMacLike, bind: bind };
})();