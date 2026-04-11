use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Correspondent {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub typ: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCorrespondent {
    pub name: String,
    pub typ: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCorrespondent {
    pub name: Option<String>,
    pub typ: Option<String>,
}
