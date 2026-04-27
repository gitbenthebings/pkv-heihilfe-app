use crate::{db::Db, errors::AppError, models::anhang::Anhang};
use chrono::Utc;

const SELECT: &str =
    "SELECT id, rechnung_id, dateiname, pfad, groesse, hochgeladen_am FROM rechnung_anhang";

pub async fn list_by_rechnung(db: &Db, rechnung_id: &str) -> Result<Vec<Anhang>, AppError> {
    let items = sqlx::query_as::<_, Anhang>(&format!(
        "{SELECT} WHERE rechnung_id = ? ORDER BY hochgeladen_am ASC"
    ))
    .bind(rechnung_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get_by_id(db: &Db, id: &str, rechnung_id: &str) -> Result<Anhang, AppError> {
    sqlx::query_as::<_, Anhang>(&format!(
        "{SELECT} WHERE id = ? AND rechnung_id = ?"
    ))
    .bind(id)
    .bind(rechnung_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn create(
    db: &Db,
    id: &str,
    mandant_id: &str,
    rechnung_id: &str,
    dateiname: &str,
    pfad: &str,
    groesse: i64,
) -> Result<Anhang, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO rechnung_anhang (id, mandant_id, rechnung_id, dateiname, pfad, groesse, hochgeladen_am)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(mandant_id)
    .bind(rechnung_id)
    .bind(dateiname)
    .bind(pfad)
    .bind(groesse)
    .bind(&now)
    .execute(db)
    .await?;

    get_by_id(db, id, rechnung_id).await
}

pub async fn delete(db: &Db, id: &str, rechnung_id: &str) -> Result<(), AppError> {
    let rows = sqlx::query("DELETE FROM rechnung_anhang WHERE id = ? AND rechnung_id = ?")
        .bind(id)
        .bind(rechnung_id)
        .execute(db)
        .await?
        .rows_affected();

    if rows == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(())
    }
}
