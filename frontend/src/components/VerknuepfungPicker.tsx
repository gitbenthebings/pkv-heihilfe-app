import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { getAntraege } from '../api/beihilfe_antraege'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import { getBelege } from '../api/belege'
import type { Rechnung, BeihilfeAntrag, AntragStatus } from '../types'

interface Props {
  excludeRechnungIds?: string[]
  excludeAntragIds?: string[]
  onSelectRechnung: (r: Rechnung) => void
  onSelectAntrag: (a: BeihilfeAntrag) => void
  onCancel: () => void
}

type Tab = 'rechnungen' | 'antraege'

function formatEuro(euros: number): string {
  return euros.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const STATUS_LABELS: Record<AntragStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', in_bearbeitung: 'In Bearb.',
  beschieden: 'Beschieden', archiviert: 'Archiviert',
}
const STATUS_COLORS: Record<AntragStatus, string> = {
  entwurf: 'var(--text-subtle)',
  versendet: 'var(--primary)',
  in_bearbeitung: 'var(--amber)',
  beschieden: 'var(--emerald)',
  archiviert: 'var(--text-subtle)',
}

export default function VerknuepfungPicker({
  excludeRechnungIds = [],
  excludeAntragIds = [],
  onSelectRechnung,
  onSelectAntrag,
  onCancel,
}: Props) {
  const [tab, setTab] = useState<Tab>('rechnungen')
  const [q, setQ] = useState('')
  const [nurVerfuegbar, setNurVerfuegbar] = useState(true)

  // ── Alle Belege → global vergebene IDs ───────────────────────────────────
  const { data: alleBelege = [] } = useQuery({
    queryKey: ['belege'],
    queryFn: () => getBelege(),
    staleTime: 30_000,
  })
  const globalRechnungIds = useMemo(
    () => alleBelege.flatMap(b => b.linked_rechnungen.map(r => r.id)),
    [alleBelege],
  )
  const globalAntragIds = useMemo(
    () => alleBelege.flatMap(b => b.linked_antraege.map(a => a.id)),
    [alleBelege],
  )

  // ── Rechnungen ────────────────────────────────────────────────────────────
  const { data: rechnungen = [] } = useQuery({
    queryKey: ['rechnungen', 'picker'],
    queryFn: () => getRechnungen(undefined, false),
    staleTime: 30_000,
  })
  const { data: personen = [] } = useQuery({
    queryKey: ['personen'],
    queryFn: getPersonen,
    staleTime: 60_000,
  })
  const { data: correspondents = [] } = useQuery({
    queryKey: ['correspondents'],
    queryFn: getCorrespondents,
    staleTime: 60_000,
  })
  const personMap = useMemo(
    () => Object.fromEntries(personen.map(p => [p.id, p.name])),
    [personen],
  )
  const corrMap = useMemo(
    () => Object.fromEntries(correspondents.map(c => [c.id, c.name])),
    [correspondents],
  )
  const availableRechnungen = useMemo(() => {
    const allExcluded = new Set([
      ...excludeRechnungIds,
      ...(nurVerfuegbar ? globalRechnungIds : []),
    ])
    let list = rechnungen.filter(r => !allExcluded.has(r.id))
    if (q.trim()) {
      const lq = q.toLowerCase()
      list = list.filter(r =>
        String(r.referenz_nr ?? '').includes(lq) ||
        (personMap[r.person_id] ?? '').toLowerCase().includes(lq) ||
        (corrMap[r.leistungserbringer_id] ?? '').toLowerCase().includes(lq) ||
        formatEuro(r.betrag).includes(lq),
      )
    }
    return list
  }, [rechnungen, excludeRechnungIds, globalRechnungIds, nurVerfuegbar, q, personMap, corrMap])

  // ── Anträge ───────────────────────────────────────────────────────────────
  const { data: antraege = [] } = useQuery({
    queryKey: ['antraege', 'picker'],
    queryFn: () => getAntraege(),
    staleTime: 30_000,
  })
  const { data: beihilfestellen = [] } = useQuery({
    queryKey: ['beihilfestellen'],
    queryFn: getBeihilfestellen,
    staleTime: 60_000,
  })
  const { data: pkv = [] } = useQuery({
    queryKey: ['pkv'],
    queryFn: getPkv,
    staleTime: 60_000,
  })
  const bhMap = useMemo(
    () => Object.fromEntries(beihilfestellen.map(b => [b.id, b.name])),
    [beihilfestellen],
  )
  const pkvMap = useMemo(
    () => Object.fromEntries(pkv.map(p => [p.id, p.name])),
    [pkv],
  )
  const availableAntraege = useMemo(() => {
    const allExcluded = new Set([
      ...excludeAntragIds,
      ...(nurVerfuegbar ? globalAntragIds : []),
    ])
    const nonArchived = antraege.filter(
      a => a.status !== 'archiviert' && !allExcluded.has(a.id),
    )
    if (!q.trim()) return nonArchived
    const lq = q.toLowerCase()
    return nonArchived.filter(a => {
      const stelle = a.beihilfestelle_id
        ? (bhMap[a.beihilfestelle_id] ?? '')
        : a.pkv_id
          ? (pkvMap[a.pkv_id] ?? '')
          : (a.pkv_versicherer ?? '')
      return (
        String(a.referenz_nr).includes(lq) ||
        (a.titel ?? '').toLowerCase().includes(lq) ||
        stelle.toLowerCase().includes(lq) ||
        STATUS_LABELS[a.status].toLowerCase().includes(lq)
      )
    })
  }, [antraege, excludeAntragIds, globalAntragIds, nurVerfuegbar, q, bhMap, pkvMap])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 13, fontWeight: active ? 600 : 400,
    background: 'none', border: 'none', borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Verknüpfung hinzufügen</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 11, color: nurVerfuegbar ? 'var(--text-muted)' : 'var(--text-subtle)' }}>
                Nur freie
              </span>
              <span
                onClick={() => setNurVerfuegbar(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  width: 32, height: 18, borderRadius: 9,
                  background: nurVerfuegbar ? 'var(--primary)' : 'var(--border)',
                  padding: '0 2px', boxSizing: 'border-box',
                  transition: 'background 0.15s', flexShrink: 0,
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  transform: nurVerfuegbar ? 'translateX(14px)' : 'translateX(0)',
                  transition: 'transform 0.15s',
                  display: 'block',
                }} />
              </span>
            </label>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-subtle)', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex' }}>
            <button style={tabStyle(tab === 'rechnungen')} onClick={() => { setTab('rechnungen'); setQ('') }}>
              Rechnungen
            </button>
            <button style={tabStyle(tab === 'antraege')} onClick={() => { setTab('antraege'); setQ('') }}>
              Anträge
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            key={tab}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tab === 'rechnungen' ? 'Person, Arzt, Ref-Nr…' : 'Ref-Nr, Titel, Institution…'}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface-alt)', color: 'var(--text)',
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'rechnungen' && (
            availableRechnungen.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px', margin: 0 }}>
                  {rechnungen.length === 0 ? 'Keine Rechnungen vorhanden' : 'Keine passenden Rechnungen'}
                </p>
              : availableRechnungen.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelectRechnung(r)}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {formatEuro(r.betrag)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                      {formatDate(r.datum)}
                    </span>
                    {r.referenz_nr != null && (
                      <span style={{ fontSize: 10, color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                        #{r.referenz_nr}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {corrMap[r.leistungserbringer_id] ?? '–'} · {personMap[r.person_id] ?? '–'}
                  </div>
                </button>
              ))
          )}

          {tab === 'antraege' && (
            availableAntraege.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px', margin: 0 }}>
                  {antraege.length === 0 ? 'Keine Anträge vorhanden' : 'Keine passenden Anträge'}
                </p>
              : availableAntraege.map(a => {
                const stelle = a.beihilfestelle_id
                  ? (bhMap[a.beihilfestelle_id] ?? '–')
                  : a.pkv_id
                    ? (pkvMap[a.pkv_id] ?? '–')
                    : (a.pkv_versicherer ?? '–')
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelectAntrag(a)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 600,
                      whiteSpace: 'nowrap', flexShrink: 0,
                      background: a.typ === 'pkv'
                        ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                        : 'color-mix(in srgb, var(--teal) 15%, transparent)',
                      color: a.typ === 'pkv' ? 'var(--primary)' : 'var(--teal)',
                      border: `1px solid ${a.typ === 'pkv' ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'color-mix(in srgb, var(--teal) 30%, transparent)'}`,
                    }}>
                      {a.typ === 'pkv' ? 'PKV' : 'BH'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{a.referenz_nr}{a.titel ? ` – ${a.titel}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {stelle}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
                      color: STATUS_COLORS[a.status] ?? 'var(--text-subtle)',
                      background: 'var(--surface-alt)', border: '1px solid var(--border)',
                    }}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </button>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}
