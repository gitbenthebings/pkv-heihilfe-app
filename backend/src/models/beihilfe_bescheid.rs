use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BeihilfeBescheid {
    pub id: String,
    pub antrag_id: String,
    pub typ: String,
    pub dateiname: String,
    pub groesse: i64,
    pub analyse_status: String,
    pub analyse_fehler: Option<String>,
    pub datum: Option<String>,
    pub aktenzeichen: Option<String>,
    pub erstellt_am: String,
    #[serde(skip)]
    pub pfad: String,
}

#[derive(Debug, Deserialize)]
pub struct N8nCallback {
    pub bescheid_id: String,
    pub status: String,
    pub fehler: Option<String>,
    pub datum: Option<String>,
    pub aktenzeichen: Option<String>,
    pub positionen: Option<Vec<N8nPosition>>,
}

#[derive(Debug, Deserialize)]
pub struct N8nPosition {
    pub lfd_nr: Option<i64>,
    pub rechnungsdatum: Option<String>,
    pub leistungserbringer: Option<String>,
    pub rechnungsbetrag: Option<i64>,
    pub anerkannt_betrag: Option<i64>,
    pub abgelehnt_betrag: Option<i64>,
    pub beihilfe_betrag: Option<i64>,
    pub ablehnungsgrund: Option<String>,
}
