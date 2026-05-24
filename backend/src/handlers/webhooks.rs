use axum::{extract::State, http::StatusCode, Json};

use crate::{errors::AppError, models::beihilfe_bescheid::N8nCallback, repositories, AppState};

pub async fn n8n_bescheid_analyse(
    State(state): State<AppState>,
    Json(body): Json<N8nCallback>,
) -> Result<StatusCode, AppError> {
    let bescheid = repositories::beihilfe_bescheide::get_by_id(&state.db, &body.bescheid_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if body.status == "fehler" {
        repositories::beihilfe_bescheide::update_analyse_status(
            &state.db,
            &bescheid.id,
            "fehler",
            body.fehler.as_deref(),
        ).await?;
        return Ok(StatusCode::OK);
    }

    repositories::beihilfe_bescheide::update_analyse_ergebnis(
        &state.db,
        &bescheid.id,
        body.datum.as_deref(),
        body.aktenzeichen.as_deref(),
    ).await?;

    if let Some(positionen) = &body.positionen {
        for (i, pos) in positionen.iter().enumerate() {
            let lfd_nr = pos.lfd_nr.unwrap_or(i as i64 + 1);
            repositories::beihilfe_positionen::create_from_n8n(
                &state.db, &bescheid.id, lfd_nr, pos,
            ).await?;
        }
    }

    repositories::beihilfe_bescheide::update_analyse_status(
        &state.db, &bescheid.id, "abgeschlossen", None,
    ).await?;

    tracing::info!("Bescheid {} analysiert, {} Positionen gespeichert",
        bescheid.id,
        body.positionen.as_ref().map(|p| p.len()).unwrap_or(0));

    Ok(StatusCode::OK)
}
