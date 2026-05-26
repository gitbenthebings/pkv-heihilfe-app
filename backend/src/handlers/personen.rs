use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{auth::AuthUser, errors::AppError, models::{Person, CreatePerson, UpdatePerson, PersonSatzHistorie, CreatePersonSatzHistorie}, repositories, AppState};

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

pub async fn list_satz_historie(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Vec<PersonSatzHistorie>>, AppError> {
    // Mandantenzugehörigkeit prüfen
    repositories::personen::get(&state.db, &id, &auth.mandant_id).await?.ok_or(AppError::NotFound)?;
    let entries = repositories::personen_satz_historie::list_by_person(&state.db, &id).await?;
    Ok(Json(entries))
}

pub async fn create_satz_historie(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<CreatePersonSatzHistorie>,
) -> Result<(StatusCode, Json<PersonSatzHistorie>), AppError> {
    repositories::personen::get(&state.db, &id, &auth.mandant_id).await?.ok_or(AppError::NotFound)?;
    if body.beihilfe_satz < 0 || body.beihilfe_satz > 100 {
        return Err(AppError::BadRequest("Beihilfe-Satz muss zwischen 0 und 100 liegen".to_string()));
    }
    if body.pkv_satz < 0 || body.pkv_satz > 100 {
        return Err(AppError::BadRequest("PKV-Satz muss zwischen 0 und 100 liegen".to_string()));
    }
    let entry = repositories::personen_satz_historie::create(&state.db, &id, &auth.mandant_id, &body).await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

pub async fn delete_satz_historie(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, hid)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    repositories::personen::get(&state.db, &id, &auth.mandant_id).await?.ok_or(AppError::NotFound)?;
    repositories::personen_satz_historie::delete(&state.db, &hid, &id, &auth.mandant_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
