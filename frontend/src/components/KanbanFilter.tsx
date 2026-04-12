import { useSearchParams } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import type { Person, Correspondent, KanbanBoard } from '../types'

// ─── URL-State helpers ────────────────────────────────────────────────────────

export function useKanbanFilter() {
  const [params, setParams] = useSearchParams()

  const personen = params.get('personen')?.split(',').filter(Boolean) ?? []
  const typen = params.get('typen')?.split(',').filter(Boolean) ?? []
  const korrespondenten = params.get('korrespondenten')?.split(',').filter(Boolean) ?? []
  const von = params.get('von') ?? ''
  const bis = params.get('bis') ?? ''

  function set(key: string, values: string[]) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (values.length === 0) next.delete(key)
      else next.set(key, values.join(','))
      return next
    }, { replace: true })
  }

  function setDate(key: string, value: string) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (!value) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  function clearAll() {
    setParams({}, { replace: true })
  }

  const hasFilter = personen.length > 0 || typen.length > 0 || korrespondenten.length > 0 || !!von || !!bis

  return { personen, typen, korrespondenten, von, bis, set, setDate, clearAll, hasFilter }
}

// ─── Filter-Funktion für Kanban-Daten ─────────────────────────────────────────

export function filterKanban(
  kanban: KanbanBoard,
  filter: ReturnType<typeof useKanbanFilter>
): KanbanBoard {
  const { personen, typen, korrespondenten, von, bis } = filter
  if (!filter.hasFilter) return kanban

  function filterList<T extends { person_id: string; typ: string; leistungserbringer_id: string; datum: string }>(
    items: T[]
  ): T[] {
    return items.filter(r => {
      if (personen.length > 0 && !personen.includes(r.person_id)) return false
      if (typen.length > 0 && !typen.includes(r.typ)) return false
      if (korrespondenten.length > 0 && !korrespondenten.includes(r.leistungserbringer_id)) return false
      if (von && r.datum < von) return false
      if (bis && r.datum > bis) return false
      return true
    })
  }

  return {
    neu: filterList(kanban.neu),
    bezahlt: filterList(kanban.bezahlt),
    beihilfe_eingereicht: filterList(kanban.beihilfe_eingereicht),
    pkv_eingereicht: filterList(kanban.pkv_eingereicht),
    abgeschlossen: filterList(kanban.abgeschlossen),
  }
}

// ─── Dropdown-Checkbox ────────────────────────────────────────────────────────

function MultiSelectDropdown({
  label, options, selected, onChange, searchable,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = searchable
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(s => s !== id))
    else onChange([...selected, id])
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 text-xs rounded border transition-colors ${
          selected.length > 0
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
            {selected.length}
          </span>
        )}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[min(95vw,13rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
          {searchable && (
            <div className="px-2 pt-1 pb-1">
              <input
                autoFocus
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Keine Ergebnisse</p>
            )}
            {filtered.map(o => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{o.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1">
              <button onClick={() => onChange([])} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Alle entfernen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Schnellauswahl ───────────────────────────────────────────────────────────

function getQuickRange(key: string): { von: string; bis: string } {
  const today = new Date()
  const year = today.getFullYear()
  if (key === 'dieses_jahr') return { von: `${year}-01-01`, bis: `${year}-12-31` }
  if (key === 'letztes_jahr') return { von: `${year - 1}-01-01`, bis: `${year - 1}-12-31` }
  if (key === 'letzte_3m') {
    const d = new Date(today)
    d.setMonth(d.getMonth() - 3)
    return { von: d.toISOString().slice(0, 10), bis: today.toISOString().slice(0, 10) }
  }
  return { von: '', bis: '' }
}

// ─── Filter-Chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-[11px] rounded-full shrink-0">
      {label}
      <button onClick={onRemove} className="hover:text-blue-600 dark:hover:text-blue-400">×</button>
    </span>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

const TYPEN = [
  { id: 'arzt', label: 'Arzt' },
  { id: 'apotheke', label: 'Apotheke' },
  { id: 'krankenhaus', label: 'Krankenhaus' },
]

interface Props {
  personen: Person[]
  correspondents: Correspondent[]
  filter: ReturnType<typeof useKanbanFilter>
  groupByPerson: boolean
  onGroupByPerson: (v: boolean) => void
  compact: boolean
  onCompact: (v: boolean) => void
}

export default function KanbanFilter({ personen, correspondents, filter, groupByPerson, onGroupByPerson, compact, onCompact }: Props) {
  const { personen: selPersonen, typen, korrespondenten, von, bis, set, setDate } = filter

  const personenOptions = personen.map(p => ({ id: p.id, label: p.name }))
  const corrOptions = correspondents.map(c => ({ id: c.id, label: c.name }))

  const personMap = Object.fromEntries(personen.map(p => [p.id, p.name]))
  const corrMap = Object.fromEntries(correspondents.map(c => [c.id, c.name]))

  const applyQuick = (key: string) => {
    const { von, bis } = getQuickRange(key)
    setDate('von', von)
    setDate('bis', bis)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">

        {/* Filter-Dropdowns */}
        <MultiSelectDropdown
          label="Person"
          options={personenOptions}
          selected={selPersonen}
          onChange={ids => set('personen', ids)}
        />
        <MultiSelectDropdown
          label="Typ"
          options={TYPEN}
          selected={typen}
          onChange={ids => set('typen', ids)}
        />
        <MultiSelectDropdown
          label="Korrespondent"
          options={corrOptions}
          selected={korrespondenten}
          onChange={ids => set('korrespondenten', ids)}
          searchable
        />

        {/* Zeitraum */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Von</span>
          <input
            type="date"
            value={von}
            onChange={e => setDate('von', e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 sm:py-0.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-auto"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">Bis</span>
          <input
            type="date"
            value={bis}
            onChange={e => setDate('bis', e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 sm:py-0.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-auto"
          />
        </div>

        {/* Schnellauswahl */}
        {[
          { key: 'dieses_jahr', label: 'Dieses Jahr' },
          { key: 'letztes_jahr', label: 'Letztes Jahr' },
          { key: 'letzte_3m', label: '3M' },
        ].map(q => (
          <button
            key={q.key}
            onClick={() => applyQuick(q.key)}
            className="px-2 py-1 sm:px-1.5 sm:py-0.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
          >
            {q.label}
          </button>
        ))}

        {/* Aktive Filter-Chips inline */}
        {selPersonen.map(id => (
          <FilterChip
            key={id}
            label={`${personMap[id] ?? id}`}
            onRemove={() => set('personen', selPersonen.filter(x => x !== id))}
          />
        ))}
        {typen.map(t => (
          <FilterChip
            key={t}
            label={TYPEN.find(x => x.id === t)?.label ?? t}
            onRemove={() => set('typen', typen.filter(x => x !== t))}
          />
        ))}
        {korrespondenten.map(id => (
          <FilterChip
            key={id}
            label={corrMap[id] ?? id}
            onRemove={() => set('korrespondenten', korrespondenten.filter(x => x !== id))}
          />
        ))}
        {(von || bis) && (
          <FilterChip
            label={`${von || '…'} – ${bis || '…'}`}
            onRemove={() => { setDate('von', ''); setDate('bis', '') }}
          />
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Nach Status / Nach Person */}
        <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-xs shrink-0">
          <button
            onClick={() => onGroupByPerson(false)}
            className={`px-3 py-1.5 sm:px-2 sm:py-1 ${!groupByPerson
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            Status
          </button>
          <button
            onClick={() => onGroupByPerson(true)}
            className={`px-3 py-1.5 sm:px-2 sm:py-1 border-l border-gray-300 dark:border-gray-600 ${groupByPerson
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            Person
          </button>
        </div>

        {/* Kompakt-Toggle */}
        <button
          onClick={() => onCompact(!compact)}
          title={compact ? 'Detailansicht' : 'Kompaktansicht'}
          className="p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          {compact ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          )}
        </button>

      </div>
    </div>
  )
}
