CREATE TABLE IF NOT EXISTS rechnung_anhang (
    id             TEXT PRIMARY KEY NOT NULL,
    mandant_id     TEXT NOT NULL,
    rechnung_id    TEXT NOT NULL REFERENCES rechnung(id) ON DELETE CASCADE,
    dateiname      TEXT NOT NULL,
    pfad           TEXT NOT NULL,     -- relativ zu uploads_dir: {rechnung_id}/{file_id}.pdf
    groesse        INTEGER NOT NULL,  -- Bytes
    hochgeladen_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rechnung_anhang_rechnung ON rechnung_anhang(rechnung_id);
