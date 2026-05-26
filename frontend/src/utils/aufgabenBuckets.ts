import type { Rechnung, Person } from '../types'

export type BucketKey =
  | 'zu_bezahlen'
  | 'beihilfe_einreichen'
  | 'warten_beihilfe'
  | 'pkv_einreichen'
  | 'warten_pkv'
  | 'bereit_archivieren'

export interface BucketDefinition {
  key: BucketKey
  titel: string
  beschreibung: string
  istWartebucket: boolean
}

export interface BefuellterBucket {
  definition: BucketDefinition
  // aktive: pkv_verzicht=false (oder irrelevant für diesen Bucket)
  aktive: Rechnung[]
  // zurueckgestellt: nur pkv_einreichen; pkv_verzicht=true
  zurueckgestellt: Rechnung[]
  gesamtbetrag: number
}

export const BUCKET_DEFINITIONEN: BucketDefinition[] = [
  {
    key: 'zu_bezahlen',
    titel: 'Zu bezahlen',
    beschreibung: 'Diese Rechnungen sind noch nicht beglichen.',
    istWartebucket: false,
  },
  {
    key: 'beihilfe_einreichen',
    titel: 'In Antrag aufnehmen',
    beschreibung: 'Noch kein Beihilfe-Antrag. Diese Rechnungen in einem Antrag einreichen.',
    istWartebucket: false,
  },
  {
    key: 'warten_beihilfe',
    titel: 'Warten auf Beihilfe-Bescheid',
    beschreibung: 'Antrag versendet – warte auf Bescheid. Bescheid im Antrag erfassen.',
    istWartebucket: true,
  },
  {
    key: 'pkv_einreichen',
    titel: 'PKV einreichen',
    beschreibung: 'Noch nicht bei der PKV eingereicht.',
    istWartebucket: false,
  },
  {
    key: 'warten_pkv',
    titel: 'Warten auf PKV-Abrechnung',
    beschreibung: 'Bei der PKV eingereicht – warte auf Erstattungsbescheid.',
    istWartebucket: true,
  },
  {
    key: 'bereit_archivieren',
    titel: 'Erledigt – bereit zum Archivieren',
    beschreibung: 'Alle Schritte abgeschlossen.',
    istWartebucket: false,
  },
]

/**
 * Parallele Zuweisung: Eine Rechnung kann gleichzeitig in mehreren Buckets sein.
 * Jede Bedingung wird unabhängig geprüft.
 */
export function getBucketsForRechnung(
  r: Rechnung,
  person: Person | undefined,
): BucketKey[] {
  const keys: BucketKey[] = []

  // zu_bezahlen
  if (r.bezahlt_am === null) keys.push('zu_bezahlen')

  // beihilfe_einreichen
  if (person?.beihilfestelle_id != null && r.beihilfe_eingereicht_am === null) {
    keys.push('beihilfe_einreichen')
  }

  // warten_beihilfe
  if (r.beihilfe_eingereicht_am !== null && r.beihilfe_erstattet_betrag === null) {
    keys.push('warten_beihilfe')
  }

  // pkv_einreichen (inkl. zurückgestellt – werden separat angezeigt)
  if (r.pkv_eingereicht_am === null) keys.push('pkv_einreichen')

  // warten_pkv
  if (r.pkv_eingereicht_am !== null && r.pkv_erstattet_betrag === null) {
    keys.push('warten_pkv')
  }

  // bereit_archivieren: in keinem anderen Bucket
  if (keys.length === 0) keys.push('bereit_archivieren')

  return keys
}

export function getZahlungszielStatus(
  r: Rechnung,
  todayStr: string,
): 'ueberfaellig' | 'bald_faellig' | null {
  if (r.bezahlt_am !== null || r.zahlungsziel === null) return null
  if (r.zahlungsziel < todayStr) return 'ueberfaellig'
  const diffDays = Math.ceil(
    (new Date(r.zahlungsziel).getTime() - new Date(todayStr).getTime()) / 86_400_000,
  )
  return diffDays <= 7 ? 'bald_faellig' : null
}

export function groupIntoBuckets(
  rechnungen: Rechnung[],
  personenById: Map<string, Person>,
): BefuellterBucket[] {
  const byKey = new Map<BucketKey, { aktive: Rechnung[]; zurueckgestellt: Rechnung[] }>(
    BUCKET_DEFINITIONEN.map(d => [d.key, { aktive: [], zurueckgestellt: [] }])
  )

  for (const r of rechnungen) {
    if (r.archiviert_am !== null) continue
    const person = personenById.get(r.person_id)
    const keys = getBucketsForRechnung(r, person)
    for (const key of keys) {
      const slot = byKey.get(key)!
      if (key === 'pkv_einreichen' && r.pkv_verzicht) {
        slot.zurueckgestellt.push(r)
      } else {
        slot.aktive.push(r)
      }
    }
  }

  return BUCKET_DEFINITIONEN.map(def => {
    const { aktive, zurueckgestellt } = byKey.get(def.key)!
    const alle = [...aktive, ...zurueckgestellt]
    return {
      definition: def,
      aktive,
      zurueckgestellt,
      gesamtbetrag: alle.reduce((s, r) => s + r.betrag, 0),
    }
  })
}
