use crate::{db::Db, errors::AppError, models::{Correspondent, CreateCorrespondent, UpdateCorrespondent}};

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Correspondent>, AppError> {
    let correspondents = sqlx::query_as::<_, Correspondent>(
        "SELECT id, mandant_id, name, typ FROM correspondent WHERE mandant_id = ? ORDER BY name"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(correspondents)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Correspondent>, AppError> {
    let c = sqlx::query_as::<_, Correspondent>(
        "SELECT id, mandant_id, name, typ FROM correspondent WHERE id = ? AND mandant_id = ?"
    )
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(c)
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreateCorrespondent) -> Result<Correspondent, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO correspondent (id, mandant_id, name, typ) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&input.typ)
    .execute(db)
    .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdateCorrespondent) -> Result<Correspondent, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let typ = input.typ.as_deref().unwrap_or(&existing.typ);
    sqlx::query(
        "UPDATE correspondent SET name = ?, typ = ? WHERE id = ? AND mandant_id = ?"
    )
    .bind(name)
    .bind(typ)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM correspondent WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
