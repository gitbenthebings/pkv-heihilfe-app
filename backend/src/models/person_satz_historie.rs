use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PersonSatzHistorie {
    pub id: String,
    pub person_id: String,
    pub beihilfe_satz: i64,
    pub pkv_satz: i64,
    pub gueltig_ab: String,
    pub erstellt_am: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePersonSatzHistorie {
    pub beihilfe_satz: i64,
    pub pkv_satz: i64,
    pub gueltig_ab: String,
}
