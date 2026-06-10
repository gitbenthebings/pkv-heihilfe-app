CREATE TABLE IF NOT EXISTS rechnung_beleg (
    rechnung_id   TEXT NOT NULL REFERENCES rechnung(id)        ON DELETE CASCADE,
    beleg_id      TEXT NOT NULL REFERENCES beleg(id)           ON DELETE CASCADE,
    verknuepft_am TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (rechnung_id, beleg_id)
);

CREATE TABLE IF NOT EXISTS antrag_beleg (
    antrag_id     TEXT NOT NULL REFERENCES beihilfe_antrag(id) ON DELETE CASCADE,
    beleg_id      TEXT NOT NULL REFERENCES beleg(id)           ON DELETE CASCADE,
    verknuepft_am TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (antrag_id, beleg_id)
);
