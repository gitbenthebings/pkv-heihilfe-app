-- Extrahierte Positionen aus einem Beihilfe-Bescheid
CREATE TABLE IF NOT EXISTS beihilfe_position (
    id                 TEXT PRIMARY KEY NOT NULL,
    bescheid_id        TEXT NOT NULL REFERENCES beihilfe_bescheid(id) ON DELETE CASCADE,
    lfd_nr             INTEGER NOT NULL,
    rechnungsdatum     TEXT,
    leistungserbringer TEXT,
    rechnungsbetrag    INTEGER,       -- Cent, nullable
    anerkannt_betrag   INTEGER,       -- Cent, nullable
    abgelehnt_betrag   INTEGER,       -- Cent, nullable
    beihilfe_betrag    INTEGER,       -- Cent, nullable
    ablehnungsgrund    TEXT,
    rechnung_id        TEXT REFERENCES rechnung(id) ON DELETE SET NULL,
    zugeordnet_am      TEXT
);

CREATE INDEX IF NOT EXISTS idx_position_bescheid ON beihilfe_position(bescheid_id);
