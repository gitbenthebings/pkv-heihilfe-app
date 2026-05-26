use crate::{db::Db, errors::AppError, models::aktivitaet::AktivitaetDiff, repositories};

/// Synchronisiert das Erstattungsfeld der Rechnung aus den Bescheid-Positionen.
/// Verzweigt auf beihilfe_erstattet_betrag (typ='beihilfe') oder pkv_erstattet_betrag (typ='pkv').
pub async fn sync_erstattet(
    rechnung_id: &str,
    antrag_id: &str,
    mandant_id: &str,
    db: &Db,
) -> Result<(), AppError> {
    let typ: String = sqlx::query_scalar(
        "SELECT typ FROM beihilfe_antrag WHERE id = ?"
    )
    .bind(antrag_id)
    .fetch_optional(db)
    .await?
    .unwrap_or_else(|| "beihilfe".to_string());

    if typ == "pkv" {
        sync_pkv(rechnung_id, mandant_id, db).await
    } else {
        sync_beihilfe(rechnung_id, mandant_id, db).await
    }
}

async fn sync_beihilfe(rechnung_id: &str, mandant_id: &str, db: &Db) -> Result<(), AppError> {
    let vorher = repositories::rechnungen::get(db, rechnung_id, mandant_id).await?;
    let alt = vorher.as_ref().and_then(|r| r.beihilfe_erstattet_betrag);

    sqlx::query(
        "UPDATE rechnung
         SET beihilfe_erstattet_betrag = (
           SELECT SUM(bdp.anerkannt_betrag) / 100.0
           FROM beihilfe_bescheid_position bdp
           JOIN beihilfe_bescheid bd ON bd.id = bdp.bescheid_id
           JOIN beihilfe_antrag a ON a.id = bd.antrag_id
           WHERE bdp.rechnung_id = ?
             AND a.typ = 'beihilfe'
             AND bdp.anerkannt_betrag IS NOT NULL
         )
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(rechnung_id)
    .bind(rechnung_id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    let nachher = repositories::rechnungen::get(db, rechnung_id, mandant_id).await?;
    let neu = nachher.as_ref().and_then(|r| r.beihilfe_erstattet_betrag);
    log_diff(db, mandant_id, rechnung_id, "beihilfe_erstattet_betrag", alt, neu).await;
    Ok(())
}

async fn sync_pkv(rechnung_id: &str, mandant_id: &str, db: &Db) -> Result<(), AppError> {
    let vorher = repositories::rechnungen::get(db, rechnung_id, mandant_id).await?;
    let alt = vorher.as_ref().and_then(|r| r.pkv_erstattet_betrag);

    sqlx::query(
        "UPDATE rechnung
         SET pkv_erstattet_betrag = (
           SELECT SUM(bdp.anerkannt_betrag) / 100.0
           FROM beihilfe_bescheid_position bdp
           JOIN beihilfe_bescheid bd ON bd.id = bdp.bescheid_id
           JOIN beihilfe_antrag a ON a.id = bd.antrag_id
           WHERE bdp.rechnung_id = ?
             AND a.typ = 'pkv'
             AND bdp.anerkannt_betrag IS NOT NULL
         )
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(rechnung_id)
    .bind(rechnung_id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    let nachher = repositories::rechnungen::get(db, rechnung_id, mandant_id).await?;
    let neu = nachher.as_ref().and_then(|r| r.pkv_erstattet_betrag);
    log_diff(db, mandant_id, rechnung_id, "pkv_erstattet_betrag", alt, neu).await;
    Ok(())
}

async fn log_diff(db: &Db, mandant_id: &str, rechnung_id: &str, feld: &str, alt: Option<f64>, neu: Option<f64>) {
    let alt_cent = alt.map(|v| ((v * 100.0).round() as i64).to_string());
    let neu_cent = neu.map(|v| ((v * 100.0).round() as i64).to_string());
    if alt_cent != neu_cent {
        let diff = vec![AktivitaetDiff { feld: feld.to_string(), alt: alt_cent, neu: neu_cent }];
        let json = serde_json::to_string(&diff).unwrap_or_else(|_| "[]".to_string());
        repositories::aktivitaet::insert(db, mandant_id, rechnung_id, None, "geaendert", &json)
            .await
            .ok();
    }
}
