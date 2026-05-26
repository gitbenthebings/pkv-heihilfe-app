use crate::{db::Db, errors::AppError, models::{PersonSatzHistorie, CreatePersonSatzHistorie}};

pub async fn list_by_person(db: &Db, person_id: &str) -> Result<Vec<PersonSatzHistorie>, AppError> {
    let entries = sqlx::query_as::<_, PersonSatzHistorie>(
        "SELECT id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am
         FROM person_satz_historie WHERE person_id = ? ORDER BY gueltig_ab DESC"
    )
    .bind(person_id)
    .fetch_all(db)
    .await?;
    Ok(entries)
}

/// Lädt die gesamte Satz-Historie aller Personen eines Mandanten in einem Query (kein N+1).
pub async fn list_for_mandant(db: &Db, mandant_id: &str) -> Result<Vec<PersonSatzHistorie>, AppError> {
    let entries = sqlx::query_as::<_, PersonSatzHistorie>(
        "SELECT h.id, h.person_id, h.beihilfe_satz, h.pkv_satz, h.gueltig_ab, h.erstellt_am
         FROM person_satz_historie h
         JOIN person p ON p.id = h.person_id
         WHERE p.mandant_id = ?
         ORDER BY h.person_id, h.gueltig_ab"
    )
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(entries)
}

pub async fn create(db: &Db, person_id: &str, mandant_id: &str, input: &CreatePersonSatzHistorie) -> Result<PersonSatzHistorie, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

    sqlx::query(
        "INSERT INTO person_satz_historie (id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(person_id)
    .bind(input.beihilfe_satz)
    .bind(input.pkv_satz)
    .bind(&input.gueltig_ab)
    .bind(&now)
    .execute(db)
    .await?;

    // Falls der neue Eintrag der neueste ist, person.beihilfe_satz/pkv_satz mitpflegen
    sqlx::query(
        "UPDATE person SET beihilfe_satz = ?, pkv_satz = ?
         WHERE id = ? AND mandant_id = ?
         AND NOT EXISTS (
             SELECT 1 FROM person_satz_historie
             WHERE person_id = ? AND gueltig_ab > ?
             AND id != ?
         )"
    )
    .bind(input.beihilfe_satz)
    .bind(input.pkv_satz)
    .bind(person_id)
    .bind(mandant_id)
    .bind(person_id)
    .bind(&input.gueltig_ab)
    .bind(&id)
    .execute(db)
    .await?;

    let entry = sqlx::query_as::<_, PersonSatzHistorie>(
        "SELECT id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am
         FROM person_satz_historie WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(db)
    .await?;
    Ok(entry)
}

pub async fn delete(db: &Db, id: &str, person_id: &str, mandant_id: &str) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM person_satz_historie WHERE person_id = ?"
    )
    .bind(person_id)
    .fetch_one(db)
    .await?;

    if count <= 1 {
        return Err(AppError::BadRequest("Der letzte Satz-Eintrag kann nicht gelöscht werden".to_string()));
    }

    let result = sqlx::query(
        "DELETE FROM person_satz_historie
         WHERE id = ? AND person_id = ?
         AND EXISTS (SELECT 1 FROM person WHERE id = ? AND mandant_id = ?)"
    )
    .bind(id)
    .bind(person_id)
    .bind(person_id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Nach Löschen: person.beihilfe_satz/pkv_satz auf den jetzt neuesten Eintrag setzen
    sqlx::query(
        "UPDATE person SET beihilfe_satz = h.beihilfe_satz, pkv_satz = h.pkv_satz
         FROM (SELECT beihilfe_satz, pkv_satz FROM person_satz_historie
               WHERE person_id = ? ORDER BY gueltig_ab DESC LIMIT 1) h
         WHERE person.id = ? AND person.mandant_id = ?"
    )
    .bind(person_id)
    .bind(person_id)
    .bind(mandant_id)
    .execute(db)
    .await
    .ok(); // best-effort

    Ok(())
}
