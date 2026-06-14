use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone)]
pub struct LinkedRechnung {
    pub id: String,
    pub referenz_nr: Option<i64>,
    pub betrag: i64,
    pub datum: String,
    pub leistungserbringer: String,
    pub person: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LinkedAntrag {
    pub id: String,
    pub referenz_nr: i64,
    pub typ: String,
    pub stelle: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Beleg {
    pub id: String,
    pub dateiname: String,
    pub bezeichnung: Option<String>,
    pub groesse: i64,
    pub typ: Option<String>,
    pub notiz: Option<String>,
    pub datum: Option<String>,
    pub hochgeladen_am: String,
    pub has_thumbnail: bool,
    pub ocr_text: Option<String>,
    pub ocr_status: Option<String>,
    #[serde(skip)]
    pub pfad: String,
    #[serde(skip)]
    pub thumbnail_pfad: Option<String>,
    #[sqlx(skip)]
    pub linked_rechnungen: Vec<LinkedRechnung>,
    #[sqlx(skip)]
    pub linked_antraege: Vec<LinkedAntrag>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeleg {
    pub bezeichnung: Option<String>,
    pub typ: Option<String>,
    pub notiz: Option<String>,
    pub datum: Option<String>,
}
