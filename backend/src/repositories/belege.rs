use crate::{db::Db, errors::AppError, models::beleg::{Beleg, UpdateBeleg}};
use chrono::Utc;

const SELECT: &str =
    "SELECT id, dateiname, bezeichnung, pfad, thumbnail_pfad, groesse,
            datum, eingangsdatum, typ, aktenzeichen, betrag, aussteller, notiz,
            hochgeladen_am, (thumbnail_pfad IS NOT NULL) AS has_thumbnail,
            ocr_text, ocr_status
     FROM beleg";

pub async fn list(
    db: &Db,
    mandant_id: &str,
    q: Option<&str>,
    typ: Option<&str>,
    datum_von: Option<&str>,
    datum_bis: Option<&str>,
) -> Result<Vec<Beleg>, AppError> {
    // Build dynamic query
    let mut conditions = vec!["mandant_id = ?"];
    let mut sql = format!("{SELECT} WHERE mandant_id = ?");

    if q.is_some() {
        sql.push_str(" AND (dateiname LIKE ? OR bezeichnung LIKE ? OR notiz LIKE ? OR aussteller LIKE ? OR aktenzeichen LIKE ? OR ocr_text LIKE ?)");
        let _ = conditions; // suppress unused
    }
    if typ.is_some() {
        sql.push_str(" AND typ = ?");
    }
    if datum_von.is_some() {
        sql.push_str(" AND datum >= ?");
    }
    if datum_bis.is_some() {
        sql.push_str(" AND datum <= ?");
    }
    sql.push_str(" ORDER BY hochgeladen_am DESC");

    let mut query = sqlx::query_as::<_, Beleg>(&sql).bind(mandant_id);

    if let Some(q) = q {
        let pattern = format!("%{q}%");
        query = query
            .bind(pattern.clone()).bind(pattern.clone()).bind(pattern.clone())
            .bind(pattern.clone()).bind(pattern.clone()).bind(pattern);
    }
    if let Some(t) = typ {
        query = query.bind(t);
    }
    if let Some(d) = datum_von {
        query = query.bind(d);
    }
    if let Some(d) = datum_bis {
        query = query.bind(d);
    }

    Ok(query.fetch_all(db).await?)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Beleg, AppError> {
    sqlx::query_as::<_, Beleg>(&format!(
        "{SELECT} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)
}

#[allow(clippy::too_many_arguments)]
pub async fn create(
    db: &Db,
    id: &str,
    mandant_id: &str,
    dateiname: &str,
    pfad: &str,
    thumbnail_pfad: Option<&str>,
    groesse: i64,
    bezeichnung: Option<&str>,
    datum: Option<&str>,
    eingangsdatum: Option<&str>,
    typ: Option<&str>,
    aktenzeichen: Option<&str>,
    betrag: Option<f64>,
    aussteller: Option<&str>,
    notiz: Option<&str>,
) -> Result<Beleg, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO beleg (id, mandant_id, dateiname, pfad, thumbnail_pfad, groesse,
                            bezeichnung, datum, eingangsdatum, typ, aktenzeichen,
                            betrag, aussteller, notiz, hochgeladen_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(mandant_id)
    .bind(dateiname)
    .bind(pfad)
    .bind(thumbnail_pfad)
    .bind(groesse)
    .bind(bezeichnung)
    .bind(datum)
    .bind(eingangsdatum)
    .bind(typ)
    .bind(aktenzeichen)
    .bind(betrag)
    .bind(aussteller)
    .bind(notiz)
    .bind(&now)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await
}

pub async fn update(
    db: &Db,
    id: &str,
    mandant_id: &str,
    input: &UpdateBeleg,
) -> Result<Beleg, AppError> {
    sqlx::query(
        "UPDATE beleg SET
            bezeichnung    = COALESCE(?, bezeichnung),
            datum          = COALESCE(?, datum),
            eingangsdatum  = COALESCE(?, eingangsdatum),
            typ            = COALESCE(?, typ),
            aktenzeichen   = COALESCE(?, aktenzeichen),
            betrag         = COALESCE(?, betrag),
            aussteller     = COALESCE(?, aussteller),
            notiz          = COALESCE(?, notiz)
         WHERE id = ? AND mandant_id = ?",
    )
    .bind(input.bezeichnung.as_deref())
    .bind(input.datum.as_deref())
    .bind(input.eingangsdatum.as_deref())
    .bind(input.typ.as_deref())
    .bind(input.aktenzeichen.as_deref())
    .bind(input.betrag)
    .bind(input.aussteller.as_deref())
    .bind(input.notiz.as_deref())
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<Beleg, AppError> {
    let beleg = get(db, id, mandant_id).await?;
    let rows = sqlx::query("DELETE FROM beleg WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?
        .rows_affected();

    if rows == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(beleg)
    }
}

pub async fn update_thumbnail(db: &Db, id: &str, thumbnail_pfad: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE beleg SET thumbnail_pfad = ? WHERE id = ?")
        .bind(thumbnail_pfad)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_ocr(
    db: &Db,
    id: &str,
    status: &str,
    text: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query("UPDATE beleg SET ocr_status = ?, ocr_text = ? WHERE id = ?")
        .bind(status)
        .bind(text)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

// ── Rechnung ↔ Beleg ─────────────────────────────────────────────────────────

pub async fn list_by_rechnung(
    db: &Db,
    rechnung_id: &str,
    mandant_id: &str,
) -> Result<Vec<Beleg>, AppError> {
    let items = sqlx::query_as::<_, Beleg>(&format!(
        "{SELECT}
         INNER JOIN rechnung_beleg rb ON rb.beleg_id = beleg.id
         WHERE rb.rechnung_id = ? AND beleg.mandant_id = ?
         ORDER BY rb.verknuepft_am DESC"
    ))
    .bind(rechnung_id)
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn add_to_rechnung(
    db: &Db,
    rechnung_id: &str,
    beleg_id: &str,
    mandant_id: &str,
) -> Result<(), AppError> {
    // Check beleg belongs to mandant
    get(db, beleg_id, mandant_id).await?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO rechnung_beleg (rechnung_id, beleg_id, verknuepft_am)
         VALUES (?, ?, ?)",
    )
    .bind(rechnung_id)
    .bind(beleg_id)
    .bind(&now)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_from_rechnung(
    db: &Db,
    rechnung_id: &str,
    beleg_id: &str,
    _mandant_id: &str,
) -> Result<(), AppError> {
    let rows =
        sqlx::query("DELETE FROM rechnung_beleg WHERE rechnung_id = ? AND beleg_id = ?")
            .bind(rechnung_id)
            .bind(beleg_id)
            .execute(db)
            .await?
            .rows_affected();
    if rows == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(())
    }
}

// ── Antrag ↔ Beleg ────────────────────────────────────────────────────────────

pub async fn list_by_antrag(
    db: &Db,
    antrag_id: &str,
    mandant_id: &str,
) -> Result<Vec<Beleg>, AppError> {
    let items = sqlx::query_as::<_, Beleg>(&format!(
        "{SELECT}
         INNER JOIN antrag_beleg ab ON ab.beleg_id = beleg.id
         WHERE ab.antrag_id = ? AND beleg.mandant_id = ?
         ORDER BY ab.verknuepft_am DESC"
    ))
    .bind(antrag_id)
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn add_to_antrag(
    db: &Db,
    antrag_id: &str,
    beleg_id: &str,
    mandant_id: &str,
) -> Result<(), AppError> {
    get(db, beleg_id, mandant_id).await?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO antrag_beleg (antrag_id, beleg_id, verknuepft_am)
         VALUES (?, ?, ?)",
    )
    .bind(antrag_id)
    .bind(beleg_id)
    .bind(&now)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_from_antrag(
    db: &Db,
    antrag_id: &str,
    beleg_id: &str,
    _mandant_id: &str,
) -> Result<(), AppError> {
    let rows =
        sqlx::query("DELETE FROM antrag_beleg WHERE antrag_id = ? AND beleg_id = ?")
            .bind(antrag_id)
            .bind(beleg_id)
            .execute(db)
            .await?
            .rows_affected();
    if rows == 0 {
        Err(AppError::NotFound)
    } else {
        Ok(())
    }
}
