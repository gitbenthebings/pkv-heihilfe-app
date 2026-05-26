import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Person } from '../types'
import { type AufgabenFilter, defaultAufgabenFilter, isDefaultFilter } from '../utils/aufgabenFilter'

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function MultiSelectDropdown({
  label, options, selected, onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(s => s !== id))
    else onChange([...selected, id])
  }

  const displayLabel = selected.length === 0
    ? label
    : options.filter(o => selected.includes(o.id)).map(o => o.label).join(', ')
  const truncated = displayLabel.length > 18 ? displayLabel.slice(0, 16) + '…' : displayLabel

  const active = selected.length > 0

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          background: active ? 'var(--primary-dim)' : 'var(--surface)',
          color: active ? 'var(--primary)' : 'var(--text-muted)',
          minHeight: 32,
        }}
      >
        <span>{truncated}</span>
        {active && (
          <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 9, borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {selected.length}
          </span>
        )}
        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 'min(95vw, 13rem)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 20, padding: '4px 0' }}>
          <div className="max-h-48 overflow-y-auto">
            {options.map(o => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', minHeight: 40 }}
                className="hover-surface-hi">
                <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
                <span style={{ fontSize: 12, color: 'var(--text)' }} className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '4px 12px' }}>
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Alle entfernen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

const TYPEN = [
  { id: 'arzt', label: 'Arzt' },
  { id: 'apotheke', label: 'Apotheke' },
  { id: 'krankenhaus', label: 'Krankenhaus' },
]

interface Props {
  filter: AufgabenFilter
  onChange: (filter: AufgabenFilter) => void
  personen: Person[]
}

export default function AufgabenFilterleiste({ filter, onChange, personen }: Props) {
  const personenOptions = personen.map(p => ({ id: p.id, label: p.name }))

  function set<K extends keyof AufgabenFilter>(key: K, value: AufgabenFilter[K]) {
    onChange({ ...filter, [key]: value })
  }

  const chipStyle = { padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', minHeight: 32 }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <div className="flex flex-wrap items-center gap-1.5">

        {/* Person */}
        <MultiSelectDropdown
          label="Person"
          options={personenOptions}
          selected={filter.personIds}
          onChange={ids => set('personIds', ids)}
        />

        {/* Typ */}
        <MultiSelectDropdown
          label="Typ"
          options={TYPEN}
          selected={filter.typen}
          onChange={ids => set('typen', ids)}
        />

        {/* Zeitraum */}
        <div className="flex flex-wrap items-center gap-1">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Von</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filter.datumVon ?? ''}
              onChange={e => set('datumVon', e.target.value || null)}
              style={{ ...chipStyle, paddingRight: filter.datumVon ? 24 : undefined }}
            />
            {filter.datumVon && (
              <button onClick={() => set('datumVon', null)}
                style={{ position: 'absolute', right: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bis</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filter.datumBis ?? ''}
              onChange={e => set('datumBis', e.target.value || null)}
              style={{ ...chipStyle, paddingRight: filter.datumBis ? 24 : undefined }}
            />
            {filter.datumBis && (
              <button onClick={() => set('datumBis', null)}
                style={{ position: 'absolute', right: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Zurücksetzen */}
        {!isDefaultFilter(filter) && (
          <button
            onClick={() => onChange(defaultAufgabenFilter)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...chipStyle }}
          >
            <X className="w-3 h-3" />
            Zurücksetzen
          </button>
        )}

      </div>
    </div>
  )
}
