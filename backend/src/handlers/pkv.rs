use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{
    auth::AuthUser,
    errors::AppError,
    models::{AddPersonToPkv, CreatePkv, Pkv, UpdatePkv},
    repositories,
    AppState,
};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Pkv>>, AppError> {
    let items = repositories::pkv::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePkv>,
) -> Result<(StatusCode, Json<Pkv>), AppError> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".to_string()));
    }
    let item = repositories::pkv::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdatePkv>,
) -> Result<Json<Pkv>, AppError> {
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

pub async fn add_person(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<AddPersonToPkv>,
) -> Result<Json<Pkv>, AppError> {
    repositories::pkv::get(&state.db, &id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    repositories::personen::get(&state.db, &body.person_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    repositories::pkv::add_person(&state.db, &id, &body.person_id, &auth.mandant_id).await?;
    let item = repositories::pkv::get(&state.db, &id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(item))
}

pub async fn remove_person(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, person_id)): Path<(String, String)>,
) -> Result<Json<Pkv>, AppError> {
    repositories::pkv::remove_person(&state.db, &id, &person_id, &auth.mandant_id).await?;
    let item = repositories::pkv::get(&state.db, &id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(item))
}
