use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Beleg {
    pub id: String,
    pub dateiname: String,
    pub bezeichnung: Option<String>,
    pub groesse: i64,
    pub datum: Option<String>,
    pub eingangsdatum: Option<String>,
    pub typ: Option<String>,
    pub aktenzeichen: Option<String>,
    pub betrag: Option<f64>,       // Euro
    pub aussteller: Option<String>,
    pub notiz: Option<String>,
    pub hochgeladen_am: String,
    pub has_thumbnail: bool,
    pub ocr_text: Option<String>,
    pub ocr_status: Option<String>,
    #[serde(skip)]
    pub pfad: String,
    #[serde(skip)]
    pub thumbnail_pfad: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeleg {
    pub bezeichnung: Option<String>,
    pub datum: Option<String>,
    pub eingangsdatum: Option<String>,
    pub typ: Option<String>,
    pub aktenzeichen: Option<String>,
    pub betrag: Option<f64>,
    pub aussteller: Option<String>,
    pub notiz: Option<String>,
}
