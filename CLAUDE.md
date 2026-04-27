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
├── docker-compose.yml           ← Entwicklung: baut aus Quellcode
├── docker-compose.release.yml   ← Release: nutzt fertige Images
├── .env                         ← nicht committen; enthält JWT_SECRET
├── .env.example                 ← Vorlage für neue Installationen
├── release/
│   └── pkv-app-images.tar.gz    ← exportierte Docker-Images für Weitergabe
├── data/
│   ├── pkv.db                   ← SQLite-Datenbank (nicht committen)
│   ├── seed.json                ← Stammdaten-Import (nicht committen, enthält Passwörter)
│   └── seed.json.example        ← Vorlage ohne echte Daten
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_archiv.sql          ← archiviert_am zu rechnung
│   │   ├── 0003_referenz.sql        ← referenz_nr zu rechnung
│   │   ├── 0004_erstattet.sql       ← beihilfe_erstattet_betrag, pkv_erstattet_betrag
│   │   ├── 0005_gescannt.sql        ← gescannt-Flag (später umbenannt)
│   │   ├── 0006_gescannt_split.sql  ← gescannt → pkv_gescannt + beihilfe_gescannt
│   │   ├── 0007_anhaenge.sql        ← anhang-Tabelle (PDF-Uploads)
│   │   └── 0008_bre_schwelle.sql    ← bre_schwelle zu person
│   └── src/
│       ├── main.rs
│       ├── config.rs                ← Config inkl. MULTIPAGE_SCAN, UPLOADS_DIR
│       ├── errors.rs                ← AppError; FK-Verletzung → 409 Conflict
│       ├── auth/mod.rs              ← JWT erstellen/prüfen, AuthUser-Extractor
│       ├── db/mod.rs
│       ├── seed.rs                  ← bootstrap(): seed.json oder Env-Variablen
│       ├── models/
│       │   ├── mod.rs
│       │   ├── anhang.rs
│       │   ├── benutzer.rs
│       │   ├── beihilfestelle.rs
│       │   ├── correspondent.rs
│       │   ├── person.rs
│       │   └── rechnung.rs
│       ├── handlers/
│       │   ├── mod.rs
│       │   ├── anhaenge.rs          ← upload, list, serve, delete; max 20 MB; nur PDF
│       │   ├── auth.rs
│       │   ├── benutzer.rs
│       │   ├── beihilfestellen.rs
│       │   ├── config.rs            ← GET /api/config (öffentlich, kein JWT)
│       │   ├── personen.rs
│       │   ├── correspondents.rs
│       │   ├── rechnungen.rs
│       │   └── dashboard.rs
│       ├── services/
│       │   └── rechnungen.rs        ← mit_status(), kanban_gruppe()
│       └── repositories/
│           ├── mod.rs
│           ├── anhaenge.rs
│           ├── benutzer.rs
│           ├── beihilfestellen.rs
│           ├── personen.rs
│           ├── correspondents.rs
│           └── rechnungen.rs
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── api/
        │   ├── anhaenge.ts          ← getAnhaenge, uploadAnhang, deleteAnhang, fetchAnhangBlob
        │   ├── auth.ts
        │   ├── benutzer.ts
        │   ├── beihilfestellen.ts
        │   ├── client.ts
        │   ├── config.ts            ← getConfig(): AppConfig (gecacht); kein Auth-Token nötig
        │   ├── correspondents.ts
        │   ├── dashboard.ts
        │   ├── personen.ts
        │   └── rechnungen.ts        ← getRechnungen(personId?, archiviert?)
        ├── components/
        │   ├── AnhangUpload.tsx     ← PDF-Upload + Scan-Editor-Integration; compact-Prop
        │   ├── BulkActionBar.tsx    ← archivModus-Prop; mobile: verkürzte Labels
        │   ├── FinanzOverview.tsx
        │   ├── KanbanBoard.tsx      ← groupByPerson-Prop
        │   ├── KanbanFilter.tsx     ← useKanbanFilter(), filterKanban(); URL-State
        │   ├── Layout.tsx
        │   ├── PersonFilter.tsx
        │   ├── RechnungenTable.tsx  ← client-seitig sortierbar; mobile: Kartenansicht
        │   ├── RechnungForm.tsx
        │   ├── ScanEditor.tsx       ← Vollbild-Editor: Zuschneiden, Drehen, Mehrseiten
        │   └── StatusBadge.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useTheme.ts
        ├── pages/
        │   ├── DashboardPage.tsx    ← Kanban-Filter + Nach-Status/Nach-Person-Toggle
        │   ├── LoginPage.tsx
        │   ├── RechnungenPage.tsx   ← Aktiv/Archiv-Toggle
        │   └── StammdatenPage.tsx   ← Tabs: Personen, Leistungserbringer, Beihilfestellen, Benutzer
        ├── types/
        │   └── index.ts
        └── utils/
            └── imageToGrayscalePdf.ts  ← fileToGrayscalePdf(), canvasesToPdf()
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
   - `zahlung_status`: abgeleitet aus `bezahlt_am` (NULL = offen)
   - `beihilfe_status`: abgeleitet aus `beihilfe_eingereicht_am` (NULL wenn keine Beihilfestelle)
   - `pkv_status`: abgeleitet aus `pkv_eingereicht_am`
   - `archiviert_status`: abgeleitet aus `archiviert_am`
   - `beihilfe_anteil_erwartet` / `pkv_anteil_erwartet`: aus Betrag × Quoten der Person
   - `beihilfe_differenz` / `pkv_differenz`: Erstattung − Erwartung (nur wenn Erstattungsbetrag gesetzt)

---

## Stammdaten (Seed-Import)

`seed.rs` → `bootstrap()` wird beim Start aufgerufen:
- Wenn DB leer: importiert aus `SEED_FILE` (seed.json) **oder** aus Env-Variablen (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MANDANT_NAME`)
- Wenn DB bereits befüllt: kein Import (idempotent)

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

Quoten im MVP: Ein fixer Eintrag pro Person (kein Zeitverlauf). Beihilfestelle ist optional (nullable).

---

## Datenmodell

```sql
mandant (id, name)

benutzer (id, mandant_id, name, email, passwort_hash)

beihilfestelle (id, mandant_id, name, dienstherr_typ)
-- dienstherr_typ: 'bund' | 'land' | 'kommune'

person (id, mandant_id, name, geburtsdatum, typ, beihilfestelle_id, beihilfe_satz, pkv_satz, bre_schwelle)
-- typ: 'erwachsener' | 'kind'
-- beihilfestelle_id: NULLABLE
-- bre_schwelle: REAL, NULLABLE; Belastungsgrenze in Euro (Migration 0008)

correspondent (id, mandant_id, name, typ)
-- typ: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'

rechnung (
  id,
  mandant_id,
  person_id,
  leistungserbringer_id,        -- correspondent_id
  typ,                          -- 'arzt' | 'apotheke' | 'krankenhaus'
  betrag,                       -- INTEGER (Cent)
  datum,
  zahlungsziel,
  bezahlt_am,                   -- NULL = noch nicht bezahlt
  beihilfe_eingereicht_am,      -- NULL = noch nicht eingereicht
  pkv_eingereicht_am,           -- NULL = noch nicht eingereicht
  notiz,                        -- Freitext, optional
  archiviert_am,                -- NULL = aktiv; gesetzt = archiviert (Migration 0002)
  referenz_nr,                  -- INTEGER, fortlaufend pro Mandant, auto-generiert (Migration 0003)
  beihilfe_erstattet_betrag,    -- REAL, nullable (Migration 0004)
  pkv_erstattet_betrag,         -- REAL, nullable (Migration 0004)
  pkv_gescannt,                 -- INTEGER NOT NULL DEFAULT 0 (Migration 0005/0006)
  beihilfe_gescannt             -- INTEGER NOT NULL DEFAULT 0 (Migration 0006)
)

anhang (id, mandant_id, rechnung_id, dateiname, pfad, groesse, erstellt_am)
-- Datei liegt unter UPLOADS_DIR/{rechnung_id}/{id}.pdf (Migration 0007)

-- Status wird BERECHNET (nicht gespeichert):
-- zahlung_status:           'offen' | 'bezahlt'             ← aus bezahlt_am
-- beihilfe_status:          'offen' | 'eingereicht' | NULL  ← aus beihilfe_eingereicht_am
-- pkv_status:               'offen' | 'eingereicht'         ← aus pkv_eingereicht_am
-- archiviert_status:        'aktiv' | 'archiviert'          ← aus archiviert_am
-- beihilfe_anteil_erwartet: betrag * beihilfe_satz / 100    ← NULL wenn keine Beihilfestelle
-- pkv_anteil_erwartet:      betrag * pkv_satz / 100
-- beihilfe_differenz:       beihilfe_erstattet_betrag − beihilfe_anteil_erwartet
-- pkv_differenz:            pkv_erstattet_betrag − pkv_anteil_erwartet
```

---

## API-Routen

```
GET    /api/config                              ← öffentlich (kein JWT); gibt { multipage_scan: bool }

POST   /api/auth/login

GET    /api/benutzer
POST   /api/benutzer
PATCH  /api/benutzer/:id
POST   /api/benutzer/:id/passwort              ← altes_passwort + neues_passwort
DELETE /api/benutzer/:id                       ← eigener Account nicht löschbar

GET    /api/beihilfestellen
POST   /api/beihilfestellen
PATCH  /api/beihilfestellen/:id
DELETE /api/beihilfestellen/:id

GET    /api/personen
POST   /api/personen
PATCH  /api/personen/:id
DELETE /api/personen/:id

GET    /api/correspondents
POST   /api/correspondents
PATCH  /api/correspondents/:id
DELETE /api/correspondents/:id

GET    /api/rechnungen?person_id=&archiviert=  ← archiviert=true liefert nur archivierte
POST   /api/rechnungen
POST   /api/rechnungen/bulk                    ← BulkActionRequest
PATCH  /api/rechnungen/:id
DELETE /api/rechnungen/:id

GET    /api/rechnungen/:id/anhaenge            ← Liste der Anhänge
POST   /api/rechnungen/:id/anhaenge            ← PDF-Upload (multipart, max 20 MB)
GET    /api/rechnungen/:id/anhaenge/:aid       ← PDF ausliefern (inline)
DELETE /api/rechnungen/:id/anhaenge/:aid

GET    /api/dashboard
```

---

## Scan-Funktionalität

### Ablauf

1. Nutzer tippt **"Scannen"** → Kamera öffnet sich (oder **"PDF"** → Datei-Picker)
2. Foto aufgenommen → **ScanEditor**-Overlay erscheint
3. Im ScanEditor:
   - **Zuschneiden**: Rechteck-Handles (4 Ecken + Verschieben) per Pointer-Events
   - **Automatische Dokumenterkennung**: Sobel-Kantenerkennung auf herunterskaliertem Bild erkennt weißes Papier auf dunklem Hintergrund → Rahmen wird automatisch gesetzt
   - **Drehen**: Links / Rechts (je 90°)
   - **Weitere Seite** (nur wenn `MULTIPAGE_SCAN=true`): schließt Editor, öffnet Kamera erneut
4. **"Hochladen"** / **"Fertig"**: alle Seiten werden zu einer mehrseitigen PDF konvertiert (Graustufen, JPEG-komprimiert) und hochgeladen

### Bildverarbeitung (Frontend, `utils/imageToGrayscalePdf.ts`)

- `fileToGrayscalePdf(file)` — Bilddatei → einseitiges Graustufen-PDF; PDFs werden unverändert durchgereicht
- `canvasesToPdf(canvases[])` — Canvas-Array → mehrseitiges Graustufen-PDF (max. 2000 px pro Seite, JPEG 0.72)

### ScanEditor (`components/ScanEditor.tsx`)

- Vollbild-Overlay (`fixed inset-0 z-50`)
- Canvas-basiert: Bild + Crop-Overlay auf einem `<canvas>`; Pointer-Events für Touch & Maus
- Dokumenterkennung: Sobel auf 400 px breitem Thumbnail → Zeilen-/Spaltensummen → Bounding Box
- Fallback wenn keine klare Grenze erkannt: 12 % Einzug (gut greifbare Handles)
- Props: `file`, `multipageEnabled`, `pageCount`, `onConfirm(canvas, addMore)`, `onCancel`

---

## Wichtige Geschäftsregeln

1. Rechnungsstatus ergibt sich immer aus den Feldern, nie direkt gespeichert
2. Personen ohne Beihilfestelle haben keinen `beihilfe_status` (NULL)
3. Massenaktionen: `bezahlt`, `beihilfe_eingereicht`, `pkv_eingereicht`, `archivieren`, `dearchivieren`
4. Archivierte Rechnungen erscheinen nicht im Dashboard/Kanban und nicht in der Standard-Tabellenansicht
5. `referenz_nr` wird beim Erstellen automatisch vergeben: `MAX(referenz_nr) + 1` pro Mandant
6. Löschen von referenzierten Stammdaten (Person, Correspondent, Beihilfestelle) → 409 Conflict
7. Benutzer können sich nicht selbst löschen
8. Anhänge: nur PDF-Upload erlaubt (Magic-Bytes-Prüfung im Backend); Bilder werden im Frontend vor dem Upload zu PDF konvertiert

---

## UI-Prinzipien

- **Keine modalen Dialoge** für häufige Aktionen
- Rechnungen in einer **sortierbaren Tabelle** (alle Spalten klickbar)
- **Aktiv/Archiv-Toggle** in der Tabellenansicht
- **Massenaktionen** via BulkActionBar (fixiert am unteren Bildschirmrand bei Selektion)
- **Kanban-Filter** (immer sichtbar, kein Modal): Person, Typ, Korrespondent, Zeitraum; URL-State
- **Kanban-Gruppierung**: umschaltbar zwischen "Nach Status" und "Nach Person"
- Stammdaten über Tab-Interface (Personen / Leistungserbringer / Beihilfestellen / Benutzer)
- Fehlermeldungen bei fehlgeschlagenen Löschoperationen inline als rotes Banner
- **Mobile-First**: alle Seiten für Smartphone optimiert (Breakpoint `sm` = 640px)

### Mobile-Responsive-Muster

| Komponente | Mobile | Desktop (sm+) |
|---|---|---|
| `RechnungenTable` | Kartenansicht (`sm:hidden`) mit Inline-Bearbeitungsformular | Tabelle (`hidden sm:block`) |
| `StammdatenPage` alle Tabs | Kartenansicht (`sm:hidden`) mit Inline-Bearbeitungsformular | Tabelle (`hidden sm:block`) |
| `RechnungForm` | 1-spaltig (`grid-cols-1`) | 2–4-spaltig |
| `BulkActionBar` | Kurze Labels (Bezahlt / Beihilfe / PKV) | Lange Labels |
| `KanbanFilter` | Größere Touch-Targets, Dropdowns `w-[min(95vw,13rem)]` | Normal |
| `StammdatenPage` Tabs | Horizontal scrollbar (`overflow-x-auto`) | Normal |
| `ScanEditor` | Vollbild, Touch-optimierte Handles (32 px Tap-Radius) | Vollbild (selten genutzt) |

---

## Dashboard / Übersicht

**Kanban-Board** — Rechnungen nach Workflow-Status gruppiert:
- `Neu` – erfasst, noch nichts eingereicht
- `Bezahlt` – bezahlt, aber noch offen bei Beihilfe/PKV
- `Beihilfe eingereicht` – wartet auf Bescheid
- `PKV eingereicht` – wartet auf Erstattung
- `Abgeschlossen` – bezahlt + beihilfe eingereicht + PKV eingereicht

Filter (URL-State via `useSearchParams`): Person (Multi), Typ (Multi), Korrespondent (Multi + Suche), Zeitraum (Von/Bis + Schnellauswahl).

**Finanzübersicht** — aggregierte Beträge nach Zahlungs- und Einreichungsstatus.

---

## Deployment

**Entwicklung** (baut aus Quellcode):
```bash
docker compose up --build
```

**Release** (fertige Images, für Weitergabe):
```bash
docker compose -f docker-compose.release.yml up -d
```

Konfiguration über `.env` (Vorlage: `.env.example`):
```
JWT_SECRET=<zufälliger 32+ Zeichen langer String>
PORT=3000            # Backend-Port
UI_PORT=8090         # Frontend-Port
MULTIPAGE_SCAN=true  # Mehrseitiger Scan ein- (true) oder ausschalten (false)
PAPERLESS_NGX_URL=   # Optional: Paperless NGX URL (z.B. http://paperless:8000)
PAPERLESS_NGX_TOKEN= # Optional: Paperless NGX API-Token
```

**Volumes:**
- `./data` (Bind-Mount): SQLite-Datenbank (`pkv.db`) und `seed.json` → Backup = Datei kopieren
- `uploads` (named Volume): Hochgeladene PDFs unter `/uploads/{rechnung_id}/{file_id}.pdf`; per `UPLOADS_DIR=/uploads` konfiguriert

Images für Weitergabe exportieren:
```bash
docker build -t pkv-app-backend:latest ./backend
docker build -t pkv-app-frontend:latest ./frontend
docker save pkv-app-backend:latest pkv-app-frontend:latest | gzip > release/pkv-app-images.tar.gz
```

- Läuft lokal (Docker Desktop), nur Heimnetz
- Alle Daten in `data/pkv.db` — Backup = Datei kopieren

---

*Letzte Aktualisierung: 2026-04-13 | Version: 1.4*
