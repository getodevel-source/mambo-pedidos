# Actualización a 10 — Tasks (IT28)

## Hecho
- [x] Barra de progreso honesta: acumula chunkLength real y muestra "X MB
      descargados" + barra indeterminada logarítmica (antes fake `chunk/1024` %
      que saltaba a 90%).
- [x] Ya era sólido y testeado: Tauri v2 plugin-updater firmado (minisign),
      fallback GitHub API, validación de config/pubkey, seguridad de URLs
      externas, versiones (isNewerVersion/isValidVersion/formatNotes) cubiertas
      en testAppUpdaterModule.
- [x] 1010/1010 tests + lint 0/0.