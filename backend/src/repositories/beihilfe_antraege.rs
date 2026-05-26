use crate::{
    db::Db,
    errors::AppError,
    models::beihilfe_antrag::{BeihilfeAntrag, AntragRechnung, CreateBeihilfeAntrag, UpdateBeihilfeAntrag},
};
use chrono::Utc;
use uuid::Uuid;

const SELECT: &str = "SELECT id, mandant_id, typ, beihilfestelle_id, pkv_id, pkv_versicherer, referenz_nr, titel, status, versendet_am, notiz, paperless_share_url, erstellt_am FROM beihilfe_antrag";

pub async fn list(
    db: &Db,
    mandant_id: &str,
    status_filter: Option<&str>,
) -> Result<Vec<BeihilfeAntrag>, AppError> {
    let rows = if let Some(s) = status_filter {
        sqlx::query_as::<_, BeihilfeAntrag>(&format!(
            "{SELECT} WHERE mandant_id = ? AND status = ? ORDER BY erstellt_am DESC"
        ))
        .bind(mandant_id)
        .bind(s)
        .fetch_all(db)
        .await?
    } else {
        sqlx::query_as::<_, BeihilfeAntrag>(&format!(
            "{SELECT} WHERE mandant_id = ? ORDER BY erstellt_am DESC"
        ))
        .bind(mandant_id)
        .fetch_all(db)
        .await?
    };
    Ok(rows)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<BeihilfeAntrag>, AppError> {
    let row = sqlx::query_as::<_, BeihilfeAntrag>(&format!(
        "{SELECT} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn create(
    db: &Db,
    mandant_id: &str,
    input: &CreateBeihilfeAntrag,
) -> Result<BeihilfeAntrag, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let next_nr: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(referenz_nr), 0) + 1 FROM beihilfe_antrag WHERE mandant_id = ?"
    )
    .bind(mandant_id)
    .fetch_one(db)
    .await?;

    let typ = input.typ.as_deref().unwrap_or("beihilfe");
    if !["beihilfe", "pkv"].contains(&typ) {
        return Err(crate::errors::AppError::BadRequest(format!("Ungültiger Antrag-Typ: {typ}")));
    }

    sqlx::query(
        "INSERT INTO beihilfe_antrag (id, mandant_id, typ, beihilfestelle_id, pkv_id, pkv_versicherer, referenz_nr, titel, status, notiz, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'entwurf', ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(typ)
    .bind(&input.beihilfestelle_id)
    .bind(&input.pkv_id)
    .bind(&input.pkv_versicherer)
    .bind(next_nr)
    .bind(&input.titel)
    .bind(&input.notiz)
    .bind(&now)
    .execute(db)
    .await?;

    Ok(get(db, &id, mandant_id).await?.unwrap())
}

pub async fn update(
    db: &Db,
    id: &str,
    mandant_id: &str,
    input: &UpdateBeihilfeAntrag,
) -> Result<BeihilfeAntrag, AppError> {
    sqlx::query(
        "UPDATE beihilfe_antrag SET
         beihilfestelle_id = COALESCE(?, beihilfestelle_id),
         pkv_id = COALESCE(?, pkv_id),
         pkv_versicherer = COALESCE(?, pkv_versicherer),
         titel = COALESCE(?, titel),
         notiz = COALESCE(?, notiz),
         paperless_share_url = ?
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(&input.beihilfestelle_id)
    .bind(&input.pkv_id)
    .bind(&input.pkv_versicherer)
    .bind(&input.titel)
    .bind(&input.notiz)
    .bind(&input.paperless_share_url)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn set_status(
    db: &Db,
    id: &str,
    mandant_id: &str,
    status: &str,
    versendet_am: Option<&str>,
) -> Result<BeihilfeAntrag, AppError> {
    sqlx::query(
        "UPDATE beihilfe_antrag SET status = ?, versendet_am = COALESCE(?, versendet_am)
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(status)
    .bind(versendet_am)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM beihilfe_antrag WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn add_rechnung(
    db: &Db,
    antrag_id: &str,
    rechnung_id: &str,
    widerspruch: bool,
) -> Result<AntragRechnung, AppError> {
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT OR REPLACE INTO beihilfe_antrag_rechnung (antrag_id, rechnung_id, widerspruch, hinzugefuegt_am)
         VALUES (?, ?, ?, ?)"
    )
    .bind(antrag_id)
    .bind(rechnung_id)
    .bind(widerspruch)
    .bind(&now)
    .execute(db)
    .await?;

    let row = sqlx::query_as::<_, AntragRechnung>(
        "SELECT antrag_id, rechnung_id, widerspruch, hinzugefuegt_am
         FROM beihilfe_antrag_rechnung WHERE antrag_id = ? AND rechnung_id = ?"
    )
    .bind(antrag_id)
    .bind(rechnung_id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

pub async fn remove_rechnung(
    db: &Db,
    antrag_id: &str,
    rechnung_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "DELETE FROM beihilfe_antrag_rechnung WHERE antrag_id = ? AND rechnung_id = ?"
    )
    .bind(antrag_id)
    .bind(rechnung_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn list_rechnungen(
    db: &Db,
    antrag_id: &str,
) -> Result<Vec<AntragRechnung>, AppError> {
    let rows = sqlx::query_as::<_, AntragRechnung>(
        "SELECT antrag_id, rechnung_id, widerspruch, hinzugefuegt_am
         FROM beihilfe_antrag_rechnung WHERE antrag_id = ? ORDER BY hinzugefuegt_am ASC"
    )
    .bind(antrag_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn list_antraege_fuer_rechnung(
    db: &Db,
    rechnung_id: &str,
    mandant_id: &str,
) -> Result<Vec<BeihilfeAntrag>, AppError> {
    let rows = sqlx::query_as::<_, BeihilfeAntrag>(&format!(
        "{SELECT} WHERE mandant_id = ? AND id IN (
            SELECT antrag_id FROM beihilfe_antrag_rechnung WHERE rechnung_id = ?
         ) ORDER BY erstellt_am DESC"
    ))
    .bind(mandant_id)
    .bind(rechnung_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}
