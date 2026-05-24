-- Beihilfe- und PKV-Anträge
CREATE TABLE IF NOT EXISTS antrag (
    id                  TEXT PRIMARY KEY NOT NULL,
    mandant_id          TEXT NOT NULL REFERENCES mandant(id),
    typ                 TEXT NOT NULL DEFAULT 'beihilfe' CHECK(typ IN ('beihilfe', 'pkv')),
    status              TEXT NOT NULL DEFAULT 'entwurf',
    referenz_nr         INTEGER,
    titel               TEXT,
    notiz               TEXT,
    beihilfestelle_id   TEXT REFERENCES beihilfestelle(id),
    pkv_id              TEXT REFERENCES pkv(id),
    pkv_versicherer     TEXT,
    paperless_share_url TEXT,
    versendet_am        TEXT,
    erstellt_am         TEXT NOT NULL DEFAULT (datetime('now')),
    aktualisiert_am     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_antrag_mandant ON antrag(mandant_id);

-- n:m Verknüpfung Antrag ↔ Rechnung
CREATE TABLE IF NOT EXISTS antrag_rechnung (
    antrag_id   TEXT NOT NULL REFERENCES antrag(id) ON DELETE CASCADE,
    rechnung_id TEXT NOT NULL REFERENCES rechnung(id) ON DELETE CASCADE,
    widerspruch INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (antrag_id, rechnung_id)
);
