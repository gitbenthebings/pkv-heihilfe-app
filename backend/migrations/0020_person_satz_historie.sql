CREATE TABLE IF NOT EXISTS person_satz_historie (
    id            TEXT NOT NULL PRIMARY KEY,
    person_id     TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    beihilfe_satz INTEGER NOT NULL,
    pkv_satz      INTEGER NOT NULL,
    gueltig_ab    TEXT NOT NULL,
    erstellt_am   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_psh_person_id ON person_satz_historie(person_id);

-- Initialeintrag für jede bestehende Person (Sätze gelten seit Beginn)
INSERT INTO person_satz_historie (id, person_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    id,
    beihilfe_satz,
    pkv_satz,
    '1900-01-01',
    datetime('now')
FROM person;
