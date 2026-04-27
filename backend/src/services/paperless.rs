use std::path::PathBuf;

use crate::{db::Db, repositories};

#[derive(serde::Deserialize)]
struct PaperlessTask {
    status: String,
    related_document: Option<i64>,
}

/// Lädt alle PDF-Anhänge einer Rechnung nach Paperless NGX hoch.
/// Speichert paperless_doc_id und paperless_uebertragen_am in der DB.
/// Best-effort: Einzelfehler werden geloggt, nicht propagiert.
pub async fn upload_anhaenge(
    db: &Db,
    uploads_dir: &PathBuf,
    paperless_url: &str,
    paperless_token: &str,
    rechnung_id: &str,
    mandant_id: &str,
) -> anyhow::Result<()> {
    let rechnung = match repositories::rechnungen::get(db, rechnung_id, mandant_id).await? {
        Some(r) => r,
        None => return Ok(()),
    };

    let anhaenge = repositories::anhaenge::list_by_rechnung(db, rechnung_id).await?;
    if anhaenge.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();
    let endpoint = format!(
        "{}/api/documents/post_document/",
        paperless_url.trim_end_matches('/')
    );
    let tasks_endpoint = format!(
        "{}/api/tasks/",
        paperless_url.trim_end_matches('/')
    );
    let nr = rechnung
        .referenz_nr
        .map(|n| n.to_string())
        .unwrap_or_else(|| rechnung_id[..8].to_string());

    let uebertragen_am = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut irgendein_erfolg = false;
    let mut erster_doc_id: Option<i64> = None;

    for (i, anhang) in anhaenge.iter().enumerate() {
        let abs_pfad = uploads_dir.join(&anhang.pfad);
        let data = match tokio::fs::read(&abs_pfad).await {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("Paperless: Anhang lesen fehlgeschlagen ({}: {e})", abs_pfad.display());
                continue;
            }
        };

        let seite_suffix = if anhaenge.len() > 1 {
            format!(" (Seite {})", i + 1)
        } else {
            String::new()
        };
        let titel = format!(
            "PKV #{} – {} – {}{}",
            nr, rechnung.typ, rechnung.datum, seite_suffix
        );

        let file_part = reqwest::multipart::Part::bytes(data)
            .file_name(anhang.dateiname.clone())
            .mime_str("application/pdf")?;

        let form = reqwest::multipart::Form::new()
            .part("document", file_part)
            .text("title", titel.clone())
            .text("created", rechnung.datum.clone());

        let resp = client
            .post(&endpoint)
            .header("Authorization", format!("Token {paperless_token}"))
            .multipart(form)
            .send()
            .await;

        let task_uuid = match resp {
            Ok(r) if r.status().is_success() => {
                let body = r.text().await.unwrap_or_default();
                tracing::info!("Paperless-Upload erfolgreich: {titel} (Task: {body})");
                irgendein_erfolg = true;
                // Paperless gibt die Task-UUID als quoted string zurück: "abc-123-..."
                Some(body.trim().trim_matches('"').to_string())
            }
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                tracing::warn!("Paperless-Upload fehlgeschlagen: HTTP {status} – {body}");
                None
            }
            Err(e) => {
                tracing::warn!("Paperless-Upload fehlgeschlagen: {e}");
                None
            }
        };

        // Dokument-ID aus Paperless-Task holen (bis zu 5 Versuche, 3s Abstand)
        if let Some(uuid) = task_uuid {
            if erster_doc_id.is_none() {
                let doc_id = poll_task_doc_id(&client, &tasks_endpoint, paperless_token, &uuid).await;
                if doc_id.is_some() {
                    erster_doc_id = doc_id;
                }
            }
        }
    }

    if irgendein_erfolg {
        if let Err(e) = repositories::rechnungen::update_paperless_ref(
            db,
            rechnung_id,
            erster_doc_id,
            &uebertragen_am,
        )
        .await
        {
            tracing::warn!("Paperless-Ref speichern fehlgeschlagen für {rechnung_id}: {e}");
        }
    }

    Ok(())
}

async fn poll_task_doc_id(
    client: &reqwest::Client,
    tasks_endpoint: &str,
    token: &str,
    task_uuid: &str,
) -> Option<i64> {
    for attempt in 0..5u8 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }

        let resp = client
            .get(tasks_endpoint)
            .query(&[("task_id", task_uuid)])
            .header("Authorization", format!("Token {token}"))
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                let tasks: Vec<PaperlessTask> = match r.json().await {
                    Ok(t) => t,
                    Err(_) => continue,
                };
                if let Some(task) = tasks.first() {
                    if task.status == "SUCCESS" {
                        return task.related_document;
                    } else if task.status == "FAILURE" {
                        tracing::warn!("Paperless-Task {task_uuid} fehlgeschlagen");
                        return None;
                    }
                    // PENDING oder STARTED → weiter warten
                }
            }
            _ => continue,
        }
    }
    None
}
