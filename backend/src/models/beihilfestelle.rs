use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Beihilfestelle {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub dienstherr_typ: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBeihilfestelle {
    pub name: String,
    pub dienstherr_typ: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBeihilfestelle {
    pub name: Option<String>,
    pub dienstherr_typ: Option<String>,
}
