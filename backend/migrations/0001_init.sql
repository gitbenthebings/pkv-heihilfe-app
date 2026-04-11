CREATE TABLE IF NOT EXISTS mandant (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS benutzer (
    id            TEXT PRIMARY KEY,
    mandant_id    TEXT NOT NULL REFERENCES mandant(id),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    passwort_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beihilfestelle (
    id             TEXT PRIMARY KEY,
    mandant_id     TEXT NOT NULL REFERENCES mandant(id),
    name           TEXT NOT NULL,
    dienstherr_typ TEXT NOT NULL CHECK(dienstherr_typ IN ('bund', 'land', 'kommune'))
);

CREATE TABLE IF NOT EXISTS person (
    id                TEXT PRIMARY KEY,
    mandant_id        TEXT NOT NULL REFERENCES mandant(id),
    name              TEXT NOT NULL,
    geburtsdatum      TEXT NOT NULL,
    typ               TEXT NOT NULL CHECK(typ IN ('erwachsener', 'kind')),
    beihilfestelle_id TEXT REFERENCES beihilfestelle(id),
    beihilfe_satz     INTEGER NOT NULL DEFAULT 0,
    pkv_satz          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS correspondent (
    id         TEXT PRIMARY KEY,
    mandant_id TEXT NOT NULL REFERENCES mandant(id),
    name       TEXT NOT NULL,
    typ        TEXT NOT NULL CHECK(typ IN ('arzt', 'krankenhaus', 'apotheke', 'abrechnungsstelle'))
);

CREATE TABLE IF NOT EXISTS rechnung (
    id                       TEXT PRIMARY KEY,
    mandant_id               TEXT NOT NULL REFERENCES mandant(id),
    person_id                TEXT NOT NULL REFERENCES person(id),
    leistungserbringer_id    TEXT NOT NULL REFERENCES correspondent(id),
    typ                      TEXT NOT NULL CHECK(typ IN ('arzt', 'apotheke', 'krankenhaus')),
    betrag                   INTEGER NOT NULL,
    datum                    TEXT NOT NULL,
    zahlungsziel             TEXT,
    bezahlt_am               TEXT,
    beihilfe_eingereicht_am  TEXT,
    pkv_eingereicht_am       TEXT,
    notiz                    TEXT
);
