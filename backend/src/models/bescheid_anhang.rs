use serde::Serialize;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BescheidAnhang {
    pub id: String,
    pub bescheid_id: String,
    pub dateiname: String,
    pub groesse: i64,
    pub hochgeladen_am: String,
    #[serde(skip)]
    pub pfad: String,
}
