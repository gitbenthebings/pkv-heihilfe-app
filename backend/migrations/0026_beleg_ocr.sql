ALTER TABLE beleg ADD COLUMN ocr_text   TEXT;
ALTER TABLE beleg ADD COLUMN ocr_status TEXT;
-- ocr_status: NULL = nicht versucht, 'done' = erfolgreich, 'failed' = Fehler, 'unavailable' = tesseract nicht installiert
