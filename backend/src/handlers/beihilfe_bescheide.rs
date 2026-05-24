use axum::{
    body::Bytes,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use std::path::PathBuf;
use uuid::Uuid;

use crate::{auth::AuthUser, db::Db, errors::AppError, models::beihilfe_bescheid::BeihilfeBescheid, repositories, AppState};

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024;

async fn require_antrag(state: &AppState, antrag_id: &str, mandant_id: &str) -> Result<(), AppError> {
    repositories::antraege::get(&state.db, antrag_id, mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
) -> Result<Json<Vec<BeihilfeBescheid>>, AppError> {
    require_antrag(&state, &antrag_id, &auth.mandant_id).await?;
    let items = repositories::beihilfe_bescheide::list_by_antrag(&state.db, &antrag_id).await?;
    Ok(Json(items))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, id)): Path<(String, String)>,
) -> Result<Json<BeihilfeBescheid>, AppError> {
    require_antrag(&state, &antrag_id, &auth.mandant_id).await?;
    let item = repositories::beihilfe_bescheide::get_by_id_and_antrag(&state.db, &id, &antrag_id)
        .await?.ok_or(AppError::NotFound)?;
    Ok(Json(item))
}

pub async fn upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<BeihilfeBescheid>), AppError> {
    require_antrag(&state, &antrag_id, &auth.mandant_id).await?;

    let mut dateiname = "bescheid.pdf".to_string();
    let mut file_data: Option<Bytes> = None;
    let mut bescheid_typ = "bescheid".to_string();

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        match field.name() {
            Some("typ") => {
                bescheid_typ = field.text().await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
            Some("file") => {
                dateiname = field.file_name().unwrap_or("bescheid.pdf").to_string();
                let data = field.bytes().await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if data.len() > MAX_UPLOAD_BYTES {
                    return Err(AppError::BadRequest("Datei zu groß (max 20 MB)".to_string()));
                }
                file_data = Some(data);
            }
            _ => {}
        }
    }

    let data = file_data.ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".to_string()))?;

    if !data.starts_with(b"%PDF") {
        return Err(AppError::BadRequest("Nur PDF-Dateien sind erlaubt".to_string()));
    }

    let file_id = Uuid::new_v4().to_string();
    let dir = state.uploads_dir.join("bescheide").join(&antrag_id);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| anyhow::anyhow!("Verzeichnis erstellen: {e}"))?;

    let rel_pfad = format!("bescheide/{}/{}.pdf", antrag_id, file_id);
    let abs_pfad = state.uploads_dir.join(&rel_pfad);
    tokio::fs::write(&abs_pfad, data.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("Datei schreiben: {e}"))?;

    let bescheid = repositories::beihilfe_bescheide::create(
        &state.db,
        &file_id,
        &auth.mandant_id,
        &antrag_id,
        &bescheid_typ,
        &dateiname,
        &rel_pfad,
        data.len() as i64,
    ).await?;

    // n8n asynchron triggern
    let db = state.db.clone();
    let bescheid_id = bescheid.id.clone();
    let abs_pfad_clone = abs_pfad.clone();
    let dateiname_clone = dateiname.clone();
    tokio::spawn(async move {
        trigger_n8n_analyse(db, bescheid_id, abs_pfad_clone, dateiname_clone).await;
    });

    Ok((StatusCode::CREATED, Json(bescheid)))
}

pub async fn serve(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    require_antrag(&state, &antrag_id, &auth.mandant_id).await?;
    let bescheid = repositories::beihilfe_bescheide::get_by_id_and_antrag(&state.db, &id, &antrag_id)
        .await?.ok_or(AppError::NotFound)?;

    let abs_pfad = state.uploads_dir.join(&bescheid.pfad);
    let data = tokio::fs::read(&abs_pfad).await.map_err(|_| AppError::NotFound)?;

    let safe_name = bescheid.dateiname.replace('"', "'");
    let disposition = format!("inline; filename=\"{safe_name}\"");
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).unwrap_or_else(|_| HeaderValue::from_static("inline")),
    );
    Ok((StatusCode::OK, headers, data))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    require_antrag(&state, &antrag_id, &auth.mandant_id).await?;
    let bescheid = repositories::beihilfe_bescheide::delete(&state.db, &id, &antrag_id).await?;
    let abs_pfad = state.uploads_dir.join(&bescheid.pfad);
    tokio::fs::remove_file(&abs_pfad).await.ok();
    Ok(StatusCode::NO_CONTENT)
}

// ── n8n-Trigger ───────────────────────────────────────────────────────────────

async fn trigger_n8n_analyse(db: Db, bescheid_id: String, file_path: PathBuf, dateiname: String) {
    let map = match repositories::einstellungen::get_all(&db).await {
        Ok(m) => m,
        Err(_) => return,
    };
    let n8n_url = match map.get("n8n_webhook_url") {
        Some(url) if !url.trim().is_empty() => url.clone(),
        _ => return,
    };

    if repositories::beihilfe_bescheide::update_analyse_status(&db, &bescheid_id, "wird_analysiert", None)
        .await.is_err() { return; }

    let file_bytes = match tokio::fs::read(&file_path).await {
        Ok(b) => b,
        Err(e) => {
            let msg = format!("Datei nicht lesbar: {e}");
            let _ = repositories::beihilfe_bescheide::update_analyse_status(&db, &bescheid_id, "fehler", Some(&msg)).await;
            return;
        }
    };

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(_) => return,
    };

    let part = match reqwest::multipart::Part::bytes(file_bytes)
        .file_name(dateiname)
        .mime_str("application/pdf")
    {
        Ok(p) => p,
        Err(_) => return,
    };

    let form = reqwest::multipart::Form::new()
        .text("bescheid_id", bescheid_id.clone())
        .part("file", part);

    match client.post(&n8n_url).multipart(form).send().await {
        Ok(resp) if resp.status().is_success() => {
            tracing::info!("n8n Analyse gestartet für Bescheid {}", bescheid_id);
        }
        Ok(resp) => {
            let msg = format!("n8n HTTP {}", resp.status());
            tracing::warn!("n8n Fehler für Bescheid {}: {}", bescheid_id, msg);
            let _ = repositories::beihilfe_bescheide::update_analyse_status(&db, &bescheid_id, "fehler", Some(&msg)).await;
        }
        Err(e) => {
            let msg = format!("n8n Verbindungsfehler: {e}");
            tracing::warn!("n8n Fehler für Bescheid {}: {}", bescheid_id, msg);
            let _ = repositories::beihilfe_bescheide::update_analyse_status(&db, &bescheid_id, "fehler", Some(&msg)).await;
        }
    }
}
