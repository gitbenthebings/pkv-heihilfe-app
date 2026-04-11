use anyhow::{Context, Result};
use serde::Deserialize;

use crate::{config::Config, db::Db};

#[derive(Deserialize)]
struct SeedMandant {
    name: String,
}

#[derive(Deserialize)]
struct SeedBenutzer {
    name: String,
    email: String,
    passwort: String,
}

#[derive(Deserialize)]
struct SeedBeihilfestelle {
    id: String,
    name: String,
    dienstherr_typ: String,
}

#[derive(Deserialize)]
struct SeedPerson {
    name: String,
    geburtsdatum: String,
    typ: String,
    beihilfestelle_id: Option<String>,
    beihilfe_satz: i64,
    pkv_satz: i64,
    bre_schwelle: Option<f64>,
}

#[derive(Deserialize)]
struct SeedCorrespondent {
    name: String,
    typ: String,
}

#[derive(Deserialize)]
struct SeedFile {
    mandant: SeedMandant,
    #[serde(default)]
    benutzer: Vec<SeedBenutzer>,
    #[serde(default)]
    beihilfestellen: Vec<SeedBeihilfestelle>,
    #[serde(default)]
    personen: Vec<SeedPerson>,
    #[serde(default)]
    correspondents: Vec<SeedCorrespondent>,
}

pub async fn bootstrap(db: &Db, cfg: &Config) -> Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mandant")
        .fetch_one(db)
        .await?;

    if count > 0 {
        tracing::info!("Datenbank bereits initialisiert, überspringe Bootstrap.");
        return Ok(());
    }

    if let Some(seed_file) = &cfg.seed_file {
        import_from_file(db, seed_file).await?;
    } else if let (Some(email), Some(password)) = (&cfg.admin_email, &cfg.admin_password) {
        let name = cfg.mandant_name.as_deref().unwrap_or("PKV-Familie");
        import_from_env(db, name, email, password).await?;
    } else {
        tracing::warn!(
            "DB ist leer und weder SEED_FILE noch ADMIN_EMAIL/ADMIN_PASSWORD gesetzt. \
             Die App ist ohne Login nicht nutzbar."
        );
    }

    Ok(())
}

async fn import_from_env(db: &Db, mandant_name: &str, email: &str, password: &str) -> Result<()> {
    let mandant_id = uuid::Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO mandant (id, name) VALUES (?, ?)")
        .bind(&mandant_id)
        .bind(mandant_name)
        .execute(db)
        .await?;

    let id = uuid::Uuid::new_v4().to_string();
    let hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .context("Passwort-Hashing fehlgeschlagen")?;
    sqlx::query(
        "INSERT INTO benutzer (id, mandant_id, name, email, passwort_hash) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&mandant_id)
    .bind("Admin")
    .bind(email)
    .bind(&hash)
    .execute(db)
    .await?;

    tracing::info!("Bootstrap via Env-Variablen: Mandant '{}', Admin '{}'", mandant_name, email);
    Ok(())
}

async fn import_from_file(db: &Db, seed_file: &str) -> Result<()> {
    let content = std::fs::read_to_string(seed_file)
        .with_context(|| format!("Seed-Datei nicht gefunden: {}", seed_file))?;

    let seed: SeedFile = serde_json::from_str(&content)
        .context("Seed-JSON konnte nicht geparst werden")?;

    let mandant_id = uuid::Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO mandant (id, name) VALUES (?, ?)")
        .bind(&mandant_id)
        .bind(&seed.mandant.name)
        .execute(db)
        .await?;

    for b in &seed.benutzer {
        let id = uuid::Uuid::new_v4().to_string();
        let hash = bcrypt::hash(&b.passwort, bcrypt::DEFAULT_COST)
            .context("Passwort-Hashing fehlgeschlagen")?;
        sqlx::query(
            "INSERT INTO benutzer (id, mandant_id, name, email, passwort_hash) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&mandant_id)
        .bind(&b.name)
        .bind(&b.email)
        .bind(&hash)
        .execute(db)
        .await?;
    }

    for bh in &seed.beihilfestellen {
        let id = format!("{}-{}", mandant_id, bh.id);
        sqlx::query(
            "INSERT INTO beihilfestelle (id, mandant_id, name, dienstherr_typ) VALUES (?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&mandant_id)
        .bind(&bh.name)
        .bind(&bh.dienstherr_typ)
        .execute(db)
        .await?;
    }

    for p in &seed.personen {
        let id = uuid::Uuid::new_v4().to_string();
        let beihilfestelle_id = p.beihilfestelle_id.as_ref()
            .map(|bid| format!("{}-{}", mandant_id, bid));
        sqlx::query(
            "INSERT INTO person (id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&mandant_id)
        .bind(&p.name)
        .bind(&p.geburtsdatum)
        .bind(&p.typ)
        .bind(&beihilfestelle_id)
        .bind(p.beihilfe_satz)
        .bind(p.pkv_satz)
        .bind(p.bre_schwelle)
        .execute(db)
        .await?;
    }

    for c in &seed.correspondents {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO correspondent (id, mandant_id, name, typ) VALUES (?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&mandant_id)
        .bind(&c.name)
        .bind(&c.typ)
        .execute(db)
        .await?;
    }

    tracing::info!("Seed aus Datei importiert: Mandant '{}'", seed.mandant.name);
    Ok(())
}
