use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;

use crate::{
    auth::AuthUser,
    errors::AppError,
    models::{CreateRechnung, UpdateRechnung, BulkActionRequest, RechnungMitStatus},
    repositories::{self, personen::list_by_mandant},
    services::rechnungen::mit_status,
    AppState,
};

#[derive(Deserialize)]
pub struct RechnungenFilter {
    pub person_id: Option<String>,
    /// true = nur archivierte; false/absent = nur aktive
    pub archiviert: Option<bool>,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filter): Query<RechnungenFilter>,
) -> Result<Json<Vec<RechnungMitStatus>>, AppError> {
    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let personen_map: HashMap<String, _> = personen.into_iter().map(|p| (p.id.clone(), p)).collect();

    let include_archiviert = filter.archiviert.unwrap_or(false);
    let rechnungen = repositories::rechnungen::list(
        &state.db,
        &auth.mandant_id,
        filter.person_id.as_deref(),
        include_archiviert,
    )
    .await?;

    let result: Vec<RechnungMitStatus> = rechnungen
        .into_iter()
        .filter_map(|r| {
            let person = personen_map.get(&r.person_id)?;
            Some(mit_status(r, person))
        })
        .collect();

    Ok(Json(result))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateRechnung>,
) -> Result<(StatusCode, Json<RechnungMitStatus>), AppError> {
    if !["arzt", "apotheke", "krankenhaus"].contains(&body.typ.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Rechnungstyp".to_string()));
    }
    if body.betrag <= 0.0 {
        return Err(AppError::BadRequest("Betrag muss positiv sein".to_string()));
    }

    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let person = personen
        .iter()
        .find(|p| p.id == body.person_id)
        .ok_or(AppError::NotFound)?;

    let rechnung = repositories::rechnungen::create(&state.db, &auth.mandant_id, &body).await?;
    let result = mit_status(rechnung, person);

    Ok((StatusCode::CREATED, Json(result)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateRechnung>,
) -> Result<Json<RechnungMitStatus>, AppError> {
    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let personen_map: HashMap<String, _> = personen.into_iter().map(|p| (p.id.clone(), p)).collect();

    let rechnung = repositories::rechnungen::update(&state.db, &id, &auth.mandant_id, &body).await?;
    let person = personen_map.get(&rechnung.person_id).ok_or(AppError::NotFound)?;
    let result = mit_status(rechnung, person);

    Ok(Json(result))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    repositories::rechnungen::delete(&state.db, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn bulk_action(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<BulkActionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let count = repositories::rechnungen::bulk_update(
        &state.db,
        &auth.mandant_id,
        &body.ids,
        &body.action,
    )
    .await?;

    Ok(Json(serde_json::json!({ "updated": count })))
}
