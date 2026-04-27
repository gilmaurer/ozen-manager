use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::json;

const APP_IDENTIFIER: &str = "com.gilmaurer.ozenmanager";
const CONFIG_FILENAME: &str = "drive-backup.json";
const FILE_NAME: &str = "ozen-manager.xlsx";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Deserialize)]
struct BackupConfig {
    folder_id: String,
    service_account: ServiceAccount,
}

#[derive(Deserialize)]
struct ServiceAccount {
    client_email: String,
    private_key: String,
    private_key_id: Option<String>,
}

#[derive(Serialize)]
struct JwtClaims {
    iss: String,
    scope: String,
    aud: String,
    iat: u64,
    exp: u64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct FileListResponse {
    files: Vec<FileMeta>,
}

#[derive(Deserialize)]
struct FileMeta {
    id: String,
}

struct CachedToken {
    token: String,
    expires_at: u64,
}

static TOKEN_CACHE: Mutex<Option<CachedToken>> = Mutex::new(None);

fn config_path() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "could not resolve application data directory".to_string())?;
    Ok(base.join(APP_IDENTIFIER).join(CONFIG_FILENAME))
}

fn read_config() -> Result<Option<BackupConfig>, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
    let cfg: BackupConfig = serde_json::from_str(&raw)
        .map_err(|e| format!("invalid drive-backup.json: {}", e))?;
    Ok(Some(cfg))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

async fn get_access_token(sa: &ServiceAccount) -> Result<String, String> {
    {
        let guard = TOKEN_CACHE.lock().unwrap();
        if let Some(cached) = guard.as_ref() {
            if cached.expires_at > now_secs() + 60 {
                return Ok(cached.token.clone());
            }
        }
    }

    let iat = now_secs();
    let exp = iat + 3600;
    let claims = JwtClaims {
        iss: sa.client_email.clone(),
        scope: SCOPE.to_string(),
        aud: TOKEN_URL.to_string(),
        iat,
        exp,
    };
    let mut header = Header::new(Algorithm::RS256);
    header.kid = sa.private_key_id.clone();
    let key = EncodingKey::from_rsa_pem(sa.private_key.as_bytes())
        .map_err(|e| format!("invalid private key: {}", e))?;
    let jwt = encode(&header, &claims, &key)
        .map_err(|e| format!("failed to sign jwt: {}", e))?;

    let client = reqwest::Client::new();
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ])
        .send()
        .await
        .map_err(|e| format!("token request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("token exchange {}: {}", status, body));
    }

    let tr: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("invalid token response: {}", e))?;

    {
        let mut guard = TOKEN_CACHE.lock().unwrap();
        *guard = Some(CachedToken {
            token: tr.access_token.clone(),
            expires_at: now_secs() + tr.expires_in,
        });
    }

    Ok(tr.access_token)
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
    let cfg = match read_config()? {
        Some(c) => c,
        None => return Err("backup not configured".to_string()),
    };

    let token = get_access_token(&cfg.service_account).await?;
    let client = reqwest::Client::new();

    let existing = find_existing_file(&client, &token, &cfg.folder_id).await?;
    match existing {
        Some(id) => update_file(&client, &token, &id, xlsx_bytes).await?,
        None => create_file(&client, &token, &cfg.folder_id, xlsx_bytes).await?,
    }
    Ok(())
}
