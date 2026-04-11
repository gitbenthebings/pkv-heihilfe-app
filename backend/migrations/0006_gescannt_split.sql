ALTER TABLE rechnung RENAME COLUMN gescannt TO pkv_gescannt;
ALTER TABLE rechnung ADD COLUMN beihilfe_gescannt INTEGER NOT NULL DEFAULT 0;
