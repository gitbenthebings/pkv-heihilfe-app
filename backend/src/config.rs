use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub seed_file: Option<String>,
    pub port: u16,
    // Bootstrap-User (wird genutzt wenn DB leer und kein SEED_FILE)
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    pub mandant_name: Option<String>,
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
            admin_email: std::env::var("ADMIN_EMAIL").ok(),
            admin_password: std::env::var("ADMIN_PASSWORD").ok(),
            mandant_name: std::env::var("MANDANT_NAME").ok(),
        })
    }
}
