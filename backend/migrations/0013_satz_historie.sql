-- Historisierte Beihilfe/PKV-Sätze pro Person
CREATE TABLE IF NOT EXISTS person_satz_historie (
    id            TEXT PRIMARY KEY NOT NULL,
    person_id     TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    beihilfe_satz INTEGER NOT NULL,
    pkv_satz      INTEGER NOT NULL,
    gueltig_ab    TEXT NOT NULL,
    erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_satz_historie_person ON person_satz_historie(person_id);
