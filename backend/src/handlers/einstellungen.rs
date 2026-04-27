use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{auth::AuthUser, errors::AppError, repositories, services::gdrive, AppState};

#[derive(Serialize)]
pub struct EinstellungenResponse {
    pub paperless_ngx_url: Option<String>,
    pub paperless_ngx_token: Option<String>,
    pub mandant_name: Option<String>,
    /// Nur ob konfiguriert – der Private Key wird nie zurückgegeben
    pub gdrive_service_account_configured: bool,
    pub gdrive_folder_id: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateEinstellungen {
    pub paperless_ngx_url: Option<String>,
    pub paperless_ngx_token: Option<String>,
    pub mandant_name: Option<String>,
    pub gdrive_service_account_json: Option<String>,
    pub gdrive_folder_id: Option<String>,
}

#[derive(Deserialize)]
pub struct PaperlessTestRequest {
    pub url: String,
    pub token: String,
}

#[derive(Deserialize)]
pub struct GdriveTestRequest {
    pub service_account_json: String,
    pub folder_id: Option<String>,
}

#[derive(Serialize)]
pub struct TestResponse {
    pub ok: bool,
    pub message: String,
}

pub async fn get(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<EinstellungenResponse>, AppError> {
    let map = repositories::einstellungen::get_all(&state.db).await?;
    Ok(Json(EinstellungenResponse {
        paperless_ngx_url: map
            .get("paperless_ngx_url")
            .cloned()
            .or_else(|| state.paperless_ngx_url.clone()),
        paperless_ngx_token: map
            .get("paperless_ngx_token")
            .cloned()
            .or_else(|| state.paperless_ngx_token.clone()),
        mandant_name: map.get("mandant_name").cloned(),
        gdrive_service_account_configured: map.contains_key("gdrive_service_account_json"),
        gdrive_folder_id: map.get("gdrive_folder_id").cloned(),
    }))
}

pub async fn update(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<UpdateEinstellungen>,
) -> Result<Json<serde_json::Value>, AppError> {
    if let Some(v) = &body.paperless_ngx_url {
        repositories::einstellungen::upsert(&state.db, "paperless_ngx_url", v).await?;
    }
    if let Some(v) = &body.paperless_ngx_token {
        repositories::einstellungen::upsert(&state.db, "paperless_ngx_token", v).await?;
    }
    if let Some(v) = &body.mandant_name {
        repositories::einstellungen::upsert(&state.db, "mandant_name", v).await?;
    }
    if let Some(v) = &body.gdrive_service_account_json {
        if !v.is_empty() {
            // Validieren bevor speichern
            gdrive::parse_key(v)
                .map_err(|e| AppError::BadRequest(format!("Service Account JSON ungültig: {e}")))?;
            repositories::einstellungen::upsert(&state.db, "gdrive_service_account_json", v)
                .await?;
        }
    }
    if let Some(v) = &body.gdrive_folder_id {
        repositories::einstellungen::upsert(&state.db, "gdrive_folder_id", v).await?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn paperless_test(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<PaperlessTestRequest>,
) -> Result<Json<TestResponse>, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;

    let url = format!("{}/api/documents/?page_size=1", body.url.trim_end_matches('/'));
    let response = match client
        .get(&url)
        .header("Authorization", format!("Token {}", body.token))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => {
            TestResponse { ok: true, message: "Verbindung erfolgreich".to_string() }
        }
        Ok(r) => TestResponse {
            ok: false,
            message: format!("HTTP {}: Zugriff verweigert oder Token ungültig", r.status()),
        },
        Err(e) => TestResponse { ok: false, message: format!("Verbindungsfehler: {e}") },
    };

    Ok(Json(response))
}

pub async fn gdrive_test(
    State(_state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<GdriveTestRequest>,
) -> Result<Json<TestResponse>, AppError> {
    let response = match gdrive::test_connection(
        &body.service_account_json,
        body.folder_id.as_deref(),
    )
    .await
    {
        Ok(msg) => TestResponse { ok: true, message: msg },
        Err(e) => TestResponse { ok: false, message: e },
    };
    Ok(Json(response))
}
