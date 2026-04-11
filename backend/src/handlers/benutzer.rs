use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Deserialize;
use crate::{auth::AuthUser, errors::AppError, models::{Benutzer, CreateBenutzer, UpdateBenutzer}, repositories, AppState};

#[derive(Deserialize)]
pub struct ChangePasswortRequest {
    pub altes_passwort: String,
    pub neues_passwort: String,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Benutzer>>, AppError> {
    let items = repositories::benutzer::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateBenutzer>,
) -> Result<(StatusCode, Json<Benutzer>), AppError> {
    let item = repositories::benutzer::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateBenutzer>,
) -> Result<Json<Benutzer>, AppError> {
    let item = repositories::benutzer::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ChangePasswortRequest>,
) -> Result<StatusCode, AppError> {
    // Verify old password
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT passwort_hash FROM benutzer WHERE id = ? AND mandant_id = ?"
    )
    .bind(&id)
    .bind(&auth.mandant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let valid = bcrypt::verify(&body.altes_passwort, &row.0)
        .map_err(|e| AppError::Internal(e.into()))?;
    if !valid {
        return Err(AppError::Unauthorized);
    }

    repositories::benutzer::change_password(&state.db, &id, &auth.mandant_id, &body.neues_passwort).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    // Prevent deleting yourself
    if id == auth.benutzer_id {
        return Err(AppError::BadRequest("Eigenen Account nicht löschbar".to_string()));
    }
    repositories::benutzer::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
