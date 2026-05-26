CREATE TABLE beihilfestelle_personen (
  beihilfestelle_id TEXT NOT NULL REFERENCES beihilfestelle(id) ON DELETE CASCADE,
  person_id         TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  mandant_id        TEXT NOT NULL,
  PRIMARY KEY (beihilfestelle_id, person_id)
);
