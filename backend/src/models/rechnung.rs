use serde::{Deserialize, Deserializer, Serialize};

/// Deserialisiert Option<Option<f64>>:
/// - Feld fehlt → None (nicht ändern)
/// - Feld ist null → Some(None) (auf NULL setzen)
/// - Feld ist Zahl → Some(Some(v)) (Wert setzen)
fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Deserialize::deserialize(de).map(Some)
}

/// Raw DB row – kein Status gespeichert
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Rechnung {
    pub id: String,
    pub mandant_id: String,
    pub person_id: String,
    pub leistungserbringer_id: String,
    pub typ: String,
    pub betrag: i64, // Cent
    pub datum: String,
    pub zahlungsziel: Option<String>,
    pub bezahlt_am: Option<String>,
    pub beihilfe_eingereicht_am: Option<String>,
    pub pkv_eingereicht_am: Option<String>,
    pub notiz: Option<String>,
    pub archiviert_am: Option<String>,
    pub referenz_nr: Option<i64>,
    pub beihilfe_erstattet_betrag: Option<f64>,
    pub pkv_erstattet_betrag: Option<f64>,
    pub pkv_gescannt: bool,
    pub beihilfe_gescannt: bool,
}

/// Für API-Antworten: mit berechnetem Status, Eurobetrag und Derived Fields
#[derive(Debug, Clone, Serialize)]
pub struct RechnungMitStatus {
    pub id: String,
    pub person_id: String,
    pub leistungserbringer_id: String,
    pub typ: String,
    pub betrag: f64,
    pub datum: String,
    pub zahlungsziel: Option<String>,
    pub bezahlt_am: Option<String>,
    pub beihilfe_eingereicht_am: Option<String>,
    pub pkv_eingereicht_am: Option<String>,
    pub notiz: Option<String>,
    pub archiviert_am: Option<String>,
    pub referenz_nr: Option<i64>,
    // Erstattungsfelder (gespeichert)
    pub beihilfe_erstattet_betrag: Option<f64>,
    pub pkv_erstattet_betrag: Option<f64>,
    // Derived State
    pub zahlung_status: String,
    pub beihilfe_status: Option<String>,
    pub pkv_status: String,
    pub archiviert_status: String,
    pub beihilfe_anteil_erwartet: Option<f64>,
    pub pkv_anteil_erwartet: Option<f64>,
    pub beihilfe_differenz: Option<f64>,
    pub pkv_differenz: Option<f64>,
    pub pkv_gescannt: bool,
    pub beihilfe_gescannt: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateRechnung {
    pub person_id: String,
    pub leistungserbringer_id: String,
    pub typ: String,
    pub betrag: f64,
    pub datum: String,
    pub zahlungsziel: Option<String>,
    pub notiz: Option<String>,
    pub gescannt: Option<bool>,
    pub pkv_gescannt: Option<bool>,
    pub beihilfe_gescannt: Option<bool>,
}

/// Alle Felder optional.
/// String-Felder: "" bedeutet NULL setzen.
/// Erstattungsfelder: None = nicht ändern, Some(None) = NULL, Some(Some(v)) = Wert
#[derive(Debug, Deserialize)]
pub struct UpdateRechnung {
    pub bezahlt_am: Option<String>,
    pub beihilfe_eingereicht_am: Option<String>,
    pub pkv_eingereicht_am: Option<String>,
    pub notiz: Option<String>,
    pub betrag: Option<f64>,
    pub datum: Option<String>,
    pub zahlungsziel: Option<String>,
    pub leistungserbringer_id: Option<String>,
    pub typ: Option<String>,
    pub person_id: Option<String>,
    pub pkv_gescannt: Option<bool>,
    pub beihilfe_gescannt: Option<bool>,
    #[serde(default, deserialize_with = "double_option")]
    pub beihilfe_erstattet_betrag: Option<Option<f64>>,
    #[serde(default, deserialize_with = "double_option")]
    pub pkv_erstattet_betrag: Option<Option<f64>>,
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BulkAction {
    Bezahlt,
    BeihilfeEingereicht,
    PkvEingereicht,
    Archivieren,
    Dearchivieren,
}

#[derive(Debug, Deserialize)]
pub struct BulkActionRequest {
    pub ids: Vec<String>,
    pub action: BulkAction,
}
