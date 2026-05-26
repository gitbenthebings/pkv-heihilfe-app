use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct RechnungAktivitaet {
    pub id: String,
    pub mandant_id: String,
    pub rechnung_id: String,
    pub benutzer_id: Option<String>,
    pub aktion: String,
    pub aenderungen: String, // JSON-Array
    pub erstellt_am: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AktivitaetDiff {
    pub feld: String,
    pub alt: Option<String>,
    pub neu: Option<String>,
}
