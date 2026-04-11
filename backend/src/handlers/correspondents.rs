use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{auth::AuthUser, errors::AppError, models::{Correspondent, CreateCorrespondent, UpdateCorrespondent}, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Correspondent>>, AppError> {
    let correspondents = repositories::correspondents::list_by_mandant(&state.db, &auth.mandant_id).await?;
    Ok(Json(correspondents))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateCorrespondent>,
) -> Result<(StatusCode, Json<Correspondent>), AppError> {
    if !["arzt", "krankenhaus", "apotheke", "abrechnungsstelle"].contains(&body.typ.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Correspondent-Typ".to_string()));
    }
    let c = repositories::correspondents::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(c)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateCorrespondent>,
) -> Result<Json<Correspondent>, AppError> {
    if let Some(ref typ) = body.typ {
        if !["arzt", "krankenhaus", "apotheke", "abrechnungsstelle"].contains(&typ.as_str()) {
            return Err(AppError::BadRequest("Ungültiger Correspondent-Typ".to_string()));
        }
    }
    let c = repositories::correspondents::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(c))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::correspondents::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
