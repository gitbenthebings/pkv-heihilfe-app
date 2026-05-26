use crate::{db::Db, errors::AppError, models::{Pkv, CreatePkv, UpdatePkv}};
use crate::models::pkv::PkvRow;
use chrono::Utc;
use uuid::Uuid;

async fn list_personen_ids(db: &Db, pkv_id: &str) -> Result<Vec<String>, AppError> {
    let ids = sqlx::query_scalar::<_, String>(
        "SELECT person_id FROM pkv_personen WHERE pkv_id = ? ORDER BY person_id"
    )
    .bind(pkv_id)
    .fetch_all(db)
    .await?;
    Ok(ids)
}

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Pkv>, AppError> {
    let rows = sqlx::query_as::<_, PkvRow>(
        "SELECT id, mandant_id, name, erstellt_am FROM pkv WHERE mandant_id = ? ORDER BY name"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;

    let mut result = Vec::new();
    for row in rows {
        let personen_ids = list_personen_ids(db, &row.id).await?;
        result.push(Pkv::from_row(row, personen_ids));
    }
    Ok(result)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Pkv>, AppError> {
    let row = sqlx::query_as::<_, PkvRow>(
        "SELECT id, mandant_id, name, erstellt_am FROM pkv WHERE id = ? AND mandant_id = ?"
    )
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;

    let Some(row) = row else { return Ok(None) };
    let personen_ids = list_personen_ids(db, &row.id).await?;
    Ok(Some(Pkv::from_row(row, personen_ids)))
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreatePkv) -> Result<Pkv, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO pkv (id, mandant_id, name, erstellt_am) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&now)
    .execute(db)
    .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdatePkv) -> Result<Pkv, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    sqlx::query("UPDATE pkv SET name = ? WHERE id = ? AND mandant_id = ?")
        .bind(name)
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM pkv WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn add_person(db: &Db, pkv_id: &str, person_id: &str, mandant_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO pkv_personen (pkv_id, person_id, mandant_id) VALUES (?, ?, ?)"
    )
    .bind(pkv_id)
    .bind(person_id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_person(db: &Db, pkv_id: &str, person_id: &str, mandant_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "DELETE FROM pkv_personen WHERE pkv_id = ? AND person_id = ? AND mandant_id = ?"
    )
    .bind(pkv_id)
    .bind(person_id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    Ok(())
}
