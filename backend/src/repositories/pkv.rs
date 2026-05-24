use crate::{db::Db, errors::AppError, models::pkv::{CreatePkv, Pkv, UpdatePkv}};

#[derive(sqlx::FromRow)]
struct PkvRow {
    id: String,
    mandant_id: String,
    name: String,
    personen_ids_json: String,
}

impl From<PkvRow> for Pkv {
    fn from(r: PkvRow) -> Self {
        Pkv {
            id: r.id,
            mandant_id: r.mandant_id,
            name: r.name,
            personen_ids: serde_json::from_str(&r.personen_ids_json).unwrap_or_default(),
        }
    }
}

const SELECT: &str = "SELECT p.id, p.mandant_id, p.name,
    COALESCE(JSON_GROUP_ARRAY(pp.person_id) FILTER (WHERE pp.person_id IS NOT NULL), '[]') AS personen_ids_json
    FROM pkv p LEFT JOIN pkv_person pp ON pp.pkv_id = p.id";

pub async fn list_by_mandant(db: &Db, mandant_id: &str) -> Result<Vec<Pkv>, AppError> {
    let rows = sqlx::query_as::<_, PkvRow>(&format!(
        "{SELECT} WHERE p.mandant_id = ? GROUP BY p.id ORDER BY p.name"
    ))
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<Pkv>, AppError> {
    let row = sqlx::query_as::<_, PkvRow>(&format!(
        "{SELECT} WHERE p.id = ? AND p.mandant_id = ? GROUP BY p.id"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(row.map(Into::into))
}

pub async fn create(db: &Db, mandant_id: &str, input: &CreatePkv) -> Result<Pkv, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO pkv (id, mandant_id, name) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(mandant_id)
        .bind(&input.name)
        .execute(db)
        .await?;
    get(db, &id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn update(db: &Db, id: &str, mandant_id: &str, input: &UpdatePkv) -> Result<Pkv, AppError> {
    let existing = get(db, id, mandant_id).await?.ok_or(AppError::NotFound)?;
    let name = input.name.as_deref().unwrap_or(&existing.name);
    sqlx::query("UPDATE pkv SET name = ? WHERE id = ? AND mandant_id = ?")
        .bind(name)
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    let rows = sqlx::query("DELETE FROM pkv WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?
        .rows_affected();
    if rows == 0 { return Err(AppError::NotFound); }
    Ok(())
}

pub async fn add_person(db: &Db, pkv_id: &str, person_id: &str) -> Result<(), AppError> {
    sqlx::query("INSERT OR IGNORE INTO pkv_person (pkv_id, person_id) VALUES (?, ?)")
        .bind(pkv_id)
        .bind(person_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn remove_person(db: &Db, pkv_id: &str, person_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM pkv_person WHERE pkv_id = ? AND person_id = ?")
        .bind(pkv_id)
        .bind(person_id)
        .execute(db)
        .await?;
    Ok(())
}
