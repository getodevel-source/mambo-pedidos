// diagnostics.js — overlay de diagnóstico para errores de runtime.
// window.onerror + unhandledrejection → panel "Algo falló" con mensaje,
// botón copiar y persistencia de la última caída (localStorage) para soporte.
// NO pisa la consola: solo reacciona a errores reales (el e2e exige consola
// limpia en el flujo normal, y este módulo no loguea en el normal).
(function () {
  "use strict";

  const LAST_KEY = "mambo_last_error";
  const listeners = [];

  function persist(detail) {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(detail));
    } catch {}
  }

  function setMessage(overlay, detail) {
    overlay.querySelector("pre").textContent =
      detail.type + ": " + detail.message + "\n" + detail.stack;
  }

  function mountOverlay(detail) {
    let overlay = document.getElementById("mamboErrorOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mamboErrorOverlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:rgba(8,10,16,.9);" +
        "backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,sans-serif;";
      overlay.innerHTML =
        '<div style="background:#151826;border:1px solid rgba(255,87,34,.5);border-radius:12px;' +
        "max-width:560px;width:92%;padding:20px 22px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6);\">" +
        '<div style="font-size:15px;font-weight:800;margin-bottom:4px;">Algo falló</div>' +
        '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">La app siguió funcionando; esto es un aviso para que lo reportes.</div>' +
        '<pre style="background:#0d1117;border:1px solid #263041;border-radius:8px;padding:10px;' +
        'font-size:11.5px;color:#fca5a5;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;margin:0 0 12px;"></pre>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button data-act="copy" style="...">Copiar</button>' +
        '<button data-act="close" style="...">Entendido</button>' +
        "</div></div>";
      // estilos de botones
      for (const b of overlay.querySelectorAll("button")) {
        b.style.cssText =
          "padding:7px 14px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:12px;font-weight:700;cursor:pointer;";
      }
      overlay.querySelector('[data-act="copy"]').addEventListener("click", () => {
        try {
          navigator.clipboard.writeText(
            detail.type + ": " + detail.message + "\n" + detail.stack
          );
        } catch {}
      });
      overlay.querySelector('[data-act="close"]').addEventListener("click", () => {
        overlay.remove();
      });
      document.body.appendChild(overlay);
    } else {
      setMessage(overlay, detail);
    }
    setMessage(overlay, detail);
  }

  function handle(type, message, source, line, col, error, stack) {
    const detail = {
      type,
      message: String(message || "").slice(0, 300),
      stack: String(stack || (error && error.stack) || "").slice(0, 1200),
      at: new Date().toISOString(),
    };
    persist(detail);
    try {
      if (document.body) mountOverlay(detail);
      else listeners.push(detail);
    } catch {}
  }

  window.addEventListener("error", (e) => {
    handle("error", e.message, "", 0, 0, e.error, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    handle(
      "unhandledrejection",
      (r && r.message) || String(r),
      "",
      0,
      0,
      r,
      r && r.stack
    );
  });
  document.addEventListener("DOMContentLoaded", () => {
    for (const d of listeners.splice(0)) mountOverlay(d);
  });

  // API para tests: disparar el flujo sin tener que lanzar un error real.
  window.Diagnostics = { handle, persist, mountOverlay, LAST_KEY };
})();