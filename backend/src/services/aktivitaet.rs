use crate::{
    db::Db,
    errors::AppError,
    models::{
        aktivitaet::AktivitaetDiff,
        rechnung::{Rechnung, UpdateRechnung},
    },
    repositories,
};

/// Loggt eine Änderung an einer Rechnung.
pub async fn log_aenderung(
    db: &Db,
    mandant_id: &str,
    rechnung_id: &str,
    benutzer_id: &str,
    vorher: &Rechnung,
    patch: &UpdateRechnung,
) -> Result<(), AppError> {
    let mut diffs: Vec<AktivitaetDiff> = Vec::new();

    macro_rules! diff_opt_str {
        ($feld:literal, $alt:expr, $neu:expr) => {
            if let Some(neu_val) = $neu {
                let neu_str = if neu_val.is_empty() { None } else { Some(neu_val.as_str()) };
                if neu_str != $alt.as_deref() {
                    diffs.push(AktivitaetDiff {
                        feld: $feld.to_string(),
                        alt: $alt.clone().map(|s| s),
                        neu: neu_str.map(|s| s.to_string()),
                    });
                }
            }
        };
    }

    if let Some(neu) = patch.betrag {
        let alt_cent = vorher.betrag;
        let neu_cent = (neu * 100.0).round() as i64;
        if alt_cent != neu_cent {
            diffs.push(AktivitaetDiff {
                feld: "betrag".to_string(),
                alt: Some(alt_cent.to_string()),
                neu: Some(neu_cent.to_string()),
            });
        }
    }

    diff_opt_str!("datum", Some(vorher.datum.clone()), patch.datum.as_ref());
    diff_opt_str!("zahlungsziel", vorher.zahlungsziel.clone(), patch.zahlungsziel.as_ref());
    diff_opt_str!("bezahlt_am", vorher.bezahlt_am.clone(), patch.bezahlt_am.as_ref());
    diff_opt_str!("beihilfe_eingereicht_am", vorher.beihilfe_eingereicht_am.clone(), patch.beihilfe_eingereicht_am.as_ref());
    diff_opt_str!("pkv_eingereicht_am", vorher.pkv_eingereicht_am.clone(), patch.pkv_eingereicht_am.as_ref());
    diff_opt_str!("notiz", vorher.notiz.clone(), patch.notiz.as_ref());
    diff_opt_str!("leistungserbringer_id", Some(vorher.leistungserbringer_id.clone()), patch.leistungserbringer_id.as_ref());
    diff_opt_str!("typ", Some(vorher.typ.clone()), patch.typ.as_ref());
    diff_opt_str!("person_id", Some(vorher.person_id.clone()), patch.person_id.as_ref());

    if let Some(neu) = patch.pkv_gescannt {
        if neu != vorher.pkv_gescannt {
            diffs.push(AktivitaetDiff {
                feld: "pkv_gescannt".to_string(),
                alt: Some(vorher.pkv_gescannt.to_string()),
                neu: Some(neu.to_string()),
            });
        }
    }

    if let Some(neu) = patch.beihilfe_gescannt {
        if neu != vorher.beihilfe_gescannt {
            diffs.push(AktivitaetDiff {
                feld: "beihilfe_gescannt".to_string(),
                alt: Some(vorher.beihilfe_gescannt.to_string()),
                neu: Some(neu.to_string()),
            });
        }
    }

    if let Some(neu) = patch.pkv_verzicht {
        if neu != vorher.pkv_verzicht {
            diffs.push(AktivitaetDiff {
                feld: "pkv_verzicht".to_string(),
                alt: Some(vorher.pkv_verzicht.to_string()),
                neu: Some(neu.to_string()),
            });
        }
    }

    if let Some(ref neu_opt) = patch.beihilfe_erstattet_betrag {
        let alt_str = vorher.beihilfe_erstattet_betrag.map(|v| ((v * 100.0).round() as i64).to_string());
        let neu_str = neu_opt.map(|v| ((v * 100.0).round() as i64).to_string());
        if alt_str != neu_str {
            diffs.push(AktivitaetDiff {
                feld: "beihilfe_erstattet_betrag".to_string(),
                alt: alt_str,
                neu: neu_str,
            });
        }
    }

    if let Some(ref neu_opt) = patch.pkv_erstattet_betrag {
        let alt_str = vorher.pkv_erstattet_betrag.map(|v| ((v * 100.0).round() as i64).to_string());
        let neu_str = neu_opt.map(|v| ((v * 100.0).round() as i64).to_string());
        if alt_str != neu_str {
            diffs.push(AktivitaetDiff {
                feld: "pkv_erstattet_betrag".to_string(),
                alt: alt_str,
                neu: neu_str,
            });
        }
    }

    if diffs.is_empty() {
        return Ok(());
    }

    let json = serde_json::to_string(&diffs).unwrap_or_else(|_| "[]".to_string());
    repositories::aktivitaet::insert(db, mandant_id, rechnung_id, Some(benutzer_id), "geaendert", &json).await?;
    Ok(())
}

pub async fn log_erstellt(
    db: &Db,
    mandant_id: &str,
    rechnung_id: &str,
    benutzer_id: &str,
) -> Result<(), AppError> {
    repositories::aktivitaet::insert(db, mandant_id, rechnung_id, Some(benutzer_id), "erstellt", "[]").await?;
    Ok(())
}

pub async fn log_ereignis(
    db: &Db,
    mandant_id: &str,
    rechnung_id: &str,
    benutzer_id: Option<&str>,
    aktion: &str,
    daten: serde_json::Value,
) -> Result<(), AppError> {
    let json = serde_json::to_string(&daten).unwrap_or_else(|_| "[]".to_string());
    repositories::aktivitaet::insert(db, mandant_id, rechnung_id, benutzer_id, aktion, &json).await?;
    Ok(())
}
