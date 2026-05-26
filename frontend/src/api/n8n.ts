/**
 * n8n Integration: Beihilfebescheid und Rechnungen automatisch verarbeiten
 *
 * Workflow-Dateien: /home/ben/docker/n8n/
 *   beihilfebescheid-workflow.json  – POST <n8n_webhook_url>
 *   rechnung-analyse-workflow.json  – POST <n8n_rechnung_webhook_url>
 *
 * ── Bescheid-Workflow (n8n_webhook_url) ──────────────────────────────────────
 * Request (multipart/form-data):
 *   file              PDF-Datei des Bescheids (max. 20 MB)
 *   antrag_id         UUID des Beihilfe-Antrags (Pflicht)
 *   rechnung_mapping  JSON-String: { "RE-001": "<rechnung-uuid>", … } (optional)
 *
 * Was der Workflow tut:
 *   1. PDF mit Claude analysieren → strukturierte Daten extrahieren
 *   2. Bescheid anlegen  POST /api/beihilfe-antraege/:id/bescheide
 *   3. Antrag-Status     PATCH /api/beihilfe-antraege/:id/status  → "beschieden"
 *   4. Positionen        POST …/positionen  (nur wenn rechnung_mapping übergeben)
 *   5. PDF hochladen     POST …/anhaenge
 *
 * ── Rechnungs-Analyse-Workflow (n8n_rechnung_webhook_url) ───────────────────
 * Request (multipart/form-data):
 *   file              PDF-Datei der Rechnung
 *
 * Was der Workflow tut:
 *   1. PDF mit Claude analysieren → Felder extrahieren
 *   2. JSON zurückgeben (keine DB-Einträge)
 */

import type { BescheidTyp } from '../types'

// ── Bescheid-Analyse ─────────────────────────────────────────────────────────

export interface N8nExtrahierteDaten {
  aktenzeichen: string | null
  bescheid_datum: string
  eingangsdatum: string | null
  erstattungsbetrag_gesamt: number
  typ: BescheidTyp
  anzahl_positionen: number
}

export interface N8nExtrahiertePosition {
  rechnungs_referenz: string
  leistungsart: string | null
  tatsaechliche_kosten: number | null
  anerkannt_betrag: number | null
  abgelehnt_betrag: number | null
  ablehnungsgrund: string | null
}

export interface N8nBescheidVerarbeitungErgebnis {
  success: true
  bescheid_id: string
  antrag_id: string
  extrahierte_daten: N8nExtrahierteDaten
  pdf_hochgeladen: boolean
  hinweise: string | null
  alle_positionen_claude: N8nExtrahiertePosition[]
}

export type RechnungMapping = Record<string, string>

export async function verarbeiteBescheidPDF(
  webhookUrl: string,
  antragId: string,
  datei: File,
  rechnungMapping?: RechnungMapping,
): Promise<N8nBescheidVerarbeitungErgebnis> {
  const formData = new FormData()
  formData.append('file', datei, datei.name)
  formData.append('antrag_id', antragId)
  if (rechnungMapping && Object.keys(rechnungMapping).length > 0) {
    formData.append('rechnung_mapping', JSON.stringify(rechnungMapping))
  }

  const res = await fetch(webhookUrl, { method: 'POST', body: formData })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `n8n Workflow fehlgeschlagen (HTTP ${res.status})`)
  }

  return res.json() as Promise<N8nBescheidVerarbeitungErgebnis>
}

// ── Rechnungs-Analyse ────────────────────────────────────────────────────────

export interface N8nRechnungAnalyseErgebnis {
  success: true
  /** Rechnungsbetrag in EUR (Dezimalzahl). */
  betrag: number
  /** Rechnungsdatum im Format YYYY-MM-DD. */
  datum: string
  /** Leistungsart: 'arzt' | 'apotheke' | 'krankenhaus' */
  typ: 'arzt' | 'apotheke' | 'krankenhaus'
  /** Name des Leistungserbringers laut Rechnung. */
  leistungserbringer_name: string | null
  /** Name des Patienten laut Rechnung, falls erkennbar. */
  person_name: string | null
  /** Zahlungsfrist im Format YYYY-MM-DD, falls angegeben. */
  zahlungsziel: string | null
  /** Kurze Besonderheiten oder null. */
  notiz: string | null
}

/**
 * Sendet eine Rechnung als PDF an den n8n-Analyse-Workflow.
 * Der Workflow analysiert das Dokument mit Claude und gibt strukturierte
 * Felddaten zurück – es werden keine DB-Einträge erstellt.
 */
export async function analysiereRechnungPDF(
  webhookUrl: string,
  datei: File,
): Promise<N8nRechnungAnalyseErgebnis> {
  const formData = new FormData()
  formData.append('file', datei, datei.name)

  const res = await fetch(webhookUrl, { method: 'POST', body: formData })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `n8n Analyse fehlgeschlagen (HTTP ${res.status})`)
  }

  return res.json() as Promise<N8nRechnungAnalyseErgebnis>
}
