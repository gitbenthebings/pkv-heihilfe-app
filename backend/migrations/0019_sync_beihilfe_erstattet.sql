-- Einmalige Synchronisation: beihilfe_erstattet_betrag aus vorhandenen Bescheid-Positionen befüllen.
-- Nötig für Rechnungen, die vor Einführung des automatischen Syncs bereits Positionen hatten.
UPDATE rechnung
SET beihilfe_erstattet_betrag = (
  SELECT SUM(anerkannt_betrag) / 100.0
  FROM beihilfe_bescheid_position
  WHERE rechnung_id = rechnung.id
    AND anerkannt_betrag IS NOT NULL
)
WHERE id IN (
  SELECT DISTINCT rechnung_id
  FROM beihilfe_bescheid_position
  WHERE anerkannt_betrag IS NOT NULL
);
