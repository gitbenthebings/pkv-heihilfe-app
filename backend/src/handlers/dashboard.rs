use axum::{extract::State, Json};
use chrono::Datelike;
use serde::Serialize;
use sqlx::Row;
use std::collections::HashMap;

use crate::{
    auth::AuthUser,
    errors::AppError,
    repositories::{self, personen::list_by_mandant, rechnungen::list},
    services::rechnungen::{mit_status, find_satz_fuer_datum, kanban_gruppe},
    models::RechnungMitStatus,
    AppState,
};

// ── Legacy structs (kept for backward compat) ────────────────────────────────

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
    pub pkv_eingereicht: f64,
    pub bre_spielraum: f64,
}

// ── Pipeline-Daten ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PipelineStageOffen {
    pub brutto: f64,
    pub voraussichtlich: f64,
    pub anzahl: i64,
}

#[derive(Serialize)]
pub struct PipelineStageAbgeschlossen {
    pub tatsaechlich: f64,
    pub anzahl: i64,
}

#[derive(Serialize)]
pub struct PipelineData {
    pub einreichbar: PipelineStageOffen,
    pub eingereicht: PipelineStageOffen,
    pub erstattet: PipelineStageAbgeschlossen,
    pub abgelehnt: PipelineStageAbgeschlossen,
}

// ── Bescheid-Zusammenfassung ──────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BescheidSummary {
    pub id: String,
    pub antrag_id: String,
    pub referenz_nr: i64,
    pub antrag_typ: String,
    pub stelle: Option<String>,
    pub bescheid_datum: String,
    pub ws: bool,
    pub overridden: bool,
    pub erstattet: f64,
    pub abgelehnt: f64,
}

// ── Offener Antrag ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct OffenerAntragSummary {
    pub id: String,
    pub nr: String,
    pub titel: Option<String>,
    pub typ: String,
    pub status: String,
    pub anzahl: i64,
    pub betrag: f64,
}

// ── Dashboard-Antwort ─────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DashboardData {
    pub kanban: KanbanBoard,
    pub finanzen: FinanzOverview,
    pub bre: Vec<BreIndikator>,
    pub benutzer_name: String,
    pub aktuelles_jahr: i32,
    pub beihilfe_pipeline: PipelineData,
    pub pkv_pipeline: PipelineData,
    pub letzte_bescheide: Vec<BescheidSummary>,
    pub offene_antraege: Vec<OffenerAntragSummary>,
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<DashboardData>, AppError> {
    // ── Personen & Rechnungen ─────────────────────────────────────────────────
    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let personen_map: HashMap<String, _> =
        personen.iter().map(|p| (p.id.clone(), p.clone())).collect();
    let satz_historie =
        repositories::personen_satz_historie::list_for_mandant(&state.db, &auth.mandant_id)
            .await?;

    let rechnungen = list(&state.db, &auth.mandant_id, None, false, None).await?;
    let rechnungen_mit_status: Vec<RechnungMitStatus> = rechnungen
        .into_iter()
        .filter_map(|r| {
            let person = personen_map.get(&r.person_id)?;
            let (bh_satz, pkv_satz) =
                find_satz_fuer_datum(&satz_historie, &r.person_id, &r.datum)
                    .unwrap_or((person.beihilfe_satz, person.pkv_satz));
            Some(mit_status(r, person, bh_satz, pkv_satz))
        })
        .collect();

    // ── Benutzer-Name ─────────────────────────────────────────────────────────
    let benutzer =
        repositories::benutzer::get(&state.db, &auth.benutzer_id, &auth.mandant_id).await?;
    let benutzer_name = benutzer
        .map(|b| b.name)
        .unwrap_or_else(|| "Benutzer".to_string());

    // ── Aktuelles Jahr ────────────────────────────────────────────────────────
    let current_year = chrono::Local::now().year();
    let current_year_str = format!("{}", current_year);

    // ── Legacy Kanban & Finanzen ──────────────────────────────────────────────
    let mut neu = vec![];
    let mut bezahlt = vec![];
    let mut beihilfe_eingereicht = vec![];
    let mut pkv_eingereicht_kanban = vec![];
    let mut abgeschlossen = vec![];

    let mut finanzen = FinanzOverview {
        offen_unbezahlt: 0.0,
        offen_unbezahlt_beihilfe: 0.0,
        offen_unbezahlt_pkv: 0.0,
        bezahlt_pkv_offen: 0.0,
        bezahlt_pkv_offen_pkv: 0.0,
        bezahlt_beihilfe_offen: 0.0,
        bezahlt_beihilfe_offen_beihilfe: 0.0,
        abgeschlossen: 0.0,
        abgeschlossen_beihilfe: 0.0,
        abgeschlossen_pkv: 0.0,
    };

    for r in &rechnungen_mit_status {
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

        match kanban_gruppe(r) {
            "neu" => neu.push(r.clone()),
            "bezahlt" => bezahlt.push(r.clone()),
            "beihilfe_eingereicht" => beihilfe_eingereicht.push(r.clone()),
            "pkv_eingereicht" => pkv_eingereicht_kanban.push(r.clone()),
            "abgeschlossen" => abgeschlossen.push(r.clone()),
            _ => {}
        }
    }

    // ── Pipeline-Berechnung (nach Jahr gefiltert) ─────────────────────────────
    let mut bh_ein_brutto = 0.0f64;
    let mut bh_ein_voraus = 0.0f64;
    let mut bh_ein_anzahl = 0i64;
    let mut bh_ing_brutto = 0.0f64;
    let mut bh_ing_voraus = 0.0f64;
    let mut bh_ing_anzahl = 0i64;
    let mut bh_erst_tats = 0.0f64;
    let mut bh_erst_anzahl = 0i64;
    let mut bh_abg_tats = 0.0f64;
    let mut bh_abg_anzahl = 0i64;

    let mut pkv_ein_brutto = 0.0f64;
    let mut pkv_ein_voraus = 0.0f64;
    let mut pkv_ein_anzahl = 0i64;
    let mut pkv_ing_brutto = 0.0f64;
    let mut pkv_ing_voraus = 0.0f64;
    let mut pkv_ing_anzahl = 0i64;
    let mut pkv_erst_tats = 0.0f64;
    let mut pkv_erst_anzahl = 0i64;
    let mut pkv_abg_tats = 0.0f64;
    let mut pkv_abg_anzahl = 0i64;

    for r in &rechnungen_mit_status {
        if !r.datum.starts_with(&current_year_str) || r.archiviert_am.is_some() {
            continue;
        }
        let bh_voraus = r.beihilfe_anteil_erwartet.unwrap_or(0.0);
        let pkv_voraus = r.pkv_anteil_erwartet.unwrap_or(0.0);

        // BH-Pipeline
        match r.beihilfe_status.as_deref() {
            Some("offen") => {
                bh_ein_brutto += r.betrag;
                bh_ein_voraus += bh_voraus;
                bh_ein_anzahl += 1;
            }
            Some("eingereicht") => {
                bh_ing_brutto += r.betrag;
                bh_ing_voraus += bh_voraus;
                bh_ing_anzahl += 1;
            }
            _ => {}
        }
        if let Some(erstattet) = r.beihilfe_erstattet_betrag {
            bh_erst_tats += erstattet;
            bh_erst_anzahl += 1;
            let shortfall = bh_voraus - erstattet;
            if shortfall > 0.01 {
                bh_abg_tats += shortfall;
                bh_abg_anzahl += 1;
            }
        }

        // PKV-Pipeline
        match r.pkv_status.as_str() {
            "offen" if !r.pkv_verzicht => {
                pkv_ein_brutto += r.betrag;
                pkv_ein_voraus += pkv_voraus;
                pkv_ein_anzahl += 1;
            }
            "eingereicht" => {
                pkv_ing_brutto += r.betrag;
                pkv_ing_voraus += pkv_voraus;
                pkv_ing_anzahl += 1;
            }
            _ => {}
        }
        if let Some(erstattet) = r.pkv_erstattet_betrag {
            pkv_erst_tats += erstattet;
            pkv_erst_anzahl += 1;
            let shortfall = pkv_voraus - erstattet;
            if shortfall > 0.01 {
                pkv_abg_tats += shortfall;
                pkv_abg_anzahl += 1;
            }
        }
    }

    let beihilfe_pipeline = PipelineData {
        einreichbar: PipelineStageOffen {
            brutto: (bh_ein_brutto * 100.0).round() / 100.0,
            voraussichtlich: (bh_ein_voraus * 100.0).round() / 100.0,
            anzahl: bh_ein_anzahl,
        },
        eingereicht: PipelineStageOffen {
            brutto: (bh_ing_brutto * 100.0).round() / 100.0,
            voraussichtlich: (bh_ing_voraus * 100.0).round() / 100.0,
            anzahl: bh_ing_anzahl,
        },
        erstattet: PipelineStageAbgeschlossen {
            tatsaechlich: (bh_erst_tats * 100.0).round() / 100.0,
            anzahl: bh_erst_anzahl,
        },
        abgelehnt: PipelineStageAbgeschlossen {
            tatsaechlich: (bh_abg_tats * 100.0).round() / 100.0,
            anzahl: bh_abg_anzahl,
        },
    };

    let pkv_pipeline = PipelineData {
        einreichbar: PipelineStageOffen {
            brutto: (pkv_ein_brutto * 100.0).round() / 100.0,
            voraussichtlich: (pkv_ein_voraus * 100.0).round() / 100.0,
            anzahl: pkv_ein_anzahl,
        },
        eingereicht: PipelineStageOffen {
            brutto: (pkv_ing_brutto * 100.0).round() / 100.0,
            voraussichtlich: (pkv_ing_voraus * 100.0).round() / 100.0,
            anzahl: pkv_ing_anzahl,
        },
        erstattet: PipelineStageAbgeschlossen {
            tatsaechlich: (pkv_erst_tats * 100.0).round() / 100.0,
            anzahl: pkv_erst_anzahl,
        },
        abgelehnt: PipelineStageAbgeschlossen {
            tatsaechlich: (pkv_abg_tats * 100.0).round() / 100.0,
            anzahl: pkv_abg_anzahl,
        },
    };

    // ── BRE-Berechnung (aktualisiert) ─────────────────────────────────────────
    let alle_rechnungen: Vec<&RechnungMitStatus> = [
        &neu,
        &bezahlt,
        &beihilfe_eingereicht,
        &pkv_eingereicht_kanban,
        &abgeschlossen,
    ]
    .iter()
    .flat_map(|v| v.iter())
    .collect();

    let bre: Vec<BreIndikator> = personen
        .iter()
        .filter_map(|p| {
            let schwelle = p.bre_schwelle?;
            let pkv_offen: f64 = alle_rechnungen
                .iter()
                .filter(|r| {
                    r.person_id == p.id
                        && r.datum.starts_with(&current_year_str)
                        && r.pkv_eingereicht_am.is_none()
                        && !r.pkv_verzicht
                })
                .map(|r| r.pkv_anteil_erwartet.unwrap_or(0.0))
                .sum();
            let pkv_eingereicht: f64 = alle_rechnungen
                .iter()
                .filter(|r| {
                    r.person_id == p.id
                        && r.datum.starts_with(&current_year_str)
                        && r.pkv_eingereicht_am.is_some()
                })
                .map(|r| r.pkv_anteil_erwartet.unwrap_or(0.0))
                .sum();
            let bre_spielraum =
                ((schwelle - pkv_offen) * 100.0).round() / 100.0;
            Some(BreIndikator {
                person_id: p.id.clone(),
                person_name: p.name.clone(),
                bre_schwelle: schwelle,
                pkv_offen: (pkv_offen * 100.0).round() / 100.0,
                pkv_eingereicht: (pkv_eingereicht * 100.0).round() / 100.0,
                bre_spielraum,
            })
        })
        .collect();

    // ── Letzte Bescheide ──────────────────────────────────────────────────────
    let bescheid_rows = sqlx::query(
        r#"
        SELECT
            b.id,
            b.antrag_id,
            b.typ AS bescheid_typ,
            b.bescheid_datum,
            COALESCE(a.referenz_nr, 0) AS referenz_nr,
            a.typ AS antrag_typ,
            COALESCE(bh.name, pk.name, a.pkv_versicherer) AS stelle,
            CAST(COALESCE(SUM(CAST(p.anerkannt_betrag AS REAL)), 0.0) / 100.0 AS REAL) AS erstattet,
            CAST(COALESCE(SUM(CAST(p.abgelehnt_betrag AS REAL)), 0.0) / 100.0 AS REAL) AS abgelehnt,
            CASE WHEN EXISTS (
                SELECT 1 FROM beihilfe_bescheid b2
                WHERE b2.antrag_id = b.antrag_id
                  AND b2.mandant_id = b.mandant_id
                  AND b2.typ = 'widerspruchsbescheid'
                  AND b2.bescheid_datum > b.bescheid_datum
            ) THEN 1 ELSE 0 END AS overridden
        FROM beihilfe_bescheid b
        JOIN beihilfe_antrag a ON a.id = b.antrag_id
        LEFT JOIN beihilfestelle bh ON bh.id = a.beihilfestelle_id
        LEFT JOIN pkv pk ON pk.id = a.pkv_id
        LEFT JOIN beihilfe_bescheid_position p ON p.bescheid_id = b.id
        WHERE b.mandant_id = ?
        GROUP BY b.id
        ORDER BY b.bescheid_datum DESC, b.erstellt_am DESC
        LIMIT 8
        "#,
    )
    .bind(&auth.mandant_id)
    .fetch_all(&state.db)
    .await?;

    let letzte_bescheide: Vec<BescheidSummary> = bescheid_rows
        .into_iter()
        .map(|row| {
            let bescheid_typ: String = row.get("bescheid_typ");
            let overridden: i64 = row.get("overridden");
            BescheidSummary {
                id: row.get("id"),
                antrag_id: row.get("antrag_id"),
                referenz_nr: row.get("referenz_nr"),
                antrag_typ: row.get("antrag_typ"),
                stelle: row.get("stelle"),
                bescheid_datum: row.get("bescheid_datum"),
                ws: bescheid_typ == "widerspruchsbescheid",
                overridden: overridden == 1,
                erstattet: row.get("erstattet"),
                abgelehnt: row.get("abgelehnt"),
            }
        })
        .collect();

    // ── Offene Anträge ────────────────────────────────────────────────────────
    let antrag_rows = sqlx::query(
        r#"
        SELECT
            a.id,
            a.referenz_nr,
            a.titel,
            a.typ,
            a.status,
            COUNT(ar.rechnung_id) AS anzahl,
            CAST(COALESCE(SUM(CAST(r.betrag AS REAL)), 0.0) / 100.0 AS REAL) AS betrag
        FROM beihilfe_antrag a
        LEFT JOIN beihilfe_antrag_rechnung ar ON ar.antrag_id = a.id
        LEFT JOIN rechnung r ON r.id = ar.rechnung_id
        WHERE a.mandant_id = ? AND a.status != 'archiviert'
        GROUP BY a.id
        ORDER BY a.erstellt_am DESC
        LIMIT 10
        "#,
    )
    .bind(&auth.mandant_id)
    .fetch_all(&state.db)
    .await?;

    let offene_antraege: Vec<OffenerAntragSummary> = antrag_rows
        .into_iter()
        .map(|row| {
            let referenz_nr: i64 = row.get("referenz_nr");
            OffenerAntragSummary {
                id: row.get("id"),
                nr: format!("#{:04}", referenz_nr),
                titel: row.get("titel"),
                typ: row.get("typ"),
                status: row.get("status"),
                anzahl: row.get("anzahl"),
                betrag: row.get("betrag"),
            }
        })
        .collect();

    Ok(Json(DashboardData {
        kanban: KanbanBoard {
            neu,
            bezahlt,
            beihilfe_eingereicht,
            pkv_eingereicht: pkv_eingereicht_kanban,
            abgeschlossen,
        },
        finanzen,
        bre,
        benutzer_name,
        aktuelles_jahr: current_year,
        beihilfe_pipeline,
        pkv_pipeline,
        letzte_bescheide,
        offene_antraege,
    }))
}
