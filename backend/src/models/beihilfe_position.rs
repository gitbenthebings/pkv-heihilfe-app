use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BeihilfePosition {
    pub id: String,
    pub bescheid_id: String,
    pub lfd_nr: i64,
    pub rechnungsdatum: Option<String>,
    pub leistungserbringer: Option<String>,
    pub rechnungsbetrag: Option<i64>,
    pub anerkannt_betrag: Option<i64>,
    pub abgelehnt_betrag: Option<i64>,
    pub beihilfe_betrag: Option<i64>,
    pub ablehnungsgrund: Option<String>,
    pub rechnung_id: Option<String>,
    pub zugeordnet_am: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeihilfePosition {
    pub rechnung_id: Option<serde_json::Value>,
}
