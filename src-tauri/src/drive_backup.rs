use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use serde_json::json;

use crate::drive_client;

const FILE_NAME: &str = "ozen-manager.xlsx";

#[derive(Deserialize)]
struct FileListResponse {
    files: Vec<FileMeta>,
}

#[derive(Deserialize)]
struct FileMeta {
    id: String,
}

async fn find_existing_file(
    client: &reqwest::Client,
    token: &str,
    folder_id: &str,
) -> Result<Option<String>, String> {
    let q = format!(
        "name = '{}' and '{}' in parents and trashed = false",
        FILE_NAME, folder_id
    );
    let resp = client
        .get("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .query(&[
            ("q", q.as_str()),
            ("fields", "files(id)"),
            ("spaces", "drive"),
        ])
        .send()
        .await
        .map_err(|e| format!("drive list failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("drive list {}: {}", status, body));
    }

    let parsed: FileListResponse = resp
        .json()
        .await
        .map_err(|e| format!("invalid list response: {}", e))?;
    Ok(parsed.files.into_iter().next().map(|f| f.id))
}

async fn update_file(
    client: &reqwest::Client,
    token: &str,
    file_id: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let url = format!(
        "https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media",
        file_id
    );
    let resp = client
        .patch(&url)
        .bearer_auth(token)
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("drive update failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("drive update {}: {}", status, body));
    }
    Ok(())
}

async fn create_file(
    client: &reqwest::Client,
    token: &str,
    folder_id: &str,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let metadata = json!({
        "name": FILE_NAME,
        "parents": [folder_id],
    })
    .to_string();

    let metadata_part = Part::text(metadata).mime_str("application/json; charset=UTF-8")
        .map_err(|e| format!("metadata mime: {}", e))?;
    let media_part = Part::bytes(bytes)
        .mime_str("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .map_err(|e| format!("media mime: {}", e))?;

    let form = Form::new()
        .part("metadata", metadata_part)
        .part("media", media_part);

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(token)
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

#[tauri::command]
pub async fn drive_backup(xlsx_bytes: Vec<u8>) -> Result<(), String> {
    let cfg = match drive_client::read_config()? {
        Some(c) => c,
        None => return Err("backup not configured".to_string()),
    };

    let token = drive_client::get_access_token(&cfg.service_account).await?;
    let client = reqwest::Client::new();

    let existing = find_existing_file(&client, &token, &cfg.folder_id).await?;
    match existing {
        Some(id) => update_file(&client, &token, &id, xlsx_bytes).await?,
        None => create_file(&client, &token, &cfg.folder_id, xlsx_bytes).await?,
    }
    Ok(())
}
