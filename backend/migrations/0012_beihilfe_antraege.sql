CREATE TABLE IF NOT EXISTS beihilfe_antrag (
    id                TEXT NOT NULL PRIMARY KEY,
    mandant_id        TEXT NOT NULL REFERENCES mandant(id),
    beihilfestelle_id TEXT REFERENCES beihilfestelle(id),
    referenz_nr       INTEGER NOT NULL,
    titel             TEXT,
    status            TEXT NOT NULL DEFAULT 'entwurf',
    versendet_am      TEXT,
    notiz             TEXT,
    erstellt_am       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beihilfe_antrag_rechnung (
    antrag_id        TEXT NOT NULL REFERENCES beihilfe_antrag(id) ON DELETE CASCADE,
    rechnung_id      TEXT NOT NULL REFERENCES rechnung(id) ON DELETE CASCADE,
    widerspruch      INTEGER NOT NULL DEFAULT 0,
    hinzugefuegt_am  TEXT NOT NULL,
    PRIMARY KEY (antrag_id, rechnung_id)
);
