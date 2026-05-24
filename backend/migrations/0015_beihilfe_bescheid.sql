-- Beihilfe-Bescheide (hochgeladene PDFs + n8n-Analyseergebnis)
CREATE TABLE IF NOT EXISTS beihilfe_bescheid (
    id             TEXT PRIMARY KEY NOT NULL,
    mandant_id     TEXT NOT NULL,
    antrag_id      TEXT NOT NULL REFERENCES antrag(id) ON DELETE CASCADE,
    typ            TEXT NOT NULL DEFAULT 'bescheid' CHECK(typ IN ('bescheid', 'widerspruchsbescheid')),
    dateiname      TEXT NOT NULL,
    pfad           TEXT NOT NULL,
    groesse        INTEGER NOT NULL,
    analyse_status TEXT NOT NULL DEFAULT 'ausstehend',
    -- analyse_status: 'ausstehend' | 'wird_analysiert' | 'abgeschlossen' | 'fehler'
    analyse_fehler TEXT,
    datum          TEXT,        -- Bescheiddatum (extrahiert)
    aktenzeichen   TEXT,        -- (extrahiert)
    erstellt_am    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bescheid_antrag ON beihilfe_bescheid(antrag_id);
