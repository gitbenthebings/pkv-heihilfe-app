-- PKV-Versicherer (private Krankenversicherung)
CREATE TABLE IF NOT EXISTS pkv (
    id         TEXT PRIMARY KEY NOT NULL,
    mandant_id TEXT NOT NULL REFERENCES mandant(id),
    name       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pkv_mandant ON pkv(mandant_id);

-- Personen einer Beihilfestelle (leer = alle Personen erlaubt)
CREATE TABLE IF NOT EXISTS beihilfestelle_person (
    beihilfestelle_id TEXT NOT NULL REFERENCES beihilfestelle(id) ON DELETE CASCADE,
    person_id         TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (beihilfestelle_id, person_id)
);

-- Personen einer PKV (leer = keine Einschränkung)
CREATE TABLE IF NOT EXISTS pkv_person (
    pkv_id    TEXT NOT NULL REFERENCES pkv(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (pkv_id, person_id)
);
