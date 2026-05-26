import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { useJahr } from '../context/JahrContext'
import type { Rechnung, Person, Correspondent } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function euro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function sign(v: number) {
  return v >= 0 ? `+${euro(v)}` : euro(v)
}

const TYP_LABEL: Record<string, string> = {
  arzt: 'Arzt', apotheke: 'Apotheke', krankenhaus: 'Krankenhaus',
}

// ─── Berechnungslogik ─────────────────────────────────────────────────────────

interface ZeileStats {
  personId: string
  personName: string
  typ: string
  typLabel: string
  count: number
  betrag: number
  bhErwartet: number
  bhTatsaechlich: number | null
  pkvErwartet: number
  pkvTatsaechlich: number | null
  eigenanteil: number | null
}

interface Gesamt {
  betrag: number
  bhErwartet: number
  bhTatsaechlich: number
  pkvErwartet: number
  pkvTatsaechlich: number
  eigenanteil: number
  vollstaendigAbgerechnet: number
}

function berechne(
  rechnungen: Rechnung[],
  personenById: Map<string, Person>,
) {
  const zeilenMap = new Map<string, ZeileStats>()

  for (const r of rechnungen) {
    const person = personenById.get(r.person_id)
    const personName = person?.name ?? r.person_id
    const typLabel = TYP_LABEL[r.typ] ?? r.typ
    const key = `${r.person_id}::${r.typ}`

    if (!zeilenMap.has(key)) {
      zeilenMap.set(key, {
        personId: r.person_id,
        personName,
        typ: r.typ,
        typLabel,
        count: 0,
        betrag: 0,
        bhErwartet: 0,
        bhTatsaechlich: null,
        pkvErwartet: 0,
        pkvTatsaechlich: null,
        eigenanteil: null,
      })
    }

    const z = zeilenMap.get(key)!
    z.count++
    z.betrag += r.betrag
    z.bhErwartet += r.beihilfe_anteil_erwartet ?? 0
    if (r.beihilfe_erstattet_betrag != null) {
      z.bhTatsaechlich = (z.bhTatsaechlich ?? 0) + r.beihilfe_erstattet_betrag
    }
    z.pkvErwartet += r.pkv_anteil_erwartet ?? 0
    if (r.pkv_erstattet_betrag != null) {
      z.pkvTatsaechlich = (z.pkvTatsaechlich ?? 0) + r.pkv_erstattet_betrag
    }
  }

  // Eigenanteil pro Zeile (nur vollständig abgerechnete Rechnungen)
  for (const r of rechnungen) {
    const key = `${r.person_id}::${r.typ}`
    const person = personenById.get(r.person_id)
    const hatBH = person?.beihilfestelle_id != null
    const vollstaendig = r.pkv_erstattet_betrag != null && (!hatBH || r.beihilfe_erstattet_betrag != null)
    if (vollstaendig) {
      const z = zeilenMap.get(key)!
      const ea = r.betrag - (r.beihilfe_erstattet_betrag ?? 0) - (r.pkv_erstattet_betrag ?? 0)
      z.eigenanteil = (z.eigenanteil ?? 0) + ea
    }
  }

  const zeilen = [...zeilenMap.values()].sort((a, b) =>
    a.personName.localeCompare(b.personName) || a.typLabel.localeCompare(b.typLabel)
  )

  const gesamt: Gesamt = {
    betrag: 0, bhErwartet: 0, bhTatsaechlich: 0,
    pkvErwartet: 0, pkvTatsaechlich: 0, eigenanteil: 0,
    vollstaendigAbgerechnet: 0,
  }
  for (const r of rechnungen) {
    gesamt.betrag += r.betrag
    gesamt.bhErwartet += r.beihilfe_anteil_erwartet ?? 0
    gesamt.pkvErwartet += r.pkv_anteil_erwartet ?? 0
    if (r.beihilfe_erstattet_betrag != null) gesamt.bhTatsaechlich += r.beihilfe_erstattet_betrag
    if (r.pkv_erstattet_betrag != null) gesamt.pkvTatsaechlich += r.pkv_erstattet_betrag

    const person = personenById.get(r.person_id)
    const hatBH = person?.beihilfestelle_id != null
    const vollst = r.pkv_erstattet_betrag != null && (!hatBH || r.beihilfe_erstattet_betrag != null)
    if (vollst) {
      gesamt.eigenanteil += r.betrag - (r.beihilfe_erstattet_betrag ?? 0) - (r.pkv_erstattet_betrag ?? 0)
      gesamt.vollstaendigAbgerechnet++
    }
  }

  return { zeilen, gesamt }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(
  rechnungen: Rechnung[],
  personenById: Map<string, Person>,
  correspondentsById: Map<string, Correspondent>,
  jahr: number,
) {
  const header = [
    'Datum', 'Ref-Nr.', 'Person', 'Typ', 'Leistungserbringer',
    'Betrag', 'BH erwartet', 'BH tatsächlich', 'PKV erwartet', 'PKV tatsächlich', 'Eigenanteil', 'Notiz',
  ]

  const rows = rechnungen.map(r => {
    const person = personenById.get(r.person_id)
    const hatBH = person?.beihilfestelle_id != null
    const vollst = r.pkv_erstattet_betrag != null && (!hatBH || r.beihilfe_erstattet_betrag != null)
    const eigenanteil = vollst
      ? r.betrag - (r.beihilfe_erstattet_betrag ?? 0) - (r.pkv_erstattet_betrag ?? 0)
      : null
    const ref = r.referenz_nr ? `R-${String(r.referenz_nr).padStart(4, '0')}` : ''
    return [
      r.datum,
      ref,
      person?.name ?? r.person_id,
      TYP_LABEL[r.typ] ?? r.typ,
      correspondentsById.get(r.leistungserbringer_id)?.name ?? r.leistungserbringer_id,
      r.betrag.toFixed(2).replace('.', ','),
      (r.beihilfe_anteil_erwartet ?? 0).toFixed(2).replace('.', ','),
      r.beihilfe_erstattet_betrag != null ? r.beihilfe_erstattet_betrag.toFixed(2).replace('.', ',') : '',
      (r.pkv_anteil_erwartet ?? 0).toFixed(2).replace('.', ','),
      r.pkv_erstattet_betrag != null ? r.pkv_erstattet_betrag.toFixed(2).replace('.', ',') : '',
      eigenanteil != null ? eigenanteil.toFixed(2).replace('.', ',') : '',
      r.notiz ?? '',
    ]
  })

  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pkv-auswertung-${jahr}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Karte ────────────────────────────────────────────────────────────────────

function Karte({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', flex: '1 1 140px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function AuswertungPage() {
  const { jahr } = useJahr()

  const { data: rechnungen = [], isLoading } = useQuery({
    queryKey: ['rechnungen', undefined, false, jahr],
    queryFn: () => getRechnungen(undefined, false, jahr),
  })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

  const personenById = useMemo(() => new Map<string, Person>(personen.map(p => [p.id, p])), [personen])
  const correspondentsById = useMemo(() => new Map<string, Correspondent>(correspondents.map(c => [c.id, c])), [correspondents])

  const { zeilen, gesamt } = useMemo(
    () => berechne(rechnungen, personenById),
    [rechnungen, personenById],
  )

  const bhDiff = gesamt.bhTatsaechlich - gesamt.bhErwartet
  const pkvDiff = gesamt.pkvTatsaechlich - gesamt.pkvErwartet

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Jahresauswertung {jahr}
        </h1>
        <button
          onClick={() => exportCSV(rechnungen, personenById, correspondentsById, jahr)}
          disabled={rechnungen.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7,
            background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
            opacity: rechnungen.length === 0 ? 0.5 : 1,
          }}
        >
          <Download className="w-3.5 h-3.5" />
          CSV exportieren
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade Daten…</p>}

      {!isLoading && rechnungen.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Rechnungen für {jahr}.</p>
        </div>
      )}

      {!isLoading && rechnungen.length > 0 && (
        <>
          {/* Zusammenfassung */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Zusammenfassung
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Karte label="Rechnungen" value={String(rechnungen.length)} sub={`${gesamt.vollstaendigAbgerechnet} vollst. abgerechnet`} />
              <Karte label="Gesamtbetrag" value={euro(gesamt.betrag)} />
              <Karte label="BH erwartet" value={euro(gesamt.bhErwartet)} />
              <Karte
                label="BH tatsächlich"
                value={euro(gesamt.bhTatsaechlich)}
                sub={`Differenz: ${sign(bhDiff)}`}
                color={bhDiff >= 0 ? 'var(--teal)' : 'var(--rose)'}
              />
              <Karte label="PKV erwartet" value={euro(gesamt.pkvErwartet)} />
              <Karte
                label="PKV tatsächlich"
                value={euro(gesamt.pkvTatsaechlich)}
                sub={`Differenz: ${sign(pkvDiff)}`}
                color={pkvDiff >= 0 ? 'var(--teal)' : 'var(--rose)'}
              />
              <Karte
                label="Eigenanteil (vollst.)"
                value={euro(gesamt.eigenanteil)}
                sub="§ 33 EStG-relevant"
                color="var(--amber)"
              />
            </div>
          </section>

          {/* Tabelle nach Person & Typ */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Aufschlüsselung nach Person und Typ
            </h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)' }}>
                      {['Person', 'Typ', 'Anz.', 'Betrag', 'BH erw.', 'BH tats.', 'PKV erw.', 'PKV tats.', 'Eigenanteil'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                          className="first:text-left second:text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zeilen.map((z, i) => (
                      <tr key={`${z.personId}-${z.typ}`}
                        style={{ borderBottom: i < zeilen.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text)' }}>{z.personName}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{z.typLabel}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>{z.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{euro(z.betrag)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{euro(z.bhErwartet)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                          {z.bhTatsaechlich != null ? euro(z.bhTatsaechlich) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{euro(z.pkvErwartet)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                          {z.pkvTatsaechlich != null ? euro(z.pkvTatsaechlich) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--amber)' }}>
                          {z.eigenanteil != null ? euro(z.eigenanteil) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-alt)' }}>
                      <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text)' }}>Gesamt</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{euro(gesamt.betrag)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{euro(gesamt.bhErwartet)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{euro(gesamt.bhTatsaechlich)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{euro(gesamt.pkvErwartet)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{euro(gesamt.pkvTatsaechlich)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--amber)' }}>{euro(gesamt.eigenanteil)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* Steuerhinweis */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Steuerhinweis:</strong> Der Eigenanteil (vollständig abgerechnete Rechnungen) kann im Rahmen von § 33 EStG (außergewöhnliche Belastungen) steuerlich geltend gemacht werden. Alle Angaben ohne Gewähr — bitte mit Steuerberater prüfen.
          </div>
        </>
      )}
    </div>
  )
}
