use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Anhang {
    pub id: String,
    pub rechnung_id: String,
    pub dateiname: String,
    pub groesse: i64,
    pub hochgeladen_am: String,
    /// Relativer Pfad unterhalb uploads_dir – wird nicht an den Client gesendet
    #[serde(skip)]
    pub pfad: String,
}
