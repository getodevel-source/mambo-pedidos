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

/// Descarga el AppImage firmado EN EL BACKEND (reqwest) directo al TEMP y
/// devuelve la ruta para apply_appimage_update. Los 82MB NUNCA cruzan el IPC
/// (un Uint8Array gigante por invoke revienta la serialización del webview:
/// ese fue el error real "te manda a GitHub" del auto-install AppDir).
#[tauri::command]
async fn download_update(url: String) -> Result<String, String> {
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("la descarga falló: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let path = std::env::temp_dir().join(format!("mambo-update-{}.AppImage", ts));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

/// Auto-instalación para instalaciones AppDir/binario suelto (Linux):
/// extrae el AppImage descargado y verificado, copia SU binario sobre el
/// ejecutable en curso y relanza. El binario del AppImage, fuera del bundle,
/// usa las libs del SISTEMA (que sí renderizan en esta máquina; el webkit
/// embebido del bundle crashea).
#[tauri::command]
fn apply_appimage_update(appimage_path: String) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.display().to_string();
    let exe_new = format!("{}.new", exe_str);
    if appimage_path.contains('"') || appimage_path.contains('$') || appimage_path.contains('`') {
        return Err("ruta de update inválida".into());
    }
    // Validar que el archivo sea un AppImage type-2 (magic 0x41 0x49 0x02)
    {
        use std::io::Read;
        let mut f = std::fs::File::open(&appimage_path).map_err(|e| e.to_string())?;
        let mut buf = [0u8; 12];
        f.read_exact(&mut buf).map_err(|e| e.to_string())?;
        if !(buf[8] == 0x41 && buf[9] == 0x49 && buf[10] == 0x02) {
            return Err("el archivo no es un AppImage válido".into());
        }
    }
    let script = format!(
        "set -e\ncd \"$(mktemp -d)\"\nexport APPIMAGE_EXTRACT_AND_RUN=1\n\"{appimage}\" --appimage-extract >/dev/null 2>&1\ncp squashfs-root/usr/bin/mambo-pedidos \"{exe_new}\"\nchmod +x \"{exe_new}\"\npkill -x mambo-pedidos || true\nmv -f \"{exe_new}\" \"{exe_str}\"\nsetsid \"{exe_str}\" >/dev/null 2>&1 &",
        appimage = appimage_path,
        exe_new = exe_new,
        exe_str = exe_str
    );
    std::process::Command::new("setsid")
        .arg("sh")
        .arg("-c")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("no se pudo lanzar el instalador: {}", e))?;
    Ok(())
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

            // Regla por tipo de instalacion:
            // - AppImage bundle (APPIMAGE env): respetar el x11 que fuerza el
            //   hook linuxdeploy — el webkit embebido crashea bajo wayland.
            // - AppDir/binario (libs del sistema): FORZAR wayland nativo. El
            //   hook exporta GDK_BACKEND=x11 y eso dejaba la app a escala 1
            //   estirada por el compositor = LA APP PIXELADA. Con wayland
            //   Hyprland anuncia scale 2 (buffer 2x): texto nitido, tamano
            //   logico correcto.
            let is_bundle_appimage = std::env::var("APPIMAGE").is_ok();
            if is_wayland && !is_bundle_appimage {
                std::env::set_var("GDK_BACKEND", "wayland");
                // Buffer 2x (GDK_SCALE=2): WebKit dibuja nitido y el
                // compositor lo downsamplinga al 1.3333x nativo del monitor.
                // Con scale 1 (launcher viejo) el compositor ESTIRA el buffer
                // 1:1 -> pixelado cronico; sin scale, Hyprland negocia 1 y
                // pasa lo mismo. Forzar 2 = nitido con tamano logico correcto.
                std::env::set_var("GDK_SCALE", "2");
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
            get_install_kind,
            download_update,
            apply_appimage_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
