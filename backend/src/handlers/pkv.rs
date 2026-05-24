use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::{auth::AuthUser, errors::AppError, models::pkv::{CreatePkv, UpdatePkv}, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<crate::models::pkv::Pkv>>, AppError> {
    let items = repositories::pkv::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePkv>,
) -> Result<(StatusCode, Json<crate::models::pkv::Pkv>), AppError> {
    let item = repositories::pkv::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdatePkv>,
) -> Result<Json<crate::models::pkv::Pkv>, AppError> {
    let item = repositories::pkv::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::pkv::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct PersonBody {
    pub person_id: String,
}

pub async fn add_person(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PersonBody>,
) -> Result<Json<crate::models::pkv::Pkv>, AppError> {
    repositories::pkv::get(&state.db, &id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::pkv::add_person(&state.db, &id, &body.person_id).await?;
    let item = repositories::pkv::get(&state.db, &id, &auth.mandant_id).await?.ok_or(AppError::NotFound)?;
    Ok(Json(item))
}

pub async fn remove_person(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, person_id)): Path<(String, String)>,
) -> Result<Json<crate::models::pkv::Pkv>, AppError> {
    repositories::pkv::get(&state.db, &id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::pkv::remove_person(&state.db, &id, &person_id).await?;
    let item = repositories::pkv::get(&state.db, &id, &auth.mandant_id).await?.ok_or(AppError::NotFound)?;
    Ok(Json(item))
}
