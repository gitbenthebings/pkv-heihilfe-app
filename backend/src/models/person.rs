use serde::{Deserialize, Deserializer, Serialize};

/// Unterscheidet zwischen fehlendem Feld (None = behalten) und explizitem null (Some(None) = löschen).
fn deser_opt_option<'de, D, T>(d: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::<T>::deserialize(d)?))
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
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
    /// None = Feld fehlt (behalten); Some(None) = explizites null (löschen); Some(Some(v)) = setzen
    #[serde(default, deserialize_with = "deser_opt_option")]
    pub bre_schwelle: Option<Option<f64>>,
}
