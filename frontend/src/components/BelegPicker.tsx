import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBelege } from '../api/belege'
import { TYP_LABELS } from './BelegeUpload'
import type { Beleg } from '../types'

interface Props {
  excludeIds?: string[]
  /** Wenn gesetzt, werden Belege einer anderen Stelle ausgeblendet. */
  beihilfestelleId?: string | null
  pkvId?: string | null
  onSelect: (beleg: Beleg) => void
  onCancel: () => void
}

function isCompatible(beleg: Beleg, beihilfestelleId?: string | null, pkvId?: string | null): boolean {
  const hasContext = beihilfestelleId || pkvId
  if (!hasContext) return true
  // Belege die eindeutig einer anderen Stelle gehören, ausblenden
  if (beihilfestelleId) {
    if (beleg.pkv_id) return false  // PKV-Beleg in BH-Kontext
    if (beleg.beihilfestelle_id && beleg.beihilfestelle_id !== beihilfestelleId) return false
  }
  if (pkvId) {
    if (beleg.beihilfestelle_id) return false  // BH-Beleg in PKV-Kontext
    if (beleg.pkv_id && beleg.pkv_id !== pkvId) return false
  }
  return true
}

// Rechnung/Rezept gehören inhaltlich zu genau einer Rechnung — bereits anderswo
// verknüpfte Exemplare dieser Typen im Picker auszublenden vermeidet versehentliche
// Mehrfachverknüpfung. Bescheide etc. dürfen bewusst mehrere Rechnungen abdecken.
function isAlreadyLinkedElsewhere(beleg: Beleg): boolean {
  return (beleg.typ === 'rechnung' || beleg.typ === 'rezept') && beleg.linked_rechnungen.length > 0
}

export default function BelegPicker({ excludeIds = [], beihilfestelleId, pkvId, onSelect, onCancel }: Props) {
  const [q, setQ] = useState('')

  const { data: belege = [], isLoading } = useQuery({
    queryKey: ['belege', 'picker', q],
    queryFn: () => getBelege({ q: q || undefined }),
  })

  const notExcluded = belege.filter(b => !excludeIds.includes(b.id))
  const notLinkedElsewhere = notExcluded.filter(b => !isAlreadyLinkedElsewhere(b))
  const available = notLinkedElsewhere.filter(b => isCompatible(b, beihilfestelleId, pkvId))
  const hiddenStelle = notLinkedElsewhere.length - available.length
  const hiddenLinked = notExcluded.length - notLinkedElsewhere.length

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
          {!isLoading && hiddenStelle > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-subtle)', padding: '6px 16px 0', margin: 0, fontStyle: 'italic' }}>
              {hiddenStelle} Beleg{hiddenStelle !== 1 ? 'e' : ''} ausgeblendet (andere Stelle)
            </p>
          )}
          {!isLoading && hiddenLinked > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-subtle)', padding: '6px 16px 0', margin: 0, fontStyle: 'italic' }}>
              {hiddenLinked} Beleg{hiddenLinked !== 1 ? 'e' : ''} ausgeblendet (bereits anderer Rechnung zugeordnet)
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
