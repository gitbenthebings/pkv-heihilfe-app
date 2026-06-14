use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{auth::AuthUser, errors::AppError, models::beleg::UpdateBeleg, repositories, AppState};

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024; // 20 MB

#[derive(Debug, Deserialize)]
pub struct BelegeFilter {
    pub q: Option<String>,
    pub typ: Option<String>,
    pub datum_von: Option<String>,
    pub datum_bis: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddBelegRef {
    pub beleg_id: String,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<BelegeFilter>,
) -> Result<impl IntoResponse, AppError> {
    let belege = repositories::belege::list(
        &state.db,
        &auth.mandant_id,
        filter.q.as_deref(),
        filter.typ.as_deref(),
        filter.datum_von.as_deref(),
        filter.datum_bis.as_deref(),
    )
    .await?;
    Ok(Json(belege))
}

pub async fn upload(
    State(state): State<AppState>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<(StatusCode, impl IntoResponse), AppError> {
    let beleg_dir = state.uploads_dir.join("belege");
    tokio::fs::create_dir_all(&beleg_dir)
        .await
        .map_err(|e| anyhow::anyhow!("Verzeichnis erstellen: {e}"))?;

    let file_id = Uuid::new_v4().to_string();

    let mut pdf_data: Option<(Vec<u8>, String)> = None;   // (bytes, dateiname)
    let mut thumb_data: Option<Vec<u8>> = None;
    let mut bezeichnung: Option<String> = None;
    let mut typ: Option<String> = None;
    let mut notiz: Option<String> = None;
    let mut datum: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "file" => {
                let dateiname = field.file_name().unwrap_or("beleg.pdf").to_string();
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?
                    .to_vec();
                if data.len() > MAX_UPLOAD_BYTES {
                    return Err(AppError::BadRequest(format!(
                        "Datei zu groß (max {} MB)",
                        MAX_UPLOAD_BYTES / 1024 / 1024
                    )));
                }
                if !data.starts_with(b"%PDF") {
                    return Err(AppError::BadRequest(
                        "Nur PDF-Dateien sind erlaubt".to_string(),
                    ));
                }
                pdf_data = Some((data, dateiname));
            }
            "thumbnail" => {
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?
                    .to_vec();
                if !data.is_empty() {
                    thumb_data = Some(data);
                }
            }
            "bezeichnung" => {
                let v = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !v.is_empty() {
                    bezeichnung = Some(v);
                }
            }
            "typ" => {
                let v = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !v.is_empty() {
                    typ = Some(v);
                }
            }
            "notiz" => {
                let v = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !v.is_empty() {
                    notiz = Some(v);
                }
            }
            "datum" => {
                let v = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !v.is_empty() {
                    datum = Some(v);
                }
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    let (pdf_bytes, dateiname) = pdf_data
        .ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".to_string()))?;

    // PDF speichern
    let rel_pfad = format!("belege/{file_id}.pdf");
    let abs_pfad = state.uploads_dir.join(&rel_pfad);
    tokio::fs::write(&abs_pfad, &pdf_bytes)
        .await
        .map_err(|e| anyhow::anyhow!("PDF schreiben: {e}"))?;

    // Thumbnail optional speichern
    let rel_thumb = if let Some(thumb_bytes) = thumb_data {
        let rel = format!("belege/{file_id}_thumb.jpg");
        let abs = state.uploads_dir.join(&rel);
        tokio::fs::write(&abs, &thumb_bytes)
            .await
            .map_err(|e| anyhow::anyhow!("Thumbnail schreiben: {e}"))?;
        Some(rel)
    } else {
        None
    };

    let beleg = repositories::belege::create(
        &state.db,
        &file_id,
        &auth.mandant_id,
        &dateiname,
        &rel_pfad,
        rel_thumb.as_deref(),
        pdf_bytes.len() as i64,
        bezeichnung.as_deref(),
        typ.as_deref(),
        notiz.as_deref(),
        datum.as_deref(),
    )
    .await?;

    // Thumbnail im Hintergrund generieren (wenn keines mitgesendet wurde)
    if rel_thumb.is_none() {
        let db_clone = state.db.clone();
        let pdf_path_clone = abs_pfad.clone();
        let id_clone = file_id.clone();
        let thumb_abs = state.uploads_dir.join(format!("belege/{file_id}_thumb.jpg"));
        let thumb_rel = format!("belege/{file_id}_thumb.jpg");
        tokio::spawn(async move {
            if crate::services::thumbnail::generate(&pdf_path_clone, &thumb_abs)
                .await
                .is_ok()
            {
                let _ =
                    repositories::belege::update_thumbnail(&db_clone, &id_clone, &thumb_rel)
                        .await;
            }
        });
    }

    // OCR im Hintergrund starten (Semaphore begrenzt auf 2 gleichzeitige Jobs)
    {
        let db_clone = state.db.clone();
        let path_clone = abs_pfad.clone();
        let id_clone = file_id.clone();
        let sem = state.ocr_semaphore.clone();
        tokio::spawn(async move {
            let _permit = sem.acquire().await;
            match crate::services::ocr::extract_text(&path_clone).await {
                Ok(text) => {
                    let _ = repositories::belege::update_ocr(
                        &db_clone,
                        &id_clone,
                        crate::services::ocr::STATUS_DONE,
                        if text.is_empty() { None } else { Some(text.as_str()) },
                    )
                    .await;
                }
                Err(status) => {
                    let s = if status.starts_with(crate::services::ocr::STATUS_UNAVAILABLE) {
                        crate::services::ocr::STATUS_UNAVAILABLE
                    } else {
                        crate::services::ocr::STATUS_FAILED
                    };
                    let _ = repositories::belege::update_ocr(&db_clone, &id_clone, s, None).await;
                }
            }
        });
    }

    Ok((StatusCode::CREATED, Json(beleg)))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let beleg = repositories::belege::get(&state.db, &id, &auth.mandant_id).await?;
    Ok(Json(beleg))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateBeleg>,
) -> Result<impl IntoResponse, AppError> {
    let beleg =
        repositories::belege::update(&state.db, &id, &auth.mandant_id, &input).await?;
    Ok(Json(beleg))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let beleg = repositories::belege::delete(&state.db, &id, &auth.mandant_id).await?;

    // Dateien löschen (best-effort)
    tokio::fs::remove_file(state.uploads_dir.join(&beleg.pfad))
        .await
        .ok();
    if let Some(thumb) = &beleg.thumbnail_pfad {
        tokio::fs::remove_file(state.uploads_dir.join(thumb))
            .await
            .ok();
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn serve_datei(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let beleg = repositories::belege::get(&state.db, &id, &auth.mandant_id).await?;
    let data = tokio::fs::read(state.uploads_dir.join(&beleg.pfad))
        .await
        .map_err(|_| AppError::NotFound)?;

    let safe_name = beleg.dateiname.replace('"', "'");
    let disposition = format!("inline; filename=\"{safe_name}\"");

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)
            .unwrap_or_else(|_| HeaderValue::from_static("inline")),
    );

    Ok((StatusCode::OK, headers, data))
}

pub async fn retrigger_ocr(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let beleg = repositories::belege::get(&state.db, &id, &auth.mandant_id).await?;

    // Status auf NULL zurücksetzen (= läuft)
    repositories::belege::update_ocr(&state.db, &id, "", None).await.ok();
    sqlx::query("UPDATE beleg SET ocr_status = NULL, ocr_text = NULL WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    let db_clone = state.db.clone();
    let path_clone = state.uploads_dir.join(&beleg.pfad);
    let id_clone = id.clone();
    let sem = state.ocr_semaphore.clone();
    tokio::spawn(async move {
        let _permit = sem.acquire().await;
        match crate::services::ocr::extract_text(&path_clone).await {
            Ok(text) => {
                let _ = repositories::belege::update_ocr(
                    &db_clone,
                    &id_clone,
                    crate::services::ocr::STATUS_DONE,
                    if text.is_empty() { None } else { Some(text.as_str()) },
                )
                .await;
            }
            Err(status) => {
                let s = if status.starts_with(crate::services::ocr::STATUS_UNAVAILABLE) {
                    crate::services::ocr::STATUS_UNAVAILABLE
                } else {
                    crate::services::ocr::STATUS_FAILED
                };
                let _ = repositories::belege::update_ocr(&db_clone, &id_clone, s, None).await;
            }
        }
    });

    Ok(StatusCode::ACCEPTED)
}

pub async fn serve_thumbnail(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let beleg = repositories::belege::get(&state.db, &id, &auth.mandant_id).await?;
    let thumb_path = beleg.thumbnail_pfad.ok_or(AppError::NotFound)?;
    let data = tokio::fs::read(state.uploads_dir.join(&thumb_path))
        .await
        .map_err(|_| AppError::NotFound)?;

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/jpeg"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("max-age=3600"));

    Ok((StatusCode::OK, headers, data))
}

// ── Rechnung-Referenzen ───────────────────────────────────────────────────────

pub async fn list_for_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(rechnung_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let items =
        repositories::belege::list_by_rechnung(&state.db, &rechnung_id, &auth.mandant_id)
            .await?;
    Ok(Json(items))
}

pub async fn add_to_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(rechnung_id): Path<String>,
    Json(body): Json<AddBelegRef>,
) -> Result<StatusCode, AppError> {
    repositories::belege::add_to_rechnung(
        &state.db,
        &rechnung_id,
        &body.beleg_id,
        &auth.mandant_id,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_from_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((rechnung_id, beleg_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::belege::remove_from_rechnung(
        &state.db,
        &rechnung_id,
        &beleg_id,
        &auth.mandant_id,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Antrag-Referenzen ─────────────────────────────────────────────────────────

pub async fn list_for_antrag(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let items =
        repositories::belege::list_by_antrag(&state.db, &antrag_id, &auth.mandant_id)
            .await?;
    Ok(Json(items))
}

pub async fn add_to_antrag(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
    Json(body): Json<AddBelegRef>,
) -> Result<StatusCode, AppError> {
    repositories::belege::add_to_antrag(
        &state.db,
        &antrag_id,
        &body.beleg_id,
        &auth.mandant_id,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_from_antrag(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, beleg_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::belege::remove_from_antrag(
        &state.db,
        &antrag_id,
        &beleg_id,
        &auth.mandant_id,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}
