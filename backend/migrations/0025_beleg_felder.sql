ALTER TABLE beleg ADD COLUMN aktenzeichen  TEXT;
ALTER TABLE beleg ADD COLUMN betrag        REAL;   -- Euro; nullable
ALTER TABLE beleg ADD COLUMN aussteller    TEXT;
ALTER TABLE beleg ADD COLUMN eingangsdatum TEXT;
