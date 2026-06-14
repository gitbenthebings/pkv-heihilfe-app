use crate::{db::Db, errors::AppError, models::beleg::{Beleg, LinkedAntrag, LinkedRechnung, UpdateBeleg}};
use chrono::Utc;

const SELECT: &str =
    "SELECT id, dateiname, bezeichnung, pfad, thumbnail_pfad, groesse,
            typ, notiz, datum,
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
    let mut sql = format!("{SELECT} WHERE mandant_id = ?");

    if q.is_some() {
        sql.push_str(" AND (dateiname LIKE ? OR bezeichnung LIKE ? OR notiz LIKE ? OR ocr_text LIKE ?)");
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
            .bind(pattern.clone()).bind(pattern.clone())
            .bind(pattern.clone()).bind(pattern);
    }
    if let Some(t) = typ {
        query = query.bind(t);
    }
    if let Some(v) = datum_von {
        query = query.bind(v);
    }
    if let Some(b) = datum_bis {
        query = query.bind(b);
    }

    let mut belege = query.fetch_all(db).await?;
    populate_links(db, &mut belege, mandant_id).await?;
    Ok(belege)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Beleg, AppError> {
    let mut beleg = sqlx::query_as::<_, Beleg>(&format!(
        "{SELECT} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    let mut v = vec![beleg];
    populate_links(db, &mut v, mandant_id).await?;
    beleg = v.remove(0);
    Ok(beleg)
}

pub async fn create(
    db: &Db,
    id: &str,
    mandant_id: &str,
    dateiname: &str,
    pfad: &str,
    thumbnail_pfad: Option<&str>,
    groesse: i64,
    bezeichnung: Option<&str>,
    typ: Option<&str>,
    notiz: Option<&str>,
    datum: Option<&str>,
) -> Result<Beleg, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO beleg (id, mandant_id, dateiname, pfad, thumbnail_pfad, groesse,
                            bezeichnung, typ, notiz, datum, hochgeladen_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(mandant_id)
    .bind(dateiname)
    .bind(pfad)
    .bind(thumbnail_pfad)
    .bind(groesse)
    .bind(bezeichnung)
    .bind(typ)
    .bind(notiz)
    .bind(datum)
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
            bezeichnung = COALESCE(?, bezeichnung),
            typ         = COALESCE(?, typ),
            notiz       = COALESCE(?, notiz),
            datum       = COALESCE(?, datum)
         WHERE id = ? AND mandant_id = ?",
    )
    .bind(input.bezeichnung.as_deref())
    .bind(input.typ.as_deref())
    .bind(input.notiz.as_deref())
    .bind(input.datum.as_deref())
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

/// Reichert eine Liste von Belegen mit Verknüpfungsdaten aus Rechnungen und Anträgen an.
pub async fn populate_links(db: &Db, belege: &mut Vec<Beleg>, mandant_id: &str) -> Result<(), AppError> {
    if belege.is_empty() {
        return Ok(());
    }

    let ids: Vec<&str> = belege.iter().map(|b| b.id.as_str()).collect();
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // ── Linked Rechnungen ─────────────────────────────────────────────────────
    let rechnung_sql = format!(
        "SELECT rb.beleg_id, r.id, r.referenz_nr, r.betrag, r.datum,
                c.name AS leistungserbringer, p.name AS person
         FROM rechnung_beleg rb
         JOIN rechnung r ON r.id = rb.rechnung_id
         JOIN correspondent c ON c.id = r.leistungserbringer_id
         JOIN person p ON p.id = r.person_id
         WHERE rb.beleg_id IN ({placeholders}) AND r.mandant_id = ?
         ORDER BY r.datum DESC"
    );
    let mut q = sqlx::query_as::<_, (String, String, Option<i64>, i64, String, String, String)>(&rechnung_sql);
    for id in &ids { q = q.bind(id); }
    q = q.bind(mandant_id);

    let rechnung_rows = q.fetch_all(db).await?;

    // ── Linked Anträge ────────────────────────────────────────────────────────
    let antrag_sql = format!(
        "SELECT ab.beleg_id, a.id, a.referenz_nr, a.typ,
                COALESCE(bh.name, pkv.name, a.pkv_versicherer) AS stelle
         FROM antrag_beleg ab
         JOIN beihilfe_antrag a ON a.id = ab.antrag_id
         LEFT JOIN beihilfestelle bh ON bh.id = a.beihilfestelle_id
         LEFT JOIN pkv ON pkv.id = a.pkv_id
         WHERE ab.beleg_id IN ({placeholders}) AND a.mandant_id = ?
         ORDER BY a.erstellt_am DESC"
    );
    let mut q2 = sqlx::query_as::<_, (String, String, i64, String, Option<String>)>(&antrag_sql);
    for id in &ids { q2 = q2.bind(id); }
    q2 = q2.bind(mandant_id);

    let antrag_rows = q2.fetch_all(db).await?;

    // ── Merge ─────────────────────────────────────────────────────────────────
    for beleg in belege.iter_mut() {
        beleg.linked_rechnungen = rechnung_rows.iter()
            .filter(|r| r.0 == beleg.id)
            .map(|r| LinkedRechnung {
                id: r.1.clone(),
                referenz_nr: r.2,
                betrag: r.3,
                datum: r.4.clone(),
                leistungserbringer: r.5.clone(),
                person: r.6.clone(),
            })
            .collect();

        beleg.linked_antraege = antrag_rows.iter()
            .filter(|a| a.0 == beleg.id)
            .map(|a| LinkedAntrag {
                id: a.1.clone(),
                referenz_nr: a.2,
                typ: a.3.clone(),
                stelle: a.4.clone(),
            })
            .collect();
    }

    Ok(())
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
