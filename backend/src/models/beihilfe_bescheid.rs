use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BeihilfeBescheid {
    pub id: String,
    pub mandant_id: String,
    pub antrag_id: String,
    pub aktenzeichen: Option<String>,
    pub bescheid_datum: String,
    pub eingangsdatum: Option<String>,
    pub erstattungsbetrag_gesamt: i64, // Cent
    pub typ: String,
    pub notiz: Option<String>,
    pub erstellt_am: String,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BescheidPosition {
    pub id: String,
    pub bescheid_id: String,
    pub rechnung_id: String,
    pub tatsaechliche_kosten: Option<i64>,
    pub anerkannt_betrag: Option<i64>,
    pub abgelehnt_betrag: Option<i64>,
    pub ablehnungsgrund: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBeihilfeBescheid {
    pub aktenzeichen: Option<String>,
    pub bescheid_datum: String,
    pub eingangsdatum: Option<String>,
    pub erstattungsbetrag_gesamt: f64,
    pub typ: Option<String>,
    pub notiz: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeihilfeBescheid {
    pub aktenzeichen: Option<String>,
    pub bescheid_datum: Option<String>,
    pub eingangsdatum: Option<String>,
    pub erstattungsbetrag_gesamt: Option<f64>,
    pub typ: Option<String>,
    pub notiz: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBescheidPosition {
    pub rechnung_id: String,
    pub tatsaechliche_kosten: Option<f64>,
    pub anerkannt_betrag: Option<f64>,
    pub abgelehnt_betrag: Option<f64>,
    pub ablehnungsgrund: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBescheidPosition {
    pub tatsaechliche_kosten: Option<f64>,
    pub anerkannt_betrag: Option<f64>,
    pub abgelehnt_betrag: Option<f64>,
    pub ablehnungsgrund: Option<String>,
}
