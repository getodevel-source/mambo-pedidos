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
    // WebKitGTK (motor Linux de Tauri) solo soporta escalas ENTERAS: con un
    // monitor a escala fraccionaria (p.ej. 1.4 en una laptop 14"), Hyprland
    // anuncia round-up -> escala 2 y la app renderiza a la mitad del ancho
    // logico y se ve desproporcionada ("todo gigante"). Forzar 1 deja que el
    // compositor haga el escalado fraccionario (que si soporta). Se puede
    // pisar con GDK_SCALE en el entorno.
    #[cfg(target_os = "linux")]
    if std::env::var("GDK_SCALE").is_err() {
        std::env::set_var("GDK_SCALE", "1");
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
