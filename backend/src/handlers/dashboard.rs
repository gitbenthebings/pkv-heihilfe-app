use axum::{extract::State, Json};
use chrono::Datelike;
use serde::Serialize;
use std::collections::HashMap;

use crate::{
    auth::AuthUser,
    errors::AppError,
    repositories::{self, personen::list_by_mandant, rechnungen::list},
    services::rechnungen::{mit_status, find_satz_fuer_datum, kanban_gruppe},
    models::RechnungMitStatus,
    AppState,
};

#[derive(Serialize)]
pub struct KanbanBoard {
    pub neu: Vec<RechnungMitStatus>,
    pub bezahlt: Vec<RechnungMitStatus>,
    pub beihilfe_eingereicht: Vec<RechnungMitStatus>,
    pub pkv_eingereicht: Vec<RechnungMitStatus>,
    pub abgeschlossen: Vec<RechnungMitStatus>,
}

#[derive(Serialize)]
pub struct FinanzOverview {
    pub offen_unbezahlt: f64,
    pub offen_unbezahlt_beihilfe: f64,
    pub offen_unbezahlt_pkv: f64,
    pub bezahlt_pkv_offen: f64,
    pub bezahlt_pkv_offen_pkv: f64,
    pub bezahlt_beihilfe_offen: f64,
    pub bezahlt_beihilfe_offen_beihilfe: f64,
    pub abgeschlossen: f64,
    pub abgeschlossen_beihilfe: f64,
    pub abgeschlossen_pkv: f64,
}

#[derive(Serialize)]
pub struct BreIndikator {
    pub person_id: String,
    pub person_name: String,
    pub bre_schwelle: f64,
    pub pkv_offen: f64,
    pub bre_spielraum: f64,
}

#[derive(Serialize)]
pub struct DashboardData {
    pub kanban: KanbanBoard,
    pub finanzen: FinanzOverview,
    pub bre: Vec<BreIndikator>,
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<DashboardData>, AppError> {
    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let personen_map: HashMap<String, _> = personen.iter().map(|p| (p.id.clone(), p.clone())).collect();
    let satz_historie = repositories::personen_satz_historie::list_for_mandant(&state.db, &auth.mandant_id).await?;

    let rechnungen = list(&state.db, &auth.mandant_id, None, false, None).await?;
    let rechnungen_mit_status: Vec<RechnungMitStatus> = rechnungen
        .into_iter()
        .filter_map(|r| {
            let person = personen_map.get(&r.person_id)?;
            let (bh_satz, pkv_satz) = find_satz_fuer_datum(&satz_historie, &r.person_id, &r.datum)
                .unwrap_or((person.beihilfe_satz, person.pkv_satz));
            Some(mit_status(r, person, bh_satz, pkv_satz))
        })
        .collect();

    let mut neu = vec![];
    let mut bezahlt = vec![];
    let mut beihilfe_eingereicht = vec![];
    let mut pkv_eingereicht = vec![];
    let mut abgeschlossen = vec![];

    let mut finanzen = FinanzOverview {
        offen_unbezahlt: 0.0, offen_unbezahlt_beihilfe: 0.0, offen_unbezahlt_pkv: 0.0,
        bezahlt_pkv_offen: 0.0, bezahlt_pkv_offen_pkv: 0.0,
        bezahlt_beihilfe_offen: 0.0, bezahlt_beihilfe_offen_beihilfe: 0.0,
        abgeschlossen: 0.0, abgeschlossen_beihilfe: 0.0, abgeschlossen_pkv: 0.0,
    };

    for r in rechnungen_mit_status {
        let gruppe = kanban_gruppe(&r);
        let betrag = r.betrag;
        let bh = r.beihilfe_anteil_erwartet.unwrap_or(0.0);
        let pkv = r.pkv_anteil_erwartet.unwrap_or(0.0);
        let ist_bezahlt = r.zahlung_status == "bezahlt";

        if !ist_bezahlt {
            finanzen.offen_unbezahlt += betrag;
            finanzen.offen_unbezahlt_beihilfe += bh;
            finanzen.offen_unbezahlt_pkv += pkv;
        } else {
            let pkv_offen = r.pkv_status == "offen";
            let bh_offen = r.beihilfe_status.as_deref() == Some("offen");
            if pkv_offen {
                finanzen.bezahlt_pkv_offen += betrag;
                finanzen.bezahlt_pkv_offen_pkv += pkv;
            }
            if bh_offen {
                finanzen.bezahlt_beihilfe_offen += betrag;
                finanzen.bezahlt_beihilfe_offen_beihilfe += bh;
            }
            if !pkv_offen && !bh_offen {
                finanzen.abgeschlossen += betrag;
                finanzen.abgeschlossen_beihilfe += bh;
                finanzen.abgeschlossen_pkv += pkv;
            }
        }

        match gruppe {
            "neu"                  => neu.push(r),
            "bezahlt"              => bezahlt.push(r),
            "beihilfe_eingereicht" => beihilfe_eingereicht.push(r),
            "pkv_eingereicht"      => pkv_eingereicht.push(r),
            "abgeschlossen"        => abgeschlossen.push(r),
            _ => {}
        }
    }

    // BRE-Berechnung
    let current_year = chrono::Local::now().year().to_string();
    let alle_kanban: Vec<&RechnungMitStatus> = [&neu, &bezahlt, &beihilfe_eingereicht, &pkv_eingereicht, &abgeschlossen]
        .iter()
        .flat_map(|v| v.iter())
        .collect();

    let bre: Vec<BreIndikator> = personen.iter()
        .filter_map(|p| {
            let schwelle = p.bre_schwelle?;
            let pkv_offen: f64 = alle_kanban.iter()
                .filter(|r| {
                    r.person_id == p.id
                        && r.datum.starts_with(&current_year)
                        && r.pkv_eingereicht_am.is_none()
                })
                .map(|r| r.pkv_anteil_erwartet.unwrap_or(0.0))
                .sum();
            let bre_spielraum = ((schwelle - pkv_offen) * 100.0).round() / 100.0;
            Some(BreIndikator {
                person_id: p.id.clone(),
                person_name: p.name.clone(),
                bre_schwelle: schwelle,
                pkv_offen: (pkv_offen * 100.0).round() / 100.0,
                bre_spielraum,
            })
        })
        .collect();

    Ok(Json(DashboardData {
        kanban: KanbanBoard { neu, bezahlt, beihilfe_eingereicht, pkv_eingereicht, abgeschlossen },
        finanzen,
        bre,
    }))
}
