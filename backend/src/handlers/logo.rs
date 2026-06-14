use axum::{
    extract::{Multipart, State},
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};

use crate::{auth::AuthUser, errors::AppError, repositories, AppState};

const MAX_SVG_BYTES: usize = 2 * 1024 * 1024; // 2 MB

/// GET /api/logo – öffentlich, kein JWT erforderlich
pub async fn get(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let path_key = repositories::einstellungen::get(&state.db, "logo_path")
        .await?
        .ok_or(AppError::NotFound)?;

    let data = tokio::fs::read(state.uploads_dir.join(&path_key))
        .await
        .map_err(|_| AppError::NotFound)?;

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, HeaderValue::from_static("image/svg+xml"))],
        data,
    ))
}

/// POST /api/logo – SVG hochladen
pub async fn upload(
    State(state): State<AppState>,
    _auth: AuthUser,
    mut multipart: Multipart,
) -> Result<StatusCode, AppError> {
    let mut svg_data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        if field.name().unwrap_or("") == "file" {
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(e.to_string()))?
                .to_vec();
            if data.len() > MAX_SVG_BYTES {
                return Err(AppError::BadRequest("Datei zu groß (max 2 MB)".to_string()));
            }
            // SVG muss mit < beginnen (nach optionalem BOM/Whitespace) oder mit <?xml
            let trimmed = data.iter().position(|&b| !b.is_ascii_whitespace()).unwrap_or(0);
            if !data[trimmed..].starts_with(b"<") {
                return Err(AppError::BadRequest("Nur SVG-Dateien sind erlaubt".to_string()));
            }
            svg_data = Some(data);
        } else {
            let _ = field.bytes().await;
        }
    }

    let svg_bytes = svg_data
        .ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".to_string()))?;

    tokio::fs::create_dir_all(state.uploads_dir.join("logo"))
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    let path = "logo/logo.svg";
    tokio::fs::write(state.uploads_dir.join(path), &svg_bytes)
        .await
        .map_err(|e| anyhow::anyhow!("Logo schreiben: {e}"))?;

    repositories::einstellungen::upsert(&state.db, "logo_path", path).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/logo
pub async fn delete(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<StatusCode, AppError> {
    let path_opt = repositories::einstellungen::get(&state.db, "logo_path")
        .await?;

    if let Some(path) = path_opt {
        tokio::fs::remove_file(state.uploads_dir.join(&path)).await.ok();
        // Logo-Eintrag entfernen: leeren String setzen reicht nicht, wir setzen auf leeren Wert
        sqlx::query("DELETE FROM einstellungen WHERE key = 'logo_path'")
            .execute(&state.db)
            .await?;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn has_logo(db: &crate::db::Db, uploads_dir: &std::path::Path) -> bool {
    let Ok(Some(path)) = repositories::einstellungen::get(db, "logo_path").await else {
        return false;
    };
    uploads_dir.join(&path).exists()
}
