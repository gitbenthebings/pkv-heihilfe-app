use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Person {
    pub id: String,
    pub mandant_id: String,
    pub name: String,
    pub geburtsdatum: String,
    pub typ: String,
    pub beihilfestelle_id: Option<String>,
    pub beihilfe_satz: i64,
    pub pkv_satz: i64,
    pub bre_schwelle: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePerson {
    pub name: String,
    pub geburtsdatum: String,
    pub typ: String,
    pub beihilfestelle_id: Option<String>,
    pub beihilfe_satz: i64,
    pub pkv_satz: i64,
    pub bre_schwelle: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePerson {
    pub name: Option<String>,
    pub geburtsdatum: Option<String>,
    pub typ: Option<String>,
    pub beihilfestelle_id: Option<String>,
    pub beihilfe_satz: Option<i64>,
    pub pkv_satz: Option<i64>,
    pub bre_schwelle: Option<f64>,
}
