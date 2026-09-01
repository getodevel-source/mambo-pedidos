use tauri::Manager;

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "URL externa inválida".to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    let allowed_host = matches!(host, "github.com" | "www.github.com" | "instagram.com" | "www.instagram.com");
    if !matches!(parsed.scheme(), "http" | "https") || !allowed_host || url.chars().any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"')) {
        return Err("URL externa no permitida".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Wayland nativo: GTK4 + WebKitGTK >= 2.42 manejan escalas fraccionarias,
    // el webview rinde al DPR real del monitor (texto nitido, tamano correcto).
    // El hook linuxdeploy-plugin-gtk del AppImage fuerza GDK_BACKEND=x11 para
    // esquivar un crash de WebKitGTK 2.36 (tauri#8541, obsoleto) -> bajo
    // XWayland con monitor fraccionario el DPR queda en 1 y el compositor
    // estira el buffer: TODO se ve pixelado. En sesion Wayland lo corregimos
    // aca; en X11 no tocamos nada (GDK_SCALE quedo obsoleto: X11-only y en
    // el peor caso fuerza DPR 1).
    #[cfg(target_os = "linux")]
    {
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        let is_wayland = session_type == "wayland"
            || (session_type.is_empty() && std::env::var("WAYLAND_DISPLAY").is_ok());
        if is_wayland {
            std::env::set_var("GDK_BACKEND", "wayland");
        }
    }

    tauri::Builder::default()
        .setup(|app| {
            // Controles de ventana estilo macOS (cruz / minimizar / pantalla
            // completa a la IZQUIERDA) en Linux y macOS: la barra se dibuja en
            // el frontend (windowControls.js) sin decorations. Windows conserva
            // sus controles nativos a la derecha.
            #[cfg(not(target_os = "windows"))]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
            }
            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
