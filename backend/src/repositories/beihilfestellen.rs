use crate::{db::Db, errors::AppError, models::{Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle}};

#[derive(sqlx::FromRow)]
struct BeihilfestelleRow {
    id: String,
    mandant_id: String,
    name: String,
    dienstherr_typ: String,
    personen_ids_json: String,
}

impl From<BeihilfestelleRow> for Beihilfestelle {
    fn from(r: BeihilfestelleRow) -> Self {
        Beihilfestelle {
            id: r.id,
            mandant_id: r.mandant_id,
            name: r.name,
            dienstherr_typ: r.dienstherr_typ,
            personen_ids: serde_json::from_str(&r.personen_ids_json).unwrap_or_default(),
        }
    }
}

const SELECT: &str = "SELECT b.id, b.mandant_id, b.name, b.dienstherr_typ,
    COALESCE(JSON_GROUP_ARRAY(bp.person_id) FILTER (WHERE bp.person_id IS NOT NULL), '[]') AS personen_ids_json
    FROM beihilfestelle b LEFT JOIN beihilfestelle_person bp ON bp.beihilfestelle_id = b.id";

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Beihilfestelle>, AppError> {
    let rows = sqlx::query_as::<_, BeihilfestelleRow>(&format!(
        "{SELECT} WHERE b.mandant_id = ? GROUP BY b.id ORDER BY b.name"
    ))
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Beihilfestelle>, AppError> {
    let row = sqlx::query_as::<_, BeihilfestelleRow>(&format!(
        "{SELECT} WHERE b.id = ? AND b.mandant_id = ? GROUP BY b.id"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(row.map(Into::into))
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreateBeihilfestelle) -> Result<Beihilfestelle, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO beihilfestelle (id, mandant_id, name, dienstherr_typ) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(&input.name)
    .bind(&input.dienstherr_typ)
    .execute(db)
    .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdateBeihilfestelle) -> Result<Beihilfestelle, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    let dienstherr_typ = input.dienstherr_typ.as_deref().unwrap_or(&existing.dienstherr_typ);
    sqlx::query(
        "UPDATE beihilfestelle SET name = ?, dienstherr_typ = ? WHERE id = ? AND mandant_id = ?"
    )
    .bind(name)
    .bind(dienstherr_typ)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM beihilfestelle WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub async fn add_person(db: &Db, beihilfestelle_id: &str, person_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO beihilfestelle_person (beihilfestelle_id, person_id) VALUES (?, ?)"
    )
    .bind(beihilfestelle_id)
    .bind(person_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_person(db: &Db, beihilfestelle_id: &str, person_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM beihilfestelle_person WHERE beihilfestelle_id = ? AND person_id = ?")
        .bind(beihilfestelle_id)
        .bind(person_id)
        .execute(db)
        .await?;
    Ok(())
}
