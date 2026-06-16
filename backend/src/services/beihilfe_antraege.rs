use crate::{db::Db, errors::AppError, repositories};
use chrono::Utc;

const VALID_STATUSES: &[&str] = &["entwurf", "versendet", "in_bearbeitung", "beschieden", "archiviert"];

pub async fn set_status_transition(
    db: &Db,
    antrag_id: &str,
    mandant_id: &str,
    neuer_status: &str,
    versendet_am: Option<&str>,
    benutzer_id: &str,
) -> Result<crate::models::beihilfe_antrag::BeihilfeAntrag, AppError> {
    if !VALID_STATUSES.contains(&neuer_status) {
        return Err(AppError::BadRequest(format!("Ungültiger Status: {neuer_status}")));
    }

    let antrag = repositories::beihilfe_antraege::get(db, antrag_id, mandant_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Alle Rechnungen des Antrags einmalig laden (für eingereicht_am-Sync und Lifecycle-Logging)
    let rechnungen = repositories::beihilfe_antraege::list_rechnungen(db, antrag_id).await?;

    // Beim Übergang zu 'versendet' oder 'in_bearbeitung': eingereicht_am auf zugewiesene Rechnungen setzen
    if (neuer_status == "versendet" || neuer_status == "in_bearbeitung") && antrag.status != neuer_status {
        let datum = versendet_am
            .map(|s| s.to_string())
            .or_else(|| Some(Utc::now().format("%Y-%m-%d").to_string()))
            .unwrap();

        let (sql_update, feld_name) = if antrag.typ == "pkv" {
            (
                "UPDATE rechnung SET pkv_eingereicht_am = ? WHERE id = ? AND pkv_eingereicht_am IS NULL",
                "pkv_eingereicht_am",
            )
        } else {
            (
                "UPDATE rechnung SET beihilfe_eingereicht_am = ? WHERE id = ? AND beihilfe_eingereicht_am IS NULL",
                "beihilfe_eingereicht_am",
            )
        };

        for ar in &rechnungen {
            let result = sqlx::query(sql_update)
                .bind(&datum)
                .bind(&ar.rechnung_id)
                .execute(db)
                .await?;

            if result.rows_affected() > 0 {
                let diff = serde_json::json!([{"feld": feld_name, "alt": null, "neu": datum}]);
                let diff_str = serde_json::to_string(&diff).unwrap_or_else(|_| "[]".to_string());
                repositories::aktivitaet::insert(db, mandant_id, &ar.rechnung_id, Some(benutzer_id), "geaendert", &diff_str).await.ok();
            }
        }
    }

    // versendet_am nur beim 'versendet'-Übergang am Antrag speichern
    let store_versendet_am = if neuer_status == "versendet" { versendet_am } else { None };
    let result = repositories::beihilfe_antraege::set_status(db, antrag_id, mandant_id, neuer_status, store_versendet_am).await?;

    // Lifecycle-Ereignis auf allen verknüpften Rechnungen loggen (nur bei tatsächlichem Statuswechsel)
    if antrag.status != neuer_status {
        let log_payload = serde_json::json!({
            "antrag_typ":    antrag.typ,
            "alter_status":  antrag.status,
            "neuer_status":  neuer_status,
            "antrag_titel":  antrag.titel,
        }).to_string();
        for ar in &rechnungen {
            repositories::aktivitaet::insert(db, mandant_id, &ar.rechnung_id, Some(benutzer_id), "antrag_status_geaendert", &log_payload).await.ok();
        }
    }

    Ok(result)
}
