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

/// Cómo está instalada la app, para decidir si el auto-update puede
/// reemplazar la instalación en sitio o debe pedir instalación manual.
///
/// - "appimage": variable de entorno APPIMAGE presente, o el binario actual
///   es un AppImage type-2 (magic 0x41 0x49 0x02 en bytes 8..11) — el
///   auto-reemplazo es seguro (el updater escribe sobre el .AppImage).
/// - "binary": otros casos (AppDir, binario suelto). El updater de Tauri, sin
///   APPIMAGE env, sobrescribiría el binario en ejecución con el AppImage
///   descargado y rompería el lanzador: el frontend NO debe auto-instalar.
#[tauri::command]
fn get_install_kind() -> String {
    if std::env::var("APPIMAGE").is_ok() {
        return "appimage".to_string();
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Ok(mut f) = std::fs::File::open(&exe) {
                use std::io::Read;
                let mut buf = [0u8; 12];
                if f.read_exact(&mut buf).is_ok()
                    && buf[8] == 0x41
                    && buf[9] == 0x49
                    && buf[10] == 0x02
                {
                    return "appimage".to_string();
                }
            }
        }
    }
    // Plataformas con instalador nativo: el auto-install es seguro
    // (el plugin ejecuta el setup NSIS / reemplaza el .app firmado).
    #[cfg(target_os = "windows")]
    return "nsis".to_string();
    #[cfg(target_os = "macos")]
    return "app".to_string();
    "binary".to_string()
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

        // Respetar un GDK_BACKEND ya seteado por el entorno (p.ej. el AppRun

        // del AppImage que fuerza x11 por el webkit embebido: pisarlo a

        // wayland crashea el WebKitWebProcess del bundle viejo). Solo

        // intervenir cuando nadie decidió el backend.

        if is_wayland && std::env::var("GDK_BACKEND").is_err() {

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
            get_app_version,
            get_install_kind
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
