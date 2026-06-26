use crate::{db::Db, errors::AppError, models::bescheid_anhang::BescheidAnhang};
use chrono::Utc;

const SELECT: &str =
    "SELECT id, bescheid_id, dateiname, pfad, groesse, hochgeladen_am, ocr_status, ocr_text FROM bescheid_anhang";

pub async fn list_by_bescheid(db: &Db, bescheid_id: &str) -> Result<Vec<BescheidAnhang>, AppError> {
    let items = sqlx::query_as::<_, BescheidAnhang>(&format!(
        "{SELECT} WHERE bescheid_id = ? ORDER BY hochgeladen_am ASC"
    ))
    .bind(bescheid_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get_by_id(db: &Db, id: &str, bescheid_id: &str) -> Result<BescheidAnhang, AppError> {
    sqlx::query_as::<_, BescheidAnhang>(&format!(
        "{SELECT} WHERE id = ? AND bescheid_id = ?"
    ))
    .bind(id)
    .bind(bescheid_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn create(
    db: &Db,
    id: &str,
    mandant_id: &str,
    bescheid_id: &str,
    dateiname: &str,
    pfad: &str,
    groesse: i64,
) -> Result<BescheidAnhang, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO bescheid_anhang (id, mandant_id, bescheid_id, dateiname, pfad, groesse, hochgeladen_am)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(mandant_id)
    .bind(bescheid_id)
    .bind(dateiname)
    .bind(pfad)
    .bind(groesse)
    .bind(&now)
    .execute(db)
    .await?;

    get_by_id(db, id, bescheid_id).await
}

pub async fn update_ocr(
    db: &Db,
    id: &str,
    bescheid_id: &str,
    status: &str,
    text: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE bescheid_anhang SET ocr_status = ?, ocr_text = ? WHERE id = ? AND bescheid_id = ?",
    )
    .bind(status)
    .bind(text)
    .bind(id)
    .bind(bescheid_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn delete(db: &Db, id: &str, bescheid_id: &str) -> Result<(), AppError> {
    let rows = sqlx::query("DELETE FROM bescheid_anhang WHERE id = ? AND bescheid_id = ?")
        .bind(id)
        .bind(bescheid_id)
        .execute(db)
        .await?
        .rows_affected();

    if rows == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(())
    }
}
