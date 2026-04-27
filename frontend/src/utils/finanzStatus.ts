import type { Rechnung, Person } from '../types'

export interface BrePersonStatus {
  person: Person
  breSchwelle: number | null              // person.bre_schwelle (Euro)
  pkvNochNichtEingereicht: number         // Summe pkv_anteil_erwartet, pkv_eingereicht_am IS NULL AND pkv_verzicht IS NOT TRUE
  pkvBereitsEingereichtJahr: number       // Summe pkv_anteil_erwartet, pkv_eingereicht_am IS NOT NULL
  pkvGesamtPotenzialJahr: number          // nochNichtEingereicht + bereitsEingereichtJahr
  empfehlung: 'einreichen' | 'schonen' | 'keine_schwelle' | 'bereits_ueberschritten'
}

export interface FinanzKennzahlen {
  // Zahlungsstatus
  offenBetrag: number                    // Summe betrag wo bezahlt_am IS NULL
  bezahltBetrag: number                  // Summe betrag wo bezahlt_am IS NOT NULL

  // Beihilfe
  beihilfeAusstehendBetrag: number       // eingereicht, kein Bescheid
  beihilfeErstattetBetrag: number        // Summe beihilfe_erstattet_betrag
  beihilfeErwartetBetrag: number         // Summe beihilfe_anteil_erwartet der Erstatteten
  beihilfeDifferenz: number              // erstattet − erwartet

  // PKV
  pkvAusstehendBetrag: number            // eingereicht, keine Abrechnung
  pkvErstattetBetrag: number             // Summe pkv_erstattet_betrag
  pkvErwartetBetrag: number              // Summe pkv_anteil_erwartet der Abgerechneten
  pkvDifferenz: number                   // erstattet − erwartet

  // BRE pro Person
  breStatus: BrePersonStatus[]
}

export function berechneFinanzKennzahlen(
  rechnungen: Rechnung[],
  personenById: Map<string, Person>
): FinanzKennzahlen {
  let offenBetrag = 0
  let bezahltBetrag = 0
  let beihilfeAusstehendBetrag = 0
  let beihilfeErstattetBetrag = 0
  let beihilfeErwartetBetrag = 0
  let pkvAusstehendBetrag = 0
  let pkvErstattetBetrag = 0
  let pkvErwartetBetrag = 0

  // BRE: pro Person
  const breMap = new Map<string, {
    pkvNochNicht: number
    pkvBereits: number
  }>()

  for (const r of rechnungen) {
    const betrag = r.betrag

    // Zahlungsstatus
    if (r.bezahlt_am === null) {
      offenBetrag += betrag
    } else {
      bezahltBetrag += betrag
    }

    // Beihilfe
    if (r.beihilfe_eingereicht_am !== null && r.beihilfe_erstattet_betrag === null) {
      beihilfeAusstehendBetrag += r.beihilfe_anteil_erwartet ?? 0
    }
    if (r.beihilfe_erstattet_betrag !== null) {
      beihilfeErstattetBetrag += r.beihilfe_erstattet_betrag
      beihilfeErwartetBetrag += r.beihilfe_anteil_erwartet ?? 0
    }

    // PKV
    if (r.pkv_eingereicht_am !== null && r.pkv_erstattet_betrag === null) {
      pkvAusstehendBetrag += r.pkv_anteil_erwartet ?? 0
    }
    if (r.pkv_erstattet_betrag !== null) {
      pkvErstattetBetrag += r.pkv_erstattet_betrag
      pkvErwartetBetrag += r.pkv_anteil_erwartet ?? 0
    }

    // BRE-Akkumulation pro Person
    const pid = r.person_id
    if (!breMap.has(pid)) breMap.set(pid, { pkvNochNicht: 0, pkvBereits: 0 })
    const entry = breMap.get(pid)!
    const pkvAnteil = r.pkv_anteil_erwartet ?? 0

    if (r.pkv_eingereicht_am !== null) {
      entry.pkvBereits += pkvAnteil
    } else if (!r.pkv_verzicht) {
      entry.pkvNochNicht += pkvAnteil
    }
  }

  // BRE-Status pro Person aufbauen
  const breStatus: BrePersonStatus[] = []
  for (const [pid, entry] of breMap) {
    const person = personenById.get(pid)
    if (!person) continue

    const breSchwelle = person.bre_schwelle ?? null
    const pkvNochNichtEingereicht = entry.pkvNochNicht
    const pkvBereitsEingereichtJahr = entry.pkvBereits
    const pkvGesamtPotenzialJahr = pkvNochNichtEingereicht + pkvBereitsEingereichtJahr

    let empfehlung: BrePersonStatus['empfehlung']
    if (breSchwelle === null) {
      empfehlung = 'keine_schwelle'
    } else if (pkvBereitsEingereichtJahr >= breSchwelle) {
      empfehlung = 'bereits_ueberschritten'
    } else if (pkvGesamtPotenzialJahr >= breSchwelle) {
      empfehlung = 'einreichen'
    } else {
      empfehlung = 'schonen'
    }

    // Personen ohne Schwelle komplett ausblenden
    if (empfehlung !== 'keine_schwelle') {
      breStatus.push({
        person,
        breSchwelle,
        pkvNochNichtEingereicht,
        pkvBereitsEingereichtJahr,
        pkvGesamtPotenzialJahr,
        empfehlung,
      })
    }
  }

  return {
    offenBetrag,
    bezahltBetrag,
    beihilfeAusstehendBetrag,
    beihilfeErstattetBetrag,
    beihilfeErwartetBetrag,
    beihilfeDifferenz: beihilfeErstattetBetrag - beihilfeErwartetBetrag,
    pkvAusstehendBetrag,
    pkvErstattetBetrag,
    pkvErwartetBetrag,
    pkvDifferenz: pkvErstattetBetrag - pkvErwartetBetrag,
    breStatus,
  }
}
