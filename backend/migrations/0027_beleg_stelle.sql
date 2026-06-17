ALTER TABLE beleg ADD COLUMN beihilfestelle_id TEXT REFERENCES beihilfestelle(id);
ALTER TABLE beleg ADD COLUMN pkv_id TEXT REFERENCES pkv(id);
