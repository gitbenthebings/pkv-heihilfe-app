use crate::{db::Db, errors::AppError, models::person_satz_historie::{CreatePersonSatzHistorie, PersonSatzHistorie}};
use chrono::Utc;

pub async fn list_by_person(db: &Db, person_id: &str) -> Result<Vec<PersonSatzHistorie>, AppError> {
    let items = sqlx::query_as::<_, PersonSatzHistorie>(
        "SELECT id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am
         FROM person_satz_historie WHERE person_id = ? ORDER BY gueltig_ab DESC"
    )
    .bind(person_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn create(
    db: &Db,
    person_id: &str,
    input: &CreatePersonSatzHistorie,
) -> Result<PersonSatzHistorie, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
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

    let item = sqlx::query_as::<_, PersonSatzHistorie>(
        "SELECT id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am
         FROM person_satz_historie WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(db)
    .await?;
    Ok(item)
}

pub async fn delete(db: &Db, id: &str, person_id: &str) -> Result<(), AppError> {
    let rows = sqlx::query(
        "DELETE FROM person_satz_historie WHERE id = ? AND person_id = ?"
    )
    .bind(id)
    .bind(person_id)
    .execute(db)
    .await?
    .rows_affected();
    if rows == 0 { return Err(AppError::NotFound); }
    Ok(())
}
