# PKV- und Beihilfe-Abrechnungs-App
## Projektkontext für Claude Code

---

## Projektziel

Self-hosted Server-Client-Applikation zur Verwaltung von Arzt-, Apotheken- und Krankenhausrechnungen für eine Familie mit PKV und Beihilfe (Beamtenstatus). MVP-Fokus: Rechnungen erfassen, Status verfolgen, Übersicht behalten.

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Backend | Rust + Axum |
| Datenbank | SQLite + SQLx |
| Migrationen | sqlx-cli (Dateien in `backend/migrations/`) |
| Frontend | React + TypeScript + Tailwind CSS |
| Container | Docker + Docker Compose |
| Auth | JWT (jsonwebtoken crate) |

---

## Projektstruktur

```
pkv-app/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── docker-compose.release.yml
├── .env
├── .env.example
├── release/
│   └── pkv-app-images.tar.gz
├── data/
│   ├── pkv.db
│   ├── exports/
│   ├── seed.json
│   └── seed.json.example
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_archiv.sql
│   │   ├── 0003_referenz.sql
│   │   ├── 0004_erstattet.sql
│   │   ├── 0005_gescannt.sql
│   │   ├── 0006_gescannt_split.sql
│   │   ├── 0007_anhaenge.sql
│   │   ├── 0008_bre_schwelle.sql
│   │   ├── 0009_pkv_verzicht.sql
│   │   ├── 0010_paperless_ref.sql
│   │   ├── 0011_einstellungen.sql
│   │   ├── 0012_beihilfe_antraege.sql
│   │   ├── 0013_beihilfe_bescheide.sql
│   │   ├── 0014_aktivitaetslog.sql
│   │   ├── 0015_bescheid_anhaenge.sql
│   │   ├── 0016_antrag_paperless_url.sql  ← paperless_share_url zu beihilfe_antrag
│   │   ├── 0017_bescheid_pos_kosten.sql  ← tatsaechliche_kosten zu beihilfe_bescheid_position
│   │   ├── 0018_beihilfestelle_personen.sql ← beihilfestelle_personen Join-Tabelle
│   │   ├── 0019_sync_beihilfe_erstattet.sql ← Sync-Logik für beihilfe_erstattet_betrag
│   │   ├── 0020_person_satz_historie.sql ← Historische BH/PKV-Sätze pro Person
│   │   ├── 0021_antrag_typ.sql          ← typ + pkv_versicherer auf beihilfe_antrag
│   │   └── 0022_pkv_stammdaten.sql      ← pkv-Tabelle, pkv_personen, pkv_id auf beihilfe_antrag
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── errors.rs
│       ├── auth/mod.rs
│       ├── db/mod.rs
│       ├── seed.rs
│       ├── models/
│       │   ├── mod.rs
│       │   ├── anhang.rs
│       │   ├── benutzer.rs
│       │   ├── beihilfestelle.rs
│       │   ├── beihilfe_antrag.rs
│       │   ├── beihilfe_bescheid.rs
│       │   ├── bescheid_anhang.rs
│       │   ├── correspondent.rs
│       │   ├── person.rs
│       │   ├── pkv.rs                    ← Pkv, CreatePkv, UpdatePkv, AddPersonToPkv
│       │   ├── rechnung.rs
│       │   └── aktivitaet.rs
│       ├── handlers/
│       │   ├── mod.rs
│       │   ├── anhaenge.rs
│       │   ├── auth.rs
│       │   ├── benutzer.rs
│       │   ├── beihilfestellen.rs
│       │   ├── beihilfe_antraege.rs
│       │   ├── beihilfe_bescheide.rs      ← ruft sync_beihilfe_erstattet() nach Position-Änderung
│       │   ├── config.rs
│       │   ├── einstellungen.rs
│       │   ├── export.rs
│       │   ├── personen.rs
│       │   ├── pkv.rs                     ← CRUD + Personen-Zuordnung für PKV-Stammdaten
│       │   ├── correspondents.rs
│       │   ├── rechnungen.rs
│       │   ├── aktivitaet.rs
│       │   └── dashboard.rs
│       ├── services/
│       │   ├── export.rs
│       │   ├── gdrive.rs
│       │   ├── paperless.rs
│       │   ├── beihilfe_antraege.rs       ← Statusübergänge, beihilfe_eingereicht_am setzen
│       │   ├── beihilfe_bescheide.rs      ← sync_beihilfe_erstattet(rechnung_id, db):
│       │   │                                 summiert anerkannt_betrag aller Positionen einer
│       │   │                                 Rechnung → schreibt in rechnung.beihilfe_erstattet_betrag
│       │   ├── aktivitaet.rs
│       │   └── rechnungen.rs
│       └── repositories/
│           ├── mod.rs
│           ├── anhaenge.rs
│           ├── benutzer.rs
│           ├── beihilfestellen.rs
│           ├── beihilfe_antraege.rs
│           ├── beihilfe_bescheide.rs
│           ├── bescheid_anhaenge.rs
│           ├── einstellungen.rs
│           ├── personen.rs
│           ├── pkv.rs                     ← list_by_mandant, get, create, update, delete,
│           │                                add_person, remove_person
│           ├── correspondents.rs
│           ├── aktivitaet.rs
│           └── rechnungen.rs
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── api/
        │   ├── anhaenge.ts
        │   ├── auth.ts
        │   ├── benutzer.ts
        │   ├── beihilfestellen.ts
        │   ├── beihilfe_antraege.ts
        │   ├── beihilfe_bescheide.ts
        │   ├── bescheid_anhaenge.ts
        │   ├── client.ts
        │   ├── config.ts
        │   ├── correspondents.ts
        │   ├── dashboard.ts
        │   ├── einstellungen.ts
        │   ├── export.ts
        │   ├── personen.ts
        │   ├── pkv.ts                     ← getPkv, createPkv, updatePkv, deletePkv,
        │   │                                addPersonToPkv, removePersonFromPkv
        │   ├── rechnungen.ts
        │   └── aktivitaet.ts
        ├── components/
        │   ├── AnhangUpload.tsx
        │   ├── AufgabenDashboard.tsx
        │   ├── AufgabenFilterleiste.tsx
        │   ├── AufgabenFinanzStatus.tsx   ← zeigt aggregiert: Betrag / Erwartet BH / Tatsächlich BH
        │   ├── BREIndikator.tsx
        │   ├── BulkActionBar.tsx
        │   ├── FinanzOverview.tsx
        │   ├── KanbanBoard.tsx
        │   ├── KanbanFilter.tsx
        │   ├── Layout.tsx
        │   ├── PersonFilter.tsx
        │   ├── RechnungenTable.tsx
        │   ├── RechnungForm.tsx
        │   ├── RechnungDetailSlider.tsx   ← Tabs: Details | Anträge | Anhänge | Aktivität
        │   │                                Tab Details: Finanzzeile Betrag/Erwartet/Tatsächlich
        │   ├── AktivitaetsLog.tsx
        │   ├── BeihilfeAntraege.tsx       ← Listenkomponente für Split-Layout (AntragCard)
        │   ├── BeihilfeAntragDetail.tsx   ← Detailkomponente, PKV- und BH-aware
        │   ├── BeihilfeBescheidForm.tsx   ← Bescheide/Abrechnungen; Labels je nach antrag.typ
        │   ├── BeihilfeBescheidKarte.tsx  ← Accordion-Karte pro Bescheid inkl. Positionen
        │   ├── BescheidAnhangUpload.tsx
        │   ├── ScanEditor.tsx
        │   └── StatusBadge.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useTheme.ts
        ├── pages/
        │   ├── DashboardPage.tsx
        │   ├── LoginPage.tsx
        │   ├── RechnungenPage.tsx
        │   ├── AktivitaetsLogPage.tsx
        │   ├── BeihilfeAntraegePage.tsx   ← Split-Layout Desktop / Vollbild-Wechsel Mobile
        │   │                                TYP-Filter (BH / PKV / BH+PKV) + Status-Filter
        │   └── StammdatenPage.tsx         ← Tabs: Personen | Beihilfestellen | PKV | Benutzer
        ├── types/
        │   └── index.ts
        └── utils/
            ├── aufgabenBuckets.ts
            ├── aufgabenFilter.ts
            ├── finanzStatus.ts            ← berechneFinanzKennzahlen() liefert jetzt auch
            │                                beihilfe_tatsaechlich (aus beihilfe_erstattet_betrag)
            ├── imageToGrayscalePdf.ts
            └── scanSettings.ts
```

---

## Architekturprinzipien

1. **Schichtenarchitektur im Backend:**
   - `handlers/` → HTTP Request/Response, Parameter validieren
   - `services/` → Fachliche Logik und Validierungsregeln
   - `repositories/` → SQL-Queries via SQLx

2. **Validierungsstrategie:**
   - DB: Strukturelle Constraints (NOT NULL, FK, UNIQUE)
   - Rust-Typen: "Make illegal states unrepresentable"
   - API/Services: Fachliche Validierungsregeln
   - Frontend: UX-Feedback, kein Sicherheitsnetz

3. **Derived State:**
   - Rechnungsstatus wird IMMER berechnet, niemals gespeichert
   - `zahlung_status`: abgeleitet aus `bezahlt_am`
   - `beihilfe_status`: abgeleitet aus `beihilfe_eingereicht_am`
   - `pkv_status`: abgeleitet aus `pkv_eingereicht_am`
   - `archiviert_status`: abgeleitet aus `archiviert_am`
   - `beihilfe_anteil_erwartet`: betrag × beihilfe_satz / 100
   - `pkv_anteil_erwartet`: betrag × pkv_satz / 100
   - `beihilfe_differenz`: beihilfe_erstattet_betrag − beihilfe_anteil_erwartet
   - `pkv_differenz`: pkv_erstattet_betrag − pkv_anteil_erwartet

4. **Bescheid → Rechnung Sync (Architekturprinzip):**
   - `rechnung.beihilfe_erstattet_betrag` wird NICHT manuell editiert
   - Wird ausschließlich durch `services::beihilfe_bescheide::sync_beihilfe_erstattet()` gesetzt
   - Aufruf nach jeder Änderung an `beihilfe_bescheid_position` (create, update, delete)
   - Logik: `SELECT SUM(anerkannt_betrag) FROM beihilfe_bescheid_position WHERE rechnung_id = ?`
   - Ergebnis NULL wenn keine Positionen vorhanden, sonst Summe aller anerkannten Beträge

5. **PATCH-Update-Muster (COALESCE):**
   - Alle PATCH-Endpunkte nutzen `COALESCE(?, spalte)` für optionale Felder
   - `null` / fehlende Felder im JSON → `None` in Rust → SQL NULL → COALESCE behält alten Wert
   - **Achtung**: Leere Strings `""` sind kein NULL — `COALESCE("", old) = ""`
   - Nullable FK-Felder im Frontend daher mit `antrag.pkv_id` (nicht `?? ''`) initialisieren
   - `paperless_share_url` ist Ausnahme: direktes Assignment (kann explizit auf NULL gesetzt werden)

---

## Stammdaten (Seed-Import)

`seed.rs` → `bootstrap()` beim Start:
- Wenn DB leer: importiert aus `SEED_FILE` (seed.json) oder Env-Variablen
- Wenn DB befüllt: kein Import (idempotent)

```json
{
  "mandant": { "name": "Familie Mustermann" },
  "benutzer": [
    { "name": "Max", "email": "max@example.com", "passwort": "..." }
  ],
  "beihilfestellen": [
    { "id": "bva", "name": "Bundesverwaltungsamt", "dienstherr_typ": "bund" }
  ],
  "personen": [
    { "name": "Max", "geburtsdatum": "1980-01-01", "typ": "erwachsener",
      "beihilfestelle_id": "bva", "beihilfe_satz": 50, "pkv_satz": 50 },
    { "name": "Kind 1", "geburtsdatum": "2020-05-10", "typ": "kind",
      "beihilfestelle_id": "bva", "beihilfe_satz": 80, "pkv_satz": 20 }
  ],
  "correspondents": [
    { "name": "Dr. Müller", "typ": "arzt" }
  ]
}
```

---

## Datenmodell

```sql
mandant (id, name)

benutzer (id, mandant_id, name, email, passwort_hash)

beihilfestelle (id, mandant_id, name, dienstherr_typ)
-- dienstherr_typ: 'bund' | 'land' | 'kommune'

beihilfestelle_personen (beihilfestelle_id, person_id, mandant_id)
-- Migration 0018; Join-Tabelle: welche Personen sind einer Beihilfestelle zugeordnet
-- Schränkt ein, welche Rechnungen einem BH-Antrag hinzugefügt werden können
-- Leer = keine Einschränkung (alle Personen erlaubt)

pkv (id, mandant_id, name, erstellt_am)
-- Migration 0022; PKV-Stammdaten (z. B. "HUK Coburg", "Debeka")

pkv_personen (pkv_id, person_id, mandant_id)
-- Migration 0022; analog zu beihilfestelle_personen
-- Schränkt ein, welche Rechnungen einem PKV-Antrag hinzugefügt werden können

person (id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle)
-- beihilfestelle_id: NULLABLE
-- bre_schwelle: REAL, NULLABLE

person_satz_historie (id, person_id, mandant_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am)
-- Migration 0020; historische BH/PKV-Sätze pro Person

correspondent (id, mandant_id, name, typ)
-- typ: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'

rechnung (
  id, mandant_id, person_id, leistungserbringer_id,
  typ,                          -- 'arzt' | 'apotheke' | 'krankenhaus'
  betrag,                       -- INTEGER (Cent); Rechnungsbetrag laut Originalrechnung
  datum, zahlungsziel,
  bezahlt_am,
  beihilfe_eingereicht_am,
  pkv_eingereicht_am,
  notiz,
  archiviert_am,
  referenz_nr,
  beihilfe_erstattet_betrag,    -- REAL, nullable; NICHT manuell editierbar
                                --   wird ausschließlich durch sync_beihilfe_erstattet() gesetzt
                                --   = SUM(beihilfe_bescheid_position.anerkannt_betrag) für diese Rechnung
  pkv_erstattet_betrag,         -- REAL, nullable; manuell editierbar
  pkv_gescannt,
  beihilfe_gescannt,
  pkv_verzicht,
  paperless_doc_id,
  paperless_uebertragen_am
)

anhang (id, mandant_id, rechnung_id, dateiname, pfad, groesse, erstellt_am)

einstellungen (key TEXT PRIMARY KEY, value TEXT NOT NULL)
-- Keys: paperless_ngx_url, paperless_ngx_token, mandant_name,
--       gdrive_service_account_json, gdrive_folder_id

-- Berechnete Felder (nicht gespeichert):
-- zahlung_status:              'offen' | 'bezahlt'
-- beihilfe_status:             'offen' | 'eingereicht' | NULL
-- pkv_status:                  'offen' | 'eingereicht'
-- archiviert_status:           'aktiv' | 'archiviert'
-- beihilfe_anteil_erwartet:    betrag * beihilfe_satz / 100
-- pkv_anteil_erwartet:         betrag * pkv_satz / 100
-- beihilfe_differenz:          beihilfe_erstattet_betrag − beihilfe_anteil_erwartet
-- pkv_differenz:               pkv_erstattet_betrag − pkv_anteil_erwartet

-- ── Beihilfe-Anträge (Migration 0012 + 0021 + 0022) ──────────────────────────

beihilfe_antrag (
  id, mandant_id,
  typ,                          -- 'beihilfe' | 'pkv' (Migration 0021)
  beihilfestelle_id,            -- FK → beihilfestelle; nullable (nur bei typ='beihilfe')
  pkv_id,                       -- FK → pkv; nullable (nur bei typ='pkv', Migration 0022)
  pkv_versicherer,              -- TEXT, nullable; Freitext-Fallback wenn kein PKV-Stammdatum
  referenz_nr,                  -- INTEGER, fortlaufend pro Mandant
  titel,                        -- TEXT, nullable
  status,                       -- 'entwurf'|'versendet'|'in_bearbeitung'|'beschieden'|'archiviert'
  versendet_am,                 -- TEXT, nullable
  notiz,                        -- TEXT, nullable
  paperless_share_url,          -- TEXT, nullable (Migration 0016)
                                --   Share-Link zu Paperless NGX Dokument
                                --   Kein API-Aufruf; reine Link-Speicherung
  erstellt_am
)

beihilfe_antrag_rechnung (
  antrag_id, rechnung_id,
  widerspruch,                  -- INTEGER NOT NULL DEFAULT 0
  hinzugefuegt_am
  PRIMARY KEY (antrag_id, rechnung_id)
)
-- Eine Rechnung kann in mehreren Anträgen erscheinen (Widerspruchsfall)

-- ── Beihilfe-Bescheide (Migration 0013) ──────────────────────────────────────

beihilfe_bescheid (
  id, mandant_id, antrag_id,
  aktenzeichen,                 -- TEXT, nullable
  bescheid_datum,               -- TEXT
  eingangsdatum,                -- TEXT, nullable
  erstattungsbetrag_gesamt,     -- INTEGER (Cent); Gesamtbetrag laut Bescheid (Kontrollfeld)
  typ,                          -- 'erstbescheid' | 'widerspruchsbescheid'
  notiz,                        -- TEXT, nullable
  erstellt_am
)

beihilfe_bescheid_position (
  id, bescheid_id, rechnung_id,
  tatsaechliche_kosten,         -- INTEGER (Cent), nullable (Migration 0017)
  anerkannt_betrag,             -- INTEGER (Cent), nullable
                                --   → nach Speichern: sync_beihilfe_erstattet(rechnung_id) aufrufen
  abgelehnt_betrag,             -- INTEGER (Cent), nullable
  ablehnungsgrund               -- TEXT, nullable
)

-- ── Bescheid-Anhänge (Migration 0015) ────────────────────────────────────────

bescheid_anhang (
  id, mandant_id, bescheid_id,
  dateiname, pfad, groesse, hochgeladen_am
)

-- ── Aktivitätslog (Migration 0014) ───────────────────────────────────────────

rechnung_aktivitaet (
  id, mandant_id, rechnung_id,
  benutzer_id,                  -- nullable; NULL = Systemaktion
  aktion,                       -- 'erstellt'|'geaendert'|'antrag_zugewiesen'|
                                --   'antrag_entfernt'|'anhang_hochgeladen'|'anhang_geloescht'
  aenderungen,                  -- TEXT (JSON): [{feld, alt, neu}]
  erstellt_am
)
```

---

## Finanzzeile pro Rechnung

Überall wo eine Rechnung detailliert dargestellt wird (RechnungDetailSlider, Antrag-Detailseite),
wird folgende Finanzzeile angezeigt:

| Feld | Quelle | Hinweis |
|---|---|---|
| Betrag | `rechnung.betrag` | Rechnungsbetrag (original) |
| Erwartet (BH) | `betrag × beihilfe_satz / 100` | berechnet |
| Tatsächlich (BH) | `rechnung.beihilfe_erstattet_betrag` | aus Bescheid-Positionen; leer wenn kein Bescheid |
| Differenz | `tatsächlich − erwartet` | grün wenn ≥ 0, rot wenn < 0, leer wenn tatsächlich NULL |

Im **Dashboard** (`AufgabenFinanzStatus`) werden diese Werte über alle relevanten Rechnungen aggregiert:
- Summe offener Beträge
- Summe erwarteter Beihilfe
- Summe tatsächlich erstatteter Beihilfe (nur Rechnungen mit vorhandenem Bescheid)

---

## API-Routen

```
GET    /api/config

POST   /api/auth/login

GET    /api/benutzer
POST   /api/benutzer
PATCH  /api/benutzer/:id
POST   /api/benutzer/:id/passwort
DELETE /api/benutzer/:id

GET    /api/beihilfestellen
POST   /api/beihilfestellen
PATCH  /api/beihilfestellen/:id
DELETE /api/beihilfestellen/:id
POST   /api/beihilfestellen/:id/personen   ← body: { person_id }
DELETE /api/beihilfestellen/:id/personen/:pid

GET    /api/pkv
POST   /api/pkv
PATCH  /api/pkv/:id
DELETE /api/pkv/:id
POST   /api/pkv/:id/personen               ← body: { person_id }
DELETE /api/pkv/:id/personen/:pid

GET    /api/personen
POST   /api/personen
PATCH  /api/personen/:id
DELETE /api/personen/:id
GET    /api/personen/:id/satz-historie
POST   /api/personen/:id/satz-historie
DELETE /api/personen/:id/satz-historie/:hid

GET    /api/correspondents
POST   /api/correspondents
PATCH  /api/correspondents/:id
DELETE /api/correspondents/:id

GET    /api/rechnungen?person_id=&archiviert=
POST   /api/rechnungen
POST   /api/rechnungen/bulk
GET    /api/rechnungen/:id
PATCH  /api/rechnungen/:id                     ← beihilfe_erstattet_betrag ist NICHT patchbar
DELETE /api/rechnungen/:id

GET    /api/rechnungen/:id/anhaenge
POST   /api/rechnungen/:id/anhaenge
GET    /api/rechnungen/:id/anhaenge/:aid
DELETE /api/rechnungen/:id/anhaenge/:aid

GET    /api/rechnungen/:id/aktivitaet

GET    /api/aktivitaet                         ← alle Aktivitäten des Mandanten

GET    /api/dashboard

GET    /api/einstellungen
PATCH  /api/einstellungen
POST   /api/einstellungen/paperless-test
POST   /api/einstellungen/gdrive-test

POST   /api/export

GET    /api/beihilfe-antraege?status=
POST   /api/beihilfe-antraege
GET    /api/beihilfe-antraege/:id
PATCH  /api/beihilfe-antraege/:id
DELETE /api/beihilfe-antraege/:id
PATCH  /api/beihilfe-antraege/:id/status       ← bei 'versendet': setzt beihilfe_eingereicht_am
POST   /api/beihilfe-antraege/:id/rechnungen   ← body: { rechnung_id, widerspruch? }
DELETE /api/beihilfe-antraege/:id/rechnungen/:rid

GET    /api/beihilfe-antraege/:id/bescheide
POST   /api/beihilfe-antraege/:id/bescheide
PATCH  /api/beihilfe-antraege/:id/bescheide/:bid
DELETE /api/beihilfe-antraege/:id/bescheide/:bid

POST   /api/beihilfe-antraege/:id/bescheide/:bid/positionen
       ← nach Speichern: sync_beihilfe_erstattet(rechnung_id)
PATCH  /api/beihilfe-antraege/:id/bescheide/:bid/positionen/:pid
       ← nach Speichern: sync_beihilfe_erstattet(rechnung_id)
DELETE /api/beihilfe-antraege/:id/bescheide/:bid/positionen/:pid
       ← nach Löschen: sync_beihilfe_erstattet(rechnung_id)

GET    /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge
POST   /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge
GET    /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid
DELETE /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid
```

---

## Beihilfe-Anträge & PKV-Anträge

### Typen

`beihilfe_antrag.typ` unterscheidet zwei Antragarten:

| Typ | Empfänger | Referenz | Bescheide |
|---|---|---|---|
| `beihilfe` | Beihilfestelle | `beihilfestelle_id` | Bescheide mit Positionen |
| `pkv` | PKV-Versicherer | `pkv_id` (FK) oder `pkv_versicherer` (Freitext) | „Abrechnungen" (gleiche DB-Struktur) |

Bei PKV-Anträgen:
- `BeihilfeBescheidForm` zeigt „Abrechnungen" statt „Bescheide" (dynamische Labels je nach `antrag.typ`)
- KI-Scan-Button ist für PKV-Anträge ausgeblendet
- Rechnungen werden gefiltert nach `pkv_eingereicht_am IS NULL` (statt `beihilfe_eingereicht_am`)

### Statusübergänge

```
entwurf → versendet → in_bearbeitung → beschieden → archiviert
```

- `versendet`: Setzt `beihilfe_eingereicht_am` auf allen zugewiesenen Rechnungen (sofern NULL). Datum überschreibbar.
- `beschieden`: Manuell gesetzt wenn Bescheid vorliegt und erfasst ist.
- `archiviert`: Endstatus; erscheint nicht in der Standardliste.

### Widerspruchsfall

- `widerspruch`-Flag auf `beihilfe_antrag_rechnung` markiert die betroffene Rechnung.
- Im RechnungDetailSlider (Tab „Anträge") werden alle Anträge angezeigt; Widerspruchsrechnungen markiert.

### Paperless Share-Link

- `paperless_share_url` auf `beihilfe_antrag`: freies Textfeld.
- Kein API-Aufruf an Paperless; reine Link-Speicherung.
- In der UI: anklickbarer Button „In Paperless öffnen" (öffnet neuen Tab) wenn gesetzt.

### Bescheid → Rechnung Sync

Nach jeder Änderung an `beihilfe_bescheid_position`:

```sql
UPDATE rechnung
SET beihilfe_erstattet_betrag = (
  SELECT SUM(anerkannt_betrag)
  FROM beihilfe_bescheid_position
  WHERE rechnung_id = ?
    AND anerkannt_betrag IS NOT NULL
)
WHERE id = ?
```

NULL wenn keine Positionen mit gesetztem `anerkannt_betrag`. Wird sofort in der UI reflektiert.

### Personen-Einschränkung pro Antrag

Wenn einer Beihilfestelle oder PKV Personen zugeordnet sind, können nur Rechnungen dieser Personen dem Antrag hinzugefügt werden. Leere Personen-Liste = keine Einschränkung.

---

## UI: Stammdaten (`StammdatenPage`)

Vier Tabs: **Personen | Beihilfestellen | PKV | Benutzer**

### PKV-Tab
- Liste aller PKV-Einträge (Name) mit Inline-Bearbeitung
- Personen-Zuweisung (Chips, analog Beihilfestellen-Tab)
- Löschen nur ohne referenzierte Anträge

### Beihilfestellen-Tab
- Analog PKV-Tab, mit zusätzlichem `dienstherr_typ`-Feld

---

## UI: Beihilfe-Anträge (`BeihilfeAntraegePage`)

### Seitenstruktur

**Desktop**: Split-Layout
- Links: schmale Liste (~360 px), filterbar nach Status + Typ
- Rechts: Detailbereich des gewählten Antrags

**Mobile**: Vollbild-Wechsel
- Standard: Liste
- Tap auf Antrag: Detailansicht (volle Breite), Zurück-Button oben links

### Antragsliste (`BeihilfeAntraege`)

Filter-Chips über der Liste:
- **Status**: Alle / Entwurf / Versendet / In Bearb. / Beschieden / Archiviert
- **Typ**: BH+PKV / BH / PKV

Jeder Eintrag (`AntragCard`):
- Referenznummer + Typ-Badge (BH teal / PKV blau) + Status-Badge
- Titel (Fallback: „Antrag #XXXX") + Beihilfestellen-/PKV-Name
- Erstellt- / Versendet-Datum
- Löschen-Button (nur für Entwürfe)

„+ Neuer Antrag": Formular mit Typ-Auswahl (BH/PKV), dann Beihilfestelle oder PKV-Select (aus Stammdaten, falls vorhanden; sonst Freitext)

### Antragdetail (`BeihilfeAntragDetail`)

**Kein separater Bearbeitungsmodus.** „Bearbeiten"-Button öffnet ein Inline-Formular im Header-Bereich.

#### Kopfbereich
- Referenznummer + Typ-Badge + Status-Badge (+ Widerspruchs-Badge falls relevant)
- Titel
- Institution (PKV-Name oder Beihilfestellen-Name)
- Gesamtbetrag der zugewiesenen Rechnungen
- Paperless-Link (gesetzt: anklickbar; nicht gesetzt: „+ verknüpfen")

#### Bearbeiten-Formular (Inline)
- Titel
- PKV-Select (aus Stammdaten) bei `typ='pkv'` / Beihilfestellen-Select bei `typ='beihilfe'`
- Notiz
- Fehleranzeige wenn PATCH fehlschlägt

#### Workflow-Stepper
Horizontal: Entwurf → Versendet → In Bearbeitung → Beschieden → Archiviert
- Klick auf nächsten Schritt → Datum-Bestätigung → Status-Wechsel

#### Abschnitt: Rechnungen
- Liste zugewiesener Rechnungen mit Ref / Betrag / Person / Leistungserbringer
- „kein Bescheid"-Badge wenn Bescheid existiert aber keine Position für diese Rechnung
- Dropdown „+ Rechnung hinzufügen" (gefiltert nach Typ und Personen-Einschränkung)

#### Abschnitt: Bescheide / Abrechnungen
→ `BeihilfeBescheidForm` (labels abhängig von `antrag.typ`)

---

## Detail-Slider (RechnungDetailSlider)

Overlay von rechts. Kein separater Seitenaufruf.

### Tabs

1. **Details** – alle Felder (bearbeitbar) + Finanzzeile oben
2. **Anträge** – alle Anträge dieser Rechnung mit Status + Link zur Antragseite; Widerspruchs-Flag sichtbar
3. **Anhänge** – Upload, Vorschau, Löschen
4. **Aktivität** – chronologischer Log mit Diff-Ansicht

### Finanzzeile (Tab Details, prominent oben)

```
Betrag          Erwartet (BH)     Tatsächlich (BH)    Differenz
123,00 €        61,50 €           58,00 €             −3,50 €  ← rot
```

`beihilfe_erstattet_betrag`: read-only (Quelle: Bescheid-Positionen, Sync durch Backend).
`pkv_erstattet_betrag`: weiterhin manuell editierbar.

### Verhalten

- URL-State: `?rechnung=42`
- Schließen: Escape / Backdrop / Schließen-Button
- Mobile: volle Bildschirmbreite

---

## Aktivitätslog

### Erfasste Aktionen

| `aktion` | Auslöser | `aenderungen` |
|---|---|---|
| `erstellt` | POST /api/rechnungen | leer |
| `geaendert` | PATCH /api/rechnungen/:id | [{feld, alt, neu}] |
| `antrag_zugewiesen` | Rechnung → Antrag | {antrag_id, antrag_referenz_nr} |
| `antrag_entfernt` | Rechnung aus Antrag entfernt | {antrag_id, antrag_referenz_nr} |
| `anhang_hochgeladen` | POST anhaenge | {dateiname, groesse} |
| `anhang_geloescht` | DELETE anhaenge | {dateiname} |

### Diff-Format

```json
[
  { "feld": "betrag", "alt": "8500", "neu": "9200" },
  { "feld": "bezahlt_am", "alt": null, "neu": "2026-04-15" }
]
```

Betragsfelder in Cent gespeichert, Anzeige in Euro.

### Ansichten

- **Im Slider** (Tab Aktivität): chronologisch, neueste zuerst
- **`AktivitaetsLogPage`**: Gesamtansicht; filterbar nach Rechnung, Person, Aktion, Zeitraum

---

## Scan-Funktionalität

1. „Scannen" → Kamera / „PDF" → Datei-Picker
2. Foto → **ScanEditor**-Overlay
   - Zuschneiden (Rechteck-Handles, Pointer-Events)
   - Automatische Dokumenterkennung (Sobel-Kantenerkennung)
   - Drehen (90°)
   - Weitere Seite (wenn `MULTIPAGE_SCAN=true`)
3. Hochladen → mehrseitiges Graustufen-PDF

**Bildverarbeitung** (`utils/imageToGrayscalePdf.ts`):
- `fileToGrayscalePdf(file)` → einseitiges PDF
- `canvasesToPdf(canvases[])` → mehrseitiges PDF

**Scan-Einstellungen** (localStorage):
- `scan_max_dim`: Default 3500, Range 500–8000
- `scan_jpeg_quality`: Default 0.82, Range 0.1–1.0

**ScanEditor**: Vollbild-Overlay, Canvas-basiert, Touch & Maus, 32 px Tap-Radius (Mobile).

---

## Export-Funktionalität

- **Lokal**: `EXPORTS_DIR/{timestamp}/`, Dateinamen nach Referenznummer + Leistungserbringer
- **Google Drive**: Service Account JWT (RS256), Scope `drive.file`, Token 1h; gibt Ordner-Link zurück

---

## Wichtige Geschäftsregeln

1. Rechnungsstatus immer berechnet, nie gespeichert
2. Personen ohne Beihilfestelle: `beihilfe_status = NULL`
3. Massenaktionen: `bezahlt`, `beihilfe_eingereicht`, `pkv_eingereicht`, `archivieren`, `dearchivieren`
4. Archivierte Rechnungen: nicht im Dashboard, nicht in Standardtabelle
5. `referenz_nr`: `MAX(referenz_nr) + 1` pro Mandant
6. Löschen referenzierter Stammdaten → 409 Conflict
7. Benutzer können sich nicht selbst löschen
8. Anhänge: nur PDF (Magic-Bytes-Prüfung); Bilder werden im Frontend zu PDF konvertiert
9. `pkv_verzicht`: bleibt im Bucket „PKV einreichen", als „zurückgestellt" markiert
10. Einstellungen über .env vorgebbar; DB-Werte überschreiben Env-Werte
11. Antrag `versendet`: setzt `beihilfe_eingereicht_am` (sofern NULL); Datum überschreibbar
12. Rechnung kann in mehreren Anträgen erscheinen (Widerspruchsfall)
13. Aktivitätslog: jede Änderung mit Diff persistent; `benutzer_id = NULL` für Systemaktionen
14. `beihilfe_erstattet_betrag`: NICHT manuell editierbar; nur durch `sync_beihilfe_erstattet()` nach Bescheid-Positions-Änderungen
15. PKV-Antrag: `pkv_id` referenziert PKV-Stammdaten; `pkv_versicherer` ist Freitext-Fallback (Legacy)
16. Personen-Zuordnung bei Beihilfestelle/PKV schränkt hinzufügbare Rechnungen ein; leer = alle erlaubt

---

## UI-Prinzipien

- **Keine modalen Dialoge** für häufige Aktionen
- **Inline-Editing** ohne separaten Bearbeitungsmodus (onBlur → sofort speichern)
- **Optimistic UI**: Änderungen sofort in der UI reflektieren
- Rechnungen in sortierbarer Tabelle
- Massenaktionen via BulkActionBar (fixiert am unteren Rand bei Selektion)
- Stammdaten über Tab-Interface
- **Mobile-First**: Breakpoint `sm` = 640px
- **Detail-Slider** statt Inline-Bearbeitung in Tabellen

### Mobile-Responsive-Muster

| Komponente | Mobile | Desktop (sm+) |
|---|---|---|
| `RechnungenTable` | Kartenansicht → öffnet Slider | Tabelle |
| `StammdatenPage` Tabs | Kartenansicht + Inline-Form | Tabelle |
| `RechnungDetailSlider` | Vollbild (`w-full`) | Seitenpanel (`w-[600px]`) |
| `BeihilfeAntraegePage` | Liste → Detail (Vollbild-Wechsel) | Split-Layout (~360px / Rest) |
| `RechnungForm` | 1-spaltig | 2–4-spaltig |
| `BulkActionBar` | Kurze Labels | Lange Labels |
| `ScanEditor` | Vollbild, 32px Touch-Handles | Vollbild |

---

## Dashboard / Aufgaben-Übersicht

### Paralleles Bucket-Modell

| Bucket | Bedingung |
|---|---|
| `zu_bezahlen` | `bezahlt_am IS NULL` |
| `beihilfe_einreichen` | Person hat Beihilfestelle UND `beihilfe_eingereicht_am IS NULL` |
| `warten_beihilfe` | `beihilfe_eingereicht_am IS NOT NULL` UND `beihilfe_erstattet_betrag IS NULL` |
| `pkv_einreichen` | `pkv_eingereicht_am IS NULL` |
| `warten_pkv` | `pkv_eingereicht_am IS NOT NULL` UND `pkv_erstattet_betrag IS NULL` |
| `bereit_archivieren` | Rechnung ist in keinem anderen Bucket |

`pkv_einreichen`: Rechnungen mit `pkv_verzicht=true` als **zurückgestellt** separat.

### Finanzstatus (`AufgabenFinanzStatus`)

`berechneFinanzKennzahlen()` liefert:
- Zahlungsstatus: offen / bezahlt
- Beihilfe: ausstehend, erwartet, tatsächlich erstattet (`beihilfe_erstattet_betrag`), Differenz
- PKV: ausstehend, erwartet, erstattet, Differenz
- **BRE pro Person**: `einreichen` | `schonen` | `bereits_ueberschritten` | `keine_schwelle`

`BREIndikator`: pro Person PKV offen / Schwelle / Spielraum (grün/rot).

---

## Deployment

**Entwicklung:**
```bash
docker compose up --build
```

**Release:**
```bash
docker compose -f docker-compose.release.yml up -d
```

**`.env`:**
```
JWT_SECRET=<32+ Zeichen>
PORT=3000
UI_PORT=8090
MULTIPAGE_SCAN=true
PAPERLESS_NGX_URL=
PAPERLESS_NGX_TOKEN=
```

**Volumes:**
- `./data`: SQLite + seed.json → Backup = Datei kopieren
- `uploads` (named): `/uploads/{rechnung_id}/{id}.pdf`
- `./data/exports`: exportierte PDFs

Images exportieren:
```bash
docker build -t pkv-app-backend:latest ./backend
docker build -t pkv-app-frontend:latest ./frontend
docker save pkv-app-backend:latest pkv-app-frontend:latest | gzip > release/pkv-app-images.tar.gz
```

---

*Letzte Aktualisierung: 2026-05-21 | Version: 2.3*
