use axum::{extract::State, Json};
use serde::Deserialize;

use crate::{
    auth::AuthUser,
    errors::AppError,
    repositories,
    services::export::{self, ExportConfig, ExportProvider},
    AppState,
};

#[derive(Deserialize)]
pub struct ExportRequest {
    pub rechnung_ids: Vec<String>,
    #[serde(default = "default_provider")]
    pub provider: ExportProvider,
}

fn default_provider() -> ExportProvider {
    ExportProvider::Local
}

pub async fn run(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ExportRequest>,
) -> Result<Json<export::ExportResult>, AppError> {
    if body.rechnung_ids.is_empty() {
        return Err(AppError::BadRequest("Keine Rechnungen ausgewählt".to_string()));
    }

    let config = match body.provider {
        ExportProvider::Local => ExportConfig::Local,
        ExportProvider::GoogleDrive => {
            let json = repositories::einstellungen::get(&state.db, "gdrive_service_account_json")
                .await?
                .ok_or_else(|| AppError::BadRequest(
                    "Google Drive nicht konfiguriert (Service Account JSON fehlt)".to_string(),
                ))?;
            let folder_id = repositories::einstellungen::get(&state.db, "gdrive_folder_id")
                .await?
                .ok_or_else(|| AppError::BadRequest(
                    "Google Drive nicht konfiguriert (Ordner-ID fehlt)".to_string(),
                ))?;
            ExportConfig::GoogleDrive {
                service_account_json: json,
                folder_id,
            }
        }
    };

    let result = export::export_rechnungen(
        &state.db,
        &state.uploads_dir,
        &state.exports_dir,
        &body.rechnung_ids,
        &auth.mandant_id,
        &config,
    )
    .await?;

    Ok(Json(result))
}
