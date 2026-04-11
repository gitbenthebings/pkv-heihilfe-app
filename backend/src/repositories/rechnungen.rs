use crate::{db::Db, errors::AppError, models::rechnung::*};
use chrono::Utc;

const SELECT: &str = "SELECT id, mandant_id, person_id, leistungserbringer_id, typ, betrag, datum,
                       zahlungsziel, bezahlt_am, beihilfe_eingereicht_am, pkv_eingereicht_am, notiz,
                       archiviert_am, referenz_nr, beihilfe_erstattet_betrag, pkv_erstattet_betrag,
                       pkv_gescannt, beihilfe_gescannt
                       FROM rechnung";

/// Leerer String in UpdateRechnung → NULL in DB
fn opt_str(s: Option<&str>) -> Option<&str> {
    s.and_then(|v| if v.is_empty() { None } else { Some(v) })
}

pub async fn list(
    db: &Db,
    mandant_id: &str,
    person_id: Option<&str>,
    include_archiviert: bool,
) -> Result<Vec<Rechnung>, AppError> {
    let archiv_clause = if include_archiviert {
        "archiviert_am IS NOT NULL"
    } else {
        "archiviert_am IS NULL"
    };

    let rechnungen = if let Some(pid) = person_id {
        sqlx::query_as::<_, Rechnung>(&format!(
            "{SELECT} WHERE mandant_id = ? AND person_id = ? AND {archiv_clause} ORDER BY datum DESC"
        ))
        .bind(mandant_id)
        .bind(pid)
        .fetch_all(db)
        .await?
    } else {
        sqlx::query_as::<_, Rechnung>(&format!(
            "{SELECT} WHERE mandant_id = ? AND {archiv_clause} ORDER BY datum DESC"
        ))
        .bind(mandant_id)
        .fetch_all(db)
        .await?
    };
    Ok(rechnungen)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Rechnung>, AppError> {
    let r = sqlx::query_as::<_, Rechnung>(&format!(
        "{SELECT} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(r)
}

pub async fn create(
    db: &Db,
    mandant_id: &str,
    input: &CreateRechnung,
) -> Result<Rechnung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let betrag_cent = (input.betrag * 100.0).round() as i64;

    let next_nr: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(referenz_nr), 0) + 1 FROM rechnung WHERE mandant_id = ?"
    )
    .bind(mandant_id)
    .fetch_one(db)
    .await?;

    sqlx::query(
        "INSERT INTO rechnung (id, mandant_id, person_id, leistungserbringer_id, typ, betrag, datum, zahlungsziel, notiz, referenz_nr, pkv_gescannt, beihilfe_gescannt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.person_id)
    .bind(&input.leistungserbringer_id)
    .bind(&input.typ)
    .bind(betrag_cent)
    .bind(&input.datum)
    .bind(opt_str(input.zahlungsziel.as_deref()))
    .bind(opt_str(input.notiz.as_deref()))
    .bind(next_nr)
    .bind(input.pkv_gescannt.unwrap_or(false))
    .bind(input.beihilfe_gescannt.unwrap_or(false))
    .execute(db)
    .await?;

    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(
    db: &Db,
    id: &str,
    mandant_id: &str,
    input: &UpdateRechnung,
) -> Result<Rechnung, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;

    let bezahlt_am = input.bezahlt_am.as_deref()
        .map(|v| if v.is_empty() { None } else { Some(v) })
        .unwrap_or(existing.bezahlt_am.as_deref());
    let beihilfe_am = input.beihilfe_eingereicht_am.as_deref()
        .map(|v| if v.is_empty() { None } else { Some(v) })
        .unwrap_or(existing.beihilfe_eingereicht_am.as_deref());
    let pkv_am = input.pkv_eingereicht_am.as_deref()
        .map(|v| if v.is_empty() { None } else { Some(v) })
        .unwrap_or(existing.pkv_eingereicht_am.as_deref());
    let notiz = input.notiz.as_deref()
        .map(|v| if v.is_empty() { None } else { Some(v) })
        .unwrap_or(existing.notiz.as_deref());
    let zahlungsziel = input.zahlungsziel.as_deref()
        .map(|v| if v.is_empty() { None } else { Some(v) })
        .unwrap_or(existing.zahlungsziel.as_deref());

    let betrag_cent = input.betrag.map(|b| (b * 100.0).round() as i64).unwrap_or(existing.betrag);
    let datum = input.datum.as_deref().unwrap_or(&existing.datum).to_string();
    let leistungserbringer_id = input.leistungserbringer_id.as_deref().unwrap_or(&existing.leistungserbringer_id).to_string();
    let typ = input.typ.as_deref().unwrap_or(&existing.typ).to_string();
    let person_id = input.person_id.as_deref().unwrap_or(&existing.person_id).to_string();
    // Automatisch auf gescannt=true setzen wenn eingereicht_am gesetzt wird,
    // außer der Aufrufer hat gescannt explizit mitgeliefert.
    let pkv_wird_eingereicht = input.pkv_eingereicht_am.as_deref().map(|v| !v.is_empty()).unwrap_or(false);
    let bh_wird_eingereicht  = input.beihilfe_eingereicht_am.as_deref().map(|v| !v.is_empty()).unwrap_or(false);

    let pkv_gescannt = input.pkv_gescannt
        .unwrap_or(if pkv_wird_eingereicht { true } else { existing.pkv_gescannt });
    let beihilfe_gescannt = input.beihilfe_gescannt
        .unwrap_or(if bh_wird_eingereicht { true } else { existing.beihilfe_gescannt });

    // None = nicht im Request → bestehenden Wert behalten
    // Some(None) = null im Request → auf NULL setzen
    // Some(Some(v)) = Wert im Request → setzen
    let bh_erstattet: Option<f64> = match input.beihilfe_erstattet_betrag {
        None => existing.beihilfe_erstattet_betrag,
        Some(v) => v,
    };
    let pkv_erstattet: Option<f64> = match input.pkv_erstattet_betrag {
        None => existing.pkv_erstattet_betrag,
        Some(v) => v,
    };

    sqlx::query(
        "UPDATE rechnung SET bezahlt_am = ?, beihilfe_eingereicht_am = ?, pkv_eingereicht_am = ?,
         notiz = ?, betrag = ?, datum = ?, zahlungsziel = ?, leistungserbringer_id = ?, typ = ?, person_id = ?,
         beihilfe_erstattet_betrag = ?, pkv_erstattet_betrag = ?, pkv_gescannt = ?, beihilfe_gescannt = ?
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(bezahlt_am)
    .bind(beihilfe_am)
    .bind(pkv_am)
    .bind(notiz)
    .bind(betrag_cent)
    .bind(&datum)
    .bind(zahlungsziel)
    .bind(&leistungserbringer_id)
    .bind(&typ)
    .bind(&person_id)
    .bind(bh_erstattet)
    .bind(pkv_erstattet)
    .bind(pkv_gescannt)
    .bind(beihilfe_gescannt)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM rechnung WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn bulk_update(
    db: &Db,
    mandant_id: &str,
    ids: &[String],
    action: &BulkAction,
) -> Result<u64, AppError> {
    let now = Utc::now().format("%Y-%m-%d").to_string();
    let mut total = 0u64;

    for id in ids {
        let rows = match action {
            BulkAction::Bezahlt => sqlx::query(
                    "UPDATE rechnung SET bezahlt_am = ? WHERE id = ? AND mandant_id = ?")
                .bind(&now).bind(id).bind(mandant_id)
                .execute(db).await?.rows_affected(),
            BulkAction::BeihilfeEingereicht => sqlx::query(
                    "UPDATE rechnung SET beihilfe_eingereicht_am = ?, beihilfe_gescannt = 1 WHERE id = ? AND mandant_id = ?")
                .bind(&now).bind(id).bind(mandant_id)
                .execute(db).await?.rows_affected(),
            BulkAction::PkvEingereicht => sqlx::query(
                    "UPDATE rechnung SET pkv_eingereicht_am = ?, pkv_gescannt = 1 WHERE id = ? AND mandant_id = ?")
                .bind(&now).bind(id).bind(mandant_id)
                .execute(db).await?.rows_affected(),
            BulkAction::Archivieren => sqlx::query(
                    "UPDATE rechnung SET archiviert_am = ? WHERE id = ? AND mandant_id = ?")
                .bind(&now).bind(id).bind(mandant_id)
                .execute(db).await?.rows_affected(),
            BulkAction::Dearchivieren => sqlx::query(
                    "UPDATE rechnung SET archiviert_am = NULL WHERE id = ? AND mandant_id = ?")
                .bind(id).bind(mandant_id)
                .execute(db).await?.rows_affected(),
        };
        total += rows;
    }

    Ok(total)
}
