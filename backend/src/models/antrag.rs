use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Antrag {
    pub id: String,
    pub mandant_id: String,
    pub typ: String,
    pub status: String,
    pub referenz_nr: Option<i64>,
    pub titel: Option<String>,
    pub notiz: Option<String>,
    pub beihilfestelle_id: Option<String>,
    pub pkv_id: Option<String>,
    pub pkv_versicherer: Option<String>,
    pub paperless_share_url: Option<String>,
    pub versendet_am: Option<String>,
    pub erstellt_am: String,
    pub aktualisiert_am: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAntrag {
    pub typ: String,
    pub titel: Option<String>,
    pub notiz: Option<String>,
    pub beihilfestelle_id: Option<String>,
    pub pkv_id: Option<String>,
    pub pkv_versicherer: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAntrag {
    pub titel: Option<String>,
    pub notiz: Option<String>,
    pub beihilfestelle_id: Option<serde_json::Value>,
    pub pkv_id: Option<serde_json::Value>,
    pub pkv_versicherer: Option<serde_json::Value>,
    pub paperless_share_url: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct SetAntragStatus {
    pub status: String,
    pub versendet_am: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AntragRechnung {
    pub antrag_id: String,
    pub rechnung_id: String,
    pub widerspruch: bool,
}

#[derive(Debug, Deserialize)]
pub struct AddRechnung {
    pub rechnung_id: String,
}
