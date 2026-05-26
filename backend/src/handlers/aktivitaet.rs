use axum::{extract::{Path, State}, Json};

use crate::{auth::AuthUser, errors::AppError, models::aktivitaet::RechnungAktivitaet, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(rechnung_id): Path<String>,
) -> Result<Json<Vec<RechnungAktivitaet>>, AppError> {
    repositories::rechnungen::get(&state.db, &rechnung_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let items = repositories::aktivitaet::list_by_rechnung(&state.db, &rechnung_id, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn list_all(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<RechnungAktivitaet>>, AppError> {
    let items = repositories::aktivitaet::list_all(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}
