use anyhow::{Context, Result};
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub seed_file: Option<String>,
    pub port: u16,
    pub uploads_dir: PathBuf,
    // Bootstrap-User (wird genutzt wenn DB leer und kein SEED_FILE)
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    pub mandant_name: Option<String>,
    pub multipage_scan: bool,
    pub paperless_ngx_url: Option<String>,
    pub paperless_ngx_token: Option<String>,
    pub exports_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL not set")?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "changeme".to_string()),
            seed_file: std::env::var("SEED_FILE").ok(),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .context("PORT must be a number")?,
            uploads_dir: PathBuf::from(
                std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "/data/uploads".to_string())
            ),
            admin_email: std::env::var("ADMIN_EMAIL").ok(),
            admin_password: std::env::var("ADMIN_PASSWORD").ok(),
            mandant_name: std::env::var("MANDANT_NAME").ok(),
            multipage_scan: std::env::var("MULTIPAGE_SCAN")
                .map(|v| matches!(v.to_lowercase().as_str(), "true" | "1" | "yes"))
                .unwrap_or(true),
            paperless_ngx_url: std::env::var("PAPERLESS_NGX_URL").ok(),
            paperless_ngx_token: std::env::var("PAPERLESS_NGX_TOKEN").ok(),
            exports_dir: PathBuf::from(
                std::env::var("EXPORTS_DIR").unwrap_or_else(|_| "/exports".to_string())
            ),
        })
    }
}
