use crate::{db::Db, errors::AppError};
use std::collections::HashMap;

pub async fn get_all(db: &Db) -> Result<HashMap<String, String>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM einstellungen")
        .fetch_all(db)
        .await?;
    Ok(rows.into_iter().collect())
}

pub async fn upsert(db: &Db, key: &str, value: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO einstellungen (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn get(db: &Db, key: &str) -> Result<Option<String>, AppError> {
    let row = sqlx::query_as::<_, (String,)>("SELECT value FROM einstellungen WHERE key = ?")
        .bind(key)
        .fetch_optional(db)
        .await?;
    Ok(row.map(|(v,)| v))
}
