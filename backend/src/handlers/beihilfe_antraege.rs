use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::{
    auth::AuthUser,
    errors::AppError,
    models::beihilfe_antrag::{
        BeihilfeAntrag, AntragRechnung,
        CreateBeihilfeAntrag, UpdateBeihilfeAntrag, SetAntragStatus, AddRechnungToAntrag,
    },
    repositories,
    services,
    AppState,
};

#[derive(Deserialize)]
pub struct AntragFilter {
    pub status: Option<String>,
    pub rechnung_id: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<AntragFilter>,
) -> Result<Json<Vec<BeihilfeAntrag>>, AppError> {
    let items = if let Some(ref rid) = filter.rechnung_id {
        repositories::beihilfe_antraege::list_antraege_fuer_rechnung(
            &state.db,
            rid,
            &auth.mandant_id,
        ).await?
    } else {
        repositories::beihilfe_antraege::list(
            &state.db,
            &auth.mandant_id,
            filter.status.as_deref(),
        ).await?
    };
    Ok(Json(items))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<BeihilfeAntrag>, AppError> {
    let item = repositories::beihilfe_antraege::get(&state.db, &id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(item))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateBeihilfeAntrag>,
) -> Result<(StatusCode, Json<BeihilfeAntrag>), AppError> {
    let item = repositories::beihilfe_antraege::create(&state.db, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateBeihilfeAntrag>,
) -> Result<Json<BeihilfeAntrag>, AppError> {
    let item = repositories::beihilfe_antraege::update(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok(Json(item))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::beihilfe_antraege::get(&state.db, &id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    repositories::beihilfe_antraege::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn set_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<SetAntragStatus>,
) -> Result<Json<BeihilfeAntrag>, AppError> {
    let item = services::beihilfe_antraege::set_status_transition(
        &state.db,
        &id,
        &auth.mandant_id,
        &body.status,
        body.versendet_am.as_deref(),
        &auth.benutzer_id,
    ).await?;
    Ok(Json(item))
}

pub async fn add_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
    Json(body): Json<AddRechnungToAntrag>,
) -> Result<(StatusCode, Json<AntragRechnung>), AppError> {
    let antrag = repositories::beihilfe_antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Rechnung muss zum Mandanten gehören
    let rechnung = repositories::rechnungen::get(&state.db, &body.rechnung_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Wenn die Beihilfestelle des Antrags eine Personenbeschränkung hat,
    // muss die Person der Rechnung in der erlaubten Liste sein
    if let Some(ref bh_id) = antrag.beihilfestelle_id {
        let erlaubte = repositories::beihilfestellen::list_personen_ids(&state.db, bh_id).await?;
        if !erlaubte.is_empty() && !erlaubte.contains(&rechnung.person_id) {
            return Err(AppError::BadRequest(
                "Diese Person ist für die Beihilfestelle des Antrags nicht berechtigt.".to_string()
            ));
        }
    }

    let item = repositories::beihilfe_antraege::add_rechnung(
        &state.db,
        &antrag_id,
        &body.rechnung_id,
        body.widerspruch.unwrap_or(false),
    ).await?;

    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn remove_rechnung(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((antrag_id, rechnung_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::beihilfe_antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    repositories::beihilfe_antraege::remove_rechnung(&state.db, &antrag_id, &rechnung_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_rechnungen(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(antrag_id): Path<String>,
) -> Result<Json<Vec<AntragRechnung>>, AppError> {
    repositories::beihilfe_antraege::get(&state.db, &antrag_id, &auth.mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let items = repositories::beihilfe_antraege::list_rechnungen(&state.db, &antrag_id).await?;
    Ok(Json(items))
}
