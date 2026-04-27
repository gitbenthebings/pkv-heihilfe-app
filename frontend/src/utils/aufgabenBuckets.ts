import type { Rechnung, Person } from '../types'

export type BucketKey =
  | 'zu_bezahlen'
  | 'beihilfe_einreichen'
  | 'beihilfe_bescheid_ausstehend'
  | 'pkv_entscheidung'
  | 'pkv_abrechnung_ausstehend'
  | 'bereit_archivieren'

export interface AufgabenBucket {
  key: BucketKey
  titel: string
  beschreibung: string
  aktive: Rechnung[]
  zurueckgestellt: Rechnung[]  // pkv_verzicht=true, nur Bucket pkv_entscheidung
  gesamtbetrag: number         // Summe betrag (Euro), alle Rechnungen im Bucket
  offenerPkvAnteil: number     // Nur pkv_entscheidung: Summe pkv_anteil_erwartet
}

const BUCKET_META: Record<BucketKey, { titel: string; beschreibung: string }> = {
  zu_bezahlen: {
    titel: 'Zu bezahlen',
    beschreibung: 'Diese Rechnungen sind noch nicht beglichen.',
  },
  beihilfe_einreichen: {
    titel: 'Beihilfe einreichen',
    beschreibung: 'Bezahlt – jetzt zur Beihilfestelle einreichen.',
  },
  beihilfe_bescheid_ausstehend: {
    titel: 'Warten auf Beihilfe-Bescheid',
    beschreibung: 'Eingereicht – warte auf Bescheid der Beihilfestelle.',
  },
  pkv_entscheidung: {
    titel: 'PKV-Entscheidung ausstehend',
    beschreibung: 'Beihilfe-Bescheid liegt vor. Entscheide ob du bei der PKV einreichst.',
  },
  pkv_abrechnung_ausstehend: {
    titel: 'Warten auf PKV-Abrechnung',
    beschreibung: 'Bei der PKV eingereicht – warte auf Erstattungsbescheid.',
  },
  bereit_archivieren: {
    titel: 'Erledigt – bereit zum Archivieren',
    beschreibung: 'Alle Schritte abgeschlossen.',
  },
}

function getBucketKey(r: Rechnung, personenById: Map<string, Person>): BucketKey | null {
  // Nur nicht-archivierte Rechnungen
  if (r.archiviert_am !== null) return null

  const person = personenById.get(r.person_id)
  const hatBeihilfestelle = person?.beihilfestelle_id != null

  // 1. Zu bezahlen
  if (r.bezahlt_am === null) return 'zu_bezahlen'

  // 2. Beihilfe einreichen
  if (hatBeihilfestelle && r.beihilfe_eingereicht_am === null) return 'beihilfe_einreichen'

  // 3. Beihilfe-Bescheid ausstehend
  if (r.beihilfe_eingereicht_am !== null && r.beihilfe_erstattet_betrag === null) {
    return 'beihilfe_bescheid_ausstehend'
  }

  // 4. PKV-Entscheidung
  const beihilfeAbgeschlossen = !hatBeihilfestelle || r.beihilfe_erstattet_betrag !== null
  if (beihilfeAbgeschlossen && r.pkv_eingereicht_am === null) return 'pkv_entscheidung'

  // 5. PKV-Abrechnung ausstehend
  if (r.pkv_eingereicht_am !== null && r.pkv_erstattet_betrag === null) {
    return 'pkv_abrechnung_ausstehend'
  }

  // 6. Bereit archivieren
  return 'bereit_archivieren'
}

const BUCKET_ORDER: BucketKey[] = [
  'zu_bezahlen',
  'beihilfe_einreichen',
  'beihilfe_bescheid_ausstehend',
  'pkv_entscheidung',
  'pkv_abrechnung_ausstehend',
  'bereit_archivieren',
]

export function groupIntoAufgabenBuckets(
  rechnungen: Rechnung[],
  personenById: Map<string, Person>
): AufgabenBucket[] {
  const buckets: Record<BucketKey, { aktive: Rechnung[]; zurueckgestellt: Rechnung[] }> = {
    zu_bezahlen: { aktive: [], zurueckgestellt: [] },
    beihilfe_einreichen: { aktive: [], zurueckgestellt: [] },
    beihilfe_bescheid_ausstehend: { aktive: [], zurueckgestellt: [] },
    pkv_entscheidung: { aktive: [], zurueckgestellt: [] },
    pkv_abrechnung_ausstehend: { aktive: [], zurueckgestellt: [] },
    bereit_archivieren: { aktive: [], zurueckgestellt: [] },
  }

  for (const r of rechnungen) {
    const key = getBucketKey(r, personenById)
    if (!key) continue

    if (key === 'pkv_entscheidung' && r.pkv_verzicht) {
      buckets[key].zurueckgestellt.push(r)
    } else {
      buckets[key].aktive.push(r)
    }
  }

  return BUCKET_ORDER.map(key => {
    const { aktive, zurueckgestellt } = buckets[key]
    const alle = [...aktive, ...zurueckgestellt]
    const gesamtbetrag = alle.reduce((s, r) => s + r.betrag, 0)
    const offenerPkvAnteil = alle.reduce((s, r) => s + (r.pkv_anteil_erwartet ?? 0), 0)
    return {
      key,
      ...BUCKET_META[key],
      aktive,
      zurueckgestellt,
      gesamtbetrag,
      offenerPkvAnteil,
    }
  })
}
