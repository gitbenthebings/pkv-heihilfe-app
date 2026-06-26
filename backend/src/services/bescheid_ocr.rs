use regex::Regex;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PositionVorschlag {
    pub rechnung_id: Option<String>,
    pub tatsaechliche_kosten: Option<f64>, // Euro
    pub anerkannt_betrag: Option<f64>,     // Euro — tatsächlicher Beihilfebetrag (letzte Spalte)
    pub abgelehnt_betrag: Option<f64>,     // Euro — nicht-beihilfefähiger Anteil
}

#[derive(Debug, Serialize)]
pub struct BescheidVorschlag {
    pub bescheid_datum: Option<String>,
    pub aktenzeichen: Option<String>,
    pub erstattungsbetrag_gesamt: Option<f64>, // Euro
    pub positionen: Vec<PositionVorschlag>,
}

pub struct RechnungRef {
    pub id: String,
    pub betrag_cent: i64,
}

/// "1.234,56" → 1234.56
fn parse_eur(s: &str) -> Option<f64> {
    let s = s.trim().replace('.', "").replace(',', ".");
    s.parse::<f64>().ok()
}

fn euro_amounts_in_line(line: &str) -> Vec<f64> {
    let re = Regex::new(r"(\d{1,3}(?:\.\d{3})*,\d{2})").unwrap();
    re.captures_iter(line)
        .filter_map(|c| parse_eur(c.get(1)?.as_str()))
        .filter(|&v| v > 0.5)
        .collect()
}

/// "11. Mai 2026" → Some("2026-05-11")
fn parse_long_date(text: &str) -> Option<String> {
    let re = Regex::new(
        r"(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})",
    )
    .ok()?;
    let c = re.captures(text)?;
    let day = c.get(1)?.as_str();
    let month_str = c.get(2)?.as_str().to_lowercase();
    let year = c.get(3)?.as_str();
    let month = match month_str.as_str() {
        "januar"    => "01", "februar"   => "02", "märz"      => "03",
        "april"     => "04", "mai"       => "05", "juni"      => "06",
        "juli"      => "07", "august"    => "08", "september" => "09",
        "oktober"   => "10", "november"  => "11", "dezember"  => "12",
        _ => return None,
    };
    Some(format!("{year}-{month}-{day:0>2}"))
}

pub fn parse(ocr_text: &str, rechnungen: &[RechnungRef]) -> BescheidVorschlag {
    // Aktenzeichen — offizielle Labels + BVA-spezifisch "Beihilfenummer" / "Leistungsnummer"
    let aktenzeichen = Regex::new(
        r"(?i)(?:aktenzeichen|az\.|a\.z\.|geschäftszeichen|gz\.|zeichen|unser zeichen|mein zeichen|beihilfenummer|leistungsnummer)\s*[:\-]?\s*([A-Za-z0-9/\.\-_]{3,50})",
    )
    .ok()
    .and_then(|re| re.captures(ocr_text))
    .and_then(|c| c.get(1))
    .map(|m| m.as_str().trim().to_string());

    // Bescheid-Datum: Priorität → langer Datumsform ("11. Mai 2026")
    //   dann kontextuelle DD.MM.YYYY ("Datum: …", "Bescheid vom …")
    //   dann erstes DD.MM.YYYY im Text (Fallback)
    let bescheid_datum = parse_long_date(ocr_text)
        .or_else(|| {
            Regex::new(
                r"(?i)(?:datum|bescheid(?:\s+v(?:om?)?))\s*[:\-]?\s*(\d{2})\.(\d{2})\.(\d{4})",
            )
            .ok()
            .and_then(|re| re.captures(ocr_text))
            .map(|c| {
                format!(
                    "{}-{}-{}",
                    c.get(3).unwrap().as_str(),
                    c.get(2).unwrap().as_str(),
                    c.get(1).unwrap().as_str()
                )
            })
        })
        .or_else(|| {
            Regex::new(r"(\d{2})\.(\d{2})\.(\d{4})")
                .ok()
                .and_then(|re| re.captures(ocr_text))
                .map(|c| {
                    format!(
                        "{}-{}-{}",
                        c.get(3).unwrap().as_str(),
                        c.get(2).unwrap().as_str(),
                        c.get(1).unwrap().as_str()
                    )
                })
        });

    // Gesamtbetrag — volltext
    let erstattungsbetrag_gesamt = Regex::new(
        r"(?i)(?:gesamtbetrag|gesamter\s+erstattungsbetrag|zu\s+erstatten|zu\s+überweisen|überweisungsbetrag|beihilfebetrag\s+insgesamt|beihilfe\s+insgesamt|summe\s+festgesetzte\s+beihilfe|auszahlungsbetrag|insgesamt)[^\d\n]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})",
    )
    .ok()
    .and_then(|re| re.captures(ocr_text))
    .and_then(|c| c.get(1))
    .and_then(|m| parse_eur(m.as_str()));

    // Positionsextraktion nur bis zur Erläuterungs-/Hinweissektion
    // (BVA-Bescheide haben nach der Haupttabelle eine B1/B2-Unteraufschlüsselung)
    let truncation_re = Regex::new(r"(?im)^Erläuterung\s+Berechnung").unwrap();
    let positions_text = if let Some(m) = truncation_re.find(ocr_text) {
        &ocr_text[..m.start()]
    } else {
        ocr_text
    };

    let skip_re = Regex::new(r"(?i)gesamt|summe|insgesamt|zwischensumme").unwrap();
    let mut seen_rechnung_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_amount_sigs: std::collections::HashSet<(i64, i64)> = std::collections::HashSet::new();
    let mut positionen: Vec<PositionVorschlag> = Vec::new();

    for line in positions_text.lines() {
        let l = line.trim();
        if l.is_empty() || skip_re.is_match(l) {
            continue;
        }

            let amounts = euro_amounts_in_line(line);
            if amounts.len() < 2 {
                continue;
            }

            let tatsaechliche_kosten = amounts.first().copied();

            // Spaltenlogik BVA-Bescheid:
            //   2 Beträge: [Rechnungsbetrag, Beihilfebetrag]
            //   3+ Beträge: [Rechnungsbetrag, Beihilfefähiger Betrag, Beihilfebetrag]
            //   → anerkannt_betrag = tatsächlich ausgezahlter Beihilfebetrag = letzter Betrag
            //   → abgelehnt_betrag = nicht-beihilfefähiger Anteil = amounts[0] - amounts[1] (bei ≥3)
            let (anerkannt_betrag, abgelehnt_betrag) = if amounts.len() >= 3 {
                let beihilfefaehig = amounts[1];
                let beihilfe_zahlung = *amounts.last().unwrap();
                let nicht_faehig = tatsaechliche_kosten.unwrap_or(0.0) - beihilfefaehig;
                let abgelehnt = if nicht_faehig > 0.01 { Some(nicht_faehig) } else { None };
                (Some(beihilfe_zahlung), abgelehnt)
            } else {
                // 2 Beträge: anerkannt = zweiter Betrag, kein abgelehnt ableitbar
                (amounts.get(1).copied(), None)
            };

            // Rechnung anhand Rechnungsbetrag matchen (±0,05 € Toleranz);
            // bereits gematchte Rechnungen aus dem Pool ausschließen
            let rechnung_id = tatsaechliche_kosten.and_then(|t| {
                let t_cent = (t * 100.0).round() as i64;
                rechnungen
                    .iter()
                    .filter(|r| !seen_rechnung_ids.contains(&r.id))
                    .find(|r| (r.betrag_cent - t_cent).abs() <= 5)
                    .map(|r| r.id.clone())
            });

            // Duplikate: bei Rechnung per ID, sonst per Betragskombination
            if let Some(ref rid) = rechnung_id {
                seen_rechnung_ids.insert(rid.clone());
            } else {
                let sig = (
                    (tatsaechliche_kosten.unwrap_or(0.0) * 100.0).round() as i64,
                    (anerkannt_betrag.unwrap_or(0.0) * 100.0).round() as i64,
                );
                if !seen_amount_sigs.insert(sig) {
                    continue;
                }
            }

            positionen.push(PositionVorschlag {
                rechnung_id,
                tatsaechliche_kosten,
                anerkannt_betrag,
                abgelehnt_betrag,
            });
    }

    BescheidVorschlag {
        bescheid_datum,
        aktenzeichen,
        erstattungsbetrag_gesamt,
        positionen,
    }
}
