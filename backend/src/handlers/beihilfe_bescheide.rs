use axum::{
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

#[derive(sqlx::FromRow)]
struct RechnungRow {
    id: String,
    betrag: i64,
}

use crate::{
    auth::AuthUser,
    errors::AppError,
    models::beihilfe_bescheid::{
        BeihilfeBescheid, BescheidPosition,
        CreateBeihilfeBescheid, UpdateBeihilfeBescheid,
        CreateBescheidPosition, UpdateBescheidPosition,
    },
    models::bescheid_anhang::BescheidAnhang,
    repositories,
    services,
    AppState,
};

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
) -> Result<Json<Vec<BeihilfeBescheid>>, AppError> {
    repositories::beihilfe_antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let items = repositories::beihilfe_bescheide::list_by_antrag(&state.db, &antrag_id, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
    Json(body): Json<CreateBeihilfeBescheid>,
) -> Result<(StatusCode, Json<BeihilfeBescheid>), AppError> {
    repositories::beihilfe_antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let item = repositories::beihilfe_bescheide::create(&state.db, &auth.mandant_id, &antrag_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id)): Path<(String, String)>,
    Json(body): Json<UpdateBeihilfeBescheid>,
) -> Result<Json<BeihilfeBescheid>, AppError> {
    let item = repositories::beihilfe_bescheide::update(&state.db, &bescheid_id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, bescheid_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::beihilfe_bescheide::get(&state.db, &bescheid_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let rechnung_ids = repositories::beihilfe_bescheide::list_rechnung_ids_by_bescheid(&state.db, &bescheid_id).await?;
    repositories::beihilfe_bescheide::delete(&state.db, &bescheid_id, &auth.mandant_id).await?;
    for rid in rechnung_ids {
        services::beihilfe_bescheide::sync_erstattet(&rid, &antrag_id, &auth.mandant_id, &state.db).await.ok();
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_positionen(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path((_antrag_id, bescheid_id)): Path<(String, String)>,
) -> Result<Json<Vec<BescheidPosition>>, AppError> {
    let items = repositories::beihilfe_bescheide::list_positionen(&state.db, &bescheid_id).await?;
    Ok(Json(items))
}

pub async fn create_position(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, bescheid_id)): Path<(String, String)>,
    Json(body): Json<CreateBescheidPosition>,
) -> Result<(StatusCode, Json<BescheidPosition>), AppError> {
    let rechnung_id = body.rechnung_id.clone();
    let item = repositories::beihilfe_bescheide::create_position(&state.db, &bescheid_id, &body).await?;
    services::beihilfe_bescheide::sync_erstattet(&rechnung_id, &antrag_id, &auth.mandant_id, &state.db).await.ok();
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update_position(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, _bescheid_id, position_id)): Path<(String, String, String)>,
    Json(body): Json<UpdateBescheidPosition>,
) -> Result<Json<BescheidPosition>, AppError> {
    let item = repositories::beihilfe_bescheide::update_position(&state.db, &position_id, &body).await?;
    services::beihilfe_bescheide::sync_erstattet(&item.rechnung_id, &antrag_id, &auth.mandant_id, &state.db).await.ok();
    Ok(Json(item))
}

pub async fn delete_position(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, _bescheid_id, position_id)): Path<(String, String, String)>,
) -> Result<StatusCode, AppError> {
    let pos = repositories::beihilfe_bescheide::get_position(&state.db, &position_id)
        .await?
        .ok_or(AppError::NotFound)?;
    repositories::beihilfe_bescheide::delete_position(&state.db, &position_id).await?;
    services::beihilfe_bescheide::sync_erstattet(&pos.rechnung_id, &antrag_id, &auth.mandant_id, &state.db).await.ok();
    Ok(StatusCode::NO_CONTENT)
}

// ── Bescheid-Anhänge ──────────────────────────────────────────────────────────

async fn require_bescheid(state: &AppState, bescheid_id: &str, mandant_id: &str) -> Result<(), AppError> {
    repositories::beihilfe_bescheide::get(&state.db, bescheid_id, mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

pub async fn upload_anhang(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id)): Path<(String, String)>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<BescheidAnhang>), AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".to_string()))?;

    let dateiname = field.file_name().unwrap_or("bescheid.pdf").to_string();
    let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;

    if data.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::BadRequest(format!("Datei zu groß (max {} MB)", MAX_UPLOAD_BYTES / 1024 / 1024)));
    }
    if !data.starts_with(b"%PDF") {
        return Err(AppError::BadRequest("Nur PDF-Dateien sind erlaubt".to_string()));
    }

    let dir = state.uploads_dir.join("bescheide").join(&bescheid_id);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| anyhow::anyhow!("Verzeichnis erstellen: {e}"))?;

    let file_id = Uuid::new_v4().to_string();
    let rel_pfad = format!("bescheide/{}/{}.pdf", bescheid_id, file_id);
    let abs_pfad = state.uploads_dir.join(&rel_pfad);

    tokio::fs::write(&abs_pfad, &data)
        .await
        .map_err(|e| anyhow::anyhow!("Datei schreiben: {e}"))?;

    let anhang = repositories::bescheid_anhaenge::create(
        &state.db, &file_id, &auth.mandant_id, &bescheid_id, &dateiname, &rel_pfad, data.len() as i64,
    ).await?;

    // OCR im Hintergrund starten
    {
        let db_clone = state.db.clone();
        let path_clone = abs_pfad.clone();
        let id_clone = file_id.clone();
        let bid_clone = bescheid_id.clone();
        let sem = state.ocr_semaphore.clone();
        tokio::spawn(async move {
            let _permit = sem.acquire().await;
            match crate::services::ocr::extract_text(&path_clone).await {
                Ok(text) => {
                    let _ = repositories::bescheid_anhaenge::update_ocr(
                        &db_clone, &id_clone, &bid_clone,
                        crate::services::ocr::STATUS_DONE,
                        if text.is_empty() { None } else { Some(text.as_str()) },
                    ).await;
                }
                Err(status) => {
                    let s = if status.starts_with(crate::services::ocr::STATUS_UNAVAILABLE) {
                        crate::services::ocr::STATUS_UNAVAILABLE
                    } else {
                        crate::services::ocr::STATUS_FAILED
                    };
                    let _ = repositories::bescheid_anhaenge::update_ocr(
                        &db_clone, &id_clone, &bid_clone, s, None,
                    ).await;
                }
            }
        });
    }

    Ok((StatusCode::CREATED, Json(anhang)))
}

pub async fn list_anhaenge(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id)): Path<(String, String)>,
) -> Result<Json<Vec<BescheidAnhang>>, AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;
    let items = repositories::bescheid_anhaenge::list_by_bescheid(&state.db, &bescheid_id).await?;
    Ok(Json(items))
}

pub async fn serve_anhang(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id, anhang_id)): Path<(String, String, String)>,
) -> Result<impl IntoResponse, AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;

    let anhang = repositories::bescheid_anhaenge::get_by_id(&state.db, &anhang_id, &bescheid_id).await?;
    let abs_pfad = state.uploads_dir.join(&anhang.pfad);
    let data = tokio::fs::read(&abs_pfad).await.map_err(|_| AppError::NotFound)?;

    let safe_name = anhang.dateiname.replace('"', "'");
    let disposition = format!("inline; filename=\"{safe_name}\"");

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).unwrap_or_else(|_| HeaderValue::from_static("inline")),
    );

    Ok((StatusCode::OK, headers, data))
}

pub async fn delete_anhang(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id, anhang_id)): Path<(String, String, String)>,
) -> Result<StatusCode, AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;

    let anhang = repositories::bescheid_anhaenge::get_by_id(&state.db, &anhang_id, &bescheid_id).await?;
    let abs_pfad = state.uploads_dir.join(&anhang.pfad);
    tokio::fs::remove_file(&abs_pfad).await.ok();

    repositories::bescheid_anhaenge::delete(&state.db, &anhang_id, &bescheid_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ocr_anhang(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((_antrag_id, bescheid_id, anhang_id)): Path<(String, String, String)>,
) -> Result<StatusCode, AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;
    let anhang = repositories::bescheid_anhaenge::get_by_id(&state.db, &anhang_id, &bescheid_id).await?;

    // Status zurücksetzen
    sqlx::query("UPDATE bescheid_anhang SET ocr_status = NULL, ocr_text = NULL WHERE id = ? AND bescheid_id = ?")
        .bind(&anhang_id)
        .bind(&bescheid_id)
        .execute(&state.db)
        .await?;

    let db_clone = state.db.clone();
    let path_clone = state.uploads_dir.join(&anhang.pfad);
    let id_clone = anhang_id.clone();
    let bid_clone = bescheid_id.clone();
    let sem = state.ocr_semaphore.clone();
    tokio::spawn(async move {
        let _permit = sem.acquire().await;
        match crate::services::ocr::extract_text(&path_clone).await {
            Ok(text) => {
                let _ = repositories::bescheid_anhaenge::update_ocr(
                    &db_clone, &id_clone, &bid_clone,
                    crate::services::ocr::STATUS_DONE,
                    if text.is_empty() { None } else { Some(text.as_str()) },
                ).await;
            }
            Err(status) => {
                let s = if status.starts_with(crate::services::ocr::STATUS_UNAVAILABLE) {
                    crate::services::ocr::STATUS_UNAVAILABLE
                } else {
                    crate::services::ocr::STATUS_FAILED
                };
                let _ = repositories::bescheid_anhaenge::update_ocr(
                    &db_clone, &id_clone, &bid_clone, s, None,
                ).await;
            }
        }
    });

    Ok(StatusCode::ACCEPTED)
}

pub async fn vorschlag_anhang(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, bescheid_id, anhang_id)): Path<(String, String, String)>,
) -> Result<Json<services::bescheid_ocr::BescheidVorschlag>, AppError> {
    require_bescheid(&state, &bescheid_id, &auth.mandant_id).await?;
    let anhang = repositories::bescheid_anhaenge::get_by_id(&state.db, &anhang_id, &bescheid_id).await?;

    let ocr_text = anhang.ocr_text.unwrap_or_default();
    if ocr_text.is_empty() {
        return Ok(Json(services::bescheid_ocr::BescheidVorschlag {
            bescheid_datum: None,
            aktenzeichen: None,
            erstattungsbetrag_gesamt: None,
            positionen: vec![],
        }));
    }

    // Rechnungen dieses Antrags für Matching laden
    let rows = sqlx::query_as::<_, RechnungRow>(
        "SELECT r.id, r.betrag FROM rechnung r
         JOIN beihilfe_antrag_rechnung ar ON ar.rechnung_id = r.id
         WHERE ar.antrag_id = ?",
    )
    .bind(&antrag_id)
    .fetch_all(&state.db)
    .await?;

    let refs: Vec<services::bescheid_ocr::RechnungRef> = rows
        .into_iter()
        .map(|r| services::bescheid_ocr::RechnungRef {
            id: r.id,
            betrag_cent: r.betrag,
        })
        .collect();

    let vorschlag = services::bescheid_ocr::parse(&ocr_text, &refs);
    Ok(Json(vorschlag))
}
