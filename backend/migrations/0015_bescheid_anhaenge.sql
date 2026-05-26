CREATE TABLE IF NOT EXISTS bescheid_anhang (
  id           TEXT    PRIMARY KEY,
  mandant_id   TEXT    NOT NULL,
  bescheid_id  TEXT    NOT NULL REFERENCES beihilfe_bescheid(id) ON DELETE CASCADE,
  dateiname    TEXT    NOT NULL,
  pfad         TEXT    NOT NULL,
  groesse      INTEGER NOT NULL,
  hochgeladen_am TEXT  NOT NULL
);
