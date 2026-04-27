use crate::models::{Person, rechnung::{Rechnung, RechnungMitStatus}};

pub fn zahlung_status(bezahlt_am: Option<&str>) -> String {
    if bezahlt_am.is_some() { "bezahlt".to_string() } else { "offen".to_string() }
}

pub fn beihilfe_status(hat_beihilfestelle: bool, eingereicht_am: Option<&str>) -> Option<String> {
    if !hat_beihilfestelle { return None; }
    Some(if eingereicht_am.is_some() { "eingereicht".to_string() } else { "offen".to_string() })
}

pub fn pkv_status(eingereicht_am: Option<&str>) -> String {
    if eingereicht_am.is_some() { "eingereicht".to_string() } else { "offen".to_string() }
}

pub fn mit_status(rechnung: Rechnung, person: &Person) -> RechnungMitStatus {
    let hat_beihilfestelle = person.beihilfestelle_id.is_some();
    let betrag = rechnung.betrag as f64 / 100.0;

    // Erwartete Anteile (nur wenn Beihilfestelle vorhanden bzw. immer für PKV)
    let beihilfe_anteil_erwartet = if hat_beihilfestelle {
        Some((betrag * person.beihilfe_satz as f64 / 100.0 * 100.0).round() / 100.0)
    } else {
        None
    };
    let pkv_anteil_erwartet = Some(
        (betrag * person.pkv_satz as f64 / 100.0 * 100.0).round() / 100.0
    );

    // Differenz: nur wenn erstattet_betrag gesetzt
    let beihilfe_differenz = rechnung.beihilfe_erstattet_betrag
        .zip(beihilfe_anteil_erwartet)
        .map(|(erstattet, erwartet)| ((erstattet - erwartet) * 100.0).round() / 100.0);
    let pkv_differenz = rechnung.pkv_erstattet_betrag
        .zip(pkv_anteil_erwartet)
        .map(|(erstattet, erwartet)| ((erstattet - erwartet) * 100.0).round() / 100.0);

    RechnungMitStatus {
        zahlung_status: zahlung_status(rechnung.bezahlt_am.as_deref()),
        beihilfe_status: beihilfe_status(hat_beihilfestelle, rechnung.beihilfe_eingereicht_am.as_deref()),
        pkv_status: pkv_status(rechnung.pkv_eingereicht_am.as_deref()),
        archiviert_status: if rechnung.archiviert_am.is_some() { "archiviert".to_string() } else { "aktiv".to_string() },
        betrag,
        beihilfe_anteil_erwartet,
        pkv_anteil_erwartet,
        beihilfe_differenz,
        pkv_differenz,
        id: rechnung.id,
        person_id: rechnung.person_id,
        leistungserbringer_id: rechnung.leistungserbringer_id,
        typ: rechnung.typ,
        datum: rechnung.datum,
        zahlungsziel: rechnung.zahlungsziel,
        bezahlt_am: rechnung.bezahlt_am,
        beihilfe_eingereicht_am: rechnung.beihilfe_eingereicht_am,
        pkv_eingereicht_am: rechnung.pkv_eingereicht_am,
        notiz: rechnung.notiz,
        archiviert_am: rechnung.archiviert_am,
        referenz_nr: rechnung.referenz_nr,
        beihilfe_erstattet_betrag: rechnung.beihilfe_erstattet_betrag,
        pkv_erstattet_betrag: rechnung.pkv_erstattet_betrag,
        pkv_gescannt: rechnung.pkv_gescannt,
        beihilfe_gescannt: rechnung.beihilfe_gescannt,
        pkv_verzicht: rechnung.pkv_verzicht,
        paperless_doc_id: rechnung.paperless_doc_id,
        paperless_uebertragen_am: rechnung.paperless_uebertragen_am,
    }
}

pub fn kanban_gruppe(r: &RechnungMitStatus) -> &'static str {
    let bezahlt = r.zahlung_status == "bezahlt";
    let beihilfe_ok = r.beihilfe_status.as_deref() != Some("offen");
    let pkv_ok = r.pkv_status == "eingereicht";
    if bezahlt && beihilfe_ok && pkv_ok { return "abgeschlossen"; }
    if r.pkv_eingereicht_am.is_some() { return "pkv_eingereicht"; }
    if r.beihilfe_eingereicht_am.is_some() { return "beihilfe_eingereicht"; }
    if bezahlt { return "bezahlt"; }
    "neu"
}
