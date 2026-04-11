use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{auth::AuthUser, errors::AppError, models::{Person, CreatePerson, UpdatePerson}, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Person>>, AppError> {
    let personen = repositories::personen::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(personen))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePerson>,
) -> Result<(StatusCode, Json<Person>), AppError> {
    if !["erwachsener", "kind"].contains(&body.typ.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Personen-Typ".to_string()));
    }
    let person = repositories::personen::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(person)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdatePerson>,
) -> Result<Json<Person>, AppError> {
    if let Some(ref typ) = body.typ {
        if !["erwachsener", "kind"].contains(&typ.as_str()) {
            return Err(AppError::BadRequest("Ungültiger Personen-Typ".to_string()));
        }
    }
    let person = repositories::personen::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(person))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::personen::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
