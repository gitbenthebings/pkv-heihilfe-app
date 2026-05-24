use crate::{db::Db, errors::AppError, models::beihilfe_bescheid::N8nPosition, models::beihilfe_position::BeihilfePosition};
use chrono::Utc;

const SELECT: &str = "SELECT id, bescheid_id, lfd_nr, rechnungsdatum, leistungserbringer,
    rechnungsbetrag, anerkannt_betrag, abgelehnt_betrag, beihilfe_betrag,
    ablehnungsgrund, rechnung_id, zugeordnet_am FROM beihilfe_position";

pub async fn list_by_bescheid(db: &Db, bescheid_id: &str) -> Result<Vec<BeihilfePosition>, AppError> {
    let items = sqlx::query_as::<_, BeihilfePosition>(&format!(
        "{SELECT} WHERE bescheid_id = ? ORDER BY lfd_nr ASC"
    ))
    .bind(bescheid_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn create_from_n8n(
    db: &Db,
    bescheid_id: &str,
    lfd_nr: i64,
    pos: &N8nPosition,
) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO beihilfe_position (id, bescheid_id, lfd_nr, rechnungsdatum, leistungserbringer,
         rechnungsbetrag, anerkannt_betrag, abgelehnt_betrag, beihilfe_betrag, ablehnungsgrund)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(bescheid_id)
    .bind(lfd_nr)
    .bind(pos.rechnungsdatum.as_deref())
    .bind(pos.leistungserbringer.as_deref())
    .bind(pos.rechnungsbetrag)
    .bind(pos.anerkannt_betrag)
    .bind(pos.abgelehnt_betrag)
    .bind(pos.beihilfe_betrag)
    .bind(pos.ablehnungsgrund.as_deref())
    .execute(db)
    .await?;
    Ok(())
}

pub async fn set_rechnung(
    db: &Db,
    id: &str,
    bescheid_id: &str,
    rechnung_id: Option<&str>,
) -> Result<BeihilfePosition, AppError> {
    let now = rechnung_id.map(|_| Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
    sqlx::query(
        "UPDATE beihilfe_position SET rechnung_id = ?, zugeordnet_am = ? WHERE id = ? AND bescheid_id = ?"
    )
    .bind(rechnung_id)
    .bind(now.as_deref())
    .bind(id)
    .bind(bescheid_id)
    .execute(db)
    .await?;

    sqlx::query_as::<_, BeihilfePosition>(&format!("{SELECT} WHERE id = ?"))
        .bind(id)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)
}
