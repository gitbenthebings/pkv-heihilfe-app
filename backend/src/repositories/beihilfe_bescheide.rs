use crate::{
    db::Db,
    errors::AppError,
    models::beihilfe_bescheid::{
        BeihilfeBescheid, BescheidPosition,
        CreateBeihilfeBescheid, UpdateBeihilfeBescheid,
        CreateBescheidPosition, UpdateBescheidPosition,
    },
};
use chrono::Utc;
use uuid::Uuid;

const SELECT_BESCHEID: &str = "SELECT id, mandant_id, antrag_id, aktenzeichen, bescheid_datum, eingangsdatum, erstattungsbetrag_gesamt, typ, notiz, erstellt_am FROM beihilfe_bescheid";
const SELECT_POSITION: &str = "SELECT id, bescheid_id, rechnung_id, tatsaechliche_kosten, anerkannt_betrag, abgelehnt_betrag, ablehnungsgrund FROM beihilfe_bescheid_position";

pub async fn list_by_antrag(
    db: &Db,
    antrag_id: &str,
    mandant_id: &str,
) -> Result<Vec<BeihilfeBescheid>, AppError> {
    let rows = sqlx::query_as::<_, BeihilfeBescheid>(&format!(
        "{SELECT_BESCHEID} WHERE antrag_id = ? AND mandant_id = ? ORDER BY bescheid_datum DESC"
    ))
    .bind(antrag_id)
    .bind(mandant_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn get(db: &Db, id: &str, mandant_id: &str) -> Result<Option<BeihilfeBescheid>, AppError> {
    let row = sqlx::query_as::<_, BeihilfeBescheid>(&format!(
        "{SELECT_BESCHEID} WHERE id = ? AND mandant_id = ?"
    ))
    .bind(id)
    .bind(mandant_id)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn create(
    db: &Db,
    mandant_id: &str,
    antrag_id: &str,
    input: &CreateBeihilfeBescheid,
) -> Result<BeihilfeBescheid, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let betrag_cent = (input.erstattungsbetrag_gesamt * 100.0).round() as i64;
    let typ = input.typ.as_deref().unwrap_or("erstbescheid");

    sqlx::query(
        "INSERT INTO beihilfe_bescheid (id, mandant_id, antrag_id, aktenzeichen, bescheid_datum, eingangsdatum, erstattungsbetrag_gesamt, typ, notiz, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(mandant_id)
    .bind(antrag_id)
    .bind(&input.aktenzeichen)
    .bind(&input.bescheid_datum)
    .bind(&input.eingangsdatum)
    .bind(betrag_cent)
    .bind(typ)
    .bind(&input.notiz)
    .bind(&now)
    .execute(db)
    .await?;

    Ok(get(db, &id, mandant_id).await?.unwrap())
}

pub async fn update(
    db: &Db,
    id: &str,
    mandant_id: &str,
    input: &UpdateBeihilfeBescheid,
) -> Result<BeihilfeBescheid, AppError> {
    let betrag_cent = input.erstattungsbetrag_gesamt.map(|v| (v * 100.0).round() as i64);

    sqlx::query(
        "UPDATE beihilfe_bescheid SET
         aktenzeichen = COALESCE(?, aktenzeichen),
         bescheid_datum = COALESCE(?, bescheid_datum),
         eingangsdatum = COALESCE(?, eingangsdatum),
         erstattungsbetrag_gesamt = COALESCE(?, erstattungsbetrag_gesamt),
         typ = COALESCE(?, typ),
         notiz = COALESCE(?, notiz)
         WHERE id = ? AND mandant_id = ?"
    )
    .bind(&input.aktenzeichen)
    .bind(&input.bescheid_datum)
    .bind(&input.eingangsdatum)
    .bind(betrag_cent)
    .bind(&input.typ)
    .bind(&input.notiz)
    .bind(id)
    .bind(mandant_id)
    .execute(db)
    .await?;

    get(db, id, mandant_id).await?.ok_or(AppError::NotFound)
}

pub async fn delete(db: &Db, id: &str, mandant_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM beihilfe_bescheid WHERE id = ? AND mandant_id = ?")
        .bind(id)
        .bind(mandant_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn list_positionen(
    db: &Db,
    bescheid_id: &str,
) -> Result<Vec<BescheidPosition>, AppError> {
    let rows = sqlx::query_as::<_, BescheidPosition>(&format!(
        "{SELECT_POSITION} WHERE bescheid_id = ? ORDER BY id ASC"
    ))
    .bind(bescheid_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_position(
    db: &Db,
    bescheid_id: &str,
    input: &CreateBescheidPosition,
) -> Result<BescheidPosition, AppError> {
    let id = Uuid::new_v4().to_string();
    let tatsaechlich = input.tatsaechliche_kosten.map(|v| (v * 100.0).round() as i64);
    let anerkannt = input.anerkannt_betrag.map(|v| (v * 100.0).round() as i64);
    let abgelehnt = input.abgelehnt_betrag.map(|v| (v * 100.0).round() as i64);

    sqlx::query(
        "INSERT INTO beihilfe_bescheid_position (id, bescheid_id, rechnung_id, tatsaechliche_kosten, anerkannt_betrag, abgelehnt_betrag, ablehnungsgrund)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(bescheid_id)
    .bind(&input.rechnung_id)
    .bind(tatsaechlich)
    .bind(anerkannt)
    .bind(abgelehnt)
    .bind(&input.ablehnungsgrund)
    .execute(db)
    .await?;

    let row = sqlx::query_as::<_, BescheidPosition>(&format!(
        "{SELECT_POSITION} WHERE id = ?"
    ))
    .bind(&id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

pub async fn update_position(
    db: &Db,
    id: &str,
    input: &UpdateBescheidPosition,
) -> Result<BescheidPosition, AppError> {
    let tatsaechlich = input.tatsaechliche_kosten.map(|v| (v * 100.0).round() as i64);
    let anerkannt = input.anerkannt_betrag.map(|v| (v * 100.0).round() as i64);
    let abgelehnt = input.abgelehnt_betrag.map(|v| (v * 100.0).round() as i64);

    sqlx::query(
        "UPDATE beihilfe_bescheid_position SET
         tatsaechliche_kosten = COALESCE(?, tatsaechliche_kosten),
         anerkannt_betrag = COALESCE(?, anerkannt_betrag),
         abgelehnt_betrag = COALESCE(?, abgelehnt_betrag),
         ablehnungsgrund = COALESCE(?, ablehnungsgrund)
         WHERE id = ?"
    )
    .bind(tatsaechlich)
    .bind(anerkannt)
    .bind(abgelehnt)
    .bind(&input.ablehnungsgrund)
    .bind(id)
    .execute(db)
    .await?;

    let row = sqlx::query_as::<_, BescheidPosition>(&format!(
        "{SELECT_POSITION} WHERE id = ?"
    ))
    .bind(id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

pub async fn get_position(db: &Db, id: &str) -> Result<Option<BescheidPosition>, AppError> {
    let row = sqlx::query_as::<_, BescheidPosition>(&format!(
        "{SELECT_POSITION} WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn delete_position(db: &Db, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM beihilfe_bescheid_position WHERE id = ?")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn list_rechnung_ids_by_bescheid(db: &Db, bescheid_id: &str) -> Result<Vec<String>, AppError> {
    let ids = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT rechnung_id FROM beihilfe_bescheid_position WHERE bescheid_id = ?"
    )
    .bind(bescheid_id)
    .fetch_all(db)
    .await?;
    Ok(ids)
}
