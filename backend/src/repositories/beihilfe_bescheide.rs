use crate::{db::Db, errors::AppError, models::beihilfe_bescheid::BeihilfeBescheid};
use chrono::Utc;

const SELECT: &str = "SELECT id, antrag_id, typ, dateiname, pfad, groesse,
    analyse_status, analyse_fehler, datum, aktenzeichen, erstellt_am
    FROM beihilfe_bescheid";

pub async fn list_by_antrag(db: &Db, antrag_id: &str) -> Result<Vec<BeihilfeBescheid>, AppError> {
    let items = sqlx::query_as::<_, BeihilfeBescheid>(&format!(
        "{SELECT} WHERE antrag_id = ? ORDER BY erstellt_am ASC"
    ))
    .bind(antrag_id)
    .fetch_all(db)
    .await?;
    Ok(items)
}

pub async fn get_by_id(db: &Db, id: &str) -> Result<Option<BeihilfeBescheid>, AppError> {
    let item = sqlx::query_as::<_, BeihilfeBescheid>(&format!(
        "{SELECT} WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(db)
    .await?;
    Ok(item)
}

pub async fn get_by_id_and_antrag(
    db: &Db,
    id: &str,
    antrag_id: &str,
) -> Result<Option<BeihilfeBescheid>, AppError> {
    let item = sqlx::query_as::<_, BeihilfeBescheid>(&format!(
        "{SELECT} WHERE id = ? AND antrag_id = ?"
    ))
    .bind(id)
    .bind(antrag_id)
    .fetch_optional(db)
    .await?;
    Ok(item)
}

pub async fn create(
    db: &Db,
    id: &str,
    mandant_id: &str,
    antrag_id: &str,
    typ: &str,
    dateiname: &str,
    pfad: &str,
    groesse: i64,
) -> Result<BeihilfeBescheid, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO beihilfe_bescheid (id, mandant_id, antrag_id, typ, dateiname, pfad, groesse, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(mandant_id)
    .bind(antrag_id)
    .bind(typ)
    .bind(dateiname)
    .bind(pfad)
    .bind(groesse)
    .bind(&now)
    .execute(db)
    .await?;
    get_by_id(db, id).await?.ok_or(AppError::NotFound)
}

pub async fn update_analyse_status(
    db: &Db,
    id: &str,
    status: &str,
    fehler: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE beihilfe_bescheid SET analyse_status = ?, analyse_fehler = ? WHERE id = ?"
    )
    .bind(status)
    .bind(fehler)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_analyse_ergebnis(
    db: &Db,
    id: &str,
    datum: Option<&str>,
    aktenzeichen: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE beihilfe_bescheid SET datum = ?, aktenzeichen = ? WHERE id = ?"
    )
    .bind(datum)
    .bind(aktenzeichen)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn delete(db: &Db, id: &str, antrag_id: &str) -> Result<BeihilfeBescheid, AppError> {
    let item = get_by_id_and_antrag(db, id, antrag_id)
        .await?
        .ok_or(AppError::NotFound)?;
    sqlx::query("DELETE FROM beihilfe_bescheid WHERE id = ? AND antrag_id = ?")
        .bind(id)
        .bind(antrag_id)
        .execute(db)
        .await?;
    Ok(item)
}
