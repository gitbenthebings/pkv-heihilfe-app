CREATE TABLE IF NOT EXISTS rechnung_aktivitaet (
    id           TEXT NOT NULL PRIMARY KEY,
    mandant_id   TEXT NOT NULL REFERENCES mandant(id),
    rechnung_id  TEXT NOT NULL REFERENCES rechnung(id) ON DELETE CASCADE,
    benutzer_id  TEXT REFERENCES benutzer(id) ON DELETE SET NULL,
    aktion       TEXT NOT NULL,
    aenderungen  TEXT NOT NULL DEFAULT '[]',
    erstellt_am  TEXT NOT NULL
);
