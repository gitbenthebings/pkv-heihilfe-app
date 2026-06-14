import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import type { Rechnung } from '../types'

interface Props {
  excludeIds?: string[]
  onSelect: (rechnung: Rechnung) => void
  onCancel: () => void
}

function formatEuro(euros: number): string {
  return euros.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function RechnungPicker({ excludeIds = [], onSelect, onCancel }: Props) {
  const [q, setQ] = useState('')

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

  const personMap = useMemo(() => Object.fromEntries(personen.map(p => [p.id, p.name])), [personen])
  const corrMap = useMemo(() => Object.fromEntries(correspondents.map(c => [c.id, c.name])), [correspondents])

  const available = useMemo(() => {
    let list = rechnungen.filter(r => !excludeIds.includes(r.id))
    if (q.trim()) {
      const lq = q.toLowerCase()
      list = list.filter(r => {
        const person = personMap[r.person_id] ?? ''
        const corr = corrMap[r.leistungserbringer_id] ?? ''
        return (
          String(r.referenz_nr ?? '').includes(lq) ||
          person.toLowerCase().includes(lq) ||
          corr.toLowerCase().includes(lq) ||
          formatEuro(r.betrag).includes(lq)
        )
      })
    }
    return list
  }, [rechnungen, excludeIds, q, personMap, corrMap])

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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 520,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Rechnung verknüpfen</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-subtle)', lineHeight: 1 }}>×</button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Suche nach Person, Arzt, Ref-Nr…"
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              fontSize: 13, padding: '6px 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface-alt)', color: 'var(--text)',
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {available.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px', margin: 0 }}>
              {rechnungen.length === 0 ? 'Keine Rechnungen vorhanden' : 'Keine passenden Rechnungen'}
            </p>
          )}
          {available.map(r => {
            const person = personMap[r.person_id] ?? '–'
            const corr = corrMap[r.leistungserbringer_id] ?? '–'
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {corr} · {person}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
