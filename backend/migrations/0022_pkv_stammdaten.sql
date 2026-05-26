CREATE TABLE pkv (
  id          TEXT PRIMARY KEY,
  mandant_id  TEXT NOT NULL REFERENCES mandant(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

CREATE INDEX idx_pkv_mandant ON pkv (mandant_id);

CREATE TABLE pkv_personen (
  pkv_id     TEXT NOT NULL REFERENCES pkv(id) ON DELETE CASCADE,
  person_id  TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  mandant_id TEXT NOT NULL,
  PRIMARY KEY (pkv_id, person_id)
);

ALTER TABLE beihilfe_antrag ADD COLUMN pkv_id TEXT REFERENCES pkv(id);
