use axum::{
    extract::{Path, State},
    Json,
};

use crate::{auth::AuthUser, errors::AppError, models::beihilfe_position::{BeihilfePosition, UpdateBeihilfePosition}, repositories, AppState};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, bescheid_id)): Path<(String, String)>,
) -> Result<Json<Vec<BeihilfePosition>>, AppError> {
    repositories::antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::beihilfe_bescheide::get_by_id_and_antrag(&state.db, &bescheid_id, &antrag_id)
        .await?.ok_or(AppError::NotFound)?;
    let items = repositories::beihilfe_positionen::list_by_bescheid(&state.db, &bescheid_id).await?;
    Ok(Json(items))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, bescheid_id, id)): Path<(String, String, String)>,
    Json(body): Json<UpdateBeihilfePosition>,
) -> Result<Json<BeihilfePosition>, AppError> {
    repositories::antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?.ok_or(AppError::NotFound)?;
    repositories::beihilfe_bescheide::get_by_id_and_antrag(&state.db, &bescheid_id, &antrag_id)
        .await?.ok_or(AppError::NotFound)?;

    let rechnung_id = match &body.rechnung_id {
        Some(v) if v.is_null() => None,
        Some(v) => v.as_str(),
        None => return Err(AppError::BadRequest("rechnung_id erforderlich".to_string())),
    };

    let item = repositories::beihilfe_positionen::set_rechnung(
        &state.db, &id, &bescheid_id, rechnung_id,
    ).await?;
    Ok(Json(item))
}
