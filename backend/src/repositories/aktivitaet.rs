use crate::{db::Db, errors::AppError, models::aktivitaet::RechnungAktivitaet};
use chrono::Utc;
use uuid::Uuid;

pub async fn insert(
    db: &Db,
    mandant_id: &str,
    rechnung_id: &str,
    benutzer_id: Option<&str>,
    aktion: &str,
    aenderungen_json: &str,
) -> Result<RechnungAktivitaet, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO rechnung_aktivitaet (id, mandant_id, rechnung_id, benutzer_id, aktion, aenderungen, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(rechnung_id)
    .bind(benutzer_id)
    .bind(aktion)
    .bind(aenderungen_json)
    .bind(&now)
    .execute(db)
    .await?;

    let row = sqlx::query_as::<_, RechnungAktivitaet>(
        "SELECT id, mandant_id, rechnung_id, benutzer_id, aktion, aenderungen, erstellt_am
         FROM rechnung_aktivitaet WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

pub async fn list_by_rechnung(
    db: &Db,
    rechnung_id: &str,
    mandant_id: &str,
) -> Result<Vec<RechnungAktivitaet>, AppError> {
    let rows = sqlx::query_as::<_, RechnungAktivitaet>(
        "SELECT id, mandant_id, rechnung_id, benutzer_id, aktion, aenderungen, erstellt_am
         FROM rechnung_aktivitaet
         WHERE rechnung_id = ? AND mandant_id = ?
         ORDER BY erstellt_am ASC"
    )
    .bind(rechnung_id)
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn list_all(
    db: &Db,
    mandant_id: &str,
) -> Result<Vec<RechnungAktivitaet>, AppError> {
    let rows = sqlx::query_as::<_, RechnungAktivitaet>(
        "SELECT id, mandant_id, rechnung_id, benutzer_id, aktion, aenderungen, erstellt_am
         FROM rechnung_aktivitaet
         WHERE mandant_id = ?
         ORDER BY erstellt_am DESC
         LIMIT 200"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}
