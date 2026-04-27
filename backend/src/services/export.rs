use std::path::Path;

use crate::{db::Db, errors::AppError, repositories, services::gdrive};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExportProvider {
    Local,
    GoogleDrive,
}

pub enum ExportConfig {
    Local,
    GoogleDrive {
        service_account_json: String,
        folder_id: String,
    },
}

#[derive(Serialize)]
pub struct ExportResult {
    pub provider: String,
    pub exported_files: u32,
    pub skipped_invoices: u32,
    /// Local: relativer Verzeichnisname (z.B. "2026-04-17_143022")
    pub directory: Option<String>,
    /// Google Drive: Link zum Ziel-Ordner
    pub folder_url: Option<String>,
}

pub async fn export_rechnungen(
    db: &Db,
    uploads_dir: &Path,
    exports_dir: &Path,
    rechnung_ids: &[String],
    mandant_id: &str,
    config: &ExportConfig,
) -> Result<ExportResult, AppError> {
    match config {
        ExportConfig::Local => {
            export_local(db, uploads_dir, exports_dir, rechnung_ids, mandant_id).await
        }
        ExportConfig::GoogleDrive {
            service_account_json,
            folder_id,
        } => {
            export_google_drive(
                db,
                uploads_dir,
                rechnung_ids,
                mandant_id,
                service_account_json,
                folder_id,
            )
            .await
        }
    }
}

async fn export_local(
    db: &Db,
    uploads_dir: &Path,
    exports_dir: &Path,
    rechnung_ids: &[String],
    mandant_id: &str,
) -> Result<ExportResult, AppError> {
    let now = chrono::Utc::now().format("%Y-%m-%d_%H%M%S").to_string();
    let export_subdir = exports_dir.join(&now);

    tokio::fs::create_dir_all(&export_subdir)
        .await
        .map_err(|e| anyhow::anyhow!("Export-Verzeichnis erstellen: {e}"))?;

    let mut exported_files: u32 = 0;
    let mut skipped_invoices: u32 = 0;

    for rechnung_id in rechnung_ids {
        if repositories::rechnungen::get(db, rechnung_id, mandant_id)
            .await?
            .is_none()
        {
            skipped_invoices += 1;
            continue;
        }

        let anhaenge = repositories::anhaenge::list_by_rechnung(db, rechnung_id).await?;
        if anhaenge.is_empty() {
            skipped_invoices += 1;
            continue;
        }

        for anhang in &anhaenge {
            let src = uploads_dir.join(&anhang.pfad);
            let dst = export_subdir.join(&anhang.dateiname);
            let dst = if dst.exists() {
                let stem = dst.file_stem().unwrap_or_default().to_string_lossy();
                export_subdir.join(format!("{}_{}.pdf", stem, &anhang.id[..8]))
            } else {
                dst
            };
            tokio::fs::copy(&src, &dst)
                .await
                .map_err(|e| anyhow::anyhow!("Kopieren {}: {e}", anhang.dateiname))?;
            exported_files += 1;
        }
    }

    if exported_files == 0 {
        tokio::fs::remove_dir(&export_subdir).await.ok();
    }

    Ok(ExportResult {
        provider: "local".to_string(),
        exported_files,
        skipped_invoices,
        directory: if exported_files > 0 { Some(now) } else { None },
        folder_url: None,
    })
}

async fn export_google_drive(
    db: &Db,
    uploads_dir: &Path,
    rechnung_ids: &[String],
    mandant_id: &str,
    service_account_json: &str,
    folder_id: &str,
) -> Result<ExportResult, AppError> {
    let key = gdrive::parse_key(service_account_json)
        .map_err(|e| AppError::BadRequest(format!("Google Drive: {e}")))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    let access_token = gdrive::get_access_token(&client, &key)
        .await
        .map_err(|e| AppError::BadRequest(format!("Google Drive Auth: {e}")))?;

    let mut exported_files: u32 = 0;
    let mut skipped_invoices: u32 = 0;

    for rechnung_id in rechnung_ids {
        if repositories::rechnungen::get(db, rechnung_id, mandant_id)
            .await?
            .is_none()
        {
            skipped_invoices += 1;
            continue;
        }

        let anhaenge = repositories::anhaenge::list_by_rechnung(db, rechnung_id).await?;
        if anhaenge.is_empty() {
            skipped_invoices += 1;
            continue;
        }

        for anhang in &anhaenge {
            let src = uploads_dir.join(&anhang.pfad);
            let data = tokio::fs::read(&src)
                .await
                .map_err(|e| anyhow::anyhow!("Lesen {}: {e}", anhang.dateiname))?;

            gdrive::upload_file(&client, &access_token, folder_id, &anhang.dateiname, &data)
                .await
                .map_err(|e| AppError::BadRequest(format!("Drive-Upload {}: {e}", anhang.dateiname)))?;

            exported_files += 1;
        }
    }

    Ok(ExportResult {
        provider: "google_drive".to_string(),
        exported_files,
        skipped_invoices,
        directory: None,
        folder_url: if exported_files > 0 {
            Some(format!("https://drive.google.com/drive/folders/{folder_id}"))
        } else {
            None
        },
    })
}
