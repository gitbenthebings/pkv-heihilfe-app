mod auth;
mod config;
mod db;
mod errors;
mod handlers;
mod models;
mod repositories;
mod seed;
mod services;

use std::path::PathBuf;

use axum::{
    routing::{delete, get, patch, post},
    Extension, Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use auth::JwtSecret;
use db::Db;

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub jwt_secret: String,
    pub uploads_dir: PathBuf,
    pub exports_dir: PathBuf,
    pub multipage_scan: bool,
    pub paperless_ngx_url: Option<String>,
    pub paperless_ngx_token: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env()?;

    // Uploads- und Exports-Verzeichnis beim Start anlegen
    tokio::fs::create_dir_all(&cfg.uploads_dir).await?;
    tracing::info!("Uploads-Verzeichnis: {:?}", cfg.uploads_dir);
    tokio::fs::create_dir_all(&cfg.exports_dir).await?;
    tracing::info!("Exports-Verzeichnis: {:?}", cfg.exports_dir);

    let pool = db::create_pool(&cfg.database_url).await?;
    db::run_migrations(&pool).await?;

    seed::bootstrap(&pool, &cfg).await?;

    let state = AppState {
        db: pool,
        jwt_secret: cfg.jwt_secret.clone(),
        uploads_dir: cfg.uploads_dir.clone(),
        exports_dir: cfg.exports_dir.clone(),
        multipage_scan: cfg.multipage_scan,
        paperless_ngx_url: cfg.paperless_ngx_url.clone(),
        paperless_ngx_token: cfg.paperless_ngx_token.clone(),
    };

    if cfg.paperless_ngx_url.is_some() {
        tracing::info!("Paperless NGX Integration aktiv: {}", cfg.paperless_ngx_url.as_deref().unwrap_or(""));
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Public (kein JWT erforderlich)
        .route("/api/config", get(handlers::config::get))
        .route("/api/auth/login", post(handlers::auth::login))
        // Benutzer
        .route("/api/benutzer", get(handlers::benutzer::list))
        .route("/api/benutzer", post(handlers::benutzer::create))
        .route("/api/benutzer/:id", patch(handlers::benutzer::update))
        .route("/api/benutzer/:id/passwort", post(handlers::benutzer::change_password))
        .route("/api/benutzer/:id", delete(handlers::benutzer::delete))
        // Beihilfestellen
        .route("/api/beihilfestellen", get(handlers::beihilfestellen::list))
        .route("/api/beihilfestellen", post(handlers::beihilfestellen::create))
        .route("/api/beihilfestellen/:id", patch(handlers::beihilfestellen::update))
        .route("/api/beihilfestellen/:id", delete(handlers::beihilfestellen::delete))
        // Personen
        .route("/api/personen", get(handlers::personen::list))
        .route("/api/personen", post(handlers::personen::create))
        .route("/api/personen/:id", patch(handlers::personen::update))
        .route("/api/personen/:id", delete(handlers::personen::delete))
        // Correspondents
        .route("/api/correspondents", get(handlers::correspondents::list))
        .route("/api/correspondents", post(handlers::correspondents::create))
        .route("/api/correspondents/:id", patch(handlers::correspondents::update))
        .route("/api/correspondents/:id", delete(handlers::correspondents::delete))
        // Rechnungen
        .route("/api/rechnungen", get(handlers::rechnungen::list))
        .route("/api/rechnungen", post(handlers::rechnungen::create))
        .route("/api/rechnungen/bulk", post(handlers::rechnungen::bulk_action))
        .route("/api/rechnungen/:id", patch(handlers::rechnungen::update))
        .route("/api/rechnungen/:id", delete(handlers::rechnungen::delete))
        // Anhänge
        .route("/api/rechnungen/:id/anhaenge", post(handlers::anhaenge::upload))
        .route("/api/rechnungen/:id/anhaenge", get(handlers::anhaenge::list))
        .route("/api/rechnungen/:id/anhaenge/:aid", get(handlers::anhaenge::serve))
        .route("/api/rechnungen/:id/anhaenge/:aid", delete(handlers::anhaenge::delete))
        // Dashboard
        .route("/api/dashboard", get(handlers::dashboard::get))
        // Einstellungen
        .route("/api/einstellungen", get(handlers::einstellungen::get))
        .route("/api/einstellungen", patch(handlers::einstellungen::update))
        .route("/api/einstellungen/paperless-test", post(handlers::einstellungen::paperless_test))
        .route("/api/einstellungen/gdrive-test", post(handlers::einstellungen::gdrive_test))
        // Export
        .route("/api/export", post(handlers::export::run))
        .layer(Extension(JwtSecret(cfg.jwt_secret.clone())))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
