use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PkvRow {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub erstellt_am: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pkv {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub erstellt_am: String,
    #[serde(default)]
    pub personen_ids: Vec<String>,
}

impl Pkv {
    pub fn from_row(row: PkvRow, personen_ids: Vec<String>) -> Self {
        Self {
            id: row.id,
            mandant_id: row.mandant_id,
            name: row.name,
            erstellt_am: row.erstellt_am,
            personen_ids,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreatePkv {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePkv {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddPersonToPkv {
    pub person_id: String,
}
