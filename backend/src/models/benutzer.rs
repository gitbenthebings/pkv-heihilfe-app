use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Benutzer {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBenutzer {
    pub name: String,
    pub email: String,
    pub passwort: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBenutzer {
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswort {
    pub neues_passwort: String,
}
