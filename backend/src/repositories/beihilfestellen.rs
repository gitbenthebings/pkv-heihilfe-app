use crate::{db::Db, errors::AppError, models::{Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle}};

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Beihilfestelle>, AppError> {
    let items = sqlx::query_as::<_, Beihilfestelle>(
        "SELECT id, mandant_id, name, dienstherr_typ FROM beihilfestelle WHERE mandant_id = ? ORDER BY name"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Beihilfestelle>, AppError> {
    let item = sqlx::query_as::<_, Beihilfestelle>(
        "SELECT id, mandant_id, name, dienstherr_typ FROM beihilfestelle WHERE id = ? AND mandant_id = ?"
    )
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(item)
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreateBeihilfestelle) -> Result<Beihilfestelle, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO beihilfestelle (id, mandant_id, name, dienstherr_typ) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&input.dienstherr_typ)
    .execute(db)
    .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdateBeihilfestelle) -> Result<Beihilfestelle, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let dienstherr_typ = input.dienstherr_typ.as_deref().unwrap_or(&existing.dienstherr_typ);
    sqlx::query(
        "UPDATE beihilfestelle SET name = ?, dienstherr_typ = ? WHERE id = ? AND mandant_id = ?"
    )
    .bind(name)
    .bind(dienstherr_typ)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM beihilfestelle WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
