use axum::{
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::{auth::AuthUser, errors::AppError, models::anhang::Anhang, repositories, AppState};
use serde_json::json;

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024; // 20 MB

/// Prüft, dass die Rechnung zum Mandanten gehört
async fn require_rechnung(
    state: &AppState,
    rechnung_id: &str,
    mandant_id: &str,
) -> Result<(), AppError> {
    repositories::rechnungen::get(&state.db, rechnung_id, mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

pub async fn upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(rechnung_id): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Anhang>), AppError> {
    require_rechnung(&state, &rechnung_id, &auth.mandant_id).await?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".to_string()))?;

    let dateiname = field.file_name().unwrap_or("scan.pdf").to_string();

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    if data.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::BadRequest(format!(
            "Datei zu groß (max {} MB)",
            MAX_UPLOAD_BYTES / 1024 / 1024
        )));
    }

    // Magic-Bytes-Prüfung: muss ein PDF sein
    if !data.starts_with(b"%PDF") {
        return Err(AppError::BadRequest(
            "Nur PDF-Dateien sind erlaubt".to_string(),
        ));
    }

    // Verzeichnis anlegen
    let dir = state.uploads_dir.join(&rechnung_id);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| anyhow::anyhow!("Verzeichnis erstellen: {e}"))?;

    // Datei speichern
    let file_id = Uuid::new_v4().to_string();
    let rel_pfad = format!("{}/{}.pdf", rechnung_id, file_id);
    let abs_pfad = state.uploads_dir.join(&rel_pfad);

    tokio::fs::write(&abs_pfad, &data)
        .await
        .map_err(|e| anyhow::anyhow!("Datei schreiben: {e}"))?;

    let anhang = repositories::anhaenge::create(
        &state.db,
        &file_id,
        &auth.mandant_id,
        &rechnung_id,
        &dateiname,
        &rel_pfad,
        data.len() as i64,
    )
    .await?;

    let payload = json!({"dateiname": dateiname}).to_string();
    repositories::aktivitaet::insert(&state.db, &auth.mandant_id, &rechnung_id, Some(&auth.benutzer_id), "anhang_hochgeladen", &payload).await.ok();

    Ok((StatusCode::CREATED, Json(anhang)))
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(rechnung_id): Path<String>,
) -> Result<Json<Vec<Anhang>>, AppError> {
    require_rechnung(&state, &rechnung_id, &auth.mandant_id).await?;
    let items = repositories::anhaenge::list_by_rechnung(&state.db, &rechnung_id).await?;
    Ok(Json(items))
}

pub async fn serve(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((rechnung_id, anhang_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    require_rechnung(&state, &rechnung_id, &auth.mandant_id).await?;

    let anhang =
        repositories::anhaenge::get_by_id(&state.db, &anhang_id, &rechnung_id).await?;
    let abs_pfad = state.uploads_dir.join(&anhang.pfad);

    let data = tokio::fs::read(&abs_pfad)
        .await
        .map_err(|_| AppError::NotFound)?;

    let safe_name = anhang.dateiname.replace('"', "'");
    let disposition = format!("inline; filename=\"{safe_name}\"");

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/pdf"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)
            .unwrap_or_else(|_| HeaderValue::from_static("inline")),
    );

    Ok((StatusCode::OK, headers, data))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((rechnung_id, anhang_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    require_rechnung(&state, &rechnung_id, &auth.mandant_id).await?;

    let anhang =
        repositories::anhaenge::get_by_id(&state.db, &anhang_id, &rechnung_id).await?;

    // Datei löschen (best-effort, kein Fehler wenn Datei fehlt)
    let abs_pfad = state.uploads_dir.join(&anhang.pfad);
    tokio::fs::remove_file(&abs_pfad).await.ok();

    repositories::anhaenge::delete(&state.db, &anhang_id, &rechnung_id).await?;

    let payload = json!({"dateiname": anhang.dateiname}).to_string();
    repositories::aktivitaet::insert(&state.db, &auth.mandant_id, &rechnung_id, Some(&auth.benutzer_id), "anhang_geloescht", &payload).await.ok();

    Ok(StatusCode::NO_CONTENT)
}
