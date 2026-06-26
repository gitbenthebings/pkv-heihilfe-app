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
use std::sync::Arc;

use axum::{
    routing::{delete, get, patch, post},
    Extension, Router,
};
use tokio::sync::Semaphore;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use auth::JwtSecret;
use db::Db;

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub db_path: PathBuf,
    pub jwt_secret: String,
    pub uploads_dir: PathBuf,
    pub exports_dir: PathBuf,
    pub multipage_scan: bool,
    pub paperless_ngx_url: Option<String>,
    pub paperless_ngx_token: Option<String>,
    pub ocr_semaphore: Arc<Semaphore>,
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

    let db_path = PathBuf::from(cfg.database_url.trim_start_matches("sqlite:"));

    let state = AppState {
        db: pool,
        db_path,
        jwt_secret: cfg.jwt_secret.clone(),
        uploads_dir: cfg.uploads_dir.clone(),
        exports_dir: cfg.exports_dir.clone(),
        multipage_scan: cfg.multipage_scan,
        paperless_ngx_url: cfg.paperless_ngx_url.clone(),
        paperless_ngx_token: cfg.paperless_ngx_token.clone(),
        ocr_semaphore: Arc::new(Semaphore::new(2)),
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
        .route("/api/setup/status", get(handlers::setup::status))
        .route("/api/setup", post(handlers::setup::run))
        .route("/api/config", get(handlers::config::get))
        .route("/api/logo", get(handlers::logo::get))
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
        .route("/api/beihilfestellen/:id/personen", post(handlers::beihilfestellen::add_person))
        .route("/api/beihilfestellen/:id/personen/:pid", delete(handlers::beihilfestellen::remove_person))
        // PKV
        .route("/api/pkv", get(handlers::pkv::list))
        .route("/api/pkv", post(handlers::pkv::create))
        .route("/api/pkv/:id", patch(handlers::pkv::update))
        .route("/api/pkv/:id", delete(handlers::pkv::delete))
        .route("/api/pkv/:id/personen", post(handlers::pkv::add_person))
        .route("/api/pkv/:id/personen/:pid", delete(handlers::pkv::remove_person))
        // Personen
        .route("/api/personen", get(handlers::personen::list))
        .route("/api/personen", post(handlers::personen::create))
        .route("/api/personen/:id", patch(handlers::personen::update))
        .route("/api/personen/:id", delete(handlers::personen::delete))
        .route("/api/personen/:id/satz-historie", get(handlers::personen::list_satz_historie))
        .route("/api/personen/:id/satz-historie", post(handlers::personen::create_satz_historie))
        .route("/api/personen/:id/satz-historie/:hid", delete(handlers::personen::delete_satz_historie))
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
        // Aktivitätslog
        .route("/api/aktivitaet", get(handlers::aktivitaet::list_all))
        .route("/api/rechnungen/:id/aktivitaet", get(handlers::aktivitaet::list))
        // Dashboard
        .route("/api/dashboard", get(handlers::dashboard::get))
        // Einstellungen
        .route("/api/einstellungen", get(handlers::einstellungen::get))
        .route("/api/einstellungen", patch(handlers::einstellungen::update))
        .route("/api/einstellungen/paperless-test", post(handlers::einstellungen::paperless_test))
        .route("/api/einstellungen/gdrive-test", post(handlers::einstellungen::gdrive_test))
        // Logo
        .route("/api/logo", post(handlers::logo::upload))
        .route("/api/logo", delete(handlers::logo::delete))
        // Export
        .route("/api/export", post(handlers::export::run))
        // Backup
        .route("/api/backup/download", get(handlers::backup::download))
        .route("/api/backup/restore", post(handlers::backup::restore))
        // Beihilfe-Anträge
        .route("/api/beihilfe-antraege", get(handlers::beihilfe_antraege::list))
        .route("/api/beihilfe-antraege", post(handlers::beihilfe_antraege::create))
        .route("/api/beihilfe-antraege/:id", get(handlers::beihilfe_antraege::get))
        .route("/api/beihilfe-antraege/:id", patch(handlers::beihilfe_antraege::update))
        .route("/api/beihilfe-antraege/:id", delete(handlers::beihilfe_antraege::delete))
        .route("/api/beihilfe-antraege/:id/status", patch(handlers::beihilfe_antraege::set_status))
        .route("/api/beihilfe-antraege/:id/rechnungen", post(handlers::beihilfe_antraege::add_rechnung))
        .route("/api/beihilfe-antraege/:id/rechnungen", get(handlers::beihilfe_antraege::list_rechnungen))
        .route("/api/beihilfe-antraege/:id/rechnungen/:rid", delete(handlers::beihilfe_antraege::remove_rechnung))
        // Beihilfe-Bescheide
        .route("/api/beihilfe-antraege/:id/bescheide", get(handlers::beihilfe_bescheide::list))
        .route("/api/beihilfe-antraege/:id/bescheide", post(handlers::beihilfe_bescheide::create))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid", patch(handlers::beihilfe_bescheide::update))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid", delete(handlers::beihilfe_bescheide::delete))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/positionen", get(handlers::beihilfe_bescheide::list_positionen))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/positionen", post(handlers::beihilfe_bescheide::create_position))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/positionen/:pid", patch(handlers::beihilfe_bescheide::update_position))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/positionen/:pid", delete(handlers::beihilfe_bescheide::delete_position))
        // Bescheid-Anhänge
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge", post(handlers::beihilfe_bescheide::upload_anhang))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge", get(handlers::beihilfe_bescheide::list_anhaenge))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid", get(handlers::beihilfe_bescheide::serve_anhang))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid", delete(handlers::beihilfe_bescheide::delete_anhang))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid/ocr", post(handlers::beihilfe_bescheide::ocr_anhang))
        .route("/api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid/vorschlag", get(handlers::beihilfe_bescheide::vorschlag_anhang))
        // Belege
        .route("/api/belege", get(handlers::belege::list))
        .route("/api/belege", post(handlers::belege::upload))
        .route("/api/belege/:id", get(handlers::belege::get))
        .route("/api/belege/:id", patch(handlers::belege::update))
        .route("/api/belege/:id", delete(handlers::belege::delete))
        .route("/api/belege/:id/datei", get(handlers::belege::serve_datei))
        .route("/api/belege/:id/thumbnail", get(handlers::belege::serve_thumbnail))
        .route("/api/belege/:id/ocr", post(handlers::belege::retrigger_ocr))
        .route("/api/belege/:id/bescheid-vorschlag", get(handlers::belege::bescheid_vorschlag))
        // Belege ↔ Rechnungen
        .route("/api/rechnungen/:id/belege", get(handlers::belege::list_for_rechnung))
        .route("/api/rechnungen/:id/belege", post(handlers::belege::add_to_rechnung))
        .route("/api/rechnungen/:id/belege/:bid", delete(handlers::belege::remove_from_rechnung))
        // Belege ↔ Anträge
        .route("/api/beihilfe-antraege/:id/belege", get(handlers::belege::list_for_antrag))
        .route("/api/beihilfe-antraege/:id/belege", post(handlers::belege::add_to_antrag))
        .route("/api/beihilfe-antraege/:id/belege/:bid", delete(handlers::belege::remove_from_antrag))
        .layer(Extension(JwtSecret(cfg.jwt_secret.clone())))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
