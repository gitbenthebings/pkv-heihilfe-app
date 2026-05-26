ALTER TABLE beihilfe_antrag ADD COLUMN typ TEXT NOT NULL DEFAULT 'beihilfe';
ALTER TABLE beihilfe_antrag ADD COLUMN pkv_versicherer TEXT;
