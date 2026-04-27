use anyhow::{Context, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ServiceAccountKey {
    pub client_email: String,
    pub private_key: String,
    pub token_uri: String,
}

#[derive(Serialize)]
struct JwtClaims {
    iss: String,
    scope: String,
    aud: String,
    exp: i64,
    iat: i64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

pub fn parse_key(json: &str) -> Result<ServiceAccountKey> {
    serde_json::from_str(json).context("Service Account JSON ungültig")
}

pub async fn get_access_token(client: &Client, key: &ServiceAccountKey) -> Result<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = JwtClaims {
        iss: key.client_email.clone(),
        scope: "https://www.googleapis.com/auth/drive.file".to_string(),
        aud: key.token_uri.clone(),
        iat: now,
        exp: now + 3600,
    };

    let encoding_key = EncodingKey::from_rsa_pem(key.private_key.as_bytes())
        .context("Private Key im Service Account JSON ist ungültig")?;

    let jwt = encode(&Header::new(Algorithm::RS256), &claims, &encoding_key)
        .context("JWT-Signierung fehlgeschlagen")?;

    let res: TokenResponse = client
        .post(&key.token_uri)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", jwt.as_str()),
        ])
        .send()
        .await
        .context("Token-Anfrage fehlgeschlagen")?
        .error_for_status()
        .context("Token-Anfrage abgelehnt (Service Account nicht berechtigt?)")?
        .json()
        .await
        .context("Token-Antwort ungültig")?;

    Ok(res.access_token)
}

pub async fn upload_file(
    client: &Client,
    access_token: &str,
    folder_id: &str,
    filename: &str,
    data: &[u8],
) -> Result<String> {
    let boundary = "pkv_multipart_boundary_a3f8c1";
    let metadata = serde_json::json!({ "name": filename, "parents": [folder_id] }).to_string();

    let mut body: Vec<u8> = Vec::new();
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(metadata.as_bytes());
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Type: application/pdf\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(data);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let resp: serde_json::Value = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .header("Authorization", format!("Bearer {access_token}"))
        .header(
            "Content-Type",
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .context("Drive-Upload fehlgeschlagen")?
        .error_for_status()
        .context("Drive-Upload abgelehnt (Ordner-Zugriff prüfen)")?
        .json()
        .await
        .context("Drive-Upload-Antwort ungültig")?;

    Ok(resp["id"].as_str().unwrap_or("").to_string())
}

/// Prüft Auth + optionalen Ordnerzugriff, gibt Fehlermeldung oder Ok zurück.
pub async fn test_connection(
    service_account_json: &str,
    folder_id: Option<&str>,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let key = parse_key(service_account_json).map_err(|e| e.to_string())?;
    let token = get_access_token(&client, &key)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(fid) = folder_id {
        if !fid.is_empty() {
            let url = format!(
                "https://www.googleapis.com/drive/v3/files?q='{fid}'+in+parents&pageSize=1"
            );
            client
                .get(&url)
                .header("Authorization", format!("Bearer {token}"))
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| format!("Ordner-Zugriff verweigert: {e}"))?;
        }
    }

    Ok(format!("Authentifizierung erfolgreich ({})", key.client_email))
}
