import type { Rechnung } from '../types'

export interface AufgabenFilter {
  personIds: string[]      // leer = alle Personen
  jahr: number             // Rechnungsjahr (aus rechnung.datum)
  typen: string[]          // 'arzt' | 'apotheke' | 'krankenhaus'; leer = alle
  datumVon: string | null  // ISO-Datum YYYY-MM-DD, optional
  datumBis: string | null  // ISO-Datum YYYY-MM-DD, optional
}

export const defaultAufgabenFilter: AufgabenFilter = {
  personIds: [],
  jahr: new Date().getFullYear(),
  typen: [],
  datumVon: null,
  datumBis: null,
}

export function applyAufgabenFilter(
  rechnungen: Rechnung[],
  filter: AufgabenFilter
): Rechnung[] {
  return rechnungen.filter(r => {
    // Archivierte immer ausschließen
    if (r.archiviert_am !== null) return false

    // Person
    if (filter.personIds.length > 0 && !filter.personIds.includes(r.person_id)) return false

    // Jahr
    if (new Date(r.datum).getFullYear() !== filter.jahr) return false

    // Typ
    if (filter.typen.length > 0 && !filter.typen.includes(r.typ)) return false

    // Datum Von / Bis
    if (filter.datumVon && r.datum < filter.datumVon) return false
    if (filter.datumBis && r.datum > filter.datumBis) return false

    return true
  })
}

export function isDefaultFilter(filter: AufgabenFilter): boolean {
  const def = defaultAufgabenFilter
  return (
    filter.personIds.length === 0 &&
    filter.jahr === def.jahr &&
    filter.typen.length === 0 &&
    filter.datumVon === null &&
    filter.datumBis === null
  )
}
