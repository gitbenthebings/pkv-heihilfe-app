use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{auth::AuthUser, errors::AppError, models::person_satz_historie::CreatePersonSatzHistorie, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(person_id): Path<String>,
) -> Result<Json<Vec<crate::models::person_satz_historie::PersonSatzHistorie>>, AppError> {
    // Verify person belongs to mandant
    repositories::personen::get(&state.db, &person_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    let items = repositories::person_satz_historie::list_by_person(&state.db, &person_id).await?;
    Ok(Json(items))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(person_id): Path<String>,
    Json(body): Json<CreatePersonSatzHistorie>,
) -> Result<(StatusCode, Json<crate::models::person_satz_historie::PersonSatzHistorie>), AppError> {
    repositories::personen::get(&state.db, &person_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    let item = repositories::person_satz_historie::create(&state.db, &person_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((person_id, id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::personen::get(&state.db, &person_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::person_satz_historie::delete(&state.db, &id, &person_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
