mod auth_loopback;
mod drive_backup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            drive_backup::drive_backup,
            auth_loopback::start_auth_listener,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
