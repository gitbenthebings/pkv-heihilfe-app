use crate::{db::Db, errors::AppError, models::{Person, CreatePerson, UpdatePerson}};

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Person>, AppError> {
    let personen = sqlx::query_as::<_, Person>(
        "SELECT id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle
         FROM person WHERE mandant_id = ? ORDER BY name"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(personen)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Person>, AppError> {
    let p = sqlx::query_as::<_, Person>(
        "SELECT id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle
         FROM person WHERE id = ? AND mandant_id = ?"
    )
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(p)
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreatePerson) -> Result<Person, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let beihilfestelle_id = input.beihilfestelle_id.as_deref()
        .and_then(|v| if v.is_empty() { None } else { Some(v) });
    sqlx::query(
        "INSERT INTO person (id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&input.geburtsdatum)
    .bind(&input.typ)
    .bind(beihilfestelle_id)
    .bind(input.beihilfe_satz)
    .bind(input.pkv_satz)
    .bind(input.bre_schwelle)
    .execute(db)
    .await?;

    // Initialen Satz-Historie-Eintrag anlegen, damit find_satz_fuer_datum() für alle Rechnungen greift
    let history_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    sqlx::query(
        "INSERT INTO person_satz_historie (id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am)
         VALUES (?, ?, ?, ?, '1900-01-01', ?)"
    )
    .bind(&history_id)
    .bind(&id)
    .bind(input.beihilfe_satz)
    .bind(input.pkv_satz)
    .bind(&now)
    .execute(db)
    .await?;

    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdatePerson) -> Result<Person, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let geburtsdatum = input.geburtsdatum.as_deref().unwrap_or(&existing.geburtsdatum);
    let typ = input.typ.as_deref().unwrap_or(&existing.typ);
    let beihilfestelle_id = match &input.beihilfestelle_id {
        Some(v) if v.is_empty() => None,
        Some(v) => Some(v.as_str()),
        None => existing.beihilfestelle_id.as_deref(),
    };
    let beihilfe_satz = input.beihilfe_satz.unwrap_or(existing.beihilfe_satz);
    let pkv_satz = input.pkv_satz.unwrap_or(existing.pkv_satz);
    let bre_schwelle = match input.bre_schwelle {
        None => existing.bre_schwelle,       // Feld fehlt → behalten
        Some(None) => None,                  // explizites null → löschen
        Some(Some(v)) => Some(v),            // Wert → setzen
    };

    sqlx::query(
        "UPDATE person SET name = ?, geburtsdatum = ?, typ = ?, beihilfestelle_id = ?,
         beihilfe_satz = ?, pkv_satz = ?, bre_schwelle = ? WHERE id = ? AND mandant_id = ?"
    )
    .bind(name)
    .bind(geburtsdatum)
    .bind(typ)
    .bind(beihilfestelle_id)
    .bind(beihilfe_satz)
    .bind(pkv_satz)
    .bind(bre_schwelle)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM person WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
