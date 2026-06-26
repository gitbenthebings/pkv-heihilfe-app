use std::io::Write;

use axum::{
    body::Body,
    extract::{Multipart, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};

use crate::{auth::AuthUser, errors::AppError, repositories, AppState};

const MAX_RESTORE_BYTES: usize = 512 * 1024 * 1024; // 512 MB

// ── Download ────────────────────────────────────────────────────────────────

pub async fn download(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    // VACUUM INTO Snapshot-Datei (innerhalb des /data Volumes – gleiche FS)
    let tmp_db = state.db_path.with_file_name("backup_vacuumed.db");
    let tmp_db_str = tmp_db.to_string_lossy().to_string();

    sqlx::query(&format!("VACUUM INTO '{tmp_db_str}'"))
        .execute(&state.db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("VACUUM INTO fehlgeschlagen: {e}")))?;

    // ZIP im Blocking-Thread aufbauen
    let uploads_dir = state.uploads_dir.clone();
    let zip_bytes = tokio::task::spawn_blocking(move || -> anyhow::Result<Vec<u8>> {
        let mut cursor = std::io::Cursor::new(Vec::<u8>::new());
        {
            let mut zip = zip::ZipWriter::new(&mut cursor);
            let opts = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);

            // pkv.db
            zip.start_file("pkv.db", opts)?;
            zip.write_all(&std::fs::read(&tmp_db)?)?;
            std::fs::remove_file(&tmp_db).ok();

            // uploads/
            if uploads_dir.exists() {
                for entry in walkdir::WalkDir::new(&uploads_dir).follow_links(false) {
                    let entry = entry?;
                    if !entry.file_type().is_file() {
                        continue;
                    }
                    let rel = entry.path().strip_prefix(&uploads_dir)
                        .map_err(|e| anyhow::anyhow!("{e}"))?;
                    let zip_path = format!("uploads/{}", rel.to_string_lossy());
                    zip.start_file(&zip_path, opts)?;
                    zip.write_all(&std::fs::read(entry.path())?)?;
                }
            }

            zip.finish()?;
        }
        Ok(cursor.into_inner())
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Backup-Task: {e}")))?
    .map_err(|e| AppError::Internal(anyhow::anyhow!("ZIP erstellen: {e}")))?;

    // Zeitstempel speichern
    let now = chrono::Utc::now().to_rfc3339();
    repositories::einstellungen::upsert(&state.db, "last_backup_at", &now).await.ok();

    let filename = format!("pkv_backup_{}.zip", chrono::Utc::now().format("%Y-%m-%d"));
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/zip"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&zip_bytes.len().to_string()).unwrap(),
    );

    Ok((StatusCode::OK, headers, Body::from(zip_bytes)))
}

// ── Restore ─────────────────────────────────────────────────────────────────

pub async fn restore(
    State(state): State<AppState>,
    _auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("Keine Datei übermittelt".into()))?;

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    if data.len() > MAX_RESTORE_BYTES {
        return Err(AppError::BadRequest(format!(
            "Datei zu groß (max {} MB)",
            MAX_RESTORE_BYTES / 1024 / 1024
        )));
    }
    if data.len() < 4 || &data[..2] != b"PK" {
        return Err(AppError::BadRequest("Keine gültige ZIP-Datei".into()));
    }

    let db_path = state.db_path.clone();
    let uploads_dir = state.uploads_dir.clone();

    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        let cursor = std::io::Cursor::new(data.as_ref());
        let mut archive = zip::ZipArchive::new(cursor)?;

        // Validieren: muss pkv.db enthalten
        archive
            .by_name("pkv.db")
            .map_err(|_| anyhow::anyhow!("ZIP enthält keine pkv.db — kein gültiges Backup"))?;

        // pkv.db extrahieren (atomar: erst in .new, dann umbenennen)
        {
            let mut src = archive.by_name("pkv.db")?;
            let tmp = db_path.with_file_name("pkv_restore_new.db");
            let mut out = std::fs::File::create(&tmp)?;
            std::io::copy(&mut src, &mut out)?;
            drop(out);
            std::fs::rename(&tmp, &db_path)?;
        }

        // Uploads: bestehenden Inhalt löschen, neu befüllen
        if uploads_dir.exists() {
            for entry in std::fs::read_dir(&uploads_dir)? {
                let entry = entry?;
                if entry.file_type()?.is_dir() {
                    std::fs::remove_dir_all(entry.path())?;
                } else {
                    std::fs::remove_file(entry.path())?;
                }
            }
        } else {
            std::fs::create_dir_all(&uploads_dir)?;
        }

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let name = file.name().to_string();
            let Some(rel) = name.strip_prefix("uploads/") else { continue };
            if rel.is_empty() || file.is_dir() {
                continue;
            }
            // Sicherheitscheck: kein Path Traversal
            if rel.contains("..") {
                continue;
            }
            let dest = uploads_dir.join(rel);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&dest)?;
            std::io::copy(&mut file, &mut out)?;
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?
    .map_err(|e| AppError::BadRequest(format!("Wiederherstellung fehlgeschlagen: {e}")))?;

    // Antwort raussenden, dann Prozess beenden (Docker restart: unless-stopped)
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        std::process::exit(0);
    });

    Ok(Json(serde_json::json!({
        "ok": true,
        "message": "Wiederherstellung abgeschlossen. Anwendung wird neu gestartet…"
    })))
}
