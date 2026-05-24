use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{auth::AuthUser, errors::AppError, models::antrag::*, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Antrag>>, AppError> {
    let items = repositories::antraege::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Antrag>, AppError> {
    let item = repositories::antraege::get(&state.db, &id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    Ok(Json(item))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateAntrag>,
) -> Result<(StatusCode, Json<Antrag>), AppError> {
    let item = repositories::antraege::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateAntrag>,
) -> Result<Json<Antrag>, AppError> {
    repositories::antraege::get(&state.db, &id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    let item = repositories::antraege::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn set_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<SetAntragStatus>,
) -> Result<Json<Antrag>, AppError> {
    repositories::antraege::get(&state.db, &id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    let item = repositories::antraege::set_status(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::antraege::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Rechnungen ────────────────────────────────────────────────────────────────

pub async fn list_rechnungen(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
) -> Result<Json<Vec<AntragRechnung>>, AppError> {
    repositories::antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    let items = repositories::antraege::list_rechnungen(&state.db, &antrag_id).await?;
    Ok(Json(items))
}

pub async fn add_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
    Json(body): Json<AddRechnung>,
) -> Result<StatusCode, AppError> {
    repositories::antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::antraege::add_rechnung(&state.db, &antrag_id, &body.rechnung_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, rechnung_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::antraege::remove_rechnung(&state.db, &antrag_id, &rechnung_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
