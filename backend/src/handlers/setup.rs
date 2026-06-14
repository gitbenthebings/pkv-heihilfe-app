use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{auth::create_token, errors::AppError, AppState};

#[derive(Serialize)]
pub struct StatusResponse {
    pub needs_setup: bool,
}

pub async fn status(State(state): State<AppState>) -> Result<Json<StatusResponse>, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mandant")
        .fetch_one(&state.db)
        .await?;

    Ok(Json(StatusResponse { needs_setup: count == 0 }))
}

#[derive(Deserialize)]
pub struct SetupRequest {
    pub mandant_name: String,
    pub name: String,
    pub email: String,
    pub passwort: String,
}

#[derive(Serialize)]
pub struct SetupResponse {
    pub token: String,
}

pub async fn run(
    State(state): State<AppState>,
    Json(body): Json<SetupRequest>,
) -> Result<Json<SetupResponse>, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mandant")
        .fetch_one(&state.db)
        .await?;

    if count > 0 {
        return Err(AppError::Conflict("Bereits eingerichtet".into()));
    }

    let mandant_name = body.mandant_name.trim().to_string();
    let name = body.name.trim().to_string();
    let email = body.email.trim().to_lowercase();
    let passwort = body.passwort;

    if mandant_name.is_empty() || name.is_empty() || email.is_empty() || passwort.is_empty() {
        return Err(AppError::BadRequest("Alle Felder müssen ausgefüllt sein".into()));
    }

    let mandant_id = uuid::Uuid::new_v4().to_string();
    let benutzer_id = uuid::Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO mandant (id, name) VALUES (?, ?)")
        .bind(&mandant_id)
        .bind(&mandant_name)
        .execute(&state.db)
        .await?;

    let hash = bcrypt::hash(&passwort, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;

    sqlx::query(
        "INSERT INTO benutzer (id, mandant_id, name, email, passwort_hash) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&benutzer_id)
    .bind(&mandant_id)
    .bind(&name)
    .bind(&email)
    .bind(&hash)
    .execute(&state.db)
    .await?;

    let token = create_token(&benutzer_id, &mandant_id, &state.jwt_secret)
        .map_err(|e| AppError::Internal(e))?;

    tracing::info!("Ersteinrichtung abgeschlossen: Mandant '{}', Benutzer '{}'", mandant_name, email);

    Ok(Json(SetupResponse { token }))
}
