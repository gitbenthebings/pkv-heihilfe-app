use crate::{db::Db, errors::AppError, models::{Benutzer, CreateBenutzer, UpdateBenutzer}};

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Benutzer>, AppError> {
    let items = sqlx::query_as::<_, Benutzer>(
        "SELECT id, mandant_id, name, email FROM benutzer WHERE mandant_id = ? ORDER BY name"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Benutzer>, AppError> {
    let item = sqlx::query_as::<_, Benutzer>(
        "SELECT id, mandant_id, name, email FROM benutzer WHERE id = ? AND mandant_id = ?"
    )
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(item)
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreateBenutzer) -> Result<Benutzer, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let hash = bcrypt::hash(&input.passwort, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;
    sqlx::query(
        "INSERT INTO benutzer (id, mandant_id, name, email, passwort_hash) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&input.email)
    .bind(&hash)
    .execute(db)
    .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdateBenutzer) -> Result<Benutzer, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let email = input.email.as_deref().unwrap_or(&existing.email);
    sqlx::query("UPDATE benutzer SET name = ?, email = ? WHERE id = ? AND mandant_id = ?")
        .bind(name).bind(email).bind(id).bind(mandant_id)
        .execute(db).await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn change_password(db: &Db, id: &str, mandant_id: &str, new_password: &str) -> Result<(), AppError> {
    let hash = bcrypt::hash(new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;
    let result = sqlx::query(
        "UPDATE benutzer SET passwort_hash = ? WHERE id = ? AND mandant_id = ?"
    )
    .bind(&hash).bind(id).bind(mandant_id)
    .execute(db).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM benutzer WHERE id = ? AND mandant_id = ?")
        .bind(id).bind(mandant_id)
        .execute(db).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
