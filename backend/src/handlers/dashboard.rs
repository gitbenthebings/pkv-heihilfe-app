use axum::{extract::State, Json};
use chrono::{Datelike, Local, NaiveDate};
use serde::Serialize;
use sqlx::Row;
use std::collections::HashMap;

use crate::{
    auth::AuthUser,
    errors::AppError,
    repositories::{
        self,
        beihilfestellen::list_by_mandant as list_beihilfestellen,
        correspondents::list_by_mandant as list_correspondents,
        personen::list_by_mandant,
        pkv::list_by_mandant as list_pkv,
        rechnungen::list,
    },
    services::rechnungen::{find_satz_fuer_datum, mit_status},
    models::RechnungMitStatus,
    AppState,
};

// ── Typen ─────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DashboardKpis {
    pub eigenkosten_offen: f64,
    pub ausstehende_erstattung: f64,
    pub erstattet_ytd: f64,
    pub einzureichen_anzahl: i64,
}

#[derive(Serialize, Clone)]
pub struct DashboardRechnung {
    pub id: String,
    pub person_name: String,
    pub betrag: f64,
    pub datum: String,
    pub zahlungsziel: Option<String>,
    pub leistungserbringer_name: Option<String>,
    pub voraussichtlich: f64,
    pub beleg_count: i64,
}

#[derive(Serialize)]
pub struct BhGruppe {
    pub beihilfestelle_id: String,
    pub beihilfestelle_name: String,
    pub voraussichtlich_gesamt: f64,
    pub anzahl: i64,
    pub rechnungen: Vec<DashboardRechnung>,
}

#[derive(Serialize)]
pub struct PkvGruppe {
    pub pkv_id: Option<String>,
    pub pkv_name: String,
    pub voraussichtlich_gesamt: f64,
    pub anzahl: i64,
    pub rechnungen: Vec<DashboardRechnung>,
}

#[derive(Serialize, Clone)]
pub struct BreIndikator {
    pub person_id: String,
    pub person_name: String,
    pub bre_schwelle: f64,
    pub pkv_offen: f64,
    pub pkv_eingereicht: f64,
    pub bre_spielraum: f64,
}

#[derive(Serialize)]
pub struct LaufenderAntrag {
    pub id: String,
    pub nr: String,
    pub titel: Option<String>,
    pub typ: String,
    pub status: String,
    pub stelle: Option<String>,
    pub betrag: f64,
    pub versendet_am: Option<String>,
    pub tage_offen: Option<i64>,
    pub anzahl_rechnungen: i64,
}

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

#[derive(Serialize)]
pub struct DashboardData {
    pub benutzer_name: String,
    pub aktuelles_jahr: i32,
    pub kpis: DashboardKpis,
    pub bezahlen: Vec<DashboardRechnung>,
    pub bh_gruppen: Vec<BhGruppe>,
    pub pkv_gruppen: Vec<PkvGruppe>,
    pub laufende_antraege: Vec<LaufenderAntrag>,
    pub letzte_bescheide: Vec<BescheidSummary>,
    pub bre: Vec<BreIndikator>,
}

// ── Handler ───────────────────────────────────────────────────────────────────

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<DashboardData>, AppError> {
    // ── Stammdaten laden ──────────────────────────────────────────────────────
    let personen = list_by_mandant(&state.db, &auth.mandant_id).await?;
    let personen_map: HashMap<String, _> =
        personen.iter().map(|p| (p.id.clone(), p.clone())).collect();

    let satz_historie =
        repositories::personen_satz_historie::list_for_mandant(&state.db, &auth.mandant_id)
            .await?;

    let correspondents = list_correspondents(&state.db, &auth.mandant_id).await?;
    let correspondent_map: HashMap<String, String> =
        correspondents.into_iter().map(|c| (c.id, c.name)).collect();

    let pkvs = list_pkv(&state.db, &auth.mandant_id).await?;
    let beihilfestellen = list_beihilfestellen(&state.db, &auth.mandant_id).await?;
    let beihilfestellen_map: HashMap<String, String> =
        beihilfestellen.into_iter().map(|b| (b.id, b.name)).collect();

    // ── Rechnungen laden & Status berechnen ───────────────────────────────────
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

    // ── Beleg-Zählung pro Rechnung ────────────────────────────────────────────
    let beleg_count_rows = sqlx::query(
        "SELECT rechnung_id, COUNT(*) AS cnt FROM rechnung_beleg GROUP BY rechnung_id",
    )
    .bind(&auth.mandant_id)
    .fetch_all(&state.db)
    .await?;
    let beleg_count_map: HashMap<String, i64> = beleg_count_rows
        .into_iter()
        .map(|row| {
            (
                row.get::<String, _>("rechnung_id"),
                row.get::<i64, _>("cnt"),
            )
        })
        .collect();

    // ── Benutzer-Name ─────────────────────────────────────────────────────────
    let benutzer =
        repositories::benutzer::get(&state.db, &auth.benutzer_id, &auth.mandant_id).await?;
    let benutzer_name = benutzer
        .map(|b| b.name)
        .unwrap_or_else(|| "Benutzer".to_string());

    // ── Aktuelles Jahr ────────────────────────────────────────────────────────
    let current_year = Local::now().year();
    let current_year_str = format!("{}", current_year);

    // ── PKV-Zuordnung aufbauen: person_id → (pkv_id, pkv_name) ───────────────
    let mut person_pkv: HashMap<String, (String, String)> = HashMap::new();
    let mut fallback_pkv: Option<(String, String)> = None;

    for pkv in &pkvs {
        if pkv.personen_ids.is_empty() {
            if fallback_pkv.is_none() {
                fallback_pkv = Some((pkv.id.clone(), pkv.name.clone()));
            }
        } else {
            for pid in &pkv.personen_ids {
                person_pkv.entry(pid.clone()).or_insert((pkv.id.clone(), pkv.name.clone()));
            }
        }
    }

    let get_pkv_for_person = |person_id: &str| -> Option<(String, String)> {
        person_pkv
            .get(person_id)
            .cloned()
            .or_else(|| fallback_pkv.clone())
    };

    // ── KPI-Berechnung ────────────────────────────────────────────────────────
    let mut eigenkosten_offen = 0.0f64;
    let mut ausstehende_erstattung = 0.0f64;
    let mut erstattet_ytd = 0.0f64;
    let mut einzureichen_anzahl: i64 = 0;

    for r in &rechnungen_mit_status {
        if r.archiviert_am.is_some() {
            continue;
        }
        let is_current_year = r.datum.starts_with(&current_year_str);

        if r.bezahlt_am.is_none() && is_current_year {
            eigenkosten_offen += r.betrag;
        }

        if r.beihilfe_status.as_deref() == Some("eingereicht") {
            ausstehende_erstattung += r.beihilfe_anteil_erwartet.unwrap_or(0.0);
        }
        if r.pkv_status == "eingereicht" {
            ausstehende_erstattung += r.pkv_anteil_erwartet.unwrap_or(0.0);
        }

        if is_current_year {
            erstattet_ytd += r.beihilfe_erstattet_betrag.unwrap_or(0.0);
            erstattet_ytd += r.pkv_erstattet_betrag.unwrap_or(0.0);

            let bh_einreichbar = r.beihilfe_status.as_deref() == Some("offen")
                && personen_map
                    .get(&r.person_id)
                    .and_then(|p| p.beihilfestelle_id.as_ref())
                    .is_some();
            let pkv_einreichbar = r.pkv_status == "offen" && !r.pkv_verzicht;
            if bh_einreichbar || pkv_einreichbar {
                einzureichen_anzahl += 1;
            }
        }
    }

    // ── Bezahlen-Liste ────────────────────────────────────────────────────────
    let mut bezahlen: Vec<DashboardRechnung> = rechnungen_mit_status
        .iter()
        .filter(|r| r.bezahlt_am.is_none() && r.archiviert_am.is_none())
        .map(|r| {
            let person_name = personen_map
                .get(&r.person_id)
                .map(|p| p.name.clone())
                .unwrap_or_default();
            DashboardRechnung {
                id: r.id.clone(),
                person_name,
                betrag: r.betrag,
                datum: r.datum.clone(),
                zahlungsziel: r.zahlungsziel.clone(),
                leistungserbringer_name: correspondent_map.get(&r.leistungserbringer_id).cloned(),
                voraussichtlich: r.beihilfe_anteil_erwartet.unwrap_or(0.0)
                    + r.pkv_anteil_erwartet.unwrap_or(0.0),
                beleg_count: *beleg_count_map.get(&r.id).unwrap_or(&0),
            }
        })
        .collect();
    bezahlen.sort_by(|a, b| {
        let za = a.zahlungsziel.as_deref().unwrap_or("9999-99-99");
        let zb = b.zahlungsziel.as_deref().unwrap_or("9999-99-99");
        za.cmp(zb)
    });

    // ── BH-Gruppen (nach Beihilfestelle) ─────────────────────────────────────
    let mut bh_map: HashMap<String, BhGruppe> = HashMap::new();

    for r in &rechnungen_mit_status {
        if r.archiviert_am.is_some() {
            continue;
        }
        if r.beihilfe_status.as_deref() != Some("offen") {
            continue;
        }
        let person = match personen_map.get(&r.person_id) {
            Some(p) => p,
            None => continue,
        };
        let bh_id = match &person.beihilfestelle_id {
            Some(id) => id.clone(),
            None => continue,
        };
        let bh_name = beihilfestellen_map
            .get(&bh_id)
            .cloned()
            .unwrap_or_else(|| bh_id.clone());
        let voraus = r.beihilfe_anteil_erwartet.unwrap_or(0.0);

        let dr = DashboardRechnung {
            id: r.id.clone(),
            person_name: person.name.clone(),
            betrag: r.betrag,
            datum: r.datum.clone(),
            zahlungsziel: r.zahlungsziel.clone(),
            leistungserbringer_name: correspondent_map.get(&r.leistungserbringer_id).cloned(),
            voraussichtlich: voraus,
            beleg_count: *beleg_count_map.get(&r.id).unwrap_or(&0),
        };

        let entry = bh_map.entry(bh_id.clone()).or_insert(BhGruppe {
            beihilfestelle_id: bh_id,
            beihilfestelle_name: bh_name,
            voraussichtlich_gesamt: 0.0,
            anzahl: 0,
            rechnungen: vec![],
        });
        entry.voraussichtlich_gesamt = (entry.voraussichtlich_gesamt + voraus) * 100.0 / 100.0;
        entry.anzahl += 1;
        entry.rechnungen.push(dr);
    }

    let mut bh_gruppen: Vec<BhGruppe> = bh_map.into_values().collect();
    bh_gruppen.sort_by(|a, b| a.beihilfestelle_name.cmp(&b.beihilfestelle_name));

    // ── PKV-Gruppen (nach PKV) ────────────────────────────────────────────────
    let mut pkv_map: HashMap<String, PkvGruppe> = HashMap::new();

    for r in &rechnungen_mit_status {
        if r.archiviert_am.is_some() {
            continue;
        }
        if r.pkv_status != "offen" || r.pkv_verzicht {
            continue;
        }
        let person = match personen_map.get(&r.person_id) {
            Some(p) => p,
            None => continue,
        };
        let (pkv_id, pkv_name) = match get_pkv_for_person(&r.person_id) {
            Some(v) => v,
            None => continue,
        };
        let voraus = r.pkv_anteil_erwartet.unwrap_or(0.0);

        let dr = DashboardRechnung {
            id: r.id.clone(),
            person_name: person.name.clone(),
            betrag: r.betrag,
            datum: r.datum.clone(),
            zahlungsziel: r.zahlungsziel.clone(),
            leistungserbringer_name: correspondent_map.get(&r.leistungserbringer_id).cloned(),
            voraussichtlich: voraus,
            beleg_count: *beleg_count_map.get(&r.id).unwrap_or(&0),
        };

        let entry = pkv_map.entry(pkv_id.clone()).or_insert(PkvGruppe {
            pkv_id: Some(pkv_id),
            pkv_name,
            voraussichtlich_gesamt: 0.0,
            anzahl: 0,
            rechnungen: vec![],
        });
        entry.voraussichtlich_gesamt = ((entry.voraussichtlich_gesamt + voraus) * 100.0).round() / 100.0;
        entry.anzahl += 1;
        entry.rechnungen.push(dr);
    }

    let mut pkv_gruppen: Vec<PkvGruppe> = pkv_map.into_values().collect();
    pkv_gruppen.sort_by(|a, b| a.pkv_name.cmp(&b.pkv_name));

    // ── BRE-Berechnung ────────────────────────────────────────────────────────
    let bre: Vec<BreIndikator> = personen
        .iter()
        .filter_map(|p| {
            let schwelle = p.bre_schwelle?;
            let pkv_offen: f64 = rechnungen_mit_status
                .iter()
                .filter(|r| {
                    r.person_id == p.id
                        && r.datum.starts_with(&current_year_str)
                        && r.pkv_eingereicht_am.is_none()
                        && !r.pkv_verzicht
                        && r.archiviert_am.is_none()
                })
                .map(|r| r.pkv_anteil_erwartet.unwrap_or(0.0))
                .sum();
            let pkv_eingereicht: f64 = rechnungen_mit_status
                .iter()
                .filter(|r| {
                    r.person_id == p.id
                        && r.datum.starts_with(&current_year_str)
                        && r.pkv_eingereicht_am.is_some()
                })
                .map(|r| r.pkv_anteil_erwartet.unwrap_or(0.0))
                .sum();
            Some(BreIndikator {
                person_id: p.id.clone(),
                person_name: p.name.clone(),
                bre_schwelle: schwelle,
                pkv_offen: (pkv_offen * 100.0).round() / 100.0,
                pkv_eingereicht: (pkv_eingereicht * 100.0).round() / 100.0,
                bre_spielraum: ((schwelle - pkv_offen) * 100.0).round() / 100.0,
            })
        })
        .collect();

    // ── Laufende Anträge ──────────────────────────────────────────────────────
    let antrag_rows = sqlx::query(
        r#"
        SELECT
            a.id, a.referenz_nr, a.titel, a.typ, a.status, a.versendet_am,
            COALESCE(bh.name, pk.name, a.pkv_versicherer) AS stelle,
            COUNT(ar.rechnung_id) AS anzahl_rechnungen,
            CAST(COALESCE(SUM(CAST(r.betrag AS REAL)), 0.0) / 100.0 AS REAL) AS betrag
        FROM beihilfe_antrag a
        LEFT JOIN beihilfestelle bh ON bh.id = a.beihilfestelle_id
        LEFT JOIN pkv pk ON pk.id = a.pkv_id
        LEFT JOIN beihilfe_antrag_rechnung ar ON ar.antrag_id = a.id
        LEFT JOIN rechnung r ON r.id = ar.rechnung_id
        WHERE a.mandant_id = ? AND a.status IN ('versendet', 'in_bearbeitung')
        GROUP BY a.id
        ORDER BY COALESCE(a.versendet_am, a.erstellt_am) DESC
        "#,
    )
    .bind(&auth.mandant_id)
    .fetch_all(&state.db)
    .await?;

    let today = Local::now().date_naive();
    let laufende_antraege: Vec<LaufenderAntrag> = antrag_rows
        .into_iter()
        .map(|row| {
            let referenz_nr: i64 = row.get("referenz_nr");
            let typ: String = row.get("typ");
            let versendet_am: Option<String> = row.get("versendet_am");
            let tage_offen = versendet_am.as_deref().and_then(|d| {
                NaiveDate::parse_from_str(&d[..10], "%Y-%m-%d")
                    .ok()
                    .map(|sent| (today - sent).num_days())
            });
            LaufenderAntrag {
                id: row.get("id"),
                nr: format!(
                    "{}-{:04}",
                    if typ == "pkv" { "P" } else { "B" },
                    referenz_nr
                ),
                titel: row.get("titel"),
                typ,
                status: row.get("status"),
                stelle: row.get("stelle"),
                betrag: row.get("betrag"),
                versendet_am,
                tage_offen,
                anzahl_rechnungen: row.get("anzahl_rechnungen"),
            }
        })
        .collect();

    // ── Letzte Bescheide ──────────────────────────────────────────────────────
    let bescheid_rows = sqlx::query(
        r#"
        SELECT
            b.id, b.antrag_id, b.typ AS bescheid_typ, b.bescheid_datum,
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

    Ok(Json(DashboardData {
        benutzer_name,
        aktuelles_jahr: current_year,
        kpis: DashboardKpis {
            eigenkosten_offen: (eigenkosten_offen * 100.0).round() / 100.0,
            ausstehende_erstattung: (ausstehende_erstattung * 100.0).round() / 100.0,
            erstattet_ytd: (erstattet_ytd * 100.0).round() / 100.0,
            einzureichen_anzahl,
        },
        bezahlen,
        bh_gruppen,
        pkv_gruppen,
        laufende_antraege,
        letzte_bescheide,
        bre,
    }))
}
