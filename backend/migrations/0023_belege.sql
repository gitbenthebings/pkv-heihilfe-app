CREATE TABLE IF NOT EXISTS beleg (
    id             TEXT PRIMARY KEY NOT NULL,
    mandant_id     TEXT NOT NULL REFERENCES mandant(id),
    dateiname      TEXT NOT NULL,
    bezeichnung    TEXT,
    pfad           TEXT NOT NULL,       -- relativ zu uploads_dir: belege/{uuid}.pdf
    thumbnail_pfad TEXT,                -- relativ zu uploads_dir: belege/{uuid}_thumb.jpg
    groesse        INTEGER NOT NULL,
    datum          TEXT,
    typ            TEXT,                -- 'rechnung'|'bescheid'|'rezept'|'ueberweisung'|'sonstiges'
    notiz          TEXT,
    hochgeladen_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_beleg_mandant ON beleg(mandant_id);
