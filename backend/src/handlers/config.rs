use axum::{extract::State, Json};
use serde::Serialize;

use crate::{repositories, AppState};

#[derive(Serialize)]
pub struct FrontendConfig {
    pub multipage_scan: bool,
    pub paperless_ngx_url: Option<String>,
    pub gdrive_configured: bool,
    pub n8n_webhook_url: Option<String>,
    pub n8n_rechnung_webhook_url: Option<String>,
    pub has_logo: bool,
}

/// Öffentlicher Endpunkt – kein JWT erforderlich.
pub async fn get(State(state): State<AppState>) -> Json<FrontendConfig> {
    let gdrive_configured = repositories::einstellungen::get(
        &state.db,
        "gdrive_service_account_json",
    )
    .await
    .ok()
    .flatten()
    .is_some()
        && repositories::einstellungen::get(&state.db, "gdrive_folder_id")
            .await
            .ok()
            .flatten()
            .is_some();

    let n8n_webhook_url = repositories::einstellungen::get(&state.db, "n8n_webhook_url")
        .await
        .ok()
        .flatten();

    let n8n_rechnung_webhook_url = repositories::einstellungen::get(&state.db, "n8n_rechnung_webhook_url")
        .await
        .ok()
        .flatten();

    let has_logo = super::logo::has_logo(&state.db, &state.uploads_dir).await;

    Json(FrontendConfig {
        multipage_scan: state.multipage_scan,
        paperless_ngx_url: state.paperless_ngx_url.clone(),
        gdrive_configured,
        n8n_webhook_url,
        n8n_rechnung_webhook_url,
        has_logo,
    })
}
