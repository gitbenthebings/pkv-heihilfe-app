use crate::{db::Db, errors::AppError, models::antrag::*};
use chrono::Utc;

const SELECT: &str = "SELECT id, mandant_id, typ, status, referenz_nr, titel, notiz,
    beihilfestelle_id, pkv_id, pkv_versicherer, paperless_share_url, versendet_am,
    erstellt_am, aktualisiert_am FROM antrag";

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Antrag>, AppError> {
    let items = sqlx::query_as::<_, Antrag>(&format!(
        "{SELECT} WHERE mandant_id = ? ORDER BY erstellt_am DESC"
    ))
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Antrag>, AppError> {
    let item = sqlx::query_as::<_, Antrag>(&format!(
        "{SELECT} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(item)
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreateAntrag) -> Result<Antrag, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let next_nr: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(referenz_nr), 0) + 1 FROM antrag WHERE mandant_id = ?"
    )
    .bind(mandant_id)
    .fetch_one(db)
    .await?;

    sqlx::query(
        "INSERT INTO antrag (id, mandant_id, typ, titel, notiz, beihilfestelle_id, pkv_id,
         pkv_versicherer, referenz_nr, erstellt_am, aktualisiert_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.typ)
    .bind(input.titel.as_deref())
    .bind(input.notiz.as_deref())
    .bind(input.beihilfestelle_id.as_deref())
    .bind(input.pkv_id.as_deref())
    .bind(input.pkv_versicherer.as_deref())
    .bind(next_nr)
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await?;

    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdateAntrag) -> Result<Antrag, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    if let Some(titel) = &input.titel {
        sqlx::query("UPDATE antrag SET titel = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(titel).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }
    if let Some(notiz) = &input.notiz {
        sqlx::query("UPDATE antrag SET notiz = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(notiz).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }
    if let Some(val) = &input.beihilfestelle_id {
        let v = if val.is_null() { None } else { val.as_str() };
        sqlx::query("UPDATE antrag SET beihilfestelle_id = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(v).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }
    if let Some(val) = &input.pkv_id {
        let v = if val.is_null() { None } else { val.as_str() };
        sqlx::query("UPDATE antrag SET pkv_id = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(v).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }
    if let Some(val) = &input.pkv_versicherer {
        let v = if val.is_null() { None } else { val.as_str() };
        sqlx::query("UPDATE antrag SET pkv_versicherer = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(v).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }
    if let Some(val) = &input.paperless_share_url {
        let v = if val.is_null() { None } else { val.as_str() };
        sqlx::query("UPDATE antrag SET paperless_share_url = ?, aktualisiert_am = ? WHERE id = ? AND mandant_id = ?")
            .bind(v).bind(&now).bind(id).bind(mandant_id).execute(db).await?;
    }

    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn set_status(db: &Db, id: &str, mandant_id: &str, input: &SetAntragStatus) -> Result<Antrag, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "UPDATE antrag SET status = ?, versendet_am = COALESCE(?, versendet_am), aktualisiert_am = ?
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(&input.status)
    .bind(input.versendet_am.as_deref())
    .bind(&now)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let rows = sqlx::query("DELETE FROM antrag WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?
        .rows_affected();
    if rows == 0 { return Err(AppError::NotFound); }
    Ok(())
}

// ── Rechnungen ────────────────────────────────────────────────────────────────

pub async fn list_rechnungen(db: &Db, antrag_id: &str) -> Result<Vec<AntragRechnung>, AppError> {
    let items = sqlx::query_as::<_, AntragRechnung>(
        "SELECT antrag_id, rechnung_id, widerspruch FROM antrag_rechnung WHERE antrag_id = ?"
    )
    .bind(antrag_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn add_rechnung(db: &Db, antrag_id: &str, rechnung_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO antrag_rechnung (antrag_id, rechnung_id, widerspruch) VALUES (?, ?, 0)"
    )
    .bind(antrag_id)
    .bind(rechnung_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_rechnung(db: &Db, antrag_id: &str, rechnung_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM antrag_rechnung WHERE antrag_id = ? AND rechnung_id = ?")
        .bind(antrag_id)
        .bind(rechnung_id)
        .execute(db)
        .await?;
    Ok(())
}
