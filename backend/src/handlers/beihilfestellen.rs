use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{auth::AuthUser, errors::AppError, models::{Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle}, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Beihilfestelle>>, AppError> {
    let items = repositories::beihilfestellen::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateBeihilfestelle>,
) -> Result<(StatusCode, Json<Beihilfestelle>), AppError> {
    if !["bund", "land", "kommune"].contains(&body.dienstherr_typ.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Dienstherr-Typ".to_string()));
    }
    let item = repositories::beihilfestellen::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateBeihilfestelle>,
) -> Result<Json<Beihilfestelle>, AppError> {
    if let Some(ref typ) = body.dienstherr_typ {
        if !["bund", "land", "kommune"].contains(&typ.as_str()) {
            return Err(AppError::BadRequest("Ungültiger Dienstherr-Typ".to_string()));
        }
    }
    let item = repositories::beihilfestellen::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::beihilfestellen::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
