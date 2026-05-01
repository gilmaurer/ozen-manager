// Shared Google Drive auth + config helpers used by drive_backup + drive_upload.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};

const APP_IDENTIFIER: &str = "com.gilmaurer.ozenmanager";
const CONFIG_FILENAME: &str = "drive-backup.json";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Deserialize)]
pub struct DriveConfig {
    pub folder_id: String,
    pub service_account: ServiceAccount,
}

#[derive(Deserialize)]
pub struct ServiceAccount {
    pub client_email: String,
    pub private_key: String,
    pub private_key_id: Option<String>,
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

pub fn read_config() -> Result<Option<DriveConfig>, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
    let cfg: DriveConfig = serde_json::from_str(&raw)
        .map_err(|e| format!("invalid drive-backup.json: {}", e))?;
    Ok(Some(cfg))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub async fn get_access_token(sa: &ServiceAccount) -> Result<String, String> {
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
