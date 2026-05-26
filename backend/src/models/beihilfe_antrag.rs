use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BeihilfeAntrag {
    pub id: String,
    pub mandant_id: String,
    pub typ: String,
    pub beihilfestelle_id: Option<String>,
    pub pkv_id: Option<String>,
    pub pkv_versicherer: Option<String>,
    pub referenz_nr: i64,
    pub titel: Option<String>,
    pub status: String,
    pub versendet_am: Option<String>,
    pub notiz: Option<String>,
    pub paperless_share_url: Option<String>,
    pub erstellt_am: String,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct AntragRechnung {
    pub antrag_id: String,
    pub rechnung_id: String,
    pub widerspruch: bool,
    pub hinzugefuegt_am: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBeihilfeAntrag {
    pub typ: Option<String>,            // 'beihilfe' | 'pkv'; Default: 'beihilfe'
    pub beihilfestelle_id: Option<String>,
    pub pkv_id: Option<String>,
    pub pkv_versicherer: Option<String>,
    pub titel: Option<String>,
    pub notiz: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeihilfeAntrag {
    pub beihilfestelle_id: Option<String>,
    pub pkv_id: Option<String>,
    pub pkv_versicherer: Option<String>,
    pub titel: Option<String>,
    pub notiz: Option<String>,
    pub versendet_am: Option<String>,
    pub paperless_share_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetAntragStatus {
    pub status: String,
    pub versendet_am: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddRechnungToAntrag {
    pub rechnung_id: String,
    pub widerspruch: Option<bool>,
}
