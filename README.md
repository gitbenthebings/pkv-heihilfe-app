# PKV-Abrechnung

Self-hosted App zur Verwaltung von PKV- und Beihilfe-Abrechnungen für Familien mit Beamtenstatus.

## Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (enthält Docker Compose)

## Installation

**1. Repository klonen**

```bash
git clone <repo-url>
cd pkv-abrechnung
```

**2. Stammdaten vorbereiten**

```bash
cp seed.example.json seed.json
```

`seed.json` mit den eigenen Daten befüllen:

| Feld | Beschreibung |
|---|---|
| `mandant.name` | Name der Familie, z. B. `"Familie Müller"` |
| `benutzer` | Login-Zugänge (E-Mail + Passwort) |
| `beihilfestellen` | Zuständige Beihilfestellen |
| `personen` | Familienmitglieder mit Beihilfe- und PKV-Satz |
| `correspondents` | Ärzte, Apotheken, Krankenhäuser |

> Die Stammdaten werden nur beim **ersten Start** importiert, solange die Datenbank leer ist.
> Danach können sie über die Web-UI gepflegt werden.

**3. JWT-Secret setzen**

`docker-compose.yml` öffnen und den Platzhalter ersetzen:

```yaml
JWT_SECRET: ${JWT_SECRET:-changeme-bitte-aendern}   # ← diesen Wert ändern
```

Einen zufälligen Schlüssel erzeugen (Linux/macOS):

```bash
openssl rand -hex 32
```

Alternativ eine `.env`-Datei anlegen:

```bash
cp .env.example .env
# JWT_SECRET in .env eintragen
```

**4. App starten**

```bash
docker compose up -d
```

**5. Browser öffnen**

```
http://localhost:8090
```

Login mit den in `seed.json` definierten Zugangsdaten.

---

## Betrieb

```bash
docker compose up -d        # starten
docker compose down         # stoppen
docker compose restart      # neu starten
docker compose logs -f      # Logs anzeigen
```

**Port ändern** – in `.env` oder direkt in `docker-compose.yml`:

```
UI_PORT=8080    # Frontend (Standard: 8090)
PORT=3000       # Backend  (Standard: 3000)
```

---

## Datensicherung

Alle Daten liegen in einer einzigen Datei:

```
data/pkv.db
```

Backup erstellen:

```bash
docker compose down
cp data/pkv.db data/pkv.db.backup
docker compose up -d
```

---

## Funktionsübersicht

- **Rechnungserfassung** – Arzt, Apotheke, Krankenhaus; mit Betrag, Datum, Notiz und automatischer Referenznummer
- **Statusverfolgung** – Zahlung, Beihilfe-Einreichung, PKV-Einreichung jeweils unabhängig
- **Massenaktionen** – mehrere Rechnungen gleichzeitig als bezahlt / eingereicht markieren oder archivieren
- **Dashboard / Kanban** – Rechnungen nach Workflow-Status; filterbar nach Person, Typ, Korrespondent und Zeitraum
- **Finanzübersicht** – aggregierte Beträge nach Zahlungs- und Einreichungsstatus; reagiert auf aktive Filter
- **BRE-Unterstützung** – Anzeige des PKV-Selbstbehalt-Spielraums pro Person
- **Stammdaten** – Personen, Leistungserbringer, Beihilfestellen und Benutzer über die Web-UI verwalten

---

## Technischer Stack

| Schicht | Technologie |
|---|---|
| Backend | Rust + Axum |
| Datenbank | SQLite |
| Frontend | React + TypeScript + Tailwind CSS |
| Container | Docker + Docker Compose |
