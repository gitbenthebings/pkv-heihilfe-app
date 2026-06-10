use std::path::Path;
use tokio::process::Command;
use uuid::Uuid;

/// Status-Strings, die als ocr_status in die DB geschrieben werden
pub const STATUS_DONE: &str = "done";
pub const STATUS_FAILED: &str = "failed";
pub const STATUS_UNAVAILABLE: &str = "unavailable";

/// Extrahiert Text aus einer PDF-Datei mittels pdftoppm + tesseract.
/// Gibt Ok(text) zurück; Err enthält einen der STATUS_* Strings als Hinweis.
pub async fn extract_text(pdf_path: &Path) -> Result<String, String> {
    // Prüfen ob tesseract verfügbar ist
    let check = Command::new("tesseract")
        .arg("--version")
        .output()
        .await;
    if check.is_err() {
        return Err(STATUS_UNAVAILABLE.to_string());
    }

    let tmp_dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("{STATUS_FAILED}: tmp dir: {e}"))?;

    let tmp_prefix = tmp_dir.join("page");

    // PDF → PNG (200 DPI ist gut für OCR)
    let pdftoppm_out = Command::new("pdftoppm")
        .args(["-r", "200", "-png"])
        .arg(pdf_path)
        .arg(&tmp_prefix)
        .output()
        .await
        .map_err(|_| STATUS_FAILED.to_string())?;

    if !pdftoppm_out.status.success() {
        let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
        return Err(STATUS_FAILED.to_string());
    }

    // PNG-Seiten einsammeln, nach Namen sortieren (Seitenreihenfolge)
    let mut entries = tokio::fs::read_dir(&tmp_dir)
        .await
        .map_err(|e| format!("{STATUS_FAILED}: {e}"))?;

    let mut pages: Vec<std::path::PathBuf> = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let p = entry.path();
        if p.extension().and_then(|x| x.to_str()) == Some("png") {
            pages.push(p);
        }
    }
    pages.sort();

    if pages.is_empty() {
        let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
        return Err(STATUS_FAILED.to_string());
    }

    // Tesseract auf jede Seite anwenden
    let mut full_text = String::new();
    for page in &pages {
        let tess = Command::new("tesseract")
            .arg(page)
            .arg("stdout")
            .args(["-l", "deu+eng"])
            .args(["--dpi", "200"])
            .output()
            .await
            .map_err(|_| STATUS_UNAVAILABLE.to_string())?;

        if tess.status.success() {
            let t = String::from_utf8_lossy(&tess.stdout);
            full_text.push_str(&t);
            if !full_text.ends_with('\n') {
                full_text.push('\n');
            }
        }
    }

    let _ = tokio::fs::remove_dir_all(&tmp_dir).await;

    Ok(full_text.trim().to_string())
}
