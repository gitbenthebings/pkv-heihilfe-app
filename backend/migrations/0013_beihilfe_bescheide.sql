CREATE TABLE IF NOT EXISTS beihilfe_bescheid (
    id                          TEXT NOT NULL PRIMARY KEY,
    mandant_id                  TEXT NOT NULL REFERENCES mandant(id),
    antrag_id                   TEXT NOT NULL REFERENCES beihilfe_antrag(id) ON DELETE CASCADE,
    aktenzeichen                TEXT,
    bescheid_datum              TEXT NOT NULL,
    eingangsdatum               TEXT,
    erstattungsbetrag_gesamt    INTEGER NOT NULL DEFAULT 0,
    typ                         TEXT NOT NULL DEFAULT 'erstbescheid',
    notiz                       TEXT,
    erstellt_am                 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beihilfe_bescheid_position (
    id               TEXT NOT NULL PRIMARY KEY,
    bescheid_id      TEXT NOT NULL REFERENCES beihilfe_bescheid(id) ON DELETE CASCADE,
    rechnung_id      TEXT NOT NULL REFERENCES rechnung(id) ON DELETE CASCADE,
    anerkannt_betrag INTEGER,
    abgelehnt_betrag INTEGER,
    ablehnungsgrund  TEXT
);
