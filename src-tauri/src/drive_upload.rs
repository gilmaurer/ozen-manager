// Uploads a producer invoice file to the shared Google Drive folder using
// the *signed-in user's* OAuth access token (drive.file scope). Previous
// service-account approach failed because service accounts without a
// Shared Drive have no storage quota.

use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use serde_json::json;

// Shared folder. The signed-in user must have at least Editor on it.
const INVOICE_FOLDER_ID: &str = "1uKHhbLZwxrHqx7dMXi31nyH53xkXrZHV";

#[derive(Deserialize)]
struct UploadResponse {
    #[serde(rename = "webViewLink")]
    web_view_link: String,
}

fn mime_from_ext(path: &str) -> &'static str {
    let lc = path.to_lowercase();
    if lc.ends_with(".pdf") {
        "application/pdf"
    } else if lc.ends_with(".png") {
        "image/png"
    } else if lc.ends_with(".jpg") || lc.ends_with(".jpeg") {
        "image/jpeg"
    } else if lc.ends_with(".heic") {
        "image/heic"
    } else if lc.ends_with(".webp") {
        "image/webp"
    } else if lc.ends_with(".doc") {
        "application/msword"
    } else if lc.ends_with(".docx") {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    } else if lc.ends_with(".xls") {
        "application/vnd.ms-excel"
    } else if lc.ends_with(".xlsx") {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    } else {
        "application/octet-stream"
    }
}

#[tauri::command]
pub async fn upload_invoice_to_drive(
    file_path: String,
    display_name: String,
    access_token: String,
) -> Result<String, String> {
    if access_token.is_empty() {
        return Err("missing Google access token; sign out and sign in again".to_string());
    }

    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("could not read {}: {}", file_path, e))?;
    let mime = mime_from_ext(&file_path);

    let metadata = json!({
        "name": display_name,
        "parents": [INVOICE_FOLDER_ID],
    })
    .to_string();

    let metadata_part = Part::text(metadata)
        .mime_str("application/json; charset=UTF-8")
        .map_err(|e| format!("metadata mime: {}", e))?;
    let media_part = Part::bytes(bytes)
        .mime_str(mime)
        .map_err(|e| format!("media mime: {}", e))?;
    let form = Form::new()
        .part("metadata", metadata_part)
        .part("media", media_part);

    let client = reqwest::Client::new();
    let resp = client
        .post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        )
        .bearer_auth(&access_token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("drive upload failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("drive upload {}: {}", status, body));
    }

    let parsed: UploadResponse = resp
        .json()
        .await
        .map_err(|e| format!("invalid upload response: {}", e))?;
    Ok(parsed.web_view_link)
}
