use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pkv {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub personen_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePkv {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePkv {
    pub name: Option<String>,
}
