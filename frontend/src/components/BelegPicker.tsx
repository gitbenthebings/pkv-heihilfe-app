import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBelege } from '../api/belege'
import { TYP_LABELS } from './BelegeUpload'
import type { Beleg } from '../types'

interface Props {
  excludeIds?: string[]
  onSelect: (beleg: Beleg) => void
  onCancel: () => void
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function BelegPicker({ excludeIds = [], onSelect, onCancel }: Props) {
  const [q, setQ] = useState('')

  const { data: belege = [], isLoading } = useQuery({
    queryKey: ['belege', 'picker', q],
    queryFn: () => getBelege({ q: q || undefined }),
  })

  const available = belege.filter(b => !excludeIds.includes(b.id))

  return (
    <div style={{
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
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Beleg verknüpfen</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-subtle)', lineHeight: 1 }}>×</button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Suche nach Bezeichnung, Notiz…"
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
          {isLoading && (
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px', margin: 0 }}>Lade…</p>
          )}
          {!isLoading && available.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px', margin: 0 }}>
              {belege.length === 0 ? 'Keine Belege vorhanden' : 'Alle passenden Belege bereits verknüpft'}
            </p>
          )}
          {available.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* PDF icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                style={{ color: 'var(--rose)', flexShrink: 0 }}>
                <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.bezeichnung || b.dateiname}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', gap: 8, marginTop: 2 }}>
                  {b.typ && <span>{TYP_LABELS[b.typ]}</span>}
                  {b.datum && <span>{formatDate(b.datum)}</span>}
                  {b.notiz && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notiz}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
