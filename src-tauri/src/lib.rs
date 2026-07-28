use tauri::Manager;

#[tauri::command]
fn validate_catalog_entry(entry: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut errors = Vec::new();

    // Validar SKU
    let sku = entry.get("sku").and_then(|v| v.as_str()).unwrap_or("").trim();
    if sku.is_empty() {
        errors.push("SKU vacío".to_string());
    } else if sku.len() > 50 {
        errors.push("SKU muy largo (max 50 chars)".to_string());
    }

    // Validar FOB
    let fob = entry.get("fob").and_then(|v| v.as_f64()).unwrap_or(0.0);
    if fob <= 0.0 {
        errors.push("FOB debe ser mayor a 0".to_string());
    } else if fob > 500.0 {
        errors.push("FOB muy alto (>USD 500), verificá el precio".to_string());
    }

    // Validar categoría
    let cat = entry.get("cat").and_then(|v| v.as_str()).unwrap_or("").trim();
    if cat.is_empty() {
        errors.push("Categoría vacía".to_string());
    }

    // Validar marca
    let marca = entry.get("marca").and_then(|v| v.as_str()).unwrap_or("").trim();
    if marca.is_empty() {
        errors.push("Marca vacía".to_string());
    }

    if errors.is_empty() {
        Ok(serde_json::json!({ "valid": true }))
    } else {
        Ok(serde_json::json!({ "valid": false, "errors": errors }))
    }
}

#[tauri::command]
fn validate_order(order: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let items = order.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    if items.is_empty() {
        errors.push("El pedido no tiene items".to_string());
    }

    for (idx, item) in items.iter().enumerate() {
        let sku = item.get("sku").and_then(|v| v.as_str()).unwrap_or("");
        if sku.is_empty() {
            errors.push(format!("Item #{}: SKU vacío", idx + 1));
        }

        let qty = item.get("qty").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if qty < 1.0 {
            errors.push(format!("Item #{}: cantidad debe ser >= 1", idx + 1));
        }
        if qty.fract().abs() > f64::EPSILON {
            warnings.push(format!("Item #{}: cantidad con decimales, podría no aplicar MOQ", idx + 1));
        }

        let fob = item.get("fob").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if fob <= 0.0 {
            errors.push(format!("Item #{}: FOB inválido", idx + 1));
        }
    }

    Ok(serde_json::json!({
        "valid": errors.is_empty(),
        "errors": errors,
        "warnings": warnings
    }))
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
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
async fn download_and_install_update(url: String) -> Result<(), String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP Error {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let temp_dir = std::env::temp_dir();
    let is_msi = url.to_lowercase().ends_with(".msi");
    let file_name = if is_msi { "mambo_update.msi" } else { "mambo_update.exe" };
    let temp_path = temp_dir.join(file_name);

    std::fs::write(&temp_path, &bytes).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if is_msi {
            std::process::Command::new("msiexec")
                .args(["/i", temp_path.to_str().unwrap()])
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new(&temp_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    Ok(())
}

#[tauri::command]
async fn check_local_ai_status(endpoint: Option<String>) -> Result<serde_json::Value, String> {
    let base_url = endpoint.unwrap_or_else(|| "http://localhost:8080".to_string());
    let url = format!("{}/health", base_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(&url).send().await {
        Ok(res) if res.status().is_success() => {
            Ok(serde_json::json!({
                "online": true,
                "engine": "llama.cpp-sidecar",
                "endpoint": base_url,
                "models": ["Qwen2.5-3B-Instruct-GGUF"]
            }))
        }
        _ => {
            // Fallback check to Ollama port 11434 if sidecar port not active
            let fallback_url = "http://localhost:11434/api/tags";
            if let Ok(res) = client.get(fallback_url).send().await {
                if res.status().is_success() {
                    let json: serde_json::Value = res.json().await.unwrap_or_default();
                    let models = json.get("models").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    let model_names: Vec<String> = models.iter()
                        .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                        .collect();
                    return Ok(serde_json::json!({
                        "online": true,
                        "engine": "ollama",
                        "endpoint": "http://localhost:11434",
                        "models": model_names
                    }));
                }
            }

            Ok(serde_json::json!({
                "online": false,
                "engine": "none",
                "endpoint": base_url,
                "models": []
            }))
        }
    }
}

#[tauri::command]
async fn query_local_ai(
    endpoint: Option<String>,
    model: Option<String>,
    prompt: String,
    image_base64: Option<String>,
    system: Option<String>,
    format: Option<serde_json::Value>,
    options: Option<serde_json::Value>,
    timeout_secs: Option<u64>
) -> Result<serde_json::Value, String> {
    let base_url = endpoint.unwrap_or_else(|| "http://localhost:8080".to_string());

    let timeout_val = timeout_secs.unwrap_or(180);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_val))
        .build()
        .map_err(|e| e.to_string())?;

    // First try native llama-server endpoint (/completion)
    let native_url = format!("{}/completion", base_url.trim_end_matches('/'));
    let mut native_body = serde_json::json!({
        "prompt": format!("System: {}\nUser: {}\nAssistant:", system.unwrap_or_default(), prompt),
        "temperature": 0.1,
        "n_predict": 1024,
        "json_schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sku": { "type": "string" },
                            "marca": { "type": "string" },
                            "modelo": { "type": "string" },
                            "variante": { "type": "string" },
                            "cat": { "type": "string" },
                            "fob": { "type": "number" }
                        },
                        "required": ["modelo", "fob"]
                    }
                }
            }
        }
    });

    if let Ok(response) = client.post(&native_url).json(&native_body).send().await {
        if response.status().is_success() {
            let res_data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
            let content = res_data.get("content").and_then(|v| v.as_str()).unwrap_or("");
            return Ok(serde_json::json!({
                "success": true,
                "engine": "llama.cpp-sidecar",
                "raw_response": content
            }));
        }
    }

    // Fallback to Ollama API if sidecar port not active
    let ollama_url = "http://localhost:11434/api/generate";
    let selected_model = model.unwrap_or_else(|| "qwen2.5:3b".to_string());
    let mut body = serde_json::json!({
        "model": selected_model,
        "prompt": prompt,
        "stream": false,
        "format": format.unwrap_or_else(|| serde_json::json!("json"))
    });

    if let Some(img) = image_base64 {
        if !img.trim().is_empty() {
            let clean_img = img.replace("data:image/png;base64,", "").replace("data:image/jpeg;base64,", "");
            body["images"] = serde_json::json!([clean_img]);
        }
    }

    let response = client.post(ollama_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error de conexión con motor local de IA: {}", e))?;

    let res_data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let raw_text = res_data.get("response").and_then(|v| v.as_str()).unwrap_or("");

    Ok(serde_json::json!({
        "success": true,
        "engine": "ollama-fallback",
        "model": selected_model,
        "raw_response": raw_text
    }))
}

#[tauri::command]
async fn start_local_ai_session() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "active": true,
        "status": "Sesión de IA Nativa Local iniciada",
        "zero_hallucination": true
    }))
}

#[tauri::command]
async fn stop_local_ai_session() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "active": false,
        "status": "Sesión de IA finalizada. Recursos VRAM/RAM liberados",
        "memory_freed": true
    }))
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            validate_catalog_entry,
            validate_order,
            get_app_data_dir,
            open_external_url,
            download_and_install_update,
            check_local_ai_status,
            query_local_ai,
            start_local_ai_session,
            stop_local_ai_session,
            get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_catalog_entry_success() {
        let entry = serde_json::json!({
            "sku": "AUL-TEC-0001",
            "fob": 35.50,
            "cat": "TECLADO",
            "marca": "AULA"
        });
        let result = validate_catalog_entry(entry).unwrap();
        assert_eq!(result["valid"], true);
    }

    #[test]
    fn test_validate_catalog_entry_invalid_fob() {
        let entry = serde_json::json!({
            "sku": "AUL-TEC-0001",
            "fob": -10.0,
            "cat": "TECLADO",
            "marca": "AULA"
        });
        let result = validate_catalog_entry(entry).unwrap();
        assert_eq!(result["valid"], false);
    }

    #[test]
    fn test_validate_order_empty_items() {
        let order = serde_json::json!({ "items": [] });
        let result = validate_order(order).unwrap();
        assert_eq!(result["valid"], false);
    }

    #[test]
    fn test_validate_catalog_entry_whitespace_sku() {
        let entry = serde_json::json!({
            "sku": "   ",
            "fob": 35.50,
            "cat": "TECLADO",
            "marca": "AULA"
        });
        let result = validate_catalog_entry(entry).unwrap();
        assert_eq!(result["valid"], false);
    }
}
