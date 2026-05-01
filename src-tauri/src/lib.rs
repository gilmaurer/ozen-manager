mod auth_loopback;
mod drive_backup;

#[tauri::command]
fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            drive_backup::drive_backup,
            auth_loopback::start_auth_listener,
            write_file_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
