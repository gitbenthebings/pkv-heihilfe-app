# Backlog

Geordnet nach Priorität innerhalb jeder Kategorie. Status: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt.

---

## Kategorie A — Bugfixes & Korrekturen

### A1 · BRE-Jahresfilter
**Status:** `[x]`

`berechneFinanzKennzahlen()` akkumuliert PKV-Beträge jahresübergreifend, die BRE (Belastungsgrenze) resettet aber jährlich zum 1.1. Nach mehr als einem Jahr Nutzung zeigt die Empfehlung dauerhaft `bereits_ueberschritten`, unabhängig vom laufenden Jahr.

**Fix:** In `finanzStatus.ts` PKV-Beträge für BRE-Berechnung auf das aktuelle Kalenderjahr (nach `datum` der Rechnung) beschränken. Evtl. konfigurierbares Bezugsjahr als Parameter.

**Betroffene Dateien:**
- `frontend/src/utils/finanzStatus.ts` — Filterlogik ergänzen
- `frontend/src/components/AufgabenFinanzStatus.tsx` — ggf. Jahreshinweis anzeigen

---

## Kategorie B — UX-Verbesserungen (geringer Aufwand)

### B1 · Zahlungsziel-Warnung im Dashboard
**Status:** `[x]`

`zahlungsziel` ist im Datenmodell vorhanden, wird aber im Dashboard nicht ausgewertet. Rechnungen im Bucket `zu_bezahlen` sollten visuell differenziert werden:
- **Überfällig** (`zahlungsziel < heute`) → rot hervorheben
- **Fällig bald** (z. B. `zahlungsziel ≤ heute + 7 Tage`) → gelb/orange

**Betroffene Dateien:**
- `frontend/src/utils/aufgabenBuckets.ts` — Hilfsfunktion `getZahlungszielStatus(r)`
- `frontend/src/components/AufgabenDashboard.tsx` — Badge/Farbindikator pro Karte

### B2 · Eigenanteil-Anzeige
**Status:** `[x]`

Die tatsächliche Eigenbeteiligung (`betrag − beihilfe_tatsächlich − pkv_tatsächlich`) ist die für den Nutzer wichtigste Zahl, wird aber nirgendwo berechnet oder angezeigt.

Anzuzeigen in:
- `RechnungDetailSlider` Tab Details → Finanzzeile um Spalte „Eigenanteil" erweitern
- `BeihilfeAntragDetail` → Summenzeile der Rechnungstabelle
- `AufgabenFinanzStatus` → aggregierter Eigenanteil über alle aktiven Rechnungen

**Betroffene Dateien:**
- `frontend/src/utils/finanzStatus.ts` — `eigenanteil` zu `FinanzKennzahlen` hinzufügen
- `frontend/src/components/AufgabenFinanzStatus.tsx`
- `frontend/src/components/RechnungDetailSlider.tsx`
- `frontend/src/components/BeihilfeAntragDetail.tsx`

### B3 · Rechnungskopie / „Ähnliche Rechnung anlegen"
**Status:** `[x]`

Für Dauermedikamente (monatlich gleiche Apotheke, ähnlicher Betrag) fehlt eine Kopier-Funktion. Im Detail-Slider ein „Kopieren"-Button, der eine neue Rechnung mit vorausgefüllten Feldern öffnet (Person, Leistungserbringer, Typ, Betrag — Datum leer oder auf heute gesetzt).

**Betroffene Dateien:**
- `frontend/src/components/RechnungDetailSlider.tsx` — Button hinzufügen
- `frontend/src/components/RechnungForm.tsx` — `initialValues`-Prop ergänzen

---

## Kategorie C — Neue Features (mittlerer Aufwand)

### C1 · Jahresfilter (global)
**Status:** `[x]`

Alle Ansichten (Rechnungsliste, Dashboard, Aktivitätslog) zeigen alle Jahre gemischt. Ein persistenter Jahres-Selector im Layout (Default: laufendes Jahr) würde den täglichen Workflow erheblich verbessern und wäre Voraussetzung für C2.

**Betroffene Dateien:**
- `frontend/src/components/Layout.tsx` — Jahres-Selector global im Header
- `frontend/src/pages/RechnungenPage.tsx` — Filterparameter durchreichen
- `frontend/src/pages/DashboardPage.tsx` — Rechnungen nach Jahr filtern
- `backend/src/repositories/rechnungen.rs` — optionaler `jahr`-Parameter in Queries

### C2 · Jahresauswertung / Steuerexport
**Status:** `[x]`  
*Abhängigkeit: C1 (Jahresfilter)*

Für die Steuererklärung (außergewöhnliche Belastungen) und den persönlichen Jahresabschluss wird eine strukturierte Auswertung benötigt:

- Gesamtkosten pro Jahr, aufgeschlüsselt nach Person und Typ (Arzt / Apotheke / Krankenhaus)
- Beihilfe-Erstattung erwartet vs. tatsächlich
- PKV-Erstattung erwartet vs. tatsächlich
- **Eigenanteil gesamt** (steuerrelevant)
- Export als CSV (für Excel/Steuerberater)

**Neue Seite:** `frontend/src/pages/AuswertungPage.tsx`  
**Neuer Endpunkt:** `GET /api/auswertung?jahr=2026` (optional; kann auch rein im Frontend berechnet werden)

### C3 · Volltext-Suche
**Status:** `[x]`

Ein globaler Suchschlitz (Referenznummer, Leistungserbringer, Notiz, Betrag) fehlt komplett. Wird mit wachsender Datenmenge zunehmend schmerzhaft.

- Suche über Rechnungen, Anträge, Aktivitätslog
- Ergebnisse mit Kontextvorschau
- Keyboard-Shortcut (z. B. `/` oder `Ctrl+K`)

**Betroffene Dateien:**
- `backend/src/handlers/rechnungen.rs` — `?q=`-Parameter in GET /api/rechnungen
- `backend/src/repositories/rechnungen.rs` — SQLite FTS5 oder LIKE-Suche
- `frontend/src/components/Layout.tsx` — Suchfeld im Header

---

## Kategorie D — Neue Features (größerer Aufwand)

### D1 · PKV-Abrechnung strukturiert erfassen
**Status:** `[~]` *Ersetzt durch H2 — dort vollständig neu konzipiert.*

### D2 · Bescheid-Positionen aus PDF vorschlagen (Tesseract + Regex)
**Status:** `[ ]`

Beihilfebescheide sind Behördendokumente mit festem Tabellenaufbau und liegen immer als PDF vor (`bescheid_anhang`). Das macht sie zum idealen OCR-Ziel: einheitliches Format, zuverlässig parsebar, und das manuelle Eintippen der Positionen in `BeihilfeBescheidForm` ist der mühsamste Schritt im gesamten Workflow.

Tesseract läuft bereits für Belege. `bescheid_anhang` bekommt dieselbe Pipeline.

**Zu erkennende Struktur (Positionstabelle im Bescheid):**

Typische Spaltenfolge in deutschen Beihilfebescheiden:
```
Datum | Leistungserbringer | Rechnungsbetrag | anerkannt | abgelehnt | Ablehnungsgrund
```
Jede Zeile entspricht einer `beihilfe_bescheid_position`. Die Spaltenwerte werden per Regex aus dem OCR-Text extrahiert.

**Matching Bescheid-Position → Rechnung:**

Jede Position enthält Datum und Betrag der Originalrechnung. Abgleich gegen vorhandene `rechnung`-Datensätze des Antrags: `datum` + `betrag` (Cent-Rundung tolerieren) → `rechnung_id` vorschlagen. Kein Match → Position ohne `rechnung_id`, Nutzer weist manuell zu.

**Weitere extrahierbare Felder:**
- `erstattungsbetrag_gesamt` (Kontrollsumme) — steht meist als „Gesamtbetrag" oder „zu erstattender Betrag" im Bescheid
- `bescheid_datum` — Datum im Briefkopf
- `aktenzeichen` — Muster wie `Az.: …` oder `Geschäftszeichen: …`

**Flow:**
1. `bescheid_anhang`-Upload → OCR läuft async (neue Migration + Tesseract-Call analog `belege.rs`)
2. Button „Positionen vorschlagen" in `BeihilfeBescheidForm` (nur sichtbar wenn Anhang mit `ocr_status = 'done'`)
3. `GET /api/beihilfe-antraege/:id/bescheide/:bid/anhaenge/:aid/vorschlag` →
   ```json
   {
     "bescheid_datum": "2026-03-15",
     "aktenzeichen": "BH-2026-00123",
     "erstattungsbetrag_gesamt": 38450,
     "positionen": [
       { "rechnung_id": "abc", "tatsaechliche_kosten": 12000, "anerkannt_betrag": 7560, "abgelehnt_betrag": 4440, "ablehnungsgrund": null }
     ]
   }
   ```
4. Frontend füllt Kopffelder und Positionstabelle vor; Nutzer prüft und korrigiert, dann speichert

**Verhalten bei Teilfehlern:** Nicht erkannte Felder werden weggelassen (nie `null` erzwingen). Endpunkt gibt immer 200 zurück. Kein Downside wenn Erkennung fehlschlägt.

**Betroffene Bereiche:**
- `backend/migrations/` — `ocr_text`, `ocr_status` auf `bescheid_anhang`
- `backend/src/handlers/beihilfe_bescheide.rs` — OCR-Call nach Anhang-Upload; neuer GET-Endpunkt `vorschlag`
- `backend/src/services/bescheid_ocr.rs` — Regex-Parsing der Positionstabelle + Rechnung-Matching
- `frontend/src/components/BeihilfeBescheidForm.tsx` — Button „Positionen vorschlagen"; Vorschläge in Tabelle eintragen
- `frontend/src/api/beihilfe_bescheide.ts` — neuer Call für `/vorschlag`

**Erweiterung (nachgelagert, optional):**
Rechnungsanhänge (`anhang`) mit derselben Pipeline: Betrag, Datum, Leistungserbringer per Regex vorschlagen. Sinnvoll für häufige Stamm-Leistungserbringer, aber wegen der Formatvielfalt unzuverlässiger als Bescheide.

---

## Kategorie E — Erinnerungen / Automatisierung

### E1 · Wiedervorlage / Follow-up-Datum
**Status:** `[ ]`

Einfaches Erinnerungssystem: Pro Rechnung oder Antrag ein optionales Follow-up-Datum setzen. Rechnungen mit überschrittenem Follow-up-Datum erscheinen in einem eigenen Dashboard-Bucket oder werden markiert.

**Datenmodell:** `wiedervorlage_am TEXT NULLABLE` auf `rechnung` und/oder `beihilfe_antrag`  
**Migration:** `0018_wiedervorlage.sql` (oder `0019_...` je nach D1)

---

---

## Kategorie F — Rechnungstabelle (2026-05-19)

### F1 · Suchfeld
**Status:** `[x]` Text-Filter über Leistungserbringer, Person, Referenz, Notiz. Zähler zeigt gefilterte/Gesamt.

### F2 · Summenzeile
**Status:** `[x]` tfoot-Zeile mit Betrag-Summe + BH erwartet/tatsächlich + PKV erwartet/tatsächlich.

### F3 · Inline-Editing entfernt
**Status:** `[x]` Slider ist der einzige Bearbeitungspfad (CLAUDE.md-Prinzip). Komponente um ~200 Zeilen schlanker.

### F4 · Zahlungsziel-Indikator
**Status:** `[x]` In der DATUM-Spalte: ⚠ Überfällig (rot) oder Fällig DD.MM. (gelb) wenn ≤ 7 Tage.

### F5 · Spaltenauswahl
**Status:** `[x]` Zahnrad-Icon → Checkboxen für TYP, NOTIZ, PAPERLESS. Zustand in localStorage persistent.

### F6 · beihilfe_erstattet_betrag read-only
**Status:** `[x]` War in der Tabelle editierbar; entfällt mit Inline-Editing-Entfernung.

### F7 · Tastatursteuerung
**Status:** `[x]` ↑↓ navigieren, Enter öffnen, Leertaste auswählen, Esc zurücksetzen. Hint-Zeile eingeblendet wenn Tabelle fokussiert. Suche → ↓ springt in erste Zeile.

---

## Kategorie G — Anträge-Usability (2026-05-19)

### G1 · Status-Filter als Chips
**Status:** `[x]` Dropdown ersetzt durch klickbare Chips (Alle / Entwurf / Versendet / In Bearbeitung / Beschieden / Archiviert). Schnelleres Umschalten ohne Dropdown-Klapp-Geste.

### G2 · „Kein Bescheid"-Indikator
**Status:** `[x]` In der Rechnungsliste eines Antrags: graues Badge „kein Bescheid" wenn eine Rechnung in keiner Bescheid-Position auftaucht (sobald mindestens ein Bescheid existiert). Zeigt sofort welche Rechnungen noch offen sind.

### G3 · Bescheid-Validierung positiv bestätigen
**Status:** `[x]` Wenn Positions-Summe = Gesamtbetrag: grüner Hintergrund + ✓-Text. War schon als rote Abweichung implementiert; grünes Positiv-Feedback ergänzt.

### G4 · Rechnungsreferenz im Bescheid klickbar
**Status:** `[x]` Referenznummer in der Positions-Tabelle öffnet den Detail-Slider der Rechnung. Gleiches gilt für Referenzen in der Rechnungsliste des Antrags. Slider wird direkt auf der Antragseite angezeigt (kein Seitenwechsel).

### G5 · Fortschrittsanzeige in der Antragskarte
**Status:** `[x]`

In der Antragsliste (AntragCard) aktuell nur Rechnungsbetrag-Summe. Zusätzlich: „erwartet BH / tatsächlich BH" als kompakte Zahlenzeile oder Mini-Fortschrittsbalken, damit auf einen Blick erkennbar ist ob ein Antrag vollständig beschieden ist.

**Betroffene Dateien:**
- `frontend/src/components/BeihilfeAntraege.tsx` — AntragCard um BH-Fortschritt erweitern

### G6 · Tastaturnavigation in der Antragsliste
**Status:** `[x]`

↑/↓ navigieren, Enter öffnet Detail. Analog zur Rechnungstabelle (F7). Sinnvoll für Desktop-Workflow wenn viele Anträge vorliegen.

**Betroffene Dateien:**
- `frontend/src/components/BeihilfeAntraege.tsx` — Keyboard-Handler + focusedIdx
- `frontend/src/pages/BeihilfeAntraegePage.tsx` — onSelect per Enter triggern

### G7 · „Bereits in Antrag X"-Warnung im Rechnungs-Dropdown
**Status:** `[x]`

Beim Hinzufügen einer Rechnung zum Antrag: Rechnungen die bereits in einem anderen aktiven Antrag stecken, mit Hinweis versehen statt sie zu verstecken. Nutzer entscheidet dann bewusst (Widerspruchsfall).

**Betroffene Dateien:**
- `frontend/src/components/BeihilfeAntragDetail.tsx` — Dropdown-Optionen mit Antrag-Info anreichern

### G8 · Bulk-Aktion „Zu Antrag hinzufügen"
**Status:** `[x]`

In der Rechnungstabelle mehrere Rechnungen selektieren und direkt einem Antrag zuweisen. Aktueller Flow (Antrag öffnen → Dropdown → eine nach der anderen) ist bei vielen Rechnungen mühsam.

**Betroffene Dateien:**
- `frontend/src/components/BulkActionBar.tsx` — neue Aktion
- `frontend/src/pages/RechnungenPage.tsx` — Antrag-Auswahl-Dialog
- Backend: ggf. neuer Bulk-Endpunkt oder mehrfaches POST

### G9 · Deep-Link aus Rechnung → Antrag
**Status:** `[x]`

Im RechnungDetailSlider, Tab „Anträge": Klick auf Antrag-Link soll den Antrag direkt vorselektieren (URL-State `?antrag=ID`), aktuell navigiert der Link nur zur Antragseite ohne Selektion.

**Betroffene Dateien:**
- `frontend/src/components/RechnungDetailSlider.tsx` — Link mit `?antrag=ID` ergänzen

---

## Kategorie H — Datenhaltung / Architektur

### H1 · Zeitliche Dimension für Beihilfe- und PKV-Sätze
**Status:** `[x]`

#### Problem

`person.beihilfe_satz` und `person.pkv_satz` sind Einzelwerte ohne Gültigkeitsdatum. Ändern sich die Sätze (z. B. Statuswechsel, neues Kind, Pensionierung), werden rückwirkend alle Rechnungen mit dem neuen Satz neu berechnet — die Prognosewerte `beihilfe_anteil_erwartet` und `pkv_anteil_erwartet` stimmen dann für ältere Rechnungen nicht mehr. Das betrifft Rechnungstabelle, Dashboard und die Prognose in Antrag-Detailansichten.

#### Designentscheidungen

**Neues Schema (eine Migration):**
```sql
person_satz_historie (
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  beihilfe_satz INTEGER NOT NULL,   -- Prozent 0–100
  pkv_satz      INTEGER NOT NULL,
  gueltig_ab   TEXT NOT NULL,       -- ISO-Date; kein gueltig_bis (implizit bis nächstem Eintrag)
  erstellt_am  TEXT NOT NULL
)
```
Kein `gueltig_bis` — Gültigkeit endet implizit am Tag vor dem nächsten Eintrag. Der aktuell gültige Satz = Eintrag mit dem größten `gueltig_ab ≤ heute`.

**Bestehende Felder bleiben:** `person.beihilfe_satz` / `pkv_satz` bleiben als „derzeit aktiver Satz" (= immer der jüngste Historieneintrag). Wird ein neuer Eintrag angelegt, werden diese Felder mitgepflegt. Dadurch bleibt die bestehende API für Stammdaten-Anzeige und neue Rechnungserfassung unverändert.

**Datenmigration:** Die Migration legt für jede Person einen initialen Historieneintrag mit `gueltig_ab = '1900-01-01'` an (aus den aktuellen `beihilfe_satz`/`pkv_satz`-Werten). Alle Rechnungen erhalten damit automatisch die richtigen historischen Sätze.

**Rate-Lookup pro Rechnung:** In `services/rechnungen.rs::mit_status()` wird bisher `person.beihilfe_satz` direkt verwendet. Neu: die Funktion bekommt `beihilfe_satz` und `pkv_satz` als Parameter (konkrete Werte für das Datum der Rechnung). Der `list`-Handler lädt einmalig die gesamte Satz-Historie aller relevanten Personen (ein SQL-Statement, kein N+1), sucht dann pro Rechnung in-memory den passenden Eintrag.

**Randfälle:**
- Rechnung vor dem ältesten Historieneintrag → frühester Eintrag wird verwendet
- Retrospektive Satzänderung: `beihilfe_anteil_erwartet` (Prognose) ändert sich, `beihilfe_erstattet_betrag` (aus Bescheid) bleibt unberührt — gewünschtes Verhalten
- `bre_schwelle` auf `person`: Braucht vorerst keine eigene Zeitdimension (seltener geändert, kein Berechnungseinfluss auf Erstattungsbeträge)

#### Betroffene Bereiche

**Backend:**
- `backend/migrations/0020_person_satz_historie.sql` — neue Tabelle + Datenmigration
- `backend/src/models/person.rs` — neues Struct `PersonSatzHistorie`
- `backend/src/repositories/personen_satz_historie.rs` — list, create, delete
- `backend/src/handlers/personen.rs` — neue Routen `GET/POST/DELETE /api/personen/:id/satz-historie`
- `backend/src/main.rs` — Routen registrieren
- `backend/src/services/rechnungen.rs` — `mit_status()` erhält `beihilfe_satz`/`pkv_satz` als Parameter
- `backend/src/handlers/rechnungen.rs` — vor Rechnung-List/Get die Satz-Historie laden; passenden Satz pro Rechnung ermitteln

**Frontend:**
- `frontend/src/pages/StammdatenPage.tsx` — Personen-Abschnitt um Satz-Historie erweitern: Liste der Einträge (gueltig_ab, BH-%, PKV-%) + „+ Neuer Satz ab …"-Form
- `frontend/src/api/personen.ts` — neue Hilfsfunktionen für Satz-Historie
- `frontend/src/types/index.ts` — neues Interface `PersonSatzHistorie`
- `frontend/src/components/BeihilfeBescheidForm.tsx` — Prä-Population von `anerkannt_betrag` verwendet bereits `person.beihilfe_satz` (= aktueller Satz); für historische Rechnungen sollte sie idealerweise `rechnung.beihilfe_anteil_erwartet` aus der API nutzen (das ist nach der Backend-Änderung bereits korrekt)

#### Aufwandsschätzung

| Bereich | Aufwand |
|---|---|
| Migration + Datenmigration + Rust-Modell | ~1h |
| Repository + Handler (personen_satz_historie) | ~2h |
| `mit_status()` + List-Handler anpassen | ~2h |
| Frontend Stammdaten (History-UI) | ~3h |
| Frontend BeihilfeBescheidForm (Prä-Population aus API) | ~0.5h |
| **Gesamt** | **~8–9h** |

**Kategorie D** (größerer Aufwand, aber klarer Scope). Kein Breaking Change an bestehenden API-Endpunkten. Empfehlung: zusammen mit C1 (Jahresfilter) angehen, da beide dasselbe Datenumfeld betreffen.

### H2 · PKV-Anträge in der bestehenden Antragsseite
**Status:** `[x]`  
*Ersetzt D1. Abhängigkeit: keines, aber H1 (Satz-Historie) wäre ein sinnvoller Vorgänger.*

#### Idee

Die bestehende Antragsseite (`BeihilfeAntraegePage`) soll PKV-Einreichungen als gleichrangige Antragsart aufnehmen. Kein separater Bereich, kein neuer Nav-Eintrag — Beihilfe- und PKV-Anträge erscheinen in derselben Liste und teilen denselben Workflow. In der Listenansicht zeigt jeder Eintrag ein farbiges Typ-Badge (BH / PKV), sodass beide auf einen Blick unterscheidbar sind.

#### Warum diese Architektur und nicht eine separate Tabelle?

Eine zweite `pkv_antrag`-Tabelle wäre maximale Code-Duplikation: gleiche Status-Machine, gleicher Bescheid-Mechanismus, gleiche UI-Komponenten. Stattdessen erhält `beihilfe_antrag` eine `typ`-Spalte (`'beihilfe' | 'pkv'`). Alle bestehenden Tabellen (`beihilfe_bescheid`, `beihilfe_bescheid_position`, `beihilfe_antrag_rechnung`) bleiben unverändert — sie sind antrag-agnostisch und funktionieren für beide Typen ohne Schema-Änderung.

#### Designentscheidungen

**Empfänger bei PKV:**  
Bei Beihilfe ist der Empfänger eine `beihilfestelle` (Stammdaten). Bei PKV gibt es üblicherweise eine einzige Versicherung pro Familie — kein Bedarf für eine eigene Stammdaten-Tabelle. Lösung: freies Textfeld `pkv_versicherer TEXT` auf `beihilfe_antrag`. Langfristig könnte man Versicherungen wie Beihilfestellen als Stammdaten führen, aber das lohnt für den MVP nicht.

**Statusübergänge:**  
Identisch für beide Typen. Einzige Verzweigung in `services/beihilfe_antraege.rs`:
- `typ = 'beihilfe'` → Status "versendet" setzt `beihilfe_eingereicht_am` auf Rechnungen
- `typ = 'pkv'` → Status "versendet" setzt `pkv_eingereicht_am` auf Rechnungen

**Sync-Funktion:**  
`services/beihilfe_bescheide::sync_beihilfe_erstattet()` muss wissen ob es `beihilfe_erstattet_betrag` oder `pkv_erstattet_betrag` aktualisieren soll. Lösung: Die Funktion erhält den `antrag_typ` als Parameter (ein JOIN auf `beihilfe_bescheid.antrag_id → beihilfe_antrag.typ` ist ausreichend) oder die Funktion erhält das Zielfeld explizit.

**`pkv_erstattet_betrag` bisher manuell editierbar:**  
Analogie zur Beihilfe: Sobald PKV-Bescheid-Positionen existieren, sollte `pkv_erstattet_betrag` durch den Sync verwaltet werden. Das Feld bleibt im PATCH-Endpunkt für Rechnungen technisch erreichbar (bestehende Daten gehen nicht verloren), aber der Sync überschreibt. Nutzer, die PKV-Anträge nutzen, verlassen die manuelle Eingabe; Nutzer ohne PKV-Anträge sind nicht betroffen. Hinweis in der UI wenn ein Wert durch Sync gesetzt ist (ähnlich wie bei BH).

**`pkv_status` → „beschieden":**  
Analog zur Beihilfe-Änderung: `pkv_status` erhält den dritten Wert `'beschieden'` sobald `pkv_erstattet_betrag` gesetzt ist. Backend in `services/rechnungen.rs::pkv_status()`, Frontend in `StatusBadge.tsx`.

**Umbenennung in der UI:**  
Für PKV heißt ein „Bescheid" eher „Erstattungsmitteilung" oder „Abrechnung". Im Code bleiben die Tabellennamen (`beihilfe_bescheid`) unverändert, aber Labels in der UI werden kontextabhängig gewählt — `BeihilfeBescheidForm` erhält ein `antragTyp`-Prop und zeigt „Abrechnung" statt „Bescheid" für PKV.

**Widerspruch:**  
Das `widerspruch`-Flag auf `beihilfe_antrag_rechnung` bleibt unverändert und gilt für beide Typen. PKV-Widerspruch (Kostenübernahme-Ablehnung) ist seltener, aber strukturell identisch.

**Rechnungsauswahl im PKV-Antrag:**  
Bei Beihilfe wird gefiltert nach Personen, die zur Beihilfestelle des Antrags gehören. Bei PKV gibt es keine Beihilfestelle — es werden alle Rechnungen angeboten, die noch keinen PKV-Antrag haben (`pkv_eingereicht_am IS NULL`). Die Filterlogik in `BeihilfeAntragDetail` verzweigt auf Basis des Antrag-Typs.

#### Betroffene Bereiche

**DB (1 Migration):**
```sql
ALTER TABLE beihilfe_antrag ADD COLUMN typ TEXT NOT NULL DEFAULT 'beihilfe';
ALTER TABLE beihilfe_antrag ADD COLUMN pkv_versicherer TEXT;
```
Keine weiteren Schema-Änderungen. Bestehende Bescheid-Tabellen sind typ-agnostisch.

**Backend:**
- `backend/migrations/0020_antrag_typ.sql` — ALTER TABLE wie oben
- `backend/src/models/beihilfe_antrag.rs` — `typ`, `pkv_versicherer` zu Structs hinzufügen
- `backend/src/repositories/beihilfe_antraege.rs` — `typ`-Filter in list; CREATE mit typ/pkv_versicherer
- `backend/src/services/beihilfe_antraege.rs` — Statusübergang verzweigt auf `typ` für `eingereicht_am`-Feld
- `backend/src/services/beihilfe_bescheide.rs` — `sync_beihilfe_erstattet()` erhält Zielfeld-Info aus `antrag.typ`; aktualisiert `pkv_erstattet_betrag` statt `beihilfe_erstattet_betrag` für PKV
- `backend/src/handlers/beihilfe_antraege.rs` — `pkv_versicherer` im Create/Update durchreichen
- `backend/src/services/rechnungen.rs` — `pkv_status()` erhält `pkv_erstattet_betrag` und liefert `'beschieden'`

**Frontend:**
- `frontend/src/types/index.ts` — `BeihilfeAntrag` um `typ`, `pkv_versicherer` erweitern; `pkv_status` + `'beschieden'`
- `frontend/src/api/beihilfe_antraege.ts` — `typ` in CreateAntrag
- `frontend/src/pages/BeihilfeAntraegePage.tsx` — Seitenheader „Anträge" (statt „Beihilfe-Anträge")
- `frontend/src/components/BeihilfeAntraegeList.tsx` — Typ-Badge (BH / PKV) pro Eintrag; zusätzlicher Filter-Chip „Beihilfe / PKV / Alle"; Create-Dialog mit Typ-Wahl
- `frontend/src/components/BeihilfeAntragDetail.tsx` — Empfänger-Anzeige verzweigt: Beihilfestellen-Name für BH, `pkv_versicherer` für PKV; Rechnungsfilter-Logik anpassen
- `frontend/src/components/BeihilfeBescheidForm.tsx` — `antragTyp`-Prop; Labels „Bescheid" vs. „Abrechnung"; Kopfzeilen der Positionstabelle leicht anpassen
- `frontend/src/components/StatusBadge.tsx` — `pkv_status: 'beschieden'` in Grün
- `frontend/src/components/RechnungenTable.tsx` — `pkv_status: 'beschieden'`-Badge

#### Aufwandsschätzung

| Bereich | Aufwand |
|---|---|
| Migration + Modell-Erweiterung | ~0.5h |
| Backend Services (Statusübergang, Sync-Verzweigung, pkv_status) | ~2.5h |
| Backend Handler + Repository (typ-Filter, Create) | ~1h |
| Frontend Listenansicht (Badge, Filter, Create-Dialog) | ~2h |
| Frontend Detailansicht (Verzweigung BH vs. PKV) | ~2h |
| Frontend BeihilfeBescheidForm (Labels, antragTyp-Prop) | ~1h |
| Frontend StatusBadge + RechnungenTable (pkv beschieden) | ~0.5h |
| **Gesamt** | **~9–10h** |

**Einschätzung:** Machbar in 2 fokussierten Sessions. Der Scope ist klar begrenzt; durch die Wiederverwendung aller bestehenden Tabellen und UI-Komponenten bleibt die Komplexität im Rahmen. Das größte Risiko ist die Sync-Funktion: sie muss zuverlässig das richtige Zielfeld (`beihilfe_erstattet_betrag` vs. `pkv_erstattet_betrag`) bestimmen, da ein falsches Update schwer zu debuggen ist.

*Letzte Aktualisierung: 2026-05-20*

---

## Online-Deployment (claimbox.fringstar.net)

Voraussetzungen für den Betrieb hinter nginx-proxy-manager (NPM) im Internet. Alle Punkte müssen vor dem ersten öffentlichen Aufruf erledigt sein.

### OD1 · CORS einschränken
**Status:** `[ ]`

`allow_origin(Any)` in `backend/src/main.rs` erlaubt derzeit alle Herkunfts-Domains. Im Internet muss CORS auf die tatsächliche Frontend-Domain beschränkt werden.

**Fix:**
```rust
// backend/src/main.rs
.allow_origin("https://claimbox.fringstar.net".parse::<HeaderValue>().unwrap())
```

**Betroffene Datei:** `backend/src/main.rs`

### OD2 · Rate Limiting auf /api/auth/login
**Status:** `[ ]`

Der Login-Endpunkt hat kein Rate Limiting — Brute-Force-Angriffe auf das Admin-Passwort sind ungehindert möglich.

**Fix:** nginx `limit_req_zone` + `limit_req` im Frontend-nginx:
```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Betroffene Datei:** `frontend/nginx.conf`

### OD3 · Security Headers
**Status:** `[ ]`

Ohne Security Headers sind Clickjacking, MIME-Sniffing und ungewollte Referrer-Leaks möglich.

**Fix:** Header im `server`-Block von `frontend/nginx.conf`:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';" always;
```

**Betroffene Datei:** `frontend/nginx.conf`

### OD4 · Netzwerk-Isolation (docker-compose.yml)
**Status:** `[ ]`

Backend-Port 3000 ist am Host exponiert, Frontend nicht im `proxy-net`. Für den Internet-Betrieb muss NPM das Frontend direkt ansprechen, und der Backend-Port darf nicht öffentlich erreichbar sein.

**Fix in `docker-compose.yml`:**
- `frontend`: dem `proxy-net` hinzufügen (damit NPM es erreicht)
- `backend`: `ports`-Eintrag (`3000:3000`) entfernen (nur noch intern erreichbar)

**Betroffene Datei:** `docker-compose.yml`

### OD5 · NPM konfigurieren (manuell)
**Status:** `[ ]`

nginx-proxy-manager muss als Reverse Proxy für `claimbox.fringstar.net` eingerichtet werden.

**Schritte im NPM-Web-UI:**
1. Proxy Host anlegen: `claimbox.fringstar.net` → `frontend:80` (nach OD4 im proxy-net sichtbar)
2. SSL-Zertifikat: Let's Encrypt, `claimbox.fringstar.net`, E-Mail eintragen
3. „Force SSL" aktivieren (HTTP → HTTPS Redirect)
4. „HSTS Enabled" aktivieren (Strict-Transport-Security)

Kein Datei-Fix — reine UI-Konfiguration im NPM.
