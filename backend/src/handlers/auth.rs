use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use crate::{auth::create_token, errors::AppError, AppState};

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(sqlx::FromRow)]
struct BenutzerRow {
    id: String,
    mandant_id: String,
    passwort_hash: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let user = sqlx::query_as::<_, BenutzerRow>(
        "SELECT id, mandant_id, passwort_hash FROM benutzer WHERE email = ?"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let valid = bcrypt::verify(&body.password, &user.passwort_hash)
        .map_err(|e| AppError::Internal(e.into()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(&user.id, &user.mandant_id, &state.jwt_secret)
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(LoginResponse { token }))
}
