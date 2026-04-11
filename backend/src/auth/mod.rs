use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // benutzer_id
    pub mandant_id: String,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub benutzer_id: String,
    pub mandant_id: String,
}

pub fn create_token(benutzer_id: &str, mandant_id: &str, secret: &str) -> anyhow::Result<String> {
    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_secs() as usize
        + 86400 * 30; // 30 Tage

    let claims = Claims {
        sub: benutzer_id.to_string(),
        mandant_id: mandant_id.to_string(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}

pub fn verify_token(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

/// Axum extractor: liest Authorization-Header und gibt AuthUser zurück
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(AuthError::MissingToken)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidToken)?;

        // JWT_SECRET aus Extensions (wird in main.rs eingetragen)
        let secret = parts
            .extensions
            .get::<JwtSecret>()
            .ok_or(AuthError::InvalidToken)?
            .0
            .clone();

        let claims = verify_token(token, &secret).map_err(|_| AuthError::InvalidToken)?;

        Ok(AuthUser {
            benutzer_id: claims.sub,
            mandant_id: claims.mandant_id,
        })
    }
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let msg = match self {
            AuthError::MissingToken => "Missing authorization token",
            AuthError::InvalidToken => "Invalid or expired token",
        };
        (StatusCode::UNAUTHORIZED, Json(json!({ "error": msg }))).into_response()
    }
}

/// Wrapper damit der Secret im Extensions-Layer liegt
#[derive(Clone)]
pub struct JwtSecret(pub String);
