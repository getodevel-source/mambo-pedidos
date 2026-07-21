use tauri::Manager;

#[tauri::command]
fn validate_catalog_entry(entry: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut errors = Vec::new();

    // Validar SKU
    let sku = entry.get("sku").and_then(|v| v.as_str()).unwrap_or("");
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
    let cat = entry.get("cat").and_then(|v| v.as_str()).unwrap_or("");
    if cat.is_empty() {
        errors.push("Categoría vacía".to_string());
    }

    // Validar marca
    let marca = entry.get("marca").and_then(|v| v.as_str()).unwrap_or("");
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
        if !qty.fract().is_close_to(0.0) {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            validate_catalog_entry,
            validate_order,
            get_app_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
