// Uploads the full-DB xlsx to Google Drive using the *signed-in user's*
// OAuth access token (drive.file scope). Service accounts can't own Drive
// storage (storageQuotaExceeded 403), so we reuse the same user-OAuth
// pattern already used by drive_upload.rs for invoices.
//
// Each backup creates a new timestamped file (ozen-manager-YYYY-MM-DD-HH-MM.xlsx)
// rather than overwriting a single shared file — keeping historical versions
// means a corrupted write can't destroy earlier snapshots.

use reqwest::multipart::{Form, Part};
use serde_json::json;

const XLSX_MIME: &str =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BACKUP_FOLDER_ID: &str = "1Sqs6KC8pjrjbwmNuoPpqTQBIeOehM76b";

#[tauri::command]
pub async fn drive_backup(
    xlsx_bytes: Vec<u8>,
    access_token: String,
    file_name: String,
) -> Result<(), String> {
    if access_token.is_empty() {
        return Err(
            "missing Google access token; sign out and sign in again".to_string(),
        );
    }

    let metadata = json!({
        "name": file_name,
        "parents": [BACKUP_FOLDER_ID],
    })
    .to_string();

    let metadata_part = Part::text(metadata)
        .mime_str("application/json; charset=UTF-8")
        .map_err(|e| format!("metadata mime: {}", e))?;
    let media_part = Part::bytes(xlsx_bytes)
        .mime_str(XLSX_MIME)
        .map_err(|e| format!("media mime: {}", e))?;

    let form = Form::new()
        .part("metadata", metadata_part)
        .part("media", media_part);

    let client = reqwest::Client::new();
    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(&access_token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("drive create failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("drive create {}: {}", status, body));
    }
    Ok(())
}
