use std::path::Path;
use tokio::process::Command;
use uuid::Uuid;

/// Rendert die erste Seite einer PDF als JPEG nach `thumb_path`.
/// Verwendet pdftoppm (poppler-utils), das bereits für OCR installiert ist.
pub async fn generate(pdf_path: &Path, thumb_path: &Path) -> Result<(), String> {
    let tmp_dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("tempdir: {e}"))?;

    let prefix = tmp_dir.join("thumb");

    let out = Command::new("pdftoppm")
        .args(["-jpeg", "-r", "150", "-f", "1", "-l", "1"])
        .arg(pdf_path)
        .arg(&prefix)
        .output()
        .await
        .map_err(|e| format!("pdftoppm nicht gefunden: {e}"))?;

    if !out.status.success() {
        let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
        return Err(format!(
            "pdftoppm fehlgeschlagen: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    // pdftoppm erzeugt thumb-1.jpg, thumb-01.jpg o.ä. — erste JPEG-Datei nehmen
    let mut entries = tokio::fs::read_dir(&tmp_dir)
        .await
        .map_err(|e| format!("readdir: {e}"))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("entry: {e}"))?
    {
        if entry
            .path()
            .extension()
            .and_then(|x| x.to_str())
            .map(|x| x.eq_ignore_ascii_case("jpg") || x.eq_ignore_ascii_case("jpeg"))
            .unwrap_or(false)
        {
            tokio::fs::copy(entry.path(), thumb_path)
                .await
                .map_err(|e| format!("copy: {e}"))?;
            let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
            return Ok(());
        }
    }

    let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
    Err("Keine Thumbnail-Datei erzeugt".to_string())
}
