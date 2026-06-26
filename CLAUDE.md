# PKV- und Beihilfe-Abrechnungs-App
## Projektkontext für Claude Code

---

## Projektziel

Self-hosted Server-Client-Applikation zur Verwaltung von Arzt-, Apotheken- und Krankenhausrechnungen für eine Familie mit PKV und Beihilfe (Beamtenstatus). Fokus: Rechnungen erfassen, Einreichung tracken, Erstattungen nachverfolgen, Belege archivieren.

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Backend | Rust + Axum |
| Datenbank | SQLite + SQLx |
| Migrationen | sqlx-cli (`backend/migrations/`, aktuell 0001–0028) |
| Frontend | React + TypeScript + Tailwind CSS |
| Container | Docker + Docker Compose |
| Auth | JWT (jsonwebtoken crate) |

---

## Projektstruktur

```
pkv-app/
├── CLAUDE.md
├── docker-compose.yml
├── docker-compose.release.yml
├── .env
├── data/
│   ├── pkv.db
│   ├── exports/
│   └── seed.json          ← optional; Ersteinrichtung alternativ über /setup im Browser
├── backend/
│   ├── Cargo.toml
│   ├── migrations/        ← 0001_init.sql … 0028_bescheid_anhang_ocr.sql
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── errors.rs      ← AppError: NotFound, Unauthorized, BadRequest, Conflict, Database, Internal
│       ├── auth/mod.rs    ← JWT create_token / verify_token, AuthUser extractor, JwtSecret extension
│       ├── db/mod.rs
│       ├── seed.rs        ← bootstrap(): seed.json → env vars → no-op (Setup via UI)
│       ├── models/        ← Typen pro Entität (Rechnung, Person, Pkv, BeihilfeAntrag, Beleg …)
│       ├── handlers/
│       │   ├── setup.rs          ← GET /api/setup/status, POST /api/setup (public, kein JWT)
│       │   ├── auth.rs           ← POST /api/auth/login
│       │   ├── config.rs         ← GET /api/config
│       │   ├── logo.rs           ← GET/POST/DELETE /api/logo (SVG)
│       │   ├── rechnungen.rs
│       │   ├── anhaenge.rs
│       │   ├── beihilfe_antraege.rs
│       │   ├── beihilfe_bescheide.rs  ← ruft sync_beihilfe_erstattet() nach Position-Änderung
│       │   ├── belege.rs         ← Upload, OCR, Thumbnail, Verknüpfungen Rechnung↔Antrag
│       │   ├── dashboard.rs
│       │   ├── personen.rs
│       │   ├── beihilfestellen.rs
│       │   ├── pkv.rs            ← CRUD + Personen-Zuordnung für PKV-Stammdaten
│       │   ├── correspondents.rs
│       │   ├── benutzer.rs
│       │   ├── einstellungen.rs
│       │   ├── aktivitaet.rs
│       │   ├── export.rs
│       │   └── backup.rs             ← GET /api/backup/download (ZIP-Stream), POST /api/backup/restore
│       ├── services/
│       │   ├── beihilfe_bescheide.rs  ← sync_beihilfe_erstattet(rechnung_id, db)
│       │   ├── beihilfe_antraege.rs   ← Statusübergänge, beihilfe_eingereicht_am setzen
│       │   ├── aktivitaet.rs
│       │   ├── rechnungen.rs
│       │   ├── export.rs
│       │   ├── ocr.rs                ← Tesseract-Wrapper; STATUS_DONE/FAILED/UNAVAILABLE
│       │   ├── bescheid_ocr.rs       ← BescheidVorschlag aus OCR-Text; parse(text, rechnungen)
│       │   ├── thumbnail.rs
│       │   ├── gdrive.rs
│       │   └── paperless.rs
│       └── repositories/  ← SQL-Queries pro Entität
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.tsx         ← RequireAuth, Routen inkl. /setup, /belege, /stammdaten
        ├── api/
        │   ├── client.ts          ← api.get/post/patch/delete; 401 → /login
        │   ├── setup.ts           ← getSetupStatus(), doSetup()
        │   ├── belege.ts          ← getBelege, uploadBeleg, fetchBelegBlob, fetchBelegThumbnailBlob …
        │   ├── bescheid_anhaenge.ts ← Upload, OCR-Trigger, getBescheidVorschlag, Blob-Download
        │   ├── backup.ts          ← downloadBackup(), restoreBackup(file)
        │   ├── logo.ts            ← uploadLogo, deleteLogo, LOGO_URL
        │   ├── rechnungen.ts
        │   ├── beihilfe_antraege.ts
        │   ├── beihilfe_bescheide.ts
        │   ├── dashboard.ts
        │   ├── personen.ts
        │   ├── pkv.ts             ← getPkv, createPkv … addPersonToPkv, removePersonFromPkv
        │   └── …
        ├── components/
        │   ├── Layout.tsx                ← fullBleed für /belege, /stammdaten, /dashboard, /aktivitaetslog
        │   ├── RechnungDetailSlider.tsx  ← Tabs: Details | Anträge | Anhänge | Aktivität
        │   ├── RechnungForm.tsx
        │   ├── RechnungenTable.tsx
        │   ├── BulkActionBar.tsx
        │   ├── BelegCard.tsx             ← Kachel mit DocThumb, TypeBadge, Hover-Overlay
        │   ├── BelegDetailSlider.tsx     ← Tabs: Details | Verknüpfungen | Inhalt; DocViewer
        │   ├── BelegeUpload.tsx
        │   ├── BelegPicker.tsx
        │   ├── BelegReferenzListe.tsx
        │   ├── VerknuepfungPicker.tsx    ← Modal: Rechnung/Antrag mit Beleg verknüpfen
        │   ├── RechnungPicker.tsx
        │   ├── AusstellerSelect.tsx
        │   ├── BeihilfeAntraege.tsx      ← Listenkomponente (AntragCard)
        │   ├── BeihilfeAntragDetail.tsx
        │   ├── BeihilfeBescheidForm.tsx  ← Labels dynamisch je antrag.typ
        │   ├── BeihilfeBescheidKarte.tsx
        │   ├── BescheidAnhangUpload.tsx
        │   ├── AnhangUpload.tsx
        │   ├── ScanEditor.tsx
        │   ├── AktivitaetsLog.tsx        ← Exports: AKTION_LABELS, AKTION_DOT, parseAenderungen, AktivitaetDiffs, AktivitaetItem, formatTimestamp
        │   ├── BREIndikator.tsx
        │   ├── GlobalSearch.tsx
        │   ├── PersonFilter.tsx
        │   └── StatusBadge.tsx
        ├── pages/
        │   ├── SetupPage.tsx        ← Ersteinrichtung: Mandant + Admin-Account
        │   ├── LoginPage.tsx        ← prüft /api/setup/status → leitet ggf. zu /setup
        │   ├── DashboardPage.tsx
        │   ├── RechnungenPage.tsx
        │   ├── BeihilfeAntraegePage.tsx
        │   ├── BelegePage.tsx       ← fullBleed; Sidebar-Filter + Grid + BelegDetailSlider; Sort: neu|datum_neu|datum_alt|az
        │   ├── StammdatenPage.tsx   ← fullBleed; Sidebar-Nav (6 Bereiche) + MobileTabBar
        │   ├── AuswertungPage.tsx
        │   ├── AktivitaetsLogPage.tsx ← fullBleed; Sidebar Person/Aktion-Filter + 2× MobileTabBar; Tag-Gruppen
        │   └── UeberPage.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useTheme.ts
        ├── context/
        │   ├── ToastContext.tsx    ← showToast(msg, action?) — action: { label, onClick } only
        │   └── JahrContext.tsx
        └── utils/
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
   - Rust-Typen: „Make illegal states unrepresentable"
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

4. **Bescheid → Rechnung Sync:**
   - `rechnung.beihilfe_erstattet_betrag` wird NICHT manuell editiert
   - Ausschließlich durch `services::beihilfe_bescheide::sync_beihilfe_erstattet()` gesetzt
   - Aufruf nach jeder Änderung an `beihilfe_bescheid_position` (create, update, delete)
   - Logik: `SELECT SUM(anerkannt_betrag) FROM beihilfe_bescheid_position WHERE rechnung_id = ?`

5. **PATCH-Update-Muster (COALESCE):**
   - Alle PATCH-Endpunkte nutzen `COALESCE(?, spalte)` für optionale Felder
   - `null` / fehlende Felder im JSON → `None` in Rust → SQL NULL → COALESCE behält alten Wert
   - **Achtung**: Leere Strings `""` sind kein NULL — `COALESCE("", old) = ""`
   - Nullable FK-Felder im Frontend daher mit `antrag.pkv_id` (nicht `?? ''`) initialisieren
   - `paperless_share_url` ist Ausnahme: direktes Assignment (kann explizit auf NULL gesetzt werden)

---

## Ersteinrichtung / Onboarding

`seed.rs → bootstrap()` beim Start prüft ob die DB leer ist. Drei Pfade:

1. **seed.json** (`SEED_FILE` env): importiert Mandant, Benutzer, Beihilfestellen, Personen, Correspondents
2. **Env-Variablen** (`ADMIN_EMAIL` + `ADMIN_PASSWORD`): legt minimalen Mandant + Admin an
3. **Keine Konfiguration**: DB bleibt leer → Ersteinrichtung über `/setup` im Browser

**Setup-Endpunkte** (public, kein JWT):
- `GET /api/setup/status` → `{ needs_setup: bool }`
- `POST /api/setup` → `{ mandant_name, name, email, passwort }` → `{ token }`

`LoginPage` prüft beim Laden den Setup-Status und leitet automatisch zu `/setup` weiter.

---

## Datenmodell

```sql
mandant (id, name)

benutzer (id, mandant_id, name, email, passwort_hash)

beihilfestelle (id, mandant_id, name, dienstherr_typ)
-- dienstherr_typ: 'bund' | 'land' | 'kommune'

beihilfestelle_personen (beihilfestelle_id, person_id, mandant_id)
-- Join-Tabelle; leer = alle Personen erlaubt

pkv (id, mandant_id, name, erstellt_am)

pkv_personen (pkv_id, person_id, mandant_id)
-- analog beihilfestelle_personen

person (id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle)
-- typ: 'erwachsener' | 'kind'

person_satz_historie (id, person_id, mandant_id, beihilfe_satz, pkv_satz, gueltig_ab, erstellt_am)

correspondent (id, mandant_id, name, typ)
-- typ: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'

rechnung (
  id, mandant_id, person_id, leistungserbringer_id,
  typ,                          -- 'arzt' | 'apotheke' | 'krankenhaus'
  betrag,                       -- INTEGER (Cent)
  datum, zahlungsziel,
  bezahlt_am,
  beihilfe_eingereicht_am,
  pkv_eingereicht_am,
  notiz, archiviert_am, referenz_nr,
  beihilfe_erstattet_betrag,    -- REAL, nullable; NUR durch sync_beihilfe_erstattet() gesetzt
  pkv_erstattet_betrag,         -- REAL, nullable; manuell editierbar
  pkv_gescannt, beihilfe_gescannt,
  pkv_verzicht,
  paperless_doc_id, paperless_uebertragen_am
)

anhang (id, mandant_id, rechnung_id, dateiname, pfad, groesse, erstellt_am)

einstellungen (key TEXT PRIMARY KEY, value TEXT NOT NULL)
-- Keys: paperless_ngx_url, paperless_ngx_token, gdrive_service_account_json, gdrive_folder_id,
--       n8n_webhook_url, n8n_rechnung_webhook_url

beihilfe_antrag (
  id, mandant_id,
  typ,                  -- 'beihilfe' | 'pkv'
  beihilfestelle_id,    -- nullable (nur typ='beihilfe')
  pkv_id,               -- nullable (nur typ='pkv')
  pkv_versicherer,      -- TEXT nullable; Freitext-Fallback
  referenz_nr, titel, status, versendet_am, notiz, paperless_share_url, erstellt_am
  -- status: 'entwurf'|'versendet'|'in_bearbeitung'|'beschieden'|'archiviert'
)

beihilfe_antrag_rechnung (antrag_id, rechnung_id, widerspruch, hinzugefuegt_am)
-- widerspruch: INTEGER NOT NULL DEFAULT 0

beihilfe_bescheid (
  id, mandant_id, antrag_id,
  aktenzeichen, bescheid_datum, eingangsdatum,
  erstattungsbetrag_gesamt,     -- INTEGER (Cent); Kontrollfeld
  typ,                          -- 'erstbescheid' | 'widerspruchsbescheid'
  notiz, erstellt_am
)

beihilfe_bescheid_position (
  id, bescheid_id, rechnung_id,
  tatsaechliche_kosten,         -- INTEGER (Cent), nullable
  anerkannt_betrag,             -- INTEGER (Cent), nullable → triggert sync_beihilfe_erstattet
  abgelehnt_betrag,             -- INTEGER (Cent), nullable
  ablehnungsgrund               -- TEXT, nullable
)

bescheid_anhang (id, mandant_id, bescheid_id, dateiname, pfad, groesse, hochgeladen_am,
                 ocr_text, ocr_status)   -- ocr_status: null | 'done' | 'failed' | 'unavailable'

rechnung_aktivitaet (
  id, mandant_id, rechnung_id, benutzer_id,  -- nullable = Systemaktion
  aktion,        -- 'erstellt'|'geaendert'|'antrag_zugewiesen'|'antrag_entfernt'|
                 --   'anhang_hochgeladen'|'anhang_geloescht'
  aenderungen,   -- TEXT (JSON): [{feld, alt, neu}]
  erstellt_am
)

beleg (
  id, mandant_id, dateiname, pfad, groesse,
  bezeichnung, typ, notiz, datum,
  hochgeladen_am, has_thumbnail,
  ocr_text, ocr_status    -- ocr_status: null | 'done'
)

beleg_rechnung (beleg_id, rechnung_id, mandant_id, verknuepft_am)
beleg_antrag   (beleg_id, antrag_id,  mandant_id, verknuepft_am)
```

---

## API-Routen

```
-- Setup (public)
GET    /api/setup/status
POST   /api/setup

-- Auth (public)
GET    /api/config
GET    /api/logo
POST   /api/auth/login

-- Logo
POST   /api/logo
DELETE /api/logo

-- Benutzer
GET    /api/benutzer
POST   /api/benutzer
PATCH  /api/benutzer/:id
POST   /api/benutzer/:id/passwort
DELETE /api/benutzer/:id

-- Beihilfestellen
GET/POST       /api/beihilfestellen
PATCH/DELETE   /api/beihilfestellen/:id
POST/DELETE    /api/beihilfestellen/:id/personen[/:pid]

-- PKV
GET/POST       /api/pkv
PATCH/DELETE   /api/pkv/:id
POST/DELETE    /api/pkv/:id/personen[/:pid]

-- Personen
GET/POST       /api/personen
PATCH/DELETE   /api/personen/:id
GET/POST       /api/personen/:id/satz-historie
DELETE         /api/personen/:id/satz-historie/:hid

-- Correspondents
GET/POST       /api/correspondents
PATCH/DELETE   /api/correspondents/:id

-- Rechnungen
GET    /api/rechnungen?person_id=&archiviert=
POST   /api/rechnungen
POST   /api/rechnungen/bulk
GET    /api/rechnungen/:id
PATCH  /api/rechnungen/:id        ← beihilfe_erstattet_betrag ist NICHT patchbar
DELETE /api/rechnungen/:id
GET/POST/DELETE /api/rechnungen/:id/anhaenge[/:aid]
GET    /api/rechnungen/:id/aktivitaet
GET/POST/DELETE /api/rechnungen/:id/belege[/:bid]

-- Aktivität
GET    /api/aktivitaet

-- Dashboard
GET    /api/dashboard

-- Einstellungen
GET/PATCH      /api/einstellungen
POST           /api/einstellungen/paperless-test
POST           /api/einstellungen/gdrive-test

-- Export
POST   /api/export

-- Backup
GET    /api/backup/download      ← ZIP-Stream (pkv.db + /uploads); schreibt last_backup_at
POST   /api/backup/restore       ← ZIP hochladen; überschreibt DB + Uploads; exit(0) → Docker-Restart

-- Beihilfe-Anträge
GET/POST       /api/beihilfe-antraege
GET/PATCH/DELETE /api/beihilfe-antraege/:id
PATCH          /api/beihilfe-antraege/:id/status
GET/POST/DELETE /api/beihilfe-antraege/:id/rechnungen[/:rid]
GET/POST/PATCH/DELETE /api/beihilfe-antraege/:id/bescheide[/:bid]
GET/POST/PATCH/DELETE /api/beihilfe-antraege/:id/bescheide/:bid/positionen[/:pid]
               ← create/update/delete rufen sync_beihilfe_erstattet(rechnung_id) auf
GET/POST/DELETE /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge[/:aid]
POST            /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid/ocr
GET             /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid/vorschlag
               ← BescheidVorschlag: parsed OCR → {bescheid_datum, aktenzeichen, erstattungsbetrag_gesamt, positionen[]}
GET/POST/DELETE /api/beihilfe-antraege/:id/belege[/:bid]

-- Belege
GET    /api/belege?q=&typ=&datum_von=&datum_bis=
POST   /api/belege
GET    /api/belege/:id
PATCH  /api/belege/:id
DELETE /api/belege/:id
GET    /api/belege/:id/datei
GET    /api/belege/:id/thumbnail
POST   /api/belege/:id/ocr
```

---

## Belegverwaltung (`BelegePage`)

Vollbild-Layout (fullBleed) mit Sidebar-Filter + Kachelgrid.

**Beleg-Typen** mit Farbkodierung:
| Typ | Farbe |
|---|---|
| `rechnung` | amber |
| `erstbescheid` | teal |
| `widerspruchsbescheid` | rose |
| `rezept` | green |
| `ueberweisung` | blue |
| `sonstiges` | purple |

**BelegCard**: Faux-Paper-Vorschau (`DocThumb`) oder reales Thumbnail, TypeBadge, Verknüpfungs-Badge, OCR-Status. Hover-Overlay mit „Öffnen & bearbeiten".

**BelegDetailSlider**: 3 Tabs — Details (Metadaten editierbar), Verknüpfungen (Rechnungen + Anträge als LinkRows), Inhalt (OCR-Text mit Suche). DocViewer schiebt als 470px-Panel von rechts ein und verschiebt den Haupt-Panel nach links.

**Sortierung**: `neu` (Hochgeladen, neueste) | `datum_neu` (Belegdatum, neueste) | `datum_alt` (Belegdatum, älteste) | `az` (Name A–Z); Belege ohne `datum` sortieren bei Datums-Modi ans Ende.

**OCR**: Backend startet Tesseract asynchron nach Upload; Frontend pollt (`refetchInterval`) bis `ocr_status === 'done'`.

**Verknüpfungen**: Ein Beleg kann mit beliebig vielen Rechnungen und Anträgen verknüpft werden. `beleg_rechnung` / `beleg_antrag` sind reine Join-Tabellen ohne zusätzliche Semantik.

---

## Beihilfe-Anträge & PKV-Anträge

### Typen

| Typ | Empfänger | Referenz | Bescheide |
|---|---|---|---|
| `beihilfe` | Beihilfestelle | `beihilfestelle_id` | Bescheide mit Positionen |
| `pkv` | PKV-Versicherer | `pkv_id` (FK) oder `pkv_versicherer` (Freitext) | „Abrechnungen" (gleiche Struktur) |

### Statusübergänge

```
entwurf → versendet → in_bearbeitung → beschieden → archiviert
```

- `versendet`: setzt `beihilfe_eingereicht_am` auf zugewiesenen Rechnungen (sofern NULL)
- `archiviert`: Endstatus; erscheint nicht in der Standardliste

### Bescheid → Rechnung Sync

Nach jeder Änderung an `beihilfe_bescheid_position`:

```sql
UPDATE rechnung
SET beihilfe_erstattet_betrag = (
  SELECT SUM(anerkannt_betrag)
  FROM beihilfe_bescheid_position
  WHERE rechnung_id = ? AND anerkannt_betrag IS NOT NULL
)
WHERE id = ?
```

### Personen-Einschränkung

Wenn einer Beihilfestelle/PKV Personen zugeordnet sind, können nur Rechnungen dieser Personen hinzugefügt werden. Leere Liste = keine Einschränkung.

---

## Finanzzeile pro Rechnung

Überall wo eine Rechnung detailliert dargestellt wird (RechnungDetailSlider, Antrag-Detailseite):

| Feld | Quelle |
|---|---|
| Betrag | `rechnung.betrag` |
| Erwartet (BH) | `betrag × beihilfe_satz / 100` |
| Tatsächlich (BH) | `rechnung.beihilfe_erstattet_betrag` (read-only) |
| Differenz | `tatsächlich − erwartet`; grün ≥ 0, rot < 0, leer wenn NULL |

---

## Dashboard (Zielzustand)

Das Dashboard beantwortet die drei zentralen Fragen: **Was muss ich jetzt tun? Was steht noch aus? Wie ist mein Finanzstatus?**

### Header — 4 KPIs (jahresbezogen)

| KPI | Quelle | Farbe |
|---|---|---|
| Eigenkosten offen | Rechnungen mit `bezahlt_am IS NULL` → Summe `betrag` | amber |
| Ausstehende Erstattungen | Eingereichte Rechnungen ohne vollständige Erstattung → erw. BH + PKV | blue |
| Dieses Jahr erstattet | `SUM(beihilfe_erstattet_betrag + pkv_erstattet_betrag)` | green |
| Einzureichen | Anzahl Rechnungen bereit für BH oder PKV (noch nicht eingereicht) | neutral |

### Aktionszone — 3 Kacheln

**1. Rechnungen bezahlen** (amber)
- Liste offener Rechnungen (`bezahlt_am IS NULL`), sortiert nach Fälligkeit
- Zeigt: Person, Betrag, Fälligkeitsdatum, Leistungserbringer
- Klick → RechnungDetailSlider

**2. Bei Beihilfe einreichen** (blue)
- Rechnungen mit Beihilfestelle, `beihilfe_eingereicht_am IS NULL`, nicht archiviert
- Zeigt: Anzahl Rechnungen, Summe voraussichtliche BH-Erstattung
- Link → Anträge-Seite zum Anlegen eines neuen Antrags

**3. Bei PKV einreichen** (teal)
- Rechnungen mit `pkv_eingereicht_am IS NULL`, `pkv_verzicht = false`, nicht archiviert
- Zeigt: Anzahl, voraussichtliche PKV-Erstattung
- BRE-Hinweis je Person wenn Schwelle gefährdet
- `pkv_verzicht`-Rechnungen separat als „zurückgestellt" aufgeführt

### Statuszone

**Laufende Anträge** — offene BH- und PKV-Anträge (Status: versendet, in_bearbeitung)
- Je Antrag: Referenznummer, Typ-Badge, Institution, Gesamtbetrag, Tage seit Einreichung
- Klick → Anträge-Seite

**Letzte Bescheide** — chronologische Liste der neuesten Bescheide/Abrechnungen
- Kompakte Darstellung: Datum, Institution, erstattet vs. abgelehnt (Balken)
- Widerspruchsmöglichkeit erkennbar

**BRE-Indikator** (`BREIndikator`) — pro Person mit konfigurierter Schwelle
- Balken: bereits bei PKV eingereicht / noch offen / Schwelle
- Status: `einreichen` | `schonen` | `bereits_ueberschritten` | `keine_schwelle`

---

## UI: Stammdaten (`StammdatenPage`)

Vollbild-Layout (fullBleed) mit Sidebar-Navigation (analoges Muster wie BelegePage).

**Sidebar-Gruppen:**
- Verwaltung: Personen · Beihilfestellen · PKV · Leistungserbringer
- System: Benutzer · Einstellungen

**Einstellungen-Tab** enthält: Logo (SVG), Scan-Parameter, Paperless NGX, n8n-Webhooks, Google Drive, Datensicherung.

**Datensicherung** (ganz unten im Tab): Zeigt `last_backup_at` aus `einstellungen`-Tabelle (grüner Status-Badge oder amber-Warnung wenn noch nie gesichert). Button „Backup herunterladen" streamt ZIP via `GET /api/backup/download`. Restore-Button (rot, mit Confirm-Dialog) lädt ZIP hoch via `POST /api/backup/restore` → App startet automatisch neu (Docker `restart: unless-stopped`).

**Mobile**: MobileTabBar — horizontal scrollbare Tab-Leiste (`className="sm:hidden"`) ersetzt Desktop-Sidebar. Sidebar selbst: `className="hidden sm:flex"`.

---

## UI: Aktivitätslog (`AktivitaetsLogPage`)

Vollbild-Layout (fullBleed), `flex flex-col sm:flex-row`.

**Desktop-Sidebar** (220 px): FilterGroup „Person" + FilterGroup „Aktion" mit `FilterRow`-Komponente (dot, Label, Count-Badge).

**Mobile**: zwei horizontal scrollbare Tab-Leisten (`sm:hidden`):
1. Person-Filter (über Toolbar)
2. Aktions-Filter (unter Toolbar)

**Hauptbereich**: Einträge nach Kalendertagen gruppiert (`TAG-HEADER` uppercase, Karten pro Eintrag). Klick auf Karte öffnet `RechnungDetailSlider`.

**Datenquellen**: `getAllAktivitaet`, `getRechnungen()` (für Referenz-Nr + Person), `getPersonen`. Facet-Counts per `useMemo`.

**Suche**: nach Person-Name oder Rechnungs-Referenz (`R-0001`-Format).

**AktivitaetsLog-Komponente** (`components/AktivitaetsLog.tsx`): dual-use — `AktivitaetItem` für den Slider-Tab (vollständig mit Dot + Header), `AktivitaetDiffs` nur für Diff-Zeilen (ohne Header, für Seiten-Karten). Alle CSS-Farben über `var(--…)`, kein Tailwind gray/dark:.

---

## UI: Beihilfe-Anträge (`BeihilfeAntraegePage`)

**Desktop**: Split-Layout — schmale Liste (~360 px) + Detailbereich
**Mobile**: Vollbild-Wechsel — Liste → Detail

Filter: Status-Chips + Typ-Filter (BH / PKV / Alle)

`BeihilfeAntragDetail`: Inline-Bearbeitung im Header (kein separater Edit-Modus), Workflow-Stepper, Rechnungsliste, Bescheid-/Abrechnungsbereich.

`BeihilfeBescheidForm` / `BescheidKarte`: Jede Karte enthält `BescheidAnhangUpload` — nach OCR-Abschluss erscheint „Positionen vorschlagen". Der Vorschlag ruft `/vorschlag` auf, übernimmt Meta-Felder (Datum, AZ, Gesamtbetrag) und legt gematchte Positionen direkt an. Ungematchte erscheinen als `ocrOffene`-Liste zur manuellen Zuweisung.

**OCR-Matching-Logik** (`services/bescheid_ocr.rs`): Jede Textzeile mit ≥2 Euro-Beträgen wird als Position kandidiert. Matching per `betrag_cent ±5` gegen Rechnungen des Antrags. Bereits gematchte Rechnungen werden aus dem Pool ausgeschlossen (verhindert Doppel-Match bei gleichen Beträgen).

---

## Detail-Slider (RechnungDetailSlider)

Overlay von rechts. Kein separater Seitenaufruf.

**Tabs:** Details (Felder + Finanzzeile) | Anträge | Anhänge | Aktivität

- URL-State: `?rechnung=<id>`
- Schließen: Escape / Backdrop / Button
- Mobile: volle Bildschirmbreite

---

## Scan-Funktionalität

**ScanEditor**: Vollbild-Overlay, Canvas-basiert, Touch + Maus
- Zuschneiden (Rechteck-Handles, Sobel-Kantenerkennung zur Dokumenterkennung)
- Drehen (90°), weitere Seite (`MULTIPAGE_SCAN=true`)

**Bildverarbeitung** (`utils/imageToGrayscalePdf.ts`):
- `fileToGrayscalePdf(file)` → einseitiges PDF
- `canvasesToPdf(canvases[])` → mehrseitiges PDF

**Scan-Einstellungen** (localStorage): `scan_max_dim` (Default 3500), `scan_jpeg_quality` (Default 0.82)

---

## Wichtige Geschäftsregeln

1. Rechnungsstatus immer berechnet, nie gespeichert
2. Personen ohne Beihilfestelle: `beihilfe_status = NULL`
3. Massenaktionen: `bezahlt`, `beihilfe_eingereicht`, `pkv_eingereicht`, `archivieren`, `dearchivieren`
4. Archivierte Rechnungen: nicht im Dashboard, nicht in Standardtabelle
5. `referenz_nr`: `MAX(referenz_nr) + 1` pro Mandant
6. Löschen referenzierter Stammdaten → 409 Conflict
7. Benutzer können sich nicht selbst löschen
8. Anhänge/Belege: nur PDF (Magic-Bytes); Bilder werden im Frontend zu PDF konvertiert
9. `pkv_verzicht`: sichtbar als „zurückgestellt" in PKV-Einreichen-Kachel
10. Einstellungen über .env vorgebbar; DB-Werte überschreiben Env-Werte
11. Antrag `versendet`: setzt `beihilfe_eingereicht_am` (sofern NULL); Datum überschreibbar
12. Rechnung kann in mehreren Anträgen erscheinen (Widerspruchsfall)
13. Aktivitätslog: jede Änderung mit Diff persistent; `benutzer_id = NULL` für Systemaktionen
14. `beihilfe_erstattet_betrag`: NICHT manuell editierbar — nur durch `sync_beihilfe_erstattet()`
15. PKV-Antrag: `pkv_id` referenziert Stammdaten; `pkv_versicherer` ist Freitext-Fallback (Legacy)
16. Personen-Zuordnung bei BH/PKV schränkt hinzufügbare Rechnungen ein; leer = alle erlaubt

---

## UI-Prinzipien

- **Keine modalen Dialoge** für häufige Aktionen
- **Inline-Editing** ohne separaten Bearbeitungsmodus
- **Optimistic UI**: Änderungen sofort in der UI reflektieren
- **Mobile-First**: Breakpoint `sm` = 640px
- **Detail-Slider** statt Inline-Bearbeitung in Tabellen
- **Design-System**: Chalk (Light) / Carbon (Dark) via CSS Custom Properties; alle Farben über `var(--…)`, niemals Tailwind `gray`/`dark:` in Design-System-Komponenten
- **fullBleed-Seiten** (`/belege`, `/stammdaten`, `/dashboard`, `/aktivitaetslog`): `height: calc(100vh - 46px)`, kein Padding-Container
- **MobileTabBar-Muster** (fullBleed-Seiten): `className="sm:hidden"`, `overflowX: 'auto'`, `minWidth: 'max-content'`, `borderBottom: 2px solid primary/transparent` als Aktiv-Indikator; Sidebar: `className="hidden sm:flex"`
- **FilterGroup / FilterRow** (Sidebar-Muster aus Belege v4 Design): 9px Uppercase-Label, 8px Dot, 13px Label-Text, 11px Count-Badge mit `tabular-nums`

### Kern-CSS-Variablen

```
--bg, --surface, --surface-alt, --surface-hi
--border, --border-hi, --text, --text-muted, --text-subtle
--primary, --primary-dim, --primary-hover
--green, --amber, --blue, --purple, --rose, --teal  (je + -dim)
--row-hover, --row-active, --row-border
--overlay, --paper, --nav, --nav-border
```

### Animationen (index.css)

```css
@keyframes overlay-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes drawer-in   { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes tab-in      { from { opacity: 0; transform: translateX(8px) } to { opacity: 1; transform: translateX(0) } }
```

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
```

**Volumes:**
- `./data`: SQLite + optionale seed.json → Backup = Datei kopieren
- `uploads` (named): `/uploads/{rechnung_id}/{id}.pdf` und `/uploads/belege/{id}/`
- `./data/exports`: exportierte PDFs

---

*Letzte Aktualisierung: 2026-06-26 | Version: 2.6*
