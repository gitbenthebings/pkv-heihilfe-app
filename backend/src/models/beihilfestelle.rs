use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct BeihilfestelleRow {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub dienstherr_typ: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Beihilfestelle {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub dienstherr_typ: String,
    #[serde(default)]
    pub personen_ids: Vec<String>,
}

impl Beihilfestelle {
    pub fn from_row(row: BeihilfestelleRow, personen_ids: Vec<String>) -> Self {
        Self {
            id: row.id,
            mandant_id: row.mandant_id,
            name: row.name,
            dienstherr_typ: row.dienstherr_typ,
            personen_ids,
        }
    }
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

#[derive(Debug, Deserialize)]
pub struct AddPersonToBeihilfestelle {
    pub person_id: String,
}
